import { portRect } from "../render/hitTest.js";
import { AddEdgeCmd, MoveNodesCmd, RemoveEdgeCmd, RemoveNodeCmd, ResizeNodeCmd, ReparentCmd, CompoundCmd, ChangeEdgeRouteCmd, AddGroupCmd, RemoveGroupCmd, checkPortCompatibility } from "../core/commands.js";
import { CommandStack } from "../core/CommandStack.js";
import { Edge } from "../core/Edge.js";
import { deepClone } from "../utils/utils.js";
import { SearchPalette } from "../ui/SearchPalette.js";

export class Controller {
  static MIN_NODE_WIDTH = 80;
  static MIN_NODE_HEIGHT = 60;

  constructor({ graph, renderer, hooks, htmlOverlay, contextMenu, edgeRenderer, portRenderer }) {
    this.graph = graph;
    this.renderer = renderer;
    this.hooks = hooks;
    this.htmlOverlay = htmlOverlay;
    this.contextMenu = contextMenu;
    this.edgeRenderer = edgeRenderer;
    this.portRenderer = portRenderer;
    this.iconManager = null;   // set by createGraphEditor
    this.subNodePanel = null;  // set by createGraphEditor

    this.stack = new CommandStack();
    this._initCommands();
    this.selection = new Set();
    this.dragging = null; // { nodeId, dx, dy }
    this.connecting = null; // { fromNode, fromPort, x(screen), y(screen) }
    this.edgeHandleDrag = null; // { edgeId, handle }
    this.panning = null; // { x(screen), y(screen) }
    this.resizing = null;
    this.gDragging = null;
    this.gResizing = null;
    this.boxSelecting = null; // { startX, startY, currentX, currentY } - world coords

    // Edge / node animation state
    this.activeEdges = new Set();
    this.activeEdgeTimes = new Map(); // edge.id → activation timestamp
    this.activeNodes = new Set();     // node IDs currently executing

    // Clipboard for copy/paste
    this._clipboard = null;

    // Feature flags
    this.snapToGrid = true; // Snap nodes to grid (toggle with G key)
    this.gridSize = 20; // Grid size for snapping

    this._cursor = "default";

    /** When true, all graph mutations are blocked; only view interactions (pan/zoom) work. */
    this.readOnly = false;

    // Hover states
    this.hoveredNodeId = null;
    this.hoveredPort = null; // { node, port, dir, idx }
    this.slotLayout = "horizontal"; // "horizontal" or "vertical"

    /** Keyboard events are only processed when this canvas has mouse focus.
     *  Prevents conflicts when multiple Controller instances exist on the page. */
    this._focused = true;

    this._onKeyPressEvt = this._onKeyPress.bind(this);
    this._onDownEvt = this._onDown.bind(this);
    this._onWheelEvt = this._onWheel.bind(this);
    this._onMoveEvt = this._onMove.bind(this);
    this._onUpEvt = this._onUp.bind(this);
    this._onContextMenuEvt = this._onContextMenu.bind(this);
    this._onDblClickEvt = this._onDblClick.bind(this);
    this._onMouseLeaveEvt = () => {
      this._focused = false;
      let changed = false;
      if (this.hoveredNodeId !== null) {
        this.hoveredNodeId = null;
        changed = true;
      }
      if (this.hoveredPort !== null) {
        this.hoveredPort = null;
        changed = true;
      }
      if (changed) {
        this.render();
      }
    };

    this._bindEvents();

    // Listen for stepping updates from runner
    this.hooks.on("runner:step-updated", ({ activeNodeId, activeEdgeIds = [] }) => {
      this.activeNodes = activeNodeId ? new Set([activeNodeId]) : new Set();
      this.activeEdges = new Set(activeEdgeIds);
      this.activeEdgeTimes.clear(); // Clear previous times to ensure fresh animation
      const now = performance.now();
      for (const edgeId of activeEdgeIds) {
        this.activeEdgeTimes.set(edgeId, now);
      }
      this.render();
    });

    // Initialize Search Palette overlay
    const container = this.htmlOverlay ? this.htmlOverlay.host : this.renderer.canvas.parentElement;
    if (container) {
      this.searchPalette = new SearchPalette(container, {
        registry: this.graph.registry,
        onSelect: (type, wx, wy) => {
          this.addNode(type, { x: wx, y: wy });
        }
      });
    }
  }

  destroy() {
    const c = this.renderer.canvas;
    c.removeEventListener("mousedown", this._onDownEvt);
    c.removeEventListener("dblclick", this._onDblClickEvt);
    c.removeEventListener("wheel", this._onWheelEvt, { passive: false });
    c.removeEventListener("contextmenu", this._onContextMenuEvt);
    c.removeEventListener("mouseleave", this._onMouseLeaveEvt);
    window.removeEventListener("mousemove", this._onMoveEvt);
    window.removeEventListener("mouseup", this._onUpEvt);
    window.removeEventListener("keydown", this._onKeyPressEvt);
    if (this.searchPalette) {
      this.searchPalette.destroy();
    }
  }

  /**
   * HIGH-LEVEL API for Users/Developers
   * These methods handle Undo/Redo automatically.
   */

  addNode(type, options = {}) {
    const nodeData = {
      type,
      title: options.title || type.split("/").pop(),
      x: options.x || 0,
      y: options.y || 0,
      width: options.width,
      height: options.height,
      state: options.state || {},
    };

    let addedNode = null;
    const cmd = {
      do: () => {
        addedNode = this.graph.addNode(nodeData.type, nodeData);
        if (nodeData.state) addedNode.state = Object.assign({}, addedNode.state, JSON.parse(JSON.stringify(nodeData.state)));
        this.render();
      },
      undo: () => {
        if (addedNode) this.graph.removeNode(addedNode.id);
        this.render();
      }
    };
    this.stack.exec(cmd);
    return addedNode;
  }

  removeNode(nodeId) {
    const node = this.graph.getNodeById(nodeId);
    if (node) {
      this.stack.exec(RemoveNodeCmd(this.graph, node));
      this.render();
    }
  }

  addEdge(fromNode, fromPort, toNode, toPort) {
    this.stack.exec(AddEdgeCmd(this.graph, fromNode, fromPort, toNode, toPort));
    this.render();
  }

  /**
   * Update node state with automatic undo support
   */
  updateNodeState(nodeId, newState) {
    const node = this.graph.getNodeById(nodeId);
    if (!node) return;

    const prevState = JSON.parse(JSON.stringify(node.state));
    const nextState = JSON.parse(JSON.stringify(newState));

    this.stack.exec({
      do: () => {
        node.state = JSON.parse(JSON.stringify(nextState));
        this.hooks.emit("node:updated", node);
        this.render();
      },
      undo: () => {
        node.state = JSON.parse(JSON.stringify(prevState));
        this.hooks.emit("node:updated", node);
        this.render();
      }
    });
  }

  /**
   * Update a general node property (title, width, height, etc.) with undo support
   */
  updateNodeProperty(nodeId, prop, newValue) {
    const node = this.graph.getNodeById(nodeId);
    if (!node) return;

    let prevValue;
    if (prop === 'x' || prop === 'y') prevValue = node.pos[prop];
    else if (prop === 'width' || prop === 'height') prevValue = node.size[prop];
    else prevValue = node[prop];

    if (prevValue === newValue) return;

    this.stack.exec({
      do: () => {
        if (prop === 'x' || prop === 'y') node.pos[prop] = newValue;
        else if (prop === 'width' || prop === 'height') node.size[prop] = newValue;
        else node[prop] = newValue;
        
        if (prop === 'x' || prop === 'y') this.graph.updateWorldTransforms();
        this.hooks.emit("node:updated", node);
        this.render();
      },
      undo: () => {
        if (prop === 'x' || prop === 'y') node.pos[prop] = prevValue;
        else if (prop === 'width' || prop === 'height') node.size[prop] = prevValue;
        else node[prop] = prevValue;

        if (prop === 'x' || prop === 'y') this.graph.updateWorldTransforms();
        this.hooks.emit("node:updated", node);
        this.render();
      }
    });
  }

  undo() {
    this.stack.undo();
    this.render();
  }

  redo() {
    this.stack.redo();
    this.render();
  }

  _initCommands() {
    // Reserved for future internal command registration
  }

