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
        port: "#66d9ef",
        portExec: "#34d399",
        edge: "rgba(142, 150, 160, 0.28)",
        edgeExec: "rgba(124, 214, 172, 0.38)",
        edgeData: "rgba(133, 194, 208, 0.36)",
        edgeActive: "#8dd7b4",
        edgeActiveData: "#92cdda",
        accent: "#66d9ef",
        accentBright: "#a5f3fc",
        accentGlow: "rgba(102, 217, 239, 0.18)",
        nodeRadius: 8,
        groupRadius: 2,
        headerHeight: 28,
        flowSpeed: 180,
        linkPulseSpacing: 28,
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
    { fontPx = 11, color = this.theme.text, align = "left", baseline = "alphabetic" } = {}
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

    const bgGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    bgGradient.addColorStop(0, theme.bgAccentSoft || theme.bg);
    bgGradient.addColorStop(0.55, theme.bg || theme.bgAccentSoft);
    bgGradient.addColorStop(1, theme.bgAccent || theme.bg);
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const vignette = ctx.createRadialGradient(
      canvas.width * 0.5,
      canvas.height * 0.45,
      Math.min(canvas.width, canvas.height) * 0.08,
      canvas.width * 0.5,
      canvas.height * 0.45,
      Math.max(canvas.width, canvas.height) * 0.8
    );
    vignette.addColorStop(0, "rgba(255,255,255,0.015)");
    vignette.addColorStop(0.5, "rgba(255,255,255,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.34)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    this._applyTransform();

    const x0 = -offsetX / scale;
    const y0 = -offsetY / scale;
    const x1 = (canvas.width - offsetX) / scale;
    const y1 = (canvas.height - offsetY) / scale;

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
      ctx.lineWidth = 5.5 / this.scale;

      for (const e of graph.edges.values()) {
        const isActive = activeEdges && activeEdges.has(e.id);

        if (isActive) {
          const activeColor = this._getEdgeActiveColor(graph, e);
          const activationTime = activeEdgeTimes?.get(e.id) ?? time;
          ctx.save();
          
          // Outline for active link
          ctx.strokeStyle = "#0C0C0C";
          ctx.lineWidth = 6.0 / this.scale;
          this._drawEdge(graph, e);

          ctx.strokeStyle = this._softAlpha(activeColor, 0.9);
          ctx.lineWidth = 4.2 / this.scale;
          ctx.setLineDash([]);
          this._drawEdge(graph, e);
          ctx.restore();

          const deepColor = this._getEdgeDeepColor(graph, e);
          const dashOffset = -((time - activationTime) / 18) / this.scale;
          ctx.save();
          ctx.strokeStyle = deepColor;
          ctx.shadowColor = deepColor;
          ctx.shadowBlur = 6 / this.scale;
          ctx.lineWidth = 2.8 / this.scale;
          ctx.setLineDash([12 / this.scale, 18 / this.scale]);
          ctx.lineDashOffset = dashOffset;
          this._drawEdge(graph, e);
          ctx.restore();

          const flowSpeed = this.theme.flowSpeed || 150;
          const edgeLen = Math.max(50, this._getEdgeLength(graph, e));
          const duration = (edgeLen / flowSpeed) * 1000;
          const rawT = (time - activationTime) / duration;
          const dotT = loopActiveEdges ? ((time / 1000) * (flowSpeed / edgeLen)) % 1 : Math.min(1, rawT);

          const dotPos = this._getEdgeDotPosition(graph, e, dotT);
          if (dotPos) {
            ctx.save();
            const deepColor = this._getEdgeDeepColor(graph, e);
            ctx.fillStyle = deepColor;
            ctx.shadowColor = deepColor;
            ctx.shadowBlur = 10 / this.scale;
            ctx.beginPath();
            ctx.arc(dotPos.x, dotPos.y, 2.0 / this.scale, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            const spacing = Math.max(20, this.theme.linkPulseSpacing || 28);
            const trailOffsets = [spacing / edgeLen];
            for (const trailOffset of trailOffsets) {
              const trailT = loopActiveEdges
                ? (dotT - trailOffset + 1) % 1
                : Math.max(0, dotT - trailOffset);
              if (!loopActiveEdges && trailT <= 0) continue;
              const trailPos = this._getEdgeDotPosition(graph, e, trailT);
              if (!trailPos) continue;
              ctx.save();
              ctx.fillStyle = this._softAlpha(activeColor, 0.35);
              ctx.beginPath();
              ctx.arc(trailPos.x, trailPos.y, 1.4 / this.scale, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }
          }
        } else {
          const baseColor = this._getEdgeBaseColor(graph, e);
          ctx.setLineDash([]);
          
          // Link Outline
          ctx.strokeStyle = "#0C0C0C";
          ctx.lineWidth = 4.8 / this.scale;
          this._drawEdge(graph, e);

          // Inner Link
          ctx.strokeStyle = baseColor;
          ctx.lineWidth = 3.2 / this.scale;
          this._drawEdge(graph, e);

          ctx.strokeStyle = this._softAlpha(baseColor, 0.3);
          ctx.lineWidth = 2.0 / this.scale;
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
      this.ctx.lineWidth = 5.5 / this.scale;

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
        this._drawArrowhead(p1.x, p1.y, p2.x, p2.y, 10);
      }
    }

    // 3. Draw Non-Group Nodes
    for (const n of graph.nodes.values()) {
      if (n.type !== "core/Group") {
        const sel = selection.has(n.id);
        const def = this.registry?.types?.get(n.type);
        const hasHtmlOverlay = !!def?.html;

        this._drawNode(n, sel, !hasHtmlOverlay ? true : false);

        if (def?.onDraw) {
          def.onDraw(n, { ctx, theme, renderer: this });
        }

        if (hasHtmlOverlay) {
          this._drawPorts(n);
        }
      }
    }

    // 4. Highlight Active Nodes (Marching Ants)
    if (activeNodes.size > 0) {
      for (const nodeId of activeNodes) {
        const node = graph.nodes.get(nodeId);
        if (node) this._drawActiveNodeBorder(node, time);
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

  _softAlpha(color, alpha) {
    if (typeof color !== "string") return color;
    if (color.startsWith("#")) return this._rgba(color, alpha);
    const rgbaMatch = color.match(/rgba?\(([^)]+)\)/);
    if (!rgbaMatch) return color;
    const parts = rgbaMatch[1].split(",").map((part) => part.trim());
    const [r, g, b] = parts;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
    return "#4B4B4B";
  }

  _getEdgeDeepColor(graph, e) {
    // Enterprise Green Flow
    return "#34d399";
  }

  _drawNode(node, selected, skipPorts = false) {
    const { ctx, theme } = this;
    const r = theme.nodeRadius ?? 8;
    const { x, y, w, h } = node.computed;
    const headerH = theme.headerHeight ?? 28;

    // Get color from node or registry
    const typeDef = this.registry?.types?.get(node.type);
    const categoryColor = node.color || typeDef?.color || theme.accent;

    // Selection highlight — category-colored glow outline
    if (selected) {
      ctx.save();
      ctx.strokeStyle = "#747474";
      ctx.lineWidth = 1.6 / this.scale;
      const selPad = 6 / this.scale;
      roundRect(ctx, x - selPad, y - selPad, w + selPad * 2, h + selPad * 2, 12 / this.scale);
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
    ctx.strokeStyle = selected ? "rgba(116, 116, 116, 0.58)" : "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1.2 / this.scale;
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.stroke();

    // Body inner glow — category color bleeding from header into body


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

    ctx.save();
    ctx.fillStyle = this._rgba(categoryColor, 0.92);
    ctx.beginPath();
    ctx.roundRect(x, y, w, 4 / this.scale, { tl: r, tr: r, br: 0, bl: 0 });
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1 / this.scale;
    ctx.beginPath();
    ctx.moveTo(x + 1 / this.scale, y + headerH);
    ctx.lineTo(x + w - 1 / this.scale, y + headerH);
    ctx.stroke();
    ctx.restore();

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

  _drawPortShape(cx, cy, portType) {
    const { ctx, theme } = this;

    if (portType === "exec") {
      const s = 5.5 / this.scale;
      ctx.save();
      ctx.fillStyle = theme.portExec;
      ctx.strokeStyle = this._softAlpha(theme.portExec, 0.3);
      ctx.lineWidth = 1.6 / this.scale;
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
      ctx.strokeStyle = this._softAlpha(theme.port, 0.18);
      ctx.lineWidth = 3.5 / this.scale;
      ctx.beginPath();
      ctx.arc(cx, cy, 7.5 / this.scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = theme.port;
      ctx.beginPath();
      ctx.arc(cx, cy, 3.8 / this.scale, 0, Math.PI * 2);
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
    const { ctx } = this;
    const { x, y, w, h } = node.computed;
    const r = this.theme.nodeRadius ?? 8;
    const pad = 6 / this.scale;

    ctx.save();
    ctx.strokeStyle = "#747474";
    ctx.lineWidth = 1.5 / this.scale;
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

    const dashLen = 8 / this.scale;
    const gapLen = 5 / this.scale;
    const offset = -(time / 1000) * (50 / this.scale);

    ctx.save();
    ctx.setLineDash([dashLen, gapLen]);
    ctx.lineDashOffset = offset;
    ctx.strokeStyle = "#747474";
    ctx.lineWidth = 2.0 / this.scale;
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
    const pr1 = portRect(from, null, iOut, "out");
    const pr2 = portRect(to, null, iIn, "in");

    return {
      x1: pr1.x + pr1.w / 2,
      y1: pr1.y + pr1.h / 2,
      x2: pr2.x + pr2.w / 2,
      y2: pr2.y + pr2.h / 2,
    };
  }

  _getOrthogonalPointsFromEdge(graph, e) {
    const endpoints = this._getEdgeEndpoints(graph, e);
    if (!endpoints) return [];

    const { x1, y1, x2, y2 } = endpoints;
    const dir = x2 >= x1 ? 1 : -1;
    const defaultOffset = Math.max(36, Math.abs(x2 - x1) * 0.3);
    const route = e.route || {};
    const splitX1 = Number.isFinite(route.splitX1) ? route.splitX1 : x1 + defaultOffset * dir;
    const splitX2 = Number.isFinite(route.splitX2) ? route.splitX2 : x2 - defaultOffset * dir;
    const splitY = Number.isFinite(route.splitY) ? route.splitY : (y1 + y2) / 2;

    return [
      { x: x1, y: y1 },
      { x: splitX1, y: y1 },
      { x: splitX1, y: splitY },
      { x: splitX2, y: splitY },
      { x: splitX2, y: y2 },
      { x: x2, y: y2 },
    ];
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
        const activeColor = this._getEdgeActiveColor(graph, e);
        ctx.save();
        
        // Outline for active link
        ctx.strokeStyle = "#0C0C0C";
        ctx.lineWidth = 6.0 / this.scale;
        this._drawEdge(graph, e);

        ctx.strokeStyle = this._softAlpha(activeColor, 0.9);
        ctx.lineWidth = 4.2 / this.scale;
        ctx.setLineDash([]);
        this._drawEdge(graph, e);
        ctx.restore();

        const flowSpeed = this.theme.flowSpeed || 150;
        const activationTime = activeEdgeTimes.get(e.id) ?? time;
        const edgeLen = Math.max(50, this._getEdgeLength(graph, e));
        const duration = (edgeLen / flowSpeed) * 1000;

        const deepColor = this._getEdgeDeepColor(graph, e);
        ctx.save();
        ctx.strokeStyle = deepColor;
        ctx.shadowColor = deepColor;
        ctx.shadowBlur = 6 / this.scale;
        ctx.lineWidth = 2.8 / this.scale;
        ctx.setLineDash([12 / this.scale, 18 / this.scale]);
        ctx.lineDashOffset = -((time - activationTime) / 18) / this.scale;
        this._drawEdge(graph, e);
        ctx.restore();

        const rawT = (time - activationTime) / duration;
        const dotT = loopActiveEdges ? ((time / 1000) * (flowSpeed / edgeLen)) % 1 : Math.min(1, rawT);

        const dotPos = this._getEdgeDotPosition(graph, e, dotT);
        if (dotPos) {
          ctx.save();
          const deepColor = this._getEdgeDeepColor(graph, e);
          ctx.fillStyle = deepColor;
          ctx.shadowColor = deepColor;
          ctx.shadowBlur = 10 / this.scale;
          ctx.beginPath();
          ctx.arc(dotPos.x, dotPos.y, 2.0 / this.scale, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          const spacing = Math.max(20, this.theme.linkPulseSpacing || 28);
          const trailOffsets = [spacing / edgeLen];
          for (const trailOffset of trailOffsets) {
            const trailT = loopActiveEdges
              ? (dotT - trailOffset + 1) % 1
              : Math.max(0, dotT - trailOffset);
            if (!loopActiveEdges && trailT <= 0) continue;
            const trailPos = this._getEdgeDotPosition(graph, e, trailT);
            if (!trailPos) continue;
            ctx.save();
            ctx.fillStyle = this._softAlpha(activeColor, 0.35);
            ctx.beginPath();
            ctx.arc(trailPos.x, trailPos.y, 1.4 / this.scale, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
      } else {
        const baseColor = this._getEdgeBaseColor(graph, e);
        ctx.setLineDash([]);
        
        // Link Outline
        ctx.strokeStyle = "#0C0C0C";
        ctx.lineWidth = 4.8 / this.scale;
        this._drawEdge(graph, e);

        // Inner Link
        ctx.strokeStyle = baseColor;
        ctx.lineWidth = 3.2 / this.scale;
        this._drawEdge(graph, e);

        ctx.strokeStyle = this._softAlpha(baseColor, 0.3);
        ctx.lineWidth = 2.0 / this.scale;
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
      this.ctx.lineWidth = 5.5 / this.scale;

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
