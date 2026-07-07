import { portRect } from "./hitTest.js";

export class CanvasRenderer {
  static FONT_SIZE = 9;
  static SELECTED_NODE_COLOR = "#6cf";
  constructor(canvas, { theme = {}, registry, edgeStyle = "orthogonal" } = {}) {
    this.iconManager = null;
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.registry = registry;

    this.scale = 1;
    this.minScale = 0.25;
    this.maxScale = 3;
    this.offsetX = 0;
    this.offsetY = 0;

    // HiDPI: physical-to-logical ratio; updated in resize()
    this._dpr = window.devicePixelRatio || 1;
    this._logicalW = canvas.width;
    this._logicalH = canvas.height;
    // Cached screen-size gradients (invalidated on resize)
    this._gridGradientCache = null;

    // 'bezier' | 'line' | 'orthogonal'
    this.edgeStyle = edgeStyle;

    this.theme = Object.assign(
      {
        bg: "#111315",
        bgAccent: "#1b2026",
        bgAccentSoft: "#0f1215",
        grid: "#29313b",
        gridMajor: "#3b4653",
        node: "#171b20",
        nodeSurface: "rgba(255, 255, 255, 0.02)",
        nodeBorder: "rgba(255, 255, 255, 0.08)",
        nodeBorderSelected: "rgba(255, 255, 255, 0.4)",
        title: "rgba(10, 14, 18, 0.96)",
        headerAlpha: 0.22,
        text: "#f3f6fb",
        textMuted: "#95a0ad",
        port: "#7a8c9e",
        portExec: "#34d399",
        edge: "rgba(142, 150, 160, 0.28)",
        edgeExec: "rgba(124, 214, 172, 0.38)",
        edgeData: "rgba(122, 140, 158, 0.36)",
        edgeActive: "#8dd7b4",
        edgeActiveData: "#9fb2c4",
        accent: "#7a8c9e",
        accentBright: "#c0cbd6",
        accentGlow: "rgba(122, 140, 158, 0.18)",
        nodeRadius: 5,
        groupRadius: 2,
        headerHeight: 22,
        flowSpeed: 180,
        linkPulseSpacing: 28,
      },
      theme
    );
  }

  /** Logical (CSS-pixel) canvas width — use instead of canvas.width for viewport math. */
  get width()  { return this._logicalW; }
  /** Logical (CSS-pixel) canvas height — use instead of canvas.height for viewport math. */
  get height() { return this._logicalH; }

  setEdgeStyle(style) {
    this.edgeStyle = style === "line" || style === "orthogonal" ? style : "bezier";
  }
  setRegistry(reg) {
    this.registry = reg;
  }
  resize(w, h) {
    // Skip degenerate resize (element hidden / display:none → clientWidth=0).
    // Without this guard, setting style.width="0px" locks the canvas at 0 even
    // after the element becomes visible again, breaking re-open of SubGraphPanel.
    if (!w || !h) return;
    const dpr = window.devicePixelRatio || 1;
    this._dpr = dpr;
    this._logicalW = w;
    this._logicalH = h;
    this.canvas.width  = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width  = w + 'px';
    this.canvas.style.height = h + 'px';
    this._gridGradientCache = null; // invalidate cached gradients on resize
  }

  /** Clear all physical pixels regardless of current transform. */
  clear() {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }
  setTransform({ scale = this.scale, offsetX = this.offsetX, offsetY = this.offsetY } = {}) {
    this.scale = Math.min(this.maxScale, Math.max(this.minScale, scale));
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this._onTransformChange?.();
  }
  setTransformChangeCallback(callback) {
    this._onTransformChange = callback;
  }
  panBy(dx, dy) {
    this.offsetX += dx;
    this.offsetY += dy;
    this._onTransformChange?.();
  }
  zoomAt(factor, cx, cy) {
    const prev = this.scale;
    const next = Math.min(this.maxScale, Math.max(this.minScale, prev * factor));
    if (next === prev) return;
    const wx = (cx - this.offsetX) / prev;
    const wy = (cy - this.offsetY) / prev;
    this.offsetX = cx - wx * next;
    this.offsetY = cy - wy * next;
    this.scale = next;
    this._onTransformChange?.();
  }

