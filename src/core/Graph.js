import { Node } from "./Node.js";
import { Edge } from "./Edge.js";
import { GroupManager } from "../groups/GroupManager.js";
import { deepClone } from "../utils/utils.js";

/**
 * Graph manages the collection of nodes and edges
 */
export class Graph {
  static SCHEMA_VERSION = 2;
  static DEFAULT_META = { name: "Untitled", description: "", author: "" };

  constructor({ hooks, registry }) {
    if (!registry) {
      throw new Error("Graph requires a registry");
    }
    this.nodes = new Map();
    this.edges = new Map();
    this.hooks = hooks;
    this.registry = registry;
    this._valuesA = new Map();
    this._valuesB = new Map();
    this._useAasCurrent = true;
    this.meta = { ...Graph.DEFAULT_META };

    this.groupManager = new GroupManager({
      graph: this,
      hooks: this.hooks,
    });
  }

  getNodeById(id) {
    return this.nodes.get(id) || null;
  }

  addNode(type, opts = {}) {
    const def = this.registry.types.get(type);
    if (!def) {
      const available = Array.from(this.registry.types.keys()).join(", ") || "none";
      throw new Error(`Unknown node type: "${type}". Available types: ${available}`);
    }
    const height = opts.height || def.size?.h || this._calculateDefaultNodeHeight(def);

    const node = new Node({
      ...opts,
      type,
      title: def.title,
      width: opts.width || def.size?.w || 140,
      height,
    });
    for (const input of def.inputs || []) {
      node.addInput(input.name, input.datatype, input.portType || "data");
    }
    for (const output of def.outputs || []) {
      node.addOutput(output.name, output.datatype, output.portType || "data");
    }
    def.onCreate?.(node);
    this.nodes.set(node.id, node);
    this.hooks?.emit("node:create", node);
    return node;
  }

  removeNode(nodeId) {
    for (const [edgeId, edge] of this.edges) {
      if (edge.fromNode === nodeId || edge.toNode === nodeId) {
        this.edges.delete(edgeId);
      }
    }
    this.nodes.delete(nodeId);
  }

  addEdge(fromNode, fromPort, toNode, toPort) {
    if (!this.nodes.has(fromNode)) {
      throw new Error(`Cannot create edge: source node "${fromNode}" not found`);
    }
    if (!this.nodes.has(toNode)) {
      throw new Error(`Cannot create edge: target node "${toNode}" not found`);
    }
    if (!this._hasPort(fromNode, fromPort, "out")) {
      throw new Error(`Cannot create edge: source port "${fromPort}" not found on node "${fromNode}"`);
    }
    if (!this._hasPort(toNode, toPort, "in")) {
      throw new Error(`Cannot create edge: target port "${toPort}" not found on node "${toNode}"`);
    }

    const edge = new Edge({ fromNode, fromPort, toNode, toPort });
    this.edges.set(edge.id, edge);
    this.hooks?.emit("edge:create", edge);
    return edge;
  }

  clear() {
    this.nodes.clear();
    this.edges.clear();
    this._resetRuntimeState();
  }

  updateWorldTransforms() {
    const roots = [];
    for (const node of this.nodes.values()) {
      if (!node.parent) roots.push(node);
    }

    const stack = roots.map((node) => ({ node, px: 0, py: 0 }));
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

    const wx = node.computed.x;
    const wy = node.computed.y;

    if (node.parent) {
      node.parent.children.delete(node);
    }

    node.parent = newParent;
    if (newParent) {
      newParent.children.add(node);
      node.pos.x = wx - newParent.computed.x;
      node.pos.y = wy - newParent.computed.y;
    } else {
      node.pos.x = wx;
      node.pos.y = wy;
    }

    this.updateWorldTransforms();
  }

  _curBuf() {
    return this._useAasCurrent ? this._valuesA : this._valuesB;
  }

  _nextBuf() {
    return this._useAasCurrent ? this._valuesB : this._valuesA;
  }

  swapBuffers() {
    this._useAasCurrent = !this._useAasCurrent;
    this._nextBuf().clear();
  }

  setOutput(nodeId, portId, value) {
    const key = `${nodeId}:${portId}`;
    this._nextBuf().set(key, value);
  }

