export class Runner {
  constructor({ graph, registry, hooks, cyclesPerFrame = 1 }) {
    this.graph = graph;
    this.registry = registry;
    this.hooks = hooks;
    this.running = false;
    this._raf = null;
    this._last = 0;
    this.cyclesPerFrame = Math.max(1, cyclesPerFrame | 0);
    this.executionMode = "run"; // "run" or "step"
    this.activePlan = null;
    this.activeStepIndex = -1;
    this.stepCache = new Map();
  }

  isRunning() {
    return this.running;
  }

  setCyclesPerFrame(n) {
    this.cyclesPerFrame = Math.max(1, n | 0);
  }

  step(cycles = 1, dt = 0) {
    const nCycles = Math.max(1, cycles | 0);
    for (let c = 0; c < nCycles; c++) {
      for (const node of this.graph.nodes.values()) {
        const def = this.registry.types.get(node.type);
        if (def?.onExecute) {
          try {
            def.onExecute(node, {
              dt,
              graph: this.graph,
              getInput: (portName) => {
                const p =
                  node.inputs.find((i) => i.name === portName) ||
                  node.inputs[0];
                return p ? this.graph.getInput(node.id, p.id) : undefined;
              },
              setOutput: (portName, value) => {
                const p =
                  node.outputs.find((o) => o.name === portName) ||
                  node.outputs[0];
                if (p) this.graph.setOutput(node.id, p.id, value);
              },
            });
          } catch (err) {
            this.hooks?.emit?.("error", err);
          }
        }
      }
      this.graph.swapBuffers();
    }
  }

  /**
   * Execute connected nodes once from a starting node.
   * Returns execEdgeOrder: exec edges in the order they were traversed.
   */
  runOnce(startNodeId, dt = 0) {
    const executedNodes = [];
    const allConnectedNodes = new Set();
    const execEdgeOrder = []; // exec edge IDs in traversal order
    const rawSteps = []; // array of { nodeId, edgeId }

    // Local output cache: nodeId:portId → value
    // Ensures outputs written by executeNode are immediately readable by subsequent nodes
    const runCache = new Map();

    // Queue items: { nodeId, fromEdgeId }
    const queue = [{ nodeId: startNodeId, fromEdgeId: null }];
    const visited = new Set();

    while (queue.length > 0) {
      const { nodeId: currentNodeId, fromEdgeId } = queue.shift();

      if (visited.has(currentNodeId)) continue;
      visited.add(currentNodeId);

      // Record the exec edge that led to this node
      if (fromEdgeId) execEdgeOrder.push(fromEdgeId);

      const node = this.graph.nodes.get(currentNodeId);
      if (!node) continue;

      executedNodes.push(currentNodeId);
      allConnectedNodes.add(currentNodeId);

      // Execute data dependency nodes first
      for (const input of node.inputs) {
        if (input.portType === "data") {
          for (const edge of this.graph.edges.values()) {
            if (edge.toNode === currentNodeId && edge.toPort === input.id) {
              const sourceNode = this.graph.nodes.get(edge.fromNode);
              if (sourceNode) {
                if (!allConnectedNodes.has(edge.fromNode)) {
                  allConnectedNodes.add(edge.fromNode);
                  this._executeNodeWithCache(edge.fromNode, dt, runCache);
                  rawSteps.push({ nodeId: edge.fromNode, edgeId: null });
                }
                rawSteps.push({ nodeId: currentNodeId, edgeId: edge.id });
              }
            }
          }
        }
      }

      // Execute this node
      this._executeNodeWithCache(currentNodeId, dt, runCache);
      rawSteps.push({ nodeId: currentNodeId, edgeId: fromEdgeId });

      // Find exec output edges and enqueue next nodes
      // Conditional exec: if setOutput was called for an exec port, only follow when truthy
      const execOutputPorts = node.outputs.filter((p) => p.portType === "exec");
      for (const execOutput of execOutputPorts) {
        const execKey = `${currentNodeId}:${execOutput.id}`;
        const execVal = runCache.get(execKey);
        // If a value was explicitly written, respect it; absent = always fire
        if (runCache.has(execKey) && !execVal) continue;
        for (const edge of this.graph.edges.values()) {
          if (edge.fromNode === currentNodeId && edge.fromPort === execOutput.id) {
            queue.push({ nodeId: edge.toNode, fromEdgeId: edge.id });
          }
        }
      }
    }

    // Collect all edges involved (both exec and data)
    const connectedEdges = new Set();
    for (const edge of this.graph.edges.values()) {
      if (allConnectedNodes.has(edge.fromNode) && allConnectedNodes.has(edge.toNode)) {
        connectedEdges.add(edge.id);
      }
    }

    // Filter redundant steps (node-only step when there's an edge step for it)
    const hasEdgeStep = new Set();
    for (const step of rawSteps) {
      if (step.edgeId) hasEdgeStep.add(step.nodeId);
    }
    const executionSteps = rawSteps.filter((step) => {
      if (step.edgeId === null && hasEdgeStep.has(step.nodeId)) {
        return false;
      }
      return true;
    });

    return { connectedNodes: allConnectedNodes, connectedEdges, execEdgeOrder, executionSteps };
  }

