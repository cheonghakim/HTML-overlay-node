import { Node } from "./Node.js";
import { Edge } from "./Edge.js";
import { GroupManager } from "../groups/GroupManager.js";

/**
 * Graph manages the collection of nodes and edges
 */
export class Graph {
  /**
   * Create a new Graph
   * @param {Object} options - Graph configuration
   * @param {Object} options.hooks - Event hooks system
   * @param {Object} options.registry - Node type registry
   */
  constructor({ hooks, registry }) {
    if (!registry) {
      throw new Error("Graph requires a registry");
    }
    this.nodes = new Map();
    this.edges = new Map();
    this.hooks = hooks;
    this.registry = registry;
    // double buffer for deterministic cycles
    this._valuesA = new Map(); // current
    this._valuesB = new Map(); // next
    this._useAasCurrent = true;

    this.groupManager = new GroupManager({
      graph: this,
      hooks: this.hooks,
    });
  }
  /**
   * Get a node by its ID
   * @param {string} id - Node ID
   * @returns {Node|null} The node or null if not found
   */
  getNodeById(id) {
    return this.nodes.get(id) || null;
  }
  /**
   * Add a node to the graph
   * @param {string} type - Node type identifier
   * @param {Object} [opts={}] - Additional node options (x, y, width, height, etc.)
   * @returns {Node} The created node
   * @throws {Error} If node type is not registered
   */
  addNode(type, opts = {}) {
    const def = this.registry.types.get(type);
    if (!def) {
      const available = Array.from(this.registry.types.keys()).join(", ") || "none";
      throw new Error(`Unknown node type: "${type}". Available types: ${available}`);
    }
    const node = new Node({
      type,
      title: def.title,
      width: def.size?.w,
      height: def.size?.h,
      ...opts,
    });
    for (const i of def.inputs || []) node.addInput(i.name, i.datatype);
    for (const o of def.outputs || []) node.addOutput(o.name, o.datatype);
    def.onCreate?.(node);
    this.nodes.set(node.id, node);
    this.hooks?.emit("node:create", node);
    return node;
  }
  /**
   * Remove a node and its connected edges from the graph
   * @param {string} nodeId - ID of the node to remove
   */
  removeNode(nodeId) {
    // Remove all edges connected to this node
    for (const [eid, e] of this.edges) {
      if (e.fromNode === nodeId || e.toNode === nodeId) {
        this.edges.delete(eid);
      }
    }
    this.nodes.delete(nodeId);
  }
  /**
   * Add an edge connecting two node ports
   * @param {string} fromNode - Source node ID
   * @param {string} fromPort - Source port ID
   * @param {string} toNode - Target node ID
   * @param {string} toPort - Target port ID
   * @returns {Edge} The created edge
   * @throws {Error} If nodes don't exist
   */
  addEdge(fromNode, fromPort, toNode, toPort) {
    // Validate nodes exist
    if (!this.nodes.has(fromNode)) {
      throw new Error(`Cannot create edge: source node "${fromNode}" not found`);
    }
    if (!this.nodes.has(toNode)) {
      throw new Error(`Cannot create edge: target node "${toNode}" not found`);
    }

    const e = new Edge({ fromNode, fromPort, toNode, toPort });
    this.edges.set(e.id, e);
    this.hooks?.emit("edge:create", e);
    return e;
  }

  /**
   * Clear all nodes and edges from the graph
   */
  clear() {
    this.nodes.clear();
    this.edges.clear();
  }

  updateWorldTransforms() {
    // 1. Find roots
    const roots = [];
    for (const n of this.nodes.values()) {
      if (!n.parent) roots.push(n);
    }

    // 2. Traverse
    const stack = roots.map((n) => ({ node: n, px: 0, py: 0 }));
    while (stack.length > 0) {
      const { node, px, py } = stack.pop();
      node.computed.x = px + node.pos.x;
      node.computed.y = py + node.pos.y;
      node.computed.w = node.size.width;
      node.computed.h = node.size.height;

      for (const child of node.children) {
        stack.push({ node: child, px: node.computed.x, py: node.computed.y });
      }
    }
  }

  reparent(node, newParent) {
    if (node.parent === newParent) return;

    // 1. Calculate current world pos
    const wx = node.computed.x;
    const wy = node.computed.y;

    // 2. Remove from old parent
    if (node.parent) {
      node.parent.children.delete(node);
    }

    // 3. Add to new parent
    node.parent = newParent;
    if (newParent) {
      newParent.children.add(node);
      // 4. Calculate new local pos
      // world = parentWorld + local => local = world - parentWorld
      node.pos.x = wx - newParent.computed.x;
      node.pos.y = wy - newParent.computed.y;
    } else {
      // Root
      node.pos.x = wx;
      node.pos.y = wy;
    }
    
    this.updateWorldTransforms();
  }

  // buffer helpers
  _curBuf() {
    return this._useAasCurrent ? this._valuesA : this._valuesB;
  }
  _nextBuf() {
    return this._useAasCurrent ? this._valuesB : this._valuesA;
  }
  swapBuffers() {
    // when moving to next cycle, promote next->current and clear next
    this._useAasCurrent = !this._useAasCurrent;
    this._nextBuf().clear();
  }
  // data helpers
  setOutput(nodeId, portId, value) {
    this._nextBuf().set(`${nodeId}:${portId}`, value);
  }
  getInput(nodeId, portId) {
    // find upstream edge feeding this input
    for (const e of this.edges.values()) {
      if (e.toNode === nodeId && e.toPort === portId) {
        return this._curBuf().get(`${e.fromNode}:${e.fromPort}`);
      }
    }
    return undefined;
  }
  toJSON() {
    const json = {
      nodes: [...this.nodes.values()].map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        x: n.pos.x,
        y: n.pos.y,
        w: n.size.width,
        h: n.size.height,
        inputs: n.inputs,
        outputs: n.outputs,
        state: n.state,
      })),
      edges: [...this.edges.values()],
    };
    this.hooks?.emit("graph:serialize", json);
    return json;
  }
  fromJSON(json) {
    this.clear();
    for (const nd of json.nodes) {
      const node = new Node({
        id: nd.id,
        type: nd.type,
        title: nd.title,
        x: nd.x,
        y: nd.y,
        width: nd.w,
        height: nd.h,
      });
      node.inputs = nd.inputs;
      node.outputs = nd.outputs;
      node.state = nd.state || {};
      this.nodes.set(node.id, node);
    }
    for (const ed of json.edges) this.edges.set(ed.id, new Edge(ed));
    return this;
  }
}
