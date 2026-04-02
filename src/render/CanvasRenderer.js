import { portRect } from "./hitTest.js";

export class CanvasRenderer {
  static FONT_SIZE = 11;
  static SELECTED_NODE_COLOR = "#6cf";
  constructor(canvas, { theme = {}, registry, edgeStyle = "orthogonal" } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.registry = registry;

    this.scale = 1;
    this.minScale = 0.25;
    this.maxScale = 3;
    this.offsetX = 0;
    this.offsetY = 0;

    // 'bezier' | 'line' | 'orthogonal'
    this.edgeStyle = edgeStyle;

    this.theme = Object.assign(
      {
        bg: "#0e0e16",
        grid: "#1c1c2c",
        node: "rgba(22, 22, 34, 0.9)",
        nodeBorder: "rgba(255, 255, 255, 0.08)",
        title: "rgba(28, 28, 42, 0.95)",
        text: "#f5f5f7",
        textMuted: "#8e8eaf",
        port: "#4f46e5",
        portExec: "#10b981",
        edge: "rgba(255, 255, 255, 0.12)",
        edgeActive: "#6366f1",
        accent: "#6366f1",
        accentBright: "#818cf8",
        accentGlow: "rgba(99, 102, 241, 0.25)",
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
    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);
  }
  _resetTransform() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
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
    {
      fontPx = 11,
      color = this.theme.text,
      align = "left",
      baseline = "alphabetic",
    } = {}
  ) {
    const { ctx } = this;
    const { x: sx, y: sy } = this.worldToScreen(lx, ly);

    ctx.save();
    this._resetTransform();

    const px = Math.round(sx) + 0.5;
    const py = Math.round(sy) + 0.5;

    ctx.font = `${fontPx * this.scale}px "Inter", system-ui, sans-serif`;
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

    const x0 = -offsetX / scale;
    const y0 = -offsetY / scale;
    const x1 = (canvas.width - offsetX) / scale;
    const y1 = (canvas.height - offsetY) / scale;

    // Minor dots (24px grid)
    const minorStep = 24;
    const majorStep = 120;
    const minorR = 1 / scale;
    const majorR = 1.5 / scale;

    const startX = Math.floor(x0 / minorStep) * minorStep;
    const startY = Math.floor(y0 / minorStep) * minorStep;

    ctx.fillStyle = this._rgba(theme.grid, 0.7);
    for (let gx = startX; gx <= x1; gx += minorStep) {
      for (let gy = startY; gy <= y1; gy += minorStep) {
        const isMajorX = Math.round(gx / majorStep) * majorStep === Math.round(gx);
        const isMajorY = Math.round(gy / majorStep) * majorStep === Math.round(gy);
        if (isMajorX && isMajorY) continue;
        ctx.beginPath();
        ctx.arc(gx, gy, minorR, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Major intersection dots
    const majorStartX = Math.floor(x0 / majorStep) * majorStep;
    const majorStartY = Math.floor(y0 / majorStep) * majorStep;
    ctx.fillStyle = this._rgba(theme.grid, 1.0);
    for (let gx = majorStartX; gx <= x1; gx += majorStep) {
      for (let gy = majorStartY; gy <= y1; gy += majorStep) {
        ctx.beginPath();
        ctx.arc(gx, gy, majorR, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    this._resetTransform();
  }

  draw(
    graph,
    {
      selection = new Set(),
      tempEdge = null,
      time = performance.now(),
      activeEdges = new Set(),
      drawEdges = true,
    } = {}
  ) {
    graph.updateWorldTransforms();

    this.drawGrid();
    const { ctx, theme } = this;
    this._applyTransform();

    ctx.save();

    // 1. Draw Groups
    for (const n of graph.nodes.values()) {
      if (n.type === "core/Group") {
        const sel = selection.has(n.id);
        const def = this.registry?.types?.get(n.type);
        if (def?.onDraw) def.onDraw(n, { ctx, theme, renderer: this });
        else this._drawNode(n, sel);
      }
    }

    // 2. Draw Edges
    if (drawEdges) {
      ctx.lineWidth = 1.5 / this.scale;

      for (const e of graph.edges.values()) {
        const isActive = activeEdges && activeEdges.has(e.id);

        if (isActive) {
          // Glow pass
          ctx.save();
          ctx.shadowColor = this.theme.edgeActive;
          ctx.shadowBlur = 8 / this.scale;
          ctx.strokeStyle = this.theme.edgeActive;
          ctx.lineWidth = 2 / this.scale;
          ctx.setLineDash([]);
          this._drawEdge(graph, e);
          ctx.restore();

          // Animated flowing dot
          const dotT = ((time / 1000) * 1.2) % 1;
          const dotPos = this._getEdgeDotPosition(graph, e, dotT);
          if (dotPos) {
            ctx.save();
            ctx.fillStyle = "#ffffff";
            ctx.shadowColor = this.theme.edgeActive;
            ctx.shadowBlur = 10 / this.scale;
            ctx.beginPath();
            ctx.arc(dotPos.x, dotPos.y, 3 / this.scale, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        } else {
          ctx.setLineDash([]);
          ctx.strokeStyle = theme.edge;
          ctx.lineWidth = 1.5 / this.scale;
          this._drawEdge(graph, e);
        }
      }
    }

    // temp edge preview
    if (tempEdge) {
      const a = this.screenToWorld(tempEdge.x1, tempEdge.y1);
      const b = this.screenToWorld(tempEdge.x2, tempEdge.y2);

      const prevDash = this.ctx.getLineDash();
      this.ctx.setLineDash([5 / this.scale, 5 / this.scale]);
      this.ctx.strokeStyle = this._rgba(this.theme.accentBright, 0.7);
      this.ctx.lineWidth = 1.5 / this.scale;

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
        this.ctx.fillStyle = this.theme.accentBright;
        this._drawArrowhead(p1.x, p1.y, p2.x, p2.y, 10);
      }
    }

    // 3. Draw Non-Group Nodes
    for (const n of graph.nodes.values()) {
      if (n.type !== "core/Group") {
        const sel = selection.has(n.id);
        const def = this.registry?.types?.get(n.type);
        const hasHtmlOverlay = !!def?.html;

        // Draw node's base aesthetics (headers, colors, rounding) always on canvas.
        // Transparent HTML overlay sits on top for interactive elements.
        this._drawNode(n, sel, !hasHtmlOverlay ? true : false); 
        
        if (def?.onDraw) {
          def.onDraw(n, { ctx, theme, renderer: this });
        }
        
        // Ensure ports are visible
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
      c.length === 3
        ? c.split("").map((x) => x + x).join("")
        : c,
      16
    );
    const r = (n >> 16) & 255,
      g = (n >> 8) & 255,
      b = n & 255;
    return `rgba(${r},${g},${b},${a})`;
  }

  _drawNode(node, selected, skipPorts = false) {
    const { ctx, theme } = this;
    const r = 2; // Sharp 2px rounding
    const { x, y, w, h } = node.computed;
    const headerH = 26; // Slightly taller header for premium feel

    // Get color from node or registry
    const typeDef = this.registry?.types?.get(node.type);
    const categoryColor = node.color || typeDef?.color || theme.accent;

    // Selection glow — same radius as node, offset 2px outside
    if (selected) {
      ctx.save();
      ctx.shadowColor = theme.accentGlow;
      ctx.shadowBlur = 10 / this.scale;
      ctx.strokeStyle = theme.accentBright;
      ctx.lineWidth = 2 / this.scale;
      const pad = 1.5 / this.scale;
      roundRect(ctx, x - pad, y - pad, w + pad * 2, h + pad * 2, r + pad);
      ctx.stroke();
      ctx.restore();
    }

    // Drop shadow
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 20 / this.scale;
    ctx.shadowOffsetY = 6 / this.scale;
    ctx.fillStyle = theme.node;
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.restore();

    // Node body
    ctx.fillStyle = theme.node;
    ctx.strokeStyle = selected ? theme.accentBright : theme.nodeBorder;
    ctx.lineWidth = 1 / this.scale;
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.stroke();

    // Header
    ctx.fillStyle = theme.title;
    roundRect(ctx, x, y, w, headerH, { tl: r, tr: r, br: 0, bl: 0 });
    ctx.fill();

    // Subtle category-based header background
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = categoryColor;
    ctx.globalAlpha = 0.25; // Increased from 0.12 for better visibility
    ctx.fillRect(x, y, w, headerH);
    ctx.restore();

    // Header bottom separator
    ctx.strokeStyle = selected
      ? this._rgba(theme.accentBright, 0.3)
      : this._rgba(theme.nodeBorder, 0.6);
    ctx.lineWidth = 1 / this.scale;
    ctx.beginPath();
    ctx.moveTo(x, y + headerH);
    ctx.lineTo(x + w, y + headerH);
    ctx.stroke();

    // Accent strip at top
    ctx.fillStyle = categoryColor;
    ctx.beginPath();
    ctx.roundRect(x, y, w, 2.5 / this.scale, { tl: r, tr: r, br: 0, bl: 0 });
    ctx.fill();

    // Title
    this._drawScreenText(node.title, x + 10, y + headerH / 2, {
      fontPx: CanvasRenderer.FONT_SIZE,
      color: theme.text,
      baseline: "middle",
      align: "left",
    });

    if (skipPorts) return;

    // Input ports + labels
    node.inputs.forEach((p, i) => {
      const rct = portRect(node, p, i, "in");
      const cx = rct.x + rct.w / 2;
      const cy = rct.y + rct.h / 2;
      this._drawPortShape(cx, cy, p.portType);
      if (p.name) {
        this._drawScreenText(p.name, cx + 10, cy, {
          fontPx: 10,
          color: theme.textMuted,
          baseline: "middle",
          align: "left",
        });
      }
    });

    // Output ports + labels
    node.outputs.forEach((p, i) => {
      const rct = portRect(node, p, i, "out");
      const cx = rct.x + rct.w / 2;
      const cy = rct.y + rct.h / 2;
      this._drawPortShape(cx, cy, p.portType);
      if (p.name) {
        this._drawScreenText(p.name, cx - 10, cy, {
          fontPx: 10,
          color: theme.textMuted,
          baseline: "middle",
          align: "right",
        });
      }
    });
  }

  _drawPortShape(cx, cy, portType) {
    const { ctx, theme } = this;

    if (portType === "exec") {
      // Diamond shape for exec ports
      const s = 5 / this.scale;
      ctx.save();
      ctx.fillStyle = theme.portExec;
      ctx.strokeStyle = this._rgba(theme.portExec, 0.4);
      ctx.lineWidth = 2 / this.scale;
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
      // Circle for data ports
      ctx.save();
      // Outer ring
      ctx.strokeStyle = this._rgba(theme.port, 0.35);
      ctx.lineWidth = 3 / this.scale;
      ctx.beginPath();
      ctx.arc(cx, cy, 5 / this.scale, 0, Math.PI * 2);
      ctx.stroke();
      // Inner fill
      ctx.fillStyle = theme.port;
      ctx.beginPath();
      ctx.arc(cx, cy, 3.5 / this.scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  _drawPorts(node) {
    node.inputs.forEach((p, i) => {
      const rct = portRect(node, p, i, "in");
      const cx = rct.x + rct.w / 2;
      const cy = rct.y + rct.h / 2;
      this._drawPortShape(cx, cy, p.portType);
    });

    node.outputs.forEach((p, i) => {
      const rct = portRect(node, p, i, "out");
      const cx = rct.x + rct.w / 2;
      const cy = rct.y + rct.h / 2;
      this._drawPortShape(cx, cy, p.portType);
    });
  }

  /** Selection border for HTML overlay nodes, drawn on the edge canvas */
  _drawHtmlSelectionBorder(node) {
    const { ctx, theme } = this;
    const { x, y, w, h } = node.computed;
    const r = 2; // Sharp 2px rounding
    const pad = 1.5 / this.scale;

    ctx.save();
    ctx.shadowColor = theme.accentGlow;
    ctx.shadowBlur = 14 / this.scale;
    ctx.strokeStyle = theme.accentBright;
    ctx.lineWidth = 1.5 / this.scale;
    roundRect(ctx, x - pad, y - pad, w + pad * 2, h + pad * 2, r);
    ctx.stroke();
    ctx.restore();
  }

  /** Rotating dashed border drawn on the edge canvas for executing nodes */
  _drawActiveNodeBorder(node, time) {
    const { ctx, theme } = this;
    const { x, y, w, h } = node.computed;
    const r = 2;
    const pad = 2.5 / this.scale;

    const dashLen = 8 / this.scale;
    const gapLen = 6 / this.scale;
    // Slow clockwise rotation: positive lineDashOffset moves the pattern forward along path
    const offset = -(time / 1000) * (50 / this.scale);

    ctx.save();
    ctx.setLineDash([dashLen, gapLen]);
    ctx.lineDashOffset = offset;
    ctx.strokeStyle = this._rgba(theme.portExec, 0.9);
    ctx.lineWidth = 1.5 / this.scale;
    ctx.shadowColor = theme.portExec;
    ctx.shadowBlur = 4 / this.scale;
    roundRect(ctx, x - pad, y - pad, w + pad * 2, h + pad * 2, r + pad);
    ctx.stroke();
    ctx.restore();
  }

  _drawEdge(graph, e) {
    const from = graph.nodes.get(e.fromNode);
    const to = graph.nodes.get(e.toNode);
    if (!from || !to) return;
    const iOut = from.outputs.findIndex((p) => p.id === e.fromPort);
    const iIn = to.inputs.findIndex((p) => p.id === e.toPort);
    const pr1 = portRect(from, null, iOut, "out");
    const pr2 = portRect(to, null, iIn, "in");
    const x1 = pr1.x + pr1.w / 2, y1 = pr1.y + pr1.h / 2;
    const x2 = pr2.x + pr2.w / 2, y2 = pr2.y + pr2.h / 2;

    if (this.edgeStyle === "line") {
      this._drawLine(x1, y1, x2, y2);
    } else if (this.edgeStyle === "orthogonal") {
      this._drawOrthogonal(x1, y1, x2, y2);
    } else {
      this._drawCurve(x1, y1, x2, y2);
    }
  }

  _getEdgeDotPosition(graph, e, t) {
    const from = graph.nodes.get(e.fromNode);
    const to = graph.nodes.get(e.toNode);
    if (!from || !to) return null;

    const iOut = from.outputs.findIndex((p) => p.id === e.fromPort);
    const iIn = to.inputs.findIndex((p) => p.id === e.toPort);
    const pr1 = portRect(from, null, iOut, "out");
    const pr2 = portRect(to, null, iIn, "in");
    const x1 = pr1.x + pr1.w / 2, y1 = pr1.y + pr1.h / 2;
    const x2 = pr2.x + pr2.w / 2, y2 = pr2.y + pr2.h / 2;

    if (this.edgeStyle === "bezier") {
      const dx = Math.max(40, Math.abs(x2 - x1) * 0.4);
      return cubicBezierPoint(x1, y1, x1 + dx, y1, x2 - dx, y2, x2, y2, t);
    } else if (this.edgeStyle === "orthogonal") {
      const midX = (x1 + x2) / 2;
      const pts = [
        { x: x1, y: y1 },
        { x: midX, y: y1 },
        { x: midX, y: y2 },
        { x: x2, y: y2 },
      ];
      return polylinePoint(pts, t);
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

  _drawOrthogonal(x1, y1, x2, y2) {
    const midX = (x1 + x2) / 2;
    const pts = [
      { x: x1, y: y1 },
      { x: midX, y: y1 },
      { x: midX, y: y2 },
      { x: x2, y: y2 },
    ];

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

  drawEdgesOnly(
    graph,
    {
      activeEdges = new Set(),
      activeEdgeTimes = new Map(),
      activeNodes = new Set(),
      selection = new Set(),
      time = performance.now(),
      tempEdge = null,
    } = {}
  ) {
    this._resetTransform();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this._applyTransform();

    const { ctx, theme } = this;

    // Draw all edges
    for (const e of graph.edges.values()) {
      const isActive = activeEdges.has(e.id);

      if (isActive) {
        // Glow pass
        ctx.save();
        ctx.shadowColor = theme.edgeActive;
        ctx.shadowBlur = 6 / this.scale;
        ctx.strokeStyle = theme.edgeActive;
        ctx.lineWidth = 2 / this.scale;
        ctx.setLineDash([]);
        this._drawEdge(graph, e);
        ctx.restore();

        // Dot position: 0→1 over STEP_DURATION from activation time
        const activationTime = activeEdgeTimes.get(e.id) ?? time;
        const dotT = Math.min(1, (time - activationTime) / 620);
        const dotPos = this._getEdgeDotPosition(graph, e, dotT);
        if (dotPos) {
          ctx.save();
          ctx.fillStyle = this._rgba(theme.edgeActive, 0.9);
          ctx.shadowColor = theme.edgeActive;
          ctx.shadowBlur = 8 / this.scale;
          ctx.beginPath();
          ctx.arc(dotPos.x, dotPos.y, 2.5 / this.scale, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      } else {
        ctx.setLineDash([]);
        ctx.strokeStyle = theme.edge;
        ctx.lineWidth = 1.5 / this.scale;
        this._drawEdge(graph, e);
      }
    }

    // Selection borders for HTML overlay nodes (drawn above the HTML layer)
    for (const nodeId of selection) {
      const node = graph.nodes.get(nodeId);
      if (!node) continue;
      const def = this.registry?.types?.get(node.type);
      if (def?.html) this._drawHtmlSelectionBorder(node);
    }

    // Rotating dashed border for executing nodes
    if (activeNodes.size > 0) {
      for (const nodeId of activeNodes) {
        const node = graph.nodes.get(nodeId);
        if (node) this._drawActiveNodeBorder(node, time);
      }
    }

    // temp edge preview
    if (tempEdge) {
      const a = this.screenToWorld(tempEdge.x1, tempEdge.y1);
      const b = this.screenToWorld(tempEdge.x2, tempEdge.y2);

      const prevDash = this.ctx.getLineDash();
      this.ctx.setLineDash([5 / this.scale, 5 / this.scale]);
      this.ctx.strokeStyle = this._rgba(this.theme.accentBright, 0.7);
      this.ctx.lineWidth = 1.5 / this.scale;

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
        this.ctx.fillStyle = this.theme.accentBright;
        this._drawArrowhead(p1.x, p1.y, p2.x, p2.y, 10);
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
