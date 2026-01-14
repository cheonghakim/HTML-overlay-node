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

  // 외부에서 실행 중인지 확인
  isRunning() {
    return this.running;
  }

  // 실행 도중에도 CPS 변경 가능
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
      // commit writes for this cycle
      this.graph.swapBuffers();
    }
  }

  /**
   * Execute connected nodes once from a starting node
   * Uses queue-based traversal to support branching exec flows
   * @param {string} startNodeId - ID of the node to start from
   * @param {number} dt - Delta time
   */
  runOnce(startNodeId, dt = 0) {
    console.log("[Runner.runOnce] Starting exec flow from node:", startNodeId);

    const executedNodes = [];
    const allConnectedNodes = new Set();
    const queue = [startNodeId];
    const visited = new Set(); // Prevent infinite loops

    // Queue-based traversal for branching execution
    while (queue.length > 0) {
      const currentNodeId = queue.shift();

      // Skip if already executed (prevents cycles)
      if (visited.has(currentNodeId)) continue;
      visited.add(currentNodeId);

      const node = this.graph.nodes.get(currentNodeId);
      if (!node) {
        console.warn(`[Runner.runOnce] Node not found: ${currentNodeId}`);
        continue;
      }

      executedNodes.push(currentNodeId);
      allConnectedNodes.add(currentNodeId);
      console.log(`[Runner.runOnce] Executing: ${node.title} (${node.type})`);

      // Find and add data dependency nodes (nodes providing input data)
      for (const input of node.inputs) {
        if (input.portType === "data") {
          // Find edge feeding this data input
          for (const edge of this.graph.edges.values()) {
            if (edge.toNode === currentNodeId && edge.toPort === input.id) {
              const sourceNode = this.graph.nodes.get(edge.fromNode);
              if (sourceNode && !allConnectedNodes.has(edge.fromNode)) {
                allConnectedNodes.add(edge.fromNode);
                // Execute data source node before current node
                this.executeNode(edge.fromNode, dt);
              }
            }
          }
        }
      }

      // Execute current node
      this.executeNode(currentNodeId, dt);

      // Find all next nodes via exec outputs and add to queue
      const nextNodes = this.findAllNextExecNodes(currentNodeId);
      queue.push(...nextNodes);
    }

    console.log("[Runner.runOnce] Executed nodes:", executedNodes.length);

    // Find all edges involved (both exec and data)
    const connectedEdges = new Set();
    for (const edge of this.graph.edges.values()) {
      if (allConnectedNodes.has(edge.fromNode) && allConnectedNodes.has(edge.toNode)) {
        connectedEdges.add(edge.id);
      }
    }

    console.log("[Runner.runOnce] Connected edges count:", connectedEdges.size);
    return { connectedNodes: allConnectedNodes, connectedEdges };
  }

  /**
   * Find all nodes connected via exec outputs
   * Supports multiple connections from a single exec output
   * @param {string} nodeId - Current node ID
   * @returns {string[]} Array of next node IDs
   */
  findAllNextExecNodes(nodeId) {
    const node = this.graph.nodes.get(nodeId);
    if (!node) return [];

    // Find all exec output ports
    const execOutputs = node.outputs.filter(p => p.portType === "exec");
    if (execOutputs.length === 0) return [];

    const nextNodes = [];

    // Find all edges from exec outputs
    for (const execOutput of execOutputs) {
      for (const edge of this.graph.edges.values()) {
        if (edge.fromNode === nodeId && edge.fromPort === execOutput.id) {
          nextNodes.push(edge.toNode);
        }
      }
    }

    return nextNodes;
  }

  /**
   * Execute a single node
   * @param {string} nodeId - Node ID to execute
   * @param {number} dt - Delta time
   */
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
            // Write directly to current buffer so other nodes can read it immediately
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
      const dt = dtMs / 1000; // seconds

      // 1) 스텝 실행
      this.step(this.cyclesPerFrame, dt);

      // 2) 프레임 훅 (렌더러/컨트롤러는 여기서 running, time, dt를 받아 표현 업데이트)
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