  getInput(nodeId, portId) {
    for (const edge of this.edges.values()) {
      if (edge.toNode === nodeId && edge.toPort === portId) {
        const key = `${edge.fromNode}:${edge.fromPort}`;
        return this._curBuf().get(key);
      }
    }
    return undefined;
  }

  toJSON() {
    const json = {
      version: Graph.SCHEMA_VERSION,
      meta: deepClone(this.meta),
      nodes: [...this.nodes.values()].map((node) => ({
        id: node.id,
        type: node.type,
        title: node.title,
        x: node.pos.x,
        y: node.pos.y,
        w: node.size.width,
        h: node.size.height,
        inputs: deepClone(node.inputs),
        outputs: deepClone(node.outputs),
        state: deepClone(node.state),
        parentId: node.parent?.id || null,
        locked: node.locked || undefined,
        description: node.description || undefined,
      })),
      edges: [...this.edges.values()].map((edge) => ({
        id: edge.id,
        fromNode: edge.fromNode,
        fromPort: edge.fromPort,
        toNode: edge.toNode,
        toPort: edge.toPort,
        route: deepClone(edge.route) || undefined,
        label: edge.label || undefined,
      })),
    };
    this.hooks?.emit("graph:serialize", json);
    return json;
  }

  fromJSON(rawJson, options = {}) {
    const { preserveOnError = true } = options;
    const previousSnapshot = preserveOnError ? this._snapshot() : null;

    try {
      const json = Graph._migrate(rawJson);
      const normalized = this._normalizeGraphJSON(json);
      this._applyNormalizedGraph(normalized);
      const serialized = deepClone(this._snapshot());
      this.hooks?.emit("graph:deserialize", serialized);
      return this;
    } catch (error) {
      if (previousSnapshot) {
        this._applyNormalizedGraph(previousSnapshot);
      }
      this.hooks?.emit?.("error", error);
      throw error;
    }
  }

  /**
   * Forward-only migration chain. Each entry converts fromVersion → toVersion.
   * To add a new schema version: push a new entry and bump SCHEMA_VERSION.
   */
  static _migrations = [
    {
      fromVersion: 1,
      toVersion: 2,
      migrate(data) {
        data.meta = data.meta ?? { ...Graph.DEFAULT_META };
      },
    },
  ];

  static _migrate(json) {
    const data = typeof json === "string" ? JSON.parse(json) : deepClone(json);
    let ver = data.version ?? 1;

    for (const step of Graph._migrations) {
      if (ver === step.fromVersion) {
        step.migrate(data);
        data.version = step.toVersion;
        ver = step.toVersion;
      }
    }

    return data;
  }

  _snapshot() {
    return this._normalizeGraphJSON({
      version: Graph.SCHEMA_VERSION,
      meta: deepClone(this.meta),
      nodes: [...this.nodes.values()].map((node) => ({
        id: node.id,
        type: node.type,
        title: node.title,
        x: node.pos.x,
        y: node.pos.y,
        w: node.size.width,
        h: node.size.height,
        inputs: deepClone(node.inputs),
        outputs: deepClone(node.outputs),
        state: deepClone(node.state),
        parentId: node.parent?.id || null,
        locked: !!node.locked,
        description: node.description || "",
      })),
      edges: [...this.edges.values()].map((edge) => ({
        id: edge.id,
        fromNode: edge.fromNode,
        fromPort: edge.fromPort,
        toNode: edge.toNode,
        toPort: edge.toPort,
        route: deepClone(edge.route),
        label: edge.label,
      })),
    });
  }