  setExecutionMode(mode) {
    this.executionMode = mode;
    if (mode === "run") this.resetStepping();
  }

  resetStepping() {
    this.activePlan = null;
    this.activeStepIndex = -1;
    this.stepCache.clear();
    this.hooks?.emit?.("runner:step-updated", { activeNodeId: null });
  }

  buildPlan(startNodeId) {
    const plan = [];
    const allConnectedNodes = new Set();
    const queue = [{ nodeId: startNodeId, fromEdgeId: null }];
    const visited = new Set();

    while (queue.length > 0) {
      const { nodeId: currentNodeId, fromEdgeId } = queue.shift();
      if (visited.has(currentNodeId)) continue;
      visited.add(currentNodeId);
      allConnectedNodes.add(currentNodeId);

      const node = this.graph.nodes.get(currentNodeId);
      if (!node) continue;

      // Collect data dependency nodes (in order) for this exec node
      const dataDeps = [];
      for (const input of node.inputs) {
        if (input.portType === "data") {
          for (const edge of this.graph.edges.values()) {
            if (edge.toNode === currentNodeId && edge.toPort === input.id) {
              const srcId = edge.fromNode;
              if (!allConnectedNodes.has(srcId)) {
                allConnectedNodes.add(srcId);
                dataDeps.push(srcId);
              }
            }
          }
        }
      }

      // Find ALL incoming edges (both exec and data) to highlight them in Step Mode
      const incomingEdges = [];
      for (const edge of this.graph.edges.values()) {
        if (edge.toNode === currentNodeId) {
          incomingEdges.push(edge.id);
        }
      }

      plan.push({ nodeId: currentNodeId, fromEdgeId, incomingEdges, dataDeps });

      // Enqueue next exec nodes
      const execOutputs = node.outputs.filter((p) => p.portType === "exec");
      for (const execOutput of execOutputs) {
        for (const edge of this.graph.edges.values()) {
          if (edge.fromNode === currentNodeId && edge.fromPort === execOutput.id) {
            queue.push({ nodeId: edge.toNode, fromEdgeId: edge.id });
          }
        }
      }
    }

    return plan;
  }

  startStepping(startNodeId) {
    this.stepCache.clear();
    this.activePlan = this.buildPlan(startNodeId);
    this.activeStepIndex = 0;
    const step = this.activePlan[0];
    this.hooks?.emit?.("runner:step-updated", {
      activeNodeId: step?.nodeId,
      activeEdgeIds: step?.incomingEdges || [],
    });
    this.start(); // Start the loop to driving animations
  }

