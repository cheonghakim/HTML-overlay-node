import { portRect } from "./hitTest.js";

export class CanvasRenderer {
  static FONT_SIZE = 12;
  static SELECTED_NODE_COLOR = "#6cf";
  constructor(canvas, { theme = {}, registry, edgeStyle = "orthogonal" } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.registry = registry; // to call per-node onDraw

    // viewport transform
    this.scale = 1;
    this.minScale = 0.25;
    this.maxScale = 3;
    this.offsetX = 0;
    this.offsetY = 0;

    // 'bezier' | 'line' | 'orthogonal'
    this.edgeStyle = edgeStyle;

    this.theme = Object.assign(
      {
        bg: "#0d0d0f", // Darker background
        grid: "#1a1a1d", // Subtle grid
        node: "#16161a", // Darker nodes
        nodeBorder: "#2a2a2f", // Subtle border
        title: "#1f1f24", // Darker header
        text: "#e4e4e7", // Softer white
        textMuted: "#a1a1aa", // Muted text
        port: "#6366f1", // Indigo for data ports
        portExec: "#10b981", // Emerald for exec ports
        edge: "#52525b", // Neutral edge color
        edgeActive: "#8b5cf6", // Purple for active
        accent: "#6366f1", // Indigo accent
        accentBright: "#818cf8", // Brighter accent
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
    // Trigger callback to sync HTML overlay transform
    this._onTransformChange?.();
  }

  /**
   * Set callback to be called when transform changes (zoom/pan)
   * @param {Function} callback - Function to call on transform change
   */
  setTransformChangeCallback(callback) {
    this._onTransformChange = callback;
  }
  panBy(dx, dy) {
    this.offsetX += dx;
    this.offsetY += dy;
    // Trigger callback to sync HTML overlay transform
    this._onTransformChange?.();
  }
  zoomAt(factor, cx, cy) {
    // factor > 1 zoom in, < 1 zoom out, centered at screen point (cx, cy)
    const prev = this.scale;
    const next = Math.min(this.maxScale, Math.max(this.minScale, prev * factor));
    if (next === prev) return;
    // keep the world point under cursor fixed: adjust offset
    const wx = (cx - this.offsetX) / prev;
    const wy = (cy - this.offsetY) / prev;
    this.offsetX = cx - wx * next;
    this.offsetY = cy - wy * next;
    this.scale = next;
    // Trigger callback to sync HTML overlay transform
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
    // CRITICAL: Must match HTMLOverlay transformation order (translate then scale)
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset first
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);
  }
  _resetTransform() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ── Drawing ────────────────────────────────────────────────────────────────
  _drawArrowhead(x1, y1, x2, y2, size = 10) {
    const { ctx } = this;
    const s = size / this.scale; // 줌에 따라 크기 보정
    const ang = Math.atan2(y2 - y1, x2 - x1);

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - s * Math.cos(ang - Math.PI / 6), y2 - s * Math.sin(ang - Math.PI / 6));
    ctx.lineTo(x2 - s * Math.cos(ang + Math.PI / 6), y2 - s * Math.sin(ang + Math.PI / 6));
    ctx.closePath();
    ctx.fill(); // 선 색상과 동일한 fill이 자연스러움
  }