  _normalizeGraphJSON(json) {
    if (!json || typeof json !== "object") {
      throw new Error("Graph JSON must be an object");
    }
    if (!Array.isArray(json.nodes)) {
      throw new Error('Graph JSON must include a "nodes" array');
    }
    if (!Array.isArray(json.edges)) {
      throw new Error('Graph JSON must include an "edges" array');
    }

    const normalized = {
      version: Number.isFinite(json.version) ? json.version : Graph.SCHEMA_VERSION,
      meta: { ...Graph.DEFAULT_META, ...(json.meta || {}) },
      nodes: [],
      edges: [],
    };

    const nodeIds = new Set();
    const normalizedNodeMap = new Map();

    for (const rawNode of json.nodes) {
      if (!rawNode || typeof rawNode !== "object") {
        throw new Error("Each node must be an object");
      }
      if (typeof rawNode.id !== "string" || !rawNode.id) {
        throw new Error("Each node must have a non-empty string id");
      }
      if (nodeIds.has(rawNode.id)) {
        throw new Error(`Duplicate node id "${rawNode.id}"`);
      }
      if (typeof rawNode.type !== "string" || !rawNode.type) {
        throw new Error(`Node "${rawNode.id}" is missing a valid type`);
      }

      const def = this.registry?.types?.get(rawNode.type);
      if (!def) {
        throw new Error(`Unknown node type: "${rawNode.type}"`);
      }

      const normalizedNode = {
        id: rawNode.id,
        type: rawNode.type,
        title: typeof rawNode.title === "string" && rawNode.title ? rawNode.title : def.title,
        x: Number.isFinite(rawNode.x) ? rawNode.x : 0,
        y: Number.isFinite(rawNode.y) ? rawNode.y : 0,
        w: Number.isFinite(rawNode.w) ? rawNode.w : def.size?.w || 140,
        h: Number.isFinite(rawNode.h) ? rawNode.h : def.size?.h || this._calculateDefaultNodeHeight(def),
        inputs: this._normalizePortList(rawNode.inputs, "in", rawNode.id, "inputs"),
        outputs: this._normalizePortList(rawNode.outputs, "out", rawNode.id, "outputs"),
        state: this._normalizeSerializableValue(rawNode.state, `node "${rawNode.id}" state`, {
          fallback: {},
        }),
        parentId: rawNode.parentId == null ? null : String(rawNode.parentId),
        locked: !!rawNode.locked,
        description: typeof rawNode.description === "string" ? rawNode.description : "",
      };

      nodeIds.add(normalizedNode.id);
      normalized.nodes.push(normalizedNode);
      normalizedNodeMap.set(normalizedNode.id, normalizedNode);
    }

    for (const node of normalized.nodes) {
      if (!node.parentId) continue;
      if (!normalizedNodeMap.has(node.parentId)) {
        throw new Error(`Node "${node.id}" references missing parent "${node.parentId}"`);
      }
      if (node.parentId === node.id) {
        throw new Error(`Node "${node.id}" cannot be its own parent`);
      }
    }

    const edgeIds = new Set();
    for (const rawEdge of json.edges) {
      if (!rawEdge || typeof rawEdge !== "object") {
        throw new Error("Each edge must be an object");
      }
      if (typeof rawEdge.id !== "string" || !rawEdge.id) {
        throw new Error("Each edge must have a non-empty string id");
      }
      if (edgeIds.has(rawEdge.id)) {
        throw new Error(`Duplicate edge id "${rawEdge.id}"`);
      }
      const fromNode = normalizedNodeMap.get(rawEdge.fromNode);
      const toNode = normalizedNodeMap.get(rawEdge.toNode);
      if (!fromNode) {
        throw new Error(`Edge "${rawEdge.id}" references missing source node "${rawEdge.fromNode}"`);
      }
      if (!toNode) {
        throw new Error(`Edge "${rawEdge.id}" references missing target node "${rawEdge.toNode}"`);
      }
      if (!fromNode.outputs.some((port) => port.id === rawEdge.fromPort)) {
        throw new Error(`Edge "${rawEdge.id}" references missing source port "${rawEdge.fromPort}"`);
      }
      if (!toNode.inputs.some((port) => port.id === rawEdge.toPort)) {
        throw new Error(`Edge "${rawEdge.id}" references missing target port "${rawEdge.toPort}"`);
      }

      normalized.edges.push({
        id: rawEdge.id,
        fromNode: rawEdge.fromNode,
        fromPort: rawEdge.fromPort,
        toNode: rawEdge.toNode,
        toPort: rawEdge.toPort,
        route: this._normalizeSerializableValue(rawEdge.route, `edge "${rawEdge.id}" route`, {
          allowNull: true,
          plainObjectOnly: true,
        }),
        label: rawEdge.label == null ? null : String(rawEdge.label),
      });
      edgeIds.add(rawEdge.id);
    }

    return normalized;
  }