  executeNextStep() {
    if (!this.activePlan || this.activeStepIndex < 0 || this.activeStepIndex >= this.activePlan.length) {
      this.resetStepping();
      return null;
    }

    const step = this.activePlan[this.activeStepIndex];

    // Execute data deps
    for (const depId of step.dataDeps) {
      this._executeNodeWithCache(depId, 0, this.stepCache);
    }

    // Execute main node
    this._executeNodeWithCache(step.nodeId, 0, this.stepCache);

    this.activeStepIndex++;

    if (this.activeStepIndex < this.activePlan.length) {
      const nextStep = this.activePlan[this.activeStepIndex];
      this.hooks?.emit?.("runner:step-updated", {
        activeNodeId: nextStep.nodeId,
        activeEdgeIds: nextStep.incomingEdges || [],
      });
    } else {
      this.hooks?.emit?.("runner:step-updated", { activeNodeId: null });
      this.resetStepping();
    }

    return step.nodeId;
  }

  /** Execute a node using a shared run-local output cache for reliable data passing. */
  _executeNodeWithCache(nodeId, dt, runCache) {
    const node = this.graph.nodes.get(nodeId);
    if (!node) return;
    const def = this.registry.types.get(node.type);
    if (!def?.onExecute) return;

    const ctx = {
      dt,
      graph: this.graph,
      getInput: (portName) => {
        const p = node.inputs.find((i) => i.name === portName) || node.inputs[0];
        if (!p) return undefined;
        for (const edge of this.graph.edges.values()) {
          if (edge.toNode === nodeId && edge.toPort === p.id) {
            const key = `${edge.fromNode}:${edge.fromPort}`;
            return runCache.has(key) ? runCache.get(key) : this.graph._curBuf().get(key);
          }
        }
        return undefined;
      },
      setOutput: (portName, value) => {
        const p = node.outputs.find((o) => o.name === portName) || node.outputs[0];
        if (p) runCache.set(`${node.id}:${p.id}`, value);
      },
    };

    try {
      const result = def.onExecute(node, ctx);
      if (result instanceof Promise) {
        result
          .then(() => { node._execError = null; })
          .catch((err) => {
            node._execError = { message: err.message, timestamp: Date.now() };
            this.hooks?.emit?.("error", { node, error: err });
          });
      } else {
        node._execError = null;
      }
    } catch (err) {
      node._execError = { message: err.message, timestamp: Date.now() };
      this.hooks?.emit?.("error", { node, error: err });
    }
  }

  findAllNextExecNodes(nodeId) {
    const node = this.graph.nodes.get(nodeId);
    if (!node) return [];

    const execOutputs = node.outputs.filter((p) => p.portType === "exec");
    if (execOutputs.length === 0) return [];

    const nextNodes = [];
    for (const execOutput of execOutputs) {
      for (const edge of this.graph.edges.values()) {
        if (edge.fromNode === nodeId && edge.fromPort === execOutput.id) {
          nextNodes.push(edge.toNode);
        }
      }
    }
    return nextNodes;
  }

  executeNode(nodeId, dt) {
    const node = this.graph.nodes.get(nodeId);
    if (!node) return;

    const def = this.registry.types.get(node.type);
    if (!def?.onExecute) return;

    try {
      def.onExecute(node, {
        dt,
        graph: this.graph,
        getInput: (portName) => {
          const p = node.inputs.find((i) => i.name === portName) || node.inputs[0];
          return p ? this.graph.getInput(node.id, p.id) : undefined;
        },
        setOutput: (portName, value) => {
          const p = node.outputs.find((o) => o.name === portName) || node.outputs[0];
          if (p) {
            const key = `${node.id}:${p.id}`;
            this.graph._curBuf().set(key, value);
          }
        },
      });
    } catch (err) {
      this.hooks?.emit?.("error", err);
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._last = 0;
    this.hooks?.emit?.("runner:start");

    const loop = (t) => {
      if (!this.running) return;
      const dtMs = this._last ? t - this._last : 0;
      this._last = t;
      const dt = dtMs / 1000;

      // Only execute nodes automatically in "run" mode.
      // In "step" mode, we only want the loop to fire for animations (via tick event).
      if (this.executionMode === "run") {
        this.step(this.cyclesPerFrame, dt);
      }

      this.hooks?.emit?.("runner:tick", {
        time: t,
        dt,
        running: true,
        cps: this.cyclesPerFrame,
      });

      this._raf = requestAnimationFrame(loop);
    };

    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    this._last = 0;
    this.hooks?.emit?.("runner:stop");
  }
}
