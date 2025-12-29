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

  constructor({ graph, renderer, hooks, htmlOverlay, contextMenu, portRenderer }) {
    this.graph = graph;
    this.renderer = renderer;
    this.hooks = hooks;
    this.htmlOverlay = htmlOverlay;
    this.contextMenu = contextMenu;
    this.portRenderer = portRenderer; // Separate renderer for ports above HTML

    this.stack = new CommandStack();
    this.selection = new Set();
    this.dragging = null; // { nodeId, dx, dy }
    this.connecting = null; // { fromNode, fromPort, x(screen), y(screen) }
    this.panning = null; // { x(screen), y(screen) }
    this.resizing = null;
    this.gDragging = null;
    this.gResizing = null;
    this.boxSelecting = null; // { startX, startY, currentX, currentY } - world coords

    // Feature flags
    this.snapToGrid = true; // Snap nodes to grid (toggle with G key)
    this.gridSize = 20; // Grid size for snapping

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

    // Toggle snap-to-grid with G key
    if (e.key.toLowerCase() === "g" && !e.ctrlKey && !e.metaKey) {
      this.snapToGrid = !this.snapToGrid;
      this.render(); // Update UI
      return;
    }

    // Group selected nodes: Ctrl/Cmd + G
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "g") {
      e.preventDefault();
      this._createGroupFromSelection();
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

    // Align nodes: A (horizontal), Shift+A (vertical)
    if (e.key.toLowerCase() === "a" && this.selection.size > 1) {
      e.preventDefault();
      if (e.shiftKey) {
        this._alignNodesVertical();
      } else {
        this._alignNodesHorizontal();
      }
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

  /**
   * Find child node at world coordinates (recursive helper for _findNodeAtWorld)
   * @param {Node} parentNode - Parent node (group)
   * @param {number} x - World x coordinate
   * @param {number} y - World y coordinate
   * @returns {Node|null} - Child node at position, or null
   */
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

    // Handle input port click - disconnect existing connection
    if (e.button === 0 && port && port.dir === "in") {
      const incoming = this._findIncomingEdge(port.node.id, port.port.id);
      if (incoming) {
        // Disconnect the existing edge
        this.stack.exec(RemoveEdgeCmd(this.graph, incoming.id));
        this.render();
        return;
      }
    }

    // Handle output port click - start new connection
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
          this.dragging.selectedNodes.push({
            node: selectedNode,
            startWorldX: selectedNode.computed.x,
            startWorldY: selectedNode.computed.y,
            startLocalX: selectedNode.pos.x,
            startLocalY: selectedNode.pos.y,
          });
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

      // Calculate delta for main node
      let targetWx = w.x - this.dragging.offsetX;
      let targetWy = this.isShift ? w.y - 0 : w.y - this.dragging.offsetY;

      // Apply snap-to-grid if enabled
      if (this.snapToGrid) {
        targetWx = this._snapToGrid(targetWx);
        targetWy = this._snapToGrid(targetWy);
      }

      // Calculate delta from original position
      const deltaX = targetWx - this.dragging.selectedNodes.find(sn => sn.node.id === n.id).startWorldX;
      const deltaY = targetWy - this.dragging.selectedNodes.find(sn => sn.node.id === n.id).startWorldY;

      // Update world transforms
      this.graph.updateWorldTransforms();

      // Move all selected nodes by the same delta
      for (const { node: selectedNode, startWorldX, startWorldY } of this.dragging.selectedNodes) {
        // Skip group nodes when shift-dragging (vertical only)
        if (this.isShift && selectedNode.type === "core/Group") {
          continue;
        }

        let newWorldX = startWorldX + deltaX;
        let newWorldY = startWorldY + deltaY;

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
      this.render();
    }

    // Cursor update
    const port = this._findPortAtWorld(w.x, w.y);
    const node = this._findNodeAtWorld(w.x, w.y);

    if (node && this._hitResizeHandle(node, w.x, w.y)) {
      this._setCursor("se-resize");
    } else if (port) {
      // Show pointer cursor over ports (for connecting/disconnecting)
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

      // If we're dragging a GROUP with Alt, only move the group (keep children in place)
      if (n.type === "core/Group" && this.isAlt && this.dragging.childrenWorldPos) {
        // Restore children to their original world positions
        for (const childInfo of this.dragging.childrenWorldPos) {
          const child = childInfo.node;
          // Convert world position back to local position relative to new group position
          this.graph.updateWorldTransforms();
          const newGroupX = n.computed.x;
          const newGroupY = n.computed.y;

          child.pos.x = childInfo.worldX - newGroupX;
          child.pos.y = childInfo.worldY - newGroupY;
        }
      } else if (n.type === "core/Group" && !this.isAlt) {
        // Normal group drag - auto-parent nodes
        this._autoParentNodesInGroup(n);
      } else if (n.type !== "core/Group") {
        // Normal node: Reparenting Logic
        // Check if dropped onto a group
        const potentialParent = this._findPotentialParent(w.x, w.y, n);

        if (potentialParent && potentialParent !== n.parent) {
          this.graph.reparent(n, potentialParent);
        } else if (!potentialParent && n.parent) {
          // Dropped on empty space -> move to root
          this.graph.reparent(n, null);
        }
      }

      this.dragging = null;
      this.render();
    }

    if (this.boxSelecting) {
      // Select all nodes within the box
      const { startX, startY, currentX, currentY } = this.boxSelecting;
      const minX = Math.min(startX, currentX);
      const maxX = Math.max(startX, currentX);
      const minY = Math.min(startY, currentY);
      const maxY = Math.max(startY, currentY);

      for (const node of this.graph.nodes.values()) {
        const { x, y, w, h } = node.computed;
        // Check if node intersects with selection box
        if (x + w >= minX && x <= maxX && y + h >= minY && y <= maxY) {
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

    // Find all nodes that are within the group bounds
    for (const node of this.graph.nodes.values()) {
      // Skip the group itself
      if (node === groupNode) continue;

      // Skip if it's already a child of this group
      if (node.parent === groupNode) continue;

      // Skip if it's another group (prevent nested groups for now)
      if (node.type === "core/Group") continue;

      // Check if node is within group bounds
      const { x: nx, y: ny, w: nw, h: nh } = node.computed;
      const nodeCenterX = nx + nw / 2;
      const nodeCenterY = ny + nh / 2;

      // Use center point to determine if node is inside group
      if (
        nodeCenterX >= gx &&
        nodeCenterX <= gx + gw &&
        nodeCenterY >= gy &&
        nodeCenterY <= gy + gh
      ) {
        // Parent this node to the group
        this.graph.reparent(node, groupNode);
      }
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

    // Get selected nodes
    const selectedNodes = Array.from(this.selection).map(id => this.graph.getNodeById(id));

    // Calculate bounding box
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

    // Create group via GroupManager
    if (this.graph.groupManager) {
      this.graph.groupManager.addGroup({
        title: "Group",
        x: groupX,
        y: groupY,
        width: groupWidth,
        height: groupHeight,
        members: Array.from(this.selection),
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

    const nodes = Array.from(this.selection).map(id => this.graph.getNodeById(id));
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

    const nodes = Array.from(this.selection).map(id => this.graph.getNodeById(id));
    const avgX = nodes.reduce((sum, n) => sum + n.computed.x, 0) / nodes.length;

    for (const node of nodes) {
      const parentX = node.parent ? node.parent.computed.x : 0;
      node.pos.x = avgX - parentX;
    }

    this.graph.updateWorldTransforms();
    this.render();
  }

  render() {
    const tEdge = this.renderTempEdge();

    this.renderer.draw(this.graph, {
      selection: this.selection,
      tempEdge: tEdge,
      boxSelecting: this.boxSelecting,
      activeEdges: this.activeEdges || new Set(), // For animation
    });

    this.htmlOverlay?.draw(this.graph, this.selection);

    // Draw box selection rectangle on top of everything
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

      // Draw selection box
      ctx.strokeStyle = "#6cf";
      ctx.fillStyle = "rgba(102, 204, 255, 0.1)";
      ctx.lineWidth = 2;
      ctx.strokeRect(screenStart.x, screenStart.y, screenEnd.x - screenStart.x, screenEnd.y - screenStart.y);
      ctx.fillRect(screenStart.x, screenStart.y, screenEnd.x - screenStart.x, screenEnd.y - screenStart.y);

      ctx.restore();
    }

    // Draw ports for HTML overlay nodes on separate canvas (above HTML)
    if (this.portRenderer) {
      // Clear port canvas
      const portCtx = this.portRenderer.ctx;
      portCtx.clearRect(0, 0, this.portRenderer.canvas.width, this.portRenderer.canvas.height);

      // Sync transform
      this.portRenderer.scale = this.renderer.scale;
      this.portRenderer.offsetX = this.renderer.offsetX;
      this.portRenderer.offsetY = this.renderer.offsetY;

      // Draw ports for HTML overlay nodes
      this.portRenderer._applyTransform();
      for (const n of this.graph.nodes.values()) {
        if (n.type !== "core/Group") {
          const def = this.portRenderer.registry?.types?.get(n.type);
          const hasHtmlOverlay = !!(def?.html);

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
