export class Runner {
  constructor({ graph, registry, hooks, cyclesPerFrame = 1 }) {
    this.graph = graph;
    this.registry = registry;
    this.hooks = hooks;
    this.running = false;
    this._raf = null;
    this._last = 0;
    this.cyclesPerFrame = Math.max(1, cyclesPerFrame | 0);
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
              if (sourceNode && !allConnectedNodes.has(edge.fromNode)) {
                allConnectedNodes.add(edge.fromNode);
                this.executeNode(edge.fromNode, dt);
              }
            }
          }
        }
      }

      // Execute this node
      this.executeNode(currentNodeId, dt);

      // Find exec output edges and enqueue next nodes
      const execOutputs = node.outputs.filter((p) => p.portType === "exec");
      for (const execOutput of execOutputs) {
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

    return { connectedNodes: allConnectedNodes, connectedEdges, execEdgeOrder };
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

      this.step(this.cyclesPerFrame, dt);

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