  _applyNormalizedGraph(normalized) {
    this.nodes.clear();
    this.edges.clear();
    this._resetRuntimeState();
    this.meta = { ...Graph.DEFAULT_META, ...(normalized.meta || {}) };

    for (const nd of normalized.nodes) {
      const def = this.registry?.types?.get(nd.type);
      const node = new Node({
        id: nd.id,
        type: nd.type,
        title: nd.title,
        x: nd.x,
        y: nd.y,
        width: nd.w,
        height: nd.h,
      });

      def?.onCreate?.(node);
      node.inputs = deepClone(nd.inputs);
      node.outputs = deepClone(nd.outputs);
      node.state = { ...node.state, ...deepClone(nd.state || {}) };
      node.locked = !!nd.locked;
      node.description = nd.description || "";
      this.nodes.set(node.id, node);
    }

    for (const nd of normalized.nodes) {
      if (!nd.parentId) continue;
      const node = this.nodes.get(nd.id);
      const parent = this.nodes.get(nd.parentId);
      if (node && parent) {
        node.parent = parent;
        parent.children.add(node);
      }
    }

    for (const ed of normalized.edges) {
      this.edges.set(ed.id, new Edge({ ...ed, route: deepClone(ed.route) }));
    }

    this.updateWorldTransforms();
  }

  _normalizePortList(list, expectedDir, nodeId, label) {
    if (!Array.isArray(list)) {
      throw new Error(`Node "${nodeId}" must provide a valid ${label} array`);
    }
    const ids = new Set();
    return list.map((port, index) => {
      if (!port || typeof port !== "object") {
        throw new Error(`Node "${nodeId}" ${label}[${index}] must be an object`);
      }
      if (typeof port.id !== "string" || !port.id) {
        throw new Error(`Node "${nodeId}" ${label}[${index}] is missing a valid id`);
      }
      if (ids.has(port.id)) {
        throw new Error(`Node "${nodeId}" has duplicate port id "${port.id}"`);
      }
      ids.add(port.id);

      const portType = port.portType === "exec" ? "exec" : "data";
      const name = typeof port.name === "string" ? port.name : "";
      if (portType === "data" && !name) {
        throw new Error(`Node "${nodeId}" data port "${port.id}" must have a non-empty name`);
      }

      return {
        id: port.id,
        name,
        datatype: typeof port.datatype === "string" && port.datatype ? port.datatype : "any",
        portType,
        dir: expectedDir,
      };
    });
  }

  _normalizeSerializableValue(value, label, { allowNull = false, plainObjectOnly = false, fallback = null } = {}) {
    if (value == null) {
      if (allowNull) return null;
      return deepClone(fallback);
    }
    if (plainObjectOnly && (typeof value !== "object" || Array.isArray(value))) {
      throw new Error(`${label} must be a plain object`);
    }
    try {
      return deepClone(value);
    } catch {
      throw new Error(`${label} must be JSON-serializable`);
    }
  }

  _hasPort(nodeId, portId, dir) {
    const node = this.nodes.get(nodeId);
    if (!node) return false;
    const ports = dir === "out" ? node.outputs : node.inputs;
    return ports.some((port) => port.id === portId);
  }

  _resetRuntimeState() {
    this._valuesA.clear();
    this._valuesB.clear();
    this._useAasCurrent = true;
  }

  _calculateDefaultNodeHeight(def) {
    const inCount = def.inputs?.length || 0;
    const outCount = def.outputs?.length || 0;
    const maxPorts = Math.max(inCount, outCount);
    const headerHeight = 26;
    const portSpacing = 20;

    if (def.html) {
      const lastPortBottom = maxPorts > 0 ? 50 + (maxPorts - 1) * portSpacing : 26;
      return Math.max(lastPortBottom + 50, 90);
    }

    const padding = 8;
    const height = headerHeight + padding + maxPorts * portSpacing + padding;
    return Math.max(height, 40);
  }
}
