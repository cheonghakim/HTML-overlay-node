var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
class Registry {
  constructor() {
    this.types = /* @__PURE__ */ new Map();
  }
  /**
   * Register a new node type
   * @param {string} type - Unique type identifier (e.g., "core/Note")
   * @param {Object} def - Node definition
   * @param {string} [def.title] - Display title
   * @param {Object} [def.size] - Default size {w, h}
   * @param {Array} [def.inputs] - Input port definitions
   * @param {Array} [def.outputs] - Output port definitions
   * @param {Function} [def.onCreate] - Called when node is created
   * @param {Function} [def.onExecute] - Called each execution cycle
   * @param {Function} [def.onDraw] - Custom drawing function
   * @param {Object} [def.html] - HTML overlay configuration
   * @throws {Error} If type is already registered or invalid
   */
  register(type, def) {
    if (!type || typeof type !== "string") {
      throw new Error(`Invalid node type: type must be a non-empty string, got ${typeof type}`);
    }
    if (!def || typeof def !== "object") {
      throw new Error(`Invalid definition for type "${type}": definition must be an object`);
    }
    if (this.types.has(type)) {
      throw new Error(`Node type "${type}" is already registered. Use unregister() first to replace it.`);
    }
    this.types.set(type, def);
  }
  /**
   * Unregister a node type
   * @param {string} type - Type identifier to unregister
   * @throws {Error} If type doesn't exist
   */
  unregister(type) {
    if (!this.types.has(type)) {
      throw new Error(`Cannot unregister type "${type}": type is not registered`);
    }
    this.types.delete(type);
  }
  /**
   * Remove all registered node types
   */
  removeAll() {
    this.types.clear();
  }
  /**
   * Get the definition for a registered node type
   * @param {string} type - Type identifier
   * @returns {Object} Node definition
   * @throws {Error} If type is not registered
   */
  createInstance(type) {
    const def = this.types.get(type);
    if (!def) {
      const available = Array.from(this.types.keys()).join(", ") || "none";
      throw new Error(`Unknown node type: "${type}". Available types: ${available}`);
    }
    return def;
  }
}
function createHooks(names) {
  const map = Object.fromEntries(names.map((n) => [n, /* @__PURE__ */ new Set()]));
  return {
    on(name, fn) {
      map[name].add(fn);
      return () => map[name].delete(fn);
    },
    async emit(name, ...args) {
      for (const fn of map[name]) await fn(...args);
    }
  };
}
function randomUUID() {
  const g = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {};
  const c = g.crypto || g.msCrypto;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  if (c && typeof c.getRandomValues === "function") {
    const bytes2 = new Uint8Array(16);
    c.getRandomValues(bytes2);
    bytes2[6] = bytes2[6] & 15 | 64;
    bytes2[8] = bytes2[8] & 63 | 128;
    const hex2 = Array.from(bytes2, (b) => b.toString(16).padStart(2, "0"));
    return hex2.slice(0, 4).join("") + "-" + hex2.slice(4, 6).join("") + "-" + hex2.slice(6, 8).join("") + "-" + hex2.slice(8, 10).join("") + "-" + hex2.slice(10, 16).join("");
  }
  try {
    const req = Function('return typeof require === "function" ? require : null')();
    if (req) {
      const nodeCrypto = req("crypto");
      if (typeof nodeCrypto.randomUUID === "function") {
        return nodeCrypto.randomUUID();
      }
      const bytes2 = nodeCrypto.randomBytes(16);
      bytes2[6] = bytes2[6] & 15 | 64;
      bytes2[8] = bytes2[8] & 63 | 128;
      const hex2 = Array.from(bytes2, (b) => b.toString(16).padStart(2, "0"));
      return hex2.slice(0, 4).join("") + "-" + hex2.slice(4, 6).join("") + "-" + hex2.slice(6, 8).join("") + "-" + hex2.slice(8, 10).join("") + "-" + hex2.slice(10, 16).join("");
    }
  } catch {
  }
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = bytes[6] & 15 | 64;
  bytes[8] = bytes[8] & 63 | 128;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return hex.slice(0, 4).join("") + "-" + hex.slice(4, 6).join("") + "-" + hex.slice(6, 8).join("") + "-" + hex.slice(8, 10).join("") + "-" + hex.slice(10, 16).join("");
}
class Node {
  /**
   * Create a new Node
   * @param {Object} options - Node configuration
   * @param {string} [options.id] - Unique identifier (auto-generated if not provided)
   * @param {string} options.type - Node type identifier
   * @param {string} [options.title] - Display title (defaults to type)
   * @param {number} [options.x=0] - X position
   * @param {number} [options.y=0] - Y position
   * @param {number} [options.width=160] - Node width
   * @param {number} [options.height=60] - Node height
   */
  constructor({ id, type, title, x = 0, y = 0, width = 160, height = 60 }) {
    if (!type) {
      throw new Error("Node type is required");
    }
    this.id = id ?? randomUUID();
    this.type = type;
    this.title = title ?? type;
    this.pos = { x, y };
    this.size = { width, height };
    this.inputs = [];
    this.outputs = [];
    this.state = {};
    this.parent = null;
    this.children = /* @__PURE__ */ new Set();
    this.computed = { x: 0, y: 0, w: 0, h: 0 };
  }
  /**
   * Add an input port to this node
   * @param {string} name - Port name
   * @param {string} [datatype="any"] - Data type for the port
   * @param {string} [portType="data"] - Port type: "exec" or "data"
   * @returns {Object} The created port
   */
  addInput(name, datatype = "any", portType = "data") {
    if (!name || typeof name !== "string") {
      throw new Error("Input port name must be a non-empty string");
    }
    const port = { id: randomUUID(), name, datatype, portType, dir: "in" };
    this.inputs.push(port);
    return port;
  }
  /**
   * Add an output port to this node
   * @param {string} name - Port name
   * @param {string} [datatype="any"] - Data type for the port
   * @param {string} [portType="data"] - Port type: "exec" or "data"
   * @returns {Object} The created port
   */
  addOutput(name, datatype = "any", portType = "data") {
    if (!name || typeof name !== "string") {
      throw new Error("Output port name must be a non-empty string");
    }
    const port = { id: randomUUID(), name, datatype, portType, dir: "out" };
    this.outputs.push(port);
    return port;
  }
}
class Edge {
  /**
   * Create a new Edge
   * @param {Object} options - Edge configuration
   * @param {string} [options.id] - Unique identifier (auto-generated if not provided)
   * @param {string} options.fromNode - Source node ID
   * @param {string} options.fromPort - Source port ID
   * @param {string} options.toNode - Target node ID
   * @param {string} options.toPort - Target port ID
   */
  constructor({ id, fromNode, fromPort, toNode, toPort }) {
    if (!fromNode || !fromPort || !toNode || !toPort) {
      throw new Error("Edge requires fromNode, fromPort, toNode, and toPort");
    }
    this.id = id ?? randomUUID();
    this.fromNode = fromNode;
    this.fromPort = fromPort;
    this.toNode = toNode;
    this.toPort = toPort;
  }
}
class GroupManager {
  constructor({ graph, hooks }) {
    this.graph = graph;
    this.hooks = hooks;
    this._groups = [];
  }
  // ---------- CRUD ----------
  addGroup({
    title = "Group",
    x = 0,
    y = 0,
    width = 240,
    height = 160,
    color = "#39424e",
    members = []
  } = {}) {
    var _a;
    if (width < 100 || height < 60) {
      console.warn("Group size too small, using minimum size");
      width = Math.max(100, width);
      height = Math.max(60, height);
    }
    const groupNode = this.graph.addNode("core/Group", {
      title,
      x,
      y,
      width,
      height
    });
    groupNode.state.color = color;
    for (const memberId of members) {
      const node = this.graph.getNodeById(memberId);
      if (node) {
        if (node.type === "core/Group") {
          console.warn(`Cannot add group ${memberId} as member of another group`);
          continue;
        }
        this.graph.reparent(node, groupNode);
      } else {
        console.warn(`Member node ${memberId} not found, skipping`);
      }
    }
    this._groups.push(groupNode);
    (_a = this.hooks) == null ? void 0 : _a.emit("group:change");
    return groupNode;
  }
  addGroupFromSelection({ title = "Group", margin = { x: 12, y: 12 } } = {}) {
    return null;
  }
  removeGroup(id) {
    var _a;
    const groupNode = this.graph.getNodeById(id);
    if (!groupNode || groupNode.type !== "core/Group") return;
    const children = [...groupNode.children];
    for (const child of children) {
      this.graph.reparent(child, groupNode.parent);
    }
    this.graph.removeNode(id);
    (_a = this.hooks) == null ? void 0 : _a.emit("group:change");
  }
  // ---------- 이동/리사이즈 ----------
  // 이제 Node의 이동/리사이즈 로직을 따름.
  // Controller에서 Node 이동 시 updateWorldTransforms가 호출되므로 자동 처리됨.
  resizeGroup(id, dw, dh) {
    var _a;
    const g = this.graph.getNodeById(id);
    if (!g || g.type !== "core/Group") return;
    const minW = 100;
    const minH = 60;
    g.size.width = Math.max(minW, g.size.width + dw);
    g.size.height = Math.max(minH, g.size.height + dh);
    this.graph.updateWorldTransforms();
    (_a = this.hooks) == null ? void 0 : _a.emit("group:change");
  }
  // ---------- 히트테스트 & 드래그 ----------
  // 이제 Group도 Node이므로 Controller의 Node 히트테스트 로직을 따름.
  // 단, Resize Handle은 별도 처리가 필요할 수 있음.
  hitTestResizeHandle(x, y) {
    const handleSize = 10;
    const nodes = [...this.graph.nodes.values()].reverse();
    for (const node of nodes) {
      if (node.type !== "core/Group") continue;
      const { x: gx, y: gy, w: gw, h: gh } = node.computed;
      if (x >= gx + gw - handleSize && x <= gx + gw && y >= gy + gh - handleSize && y <= gy + gh) {
        return { group: node, handle: "se" };
      }
    }
    return null;
  }
}
class Graph {
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
    this.nodes = /* @__PURE__ */ new Map();
    this.edges = /* @__PURE__ */ new Map();
    this.hooks = hooks;
    this.registry = registry;
    this._valuesA = /* @__PURE__ */ new Map();
    this._valuesB = /* @__PURE__ */ new Map();
    this._useAasCurrent = true;
    this.groupManager = new GroupManager({
      graph: this,
      hooks: this.hooks
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
    var _a, _b, _c, _d;
    const def = this.registry.types.get(type);
    if (!def) {
      const available = Array.from(this.registry.types.keys()).join(", ") || "none";
      throw new Error(`Unknown node type: "${type}". Available types: ${available}`);
    }
    const node = new Node({
      type,
      title: def.title,
      width: (_a = def.size) == null ? void 0 : _a.w,
      height: (_b = def.size) == null ? void 0 : _b.h,
      ...opts
    });
    for (const i of def.inputs || []) node.addInput(i.name, i.datatype, i.portType || "data");
    for (const o of def.outputs || []) node.addOutput(o.name, o.datatype, o.portType || "data");
    (_c = def.onCreate) == null ? void 0 : _c.call(def, node);
    this.nodes.set(node.id, node);
    (_d = this.hooks) == null ? void 0 : _d.emit("node:create", node);
    return node;
  }
  /**
   * Remove a node and its connected edges from the graph
   * @param {string} nodeId - ID of the node to remove
   */
  removeNode(nodeId) {
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
    var _a;
    if (!this.nodes.has(fromNode)) {
      throw new Error(`Cannot create edge: source node "${fromNode}" not found`);
    }
    if (!this.nodes.has(toNode)) {
      throw new Error(`Cannot create edge: target node "${toNode}" not found`);
    }
    const e = new Edge({ fromNode, fromPort, toNode, toPort });
    this.edges.set(e.id, e);
    (_a = this.hooks) == null ? void 0 : _a.emit("edge:create", e);
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
    const roots = [];
    for (const n of this.nodes.values()) {
      if (!n.parent) roots.push(n);
    }
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
  // buffer helpers
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
  // data helpers
  setOutput(nodeId, portId, value) {
    console.log(`[Graph.setOutput] nodeId: ${nodeId}, portId: ${portId}, value:`, value);
    const key = `${nodeId}:${portId}`;
    this._nextBuf().set(key, value);
  }
  getInput(nodeId, portId) {
    for (const edge of this.edges.values()) {
      if (edge.toNode === nodeId && edge.toPort === portId) {
        const key = `${edge.fromNode}:${edge.fromPort}`;
        const value = this._curBuf().get(key);
        console.log(`[Graph.getInput] nodeId: ${nodeId}, portId: ${portId}, reading from ${edge.fromNode}:${edge.fromPort}, value:`, value);
        return value;
      }
    }
    console.log(`[Graph.getInput] nodeId: ${nodeId}, portId: ${portId}, no edge found, returning undefined`);
    return void 0;
  }
  toJSON() {
    var _a;
    const json = {
      nodes: [...this.nodes.values()].map((n) => {
        var _a2;
        return {
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
          parentId: ((_a2 = n.parent) == null ? void 0 : _a2.id) || null
          // Save parent relationship
        };
      }),
      edges: [...this.edges.values()]
    };
    (_a = this.hooks) == null ? void 0 : _a.emit("graph:serialize", json);
    return json;
  }
  fromJSON(json) {
    var _a, _b, _c;
    this.clear();
    for (const nd of json.nodes) {
      const node = new Node({
        id: nd.id,
        type: nd.type,
        title: nd.title,
        x: nd.x,
        y: nd.y,
        width: nd.w,
        height: nd.h
      });
      const def = (_b = (_a = this.registry) == null ? void 0 : _a.types) == null ? void 0 : _b.get(nd.type);
      if (def == null ? void 0 : def.onCreate) {
        def.onCreate(node);
      }
      node.inputs = nd.inputs;
      node.outputs = nd.outputs;
      node.state = { ...node.state, ...nd.state || {} };
      this.nodes.set(node.id, node);
    }
    for (const nd of json.nodes) {
      if (nd.parentId) {
        const node = this.nodes.get(nd.id);
        const parent = this.nodes.get(nd.parentId);
        if (node && parent) {
          node.parent = parent;
          parent.children.add(node);
        }
      }
    }
    for (const ed of json.edges) {
      this.edges.set(ed.id, new Edge(ed));
    }
    this.updateWorldTransforms();
    (_c = this.hooks) == null ? void 0 : _c.emit("graph:deserialize", json);
    return this;
  }
}
function portRect(node, port, idx, dir) {
  const { x: nx, y: ny, w: width, h: height } = node.computed || {
    x: node.pos.x,
    y: node.pos.y,
    w: node.size.width,
    h: node.size.height
  };
  const portCount = dir === "in" ? node.inputs.length : node.outputs.length;
  const headerHeight = 28;
  const availableHeight = (height || node.size.height) - headerHeight - 16;
  const spacing = availableHeight / (portCount + 1);
  const y = ny + headerHeight + spacing * (idx + 1);
  const portWidth = 12;
  const portHeight = 12;
  if (dir === "in") {
    return { x: nx - portWidth / 2, y: y - portHeight / 2, w: portWidth, h: portHeight };
  }
  if (dir === "out") {
    return { x: nx + width - portWidth / 2, y: y - portHeight / 2, w: portWidth, h: portHeight };
  }
}
const _CanvasRenderer = class _CanvasRenderer {
  constructor(canvas, { theme = {}, registry, edgeStyle = "orthogonal" } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.registry = registry;
    this.scale = 1;
    this.minScale = 0.25;
    this.maxScale = 3;
    this.offsetX = 0;
    this.offsetY = 0;
    this.edgeStyle = edgeStyle;
    this.theme = Object.assign(
      {
        bg: "#0d0d0f",
        // Darker background
        grid: "#1a1a1d",
        // Subtle grid
        node: "#16161a",
        // Darker nodes
        nodeBorder: "#2a2a2f",
        // Subtle border
        title: "#1f1f24",
        // Darker header
        text: "#e4e4e7",
        // Softer white
        textMuted: "#a1a1aa",
        // Muted text
        port: "#6366f1",
        // Indigo for data ports
        portExec: "#10b981",
        // Emerald for exec ports
        edge: "#52525b",
        // Neutral edge color
        edgeActive: "#8b5cf6",
        // Purple for active
        accent: "#6366f1",
        // Indigo accent
        accentBright: "#818cf8"
        // Brighter accent
      },
      theme
    );
  }
  setEdgeStyle(style) {
    this.edgeStyle = style === "line" || style === "orthogonal" ? style : "bezier";
  }
  setRegistry(reg) {
    this.registry = reg;
  }
  resize(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
  }
  setTransform({
    scale = this.scale,
    offsetX = this.offsetX,
    offsetY = this.offsetY
  } = {}) {
    this.scale = Math.min(this.maxScale, Math.max(this.minScale, scale));
    this.offsetX = offsetX;
    this.offsetY = offsetY;
  }
  panBy(dx, dy) {
    this.offsetX += dx;
    this.offsetY += dy;
  }
  zoomAt(factor, cx, cy) {
    const prev = this.scale;
    const next = Math.min(
      this.maxScale,
      Math.max(this.minScale, prev * factor)
    );
    if (next === prev) return;
    const wx = (cx - this.offsetX) / prev;
    const wy = (cy - this.offsetY) / prev;
    this.offsetX = cx - wx * next;
    this.offsetY = cy - wy * next;
    this.scale = next;
  }
  screenToWorld(x, y) {
    return {
      x: (x - this.offsetX) / this.scale,
      y: (y - this.offsetY) / this.scale
    };
  }
  worldToScreen(x, y) {
    return {
      x: x * this.scale + this.offsetX,
      y: y * this.scale + this.offsetY
    };
  }
  _applyTransform() {
    const { ctx } = this;
    ctx.setTransform(this.scale, 0, 0, this.scale, this.offsetX, this.offsetY);
  }
  _resetTransform() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  // ── Drawing ────────────────────────────────────────────────────────────────
  _drawArrowhead(x1, y1, x2, y2, size = 10) {
    const { ctx } = this;
    const s = size / this.scale;
    const ang = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - s * Math.cos(ang - Math.PI / 6),
      y2 - s * Math.sin(ang - Math.PI / 6)
    );
    ctx.lineTo(
      x2 - s * Math.cos(ang + Math.PI / 6),
      y2 - s * Math.sin(ang + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
  }
  _drawScreenText(text, lx, ly, {
    fontPx = 12,
    color = this.theme.text,
    align = "left",
    baseline = "alphabetic",
    dpr = 1
    // 추후 devicePixelRatio 도입
  } = {}) {
    const { ctx } = this;
    const { x: sx, y: sy } = this.worldToScreen(lx, ly);
    ctx.save();
    this._resetTransform();
    const px = Math.round(sx) + 0.5;
    const py = Math.round(sy) + 0.5;
    ctx.font = `${fontPx * this.scale}px system-ui`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.fillText(text, px, py);
    ctx.restore();
  }
  drawGrid() {
    const { ctx, canvas, theme, scale, offsetX, offsetY } = this;
    this._resetTransform();
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    this._applyTransform();
    ctx.strokeStyle = this._rgba(theme.grid, 0.35);
    ctx.lineWidth = 1 / scale;
    const base = 20;
    const step = base;
    const x0 = -offsetX / scale;
    const y0 = -offsetY / scale;
    const x1 = (canvas.width - offsetX) / scale;
    const y1 = (canvas.height - offsetY) / scale;
    const startX = Math.floor(x0 / step) * step;
    const startY = Math.floor(y0 / step) * step;
    ctx.beginPath();
    for (let x = startX; x <= x1; x += step) {
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y1);
    }
    for (let y = startY; y <= y1; y += step) {
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
    }
    ctx.stroke();
    this._resetTransform();
  }
  draw(graph, {
    selection = /* @__PURE__ */ new Set(),
    tempEdge = null,
    running = false,
    time = performance.now(),
    dt = 0,
    groups = null,
    activeEdges = /* @__PURE__ */ new Set()
  } = {}) {
    var _a, _b, _c, _d, _e, _f;
    graph.updateWorldTransforms();
    this.drawGrid();
    const { ctx, theme } = this;
    this._applyTransform();
    ctx.save();
    for (const n of graph.nodes.values()) {
      if (n.type === "core/Group") {
        const sel = selection.has(n.id);
        const def = (_b = (_a = this.registry) == null ? void 0 : _a.types) == null ? void 0 : _b.get(n.type);
        if (def == null ? void 0 : def.onDraw) def.onDraw(n, { ctx, theme });
        else this._drawNode(n, sel);
      }
    }
    ctx.lineWidth = 1.5 / this.scale;
    let dashArray = null;
    let dashOffset = 0;
    if (running) {
      const speed = 120;
      const phase = time / 1e3 * speed / this.scale % _CanvasRenderer.FONT_SIZE;
      dashArray = [6 / this.scale, 6 / this.scale];
      dashOffset = -phase;
    }
    for (const e of graph.edges.values()) {
      const shouldAnimate = activeEdges && activeEdges.size > 0 && activeEdges.has(e.id);
      if (running && shouldAnimate && dashArray) {
        ctx.setLineDash(dashArray);
        ctx.lineDashOffset = dashOffset;
      } else {
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;
      }
      const isActive = activeEdges && activeEdges.has(e.id);
      if (isActive) {
        ctx.strokeStyle = "#00ffff";
        ctx.lineWidth = 3 * this.scale;
      } else {
        ctx.strokeStyle = theme.edge;
        ctx.lineWidth = 1.5 / this.scale;
      }
      this._drawEdge(graph, e);
    }
    if (tempEdge) {
      const a = this.screenToWorld(tempEdge.x1, tempEdge.y1);
      const b = this.screenToWorld(tempEdge.x2, tempEdge.y2);
      const prevDash = this.ctx.getLineDash();
      this.ctx.setLineDash([6 / this.scale, 6 / this.scale]);
      let ptsForArrow = null;
      if (this.edgeStyle === "line") {
        this._drawLine(a.x, a.y, b.x, b.y);
        ptsForArrow = [{ x: a.x, y: a.y }, { x: b.x, y: b.y }];
      } else if (this.edgeStyle === "orthogonal") {
        ptsForArrow = this._drawOrthogonal(a.x, a.y, b.x, b.y);
      } else {
        this._drawCurve(a.x, a.y, b.x, b.y);
        ptsForArrow = [{ x: a.x, y: a.y }, { x: b.x, y: b.y }];
      }
      this.ctx.setLineDash(prevDash);
      if (ptsForArrow && ptsForArrow.length >= 2) {
        const p1 = ptsForArrow[ptsForArrow.length - 2];
        const p2 = ptsForArrow[ptsForArrow.length - 1];
        this.ctx.fillStyle = this.theme.edge;
        this.ctx.strokeStyle = this.theme.edge;
        this._drawArrowhead(p1.x, p1.y, p2.x, p2.y, 12);
      }
    }
    for (const n of graph.nodes.values()) {
      if (n.type !== "core/Group") {
        const sel = selection.has(n.id);
        const def = (_d = (_c = this.registry) == null ? void 0 : _c.types) == null ? void 0 : _d.get(n.type);
        const hasHtmlOverlay = !!(def == null ? void 0 : def.html);
        this._drawNode(n, sel, hasHtmlOverlay);
        if (def == null ? void 0 : def.onDraw) def.onDraw(n, { ctx, theme });
      }
    }
    for (const n of graph.nodes.values()) {
      if (n.type !== "core/Group") {
        const def = (_f = (_e = this.registry) == null ? void 0 : _e.types) == null ? void 0 : _f.get(n.type);
        const hasHtmlOverlay = !!(def == null ? void 0 : def.html);
        if (hasHtmlOverlay) {
          this._drawPorts(n);
        }
      }
    }
    this._resetTransform();
  }
  _rgba(hex, a) {
    const c = hex.replace("#", "");
    const n = parseInt(
      c.length === 3 ? c.split("").map((x) => x + x).join("") : c,
      16
    );
    const r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
    return `rgba(${r},${g},${b},${a})`;
  }
  _drawNode(node, selected, skipPorts = false) {
    const { ctx, theme } = this;
    const r = 8;
    const { x, y, w, h } = node.computed;
    if (!selected) {
      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
      ctx.shadowBlur = 8 / this.scale;
      ctx.shadowOffsetY = 2 / this.scale;
      ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
      roundRect(ctx, x, y, w, h, r);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = theme.node;
    ctx.strokeStyle = selected ? theme.accentBright : theme.nodeBorder;
    ctx.lineWidth = (selected ? 1.5 : 1) / this.scale;
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = theme.title;
    roundRect(ctx, x, y, w, 24, { tl: r, tr: r, br: 0, bl: 0 });
    ctx.fill();
    ctx.strokeStyle = selected ? theme.accentBright : theme.nodeBorder;
    ctx.lineWidth = (selected ? 1.5 : 1) / this.scale;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + 24);
    ctx.moveTo(x, y + 24);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.stroke();
    this._drawScreenText(node.title, x + 8, y + _CanvasRenderer.FONT_SIZE, {
      fontPx: _CanvasRenderer.FONT_SIZE,
      color: theme.text,
      baseline: "middle",
      align: "left"
    });
    if (skipPorts) return;
    node.inputs.forEach((p, i) => {
      const rct = portRect(node, p, i, "in");
      const cx = rct.x + rct.w / 2;
      const cy = rct.y + rct.h / 2;
      if (p.portType === "exec") {
        const portSize = 8;
        ctx.fillStyle = theme.portExec;
        ctx.strokeStyle = "rgba(16, 185, 129, 0.3)";
        ctx.lineWidth = 2 / this.scale;
        ctx.beginPath();
        ctx.roundRect(cx - portSize / 2, cy - portSize / 2, portSize, portSize, 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle = theme.port;
        ctx.strokeStyle = "rgba(99, 102, 241, 0.3)";
        ctx.lineWidth = 2 / this.scale;
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    });
    node.outputs.forEach((p, i) => {
      const rct = portRect(node, p, i, "out");
      const cx = rct.x + rct.w / 2;
      const cy = rct.y + rct.h / 2;
      if (p.portType === "exec") {
        const portSize = 8;
        ctx.fillStyle = theme.portExec;
        ctx.strokeStyle = "rgba(16, 185, 129, 0.3)";
        ctx.lineWidth = 2 / this.scale;
        ctx.beginPath();
        ctx.roundRect(cx - portSize / 2, cy - portSize / 2, portSize, portSize, 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle = theme.port;
        ctx.strokeStyle = "rgba(99, 102, 241, 0.3)";
        ctx.lineWidth = 2 / this.scale;
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    });
  }
  _drawPorts(node) {
    const { ctx, theme } = this;
    node.inputs.forEach((p, i) => {
      const rct = portRect(node, p, i, "in");
      const cx = rct.x + rct.w / 2;
      const cy = rct.y + rct.h / 2;
      if (p.portType === "exec") {
        const portSize = 8;
        ctx.fillStyle = theme.portExec;
        ctx.strokeStyle = "rgba(16, 185, 129, 0.3)";
        ctx.lineWidth = 2 / this.scale;
        ctx.beginPath();
        ctx.roundRect(cx - portSize / 2, cy - portSize / 2, portSize, portSize, 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle = theme.port;
        ctx.strokeStyle = "rgba(99, 102, 241, 0.3)";
        ctx.lineWidth = 2 / this.scale;
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    node.outputs.forEach((p, i) => {
      const rct = portRect(node, p, i, "out");
      const cx = rct.x + rct.w / 2;
      const cy = rct.y + rct.h / 2;
      if (p.portType === "exec") {
        const portSize = 8;
        ctx.fillStyle = theme.portExec;
        ctx.strokeStyle = "rgba(16, 185, 129, 0.3)";
        ctx.lineWidth = 2 / this.scale;
        ctx.beginPath();
        ctx.roundRect(cx - portSize / 2, cy - portSize / 2, portSize, portSize, 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle = theme.port;
        ctx.strokeStyle = "rgba(99, 102, 241, 0.3)";
        ctx.lineWidth = 2 / this.scale;
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    });
  }
  _drawEdge(graph, e) {
    const from = graph.nodes.get(e.fromNode);
    const to = graph.nodes.get(e.toNode);
    if (!from || !to) return;
    const iOut = from.outputs.findIndex((p) => p.id === e.fromPort);
    const iIn = to.inputs.findIndex((p) => p.id === e.toPort);
    const pr1 = portRect(from, null, iOut, "out");
    const pr2 = portRect(to, null, iIn, "in");
    const x1 = pr1.x, y1 = pr1.y + 7, x2 = pr2.x, y2 = pr2.y + 7;
    if (this.edgeStyle === "line") {
      this._drawLine(x1, y1, x2, y2);
    } else if (this.edgeStyle === "orthogonal") {
      this._drawOrthogonal(x1, y1, x2, y2);
    } else {
      this._drawCurve(x1, y1, x2, y2);
    }
  }
  _drawLine(x1, y1, x2, y2) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  _drawPolyline(points) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++)
      ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
  }
  _drawOrthogonal(x1, y1, x2, y2) {
    const midX = (x1 + x2) / 2;
    let pts;
    {
      pts = [
        { x: x1, y: y1 },
        { x: midX, y: y1 },
        { x: midX, y: y2 },
        { x: x2, y: y2 }
      ];
    }
    const { ctx } = this;
    const prevJoin = ctx.lineJoin, prevCap = ctx.lineCap;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    this._drawPolyline(pts);
    ctx.lineJoin = prevJoin;
    ctx.lineCap = prevCap;
    return pts;
  }
  _drawCurve(x1, y1, x2, y2) {
    const { ctx } = this;
    const dx = Math.max(40, Math.abs(x2 - x1) * 0.4);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(x1 + dx, y1, x2 - dx, y2, x2, y2);
    ctx.stroke();
  }
};
__publicField(_CanvasRenderer, "FONT_SIZE", 12);
__publicField(_CanvasRenderer, "SELECTED_NODE_COLOR", "#6cf");
let CanvasRenderer = _CanvasRenderer;
function roundRect(ctx, x, y, w, h, r = 6) {
  if (typeof r === "number") r = { tl: r, tr: r, br: r, bl: r };
  ctx.beginPath();
  ctx.moveTo(x + r.tl, y);
  ctx.lineTo(x + w - r.tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r.tr);
  ctx.lineTo(x + w, y + h - r.br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
  ctx.lineTo(x + r.bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r.bl);
  ctx.lineTo(x, y + r.tl);
  ctx.quadraticCurveTo(x, y, x + r.tl, y);
  ctx.closePath();
}
function findEdgeId(graph, a, b, c, d) {
  for (const [id, e] of graph.edges) {
    if (e.fromNode === a && e.fromPort === b && e.toNode === c && e.toPort === d)
      return id;
  }
  return null;
}
function AddEdgeCmd(graph, fromNode, fromPort, toNode, toPort) {
  let addedId = null;
  return {
    do() {
      graph.addEdge(fromNode, fromPort, toNode, toPort);
      addedId = findEdgeId(graph, fromNode, fromPort, toNode, toPort);
    },
    undo() {
      const id = addedId ?? findEdgeId(graph, fromNode, fromPort, toNode, toPort);
      if (id != null) graph.edges.delete(id);
    }
  };
}
function RemoveEdgeCmd(graph, edgeId) {
  const e = graph.edges.get(edgeId);
  if (!e) return null;
  const { fromNode, fromPort, toNode, toPort } = e;
  return {
    do() {
      graph.edges.delete(edgeId);
    },
    undo() {
      graph.addEdge(fromNode, fromPort, toNode, toPort);
    }
  };
}
function RemoveNodeCmd(graph, node) {
  let removedNode = null;
  let removedEdges = [];
  return {
    do() {
      removedNode = node;
      removedEdges = graph.edges ? [...graph.edges.values()].filter((e) => {
        return e.fromNode === node.id || e.toNode === node.id;
      }) : [];
      for (const edge of removedEdges) {
        graph.edges.delete(edge.id);
      }
      graph.nodes.delete(node.id);
    },
    undo() {
      if (removedNode) {
        graph.nodes.set(removedNode.id, removedNode);
      }
      for (const edge of removedEdges) {
        graph.edges.set(edge.id, edge);
      }
    }
  };
}
function ResizeNodeCmd(node, fromSize, toSize) {
  return {
    do() {
      node.size.width = toSize.w;
      node.size.height = toSize.h;
    },
    undo() {
      node.size.width = fromSize.w;
      node.size.height = fromSize.h;
    }
  };
}
function ChangeGroupColorCmd(node, fromColor, toColor) {
  return {
    do() {
      node.state.color = toColor;
    },
    undo() {
      node.state.color = fromColor;
    }
  };
}
class CommandStack {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
  }
  exec(cmd) {
    cmd.do();
    this.undoStack.push(cmd);
    this.redoStack.length = 0;
  }
  undo() {
    const c = this.undoStack.pop();
    if (c) {
      c.undo();
      this.redoStack.push(c);
    }
  }
  redo() {
    const c = this.redoStack.pop();
    if (c) {
      c.do();
      this.undoStack.push(c);
    }
  }
}
const _Controller = class _Controller {
  constructor({ graph, renderer, hooks, htmlOverlay, contextMenu, portRenderer }) {
    this.graph = graph;
    this.renderer = renderer;
    this.hooks = hooks;
    this.htmlOverlay = htmlOverlay;
    this.contextMenu = contextMenu;
    this.portRenderer = portRenderer;
    this.stack = new CommandStack();
    this.selection = /* @__PURE__ */ new Set();
    this.dragging = null;
    this.connecting = null;
    this.panning = null;
    this.resizing = null;
    this.gDragging = null;
    this.gResizing = null;
    this.boxSelecting = null;
    this.snapToGrid = true;
    this.gridSize = 20;
    this._cursor = "default";
    this._onKeyPressEvt = this._onKeyPress.bind(this);
    this._onDownEvt = this._onDown.bind(this);
    this._onWheelEvt = this._onWheel.bind(this);
    this._onMoveEvt = this._onMove.bind(this);
    this._onUpEvt = this._onUp.bind(this);
    this._onContextMenuEvt = this._onContextMenu.bind(this);
    this._onDblClickEvt = this._onDblClick.bind(this);
    this._bindEvents();
  }
  destroy() {
    const c = this.renderer.canvas;
    c.removeEventListener("mousedown", this._onDownEvt);
    c.removeEventListener("dblclick", this._onDblClickEvt);
    c.removeEventListener("wheel", this._onWheelEvt, { passive: false });
    c.removeEventListener("contextmenu", this._onContextMenuEvt);
    window.removeEventListener("mousemove", this._onMoveEvt);
    window.removeEventListener("mouseup", this._onUpEvt);
    window.removeEventListener("keydown", this._onKeyPressEvt);
  }
  _bindEvents() {
    const c = this.renderer.canvas;
    c.addEventListener("mousedown", this._onDownEvt);
    c.addEventListener("dblclick", this._onDblClickEvt);
    c.addEventListener("wheel", this._onWheelEvt, { passive: false });
    c.addEventListener("contextmenu", this._onContextMenuEvt);
    window.addEventListener("mousemove", this._onMoveEvt);
    window.addEventListener("mouseup", this._onUpEvt);
    window.addEventListener("keydown", this._onKeyPressEvt);
  }
  _onKeyPress(e) {
    this.isAlt = e.altKey;
    this.isShift = e.shiftKey;
    this.isCtrl = e.ctrlKey;
    if (e.key.toLowerCase() === "g" && !e.ctrlKey && !e.metaKey) {
      this.snapToGrid = !this.snapToGrid;
      this.render();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "g") {
      e.preventDefault();
      this._createGroupFromSelection();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) this.stack.redo();
      else this.stack.undo();
      this.render();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
      e.preventDefault();
      this.stack.redo();
      this.render();
      return;
    }
    if (e.key.toLowerCase() === "a" && this.selection.size > 1) {
      e.preventDefault();
      if (e.shiftKey) {
        this._alignNodesVertical();
      } else {
        this._alignNodesHorizontal();
      }
      return;
    }
    if (e.key === "Delete") {
      [...this.selection].forEach((node) => {
        const nodeObj = this.graph.getNodeById(node);
        this.stack.exec(RemoveNodeCmd(this.graph, nodeObj));
        this.graph.removeNode(node);
      });
      this.render();
    }
  }
  _setCursor(c) {
    if (this._cursor !== c) {
      this._cursor = c;
      this.renderer.canvas.style.cursor = c;
    }
  }
  _posScreen(e) {
    const r = this.renderer.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  _posWorld(e) {
    const s = this._posScreen(e);
    return this.renderer.screenToWorld(s.x, s.y);
  }
  _findNodeAtWorld(x, y) {
    const list = [...this.graph.nodes.values()].reverse();
    for (const n of list) {
      const { x: nx, y: ny, w, h } = n.computed;
      if (x >= nx && x <= nx + w && y >= ny && y <= ny + h) {
        if (n.type === "core/Group") {
          const child = this._findChildNodeAtWorld(n, x, y);
          if (child) {
            return child;
          }
        }
        return n;
      }
    }
    return null;
  }
  /**
   * Find child node at world coordinates (recursive helper for _findNodeAtWorld)
   * @param {Node} parentNode - Parent node (group)
   * @param {number} x - World x coordinate
   * @param {number} y - World y coordinate
   * @returns {Node|null} - Child node at position, or null
   */
  _findChildNodeAtWorld(parentNode, x, y) {
    const children = [];
    for (const node of this.graph.nodes.values()) {
      if (node.parent === parentNode) {
        children.push(node);
      }
    }
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i];
      const { x: nx, y: ny, w, h } = child.computed;
      if (x >= nx && x <= nx + w && y >= ny && y <= ny + h) {
        if (child.type === "core/Group") {
          const grandchild = this._findChildNodeAtWorld(child, x, y);
          if (grandchild) {
            return grandchild;
          }
        }
        return child;
      }
    }
    return null;
  }
  _findPortAtWorld(x, y) {
    for (const n of this.graph.nodes.values()) {
      for (let i = 0; i < n.inputs.length; i++) {
        const r = portRect(n, n.inputs[i], i, "in");
        if (rectHas(r, x, y))
          return { node: n, port: n.inputs[i], dir: "in", idx: i };
      }
      for (let i = 0; i < n.outputs.length; i++) {
        const r = portRect(n, n.outputs[i], i, "out");
        if (rectHas(r, x, y))
          return { node: n, port: n.outputs[i], dir: "out", idx: i };
      }
    }
    return null;
  }
  _findIncomingEdge(nodeId, portId) {
    for (const [eid, e] of this.graph.edges) {
      if (e.toNode === nodeId && e.toPort === portId) {
        return { id: eid, edge: e };
      }
    }
    return null;
  }
  _onWheel(e) {
    e.preventDefault();
    const { x, y } = this._posScreen(e);
    const factor = Math.pow(1.0015, -e.deltaY);
    this.renderer.zoomAt(factor, x, y);
    this.render();
  }
  _onContextMenu(e) {
    e.preventDefault();
    if (!this.contextMenu) return;
    const w = this._posWorld(e);
    const node = this._findNodeAtWorld(w.x, w.y);
    this.contextMenu.show(node, e.clientX, e.clientY, w);
  }
  _onDblClick(e) {
    var _a;
    const w = this._posWorld(e);
    const node = this._findNodeAtWorld(w.x, w.y);
    if (node) {
      (_a = this.hooks) == null ? void 0 : _a.emit("node:dblclick", node);
    }
  }
  _resizeHandleRect(node) {
    const s = 10;
    const { x, y, w, h } = node.computed;
    return {
      x: x + w - s,
      y: y + h - s,
      w: s,
      h: s
    };
  }
  _hitResizeHandle(node, wx, wy) {
    const r = this._resizeHandleRect(node);
    return wx >= r.x && wx <= r.x + r.w && wy >= r.y && wy <= r.y + r.h;
  }
  _onDown(e) {
    const s = this._posScreen(e);
    const w = this._posWorld(e);
    if (e.button === 1) {
      this.panning = { x: s.x, y: s.y };
      return;
    }
    const node = this._findNodeAtWorld(w.x, w.y);
    if (e.button === 0 && node && this._hitResizeHandle(node, w.x, w.y)) {
      this.resizing = {
        nodeId: node.id,
        startW: node.size.width,
        startH: node.size.height,
        startX: w.x,
        startY: w.y
      };
      if (!e.shiftKey) this.selection.clear();
      this.selection.add(node.id);
      this._setCursor("se-resize");
      this.render();
      return;
    }
    const port = this._findPortAtWorld(w.x, w.y);
    if (e.button === 0 && port && port.dir === "in") {
      const incoming = this._findIncomingEdge(port.node.id, port.port.id);
      if (incoming) {
        this.stack.exec(RemoveEdgeCmd(this.graph, incoming.id));
        this.render();
        return;
      }
    }
    if (e.button === 0 && port && port.dir === "out") {
      const outR = portRect(port.node, port.port, port.idx, "out");
      const screenFrom = this.renderer.worldToScreen(outR.x, outR.y + 7);
      this.connecting = {
        fromNode: port.node.id,
        fromPort: port.port.id,
        x: screenFrom.x,
        y: screenFrom.y
      };
      return;
    }
    if (e.button === 0 && node) {
      if (!e.shiftKey) this.selection.clear();
      this.selection.add(node.id);
      this.dragging = {
        nodeId: node.id,
        offsetX: w.x - node.computed.x,
        offsetY: w.y - node.computed.y,
        startPos: { ...node.pos },
        // for undo
        selectedNodes: []
        // Store all selected nodes and their initial positions
      };
      for (const selectedId of this.selection) {
        const selectedNode = this.graph.nodes.get(selectedId);
        if (selectedNode) {
          this.dragging.selectedNodes.push({
            node: selectedNode,
            startWorldX: selectedNode.computed.x,
            startWorldY: selectedNode.computed.y,
            startLocalX: selectedNode.pos.x,
            startLocalY: selectedNode.pos.y
          });
        }
      }
      if (node.type === "core/Group") {
        this.dragging.childrenWorldPos = [];
        for (const child of this.graph.nodes.values()) {
          if (child.parent === node) {
            this.dragging.childrenWorldPos.push({
              node: child,
              worldX: child.computed.x,
              worldY: child.computed.y
            });
          }
        }
      }
      this.render();
      return;
    }
    if (e.button === 0) {
      if (this.selection.size) this.selection.clear();
      if (e.ctrlKey || e.metaKey) {
        this.boxSelecting = {
          startX: w.x,
          startY: w.y,
          currentX: w.x,
          currentY: w.y
        };
      } else {
        this.panning = { x: s.x, y: s.y };
      }
      this.render();
      return;
    }
  }
  _onMove(e) {
    var _a, _b;
    this.isAlt = e.altKey;
    this.isShift = e.shiftKey;
    this.isCtrl = e.ctrlKey;
    const s = this._posScreen(e);
    const w = this.renderer.screenToWorld(s.x, s.y);
    if (this.resizing) {
      const n = this.graph.nodes.get(this.resizing.nodeId);
      const dx = w.x - this.resizing.startX;
      const dy = w.y - this.resizing.startY;
      const minW = _Controller.MIN_NODE_WIDTH;
      const minH = _Controller.MIN_NODE_HEIGHT;
      n.size.width = Math.max(minW, this.resizing.startW + dx);
      n.size.height = Math.max(minH, this.resizing.startH + dy);
      (_a = this.hooks) == null ? void 0 : _a.emit("node:resize", n);
      this._setCursor("se-resize");
      this.render();
      return;
    }
    if (this.panning) {
      const dx = s.x - this.panning.x;
      const dy = s.y - this.panning.y;
      this.panning = { x: s.x, y: s.y };
      this.renderer.panBy(dx, dy);
      this.render();
      return;
    }
    if (this.dragging) {
      const n = this.graph.nodes.get(this.dragging.nodeId);
      let targetWx = w.x - this.dragging.offsetX;
      let targetWy = this.isShift ? w.y - 0 : w.y - this.dragging.offsetY;
      if (this.snapToGrid) {
        targetWx = this._snapToGrid(targetWx);
        targetWy = this._snapToGrid(targetWy);
      }
      const deltaX = targetWx - this.dragging.selectedNodes.find((sn) => sn.node.id === n.id).startWorldX;
      const deltaY = targetWy - this.dragging.selectedNodes.find((sn) => sn.node.id === n.id).startWorldY;
      this.graph.updateWorldTransforms();
      for (const { node: selectedNode, startWorldX, startWorldY } of this.dragging.selectedNodes) {
        if (this.isShift && selectedNode.type === "core/Group") {
          continue;
        }
        let newWorldX = startWorldX + deltaX;
        let newWorldY = startWorldY + deltaY;
        let parentWx = 0;
        let parentWy = 0;
        if (selectedNode.parent) {
          parentWx = selectedNode.parent.computed.x;
          parentWy = selectedNode.parent.computed.y;
        }
        selectedNode.pos.x = newWorldX - parentWx;
        selectedNode.pos.y = newWorldY - parentWy;
      }
      if (this.isAlt && n.type === "core/Group" && this.dragging.childrenWorldPos) {
        this.graph.updateWorldTransforms();
        for (const childInfo of this.dragging.childrenWorldPos) {
          const child = childInfo.node;
          const newGroupX = n.computed.x;
          const newGroupY = n.computed.y;
          child.pos.x = childInfo.worldX - newGroupX;
          child.pos.y = childInfo.worldY - newGroupY;
        }
      }
      (_b = this.hooks) == null ? void 0 : _b.emit("node:move", n);
      this.render();
      return;
    }
    if (this.boxSelecting) {
      this.boxSelecting.currentX = w.x;
      this.boxSelecting.currentY = w.y;
      this.render();
      return;
    }
    if (this.connecting) {
      this.connecting.x = s.x;
      this.connecting.y = s.y;
      this.render();
    }
    const port = this._findPortAtWorld(w.x, w.y);
    const node = this._findNodeAtWorld(w.x, w.y);
    if (node && this._hitResizeHandle(node, w.x, w.y)) {
      this._setCursor("se-resize");
    } else if (port) {
      this._setCursor("pointer");
    } else {
      this._setCursor("default");
    }
  }
  _onUp(e) {
    this.isAlt = e.altKey;
    this.isShift = e.shiftKey;
    this.isCtrl = e.ctrlKey;
    const w = this._posWorld(e);
    if (this.panning) {
      this.panning = null;
      return;
    }
    if (this.connecting) {
      const from = this.connecting;
      const portIn = this._findPortAtWorld(w.x, w.y);
      if (portIn && portIn.dir === "in") {
        this.stack.exec(
          AddEdgeCmd(
            this.graph,
            from.fromNode,
            from.fromPort,
            portIn.node.id,
            portIn.port.id
          )
        );
      }
      this.connecting = null;
      this.render();
    }
    if (this.resizing) {
      const n = this.graph.nodes.get(this.resizing.nodeId);
      const from = { w: this.resizing.startW, h: this.resizing.startH };
      const to = { w: n.size.width, h: n.size.height };
      if (from.w !== to.w || from.h !== to.h) {
        this.stack.exec(ResizeNodeCmd(n, from, to));
      }
      this.resizing = null;
      this._setCursor("default");
    }
    if (this.dragging) {
      const n = this.graph.nodes.get(this.dragging.nodeId);
      if (n.type === "core/Group" && this.isAlt && this.dragging.childrenWorldPos) {
        for (const childInfo of this.dragging.childrenWorldPos) {
          const child = childInfo.node;
          this.graph.updateWorldTransforms();
          const newGroupX = n.computed.x;
          const newGroupY = n.computed.y;
          child.pos.x = childInfo.worldX - newGroupX;
          child.pos.y = childInfo.worldY - newGroupY;
        }
      } else if (n.type === "core/Group" && !this.isAlt) {
        this._autoParentNodesInGroup(n);
      } else if (n.type !== "core/Group") {
        const potentialParent = this._findPotentialParent(w.x, w.y, n);
        if (potentialParent && potentialParent !== n.parent) {
          this.graph.reparent(n, potentialParent);
        } else if (!potentialParent && n.parent) {
          this.graph.reparent(n, null);
        }
      }
      this.dragging = null;
      this.render();
    }
    if (this.boxSelecting) {
      const { startX, startY, currentX, currentY } = this.boxSelecting;
      const minX = Math.min(startX, currentX);
      const maxX = Math.max(startX, currentX);
      const minY = Math.min(startY, currentY);
      const maxY = Math.max(startY, currentY);
      for (const node of this.graph.nodes.values()) {
        const { x, y, w: w2, h } = node.computed;
        if (x + w2 >= minX && x <= maxX && y + h >= minY && y <= maxY) {
          this.selection.add(node.id);
        }
      }
      this.boxSelecting = null;
      this.render();
    }
  }
  /**
   * Automatically parent nodes that are within the group's bounds
   * @param {Node} groupNode - The group node
   */
  _autoParentNodesInGroup(groupNode) {
    const { x: gx, y: gy, w: gw, h: gh } = groupNode.computed;
    for (const node of this.graph.nodes.values()) {
      if (node === groupNode) continue;
      if (node.parent === groupNode) continue;
      if (node.type === "core/Group") continue;
      const { x: nx, y: ny, w: nw, h: nh } = node.computed;
      const nodeCenterX = nx + nw / 2;
      const nodeCenterY = ny + nh / 2;
      if (nodeCenterX >= gx && nodeCenterX <= gx + gw && nodeCenterY >= gy && nodeCenterY <= gy + gh) {
        this.graph.reparent(node, groupNode);
      }
    }
  }
  _findPotentialParent(x, y, excludeNode) {
    const list = [...this.graph.nodes.values()].reverse();
    for (const n of list) {
      if (n.type !== "core/Group") continue;
      if (n === excludeNode) continue;
      let p = n.parent;
      let isDescendant = false;
      while (p) {
        if (p === excludeNode) {
          isDescendant = true;
          break;
        }
        p = p.parent;
      }
      if (isDescendant) continue;
      const { x: nx, y: ny, w, h } = n.computed;
      if (x >= nx && x <= nx + w && y >= ny && y <= ny + h) {
        return n;
      }
    }
    return null;
  }
  /**
   * Snap a coordinate to the grid
   * @param {number} value - The value to snap
   * @returns {number} - Snapped value
   */
  _snapToGrid(value) {
    return Math.round(value / this.gridSize) * this.gridSize;
  }
  /**
   * Create a group from currently selected nodes
   */
  _createGroupFromSelection() {
    if (this.selection.size === 0) {
      console.warn("No nodes selected to group");
      return;
    }
    const selectedNodes = Array.from(this.selection).map((id) => this.graph.getNodeById(id));
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of selectedNodes) {
      const { x, y, w, h } = node.computed;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    }
    const margin = 20;
    const groupX = minX - margin;
    const groupY = minY - margin;
    const groupWidth = maxX - minX + margin * 2;
    const groupHeight = maxY - minY + margin * 2;
    if (this.graph.groupManager) {
      this.graph.groupManager.addGroup({
        title: "Group",
        x: groupX,
        y: groupY,
        width: groupWidth,
        height: groupHeight,
        members: Array.from(this.selection)
      });
      this.selection.clear();
      this.render();
    }
  }
  /**
   * Align selected nodes horizontally (same Y position)
   */
  _alignNodesHorizontal() {
    if (this.selection.size < 2) return;
    const nodes = Array.from(this.selection).map((id) => this.graph.getNodeById(id));
    const avgY = nodes.reduce((sum, n) => sum + n.computed.y, 0) / nodes.length;
    for (const node of nodes) {
      const parentY = node.parent ? node.parent.computed.y : 0;
      node.pos.y = avgY - parentY;
    }
    this.graph.updateWorldTransforms();
    this.render();
  }
  /**
   * Align selected nodes vertically (same X position)
   */
  _alignNodesVertical() {
    if (this.selection.size < 2) return;
    const nodes = Array.from(this.selection).map((id) => this.graph.getNodeById(id));
    const avgX = nodes.reduce((sum, n) => sum + n.computed.x, 0) / nodes.length;
    for (const node of nodes) {
      const parentX = node.parent ? node.parent.computed.x : 0;
      node.pos.x = avgX - parentX;
    }
    this.graph.updateWorldTransforms();
    this.render();
  }
  render() {
    var _a, _b, _c;
    const tEdge = this.renderTempEdge();
    this.renderer.draw(this.graph, {
      selection: this.selection,
      tempEdge: tEdge,
      boxSelecting: this.boxSelecting,
      activeEdges: this.activeEdges || /* @__PURE__ */ new Set()
      // For animation
    });
    (_a = this.htmlOverlay) == null ? void 0 : _a.draw(this.graph, this.selection);
    if (this.boxSelecting) {
      const { startX, startY, currentX, currentY } = this.boxSelecting;
      const minX = Math.min(startX, currentX);
      const minY = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);
      const screenStart = this.renderer.worldToScreen(minX, minY);
      const screenEnd = this.renderer.worldToScreen(minX + width, minY + height);
      const ctx = this.renderer.ctx;
      ctx.save();
      this.renderer._resetTransform();
      ctx.strokeStyle = "#6cf";
      ctx.fillStyle = "rgba(102, 204, 255, 0.1)";
      ctx.lineWidth = 2;
      ctx.strokeRect(screenStart.x, screenStart.y, screenEnd.x - screenStart.x, screenEnd.y - screenStart.y);
      ctx.fillRect(screenStart.x, screenStart.y, screenEnd.x - screenStart.x, screenEnd.y - screenStart.y);
      ctx.restore();
    }
    if (this.portRenderer) {
      const portCtx = this.portRenderer.ctx;
      portCtx.clearRect(0, 0, this.portRenderer.canvas.width, this.portRenderer.canvas.height);
      this.portRenderer.scale = this.renderer.scale;
      this.portRenderer.offsetX = this.renderer.offsetX;
      this.portRenderer.offsetY = this.renderer.offsetY;
      this.portRenderer._applyTransform();
      for (const n of this.graph.nodes.values()) {
        if (n.type !== "core/Group") {
          const def = (_c = (_b = this.portRenderer.registry) == null ? void 0 : _b.types) == null ? void 0 : _c.get(n.type);
          const hasHtmlOverlay = !!(def == null ? void 0 : def.html);
          if (hasHtmlOverlay) {
            this.portRenderer._drawPorts(n);
          }
        }
      }
      this.portRenderer._resetTransform();
    }
  }
  renderTempEdge() {
    if (!this.connecting) return null;
    const a = this._portAnchorScreen(
      this.connecting.fromNode,
      this.connecting.fromPort
    );
    return {
      x1: a.x,
      y1: a.y,
      x2: this.connecting.x,
      y2: this.connecting.y
    };
  }
  _portAnchorScreen(nodeId, portId) {
    const n = this.graph.nodes.get(nodeId);
    const iOut = n.outputs.findIndex((p) => p.id === portId);
    const r = portRect(n, null, iOut, "out");
    return this.renderer.worldToScreen(r.x, r.y + 7);
  }
};
__publicField(_Controller, "MIN_NODE_WIDTH", 80);
__publicField(_Controller, "MIN_NODE_HEIGHT", 60);
let Controller = _Controller;
function rectHas(r, x, y) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
class ContextMenu {
  constructor({ graph, hooks, renderer, commandStack }) {
    this.graph = graph;
    this.hooks = hooks;
    this.renderer = renderer;
    this.commandStack = commandStack;
    this.items = [];
    this.visible = false;
    this.target = null;
    this.position = { x: 0, y: 0 };
    this.menuElement = this._createMenuElement();
    this._onDocumentClick = (e) => {
      if (!this.menuElement.contains(e.target)) {
        this.hide();
      }
    };
  }
  /**
   * Add a menu item
   * @param {string} id - Unique identifier for the menu item
   * @param {string} label - Display label
   * @param {Object} options - Options
   * @param {Function} options.action - Action to execute (receives target)
   * @param {Array} options.submenu - Submenu items
   * @param {Function} options.condition - Optional condition to show item (receives target)
   * @param {number} options.order - Optional sort order (default: 100)
   */
  addItem(id, label, options = {}) {
    const { action, submenu, condition, order = 100 } = options;
    if (!action && !submenu) {
      console.error("ContextMenu.addItem: either action or submenu is required");
      return;
    }
    this.removeItem(id);
    this.items.push({
      id,
      label,
      action,
      submenu,
      condition,
      order
    });
    this.items.sort((a, b) => a.order - b.order);
  }
  /**
   * Remove a menu item by id
   * @param {string} id - Item id to remove
   */
  removeItem(id) {
    this.items = this.items.filter((item) => item.id !== id);
  }
  /**
   * Show the context menu
   * @param {Object} target - Target node/group
   * @param {number} x - Screen x position
   * @param {number} y - Screen y position
   * @param {Object} worldPos - Optional world position {x, y}
   */
  show(target, x, y, worldPos = null) {
    this.target = target;
    this.position = { x, y };
    this.worldPosition = worldPos;
    this.visible = true;
    this._renderItems();
    this.menuElement.style.left = `${x}px`;
    this.menuElement.style.top = `${y}px`;
    this.menuElement.style.display = "block";
    requestAnimationFrame(() => {
      const rect = this.menuElement.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let adjustedX = x;
      let adjustedY = y;
      if (rect.right > vw) {
        adjustedX = vw - rect.width - 5;
      }
      if (rect.bottom > vh) {
        adjustedY = vh - rect.height - 5;
      }
      this.menuElement.style.left = `${adjustedX}px`;
      this.menuElement.style.top = `${adjustedY}px`;
    });
    document.addEventListener("click", this._onDocumentClick);
  }
  /**
   * Hide the context menu
   */
  hide() {
    this.visible = false;
    this.target = null;
    const allSubmenus = document.querySelectorAll(".context-submenu");
    allSubmenus.forEach((submenu) => submenu.remove());
    this.menuElement.style.display = "none";
    document.removeEventListener("click", this._onDocumentClick);
  }
  /**
   * Cleanup
   */
  destroy() {
    this.hide();
    if (this.menuElement && this.menuElement.parentNode) {
      this.menuElement.parentNode.removeChild(this.menuElement);
    }
  }
  /**
   * Create the menu DOM element
   * @private
   */
  _createMenuElement() {
    const menu = document.createElement("div");
    menu.className = "html-overlay-node-context-menu";
    Object.assign(menu.style, {
      position: "fixed",
      display: "none",
      minWidth: "180px",
      backgroundColor: "#2a2a2e",
      border: "1px solid #444",
      borderRadius: "6px",
      boxShadow: "0 4px 16px rgba(0, 0, 0, 0.4)",
      zIndex: "10000",
      padding: "4px 0",
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: "13px",
      color: "#e9e9ef"
    });
    document.body.appendChild(menu);
    return menu;
  }
  /**
   * Render menu items based on current target
   * @private
   */
  _renderItems() {
    this.menuElement.innerHTML = "";
    const visibleItems = this.items.filter((item) => {
      if (item.condition) {
        return item.condition(this.target);
      }
      return true;
    });
    if (visibleItems.length === 0) {
      this.hide();
      return;
    }
    visibleItems.forEach((item) => {
      const itemEl = document.createElement("div");
      itemEl.className = "context-menu-item";
      const contentWrapper = document.createElement("div");
      Object.assign(contentWrapper.style, {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%"
      });
      const labelEl = document.createElement("span");
      labelEl.textContent = item.label;
      contentWrapper.appendChild(labelEl);
      if (item.submenu) {
        const arrow = document.createElement("span");
        arrow.textContent = "▶";
        arrow.style.marginLeft = "12px";
        arrow.style.fontSize = "10px";
        arrow.style.opacity = "0.7";
        contentWrapper.appendChild(arrow);
      }
      itemEl.appendChild(contentWrapper);
      Object.assign(itemEl.style, {
        padding: "4px 8px",
        cursor: "pointer",
        transition: "background-color 0.15s ease",
        userSelect: "none",
        position: "relative"
      });
      itemEl.addEventListener("mouseenter", () => {
        itemEl.style.backgroundColor = "#3a3a3e";
        if (itemEl._hideTimeout) {
          clearTimeout(itemEl._hideTimeout);
          itemEl._hideTimeout = null;
        }
        if (item.submenu) {
          this._showSubmenu(item.submenu, itemEl);
        }
      });
      itemEl.addEventListener("mouseleave", (e) => {
        itemEl.style.backgroundColor = "transparent";
        if (item.submenu) {
          const submenuEl = itemEl._submenuElement;
          if (submenuEl) {
            itemEl._hideTimeout = setTimeout(() => {
              if (!submenuEl.contains(document.elementFromPoint(e.clientX, e.clientY))) {
                this._hideSubmenu(itemEl);
              }
            }, 150);
          }
        }
      });
      if (!item.submenu) {
        itemEl.addEventListener("click", (e) => {
          e.stopPropagation();
          item.action(this.target);
          this.hide();
        });
      }
      this.menuElement.appendChild(itemEl);
    });
  }
  /**
   * Show submenu for an item
   * @private
   */
  _showSubmenu(submenuItems, parentItemEl) {
    this._hideSubmenu(parentItemEl);
    const submenuEl = document.createElement("div");
    submenuEl.className = "context-submenu";
    Object.assign(submenuEl.style, {
      position: "fixed",
      minWidth: "140px",
      backgroundColor: "#2a2a2e",
      border: "1px solid #444",
      borderRadius: "6px",
      boxShadow: "0 4px 16px rgba(0, 0, 0, 0.4)",
      zIndex: "10001",
      padding: "4px 0",
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: "13px",
      color: "#e9e9ef"
    });
    submenuItems.forEach((subItem) => {
      const subItemEl = document.createElement("div");
      subItemEl.className = "context-submenu-item";
      const contentWrapper = document.createElement("div");
      Object.assign(contentWrapper.style, {
        display: "flex",
        alignItems: "center",
        gap: "8px"
      });
      if (subItem.color) {
        const swatch = document.createElement("div");
        Object.assign(swatch.style, {
          width: "16px",
          height: "16px",
          borderRadius: "3px",
          backgroundColor: subItem.color,
          border: "1px solid #555",
          flexShrink: "0"
        });
        contentWrapper.appendChild(swatch);
      }
      const labelEl = document.createElement("span");
      labelEl.textContent = subItem.label;
      contentWrapper.appendChild(labelEl);
      subItemEl.appendChild(contentWrapper);
      Object.assign(subItemEl.style, {
        padding: "4px 8px",
        cursor: "pointer",
        transition: "background-color 0.15s ease",
        userSelect: "none"
      });
      subItemEl.addEventListener("mouseenter", () => {
        subItemEl.style.backgroundColor = "#3a3a3e";
      });
      subItemEl.addEventListener("mouseleave", () => {
        subItemEl.style.backgroundColor = "transparent";
      });
      subItemEl.addEventListener("click", (e) => {
        e.stopPropagation();
        subItem.action(this.target);
        this.hide();
      });
      submenuEl.appendChild(subItemEl);
    });
    submenuEl.addEventListener("mouseenter", () => {
      if (parentItemEl._hideTimeout) {
        clearTimeout(parentItemEl._hideTimeout);
        parentItemEl._hideTimeout = null;
      }
    });
    submenuEl.addEventListener("mouseleave", (e) => {
      if (!parentItemEl.contains(e.relatedTarget)) {
        this._hideSubmenu(parentItemEl);
      }
    });
    document.body.appendChild(submenuEl);
    parentItemEl._submenuElement = submenuEl;
    requestAnimationFrame(() => {
      const parentRect = parentItemEl.getBoundingClientRect();
      const submenuRect = submenuEl.getBoundingClientRect();
      let left = parentRect.right + 2;
      let top = parentRect.top;
      if (left + submenuRect.width > window.innerWidth) {
        left = parentRect.left - submenuRect.width - 2;
      }
      if (top + submenuRect.height > window.innerHeight) {
        top = window.innerHeight - submenuRect.height - 5;
      }
      submenuEl.style.left = `${left}px`;
      submenuEl.style.top = `${top}px`;
    });
  }
  /**
   * Hide submenu for an item
   * @private
   */
  _hideSubmenu(parentItemEl) {
    if (parentItemEl._submenuElement) {
      parentItemEl._submenuElement.remove();
      parentItemEl._submenuElement = null;
    }
  }
}
class Runner {
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
    var _a, _b;
    const nCycles = Math.max(1, cycles | 0);
    for (let c = 0; c < nCycles; c++) {
      for (const node of this.graph.nodes.values()) {
        const def = this.registry.types.get(node.type);
        if (def == null ? void 0 : def.onExecute) {
          try {
            def.onExecute(node, {
              dt,
              graph: this.graph,
              getInput: (portName) => {
                const p = node.inputs.find((i) => i.name === portName) || node.inputs[0];
                return p ? this.graph.getInput(node.id, p.id) : void 0;
              },
              setOutput: (portName, value) => {
                const p = node.outputs.find((o) => o.name === portName) || node.outputs[0];
                if (p) this.graph.setOutput(node.id, p.id, value);
              }
            });
          } catch (err) {
            (_b = (_a = this.hooks) == null ? void 0 : _a.emit) == null ? void 0 : _b.call(_a, "error", err);
          }
        }
      }
      this.graph.swapBuffers();
    }
  }
  /**
   * Execute connected nodes once from a starting node
   * @param {string} startNodeId - ID of the node to start from
   * @param {number} dt - Delta time
   */
  runOnce(startNodeId, dt = 0) {
    console.log("[Runner.runOnce] Starting exec flow from node:", startNodeId);
    const executedNodes = [];
    const allConnectedNodes = /* @__PURE__ */ new Set();
    let currentNodeId = startNodeId;
    while (currentNodeId) {
      const node = this.graph.nodes.get(currentNodeId);
      if (!node) {
        console.warn(`[Runner.runOnce] Node not found: ${currentNodeId}`);
        break;
      }
      executedNodes.push(currentNodeId);
      allConnectedNodes.add(currentNodeId);
      console.log(`[Runner.runOnce] Executing: ${node.title} (${node.type})`);
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
      this.executeNode(currentNodeId, dt);
      currentNodeId = this.findNextExecNode(currentNodeId);
    }
    console.log("[Runner.runOnce] Executed nodes:", executedNodes.length);
    const connectedEdges = /* @__PURE__ */ new Set();
    for (const edge of this.graph.edges.values()) {
      if (allConnectedNodes.has(edge.fromNode) && allConnectedNodes.has(edge.toNode)) {
        connectedEdges.add(edge.id);
      }
    }
    console.log("[Runner.runOnce] Connected edges count:", connectedEdges.size);
    return { connectedNodes: allConnectedNodes, connectedEdges };
  }
  /**
   * Find the next node to execute by following exec output
   * @param {string} nodeId - Current node ID
   * @returns {string|null} Next node ID or null
   */
  findNextExecNode(nodeId) {
    const node = this.graph.nodes.get(nodeId);
    if (!node) return null;
    const execOutput = node.outputs.find((p) => p.portType === "exec");
    if (!execOutput) return null;
    for (const edge of this.graph.edges.values()) {
      if (edge.fromNode === nodeId && edge.fromPort === execOutput.id) {
        return edge.toNode;
      }
    }
    return null;
  }
  /**
   * Execute a single node
   * @param {string} nodeId - Node ID to execute
   * @param {number} dt - Delta time
   */
  executeNode(nodeId, dt) {
    var _a, _b;
    const node = this.graph.nodes.get(nodeId);
    if (!node) return;
    const def = this.registry.types.get(node.type);
    if (!(def == null ? void 0 : def.onExecute)) return;
    try {
      def.onExecute(node, {
        dt,
        graph: this.graph,
        getInput: (portName) => {
          const p = node.inputs.find((i) => i.name === portName) || node.inputs[0];
          return p ? this.graph.getInput(node.id, p.id) : void 0;
        },
        setOutput: (portName, value) => {
          const p = node.outputs.find((o) => o.name === portName) || node.outputs[0];
          if (p) {
            const key = `${node.id}:${p.id}`;
            this.graph._curBuf().set(key, value);
          }
        }
      });
    } catch (err) {
      (_b = (_a = this.hooks) == null ? void 0 : _a.emit) == null ? void 0 : _b.call(_a, "error", err);
    }
  }
  start() {
    var _a, _b;
    if (this.running) return;
    this.running = true;
    this._last = 0;
    (_b = (_a = this.hooks) == null ? void 0 : _a.emit) == null ? void 0 : _b.call(_a, "runner:start");
    const loop = (t) => {
      var _a2, _b2;
      if (!this.running) return;
      const dtMs = this._last ? t - this._last : 0;
      this._last = t;
      const dt = dtMs / 1e3;
      this.step(this.cyclesPerFrame, dt);
      (_b2 = (_a2 = this.hooks) == null ? void 0 : _a2.emit) == null ? void 0 : _b2.call(_a2, "runner:tick", {
        time: t,
        dt,
        running: true,
        cps: this.cyclesPerFrame
      });
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }
  stop() {
    var _a, _b;
    if (!this.running) return;
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    this._last = 0;
    (_b = (_a = this.hooks) == null ? void 0 : _a.emit) == null ? void 0 : _b.call(_a, "runner:stop");
  }
}
class HtmlOverlay {
  /**
   * @param {HTMLElement} host  캔버스를 감싸는 래퍼( position: relative )
   * @param {CanvasRenderer} renderer
   * @param {Registry} registry
   */
  constructor(host, renderer, registry) {
    this.host = host;
    this.renderer = renderer;
    this.registry = registry;
    this.container = document.createElement("div");
    Object.assign(this.container.style, {
      position: "absolute",
      inset: "0",
      pointerEvents: "none",
      // 기본은 통과
      zIndex: "10"
    });
    host.appendChild(this.container);
    this.nodes = /* @__PURE__ */ new Map();
  }
  /** 기본 노드 레이아웃 생성 (헤더 + 바디) */
  _createDefaultNodeLayout(node) {
    const container = document.createElement("div");
    container.className = "node-overlay";
    Object.assign(container.style, {
      position: "absolute",
      display: "flex",
      flexDirection: "column",
      boxSizing: "border-box",
      pointerEvents: "none",
      // 기본은 통과 (캔버스 인터랙션 위해)
      overflow: "hidden"
      // 둥근 모서리 등
    });
    const header = document.createElement("div");
    header.className = "node-header";
    Object.assign(header.style, {
      height: "24px",
      flexShrink: "0",
      display: "flex",
      alignItems: "center",
      padding: "0 8px",
      cursor: "grab",
      userSelect: "none",
      pointerEvents: "none"
      // 헤더 클릭시 드래그는 캔버스가 처리
    });
    const body = document.createElement("div");
    body.className = "node-body";
    Object.assign(body.style, {
      flex: "1",
      position: "relative",
      overflow: "hidden",
      pointerEvents: "auto",
      // 바디 내부는 인터랙션 가능하게? 아니면 이것도 none하고 자식만 auto?
      // 일단 바디는 auto로 두면 바디 영역 클릭시 드래그가 안됨.
      // 그래서 바디도 none으로 하고, 내부 컨텐츠(input 등)만 auto로 하는게 맞음.
      pointerEvents: "none"
    });
    container.appendChild(header);
    container.appendChild(body);
    container._domParts = { header, body };
    return container;
  }
  /** 노드용 엘리먼트 생성(한 번만) */
  _ensureNodeElement(node, def) {
    var _a;
    let el = this.nodes.get(node.id);
    if (!el) {
      if ((_a = def.html) == null ? void 0 : _a.render) {
        el = def.html.render(node);
      } else if (def.html) {
        el = this._createDefaultNodeLayout(node);
        if (def.html.init) {
          def.html.init(node, el, el._domParts);
        }
      } else {
        return null;
      }
      if (!el) return null;
      el.style.position = "absolute";
      el.style.pointerEvents = "none";
      this.container.appendChild(el);
      this.nodes.set(node.id, el);
    }
    return el;
  }
  /** 그래프와 변환 동기화하여 렌더링 */
  draw(graph, selection = /* @__PURE__ */ new Set()) {
    const { scale, offsetX, offsetY } = this.renderer;
    this.container.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    this.container.style.transformOrigin = "0 0";
    const seen = /* @__PURE__ */ new Set();
    for (const node of graph.nodes.values()) {
      const def = this.registry.types.get(node.type);
      const hasHtml = !!(def == null ? void 0 : def.html);
      if (!hasHtml) continue;
      const el = this._ensureNodeElement(node, def);
      if (!el) continue;
      el.style.left = `${node.computed.x}px`;
      el.style.top = `${node.computed.y}px`;
      el.style.width = `${node.computed.w}px`;
      el.style.height = `${node.computed.h}px`;
      if (def.html.update) {
        const parts = el._domParts || {};
        def.html.update(node, el, {
          selected: selection.has(node.id),
          header: parts.header,
          body: parts.body
        });
      }
      seen.add(node.id);
    }
    for (const [id, el] of this.nodes) {
      if (!seen.has(id)) {
        el.remove();
        this.nodes.delete(id);
      }
    }
  }
  clear() {
    for (const [, el] of this.nodes) {
      el.remove();
    }
    this.nodes.clear();
  }
  destroy() {
    this.clear();
    this.container.remove();
  }
}
class Minimap {
  constructor(container, { graph, renderer, width = 200, height = 150 } = {}) {
    this.graph = graph;
    this.renderer = renderer;
    this.width = width;
    this.height = height;
    this.canvas = document.createElement("canvas");
    this.canvas.id = "minimap";
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.position = "fixed";
    this.canvas.style.bottom = "20px";
    this.canvas.style.right = "20px";
    this.canvas.style.border = "2px solid #444";
    this.canvas.style.borderRadius = "8px";
    this.canvas.style.background = "rgba(20, 20, 23, 0.9)";
    this.canvas.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.5)";
    this.canvas.style.pointerEvents = "none";
    this.ctx = this.canvas.getContext("2d");
    container.appendChild(this.canvas);
  }
  /**
   * Render the minimap
   */
  render() {
    const { graph, renderer, ctx, width: w, height: h } = this;
    ctx.fillStyle = "#141417";
    ctx.fillRect(0, 0, w, h);
    if (graph.nodes.size === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of graph.nodes.values()) {
      const { x, y, w: nw, h: nh } = node.computed;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + nw);
      maxY = Math.max(maxY, y + nh);
    }
    const margin = 100;
    const graphWidth = Math.max(300, maxX - minX + margin * 2);
    const graphHeight = Math.max(200, maxY - minY + margin * 2);
    minX -= margin;
    minY -= margin;
    const padding = 10;
    const scale = Math.min(
      (w - padding * 2) / graphWidth,
      (h - padding * 2) / graphHeight
    );
    const offsetX = (w - graphWidth * scale) / 2;
    const offsetY = (h - graphHeight * scale) / 2;
    ctx.strokeStyle = "rgba(127, 140, 255, 0.5)";
    ctx.lineWidth = 1;
    for (const edge of graph.edges.values()) {
      const fromNode = graph.nodes.get(edge.fromNode);
      const toNode = graph.nodes.get(edge.toNode);
      if (!fromNode || !toNode) continue;
      const x1 = fromNode.computed.x + fromNode.computed.w / 2;
      const y1 = fromNode.computed.y + fromNode.computed.h / 2;
      const x2 = toNode.computed.x + toNode.computed.w / 2;
      const y2 = toNode.computed.y + toNode.computed.h / 2;
      const mx1 = (x1 - minX) * scale + offsetX;
      const my1 = (y1 - minY) * scale + offsetY;
      const mx2 = (x2 - minX) * scale + offsetX;
      const my2 = (y2 - minY) * scale + offsetY;
      ctx.beginPath();
      ctx.moveTo(mx1, my1);
      ctx.lineTo(mx2, my2);
      ctx.stroke();
    }
    ctx.fillStyle = "#6cf";
    for (const node of graph.nodes.values()) {
      const { x, y, w: nw, h: nh } = node.computed;
      const mx = (x - minX) * scale + offsetX;
      const my = (y - minY) * scale + offsetY;
      const mw = nw * scale;
      const mh = nh * scale;
      if (node.type === "core/Group") {
        ctx.fillStyle = "rgba(102, 204, 255, 0.2)";
        ctx.strokeStyle = "#6cf";
        ctx.lineWidth = 1;
        ctx.fillRect(mx, my, mw, mh);
        ctx.strokeRect(mx, my, mw, mh);
      } else {
        ctx.fillStyle = "#6cf";
        ctx.fillRect(mx, my, Math.max(2, mw), Math.max(2, mh));
      }
    }
    const vx0 = -renderer.offsetX / renderer.scale;
    const vy0 = -renderer.offsetY / renderer.scale;
    const vw = renderer.canvas.width / renderer.scale;
    const vh = renderer.canvas.height / renderer.scale;
    const vmx = (vx0 - minX) * scale + offsetX;
    const vmy = (vy0 - minY) * scale + offsetY;
    const vmw = vw * scale;
    const vmh = vh * scale;
    ctx.strokeStyle = "#ff6b6b";
    ctx.lineWidth = 2;
    ctx.strokeRect(vmx, vmy, vmw, vmh);
  }
  /**
   * Cleanup
   */
  destroy() {
    if (this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
  }
}
class PropertyPanel {
  constructor(container, { graph, hooks, registry, render }) {
    this.container = container;
    this.graph = graph;
    this.hooks = hooks;
    this.registry = registry;
    this.render = render;
    this.panel = null;
    this.currentNode = null;
    this.isVisible = false;
    this._createPanel();
  }
  _createPanel() {
    this.panel = document.createElement("div");
    this.panel.className = "property-panel";
    this.panel.style.display = "none";
    this.panel.innerHTML = `
      <div class="panel-inner">
        <div class="panel-header">
          <div class="panel-title">
            <span class="title-text">Node Properties</span>
          </div>
          <button class="panel-close" type="button">×</button>
        </div>
        <div class="panel-content">
          <!-- Content will be dynamically generated -->
        </div>
      </div>
    `;
    this.container.appendChild(this.panel);
    this.panel.querySelector(".panel-close").addEventListener("click", () => {
      this.close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isVisible) {
        this.close();
      }
    });
  }
  open(node) {
    if (!node) return;
    this.currentNode = node;
    this.isVisible = true;
    this._renderContent();
    this.panel.style.display = "block";
    this.panel.classList.add("panel-visible");
  }
  close() {
    this.isVisible = false;
    this.panel.classList.remove("panel-visible");
    setTimeout(() => {
      this.panel.style.display = "none";
      this.currentNode = null;
    }, 200);
  }
  _renderContent() {
    var _a, _b;
    const node = this.currentNode;
    if (!node) return;
    const content = this.panel.querySelector(".panel-content");
    (_b = (_a = this.registry) == null ? void 0 : _a.types) == null ? void 0 : _b.get(node.type);
    content.innerHTML = `
      <div class="section">
        <div class="section-title">Basic Info</div>
        <div class="section-body">
          <div class="field">
            <label>Type</label>
            <input type="text" value="${node.type}" readonly />
          </div>
          <div class="field">
            <label>Title</label>
            <input type="text" data-field="title" value="${node.title || ""}" />
          </div>
          <div class="field">
            <label>ID</label>
            <input type="text" value="${node.id}" readonly />
          </div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">Position & Size</div>
        <div class="section-body">
          <div class="field-row">
            <div class="field">
              <label>X</label>
              <input type="number" data-field="x" value="${Math.round(node.computed.x)}" />
            </div>
            <div class="field">
              <label>Y</label>
              <input type="number" data-field="y" value="${Math.round(node.computed.y)}" />
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label>Width</label>
              <input type="number" data-field="width" value="${node.computed.w}" />
            </div>
            <div class="field">
              <label>Height</label>
              <input type="number" data-field="height" value="${node.computed.h}" />
            </div>
          </div>
        </div>
      </div>
      
      ${this._renderPorts(node)}
      ${this._renderState(node)}
      
      <div class="panel-actions">
        <button class="btn-secondary panel-close-btn">Close</button>
      </div>
    `;
    this._attachInputListeners();
  }
  _renderPorts(node) {
    if (!node.inputs.length && !node.outputs.length) return "";
    return `
      <div class="section">
        <div class="section-title">Ports</div>
        <div class="section-body">
          ${node.inputs.length ? `
            <div class="port-group">
              <div class="port-group-title">Inputs (${node.inputs.length})</div>
              ${node.inputs.map((p) => `
                <div class="port-item">
                  <span class="port-icon ${p.portType || "data"}"></span>
                  <span class="port-name">${p.name}</span>
                  ${p.datatype ? `<span class="port-type">${p.datatype}</span>` : ""}
                </div>
              `).join("")}
            </div>
          ` : ""}
          
          ${node.outputs.length ? `
            <div class="port-group">
              <div class="port-group-title">Outputs (${node.outputs.length})</div>
              ${node.outputs.map((p) => `
                <div class="port-item">
                  <span class="port-icon ${p.portType || "data"}"></span>
                  <span class="port-name">${p.name}</span>
                  ${p.datatype ? `<span class="port-type">${p.datatype}</span>` : ""}
                </div>
              `).join("")}
            </div>
          ` : ""}
        </div>
      </div>
    `;
  }
  _renderState(node) {
    if (!node.state || Object.keys(node.state).length === 0) return "";
    return `
      <div class="section">
        <div class="section-title">State</div>
        <div class="section-body">
          ${Object.entries(node.state).map(([key, value]) => `
            <div class="field">
              <label>${key}</label>
              <input 
                type="${typeof value === "number" ? "number" : "text"}" 
                data-field="state.${key}" 
                value="${value}" 
              />
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }
  _attachInputListeners() {
    const inputs = this.panel.querySelectorAll("[data-field]");
    inputs.forEach((input) => {
      input.addEventListener("change", () => {
        this._handleFieldChange(input.dataset.field, input.value);
      });
    });
    this.panel.querySelector(".panel-close-btn").addEventListener("click", () => {
      this.close();
    });
  }
  _handleFieldChange(field, value) {
    var _a;
    const node = this.currentNode;
    if (!node) return;
    switch (field) {
      case "title":
        node.title = value;
        break;
      case "x":
        node.pos.x = parseFloat(value);
        this.graph.updateWorldTransforms();
        break;
      case "y":
        node.pos.y = parseFloat(value);
        this.graph.updateWorldTransforms();
        break;
      case "width":
        node.size.width = parseFloat(value);
        break;
      case "height":
        node.size.height = parseFloat(value);
        break;
      default:
        if (field.startsWith("state.")) {
          const key = field.substring(6);
          if (node.state) {
            const originalValue = node.state[key];
            node.state[key] = typeof originalValue === "number" ? parseFloat(value) : value;
          }
        }
    }
    (_a = this.hooks) == null ? void 0 : _a.emit("node:updated", node);
    if (this.render) {
      this.render();
    }
  }
  destroy() {
    if (this.panel) {
      this.panel.remove();
    }
  }
}
function createGraphEditor(target, {
  theme,
  hooks: customHooks,
  autorun = true,
  showMinimap = true,
  enablePropertyPanel = true,
  propertyPanelContainer = null
} = {}) {
  let canvas;
  let container;
  if (typeof target === "string") {
    target = document.querySelector(target);
  }
  if (!target) {
    throw new Error("createGraphEditor: target element not found");
  }
  if (target instanceof HTMLCanvasElement) {
    canvas = target;
    container = canvas.parentElement;
  } else {
    container = target;
    canvas = container.querySelector("canvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.style.display = "block";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      container.appendChild(canvas);
    }
  }
  if (getComputedStyle(container).position === "static") {
    container.style.position = "relative";
  }
  const hooks = customHooks ?? createHooks([
    // essential hooks
    "node:create",
    "node:move",
    "node:click",
    "node:dblclick",
    "edge:create",
    "edge:delete",
    "graph:serialize",
    "graph:deserialize",
    "error",
    "runner:tick",
    "runner:start",
    "runner:stop",
    "node:resize",
    "group:change",
    "node:updated"
  ]);
  const registry = new Registry();
  const graph = new Graph({ hooks, registry });
  const renderer = new CanvasRenderer(canvas, { theme, registry });
  const htmlOverlay = new HtmlOverlay(canvas.parentElement, renderer, registry);
  const portCanvas = document.createElement("canvas");
  portCanvas.id = "port-canvas";
  Object.assign(portCanvas.style, {
    position: "absolute",
    top: "0",
    left: "0",
    pointerEvents: "none",
    // Pass through clicks
    zIndex: "20"
    // Above HTML overlay (z-index 10)
  });
  canvas.parentElement.appendChild(portCanvas);
  const portRenderer = new CanvasRenderer(portCanvas, { theme, registry });
  portRenderer.setTransform = renderer.setTransform.bind(renderer);
  portRenderer.scale = renderer.scale;
  portRenderer.offsetX = renderer.offsetX;
  portRenderer.offsetY = renderer.offsetY;
  const controller = new Controller({ graph, renderer, hooks, htmlOverlay, portRenderer });
  const contextMenu = new ContextMenu({
    graph,
    hooks,
    renderer,
    commandStack: controller.stack
  });
  controller.contextMenu = contextMenu;
  let minimap = null;
  if (showMinimap) {
    minimap = new Minimap(container, { graph, renderer });
  }
  let propertyPanel = null;
  if (enablePropertyPanel) {
    propertyPanel = new PropertyPanel(propertyPanelContainer || container, {
      graph,
      hooks,
      registry,
      render: () => controller.render()
    });
    hooks.on("node:dblclick", (node) => {
      propertyPanel.open(node);
    });
  }
  const runner = new Runner({ graph, registry, hooks });
  hooks.on("runner:tick", ({ time, dt }) => {
    renderer.draw(graph, {
      selection: controller.selection,
      tempEdge: controller.connecting ? controller.renderTempEdge() : null,
      // 필요시 helper
      running: true,
      time,
      dt
    });
    htmlOverlay.draw(graph, controller.selection);
  });
  hooks.on("runner:start", () => {
    renderer.draw(graph, {
      selection: controller.selection,
      tempEdge: controller.connecting ? controller.renderTempEdge() : null,
      running: true,
      time: performance.now(),
      dt: 0
    });
    htmlOverlay.draw(graph, controller.selection);
  });
  hooks.on("runner:stop", () => {
    renderer.draw(graph, {
      selection: controller.selection,
      tempEdge: controller.connecting ? controller.renderTempEdge() : null,
      running: false,
      time: performance.now(),
      dt: 0
    });
    htmlOverlay.draw(graph, controller.selection);
  });
  hooks.on("node:updated", () => {
    controller.render();
  });
  registry.register("core/Note", {
    title: "Note",
    size: { w: 180, h: 80 },
    inputs: [{ name: "in", datatype: "any" }],
    outputs: [{ name: "out", datatype: "any" }],
    onCreate(node) {
      node.state.text = "hello";
    },
    onExecute(node, { dt, getInput, setOutput }) {
      const incoming = getInput("in");
      const out = (incoming ?? node.state.text ?? "").toString().toUpperCase();
      setOutput(
        "out",
        out + ` · ${Math.floor(performance.now() / 1e3 % 100)}`
      );
    },
    onDraw(node, { ctx, theme: theme2 }) {
      const { x, y } = node.pos;
      const { width: w } = node.size;
    }
  });
  registry.register("core/HtmlNote", {
    title: "HTML Note",
    size: { w: 200, h: 150 },
    inputs: [{ name: "in", datatype: "any" }],
    outputs: [{ name: "out", datatype: "any" }],
    // HTML Overlay Configuration
    html: {
      // 초기화: 헤더/바디 구성
      init(node, el, { header, body }) {
        el.style.backgroundColor = "#222";
        el.style.borderRadius = "8px";
        el.style.border = "1px solid #444";
        el.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
        header.style.backgroundColor = "#333";
        header.style.borderBottom = "1px solid #444";
        header.style.color = "#eee";
        header.style.fontSize = "12px";
        header.style.fontWeight = "bold";
        header.textContent = "My HTML Node";
        body.style.padding = "8px";
        body.style.color = "#ccc";
        body.style.fontSize = "12px";
        const contentDiv = document.createElement("div");
        contentDiv.textContent = "Event Name";
        body.appendChild(contentDiv);
        const input = document.createElement("input");
        Object.assign(input.style, {
          marginTop: "4px",
          padding: "4px",
          background: "#111",
          border: "1px solid #555",
          color: "#fff",
          borderRadius: "4px",
          pointerEvents: "auto"
        });
        input.placeholder = "Type here...";
        input.addEventListener("input", (e) => {
          node.state.text = e.target.value;
        });
        input.addEventListener("mousedown", (e) => e.stopPropagation());
        body.appendChild(input);
        el._input = input;
      },
      // 매 프레임(또는 필요시) 업데이트
      update(node, el, { header, body, selected }) {
        el.style.borderColor = selected ? "#6cf" : "#444";
        header.style.backgroundColor = selected ? "#3a4a5a" : "#333";
        if (el._input.value !== (node.state.text || "")) {
          el._input.value = node.state.text || "";
        }
      }
    },
    onCreate(node) {
      node.state.text = "";
    },
    onExecute(node, { getInput, setOutput }) {
      const incoming = getInput("in");
      setOutput("out", incoming);
    }
    // onDraw는 생략 가능 (HTML이 덮으니까)
    // 하지만 포트 등은 그려야 할 수도 있음. 
    // 현재 구조상 CanvasRenderer가 기본 노드를 그리므로, 
    // 투명하게 하거나 겹쳐서 그릴 수 있음.
  });
  registry.register("core/TodoNode", {
    title: "Todo List",
    size: { w: 240, h: 300 },
    inputs: [{ name: "in", datatype: "any" }],
    outputs: [{ name: "out", datatype: "any" }],
    html: {
      init(node, el, { header, body }) {
        el.style.backgroundColor = "#1e1e24";
        el.style.borderRadius = "8px";
        el.style.boxShadow = "0 4px 12px rgba(0,0,0,0.5)";
        el.style.border = "1px solid #333";
        header.style.backgroundColor = "#2a2a31";
        header.style.padding = "8px";
        header.style.fontWeight = "bold";
        header.style.color = "#e9e9ef";
        header.textContent = node.title;
        body.style.display = "flex";
        body.style.flexDirection = "column";
        body.style.padding = "8px";
        body.style.color = "#e9e9ef";
        const inputRow = document.createElement("div");
        Object.assign(inputRow.style, { display: "flex", gap: "4px", marginBottom: "8px" });
        const input = document.createElement("input");
        Object.assign(input.style, {
          flex: "1",
          padding: "6px",
          borderRadius: "4px",
          border: "1px solid #444",
          background: "#141417",
          color: "#fff",
          pointerEvents: "auto"
        });
        input.placeholder = "Add task...";
        const addBtn = document.createElement("button");
        addBtn.textContent = "+";
        Object.assign(addBtn.style, {
          padding: "0 12px",
          cursor: "pointer",
          background: "#4f5b66",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          pointerEvents: "auto"
        });
        inputRow.append(input, addBtn);
        const list = document.createElement("ul");
        Object.assign(list.style, {
          listStyle: "none",
          padding: "0",
          margin: "0",
          overflow: "hidden",
          flex: "1"
        });
        body.append(inputRow, list);
        const addTodo = () => {
          const text = input.value.trim();
          if (!text) return;
          const todos = node.state.todos || [];
          node.state.todos = [...todos, { id: Date.now(), text, done: false }];
          input.value = "";
          hooks.emit("node:updated", node);
        };
        addBtn.onclick = addTodo;
        input.onkeydown = (e) => {
          if (e.key === "Enter") addTodo();
          e.stopPropagation();
        };
        input.onmousedown = (e) => e.stopPropagation();
        el._refs = { list };
      },
      update(node, el, { selected }) {
        el.style.borderColor = selected ? "#6cf" : "#333";
        const { list } = el._refs;
        const todos = node.state.todos || [];
        list.innerHTML = "";
        todos.forEach((todo) => {
          const li = document.createElement("li");
          Object.assign(li.style, {
            display: "flex",
            alignItems: "center",
            padding: "6px 0",
            borderBottom: "1px solid #2a2a31"
          });
          const chk = document.createElement("input");
          chk.type = "checkbox";
          chk.checked = todo.done;
          chk.style.marginRight = "8px";
          chk.style.pointerEvents = "auto";
          chk.onchange = () => {
            todo.done = chk.checked;
            hooks.emit("node:updated", node);
          };
          chk.onmousedown = (e) => e.stopPropagation();
          const span = document.createElement("span");
          span.textContent = todo.text;
          span.style.flex = "1";
          span.style.textDecoration = todo.done ? "line-through" : "none";
          span.style.color = todo.done ? "#777" : "#eee";
          const del = document.createElement("button");
          del.textContent = "×";
          Object.assign(del.style, {
            background: "none",
            border: "none",
            color: "#f44",
            cursor: "pointer",
            fontSize: "16px",
            pointerEvents: "auto"
          });
          del.onclick = () => {
            node.state.todos = node.state.todos.filter((t) => t.id !== todo.id);
            hooks.emit("node:updated", node);
          };
          del.onmousedown = (e) => e.stopPropagation();
          li.append(chk, span, del);
          list.appendChild(li);
        });
      }
    },
    onCreate(node) {
      node.state.todos = [
        { id: 1, text: "Welcome to Free Node", done: false },
        { id: 2, text: "Try adding a task", done: true }
      ];
    }
  });
  registry.register("math/Add", {
    title: "Add",
    size: { w: 140, h: 100 },
    inputs: [
      { name: "exec", portType: "exec" },
      { name: "a", portType: "data", datatype: "number" },
      { name: "b", portType: "data", datatype: "number" }
    ],
    outputs: [
      { name: "exec", portType: "exec" },
      { name: "result", portType: "data", datatype: "number" }
    ],
    onCreate(node) {
      node.state.a = 0;
      node.state.b = 0;
    },
    onExecute(node, { getInput, setOutput }) {
      const a = getInput("a") ?? 0;
      const b = getInput("b") ?? 0;
      const result = a + b;
      console.log("[Add] a:", a, "b:", b, "result:", result);
      setOutput("result", result);
    }
  });
  registry.register("math/Subtract", {
    title: "Subtract",
    size: { w: 140, h: 80 },
    inputs: [
      { name: "a", datatype: "number" },
      { name: "b", datatype: "number" }
    ],
    outputs: [{ name: "result", datatype: "number" }],
    onExecute(node, { getInput, setOutput }) {
      const a = getInput("a") ?? 0;
      const b = getInput("b") ?? 0;
      setOutput("result", a - b);
    }
  });
  registry.register("math/Multiply", {
    title: "Multiply",
    size: { w: 140, h: 100 },
    inputs: [
      { name: "exec", portType: "exec" },
      { name: "a", portType: "data", datatype: "number" },
      { name: "b", portType: "data", datatype: "number" }
    ],
    outputs: [
      { name: "exec", portType: "exec" },
      { name: "result", portType: "data", datatype: "number" }
    ],
    onExecute(node, { getInput, setOutput }) {
      const a = getInput("a") ?? 0;
      const b = getInput("b") ?? 0;
      const result = a * b;
      console.log("[Multiply] a:", a, "b:", b, "result:", result);
      setOutput("result", result);
    }
  });
  registry.register("math/Divide", {
    title: "Divide",
    size: { w: 140, h: 80 },
    inputs: [
      { name: "a", datatype: "number" },
      { name: "b", datatype: "number" }
    ],
    outputs: [{ name: "result", datatype: "number" }],
    onExecute(node, { getInput, setOutput }) {
      const a = getInput("a") ?? 0;
      const b = getInput("b") ?? 1;
      setOutput("result", b !== 0 ? a / b : 0);
    }
  });
  registry.register("logic/AND", {
    title: "AND",
    size: { w: 120, h: 100 },
    inputs: [
      { name: "exec", portType: "exec" },
      { name: "a", portType: "data", datatype: "boolean" },
      { name: "b", portType: "data", datatype: "boolean" }
    ],
    outputs: [
      { name: "exec", portType: "exec" },
      { name: "result", portType: "data", datatype: "boolean" }
    ],
    onExecute(node, { getInput, setOutput }) {
      const a = getInput("a") ?? false;
      const b = getInput("b") ?? false;
      console.log("[AND] Inputs - a:", a, "b:", b);
      const result = a && b;
      console.log("[AND] Result:", result);
      setOutput("result", result);
    }
  });
  registry.register("logic/OR", {
    title: "OR",
    size: { w: 120, h: 80 },
    inputs: [
      { name: "a", datatype: "boolean" },
      { name: "b", datatype: "boolean" }
    ],
    outputs: [{ name: "result", datatype: "boolean" }],
    onExecute(node, { getInput, setOutput }) {
      const a = getInput("a") ?? false;
      const b = getInput("b") ?? false;
      setOutput("result", a || b);
    }
  });
  registry.register("logic/NOT", {
    title: "NOT",
    size: { w: 120, h: 70 },
    inputs: [{ name: "in", datatype: "boolean" }],
    outputs: [{ name: "out", datatype: "boolean" }],
    onExecute(node, { getInput, setOutput }) {
      const val = getInput("in") ?? false;
      setOutput("out", !val);
    }
  });
  registry.register("value/Number", {
    title: "Number",
    size: { w: 140, h: 60 },
    outputs: [{ name: "value", portType: "data", datatype: "number" }],
    onCreate(node) {
      node.state.value = 0;
    },
    onExecute(node, { setOutput }) {
      console.log("[Number] Outputting value:", node.state.value ?? 0);
      setOutput("value", node.state.value ?? 0);
    },
    html: {
      init(node, el, { header, body }) {
        el.style.backgroundColor = "#1e1e24";
        el.style.border = "1px solid #444";
        el.style.borderRadius = "8px";
        header.style.backgroundColor = "#2a2a31";
        header.style.borderBottom = "1px solid #444";
        header.style.color = "#eee";
        header.style.fontSize = "12px";
        header.textContent = "Number";
        body.style.padding = "12px";
        body.style.display = "flex";
        body.style.alignItems = "center";
        body.style.justifyContent = "center";
        const input = document.createElement("input");
        input.type = "number";
        input.value = node.state.value ?? 0;
        Object.assign(input.style, {
          width: "100%",
          padding: "6px",
          background: "#141417",
          border: "1px solid #444",
          borderRadius: "4px",
          color: "#fff",
          fontSize: "14px",
          textAlign: "center",
          pointerEvents: "auto"
        });
        input.addEventListener("change", (e) => {
          node.state.value = parseFloat(e.target.value) || 0;
        });
        input.addEventListener("mousedown", (e) => e.stopPropagation());
        input.addEventListener("keydown", (e) => e.stopPropagation());
        body.appendChild(input);
      },
      update(node, el, { header, body, selected }) {
        el.style.borderColor = selected ? "#6cf" : "#444";
        header.style.backgroundColor = selected ? "#3a4a5a" : "#2a2a31";
      }
    },
    onDraw(node, { ctx, theme: theme2 }) {
      const { x, y } = node.computed;
      ctx.fillStyle = "#8f8";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(node.state.value ?? 0), x + 70, y + 42);
    }
  });
  registry.register("value/String", {
    title: "String",
    size: { w: 160, h: 60 },
    outputs: [{ name: "value", datatype: "string" }],
    onCreate(node) {
      node.state.value = "Hello";
    },
    onExecute(node, { setOutput }) {
      setOutput("value", node.state.value ?? "");
    },
    onDraw(node, { ctx, theme: theme2 }) {
      const { x, y } = node.computed;
      ctx.fillStyle = "#8f8";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      const text = String(node.state.value ?? "");
      const displayText = text.length > 15 ? text.substring(0, 15) + "..." : text;
      ctx.fillText(displayText, x + 80, y + 42);
    }
  });
  registry.register("value/Boolean", {
    title: "Boolean",
    size: { w: 140, h: 60 },
    outputs: [{ name: "value", portType: "data", datatype: "boolean" }],
    onCreate(node) {
      node.state.value = true;
    },
    onExecute(node, { setOutput }) {
      console.log("[Boolean] Outputting value:", node.state.value ?? false);
      setOutput("value", node.state.value ?? false);
    },
    onDraw(node, { ctx, theme: theme2 }) {
      const { x, y } = node.computed;
      ctx.fillStyle = node.state.value ? "#8f8" : "#f88";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(node.state.value), x + 70, y + 42);
    }
  });
  registry.register("util/Print", {
    title: "Print",
    size: { w: 140, h: 80 },
    inputs: [
      { name: "exec", portType: "exec" },
      { name: "value", portType: "data", datatype: "any" }
    ],
    onCreate(node) {
      node.state.lastValue = null;
    },
    onExecute(node, { getInput }) {
      const val = getInput("value");
      if (val !== node.state.lastValue) {
        console.log("[Print]", val);
        node.state.lastValue = val;
      }
    }
  });
  registry.register("util/Watch", {
    title: "Watch",
    size: { w: 180, h: 110 },
    inputs: [
      { name: "exec", portType: "exec" },
      { name: "value", portType: "data", datatype: "any" }
    ],
    outputs: [
      { name: "exec", portType: "exec" },
      { name: "value", portType: "data", datatype: "any" }
    ],
    onCreate(node) {
      node.state.displayValue = "---";
    },
    onExecute(node, { getInput, setOutput }) {
      const val = getInput("value");
      console.log("[Watch] onExecute called, value:", val);
      node.state.displayValue = String(val ?? "---");
      setOutput("value", val);
    },
    onDraw(node, { ctx, theme: theme2 }) {
      const { x, y } = node.computed;
      ctx.fillStyle = "#fa3";
      ctx.font = "11px monospace";
      ctx.textAlign = "left";
      const text = String(node.state.displayValue ?? "---");
      const displayText = text.length > 20 ? text.substring(0, 20) + "..." : text;
      ctx.fillText(displayText, x + 8, y + 50);
    }
  });
  registry.register("util/Timer", {
    title: "Timer",
    size: { w: 140, h: 60 },
    outputs: [{ name: "time", datatype: "number" }],
    onCreate(node) {
      node.state.startTime = performance.now();
    },
    onExecute(node, { setOutput }) {
      const elapsed = (performance.now() - (node.state.startTime ?? 0)) / 1e3;
      setOutput("time", elapsed.toFixed(2));
    }
  });
  registry.register("util/Trigger", {
    title: "Trigger",
    size: { w: 140, h: 80 },
    outputs: [{ name: "exec", portType: "exec" }],
    // Changed to exec port
    html: {
      init(node, el, { header, body }) {
        el.style.backgroundColor = "#1e1e24";
        el.style.border = "1px solid #444";
        el.style.borderRadius = "8px";
        header.style.backgroundColor = "#2a2a31";
        header.style.borderBottom = "1px solid #444";
        header.style.color = "#eee";
        header.style.fontSize = "12px";
        header.textContent = "Trigger";
        body.style.padding = "12px";
        body.style.display = "flex";
        body.style.alignItems = "center";
        body.style.justifyContent = "center";
        const button = document.createElement("button");
        button.textContent = "Fire!";
        Object.assign(button.style, {
          padding: "8px 16px",
          background: "#4a9eff",
          border: "none",
          borderRadius: "4px",
          color: "#fff",
          fontWeight: "bold",
          cursor: "pointer",
          pointerEvents: "auto",
          transition: "background 0.2s"
        });
        button.addEventListener("mousedown", (e) => {
          e.stopPropagation();
          button.style.background = "#2a7ede";
        });
        button.addEventListener("mouseup", () => {
          button.style.background = "#4a9eff";
        });
        button.addEventListener("click", (e) => {
          e.stopPropagation();
          node.state.triggered = true;
          console.log("[Trigger] Button clicked!");
          if (node.__runnerRef && node.__controllerRef) {
            console.log("[Trigger] Runner and controller found");
            const runner2 = node.__runnerRef;
            const controller2 = node.__controllerRef;
            const graph2 = controller2.graph;
            console.log("[Trigger] Calling runner.runOnce with node.id:", node.id);
            const result = runner2.runOnce(node.id, 0);
            const connectedEdges = result.connectedEdges;
            const startTime = performance.now();
            const animationDuration = 500;
            const animate = () => {
              var _a;
              const elapsed = performance.now() - startTime;
              if (elapsed < animationDuration) {
                controller2.renderer.draw(graph2, {
                  selection: controller2.selection,
                  tempEdge: null,
                  running: true,
                  time: performance.now(),
                  dt: 0,
                  activeEdges: connectedEdges
                  // Only animate connected edges
                });
                (_a = controller2.htmlOverlay) == null ? void 0 : _a.draw(graph2, controller2.selection);
                requestAnimationFrame(animate);
              } else {
                controller2.render();
                node.state.triggered = false;
              }
            };
            animate();
          }
        });
        body.appendChild(button);
      },
      update(node, el, { header, body, selected }) {
        el.style.borderColor = selected ? "#6cf" : "#444";
        header.style.backgroundColor = selected ? "#3a4a5a" : "#2a2a31";
      }
    },
    onCreate(node) {
      node.state.triggered = false;
    },
    onExecute(node, { setOutput }) {
      console.log("[Trigger] Outputting triggered:", node.state.triggered);
      setOutput("triggered", node.state.triggered);
    }
  });
  registry.register("core/Group", {
    title: "Group",
    size: { w: 240, h: 160 },
    onDraw(node, { ctx, theme: theme2 }) {
      const { x, y, w, h } = node.computed;
      const headerH = 24;
      const color = node.state.color || "#39424e";
      const bgAlpha = 0.5;
      const textColor = theme2.text || "#e9e9ef";
      const rgba = (hex, a) => {
        const c = hex.replace("#", "");
        const n = parseInt(
          c.length === 3 ? c.split("").map((x2) => x2 + x2).join("") : c,
          16
        );
        const r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
        return `rgba(${r},${g},${b},${a})`;
      };
      const roundRect2 = (ctx2, x2, y2, w2, h2, r) => {
        if (w2 < 2 * r) r = w2 / 2;
        if (h2 < 2 * r) r = h2 / 2;
        ctx2.beginPath();
        ctx2.moveTo(x2 + r, y2);
        ctx2.arcTo(x2 + w2, y2, x2 + w2, y2 + h2, r);
        ctx2.arcTo(x2 + w2, y2 + h2, x2, y2 + h2, r);
        ctx2.arcTo(x2, y2 + h2, x2, y2, r);
        ctx2.arcTo(x2, y2, x2 + w2, y2, r);
        ctx2.closePath();
      };
      ctx.fillStyle = rgba(color, bgAlpha);
      roundRect2(ctx, x, y, w, h, 10);
      ctx.fill();
      ctx.fillStyle = rgba(color, 0.3);
      ctx.beginPath();
      ctx.roundRect(x, y, w, headerH, [10, 10, 0, 0]);
      ctx.fill();
      ctx.fillStyle = textColor;
      ctx.font = "600 13px system-ui";
      ctx.textBaseline = "top";
      ctx.fillText(node.title, x + 12, y + 6);
    }
  });
  function setupDefaultContextMenu(contextMenu2, { controller: controller2, graph: graph2, hooks: hooks2 }) {
    const nodeTypes = [];
    for (const [key, typeDef] of graph2.registry.types.entries()) {
      nodeTypes.push({
        id: `add-${key}`,
        label: typeDef.title || key,
        action: () => {
          const worldPos = contextMenu2.worldPosition || { x: 100, y: 100 };
          const node = graph2.addNode(key, {
            x: worldPos.x,
            y: worldPos.y
          });
          hooks2 == null ? void 0 : hooks2.emit("node:updated", node);
          controller2.render();
        }
      });
    }
    contextMenu2.addItem("add-node", "Add Node", {
      condition: (target2) => !target2,
      submenu: nodeTypes,
      order: 5
    });
    contextMenu2.addItem("delete-node", "Delete Node", {
      condition: (target2) => target2 && target2.type !== "core/Group",
      action: (target2) => {
        const cmd = RemoveNodeCmd(graph2, target2);
        controller2.stack.exec(cmd);
        hooks2 == null ? void 0 : hooks2.emit("node:updated", target2);
      },
      order: 10
    });
    const colors = [
      { name: "Default", color: "#39424e" },
      { name: "Slate", color: "#4a5568" },
      { name: "Gray", color: "#2d3748" },
      { name: "Blue", color: "#1a365d" },
      { name: "Green", color: "#22543d" },
      { name: "Red", color: "#742a2a" },
      { name: "Purple", color: "#44337a" }
    ];
    contextMenu2.addItem("change-group-color", "Change Color", {
      condition: (target2) => target2 && target2.type === "core/Group",
      submenu: colors.map((colorInfo) => ({
        id: `color-${colorInfo.color}`,
        label: colorInfo.name,
        color: colorInfo.color,
        action: (target2) => {
          const currentColor = target2.state.color || "#39424e";
          const cmd = ChangeGroupColorCmd(target2, currentColor, colorInfo.color);
          controller2.stack.exec(cmd);
          hooks2 == null ? void 0 : hooks2.emit("node:updated", target2);
        }
      })),
      order: 20
    });
    contextMenu2.addItem("delete-group", "Delete Group", {
      condition: (target2) => target2 && target2.type === "core/Group",
      action: (target2) => {
        const cmd = RemoveNodeCmd(graph2, target2);
        controller2.stack.exec(cmd);
        hooks2 == null ? void 0 : hooks2.emit("node:updated", target2);
      },
      order: 20
    });
  }
  setupDefaultContextMenu(contextMenu, { controller, graph, hooks });
  renderer.resize(canvas.clientWidth, canvas.clientHeight);
  portRenderer.resize(canvas.clientWidth, canvas.clientHeight);
  controller.render();
  const ro = new ResizeObserver(() => {
    renderer.resize(canvas.clientWidth, canvas.clientHeight);
    portRenderer.resize(canvas.clientWidth, canvas.clientHeight);
    controller.render();
  });
  ro.observe(canvas);
  const originalRender = controller.render.bind(controller);
  controller.render = function() {
    originalRender();
    if (minimap) {
      minimap.render();
    }
  };
  const api = {
    addGroup: (args = {}) => {
      controller.graph.groupManager.addGroup(args);
      controller.render();
    },
    graph,
    renderer,
    controller,
    // Expose controller for snap-to-grid access
    runner,
    // Expose runner for trigger
    minimap,
    // Expose minimap
    contextMenu,
    hooks,
    // Expose hooks for event handling
    registry,
    // Expose registry for node types
    htmlOverlay,
    // Expose htmlOverlay for clearing/resetting
    propertyPanel,
    // Expose propertyPanel
    render: () => controller.render(),
    start: () => runner.start(),
    stop: () => runner.stop(),
    destroy: () => {
      runner.stop();
      ro.disconnect();
      controller.destroy();
      htmlOverlay.destroy();
      contextMenu.destroy();
      if (propertyPanel) propertyPanel.destroy();
      if (minimap) minimap.destroy();
    }
  };
  if (autorun) runner.start();
  return api;
}
export {
  createGraphEditor
};
//# sourceMappingURL=html-overlay-node.es.js.map