  _drawScreenText(
    text,
    lx,
    ly,
    {
      fontPx = 12,
      color = this.theme.text,
      align = "left",
      baseline = "alphabetic",
      dpr = 1, // 추후 devicePixelRatio 도입
    } = {}
  ) {
    const { ctx } = this;
    const { x: sx, y: sy } = this.worldToScreen(lx, ly);

    ctx.save();
    // 화면 좌표계(스케일=1)로 리셋
    this._resetTransform();

    // 픽셀 스냅(번짐 방지)
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
    // clear screen in screen space

    this._resetTransform();
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // draw grid in world space so it pans/zooms
    this._applyTransform();
    // Make grid subtle but visible
    ctx.strokeStyle = this._rgba(theme.grid, 0.35); // Subtle but visible
    ctx.lineWidth = 1 / scale; // keep 1px apparent

    const base = 20; // world units
    const step = base;

    // visible world bounds
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

  draw(
    graph,
    {
      selection = new Set(),
      tempEdge = null,
      running = false,
      time = performance.now(),
      dt = 0,
      groups = null,
      activeEdges = new Set(),
      drawEdges = true,
    } = {}
  ) {
    // Update transforms first
    graph.updateWorldTransforms();

    this.drawGrid();
    const { ctx, theme } = this;
    this._applyTransform();

    ctx.save();

    // 1. Draw Groups (Backgrounds)
    for (const n of graph.nodes.values()) {
      if (n.type === "core/Group") {
        const sel = selection.has(n.id);
        const def = this.registry?.types?.get(n.type);
        if (def?.onDraw) def.onDraw(n, { ctx, theme, renderer: this });
        else this._drawNode(n, sel);
      }
    }

    // 2. Draw Edges (conditionally - can be skipped for port canvas rendering)
    if (drawEdges) {
      ctx.lineWidth = 1.5 / this.scale;

      // Calculate animation values if running
      let dashArray = null;
      let dashOffset = 0;
      if (running) {
        const speed = 120;
        const phase = (((time / 1000) * speed) / this.scale) % CanvasRenderer.FONT_SIZE;
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
          ctx.lineWidth = 3 / this.scale;
        } else {
          ctx.strokeStyle = theme.edge;
          ctx.lineWidth = 1.5 / this.scale;
        }
        this._drawEdge(graph, e);
      }
    }

    // temp edge preview
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
        this.ctx.fillStyle = this.theme.edge;
        this.ctx.strokeStyle = this.theme.edge; // Ensure color is set
        this._drawArrowhead(p1.x, p1.y, p2.x, p2.y, 12);
      }
    }

    // 3. Draw Other Nodes (AFTER edges)
    // For nodes with HTML overlays, SKIP canvas rendering entirely
    for (const n of graph.nodes.values()) {
      if (n.type !== "core/Group") {
        const sel = selection.has(n.id);
        const def = this.registry?.types?.get(n.type);
        const hasHtmlOverlay = !!def?.html;

        // Only draw node body on canvas if it DOESN'T have HTML overlay
        if (!hasHtmlOverlay) {
          this._drawNode(n, sel, true); // Draw WITHOUT ports (drawn on port canvas)
          if (def?.onDraw) def.onDraw(n, { ctx, theme, renderer: this });
        }
      }
    }

    // 4. Draw ports for HTML overlay nodes LAST (so they appear above HTML)
    for (const n of graph.nodes.values()) {
      if (n.type !== "core/Group") {
        const def = this.registry?.types?.get(n.type);
        const hasHtmlOverlay = !!def?.html;

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

  _drawNode(node, selected, skipPorts = false) {
    const { ctx, theme } = this;
    const r = 8;
    const { x, y, w, h } = node.computed;

    // Draw subtle shadow
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

    // Draw main body
    ctx.fillStyle = theme.node;
    ctx.strokeStyle = selected ? theme.accentBright : theme.nodeBorder;
    ctx.lineWidth = (selected ? 1.5 : 1) / this.scale;
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.stroke();

    // Draw header
    ctx.fillStyle = theme.title;
    roundRect(ctx, x, y, w, 24, { tl: r, tr: r, br: 0, bl: 0 });
    ctx.fill();

    // Header border (only top and sides)
    ctx.strokeStyle = selected ? theme.accentBright : theme.nodeBorder;
    ctx.lineWidth = (selected ? 1.5 : 1) / this.scale;
    ctx.beginPath();
    // Top-left corner to top-right corner
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    // Right side down to header bottom
    ctx.lineTo(x + w, y + 24);
    // Move to left side header bottom
    ctx.moveTo(x, y + 24);
    // Left side up to top-left corner
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.stroke();

    this._drawScreenText(node.title, x + 8, y + CanvasRenderer.FONT_SIZE, {
      fontPx: CanvasRenderer.FONT_SIZE,
      color: theme.text,
      baseline: "middle",
      align: "left",
    });

    // Skip port drawing if requested (for HTML overlay nodes)
    if (skipPorts) return;

    // Draw input ports
    node.inputs.forEach((p, i) => {
      const rct = portRect(node, p, i, "in");
      const cx = rct.x + rct.w / 2;
      const cy = rct.y + rct.h / 2;

      if (p.portType === "exec") {
        // Draw exec port - rounded square
        const portSize = 8;
        ctx.fillStyle = theme.portExec;
        ctx.strokeStyle = "rgba(16, 185, 129, 0.3)";
        ctx.lineWidth = 2 / this.scale;
        ctx.beginPath();
        ctx.roundRect(cx - portSize / 2, cy - portSize / 2, portSize, portSize, 2);
        ctx.fill();
        ctx.stroke();
      } else {
        // Draw data port - circle with outline
        ctx.fillStyle = theme.port;
        ctx.strokeStyle = "rgba(99, 102, 241, 0.3)";
        ctx.lineWidth = 2 / this.scale;
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    });

    // Draw output ports
    node.outputs.forEach((p, i) => {
      const rct = portRect(node, p, i, "out");
      const cx = rct.x + rct.w / 2;
      const cy = rct.y + rct.h / 2;

      if (p.portType === "exec") {
        // Draw exec port - rounded square
        const portSize = 8;
        ctx.fillStyle = theme.portExec;
        ctx.strokeStyle = "rgba(16, 185, 129, 0.3)";
        ctx.lineWidth = 2 / this.scale;
        ctx.beginPath();
        ctx.roundRect(cx - portSize / 2, cy - portSize / 2, portSize, portSize, 2);
        ctx.fill();
        ctx.stroke();
      } else {
        // Draw data port - circle with outline
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

    // Draw input ports
    node.inputs.forEach((p, i) => {
      const rct = portRect(node, p, i, "in");
      const cx = rct.x + rct.w / 2;
      const cy = rct.y + rct.h / 2;

      if (p.portType === "exec") {
        // Draw exec port - rounded square with subtle glow
        const portSize = 8;
        ctx.fillStyle = theme.portExec;
        ctx.strokeStyle = "rgba(16, 185, 129, 0.3)";
        ctx.lineWidth = 2 / this.scale;
        ctx.beginPath();
        ctx.roundRect(cx - portSize / 2, cy - portSize / 2, portSize, portSize, 2);
        ctx.fill();
        ctx.stroke();
      } else {
        // Draw data port - circle with subtle outline
        ctx.fillStyle = theme.port;
        ctx.strokeStyle = "rgba(99, 102, 241, 0.3)";
        ctx.lineWidth = 2 / this.scale;
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Draw output ports
    node.outputs.forEach((p, i) => {
      const rct = portRect(node, p, i, "out");
      const cx = rct.x + rct.w / 2;
      const cy = rct.y + rct.h / 2;

      if (p.portType === "exec") {
        // Draw exec port - rounded square
        const portSize = 8;
        ctx.fillStyle = theme.portExec;
        ctx.strokeStyle = "rgba(16, 185, 129, 0.3)";
        ctx.lineWidth = 2 / this.scale;
        ctx.beginPath();
        ctx.roundRect(cx - portSize / 2, cy - portSize / 2, portSize, portSize, 2);
        ctx.fill();
        ctx.stroke();
      } else {
        // Draw data port - circle with outline
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
    const x1 = pr1.x + pr1.w / 2,
      y1 = pr1.y + pr1.h / 2, // Center of port
      x2 = pr2.x + pr2.w / 2,
      y2 = pr2.y + pr2.h / 2; // Center of port
    if (this.edgeStyle === "line") {
      this._drawLine(x1, y1, x2, y2);
    } else if (this.edgeStyle === "orthogonal") {
      this._drawOrthogonal(x1, y1, x2, y2);
    } else {
      this._drawCurve(x1, y1, x2, y2); // bezier (기존)
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
    // 중간 축을 결정 (더 짧은 축을 가운데에 두면 보기 좋음)
    const useHVH = true; // 가로-세로-가로(HVH) vs 세로-가로-세로(VHV)
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    let pts;
    if (useHVH) {
      // x1,y1 → midX,y1 → midX,y2 → x2,y2
      pts = [
        { x: x1, y: y1 },
        { x: midX, y: y1 },
        { x: midX, y: y2 },
        { x: x2, y: y2 },
      ];
    }
    // else {
    //   // x1,y1 → x1,midY → x2,midY → x2,y2
    //   pts = [
    //     { x: x1, y: y1 },
    //     { x: x1, y: midY },
    //     { x: x2, y: midY },
    //     { x: x2, y: y2 },
    //   ];
    // }

    // 라운드 코너
    const { ctx } = this;
    const prevJoin = ctx.lineJoin,
      prevCap = ctx.lineCap;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    this._drawPolyline(pts);
    ctx.lineJoin = prevJoin;
    ctx.lineCap = prevCap;

    return pts; // 화살표 각도 계산에 사용
  }
  _drawCurve(x1, y1, x2, y2) {
    const { ctx } = this;
    const dx = Math.max(40, Math.abs(x2 - x1) * 0.4);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(x1 + dx, y1, x2 - dx, y2, x2, y2);
    ctx.stroke();
  }

  /**
   * Draw only edges on a separate canvas (for layering above HTML overlay)
   * @param {Graph} graph - The graph
   * @param {Object} options - Rendering options
   */
  drawEdgesOnly(
    graph,
    { activeEdges = new Set(), running = false, time = performance.now(), tempEdge = null } = {}
  ) {
    // Clear canvas
    this._resetTransform();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this._applyTransform();

    const { ctx, theme } = this;

    // Calculate animation values
    let dashArray = null;
    let dashOffset = 0;
    if (running || activeEdges.size > 0) {
      const speed = 120;
      const phase = (((time / 1000) * speed) / this.scale) % 12;
      dashArray = [6 / this.scale, 6 / this.scale];
      dashOffset = -phase;
    }

    // Draw all edges
    ctx.lineWidth = 1.5 / this.scale;
    // Set default edge style
    ctx.strokeStyle = theme.edge;
    for (const e of graph.edges.values()) {
      const isActive = activeEdges && activeEdges.has(e.id);

      if (isActive && dashArray) {
        ctx.setLineDash(dashArray);
        ctx.lineDashOffset = dashOffset;
        ctx.strokeStyle = "#00ffff";
        ctx.lineWidth = 3 / this.scale;
      } else {
        ctx.setLineDash([]);
        ctx.strokeStyle = theme.edge;
        ctx.lineWidth = 1.5 / this.scale;
      }

      this._drawEdge(graph, e);
    }

    // temp edge preview
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
        this.ctx.fillStyle = this.theme.edge;
        this.ctx.strokeStyle = this.theme.edge; // Ensure color is set
        this._drawArrowhead(p1.x, p1.y, p2.x, p2.y, 12);
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
