import { hitTestNode, portRect } from "../render/hitTest.js";
import {
  MoveNodeCmd,
  AddEdgeCmd,
  RemoveEdgeCmd,
  CompoundCmd,
  RemoveNodeCmd,
  ResizeNodeCmd,
} from "../core/commands.js";
import { CommandStack } from "../core/CommandStack.js";

export class Controller {

  static MIN_NODE_WIDTH = 80;
  static MIN_NODE_HEIGHT = 60;

  constructor({ graph, renderer, hooks, htmlOverlay }) {
    this.graph = graph;
    this.renderer = renderer;
    this.hooks = hooks;
    this.htmlOverlay = htmlOverlay;

    this.stack = new CommandStack();
    this.selection = new Set();
    this.dragging = null; // { nodeId, dx, dy }
    this.connecting = null; // { fromNode, fromPort, x(screen), y(screen) }
    this.panning = null; // { x(screen), y(screen) }
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

    // remove the selected nodes
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
    // Reverse order (top to bottom)
    const list = [...this.graph.nodes.values()].reverse();
    for (const n of list) {
      // Use computed world transform for hit testing
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
    const factor = Math.pow(1.0015, -e.deltaY); // smooth zoom
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

    // 1. Resize Handle Hit Test (for all nodes including groups)
    const node = this._findNodeAtWorld(w.x, w.y);
    if (e.button === 0 && node && this._hitResizeHandle(node, w.x, w.y)) {
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
    if (e.button === 0 && port && port.dir === "out") {
      const outR = portRect(port.node, port.port, port.idx, "out");
      const screenFrom = this.renderer.worldToScreen(outR.x, outR.y + 7);
      this.connecting = {
        fromNode: port.node.id,
        fromPort: port.port.id,
        x: screenFrom.x,
        y: screenFrom.y,
      };
      return;
    }

    // 3. Node Hit Test (Selection & Drag)
    if (e.button === 0 && node) {
      if (!e.shiftKey) this.selection.clear();
      this.selection.add(node.id);
      
      // Dragging: store initial world pos difference
      // When moving, we calculate new world pos, then convert to local
      this.dragging = {
        nodeId: node.id,
        offsetX: w.x - node.computed.x,
        offsetY: w.y - node.computed.y,
        startPos: { ...node.pos }, // for undo
      };
      this.render();
      return;
    }

    // 4. Background Click (Pan)
    if (e.button === 0) {
      if (this.selection.size) this.selection.clear();
      this.panning = { x: s.x, y: s.y };
      this.render();
      return;
    }
  }

  _onMove(e) {
    const s = this._posScreen(e);
    const w = this.renderer.screenToWorld(s.x, s.y);

    if (this.resizing) {
      const n = this.graph.nodes.get(this.resizing.nodeId);
      const dx = w.x - this.resizing.startX;
      const dy = w.y - this.resizing.startY;

      const minW = Controller.MIN_NODE_WIDTH;
      const minH = Controller.MIN_NODE_HEIGHT;
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

    if (this.dragging) {
      const n = this.graph.nodes.get(this.dragging.nodeId);
      
      // Target World Pos
      const targetWx = w.x - this.dragging.offsetX;
      const targetWy = w.y - this.dragging.offsetY;

      // Convert to Local Pos
      // local = targetWorld - parentWorld
      let parentWx = 0;
      let parentWy = 0;
      if (n.parent) {
        parentWx = n.parent.computed.x;
        parentWy = n.parent.computed.y;
      }

      n.pos.x = targetWx - parentWx;
      n.pos.y = targetWy - parentWy;


      this.hooks?.emit("node:move", n);
      this.render();
      return;
    }

    if (this.connecting) {
      this.connecting.x = s.x;
      this.connecting.y = s.y;
      this.render();
    }

    // Cursor update
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
      // ... (existing connection logic)
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
      
      // Reparenting Logic
      // Check if dropped onto a group
      // We need to find the group under the mouse, excluding the node itself and its children
      const potentialParent = this._findPotentialParent(w.x, w.y, n);
      
      if (potentialParent && potentialParent !== n.parent) {
        this.graph.reparent(n, potentialParent);
      } else if (!potentialParent && n.parent) {
        // Dropped on empty space -> move to root
        this.graph.reparent(n, null);
      }

      this.dragging = null;
      this.render();
    }
  }

  _findPotentialParent(x, y, excludeNode) {
    // Find top-most group under x,y that is not excludeNode or its descendants
    const list = [...this.graph.nodes.values()].reverse();
    for (const n of list) {
      if (n.type !== "core/Group") continue;
      if (n === excludeNode) continue;
      // Check if n is descendant of excludeNode
      let p = n.parent;
      let isDescendant = false;
      while(p) {
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
    const tEdge = this.renderTempEdge();

    this.renderer.draw(this.graph, {
      selection: this.selection,
      tempEdge: tEdge,
    });
    
    this.htmlOverlay?.draw(this.graph, this.selection);
  }

  renderTempEdge() {
    if (!this.connecting) return null;
    const a = this._portAnchorScreen(
      this.connecting.fromNode,
      this.connecting.fromPort
    ); // {x,y}
    return {
      x1: a.x,
      y1: a.y,
      x2: this.connecting.x,
      y2: this.connecting.y,
    };
  }

  _portAnchorScreen(nodeId, portId) {
    const n = this.graph.nodes.get(nodeId);
    const iOut = n.outputs.findIndex((p) => p.id === portId);
    const r = portRect(n, null, iOut, "out"); // world rect
    return this.renderer.worldToScreen(r.x, r.y + 7); // -> screen point
  }
}

function rectHas(r, x, y) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