  screenToWorld(x, y) {
    return {
      x: (x - this.offsetX) / this.scale,
      y: (y - this.offsetY) / this.scale,
    };
  }
  worldToScreen(x, y) {
    return {
      x: x * this.scale + this.offsetX,
      y: y * this.scale + this.offsetY,
    };
  }
  _applyTransform() {
    const dpr = this._dpr || 1;
    // Combines dpr scale + pan + zoom into one matrix for crisp HiDPI rendering
    this.ctx.setTransform(
      dpr * this.scale, 0,
      0, dpr * this.scale,
      this.offsetX * dpr, this.offsetY * dpr
    );
  }
  _resetTransform() {
    const dpr = this._dpr || 1;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ── Drawing ────────────────────────────────────────────────────────────────
  _drawArrowhead(x1, y1, x2, y2, size = 8) {
    const { ctx } = this;
    const s = size / this.scale;
    const ang = Math.atan2(y2 - y1, x2 - x1);

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - s * Math.cos(ang - Math.PI / 6), y2 - s * Math.sin(ang - Math.PI / 6));
    ctx.lineTo(x2 - s * Math.cos(ang + Math.PI / 6), y2 - s * Math.sin(ang + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }

  _drawScreenText(
    text,
    lx,
    ly,
    { fontPx = 11, color = this.theme.text, align = "left", baseline = "alphabetic", maxWidth = undefined } = {}
  ) {
    const { ctx } = this;
    const { x: sx, y: sy } = this.worldToScreen(lx, ly);

    ctx.save();
    this._resetTransform();

    const px = Math.round(sx) + 0.5;
    const py = sy; // no rounding: prevents 0.5 px vertical shift that misaligns icon and title

    ctx.font = `${fontPx * this.scale}px "Inter", system-ui, sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    if (maxWidth !== undefined) {
      ctx.fillText(text, px, py, maxWidth * this.scale);
    } else {
      ctx.fillText(text, px, py);
    }
    ctx.restore();
  }

  drawGrid() {
    const { ctx, theme, scale, offsetX, offsetY } = this;
    const W = this.width;
    const H = this.height;

    this._resetTransform();
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, W, H);

    // Cache screen-size gradients — only recreated on resize (see resize())
    if (!this._gridGradientCache) {
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, theme.bgAccentSoft || theme.bg);
      bg.addColorStop(0.38, theme.bg || theme.bgAccentSoft);
      bg.addColorStop(1, theme.bgAccent || theme.bg);

      const vig = ctx.createRadialGradient(
        W * 0.5, H * 0.5, Math.min(W, H) * 0.05,
        W * 0.5, H * 0.5, Math.max(W, H) * 0.90
      );
      vig.addColorStop(0,   "rgba(255,255,255,0.006)");
      vig.addColorStop(0.6, "rgba(255,255,255,0)");
      vig.addColorStop(1,   "rgba(0,0,0,0.055)");
      this._gridGradientCache = { bg, vig };
    }
    ctx.fillStyle = this._gridGradientCache.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = this._gridGradientCache.vig;
    ctx.fillRect(0, 0, W, H);

    this._applyTransform();

    const x0 = -offsetX / scale;
    const y0 = -offsetY / scale;
    const x1 = (W - offsetX) / scale;
    const y1 = (H - offsetY) / scale;

    // Minor dots (20px grid — matches snap grid)
    const minorStep = 20;
    const majorStep = 100;
    const startX = Math.floor(x0 / minorStep) * minorStep;
    const startY = Math.floor(y0 / minorStep) * minorStep;

    ctx.lineWidth = 1 / scale;
    ctx.strokeStyle = this._rgba(theme.grid, 0.16);
    ctx.beginPath();
    for (let gx = startX; gx <= x1; gx += minorStep) {
      if (gx % majorStep === 0) continue;
      ctx.moveTo(gx, y0);
      ctx.lineTo(gx, y1);
    }
    for (let gy = startY; gy <= y1; gy += minorStep) {
      if (gy % majorStep === 0) continue;
      ctx.moveTo(x0, gy);
      ctx.lineTo(x1, gy);
    }
    ctx.stroke();

    const majorStartX = Math.floor(x0 / majorStep) * majorStep;
    const majorStartY = Math.floor(y0 / majorStep) * majorStep;
    ctx.strokeStyle = this._rgba(theme.gridMajor || theme.grid, 0.28);
    ctx.lineWidth = 1.2 / scale;
    ctx.beginPath();
    for (let gx = majorStartX; gx <= x1; gx += majorStep) {
      ctx.moveTo(gx, y0);
      ctx.lineTo(gx, y1);
    }
    for (let gy = majorStartY; gy <= y1; gy += majorStep) {
      ctx.moveTo(x0, gy);
      ctx.lineTo(x1, gy);
    }
    ctx.stroke();

    this._resetTransform();
  }

  // ── Viewport culling helpers ──────────────────────────────────────────────

  /** Returns the visible world-space rectangle, expanded by `margin` on all sides. */
  _viewportBounds(margin = 0) {
    const { scale, offsetX, offsetY } = this;
    const left   = -offsetX / scale - margin;
    const top    = -offsetY / scale - margin;
    const right  = left + this.width  / scale + margin * 2;
    const bottom = top  + this.height / scale + margin * 2;
    return { left, top, right, bottom };
  }

  /** True when the node's world bounding-box overlaps the given viewport rect. */
  _nodeInView(node, vb) {
    const { x, y, w, h } = node.computed;
    return x < vb.right && x + w > vb.left && y < vb.bottom && y + h > vb.top;
  }

  /**
   * True when the edge could be visible — uses the bounding-box of both
   * endpoint nodes as a cheap proxy.  Accepts a pre-built Set of visible
   * node ids so the per-node check is O(1).
   */
  _edgeInView(graph, edge, visibleNodes) {
    if (visibleNodes.has(edge.fromNode) || visibleNodes.has(edge.toNode)) return true;
    // Both endpoints outside — check their combined bounding box against viewport
    const from = graph.nodes.get(edge.fromNode);
    const to   = graph.nodes.get(edge.toNode);
    if (!from || !to || !from.computed || !to.computed) return true;
    const vb = this._viewportBounds(0);
    const eLeft   = Math.min(from.computed.x, to.computed.x);
    const eTop    = Math.min(from.computed.y, to.computed.y);
    const eRight  = Math.max(from.computed.x + from.computed.w, to.computed.x + to.computed.w);
    const eBottom = Math.max(from.computed.y + from.computed.h, to.computed.y + to.computed.h);
    return eLeft < vb.right && eRight > vb.left && eTop < vb.bottom && eBottom > vb.top;
  }

  // ─────────────────────────────────────────────────────────────────────────

  draw(
    graph,
    {
      selection = new Set(),
      tempEdge = null,
      time = performance.now(),
      activeNodes = new Set(), // Now explicitly passing active nodes
      activeEdges = new Set(),
      activeEdgeTimes = new Map(),
      drawEdges = true,
      loopActiveEdges = false,
      hoveredNodeId = null,
      hoveredPortId = null,
      connecting = false,
      slotLayout = "horizontal",
      alignmentGuides = null,
    } = {}
  ) {
    this.hoveredPortId = hoveredPortId;
    this.slotLayout = slotLayout;
    graph.updateWorldTransforms();

    this.drawGrid();
    const { ctx, theme } = this;
    this._applyTransform();

    // Pre-compute visible node set for O(1) edge culling
    const vb = this._viewportBounds(200);
    const visibleNodes = new Set();
    for (const n of graph.nodes.values()) {
      if (this._nodeInView(n, vb)) visibleNodes.add(n.id);
    }

    ctx.save();

    // 1. Draw Groups
    for (const n of graph.nodes.values()) {
      if (n.type === "core/Group") {
        if (!visibleNodes.has(n.id)) continue;
        const sel = selection.has(n.id);
        const def = this.registry?.types?.get(n.type);
        if (def?.onDraw) def.onDraw(n, { ctx, theme, renderer: this });
        else this._drawNode(n, sel);
      }
    }

    // 2. Draw Edges
    if (drawEdges) {
      ctx.lineWidth = 5.5 / this.scale;

      for (const e of graph.edges.values()) {
        if (!this._edgeInView(graph, e, visibleNodes)) continue;
        const isActive = activeEdges && activeEdges.has(e.id);

        if (isActive) {
          const deepColor = this._getEdgeDeepColor(graph, e);
          const isExecEdge = this._getEdgePortType(graph, e) === 'exec';

          ctx.save();
          ctx.setLineDash([]);

          // Dark outer shell
          ctx.strokeStyle = 'rgba(0,0,0,0.9)';
          ctx.lineWidth = 3.8 / this.scale;
          this._drawEdge(graph, e);

          // Soft colored halo
          ctx.strokeStyle = this._softAlpha(deepColor, 0.22);
          ctx.lineWidth = 2.8 / this.scale;
          this._drawEdge(graph, e);

          // Flowing animated dashes — exec: discrete pulses, data: continuous stream
          const dashLen = (isExecEdge ? 6 : 9) / this.scale;
          const gapLen  = (isExecEdge ? 12 : 7) / this.scale;
          ctx.setLineDash([dashLen, gapLen]);
          ctx.lineDashOffset = -(time / 1000) * 95;
          ctx.strokeStyle = deepColor;
          ctx.lineWidth = 1.8 / this.scale;
          ctx.shadowColor = deepColor;
          ctx.shadowBlur = 4 / this.scale;
          ctx.lineCap = 'round';
          this._drawEdge(graph, e);

          // Bright white core on each dash
          ctx.shadowBlur = 0;
          ctx.strokeStyle = 'rgba(255,255,255,0.65)';
          ctx.lineWidth = 0.6 / this.scale;
          this._drawEdge(graph, e);

          ctx.restore();
        } else {
          const isExecEdge = this._getEdgePortType(graph, e) === 'exec';

          ctx.save();
          ctx.setLineDash([]);

          // Dark outer shell
          ctx.strokeStyle = 'rgba(0,0,0,0.75)';
          ctx.lineWidth = 4.2 / this.scale;
          this._drawEdge(graph, e);

          // Visible mid-tone wire base
          ctx.strokeStyle = 'rgba(78, 93, 110, 0.70)';
          ctx.lineWidth = 2.8 / this.scale;
          this._drawEdge(graph, e);

          // Port-type color accent
          ctx.strokeStyle = isExecEdge
            ? 'rgba(52, 211, 153, 0.40)'
            : 'rgba(102, 217, 239, 0.34)';
          ctx.lineWidth = 1.5 / this.scale;
          this._drawEdge(graph, e);

          ctx.restore();
        }
      }
    }

    // temp edge preview
    if (tempEdge) {
      const a = this.screenToWorld(tempEdge.x1, tempEdge.y1);
      const b = this.screenToWorld(tempEdge.x2, tempEdge.y2);

      const prevDash = this.ctx.getLineDash();
      this.ctx.setLineDash([5 / this.scale, 7 / this.scale]);
      this.ctx.strokeStyle = tempEdge.incompatible ? 'rgba(239,68,68,0.85)' : this._rgba(this.theme.accentBright, 0.7);
      this.ctx.lineWidth = 1.5 / this.scale;

      let ptsForArrow = null;
      if (this.edgeStyle === "line") {
        this._drawLine(a.x, a.y, b.x, b.y);
        ptsForArrow = [
          { x: a.x, y: a.y },
          { x: b.x, y: b.y },
        ];
      } else if (this.edgeStyle === "orthogonal") {
        ptsForArrow = this._drawOrthogonal(a.x, a.y, b.x, b.y);
      } else {
        this._drawCurve(a.x, a.y, b.x, b.y);
        ptsForArrow = [
          { x: a.x, y: a.y },
          { x: b.x, y: b.y },
        ];
      }

      this.ctx.setLineDash(prevDash);

      if (ptsForArrow && ptsForArrow.length >= 2) {
        const p1 = ptsForArrow[ptsForArrow.length - 2];
        const p2 = ptsForArrow[ptsForArrow.length - 1];
        this.ctx.fillStyle = this.theme.accentBright;
        this._drawArrowhead(p1.x, p1.y, p2.x, p2.y, 8);
      }
    }

    // 3. Draw Non-Group Nodes
    for (const n of graph.nodes.values()) {
      if (n.type !== "core/Group") {
        if (!visibleNodes.has(n.id)) continue;
        const sel = selection.has(n.id);
        const def = this.registry?.types?.get(n.type);
        const hasHtmlOverlay = !!def?.html;
        const showPorts = connecting || (hoveredNodeId === n.id);

        this._drawNode(n, sel, !showPorts);

        if (def?.onDraw) {
          def.onDraw(n, { ctx, theme, renderer: this });
        }

        if (hasHtmlOverlay && showPorts) {
          this._drawPorts(n);
        }
      }
    }

    // 4. Highlight Active Nodes (Marching Ants)
    if (activeNodes.size > 0) {
      for (const nodeId of activeNodes) {
        const node = graph.nodes.get(nodeId);
        if (node && visibleNodes.has(nodeId)) this._drawActiveNodeBorder(node, time);
      }
    }

    // Draw alignment guidelines
    if (alignmentGuides) {
      ctx.save();
      ctx.strokeStyle = theme.alignmentGuide || "rgba(0, 245, 255, 0.4)"; // glowing cyan
      ctx.lineWidth = 1 / this.scale; // 1px thin
      ctx.setLineDash([4 / this.scale, 4 / this.scale]); // dotted

      // Draw horizontal guides (constant Y)
      if (alignmentGuides.h && Array.isArray(alignmentGuides.h)) {
        for (const y of alignmentGuides.h) {
          ctx.beginPath();
          ctx.moveTo(vb.left, y);
          ctx.lineTo(vb.right, y);
          ctx.stroke();
        }
      }

      // Draw vertical guides (constant X)
      if (alignmentGuides.v && Array.isArray(alignmentGuides.v)) {
        for (const x of alignmentGuides.v) {
          ctx.beginPath();
          ctx.moveTo(x, vb.top);
          ctx.lineTo(x, vb.bottom);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    this._resetTransform();
  }

  _rgba(hex, a) {
    const c = hex.replace("#", "");
    const n = parseInt(
      c.length === 3
        ? c
            .split("")
            .map((x) => x + x)
            .join("")
        : c,
      16
    );
    const r = (n >> 16) & 255,
      g = (n >> 8) & 255,
      b = n & 255;
    return `rgba(${r},${g},${b},${a})`;
  }

  _softAlpha(color, alpha) {
    if (typeof color !== "string") return color;
    if (color.startsWith("#")) return this._rgba(color, alpha);
    const rgbaMatch = color.match(/rgba?\(([^)]+)\)/);
    if (!rgbaMatch) return color;
    const parts = rgbaMatch[1].split(",").map((part) => part.trim());
    const [r, g, b] = parts;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /** Returns icon name list for a node from its registry definition. */
  _getNodeIconNames(node) {
    const def = this.registry?.types?.get(node.type);
    if (!def) return [];
    if (Array.isArray(def.icons)) return def.icons;
    if (typeof def.icon === 'string') return [def.icon];
    return [];
  }

  /**
   * Returns hit rect info for each icon on a node (world coordinates).
   * @returns {{ cx: number, cy: number, r: number, name: string, index: number }[]}
   */
  getNodeIconRects(node) {
    const iconNames = this._getNodeIconNames(node);
    const headerH = this.theme.headerHeight ?? 22;
    const iconSize = 10;
    const iconPad = 8;
    const { x, y, w } = node.computed;
    const cy = y + headerH / 2;
    const rects = [];
    const hasError = !!node._execError;

    // Right-side icon stack (mirrors _drawNode order)
    let rightOff = 13;
    if (hasError) {
      rects.push({ cx: x + w - rightOff, cy, r: 10, name: '__error__', index: -1 });
      rightOff += 14;
    }
    if (node.locked) {
      rects.push({ cx: x + w - rightOff, cy, r: 10, name: '__lock__', index: -2 });
      rightOff += 14;
    }
    iconNames.forEach((name, i) => {
      if (name === 'expand') {
        rects.push({ cx: x + w - rightOff, cy, r: 10, name, index: i });
        rightOff += 14;
      } else {
        rects.push({ cx: x + iconPad + iconSize * 0.5, cy, r: 10, name, index: i });
      }
    });
    return rects;
  }

  _getEdgePortType(graph, e) {
    const from = graph.nodes.get(e.fromNode);
    if (!from) return "data";
    const port = from.outputs.find((p) => p.id === e.fromPort);
    return port?.portType ?? "data";
  }

  _getEdgeBaseColor(graph, e) {
    return "#3B3B3B";
  }

  _getEdgeActiveColor(graph, e) {
    const isExec = this._getEdgePortType(graph, e) === "exec";
    return isExec
      ? (this.theme.edgeActive ?? "#8dd7b4")
      : (this.theme.edgeActiveData ?? "#92cdda");
  }

  _getEdgeDeepColor(graph, e) {
    const isExec = this._getEdgePortType(graph, e) === "exec";
    return isExec
      ? (this.theme.portExec ?? "#34d399")
      : (this.theme.port ?? "#66d9ef");
  }

  _drawNode(node, selected, skipPorts = false) {
    const { ctx, theme } = this;
    const r = theme.nodeRadius ?? 8;
    const accentRadius = Math.max(0, r - 2 / this.scale);
    const { x, y, w, h } = node.computed;
    const headerH = theme.headerHeight ?? 22;

    // Get color from node or registry
    const typeDef = this.registry?.types?.get(node.type);
    const categoryColor = node.color || typeDef?.color || theme.accent;

    if (node.type === "core/Reroute") {
      ctx.save();
      const cx = x + w / 2;
      const cy = y + h / 2;
      if (selected) {
        ctx.beginPath();
        ctx.arc(cx, cy, 9, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(102, 204, 255, 0.5)";
        ctx.lineWidth = 3 / this.scale;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fillStyle = selected ? "#6cf" : "#34d399";
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      return;
    }

    ctx.save();
    if (node.mute) {
      ctx.globalAlpha = 0.45;
    } else if (node.bypass) {
      ctx.globalAlpha = 0.75;
    }

    // Selection highlight — category-colored glow outline
    if (selected) {
      ctx.save();
      ctx.strokeStyle = this._rgba(categoryColor, 0.7);
      ctx.lineWidth = 1.2 / this.scale;
      ctx.shadowColor = this._rgba(categoryColor, 0.45);
      ctx.shadowBlur = 7 / this.scale;
      const selPad = 5 / this.scale;
      roundRect(ctx, x - selPad, y - selPad, w + selPad * 2, h + selPad * 2, (r + 4) / this.scale);
      ctx.stroke();
      ctx.restore();
    }

    // Drop shadow
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.28)";
    ctx.shadowBlur = 18 / this.scale;
    ctx.shadowOffsetY = 8 / this.scale;
    ctx.fillStyle = "#1E1E1E";
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.restore();

    // Node body base
    ctx.fillStyle = "#1E1E1E";
    ctx.strokeStyle = selected ? this._rgba(categoryColor, 0.38) : "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1.2 / this.scale;
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.stroke();

    // Subtle body tint — category color bleeds down from header
    ctx.save();
    const bodyTint = ctx.createLinearGradient(x, y + headerH, x, y + h);
    bodyTint.addColorStop(0, this._rgba(categoryColor, 0.06));
    bodyTint.addColorStop(0.6, 'rgba(0,0,0,0)');
    ctx.fillStyle = bodyTint;
    roundRect(ctx, x, y + headerH, w, h - headerH, { tl: 0, tr: 0, br: r, bl: r });
    ctx.fill();
    ctx.restore();

    // Header background — dark base
    const headerBase = ctx.createLinearGradient(x, y, x, y + headerH);
    headerBase.addColorStop(0, "rgba(56, 65, 79, 0.96)");
    headerBase.addColorStop(1, "rgba(44, 52, 64, 0.96)");
    ctx.fillStyle = headerBase;
    roundRect(ctx, x, y, w, headerH, { tl: r, tr: r, br: 0, bl: 0 });
    ctx.fill();

    // Vivid category color fill on header
    ctx.save();
    const headerGradient = ctx.createLinearGradient(x, y, x + w, y + headerH);
    headerGradient.addColorStop(0, this._rgba(categoryColor, 0.1));
    headerGradient.addColorStop(0.55, this._rgba(categoryColor, 0.04));
    headerGradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = headerGradient;
    roundRect(ctx, x, y, w, headerH, { tl: r, tr: r, br: 0, bl: 0 });
    ctx.fill();
    ctx.restore();

    // Accent bar — red when node has a runtime error
    const hasError = !!node._execError;
    ctx.save();
    ctx.fillStyle = hasError ? 'rgba(239,68,68,0.92)' : this._rgba(categoryColor, 0.92);
    ctx.beginPath();
    ctx.roundRect(x, y, w, 2.5 / this.scale, { tl: accentRadius, tr: accentRadius, br: 0, bl: 0 });
    ctx.fill();
    ctx.restore();

    // Error tint overlay on header
    if (hasError) {
      ctx.save();
      ctx.fillStyle = 'rgba(239,68,68,0.07)';
      roundRect(ctx, x, y, w, headerH, { tl: r, tr: r, br: 0, bl: 0 });
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1 / this.scale;
    ctx.beginPath();
    ctx.moveTo(x + 1 / this.scale, y + headerH);
    ctx.lineTo(x + w - 1 / this.scale, y + headerH);
    ctx.stroke();
    ctx.restore();

    // Header layout: [leftPad][icon][gap][title...][...][expand-btn]
    const iconNames = this._getNodeIconNames(node);
    const iconSize = 10;
    const iconPad = 8;
    const iconGap = 5;
    // cy: geometric center of header — used for icons and right buttons
    const cy = y + headerH / 2;
    // titleCy: shift text down by 0.5 screen px to compensate for cap-height vs
    // em-square midpoint (Inter caps sit ~1 px above the canvas "middle" baseline)
    const titleCy = cy + 0.5 / this.scale;

    // Primary type icon — left of title (all except 'expand')
    const primaryIcon = iconNames.find(n => n !== 'expand');
    let titleX = x + iconPad;
    if (primaryIcon && this.iconManager) {
      const cx = x + iconPad + iconSize * 0.5;
      this.iconManager.draw(ctx, primaryIcon, cx, cy, iconSize, node);
      titleX = cx + iconSize * 0.5 + iconGap;
    }

    // Locked node: subtle bottom-right badge + body hatch
    if (node.locked) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1 / this.scale;
      const step = 10 / this.scale;
      ctx.beginPath();
      for (let d = step; d < w + h; d += step) {
        ctx.moveTo(x + Math.min(d, w), y + headerH + Math.max(0, d - w));
        ctx.lineTo(x + Math.max(0, d - (h - headerH)), y + headerH + Math.min(d, h - headerH));
      }
      ctx.stroke();
      ctx.restore();
    }

    // Right-side icon stack: icons added right-to-left, each 14px wide
    // rightOff = distance from right edge to current slot center
    let rightOff = 13;

    if (hasError && this.iconManager) {
      this.iconManager.draw(ctx, 'warning', x + w - rightOff, cy, iconSize, node);
      rightOff += 14;
    }

    if (node.locked && this.iconManager) {
      this.iconManager.draw(ctx, 'lock', x + w - rightOff, cy, iconSize, node);
      rightOff += 14;
    }

    const hasExpand = iconNames.includes('expand');
    if (hasExpand && this.iconManager) {
      const btnCx = x + w - rightOff;
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.beginPath();
      ctx.roundRect(btnCx - 9, cy - 8, 18, 16, 3);
      ctx.fill();
      ctx.restore();
      this.iconManager.draw(ctx, 'expand', btnCx, cy, iconSize, node);
      rightOff += 14;
    }

    const rightReserved = rightOff;

    // Title — use titleCy (icon cy + 0.5px offset) for optical alignment
    let displayTitle = node.title;
    if (node.mute) {
      displayTitle += " [Muted]";
    } else if (node.bypass) {
      displayTitle += " [Bypassed]";
    }

    this._drawScreenText(displayTitle, titleX, titleCy, {
      fontPx: CanvasRenderer.FONT_SIZE,
      color: theme.text,
      baseline: "middle",
      align: "left",
      maxWidth: x + w - titleX - rightReserved,
    });

    if (skipPorts) {
      ctx.restore();
      return;
    }

    // Input ports + labels
    node.inputs.forEach((p, i) => {
      const rct = portRect(node, p, i, "in", this.slotLayout);
      const cx = rct.x + rct.w / 2;
      const cy = rct.y + rct.h / 2;
      this._drawPortShape(cx, cy, p.portType, p.id === this.hoveredPortId);
      if (p.name) {
        const isVert = this.slotLayout === "vertical";
        this._drawScreenText(p.name, isVert ? cx : cx + 10, isVert ? cy + 10 : cy, {
          fontPx: 10,
          color: theme.textMuted,
          baseline: isVert ? "top" : "middle",
          align: isVert ? "center" : "left",
        });
      }
    });

    // Output ports + labels
    node.outputs.forEach((p, i) => {
      const rct = portRect(node, p, i, "out", this.slotLayout);
      const cx = rct.x + rct.w / 2;
      const cy = rct.y + rct.h / 2;
      this._drawPortShape(cx, cy, p.portType, p.id === this.hoveredPortId);
      if (p.name) {
        const isVert = this.slotLayout === "vertical";
        this._drawScreenText(p.name, isVert ? cx : cx - 10, isVert ? cy - 10 : cy, {
          fontPx: 10,
          color: theme.textMuted,
          baseline: isVert ? "bottom" : "middle",
          align: isVert ? "center" : "right",
        });
      }
    });

    ctx.restore();
  }

  // Internal helper for rounded rectangles if not using the browser's native one
  _roundRect(ctx, x, y, w, h, r) {
    if (typeof r === "number") {
      r = { tl: r, tr: r, br: r, bl: r };
    }
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

  _drawPortShape(cx, cy, portType, isHovered = false) {
    const { ctx, theme } = this;

    if (portType === "exec") {
      let s = 4.2 / this.scale;
      ctx.save();
      
      if (isHovered) {
        // Draw an elegant, very soft glowing aura diamond
        const auraS = 6.4 / this.scale;
        ctx.fillStyle = this._softAlpha(theme.portExec, 0.07);
        ctx.beginPath();
        ctx.moveTo(cx, cy - auraS);
        ctx.lineTo(cx + auraS, cy);
        ctx.lineTo(cx, cy + auraS);
        ctx.lineTo(cx - auraS, cy);
        ctx.closePath();
        ctx.fill();

        s = 4.5 / this.scale;
      }
      
      ctx.fillStyle = theme.portExec;
      ctx.strokeStyle = this._softAlpha(theme.portExec, 0.4);
      ctx.lineWidth = 1.0 / this.scale;
      ctx.beginPath();
      ctx.moveTo(cx, cy - s);
      ctx.lineTo(cx + s, cy);
      ctx.lineTo(cx, cy + s);
      ctx.lineTo(cx - s, cy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.save();
      
      let outerRadius = 5.2 / this.scale;
      let innerRadius = 3.2 / this.scale;
      let strokeWidth = 1.0 / this.scale;
      
      if (isHovered) {
        // Draw an elegant, very soft glowing aura circle
        ctx.fillStyle = this._softAlpha(theme.port, 0.07);
        ctx.beginPath();
        ctx.arc(cx, cy, 7.5 / this.scale, 0, Math.PI * 2);
        ctx.fill();

        outerRadius = 5.5 / this.scale;
        innerRadius = 3.5 / this.scale;
        strokeWidth = 1.0 / this.scale;
      }

      ctx.strokeStyle = this._softAlpha(theme.port, 0.4);
      ctx.lineWidth = strokeWidth;
      ctx.beginPath();
      ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2);
      ctx.stroke();
      
      ctx.fillStyle = theme.port;
      ctx.beginPath();
      ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    }
  }

  _drawPorts(node) {
    node.inputs.forEach((p, i) => {
      const rct = portRect(node, p, i, "in", this.slotLayout || "horizontal");
      const cx = rct.x + rct.w / 2;
      const cy = rct.y + rct.h / 2;
      this._drawPortShape(cx, cy, p.portType, p.id === this.hoveredPortId);
    });

    node.outputs.forEach((p, i) => {
      const rct = portRect(node, p, i, "out", this.slotLayout || "horizontal");
      const cx = rct.x + rct.w / 2;
      const cy = rct.y + rct.h / 2;
      this._drawPortShape(cx, cy, p.portType, p.id === this.hoveredPortId);
    });
  }
  /** Selection border for HTML overlay nodes, drawn on the edge canvas */
  _drawHtmlSelectionBorder(node) {
    const { ctx } = this;
    const { x, y, w, h } = node.computed;
    const r = this.theme.nodeRadius ?? 8;
    const pad = 5 / this.scale;

    const typeDef = this.registry?.types?.get(node.type);
    const categoryColor = node.color || typeDef?.color || this.theme.accent;

    ctx.save();
    ctx.strokeStyle = this._rgba(categoryColor, 0.7);
    ctx.lineWidth = 1.2 / this.scale;
    ctx.shadowColor = this._rgba(categoryColor, 0.4);
    ctx.shadowBlur = 6 / this.scale;
    roundRect(ctx, x - pad, y - pad, w + pad * 2, h + pad * 2, r + pad);
    ctx.stroke();
    ctx.restore();
  }

  /** Rotating dashed border drawn on the edge canvas for executing nodes */
  _drawActiveNodeBorder(node, time) {
    const { ctx } = this;
    const { x, y, w, h } = node.computed;
    const r = this.theme.nodeRadius ?? 8;
    const pad = 8 / this.scale;

    const typeDef = this.registry?.types?.get(node.type);
    const categoryColor = node.color || typeDef?.color || this.theme.accent;

    const dashLen = 6 / this.scale;
    const gapLen = 4 / this.scale;
    const offset = -(time / 1000) * 60;

    ctx.save();
    ctx.setLineDash([dashLen, gapLen]);
    ctx.lineDashOffset = offset;
    ctx.strokeStyle = this._rgba(categoryColor, 0.8);
    ctx.shadowColor = this._rgba(categoryColor, 0.5);
    ctx.shadowBlur = 5 / this.scale;
    ctx.lineWidth = 1.5 / this.scale;
    roundRect(ctx, x - pad, y - pad, w + pad * 2, h + pad * 2, r + pad);
    ctx.stroke();
    ctx.restore();
  }

  _getEdgeEndpoints(graph, e) {
    const from = graph.nodes.get(e.fromNode);
    const to = graph.nodes.get(e.toNode);
    if (!from || !to) return null;

    const iOut = from.outputs.findIndex((p) => p.id === e.fromPort);
    const iIn = to.inputs.findIndex((p) => p.id === e.toPort);
    const pr1 = portRect(from, null, iOut, "out", this.slotLayout);
    const pr2 = portRect(to, null, iIn, "in", this.slotLayout);

    return {
      x1: pr1.x + pr1.w / 2,
      y1: pr1.y + pr1.h / 2,
      x2: pr2.x + pr2.w / 2,
      y2: pr2.y + pr2.h / 2,
    };
  }

  _drawEdgeLabel(wx, wy, text) {
    const { ctx } = this;
    const fontSize = Math.max(9, 11 / this.scale);
    ctx.save();
    ctx.font = `500 ${fontSize}px ${this.theme.fontFamily || "Inter, sans-serif"}`;
    const metrics = ctx.measureText(text);
    const tw = metrics.width;
    const th = fontSize;
    const padX = 5 / this.scale;
    const padY = 3 / this.scale;
    const rx = 4 / this.scale;
    const bw = tw + padX * 2;
    const bh = th + padY * 2;
    const bx = wx - bw / 2;
    const by = wy - bh / 2;
    ctx.fillStyle = "rgba(20,20,30,0.82)";
    ctx.strokeStyle = "rgba(120,120,160,0.45)";
    ctx.lineWidth = 0.8 / this.scale;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, rx);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(220,220,255,0.9)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, wx, wy);
    ctx.restore();
  }

  _getOrthogonalRouteValues(endpoints, route = {}) {
    const { x1, y1, x2, y2 } = endpoints;
    const dir = x2 >= x1 ? 1 : -1;
    const span = Math.abs(x2 - x1);
    const minGap = Math.min(12, span / 3);
    const clampAlongFlow = (value, min, max) =>
      dir > 0 ? Math.max(min, Math.min(max, value)) : Math.min(min, Math.max(max, value));
    const legacySplitX1 = Number.isFinite(route.splitX1) ? route.splitX1 : null;
    const legacySplitX2 = Number.isFinite(route.splitX2) ? route.splitX2 : null;
    const fallbackSplitX = Number.isFinite(route.splitX)
      ? route.splitX
      : legacySplitX1 != null && legacySplitX2 != null
        ? (legacySplitX1 + legacySplitX2) / 2
        : (x1 + x2) / 2;
    const fromXRaw = Number.isFinite(route.fromX)
      ? route.fromX
      : legacySplitX1 != null
        ? legacySplitX1
        : fallbackSplitX;
    const splitXRaw = Number.isFinite(route.splitX) ? route.splitX : fallbackSplitX;
    const toXRaw = Number.isFinite(route.toX)
      ? route.toX
      : legacySplitX2 != null
        ? legacySplitX2
        : fallbackSplitX;
    const fromX = clampAlongFlow(fromXRaw, x1, x2);
    const toXBase = clampAlongFlow(toXRaw, x1, x2);
    const orderedMin = dir > 0 ? fromX + minGap : fromX - minGap;
    const orderedToX = clampAlongFlow(toXBase, orderedMin, x2);
    const splitMin = dir > 0 ? fromX + minGap * 0.5 : fromX - minGap * 0.5;
    const splitMax = dir > 0 ? orderedToX - minGap * 0.5 : orderedToX + minGap * 0.5;
    const splitX = clampAlongFlow(splitXRaw, splitMin, splitMax);
    const toMin = dir > 0 ? splitX + minGap * 0.5 : splitX - minGap * 0.5;
    const toX = clampAlongFlow(orderedToX, toMin, x2);
    const legacySplitY = Number.isFinite(route.splitY) ? route.splitY : null;
    const topY = Number.isFinite(route.topY) ? route.topY : legacySplitY != null ? legacySplitY : y1;
    const bottomY = Number.isFinite(route.bottomY) ? route.bottomY : legacySplitY != null ? legacySplitY : y2;

    return { fromX, splitX, toX, topY, bottomY };
  }

  _getOrthogonalPointsFromEdge(graph, e) {
    const endpoints = this._getEdgeEndpoints(graph, e);
    if (!endpoints) return [];

    const { x1, y1, x2, y2 } = endpoints;
    const { fromX, splitX, toX, topY, bottomY } = this._getOrthogonalRouteValues(
      endpoints,
      e.route || {}
    );

    const rawPoints = [
      { x: x1, y: y1 },
      { x: fromX, y: y1 },
      { x: fromX, y: topY },
      { x: splitX, y: topY },
      { x: splitX, y: bottomY },
      { x: toX, y: bottomY },
      { x: toX, y: y2 },
      { x: x2, y: y2 },
    ];

    return rawPoints.filter((point, index) => {
      if (index === 0) return true;
      const prev = rawPoints[index - 1];
      return prev.x !== point.x || prev.y !== point.y;
    });
  }

  _getEdgePolylinePoints(graph, e) {
    if (this.edgeStyle === "orthogonal") {
      return this._getOrthogonalPointsFromEdge(graph, e);
    }

    const endpoints = this._getEdgeEndpoints(graph, e);
    if (!endpoints) return [];
    const { x1, y1, x2, y2 } = endpoints;
    return [
      { x: x1, y: y1 },
      { x: x2, y: y2 },
    ];
  }

  /** Approximate arc length of an edge in world coordinates */
  _getEdgeLength(graph, e) {
    if (this.edgeStyle === "orthogonal") {
      const pts = this._getOrthogonalPointsFromEdge(graph, e);
      if (pts.length < 2) return 200;
      let total = 0;
      for (let i = 1; i < pts.length; i++) {
        total += Math.abs(pts[i].x - pts[i - 1].x) + Math.abs(pts[i].y - pts[i - 1].y);
      }
      return total;
    }
    const endpoints = this._getEdgeEndpoints(graph, e);
    if (!endpoints) return 200;
    const { x1, y1, x2, y2 } = endpoints;
    const chord = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    return this.edgeStyle === "bezier" ? chord * 1.4 : chord;
  }

  _drawEdge(graph, e) {
    const endpoints = this._getEdgeEndpoints(graph, e);
    if (!endpoints) return;
    const { x1, y1, x2, y2 } = endpoints;

    if (this.edgeStyle === "line") {
      this._drawLine(x1, y1, x2, y2);
    } else if (this.edgeStyle === "orthogonal") {
      this._drawOrthogonalPoints(this._getOrthogonalPointsFromEdge(graph, e));
    } else {
      this._drawCurve(x1, y1, x2, y2);
    }
  }

  _getEdgeDotPosition(graph, e, t) {
    const endpoints = this._getEdgeEndpoints(graph, e);
    if (!endpoints) return null;
    const { x1, y1, x2, y2 } = endpoints;

    if (this.edgeStyle === "bezier") {
      const dx = Math.max(40, Math.abs(x2 - x1) * 0.4);
      return cubicBezierPoint(x1, y1, x1 + dx, y1, x2 - dx, y2, x2, y2, t);
    } else if (this.edgeStyle === "orthogonal") {
      return polylinePoint(this._getOrthogonalPointsFromEdge(graph, e), t);
    } else {
      return { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t };
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
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
  }

  _drawOrthogonalPoints(pts) {
    if (!pts?.length) return pts;
    const { ctx } = this;
    const prevJoin = ctx.lineJoin,
      prevCap = ctx.lineCap;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    this._drawPolyline(pts);
    ctx.lineJoin = prevJoin;
    ctx.lineCap = prevCap;

    return pts;
  }

  _drawOrthogonal(x1, y1, x2, y2) {
    const midX = (x1 + x2) / 2;
    return this._drawOrthogonalPoints([
      { x: x1, y: y1 },
      { x: midX, y: y1 },
      { x: midX, y: y2 },
      { x: x2, y: y2 },
    ]);
  }

  _drawCurve(x1, y1, x2, y2) {
    const { ctx } = this;
    const dx = Math.max(40, Math.abs(x2 - x1) * 0.4);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(x1 + dx, y1, x2 - dx, y2, x2, y2);
    ctx.stroke();
  }

  drawEdgesOnly(
    graph,
    {
      activeEdges = new Set(),
      activeEdgeTimes = new Map(),
      activeNodes = new Set(),
      selection = new Set(),
      time = performance.now(),
      tempEdge = null,
      loopActiveEdges = false,
      slotLayout = "horizontal",
    } = {}
  ) {
    this.slotLayout = slotLayout;
    this.clear();

    this._applyTransform();

    const { ctx, theme } = this;

    // Pre-compute visible nodes for edge culling
    const vb2 = this._viewportBounds(200);
    const visibleNodes2 = new Set();
    for (const n of graph.nodes.values()) {
      if (this._nodeInView(n, vb2)) visibleNodes2.add(n.id);
    }

    // Draw all edges
    for (const e of graph.edges.values()) {
      if (!this._edgeInView(graph, e, visibleNodes2)) continue;
      const isActive = activeEdges.has(e.id);

      if (isActive) {
        const deepColor = this._getEdgeDeepColor(graph, e);
        const isExecEdge = this._getEdgePortType(graph, e) === 'exec';

        ctx.save();
        ctx.setLineDash([]);

        // Dark outer shell
        ctx.strokeStyle = 'rgba(0,0,0,0.9)';
        ctx.lineWidth = 3.8 / this.scale;
        this._drawEdge(graph, e);

        // Soft colored halo
        ctx.strokeStyle = this._softAlpha(deepColor, 0.22);
        ctx.lineWidth = 2.8 / this.scale;
        this._drawEdge(graph, e);

        // Flowing animated dashes — exec: discrete pulses, data: continuous stream
        const dashLen = (isExecEdge ? 6 : 9) / this.scale;
        const gapLen  = (isExecEdge ? 12 : 7) / this.scale;
        ctx.setLineDash([dashLen, gapLen]);
        ctx.lineDashOffset = -(time / 1000) * 95;
        ctx.strokeStyle = deepColor;
        ctx.lineWidth = 1.8 / this.scale;
        ctx.shadowColor = deepColor;
        ctx.shadowBlur = 4 / this.scale;
        ctx.lineCap = 'round';
        this._drawEdge(graph, e);

        // Bright white core on each dash
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.65)';
        ctx.lineWidth = 0.6 / this.scale;
        this._drawEdge(graph, e);

        ctx.restore();
      } else {
        const isExecEdge = this._getEdgePortType(graph, e) === 'exec';

        ctx.save();
        ctx.setLineDash([]);

        // Dark outer shell
        ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.lineWidth = 4.2 / this.scale;
        this._drawEdge(graph, e);

        // Visible mid-tone wire base
        ctx.strokeStyle = 'rgba(78, 93, 110, 0.70)';
        ctx.lineWidth = 2.8 / this.scale;
        this._drawEdge(graph, e);

        // Port-type color accent
        ctx.strokeStyle = isExecEdge
          ? 'rgba(52, 211, 153, 0.40)'
          : 'rgba(102, 217, 239, 0.34)';
        ctx.lineWidth = 1.5 / this.scale;
        this._drawEdge(graph, e);

        ctx.restore();
      }

      // Edge label at geometric midpoint
      if (e.label) {
        const ep = this._getEdgeEndpoints(graph, e);
        if (ep) {
          const mx = (ep.x1 + ep.x2) / 2;
          const my = (ep.y1 + ep.y2) / 2;
          this._drawEdgeLabel(mx, my, e.label);
        }
      }
    }

    // Selection borders for HTML overlay nodes (drawn above the HTML layer)
    for (const nodeId of selection) {
      const node = graph.nodes.get(nodeId);
      if (!node || !visibleNodes2.has(nodeId)) continue;
      const def = this.registry?.types?.get(node.type);
      if (def?.html) this._drawHtmlSelectionBorder(node);
    }

    // Rotating dashed border for executing nodes
    if (activeNodes.size > 0) {
      for (const nodeId of activeNodes) {
        const node = graph.nodes.get(nodeId);
        if (node && visibleNodes2.has(nodeId)) this._drawActiveNodeBorder(node, time);
      }
    }

    // temp edge preview
    if (tempEdge) {
      const a = this.screenToWorld(tempEdge.x1, tempEdge.y1);
      const b = this.screenToWorld(tempEdge.x2, tempEdge.y2);

      const prevDash = this.ctx.getLineDash();
      this.ctx.setLineDash([5 / this.scale, 7 / this.scale]);
      this.ctx.strokeStyle = tempEdge.incompatible ? 'rgba(239,68,68,0.85)' : this._rgba(this.theme.accentBright, 0.7);
      this.ctx.lineWidth = 1.5 / this.scale;

      let ptsForArrow = null;
      if (this.edgeStyle === "line") {
        this._drawLine(a.x, a.y, b.x, b.y);
        ptsForArrow = [
          { x: a.x, y: a.y },
          { x: b.x, y: b.y },
        ];
      } else if (this.edgeStyle === "orthogonal") {
        ptsForArrow = this._drawOrthogonal(a.x, a.y, b.x, b.y);
      } else {
        this._drawCurve(a.x, a.y, b.x, b.y);
        ptsForArrow = [
          { x: a.x, y: a.y },
          { x: b.x, y: b.y },
        ];
      }

      this.ctx.setLineDash(prevDash);

      if (ptsForArrow && ptsForArrow.length >= 2) {
        const p1 = ptsForArrow[ptsForArrow.length - 2];
        const p2 = ptsForArrow[ptsForArrow.length - 1];
        this.ctx.fillStyle = this.theme.accentBright;
        this._drawArrowhead(p1.x, p1.y, p2.x, p2.y, 8);
      }
    }

    this._resetTransform();
  }
}

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

function cubicBezierPoint(x0, y0, x1, y1, x2, y2, x3, y3, t) {
  const mt = 1 - t;
  return {
    x: mt * mt * mt * x0 + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x3,
    y: mt * mt * mt * y0 + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y3,
  };
}

function polylinePoint(pts, t) {
  let totalLen = 0;
  const lens = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x;
    const dy = pts[i + 1].y - pts[i].y;
    const len = Math.sqrt(dx * dx + dy * dy);
    lens.push(len);
    totalLen += len;
  }
  if (totalLen === 0) return pts[0];

  let target = t * totalLen;
  let accum = 0;
  for (let i = 0; i < lens.length; i++) {
    if (accum + lens[i] >= target) {
      const segT = lens[i] > 0 ? (target - accum) / lens[i] : 0;
      return {
        x: pts[i].x + (pts[i + 1].x - pts[i].x) * segT,
        y: pts[i].y + (pts[i + 1].y - pts[i].y) * segT,
      };
    }
    accum += lens[i];
  }
  return pts[pts.length - 1];
}