  _bindEvents() {
    const c = this.renderer.canvas;
    c.addEventListener("mousedown", this._onDownEvt);
    c.addEventListener("dblclick", this._onDblClickEvt);
    c.addEventListener("wheel", this._onWheelEvt, { passive: false });
    c.addEventListener("contextmenu", this._onContextMenuEvt);
    // Track mouse focus to avoid keyboard conflicts with other Controller instances
    c.addEventListener("mouseenter", () => { this._focused = true; });
    c.addEventListener("mouseleave", this._onMouseLeaveEvt);
    window.addEventListener("mousemove", this._onMoveEvt);
    window.addEventListener("mouseup", this._onUpEvt);
    window.addEventListener("keydown", this._onKeyPressEvt);
  }

  _onKeyPress(e) {
    this.isAlt = e.altKey;
    this.isShift = e.shiftKey;
    this.isCtrl = e.ctrlKey;

    // Only handle keyboard when this canvas has mouse focus
    if (!this._focused) return;

    // Skip canvas shortcuts if search palette is open
    if (this.searchPalette && this.searchPalette.isOpen()) {
      return;
    }

    const active = document.activeElement;
    const isInput = active && (
      active.tagName === "INPUT" ||
      active.tagName === "TEXTAREA" ||
      active.tagName === "SELECT" ||
      active.isContentEditable
    );
    if (isInput) return;

    // Show searchable node palette on Spacebar
    if (e.key === " " || e.key === "Spacebar") {
      if (this.readOnly) return;
      e.preventDefault();
      if (this.searchPalette) {
        const mousePos = this.getLastMousePos();
        const canvasRect = this.renderer.canvas.getBoundingClientRect();
        const clientX = mousePos.screen.x + canvasRect.left;
        const clientY = mousePos.screen.y + canvasRect.top;
        this.searchPalette.show(clientX, clientY, mousePos.world);
      }
      return;
    }

    // Toggle snap-to-grid with G key (allowed in read-only)
    if (e.key.toLowerCase() === "g" && !e.ctrlKey && !e.metaKey) {
      this.snapToGrid = !this.snapToGrid;
      this.render();
      return;
    }

    if (this.readOnly) return;

    // Group selected nodes: Ctrl/Cmd + G
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "g") {
      e.preventDefault();
      this._createGroupFromSelection();
      return;
    }

