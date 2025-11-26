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
   * @returns {Object} The created port
   */
  addInput(name, datatype = "any") {
    if (!name || typeof name !== "string") {
      throw new Error("Input port name must be a non-empty string");
    }
    const port = { id: randomUUID(), name, datatype, dir: "in" };
    this.inputs.push(port);
    return port;
  }
  /**
   * Add an output port to this node
   * @param {string} name - Port name
   * @param {string} [datatype="any"] - Data type for the port
   * @returns {Object} The created port
   */
  addOutput(name, datatype = "any") {
    if (!name || typeof name !== "string") {
      throw new Error("Output port name must be a non-empty string");
    }
    const port = { id: randomUUID(), name, datatype, dir: "out" };
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
    for (const i of def.inputs || []) node.addInput(i.name, i.datatype);
    for (const o of def.outputs || []) node.addOutput(o.name, o.datatype);
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
    this._nextBuf().set(`${nodeId}:${portId}`, value);
  }
  getInput(nodeId, portId) {
    for (const e of this.edges.values()) {
      if (e.toNode === nodeId && e.toPort === portId) {
        return this._curBuf().get(`${e.fromNode}:${e.fromPort}`);
      }
    }
    return void 0;
  }
  toJSON() {
    var _a;
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
        state: n.state
      })),
      edges: [...this.edges.values()]
    };
    (_a = this.hooks) == null ? void 0 : _a.emit("graph:serialize", json);
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
        height: nd.h
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
function portRect(node, port, idx, dir) {
  const { x: nx, y: ny, w: width } = node.computed || {
    x: node.pos.x,
    y: node.pos.y,
    w: node.size.width
  };
  const pad = 8, row = 20;
  const y = ny + 28 + idx * row;
  if (dir === "in") return { x: nx - pad, y, w: pad, h: 14 };
  if (dir === "out") return { x: nx + width, y, w: pad, h: 14 };
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
        bg: "#141417",
        grid: "#25252a",
        node: "#1e1e24",
        title: "#2a2a31",
        text: "#e9e9ef",
        port: "#8aa1ff",
        edge: "#7f8cff"
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
    ctx.strokeStyle = theme.grid;
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
    groups = null
  } = {}) {
    var _a, _b, _c, _d;
    graph.updateWorldTransforms();
    this.drawGrid();
    const { ctx, theme } = this;
    this._applyTransform();
    ctx.save();
    if (running) {
      const speed = 120;
      const phase = time / 1e3 * speed / this.scale % _CanvasRenderer.FONT_SIZE;
      ctx.setLineDash([6 / this.scale, 6 / this.scale]);
      ctx.lineDashOffset = -phase;
    } else {
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
    }
    for (const n of graph.nodes.values()) {
      if (n.type === "core/Group") {
        const sel = selection.has(n.id);
        const def = (_b = (_a = this.registry) == null ? void 0 : _a.types) == null ? void 0 : _b.get(n.type);
        if (def == null ? void 0 : def.onDraw) def.onDraw(n, { ctx, theme });
        else this._drawNode(n, sel);
      }
    }
    ctx.strokeStyle = theme.edge;
    ctx.lineWidth = 2 * this.scale;
    for (const e of graph.edges.values()) this._drawEdge(graph, e);
    if (tempEdge) {
      const a = this.screenToWorld(tempEdge.x1, tempEdge.y1);
      const b = this.screenToWorld(tempEdge.x2, tempEdge.y2);
      const prevDash = this.ctx.getLineDash();
      this.ctx.setLineDash([6 / this.scale, 6 / this.scale]);
      let ptsForArrow = null;
      if (this.edgeStyle === "line") {
        this._drawLine(a.x, a.y, b.x, b.y);
        ptsForArrow = [
          { x: a.x, y: a.y },
          { x: b.x, y: b.y }
        ];
      } else if (this.edgeStyle === "orthogonal") {
        ptsForArrow = this._drawOrthogonal(a.x, a.y, b.x, b.y);
      } else {
        this._drawCurve(a.x, a.y, b.x, b.y);
        ptsForArrow = [
          { x: a.x, y: a.y },
          { x: b.x, y: b.y }
        ];
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
    ctx.restore();
    for (const n of graph.nodes.values()) {
      if (n.type !== "core/Group") {
        const sel = selection.has(n.id);
        this._drawNode(n, sel);
        const def = (_d = (_c = this.registry) == null ? void 0 : _c.types) == null ? void 0 : _d.get(n.type);
        if (def == null ? void 0 : def.onDraw) def.onDraw(n, { ctx, theme });
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
  _drawNode(node, selected) {
    const { ctx, theme } = this;
    const r = 8;
    const { x, y, w, h } = node.computed;
    ctx.fillStyle = theme.node;
    ctx.strokeStyle = selected ? "#6cf" : "#333";
    ctx.lineWidth = (selected ? 2 : 1.2) / this.scale;
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = theme.title;
    roundRect(ctx, x, y, w, 24, { tl: r, tr: r, br: 0, bl: 0 });
    ctx.fill();
    this._drawScreenText(node.title, x + 8, y + _CanvasRenderer.FONT_SIZE, {
      fontPx: _CanvasRenderer.FONT_SIZE,
      color: theme.text,
      baseline: "middle",
      align: "left"
    });
    ctx.fillStyle = theme.port;
    node.inputs.forEach((p, i) => {
      const rct = portRect(node, p, i, "in");
      ctx.fillRect(rct.x, rct.y, rct.w, rct.h);
    });
    node.outputs.forEach((p, i) => {
      const rct = portRect(node, p, i, "out");
      ctx.fillRect(rct.x, rct.y, rct.w, rct.h);
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
function RemoveNodeCmd(graph, node) {
  let removedNode = null;
  let removedEdges = [];
  return {
    do() {
      removedNode = node;
      removedEdges = graph.edges ? [...graph.edges.values()].filter((e) => {
        console.log(e);
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
  constructor({ graph, renderer, hooks, htmlOverlay }) {
    this.graph = graph;
    this.renderer = renderer;
    this.hooks = hooks;
    this.htmlOverlay = htmlOverlay;
    this.stack = new CommandStack();
    this.selection = /* @__PURE__ */ new Set();
    this.dragging = null;
    this.connecting = null;
    this.panning = null;
    this.resizing = null;
    this.gDragging = null;
    this.gResizing = null;
    this._cursor = "default";
    this._onKeyPressEvt = this._onKeyPress.bind(this);
    this._onDownEvt = this._onDown.bind(this);
    this._onWheelEvt = this._onWheel.bind(this);
    this._onMoveEvt = this._onMove.bind(this);
    this._onUpEvt = this._onUp.bind(this);
    this._bindEvents();
  }
  destructor() {
    const c = this.renderer.canvas;
    c.removeEventListener("mousedown", this._onDownEvt);
    c.removeEventListener("wheel", this._onWheelEvt, { passive: false });
    window.removeEventListener("mousemove", this._onMoveEvt);
    window.removeEventListener("mouseup", this._onUpEvt);
    window.removeEventListener("keydown", this._onKeyPressEvt);
  }
  _bindEvents() {
    const c = this.renderer.canvas;
    c.addEventListener("mousedown", this._onDownEvt);
    c.addEventListener("wheel", this._onWheelEvt, { passive: false });
    window.addEventListener("mousemove", this._onMoveEvt);
    window.addEventListener("mouseup", this._onUpEvt);
    window.addEventListener("keydown", this._onKeyPressEvt);
  }
  _onKeyPress(e) {
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
        return n;
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
        startPos: { ...node.pos }
        // for undo
      };
      this.render();
      return;
    }
    if (e.button === 0) {
      if (this.selection.size) this.selection.clear();
      this.panning = { x: s.x, y: s.y };
      this.render();
      return;
    }
  }
  _onMove(e) {
    var _a, _b;
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
      const targetWx = w.x - this.dragging.offsetX;
      const targetWy = w.y - this.dragging.offsetY;
      let parentWx = 0;
      let parentWy = 0;
      if (n.parent) {
        parentWx = n.parent.computed.x;
        parentWy = n.parent.computed.y;
      }
      n.pos.x = targetWx - parentWx;
      n.pos.y = targetWy - parentWy;
      (_b = this.hooks) == null ? void 0 : _b.emit("node:move", n);
      this.render();
      return;
    }
    if (this.connecting) {
      this.connecting.x = s.x;
      this.connecting.y = s.y;
      this.render();
    }
    const node = this._findNodeAtWorld(w.x, w.y);
    if (node && this._hitResizeHandle(node, w.x, w.y)) {
      this._setCursor("se-resize");
    } else {
      this._setCursor("default");
    }
  }
  _onUp(e) {
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
      const potentialParent = this._findPotentialParent(w.x, w.y, n);
      if (potentialParent && potentialParent !== n.parent) {
        this.graph.reparent(n, potentialParent);
      } else if (!potentialParent && n.parent) {
        this.graph.reparent(n, null);
      }
      this.dragging = null;
      this.render();
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
  render() {
    var _a;
    const tEdge = this.renderTempEdge();
    this.renderer.draw(this.graph, {
      selection: this.selection,
      tempEdge: tEdge
    });
    (_a = this.htmlOverlay) == null ? void 0 : _a.draw(this.graph, this.selection);
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
      console.log(node);
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
  destroy() {
    for (const [, el] of this.nodes) el.remove();
    this.nodes.clear();
    this.container.remove();
  }
}
function createGraphEditor(canvas, { theme, hooks: customHooks, autorun = true } = {}) {
  const hooks = customHooks ?? createHooks([
    // essential hooks
    "node:create",
    "node:move",
    "edge:create",
    "edge:delete",
    "graph:serialize",
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
  const controller = new Controller({ graph, renderer, hooks, htmlOverlay });
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
        contentDiv.textContent = "Content: -- 인션이";
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
        body.appendChild(document.createTextNode("Content:"));
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
          overflowY: "auto",
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
  registry.register("core/Group", {
    title: "Group",
    size: { w: 240, h: 160 },
    onDraw(node, { ctx, theme: theme2 }) {
      const { x, y, w, h } = node.computed;
      const headerH = 22;
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
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x, y, w, headerH + 6, [10, 10, 0, 0]);
      ctx.fill();
      ctx.fillStyle = textColor;
      ctx.font = "12px system-ui";
      ctx.textBaseline = "middle";
      ctx.fillText(node.title, x + 10, y + headerH / 2);
    }
  });
  renderer.resize(canvas.clientWidth, canvas.clientHeight);
  controller.render();
  const ro = new ResizeObserver(() => {
    renderer.resize(canvas.clientWidth, canvas.clientHeight);
    controller.render();
  });
  ro.observe(canvas);
  const api = {
    addGroup: (args = {}) => {
      controller.graph.groupManager.addGroup(args);
      controller.render();
    },
    graph,
    renderer,
    render: () => controller.render(),
    start: () => runner.start(),
    stop: () => runner.stop(),
    destroy: () => {
      runner.stop();
      ro.disconnect();
      controller.destructor();
      htmlOverlay.destroy();
    }
  };
  if (autorun) runner.start();
  return api;
}
export {
  createGraphEditor
};
//# sourceMappingURL=free-node.es.js.map