    // Select All: Ctrl/Cmd + A
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
      e.preventDefault();
      this.selection.clear();
      for (const node of this.graph.nodes.values()) {
        this.selection.add(node.id);
      }
      this.render();
      return;
    }

    // Copy: Ctrl/Cmd + C
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
      e.preventDefault();
      this._copySelection();
      return;
    }

    // Paste: Ctrl/Cmd + V
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
      e.preventDefault();
      this._pasteClipboard();
      return;
    }

    // Duplicate: Ctrl/Cmd + D
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
      e.preventDefault();
      this._copySelection();
      this._pasteClipboard();
      return;
    }

    // Undo: Ctrl/Cmd + Z  (Shift+Z → Redo)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) this.stack.redo();
      else this.stack.undo();
      this.render();
      return;
    }

    // Redo: Ctrl/Cmd + Y
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
      e.preventDefault();
      this.stack.redo();
      this.render();
      return;
    }

    // Zoom In: Ctrl/Cmd + Plus
    if ((e.ctrlKey || e.metaKey) && (e.key === "+" || e.key === "=")) {
      e.preventDefault();
      this.renderer.zoomAt(1.1, this.renderer.width / 2, this.renderer.height / 2);
      this.render();
      return;
    }

    // Zoom Out: Ctrl/Cmd + Minus
    if ((e.ctrlKey || e.metaKey) && (e.key === "-")) {
      e.preventDefault();
      this.renderer.zoomAt(0.9, this.renderer.width / 2, this.renderer.height / 2);
      this.render();
      return;
    }

    // Align nodes: A (horizontal), Shift+A (vertical) — only when no modifier
    if (e.key.toLowerCase() === "a" && !e.ctrlKey && !e.metaKey && this.selection.size > 1) {
      e.preventDefault();
      if (e.shiftKey) {
        this._alignNodesVertical();
      } else {
        this._alignNodesHorizontal();
      }
      return;
    }

    // Rank-based auto layout: Alt + H (horizontal), Alt + V (vertical)
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      const key = e.key.toLowerCase();
      if (key === "h") {
        e.preventDefault();
        this.arrangeRankLayout("horizontal");
        return;
      }
      if (key === "v") {
        e.preventDefault();
        this.arrangeRankLayout("vertical");
        return;
      }
    }

    // Fit to view: F
    if (e.key.toLowerCase() === "f" && !e.ctrlKey && !e.metaKey) {
      this.fitToView();
      return;
    }

    // Escape: Deselect all on Esc
    if (e.key === "Escape") {
      this.selection.clear();
      this.render();
      return;
    }

    // Tab / Shift+Tab: cycle through nodes (skip if a form element has focus)
    if (e.key === "Tab" && !e.ctrlKey && !e.metaKey) {
      const active = document.activeElement;
      if (active && active !== document.body && active.tagName !== "CANVAS") return;
      e.preventDefault();
      this.graph.updateWorldTransforms();
      const nodes = [...this.graph.nodes.values()].filter(n => n.type !== "core/Group");
      if (nodes.length === 0) return;
      const currentId = this.selection.size === 1 ? [...this.selection][0] : null;
      const currentIdx = currentId ? nodes.findIndex(n => n.id === currentId) : -1;
      const nextIdx = e.shiftKey
        ? (currentIdx <= 0 ? nodes.length - 1 : currentIdx - 1)
        : (currentIdx >= nodes.length - 1 ? 0 : currentIdx + 1);
      const next = nodes[nextIdx];
      this.selection.clear();
      this.selection.add(next.id);
      this._panToNode(next);
      this.render();
      return;
    }

    // Delete selected nodes
    if (e.key === "Delete" || e.key === "Backspace") {
      if (e.key === "Backspace" && document.activeElement !== document.body) return;
      this._deleteSelection();
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

  getLastMousePos() {
    if (this._lastMouseScreen && this._lastMouseWorld) {
      return { screen: this._lastMouseScreen, world: this._lastMouseWorld };
    }
    const canvas = this.renderer.canvas;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    return {
      screen: { x: cx, y: cy },
      world: this.renderer.screenToWorld(cx, cy)
    };
  }

  _findNodeAtWorld(x, y) {
    // Reverse order (top to bottom)
    const list = [...this.graph.nodes.values()].reverse();

    for (const n of list) {
      // Use computed world transform for hit testing
      const { x: nx, y: ny, w, h } = n.computed;
      if (x >= nx && x <= nx + w && y >= ny && y <= ny + h) {
        // If this is a group, check if any of its children are under the cursor
        if (n.type === "core/Group") {
          // Check all children of this group (recursively)
          const child = this._findChildNodeAtWorld(n, x, y);
          if (child) {
            return child; // Return the child instead of the group
          }
        }
        return n;
      }
    }
    return null;
  }

  _findChildNodeAtWorld(parentNode, x, y) {
    // Get all children of this parent
    const children = [];
    for (const node of this.graph.nodes.values()) {
      if (node.parent === parentNode) {
        children.push(node);
      }
    }

    // Check children in reverse order (top to bottom)
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i];
      const { x: nx, y: ny, w, h } = child.computed;

      if (x >= nx && x <= nx + w && y >= ny && y <= ny + h) {
        // If this child is also a group, recursively check its children
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
        const r = portRect(n, n.inputs[i], i, "in", this.slotLayout);
        if (rectHas(r, x, y)) return { node: n, port: n.inputs[i], dir: "in", idx: i };
      }
      for (let i = 0; i < n.outputs.length; i++) {
        const r = portRect(n, n.outputs[i], i, "out", this.slotLayout);
        if (rectHas(r, x, y)) return { node: n, port: n.outputs[i], dir: "out", idx: i };
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

  _findIconAtWorld(x, y) {
    for (const node of [...this.graph.nodes.values()].reverse()) {
      const rects = this.renderer.getNodeIconRects(node);
      for (const rect of rects) {
        if (Math.hypot(x - rect.cx, y - rect.cy) <= rect.r) {
          return { node, ...rect };
        }
      }
    }
    return null;
  }

  _handleIconClick({ node, name }) {
    // Custom onClick from IconManager
    if (this.iconManager) {
      const def = this.iconManager.get(name);
      if (def?.onClick) {
        def.onClick(node, this);
        return;
      }
    }
    // Built-in: 'expand' toggles sub-graph panel
    if (name === 'expand' && this.subNodePanel) {
      const subGraphData = node.state?.subGraphData ?? null;
      const breadcrumb = ['메인 그래프', node.title];
      this.subNodePanel.toggle(node, subGraphData, breadcrumb);
    }
  }

  _distanceToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
    const cx = ax + dx * t;
    const cy = ay + dy * t;
    return Math.hypot(px - cx, py - cy);
  }

  _findEdgeHandleAtWorld(x, y) {
    if (this.renderer.edgeStyle !== "orthogonal") return null;
    const threshold = 8 / this.renderer.scale;

    for (const [edgeId, edge] of Array.from(this.graph.edges.entries()).reverse()) {
      const endpoints = this.renderer._getEdgeEndpoints(this.graph, edge);
      if (!endpoints) continue;
      const { x1, y1, x2, y2 } = endpoints;
      const { fromX, splitX, toX, topY, bottomY } = this.renderer._getOrthogonalRouteValues(
        endpoints,
        edge.route || {}
      );
      const handles = [
        {
          handle: "fromX",
          cursor: "col-resize",
          a: { x: fromX, y: y1 },
          b: { x: fromX, y: topY },
        },
        {
          handle: "splitX",
          cursor: "col-resize",
          a: { x: splitX, y: topY },
          b: { x: splitX, y: bottomY },
        },
        {
          handle: "toX",
          cursor: "col-resize",
          a: { x: toX, y: bottomY },
          b: { x: toX, y: y2 },
        },
        {
          handle: "topY",
          cursor: "row-resize",
          a: { x: topY === y1 ? x1 : fromX, y: topY },
          b: { x: splitX, y: topY },
        },
        {
          handle: "bottomY",
          cursor: "row-resize",
          a: { x: splitX, y: bottomY },
          b: { x: bottomY === y2 ? x2 : toX, y: bottomY },
        },
      ];

      for (const candidate of handles) {
        if (this._distanceToSegment(x, y, candidate.a.x, candidate.a.y, candidate.b.x, candidate.b.y) <= threshold) {
          return { edgeId, handle: candidate.handle, cursor: candidate.cursor };
        }
      }
    }

    return null;
  }

  _onWheel(e) {
    e.preventDefault();
    const { x, y } = this._posScreen(e);
    const factor = Math.pow(1.0015, -e.deltaY); // smooth zoom
    this.renderer.zoomAt(factor, x, y);
    this.render();
  }

  _onContextMenu(e) {
    e.preventDefault();

    // Only show context menu if we have a contextMenu instance
    if (!this.contextMenu) return;

    const w = this._posWorld(e);
    const node = this._findNodeAtWorld(w.x, w.y);

    // Show menu with node or null (for canvas background) and world position
    this.contextMenu.show(node, e.clientX, e.clientY, w);
  }

  _onDblClick(e) {
    const w = this._posWorld(e);
    const node = this._findNodeAtWorld(w.x, w.y);

    if (node) {
      this.hooks?.emit("node:dblclick", node);
    } else {
      if (!this.readOnly && this.searchPalette) {
        this.searchPalette.show(e.clientX, e.clientY, w);
      }
    }
  }

  _resizeHandleRect(node) {
    const s = 10;
    const { x, y, w, h } = node.computed;
    return {
      x: x + w - s,
      y: y + h - s,
      w: s,
      h: s,
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

    // In read-only mode only allow panning (left-button drag on background)
    if (this.readOnly) {
      if (e.button === 0) {
        this.panning = { x: s.x, y: s.y };
      }
      return;
    }

    // 1. Resize Handle Hit Test (for all nodes including groups)
    const node = this._findNodeAtWorld(w.x, w.y);
    if (e.button === 0 && node && !node.locked && this._hitResizeHandle(node, w.x, w.y)) {
      this.resizing = {
        nodeId: node.id,
        startW: node.size.width,
        startH: node.size.height,
        startX: w.x,
        startY: w.y,
      };
      if (!e.shiftKey) this.selection.clear();
      this.selection.add(node.id);
      this._setCursor("se-resize");
      this.render();
      return;
    }

    // 2. Port Hit Test
    const port = this._findPortAtWorld(w.x, w.y);

    // Handle input port click
    if (e.button === 0 && port && port.dir === "in") {
      const incoming = this._findIncomingEdge(port.node.id, port.port.id);
      if (incoming) {
        // Occupied input: disconnect and pick up from the output end
        const { fromNode, fromPort } = incoming.edge;
        this.stack.exec(RemoveEdgeCmd(this.graph, incoming.id));
        const fromNodeObj = this.graph.nodes.get(fromNode);
        if (fromNodeObj) {
          const iOut = fromNodeObj.outputs.findIndex(p => p.id === fromPort);
          if (iOut >= 0) {
            this.connecting = { fromNode, fromPort, x: s.x, y: s.y };
          }
        }
        this.render();
        return;
      } else {
        // Empty input: start reverse drag toward an output port
        this.connecting = {
          toNode: port.node.id,
          toPort: port.port.id,
          dir: "reverse",
          x: s.x,
          y: s.y,
        };
        return;
      }
    }

    // Handle output port click - start new connection
    if (e.button === 0 && port && port.dir === "out") {
      const outR = portRect(port.node, port.port, port.idx, "out", this.slotLayout);
      const screenFrom = this.renderer.worldToScreen(outR.x, outR.y + 7);
      this.connecting = {
        fromNode: port.node.id,
        fromPort: port.port.id,
        x: screenFrom.x,
        y: screenFrom.y,
      };
      return;
    }

    const edgeHandle = this._findEdgeHandleAtWorld(w.x, w.y);
    if (e.button === 0 && edgeHandle) {
      const edge = this.graph.edges.get(edgeHandle.edgeId);
      this.edgeHandleDrag = {
        ...edgeHandle,
        initialRoute: edge ? JSON.parse(JSON.stringify(edge.route || {})) : {},
        grabWorldX: w.x,
      };
      this._setCursor(edgeHandle.cursor);
      this.render();
      return;
    }

    // 3. Icon click (header icon area — before node drag)
    if (e.button === 0) {
      const iconHit = this._findIconAtWorld(w.x, w.y);
      if (iconHit) {
        this._handleIconClick(iconHit);
        return;
      }
    }

    // 4. Node Hit Test (Selection & Drag)
    if (e.button === 0 && node) {
      if (!e.shiftKey) this.selection.clear();
      this.selection.add(node.id);

      if (node.locked) {
        this.render();
        return;
      }

      // Dragging: store initial world pos difference for all selected nodes
      this.dragging = {
        nodeId: node.id,
        offsetX: w.x - node.computed.x,
        offsetY: w.y - node.computed.y,
        startPos: { ...node.pos }, // for undo
        selectedNodes: [], // Store all selected nodes and their initial positions
      };

      // Store positions of all selected nodes
      for (const selectedId of this.selection) {
        const selectedNode = this.graph.nodes.get(selectedId);
        if (selectedNode) {
          if (this._selectionHasAncestor(selectedNode)) continue;
          this.dragging.selectedNodes.push({
            node: selectedNode,
            startWorldX: selectedNode.computed.x,
            startWorldY: selectedNode.computed.y,
            startLocalX: selectedNode.pos.x,
            startLocalY: selectedNode.pos.y,
          });
        }
      }

      // Collect all nodes that will actually move (selected + all descendants)
      const allMovingIds = new Set();
      for (const { node: sn } of this.dragging.selectedNodes) {
        allMovingIds.add(sn.id);
        this._collectDescendants(sn, allMovingIds);
      }
      this.dragging.allMovingIds = allMovingIds;

      // Capture initial routes for edges where at least one endpoint will move
      this.dragging.initialEdgeRoutes = new Map();
      for (const [edgeId, edge] of this.graph.edges) {
        if (!edge.route || !Object.keys(edge.route).length) continue;
        if (allMovingIds.has(edge.fromNode) || allMovingIds.has(edge.toNode)) {
          this.dragging.initialEdgeRoutes.set(edgeId, { ...edge.route });
        }
      }

      // If dragging a group, store children's world positions
      if (node.type === "core/Group") {
        this.dragging.childrenWorldPos = [];
        for (const child of this.graph.nodes.values()) {
          if (child.parent === node) {
            this.dragging.childrenWorldPos.push({
              node: child,
              worldX: child.computed.x,
              worldY: child.computed.y,
            });
          }
        }
      }

      this.render();
      return;
    }

    // 4. Background Click (Pan or Box Selection)
    if (e.button === 0) {
      if (this.selection.size) this.selection.clear();

      // Start box selection if Ctrl is held
      if (e.ctrlKey || e.metaKey) {
        this.boxSelecting = {
          startX: w.x,
          startY: w.y,
          currentX: w.x,
          currentY: w.y,
        };
      } else {
        this.panning = { x: s.x, y: s.y };
      }
      this.render();
      return;
    }
  }

  _onMove(e) {
    // Track key states
    this.isAlt = e.altKey;
    this.isShift = e.shiftKey;
    this.isCtrl = e.ctrlKey;

    const s = this._posScreen(e);
    const w = this.renderer.screenToWorld(s.x, s.y);

    this._lastMouseScreen = s;
    this._lastMouseWorld = w;

    if (this.resizing) {
      const n = this.graph.nodes.get(this.resizing.nodeId);
      const dx = w.x - this.resizing.startX;
      const dy = w.y - this.resizing.startY;

      const minW = Controller.MIN_NODE_WIDTH;
      // Minimum height must fit all port rows
      const maxPorts = Math.max(n.inputs.length, n.outputs.length);
      const minH = maxPorts > 0
        ? Math.max(Controller.MIN_NODE_HEIGHT, 42 + maxPorts * 20)
        : Controller.MIN_NODE_HEIGHT;
      n.size.width = Math.max(minW, this.resizing.startW + dx);
      n.size.height = Math.max(minH, this.resizing.startH + dy);

      this.hooks?.emit("node:resize", n);
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

    if (this.edgeHandleDrag) {
      const edge = this.graph.edges.get(this.edgeHandleDrag.edgeId);
      if (edge) {
        edge.route = edge.route || {};
        let targetX = this.snapToGrid ? this._snapToGrid(w.x) : w.x;
        let targetY = this.snapToGrid ? this._snapToGrid(w.y) : w.y;
        const endpoints = this.renderer._getEdgeEndpoints(this.graph, edge);
        const currentRoute = endpoints
          ? this.renderer._getOrthogonalRouteValues(endpoints, edge.route)
          : null;
        if (this.edgeHandleDrag.handle === "fromX") {
          if (currentRoute) {
            edge.route.fromX = targetX;
            const normalized = this.renderer._getOrthogonalRouteValues(endpoints, edge.route);
            edge.route.fromX = normalized.fromX;
          } else {
            edge.route.fromX = targetX;
          }
          delete edge.route.splitX1;
          this._setCursor("col-resize");
        } else if (this.edgeHandleDrag.handle === "splitX") {
          if (currentRoute) {
            edge.route.splitX = targetX;
            const normalized = this.renderer._getOrthogonalRouteValues(endpoints, edge.route);
            edge.route.splitX = normalized.splitX;
          } else {
            edge.route.splitX = targetX;
          }
          delete edge.route.splitX1;
          delete edge.route.splitX2;
          this._setCursor("col-resize");
        } else if (this.edgeHandleDrag.handle === "toX") {
          if (currentRoute) {
            edge.route.toX = targetX;
            const normalized = this.renderer._getOrthogonalRouteValues(endpoints, edge.route);
            edge.route.toX = normalized.toX;
          } else {
            edge.route.toX = targetX;
          }
          delete edge.route.splitX2;
          this._setCursor("col-resize");
        } else if (this.edgeHandleDrag.handle === "topY") {
          if (endpoints) {
            const initVals = this.renderer._getOrthogonalRouteValues(endpoints, this.edgeHandleDrag.initialRoute);
            const dir = endpoints.x2 >= endpoints.x1 ? 1 : -1;
            const inExitArm = dir > 0
              ? this.edgeHandleDrag.grabWorldX < initVals.fromX
              : this.edgeHandleDrag.grabWorldX > initVals.fromX;
            if (inExitArm) edge.route.fromX = endpoints.x1;
          }
          edge.route.topY = targetY;
          delete edge.route.splitY;
          this._setCursor("row-resize");
        } else if (this.edgeHandleDrag.handle === "bottomY") {
          if (endpoints) {
            const initVals = this.renderer._getOrthogonalRouteValues(endpoints, this.edgeHandleDrag.initialRoute);
            const dir = endpoints.x2 >= endpoints.x1 ? 1 : -1;
            const inEntryArm = dir > 0
              ? this.edgeHandleDrag.grabWorldX > initVals.toX
              : this.edgeHandleDrag.grabWorldX < initVals.toX;
            if (inEntryArm) edge.route.toX = endpoints.x2;
          }
          edge.route.bottomY = targetY;
          delete edge.route.splitY;
          this._setCursor("row-resize");
        }
        this.render();
      }
      return;
    }

    if (this.dragging) {
      const n = this.graph.nodes.get(this.dragging.nodeId);

      // Calculate delta for main node
      const primaryInfo = this.dragging.selectedNodes.find((sn) => sn.node.id === n.id);
      let targetWx = w.x - this.dragging.offsetX;
      // Shift: lock to horizontal movement only
      let targetWy = this.isShift ? primaryInfo.startWorldY : w.y - this.dragging.offsetY;

      // Apply snap-to-grid if enabled
      if (this.snapToGrid) {
        targetWx = this._snapToGrid(targetWx);
        targetWy = this._snapToGrid(targetWy);
      }

      // Apply alignment guidelines and snapping
      let snapX = null;
      let snapY = null;
      const guidesH = []; // Y coordinates
      const guidesV = []; // X coordinates

      const threshold = 8; // snap threshold in world space

      const myLeft = targetWx;
      const myCenterX = targetWx + n.size.width / 2;
      const myRight = targetWx + n.size.width;
      const myTop = targetWy;
      const myCenterY = targetWy + n.size.height / 2;
      const myBottom = targetWy + n.size.height;

      const movingNodes = new Set(this.dragging.selectedNodes.map((sn) => sn.node.id));

      for (const other of this.graph.nodes.values()) {
        if (movingNodes.has(other.id)) continue;
        if (other.type === "core/Group") continue; // skip group nodes for alignment
        if (other.parent !== n.parent) continue; // align within same group/root context

        const oLeft = other.computed.x;
        const oCenterX = other.computed.x + other.size.width / 2;
        const oRight = other.computed.x + other.size.width;
        const oTop = other.computed.y;
        const oCenterY = other.computed.y + other.size.height / 2;
        const oBottom = other.computed.y + other.size.height;

        // X alignments (Vertical guidelines)
        if (snapX === null) {
          if (Math.abs(myLeft - oLeft) < threshold) {
            snapX = oLeft;
            guidesV.push(oLeft);
          } else if (Math.abs(myCenterX - oCenterX) < threshold) {
            snapX = oCenterX - n.size.width / 2;
            guidesV.push(oCenterX);
          } else if (Math.abs(myRight - oRight) < threshold) {
            snapX = oRight - n.size.width;
            guidesV.push(oRight);
          } else if (Math.abs(myLeft - oRight) < threshold) {
            snapX = oRight;
            guidesV.push(oRight);
          } else if (Math.abs(myRight - oLeft) < threshold) {
            snapX = oLeft - n.size.width;
            guidesV.push(oLeft);
          }
        }

        // Y alignments (Horizontal guidelines)
        if (snapY === null) {
          if (Math.abs(myTop - oTop) < threshold) {
            snapY = oTop;
            guidesH.push(oTop);
          } else if (Math.abs(myCenterY - oCenterY) < threshold) {
            snapY = oCenterY - n.size.height / 2;
            guidesH.push(oCenterY);
          } else if (Math.abs(myBottom - oBottom) < threshold) {
            snapY = oBottom - n.size.height;
            guidesH.push(oBottom);
          } else if (Math.abs(myTop - oBottom) < threshold) {
            snapY = oBottom;
            guidesH.push(oBottom);
          } else if (Math.abs(myBottom - oTop) < threshold) {
            snapY = oTop - n.size.height;
            guidesH.push(oTop);
          }
        }
      }

      if (snapX !== null) targetWx = snapX;
      if (snapY !== null) targetWy = snapY;

      this.alignmentGuides = { h: guidesH, v: guidesV };

      // Calculate delta from original position
      const deltaX = targetWx - primaryInfo.startWorldX;
      const deltaY = targetWy - primaryInfo.startWorldY;

      // Update world transforms
      this.graph.updateWorldTransforms();

      // Move all selected nodes by the same delta
      for (const { node: selectedNode, startWorldX, startWorldY } of this.dragging.selectedNodes) {
        // Skip group nodes when shift-dragging (vertical only)
        if (this.isShift && selectedNode.type === "core/Group") {
          continue;
        }

        const newWorldX = startWorldX + deltaX;
        const newWorldY = startWorldY + deltaY;

        // Convert to local position
        let parentWx = 0;
        let parentWy = 0;
        if (selectedNode.parent) {
          parentWx = selectedNode.parent.computed.x;
          parentWy = selectedNode.parent.computed.y;
        }

        selectedNode.pos.x = newWorldX - parentWx;
        selectedNode.pos.y = newWorldY - parentWy;
      }

      // Update edge routes to match node movement
      if (this.dragging.allMovingIds && this.dragging.initialEdgeRoutes) {
        for (const [edgeId, initRoute] of this.dragging.initialEdgeRoutes) {
          const edge = this.graph.edges.get(edgeId);
          if (!edge) continue;
          edge.route = edge.route || {};
          const fromMoved = this.dragging.allMovingIds.has(edge.fromNode);
          const toMoved = this.dragging.allMovingIds.has(edge.toNode);
          if (fromMoved && toMoved) {
            if (Number.isFinite(initRoute.fromX)) edge.route.fromX = initRoute.fromX + deltaX;
            if (Number.isFinite(initRoute.splitX)) edge.route.splitX = initRoute.splitX + deltaX;
            if (Number.isFinite(initRoute.toX)) edge.route.toX = initRoute.toX + deltaX;
            if (Number.isFinite(initRoute.topY)) edge.route.topY = initRoute.topY + deltaY;
            if (Number.isFinite(initRoute.bottomY)) edge.route.bottomY = initRoute.bottomY + deltaY;
            if (Number.isFinite(initRoute.splitY)) edge.route.splitY = initRoute.splitY + deltaY;
          } else if (fromMoved) {
            if (Number.isFinite(initRoute.fromX)) edge.route.fromX = initRoute.fromX + deltaX;
            if (Number.isFinite(initRoute.topY)) edge.route.topY = initRoute.topY + deltaY;
          } else if (toMoved) {
            if (Number.isFinite(initRoute.toX)) edge.route.toX = initRoute.toX + deltaX;
            if (Number.isFinite(initRoute.bottomY)) edge.route.bottomY = initRoute.bottomY + deltaY;
          }
        }
      }

      // If Alt is held and dragging a group, restore children to original world positions
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

      this.hooks?.emit("node:move", n);
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

      const snappedPort = this._findPortAtWorld(w.x, w.y);
      if (this.connecting.dir === "reverse") {
        // Reverse drag: snap to output ports
        if (snappedPort && snappedPort.dir === "out") {
          const outR = portRect(snappedPort.node, snappedPort.port, snappedPort.idx, "out", this.slotLayout);
          const sc = this.renderer.worldToScreen(outR.x + outR.w / 2, outR.y + outR.h / 2);
          this.connecting.snappedX = sc.x;
          this.connecting.snappedY = sc.y;
          const compat = checkPortCompatibility(this.graph, snappedPort.node.id, snappedPort.port.id, this.connecting.toNode, this.connecting.toPort);
          this.connecting.incompatible = !compat.ok;
        } else {
          this.connecting.snappedX = null;
          this.connecting.snappedY = null;
          this.connecting.incompatible = false;
        }
      } else {
        // Normal drag: snap to input ports
        if (snappedPort && snappedPort.dir === "in") {
          const inR = portRect(snappedPort.node, snappedPort.port, snappedPort.idx, "in", this.slotLayout);
          const sc = this.renderer.worldToScreen(inR.x + inR.w / 2, inR.y + inR.h / 2);
          this.connecting.snappedX = sc.x;
          this.connecting.snappedY = sc.y;
          const compat = checkPortCompatibility(this.graph, this.connecting.fromNode, this.connecting.fromPort, snappedPort.node.id, snappedPort.port.id);
          this.connecting.incompatible = !compat.ok;
        } else {
          this.connecting.snappedX = null;
          this.connecting.snappedY = null;
          this.connecting.incompatible = false;
        }
      }

      this.render();
    }

    // Cursor update
    const port = this._findPortAtWorld(w.x, w.y);
    const node = this._findNodeAtWorld(w.x, w.y);
    const edgeHandle = this._findEdgeHandleAtWorld(w.x, w.y);

    if (node && this._hitResizeHandle(node, w.x, w.y)) {
      this._setCursor("se-resize");
    } else if (port) {
      // Show pointer cursor over ports (for connecting/disconnecting)
      this._setCursor("pointer");
    } else if (edgeHandle) {
      this._setCursor(edgeHandle.cursor);
    } else {
      this._setCursor("default");
    }

    // Hover tracking
    const hoveredNode = node || (port ? port.node : null);
    const hoveredNodeId = hoveredNode ? hoveredNode.id : null;
    const hoveredPort = port;

    let hoverChanged = false;
    if (this.hoveredNodeId !== hoveredNodeId) {
      this.hoveredNodeId = hoveredNodeId;
      hoverChanged = true;
    }
    if ((this.hoveredPort?.port?.id) !== (hoveredPort?.port?.id)) {
      this.hoveredPort = hoveredPort;
      hoverChanged = true;
    }

    if (hoverChanged) {
      this.render();
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

    if (this.edgeHandleDrag) {
      const edge = this.graph.edges.get(this.edgeHandleDrag.edgeId);
      if (edge) {
        this.stack.exec(ChangeEdgeRouteCmd(
          this.graph,
          this.edgeHandleDrag.edgeId,
          this.edgeHandleDrag.initialRoute,
          edge.route
        ));
      }
      this.edgeHandleDrag = null;
      this._setCursor("default");
      this.render();
      return;
    }

    if (this.connecting) {
      const from = this.connecting;
      if (from.dir === "reverse") {
        // Dragging from input: find output port at release position
        const portOut = this._findPortAtWorld(w.x, w.y);
        if (portOut && portOut.dir === "out") {
          this.stack.exec(
            AddEdgeCmd(this.graph, portOut.node.id, portOut.port.id, from.toNode, from.toPort)
          );
        }
      } else {
        // Normal: dragging from output to input
        const portIn = this._findPortAtWorld(w.x, w.y);
        if (portIn && portIn.dir === "in") {
          this.stack.exec(
            AddEdgeCmd(this.graph, from.fromNode, from.fromPort, portIn.node.id, portIn.port.id)
          );
        }
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

      // 1. Record movement in history
      const movedNodesInfo = [];
      for (const info of this.dragging.selectedNodes) {
        const fromPos = { x: info.startLocalX, y: info.startLocalY };
        const toPos = { x: info.node.pos.x, y: info.node.pos.y };
        if (fromPos.x !== toPos.x || fromPos.y !== toPos.y) {
          movedNodesInfo.push({ node: info.node, fromPos, toPos });
        }
      }
      // Collect edge route changes for undo
      const routeCmds = [];
      if (this.dragging.initialEdgeRoutes) {
        for (const [edgeId, initRoute] of this.dragging.initialEdgeRoutes) {
          const edge = this.graph.edges.get(edgeId);
          if (!edge || !edge.route) continue;
          const finalRoute = { ...edge.route };
          const changed = Object.keys(initRoute).some(k => finalRoute[k] !== initRoute[k])
            || Object.keys(finalRoute).some(k => finalRoute[k] !== initRoute[k]);
          if (changed) {
            routeCmds.push(ChangeEdgeRouteCmd(this.graph, edgeId, initRoute, finalRoute));
          }
        }
      }

      const allCmds = [];
      if (movedNodesInfo.length > 0) allCmds.push(MoveNodesCmd(movedNodesInfo));
      allCmds.push(...routeCmds);
      if (allCmds.length === 1) {
        this.stack.exec(allCmds[0]);
      } else if (allCmds.length > 1) {
        this.stack.exec(CompoundCmd(allCmds));
      }

      // 2. Post-drag logic (reparenting, etc.)
      // If we're dragging a GROUP with Alt, only move the group (keep children in place)
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
        this.graph.updateWorldTransforms();
        const nodeCenterX = n.computed.x + n.computed.w / 2;
        const nodeCenterY = n.computed.y + n.computed.h / 2;
        const potentialParent = this._findPotentialParent(nodeCenterX, nodeCenterY, n);

        if (potentialParent && potentialParent !== n.parent) {
          this.stack.exec(ReparentCmd(this.graph, n, n.parent, potentialParent));
        } else if (!potentialParent && n.parent) {
          this.stack.exec(ReparentCmd(this.graph, n, n.parent, null));
        }
      }

      this.dragging = null;
      this.alignmentGuides = null;
      this.render();
    }

    if (this.boxSelecting) {
      const { startX, startY, currentX, currentY } = this.boxSelecting;
      const minX = Math.min(startX, currentX);
      const maxX = Math.max(startX, currentX);
      const minY = Math.min(startY, currentY);
      const maxY = Math.max(startY, currentY);

      for (const node of this.graph.nodes.values()) {
        const { x, y, w, h } = node.computed;
        if (x + w >= minX && x <= maxX && y + h >= minY && y <= maxY) {
          this.selection.add(node.id);
        }
      }
      this.boxSelecting = null;
      this.render();
    }
  }

  _autoParentNodesInGroup(groupNode) {
    const { x: gx, y: gy, w: gw, h: gh } = groupNode.computed;
    for (const node of this.graph.nodes.values()) {
      if (node === groupNode) continue;
      if (node.parent === groupNode) continue;
      if (node.type === "core/Group") continue;
      if (node.parent && node.parent !== groupNode) continue;

      const { x: nx, y: ny, w: nw, h: nh } = node.computed;
      const nodeCenterX = nx + nw / 2;
      const nodeCenterY = ny + nh / 2;

      if (nodeCenterX >= gx && nodeCenterX <= gx + gw && nodeCenterY >= gy && nodeCenterY <= gy + gh) {
        this.graph.reparent(node, groupNode);
      }
    }
  }

  fitToView({ padding = 80, maxScale = 2 } = {}) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasNodes = false;
    this.graph.updateWorldTransforms();
    for (const n of this.graph.nodes.values()) {
      const { x, y, w, h } = n.computed;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
      hasNodes = true;
    }
    if (!hasNodes) return;

    const rW = this.renderer.width;
    const rH = this.renderer.height;
    const contentW = maxX - minX + padding * 2;
    const contentH = maxY - minY + padding * 2;
    const scale = Math.min(rW / contentW, rH / contentH, maxScale);
    const offsetX = (rW - (maxX - minX) * scale) / 2 - minX * scale;
    const offsetY = (rH - (maxY - minY) * scale) / 2 - minY * scale;

    this.renderer.setTransform({ scale, offsetX, offsetY });
    this.render();
  }

  /**
   * Enterprise Feature: Auto Layout (Simple Grid)
   */
  autoLayout() {
    const nodes = [...this.graph.nodes.values()].filter(n => n.type !== "core/Group");
    if (nodes.length === 0) return;

    const cols = Math.ceil(Math.sqrt(nodes.length));
    const spacingX = 250;
    const spacingY = 150;

    const movedNodes = [];
    nodes.forEach((node, i) => {
      const fromPos = { ...node.pos };
      const toPos = {
        x: (i % cols) * spacingX,
        y: Math.floor(i / cols) * spacingY
      };
      movedNodes.push({ node, fromPos, toPos });
    });

    this.stack.exec(MoveNodesCmd(movedNodes));
    this.graph.updateWorldTransforms();
    this.fitToView();
    this.render();
  }

  _deleteSelection() {
    const toDelete = [...this.selection];
    if (toDelete.length === 0) return;
    const cmds = [];
    for (const nodeId of toDelete) {
      const nodeObj = this.graph.getNodeById(nodeId);
      if (nodeObj && !nodeObj.locked) {
        cmds.push(nodeObj.type === "core/Group"
          ? RemoveGroupCmd(this.graph.groupManager, nodeObj)
          : RemoveNodeCmd(this.graph, nodeObj));
      }
    }
    if (cmds.length > 0) {
      this.stack.exec(CompoundCmd(cmds));
      this.selection.clear();
      this.render();
    }
  }

  _panToNode(node) {
    const { x, y, w, h } = node.computed;
    const scale = this.renderer.scale;
    this.renderer.setTransform({
      scale,
      offsetX: this.renderer.width  / 2 - (x + w / 2) * scale,
      offsetY: this.renderer.height / 2 - (y + h / 2) * scale,
    });
  }

  _copySelection() {
    if (this.selection.size === 0) return;
    this.graph.updateWorldTransforms();
    const selectedIds = new Set(this.selection);
    const nodes = [];
    for (const id of selectedIds) {
      const node = this.graph.nodes.get(id);
      if (!node) continue;
      nodes.push({
        originalId: node.id,
        type: node.type,
        title: node.title,
        x: node.computed.x,
        y: node.computed.y,
        w: node.size.width,
        h: node.size.height,
        inputs: deepClone(node.inputs),
        outputs: deepClone(node.outputs),
        state: deepClone(node.state),
        parentId: node.parent && selectedIds.has(node.parent.id) ? node.parent.id : null,
        locked: !!node.locked,
        description: node.description || "",
      });
    }

    const edges = [...this.graph.edges.values()]
      .filter((edge) => selectedIds.has(edge.fromNode) && selectedIds.has(edge.toNode))
      .map((edge) => ({
        id: edge.id,
        fromNode: edge.fromNode,
        fromPort: edge.fromPort,
        toNode: edge.toNode,
        toPort: edge.toPort,
        route: deepClone(edge.route),
        label: edge.label ?? null,
      }));

    this._clipboard = { nodes, edges };
  }

  _pasteClipboard() {
    if (!this._clipboard?.nodes?.length) return;
    const offset = 24;
    this.selection.clear();
    const clipboard = deepClone(this._clipboard);
    const graph = this.graph;
    const selection = this.selection;
    const command = {
      nodeSnapshots: null,
      edgeSnapshots: null,
      do() {
        if (!this.nodeSnapshots || !this.edgeSnapshots) {
          const nodeIdMap = new Map();
          this.nodeSnapshots = [];
          this.edgeSnapshots = [];

          for (const data of clipboard.nodes) {
            const createdNode = graph.addNode(data.type, {
              title: data.title,
              x: data.x + offset,
              y: data.y + offset,
              width: data.w,
              height: data.h,
            });
            createdNode.inputs = deepClone(data.inputs);
            createdNode.outputs = deepClone(data.outputs);
            createdNode.state = deepClone(data.state);
            createdNode.locked = !!data.locked;
            createdNode.description = data.description || "";
            nodeIdMap.set(data.originalId, createdNode.id);
            this.nodeSnapshots.push({
              id: createdNode.id,
              type: data.type,
              title: data.title,
              x: data.x + offset,
              y: data.y + offset,
              w: data.w,
              h: data.h,
              inputs: deepClone(data.inputs),
              outputs: deepClone(data.outputs),
              state: deepClone(data.state),
              parentId: data.parentId ? nodeIdMap.get(data.parentId) || null : null,
              locked: !!data.locked,
              description: data.description || "",
            });
          }

          for (const snapshot of this.nodeSnapshots) {
            if (!snapshot.parentId) continue;
            const node = graph.nodes.get(snapshot.id);
            const parent = graph.nodes.get(snapshot.parentId);
            if (node && parent) graph.reparent(node, parent);
          }

          for (const edgeData of clipboard.edges) {
            const edge = graph.addEdge(
              nodeIdMap.get(edgeData.fromNode),
              edgeData.fromPort,
              nodeIdMap.get(edgeData.toNode),
              edgeData.toPort
            );
            edge.route = deepClone(edgeData.route);
            edge.label = edgeData.label ?? null;
            this.edgeSnapshots.push({
              id: edge.id,
              fromNode: edge.fromNode,
              fromPort: edge.fromPort,
              toNode: edge.toNode,
              toPort: edge.toPort,
              route: deepClone(edge.route),
              label: edge.label,
            });
          }
        } else {
          for (const snapshot of this.nodeSnapshots) {
            const node = graph.addNode(snapshot.type, {
              id: snapshot.id,
              title: snapshot.title,
              x: snapshot.x,
              y: snapshot.y,
              width: snapshot.w,
              height: snapshot.h,
            });
            node.inputs = deepClone(snapshot.inputs);
            node.outputs = deepClone(snapshot.outputs);
            node.state = deepClone(snapshot.state);
            node.locked = !!snapshot.locked;
            node.description = snapshot.description || "";
          }

          for (const snapshot of this.nodeSnapshots) {
            if (!snapshot.parentId) continue;
            const node = graph.nodes.get(snapshot.id);
            const parent = graph.nodes.get(snapshot.parentId);
            if (node && parent) graph.reparent(node, parent);
          }

          for (const snapshot of this.edgeSnapshots) {
            graph.edges.set(snapshot.id, new Edge({
              ...snapshot,
              route: deepClone(snapshot.route),
            }));
          }
        }

        selection.clear();
        for (const snapshot of this.nodeSnapshots) {
          selection.add(snapshot.id);
        }
      },
      undo() {
        for (const edge of this.edgeSnapshots || []) {
          graph.edges.delete(edge.id);
        }
        for (const node of this.nodeSnapshots || []) {
          graph.removeNode(node.id);
        }
        selection.clear();
      },
    };

    this.stack.exec(command);

    this._clipboard.nodes = this._clipboard.nodes.map((node) => ({
      ...node,
      x: node.x + offset,
      y: node.y + offset,
    }));
    this.graph.updateWorldTransforms();
    this.render();
  }

  _findPotentialParent(x, y, excludeNode) {
    const list = [...this.graph.nodes.values()].reverse();
    for (const n of list) {
      if (n.type !== "core/Group" || n === excludeNode) continue;
      let p = n.parent;
      let isDescendant = false;
      while (p) {
        if (p === excludeNode) { isDescendant = true; break; }
        p = p.parent;
      }
      if (isDescendant) continue;
      const { x: nx, y: ny, w, h } = n.computed;
      if (x >= nx && x <= nx + w && y >= ny && y <= ny + h) return n;
    }
    return null;
  }

  _selectionHasAncestor(node) {
    let parent = node.parent;
    while (parent) {
      if (this.selection.has(parent.id)) return true;
      parent = parent.parent;
    }
    return false;
  }

  _collectDescendants(node, set) {
    for (const n of this.graph.nodes.values()) {
      if (n.parent === node) {
        set.add(n.id);
        this._collectDescendants(n, set);
      }
    }
  }

  _snapToGrid(value) {
    return Math.round(value / this.gridSize) * this.gridSize;
  }

  _createGroupFromSelection() {
    if (this.selection.size === 0) return;
    const selectedNodes = Array.from(this.selection).map((id) => this.graph.getNodeById(id));
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of selectedNodes) {
      const { x, y, w, h } = node.computed;
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y + h);
    }
    const margin = 20;
    if (this.graph.groupManager) {
      const args = {
        title: "Group",
        x: minX - margin, y: minY - margin,
        width: maxX - minX + margin * 2, height: maxY - minY + margin * 2,
        members: Array.from(this.selection),
      };
      
      const cmd = AddGroupCmd(this.graph.groupManager, args);
      this.stack.exec(cmd);

      this.selection.clear();
      if (cmd.addedGroup) this.selection.add(cmd.addedGroup.id);
      this.render();
    }
  }

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

  arrangeSelectionInGrid(cols = 3, spacingX = 220, spacingY = 120) {
    const nodeIds = this.selection.size > 0 
      ? Array.from(this.selection)
      : Array.from(this.graph.nodes.keys()).filter(id => {
          const n = this.graph.nodes.get(id);
          return n && n.type !== "core/Group";
        });

    if (nodeIds.length === 0) return;

    const nodes = nodeIds
      .map(id => this.graph.nodes.get(id))
      .filter(n => !!n)
      .sort((a, b) => {
        if (Math.abs(a.pos.y - b.pos.y) < 50) {
          return a.pos.x - b.pos.x;
        }
        return a.pos.y - b.pos.y;
      });

    let startX = Math.min(...nodes.map(n => n.pos.x));
    let startY = Math.min(...nodes.map(n => n.pos.y));

    if (this.snapToGrid) {
      startX = this._snapToGrid(startX);
      startY = this._snapToGrid(startY);
    }

    const commands = [];
    nodes.forEach((node, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const targetX = startX + col * spacingX;
      const targetY = startY + row * spacingY;
      
      const fromPos = { x: node.pos.x, y: node.pos.y };
      const toPos = { x: targetX, y: targetY };
      
      node.pos.x = targetX;
      node.pos.y = targetY;
      
      commands.push({ node, fromPos, toPos });
    });

    if (commands.length > 0) {
      this.stack.exec(MoveNodesCmd(commands));
    }

    this.graph.updateWorldTransforms();
    this.render();
  }

  arrangeRankLayout(direction = "horizontal", spacingX = 240, spacingY = 140) {
    const nodes = Array.from(this.graph.nodes.values()).filter(n => n.type !== "core/Group");
    if (nodes.length === 0) return;

    // 1. Map of nodeId -> list of parent nodeIds
    const parentsMap = new Map();
    for (const n of nodes) {
      parentsMap.set(n.id, []);
    }

    for (const e of this.graph.edges.values()) {
      if (parentsMap.has(e.toNode) && parentsMap.has(e.fromNode)) {
        parentsMap.get(e.toNode).push(e.fromNode);
      }
    }

    // 2. Compute ranks using recursive DFS with cycle-detection
    const ranks = new Map();
    const visiting = new Set();

    const computeRank = (nodeId) => {
      if (ranks.has(nodeId)) return ranks.get(nodeId);
      if (visiting.has(nodeId)) {
        // Cycle detected, break the cycle by assigning rank 0 dynamically
        return 0;
      }
      visiting.add(nodeId);

      let maxParentRank = -1;
      const parents = parentsMap.get(nodeId) || [];
      for (const pId of parents) {
        const pRank = computeRank(pId);
        maxParentRank = Math.max(maxParentRank, pRank);
      }

      visiting.delete(nodeId);
      const rank = maxParentRank + 1;
      ranks.set(nodeId, rank);
      return rank;
    };

    for (const n of nodes) {
      computeRank(n.id);
    }

    // 2b. Map of nodeId -> list of child nodeIds for backward rank pass
    const childrenMap = new Map();
    for (const n of nodes) {
      childrenMap.set(n.id, []);
    }
    for (const e of this.graph.edges.values()) {
      if (childrenMap.has(e.fromNode) && childrenMap.has(e.toNode)) {
        childrenMap.get(e.fromNode).push(e.toNode);
      }
    }

    const finalRanks = new Map();
    const visitingBackward = new Set();

    const computeBackwardRank = (nodeId) => {
      if (finalRanks.has(nodeId)) return finalRanks.get(nodeId);
      if (visitingBackward.has(nodeId)) {
        // Cycle loop fallback: use forward rank
        return ranks.get(nodeId) ?? 0;
      }
      visitingBackward.add(nodeId);

      const children = childrenMap.get(nodeId) || [];
      if (children.length === 0) {
        const r = ranks.get(nodeId) ?? 0;
        finalRanks.set(nodeId, r);
        visitingBackward.delete(nodeId);
        return r;
      }

      let minChildRank = Infinity;
      for (const cId of children) {
        const cRank = computeBackwardRank(cId);
        minChildRank = Math.min(minChildRank, cRank);
      }

      visitingBackward.delete(nodeId);
      const forwardRank = ranks.get(nodeId) ?? 0;
      const r = Math.max(forwardRank, minChildRank - 1);
      finalRanks.set(nodeId, r);
      return r;
    };

    for (const n of nodes) {
      computeBackwardRank(n.id);
    }

    // 3. Group nodes by rank
    const rankGroups = new Map();
    for (const n of nodes) {
      const r = finalRanks.get(n.id) ?? 0;
      if (!rankGroups.has(r)) {
        rankGroups.set(r, []);
      }
      rankGroups.get(r).push(n.id);
    }

    // Sort nodes in each rank based on their original positions to keep layout stable
    const sortedRanks = Array.from(rankGroups.keys()).sort((a, b) => a - b);
    for (const r of sortedRanks) {
      const ids = rankGroups.get(r);
      ids.sort((a, b) => {
        const nodeA = this.graph.nodes.get(a);
        const nodeB = this.graph.nodes.get(b);
        if (direction === 'horizontal') {
          return nodeA.pos.y - nodeB.pos.y;
        } else {
          return nodeA.pos.x - nodeB.pos.x;
        }
      });
    }

    // Calculate existing graph center in world coordinates.
    // n.pos is parent-local — must use computed world positions so that nodes inside
    // groups and root-level nodes are measured in the same coordinate space.
    this.graph.updateWorldTransforms();
    const origCenterX = nodes.reduce((s, n) => s + (n.computed?.x ?? n.pos.x), 0) / nodes.length;
    const origCenterY = nodes.reduce((s, n) => s + (n.computed?.y ?? n.pos.y), 0) / nodes.length;

    const commands = [];

    // 4. Calculate targets and populate commands
    if (direction === 'horizontal') {
      const layoutWidth = (sortedRanks.length - 1) * spacingX;
      const startX = origCenterX - layoutWidth / 2;

      sortedRanks.forEach((r, colIndex) => {
        const ids = rankGroups.get(r);
        const colX = startX + colIndex * spacingX;
        const colHeight = (ids.length - 1) * spacingY;
        const startY = origCenterY - colHeight / 2;

        ids.forEach((id, nodeIndex) => {
          const node = this.graph.nodes.get(id);
          const parentX = node.parent ? node.parent.computed.x : 0;
          const parentY = node.parent ? node.parent.computed.y : 0;
          const targetX = colX - parentX;
          const targetY = (startY + nodeIndex * spacingY) - parentY;

          commands.push({
            node,
            fromPos: { x: node.pos.x, y: node.pos.y },
            toPos: { x: targetX, y: targetY }
          });

          // Set positions directly for command execution
          node.pos.x = targetX;
          node.pos.y = targetY;
        });
      });
    } else {
      const layoutHeight = (sortedRanks.length - 1) * spacingY;
      const startY = origCenterY - layoutHeight / 2;

      sortedRanks.forEach((r, rowIndex) => {
        const ids = rankGroups.get(r);
        const rowY = startY + rowIndex * spacingY;
        const rowWidth = (ids.length - 1) * spacingX;
        const startX = origCenterX - rowWidth / 2;

        ids.forEach((id, nodeIndex) => {
          const node = this.graph.nodes.get(id);
          const parentX = node.parent ? node.parent.computed.x : 0;
          const parentY = node.parent ? node.parent.computed.y : 0;
          const targetX = (startX + nodeIndex * spacingX) - parentX;
          const targetY = rowY - parentY;

          commands.push({
            node,
            fromPos: { x: node.pos.x, y: node.pos.y },
            toPos: { x: targetX, y: targetY }
          });

          node.pos.x = targetX;
          node.pos.y = targetY;
        });
      });
    }

    if (commands.length > 0) {
      this.stack.exec(MoveNodesCmd(commands));
    }

    this.graph.updateWorldTransforms();
    this.render();
  }

  setSlotLayout(mode) {
    this.slotLayout = mode;
    if (this.subNodePanel && this.subNodePanel._controller) {
      this.subNodePanel._controller.slotLayout = mode;
      this.subNodePanel._controller.render();
    }
    this.render();
  }

  render(time = performance.now()) {
    const tEdge = this.renderTempEdge();
    const runner = this.graph.runner;
    const isStepMode = !!runner && runner.executionMode === "step";

    this.renderer.draw(this.graph, {
      selection: this.selection,
      tempEdge: tEdge,
      boxSelecting: this.boxSelecting,
      activeEdges: this.activeEdges || new Set(),
      activeEdgeTimes: this.activeEdgeTimes,
      activeNodes: this.activeNodes || new Set(),
      drawEdges: !this.edgeRenderer,
      time,
      loopActiveEdges: isStepMode,
      hoveredNodeId: this.hoveredNodeId,
      hoveredPortId: this.hoveredPort ? this.hoveredPort.port.id : null,
      connecting: !!this.connecting,
      slotLayout: this.slotLayout,
      alignmentGuides: this.alignmentGuides,
    });

    this.htmlOverlay?.draw(this.graph, this.selection);

    if (this.edgeRenderer) {
      const edgeCtx = this.edgeRenderer.ctx;
      edgeCtx.clearRect(0, 0, this.edgeRenderer.canvas.width, this.edgeRenderer.canvas.height);
      this.edgeRenderer._applyTransform();
      this.edgeRenderer.drawEdgesOnly(this.graph, {
        activeEdges: this.activeEdges,
        activeEdgeTimes: this.activeEdgeTimes,
        activeNodes: this.activeNodes,
        selection: this.selection,
        time,
        tempEdge: tEdge,
        loopActiveEdges: isStepMode,
        slotLayout: this.slotLayout,
      });
      this.edgeRenderer._resetTransform();
    }

    if (this.boxSelecting) {
      const { startX, startY, currentX, currentY } = this.boxSelecting;
      const minX = Math.min(startX, currentX);
      const minY = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);
      const screenStart = this.renderer.worldToScreen(minX, minY);
      const screenEnd = this.renderer.worldToScreen(minX + width, minY + height);
      const ctx = this.edgeRenderer ? this.edgeRenderer.ctx : this.renderer.ctx;
      ctx.save();
      if (this.edgeRenderer) this.edgeRenderer._resetTransform();
      else this.renderer._resetTransform();
      ctx.strokeStyle = "#6cf";
      ctx.fillStyle = "rgba(102, 204, 255, 0.1)";
      ctx.lineWidth = 2;
      ctx.strokeRect(screenStart.x, screenStart.y, screenEnd.x - screenStart.x, screenEnd.y - screenStart.y);
      ctx.fillRect(screenStart.x, screenStart.y, screenEnd.x - screenStart.x, screenEnd.y - screenStart.y);
      ctx.restore();
    }

    if (this.portRenderer) {
      this.portRenderer.clear();
      this.portRenderer.scale = this.renderer.scale;
      this.portRenderer.offsetX = this.renderer.offsetX;
      this.portRenderer.offsetY = this.renderer.offsetY;
      this.portRenderer.slotLayout = this.slotLayout;
      this.portRenderer.hoveredPortId = this.hoveredPort ? this.hoveredPort.port.id : null;
      this.portRenderer._applyTransform();
      for (const n of this.graph.nodes.values()) {
        if (n.type !== "core/Group") {
          const showPorts = this.connecting || (this.hoveredNodeId === n.id);
          if (showPorts) {
            this.portRenderer._drawPorts(n);
          }
        }
      }
      this.portRenderer._resetTransform();
    } else {
      // No dedicated port canvas — draw ports inline on the main renderer
      this.renderer.hoveredPortId = this.hoveredPort ? this.hoveredPort.port.id : null;
      this.renderer._applyTransform();
      for (const n of this.graph.nodes.values()) {
        if (n.type !== "core/Group") {
          const showPorts = this.connecting || (this.hoveredNodeId === n.id);
          if (showPorts) {
            this.renderer._drawPorts(n);
          }
        }
      }
      this.renderer._resetTransform();
    }
  }

  renderTempEdge() {
    if (!this.connecting) return null;
    const incompatible = !!this.connecting.incompatible;
    if (this.connecting.dir === "reverse") {
      const a = this._portAnchorScreenIn(this.connecting.toNode, this.connecting.toPort);
      return {
        x1: this.connecting.snappedX ?? this.connecting.x,
        y1: this.connecting.snappedY ?? this.connecting.y,
        x2: a.x,
        y2: a.y,
        incompatible,
      };
    }
    const a = this._portAnchorScreen(this.connecting.fromNode, this.connecting.fromPort);
    return {
      x1: a.x,
      y1: a.y,
      x2: this.connecting.snappedX ?? this.connecting.x,
      y2: this.connecting.snappedY ?? this.connecting.y,
      incompatible,
    };
  }

  _portAnchorScreen(nodeId, portId) {
    const n = this.graph.nodes.get(nodeId);
    const iOut = n.outputs.findIndex((p) => p.id === portId);
    const r = portRect(n, null, iOut, "out", this.slotLayout);
    return this.renderer.worldToScreen(r.x + r.w / 2, r.y + r.h / 2);
  }

  _portAnchorScreenIn(nodeId, portId) {
    const n = this.graph.nodes.get(nodeId);
    const iIn = n.inputs.findIndex((p) => p.id === portId);
    const r = portRect(n, null, iIn, "in", this.slotLayout);
    return this.renderer.worldToScreen(r.x + r.w / 2, r.y + r.h / 2);
  }
}

function rectHas(r, x, y) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
