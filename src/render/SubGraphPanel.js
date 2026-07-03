/**
 * SubGraphPanel — split-pane panel that opens an independent sub-graph editor
 * within the same container.  The panel is dockable (bottom/top/left/right)
 * and resizable by dragging the separator handle.
 *
 * Usage:
 *   const panel = new SubGraphPanel(mainArea, { registry, theme, iconManager });
 *   panel.open(node, node.state.subGraphData, ['Parent', node.title]);
 *   panel.close();     // saves sub-graph back into node.state.subGraphData
 */

import { Graph } from "../core/Graph.js";
import { CanvasRenderer } from "./CanvasRenderer.js";
import { Controller } from "../interact/Controller.js";
import { HtmlOverlay } from "./HtmlOverlay.js";
import { Runner } from "../core/Runner.js";
import { createHooks } from "../core/Hooks.js";
import { IconManager } from "./IconManager.js";
import { ContextMenu } from "../interact/ContextMenu.js";
import { PropertyPanel } from "../ui/PropertyPanel.js";
import { setupDefaultContextMenu } from "../defaults/contextMenu.js";

// Dock configuration — maps dock side to CSS properties
const DOCK_CFG = {
  bottom: {
    flexDir: "column",
    mainProp: "bottom",
    panelProp: ["bottom", "left", "right"],
    panelSize: "height",
    cursor: "ns-resize",
    resizerH: "4px",
    resizerW: "100%",
  },
  top: {
    flexDir: "column-reverse",
    mainProp: "top",
    panelProp: ["top", "left", "right"],
    panelSize: "height",
    cursor: "ns-resize",
    resizerH: "4px",
    resizerW: "100%",
  },
  right: {
    flexDir: "row",
    mainProp: "right",
    panelProp: ["top", "right", "bottom"],
    panelSize: "width",
    cursor: "ew-resize",
    resizerH: "100%",
    resizerW: "4px",
  },
  left: {
    flexDir: "row-reverse",
    mainProp: "left",
    panelProp: ["top", "left", "bottom"],
    panelSize: "width",
    cursor: "ew-resize",
    resizerH: "100%",
    resizerW: "4px",
  },
  float: {
    flexDir: "column",
    mainProp: "",
    panelProp: [],
    panelSize: "",
    cursor: "default",
    resizerH: "0",
    resizerW: "0",
  },
};

export class SubGraphPanel {
  /**
   * @param {HTMLElement} mainArea   – the wrapper div containing the main canvases
   * @param {object}      opts
   * @param {import('../core/Registry.js').Registry} opts.registry
   * @param {object}      [opts.theme]
   * @param {IconManager} [opts.iconManager]
   */
  constructor(mainArea, { registry, theme = {}, iconManager = null } = {}) {
    this.mainArea = mainArea;
    this.registry = registry;
    this.theme = theme;
    this.iconManager = iconManager;

    this._dock = "float"; // default to floating window mode
    this._size = 500; // px  (height for top/bottom, width for left/right)
    this._minSize = 280; // minimum width/height for window mode

    // Floating window state
    this._x = 100;
    this._y = 20;
    this._width = 680;
    this._height = 480;
    this._hasBeenPositioned = false; // set after first open → keeps user's position on reopen
    this._maximized = false;
    this._minimized = false;
    this._preMaximizedBounds = null;
    this._resizing = false;

    this._minBtn = null;

    this._open = false;
    this._parentNode = null;

    // Sub-editor components (lazily initialised on first open)
    this._graph = null;
    this._renderer = null;
    this._controller = null;
    this._htmlOverlay = null;
    this._runner = null;
    this._ro = null;

    // DOM
    this._el = null;
    this._resizerEl = null;
    this._breadcrumbEl = null;
    this._canvasWrapEl = null;
    this._canvas = null;
    this._resizeHandles = [];

    // Panel-resize drag state
    this._dragging = false;
    this._dragStart = null;
    this._sizeAtStart = 0;

    this._onResizeMove = this._onPanelResizeMouse.bind(this, "move");
    this._onResizeUp = this._onPanelResizeMouse.bind(this, "up");

    this._buildDOM();
    this.setDock("right"); // default: right-docked on first load
  }

  // ─── DOM construction ─────────────────────────────────────────────────────

  _buildDOM() {
    const outer = this.mainArea.parentElement; // overall container

    // ── wrapper ──────────────────────────────────────────────────
    const el = document.createElement("div");
    el.className = "sg-panel";
    Object.assign(el.style, {
      position: "absolute",
      zIndex: "50",
      background: "#0e1015",
      boxSizing: "border-box",
      display: "none",
      flexDirection: "column",
      // overflow intentionally not set — PropertyPanel is mounted here and
      // must not be clipped. Inner contentWrap handles its own overflow.
    });

    // ── 8-directional resize handles for floating window mode ────
    const directions = ["r", "b", "l", "t", "se", "sw", "nw", "ne"];
    const handleStyles = {
      r: { top: "6px", right: "-3px", bottom: "6px", width: "6px", cursor: "col-resize" },
      l: { top: "6px", left: "-3px", bottom: "6px", width: "6px", cursor: "col-resize" },
      b: { left: "6px", right: "6px", bottom: "-3px", height: "6px", cursor: "row-resize" },
      t: { left: "6px", right: "6px", top: "-3px", height: "6px", cursor: "row-resize" },
      se: { right: "-3px", bottom: "-3px", width: "10px", height: "10px", cursor: "se-resize" },
      sw: { left: "-3px", bottom: "-3px", width: "10px", height: "10px", cursor: "sw-resize" },
      nw: { left: "-3px", top: "-3px", width: "10px", height: "10px", cursor: "nw-resize" },
      ne: { right: "-3px", top: "-3px", width: "10px", height: "10px", cursor: "ne-resize" },
    };

    directions.forEach((dir) => {
      const handle = document.createElement("div");
      handle.className = `sg-resize-handle sg-resize-handle--${dir}`;
      Object.assign(handle.style, {
        position: "absolute",
        zIndex: "100",
        display: "none", // Managed in _applyLayout
        ...handleStyles[dir],
      });
      handle.addEventListener("mousedown", (e) => this._startResize(e, dir));
      el.appendChild(handle);
      this._resizeHandles.push(handle);
    });

    // ── separator / resize handle (used for docked mode) ──────────
    const resizer = document.createElement("div");
    resizer.className = "sg-resizer";
    Object.assign(resizer.style, {
      flexShrink: "0",
      background: "rgba(255,255,255,0.06)",
      transition: "background 0.12s",
      zIndex: "1",
    });
    resizer.addEventListener("mouseenter", () => {
      resizer.style.background = "rgba(99,179,237,0.35)";
    });
    resizer.addEventListener("mouseleave", () => {
      if (!this._dragging) resizer.style.background = "rgba(255,255,255,0.06)";
    });
    resizer.addEventListener("mousedown", (e) => {
      e.preventDefault();
      this._dragging = true;
      this._dragStart = { x: e.clientX, y: e.clientY };
      this._sizeAtStart = this._size;
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", this._onResizeMove);
      window.addEventListener("mouseup", this._onResizeUp);
    });

    // ── header ────────────────────────────────────────────────────
    const header = document.createElement("div");
    Object.assign(header.style, {
      height: "28px",
      flexShrink: "0",
      display: "flex",
      alignItems: "center",
      borderBottom: "1px solid rgba(255,255,255,0.07)",
      padding: "0 8px",
      gap: "5px",
      background: "#13151c",
      fontSize: "10px",
      color: "rgba(255,255,255,0.5)",
      fontFamily: '"Inter", system-ui, sans-serif',
      userSelect: "none",
      flexWrap: "nowrap",
      overflow: "hidden",
      cursor: "grab",
    });

    // Dedicated drag handle — flex spacer between breadcrumb and right-side controls.
    const dragHandle = document.createElement("div");
    Object.assign(dragHandle.style, {
      flex: "1",
      alignSelf: "stretch",
      minWidth: "16px",
    });
    this._dragHandle = dragHandle;

    // Window dragging (header click) & snap-to-edge docking
    header.addEventListener("mousedown", (e) => {
      if (this._maximized) return;
      if (e.target.closest("button") || e.target.closest(".sg-breadcrumb")) return;

      e.preventDefault();

      // When docked: switch to float first, anchoring the panel under the cursor
      if (this._dock !== "float") {
        const outer = this.mainArea.parentElement;
        const outerRect = outer.getBoundingClientRect();
        const panelRect = this._el.getBoundingClientRect();
        this._x = panelRect.left - outerRect.left;
        this._y = panelRect.top - outerRect.top;
        this._minimized = false; // reset minimize state when un-docking
        if (this._minBtn) this._minBtn.title = "최소화 (창 접기)";
        this._dock = "float";
        this._applyLayout();
        for (const d of this._dockBtns || []) {
          d._btn.style.background = d.side === "float" ? "rgba(99,179,237,0.2)" : "none";
        }
      }

      this._dragging = true;
      header.style.cursor = "grabbing";
      const startX = e.clientX;
      const startY = e.clientY;
      const origX = this._x;
      const origY = this._y;

      const SNAP_ZONE = 40;
      let snapGhost = null;
      let snapSide = null;

      const getSnapSide = (relX, relY) => {
        const outer = this.mainArea.parentElement;
        const W = outer.clientWidth;
        const H = outer.clientHeight;
        if (relY < SNAP_ZONE) return "top";
        if (relY > H - SNAP_ZONE) return "bottom";
        if (relX < SNAP_ZONE) return "left";
        if (relX > W - SNAP_ZONE) return "right";
        return null;
      };

      const showSnapGhost = (side) => {
        if (!snapGhost) {
          snapGhost = document.createElement("div");
          Object.assign(snapGhost.style, {
            position: "absolute",
            pointerEvents: "none",
            zIndex: "9998",
            background: "rgba(99,179,237,0.12)",
            border: "2px solid rgba(99,179,237,0.45)",
            borderRadius: "4px",
            transition: "all 0.08s ease",
            boxSizing: "border-box",
          });
          this.mainArea.parentElement.appendChild(snapGhost);
        }
        const s = this._size;
        const styles = { top: "", bottom: "", left: "", right: "", width: "", height: "" };
        if (side === "top")
          Object.assign(styles, { top: "0", left: "0", right: "0", height: s + "px" });
        if (side === "bottom")
          Object.assign(styles, { bottom: "0", left: "0", right: "0", height: s + "px" });
        if (side === "left")
          Object.assign(styles, { left: "0", top: "0", bottom: "0", width: s + "px" });
        if (side === "right")
          Object.assign(styles, { right: "0", top: "0", bottom: "0", width: s + "px" });
        Object.assign(snapGhost.style, styles);
        snapGhost.style.display = "block";
      };

      const hideSnapGhost = () => {
        if (snapGhost) snapGhost.style.display = "none";
      };

      const onMouseMove = (ev) => {
        if (!this._dragging) return;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        this._x = origX + dx;
        this._y = origY + dy;
        this._applyLayout();

        const outer = this.mainArea.parentElement;
        const outerRect = outer.getBoundingClientRect();
        const relX = ev.clientX - outerRect.left;
        const relY = ev.clientY - outerRect.top;
        const newSnap = getSnapSide(relX, relY);
        if (newSnap !== snapSide) {
          snapSide = newSnap;
          if (snapSide) showSnapGhost(snapSide);
          else hideSnapGhost();
        }
      };

      const onMouseUp = () => {
        this._dragging = false;
        header.style.cursor = "grab";
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        if (snapGhost) {
          snapGhost.remove();
          snapGhost = null;
        }
        if (snapSide) this.setDock(snapSide);
        snapSide = null;
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    });

    header.addEventListener("dblclick", (e) => {
      if (this._dock !== "float") return;
      if (e.target.closest("button") || e.target.closest(".sg-breadcrumb")) return;
      this._toggleMaximize();
    });

    // breadcrumb
    const breadcrumb = document.createElement("div");
    breadcrumb.className = "sg-breadcrumb";
    Object.assign(breadcrumb.style, {
      flexShrink: "1",
      overflow: "hidden",
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
      minWidth: "0",
    });

    // dock buttons
    const dockGroup = this._makeDockButtons();
    this._dockGroup = dockGroup;

    // divider
    const divider = document.createElement("span");
    this._divider = divider;
    Object.assign(divider.style, {
      width: "1px",
      height: "14px",
      background: "rgba(255,255,255,0.1)",
      flexShrink: "0",
    });

    // ── utility buttons ───────────────────────────────────────────
    const utilGroup = document.createElement("div");
    this._utilGroup = utilGroup;
    Object.assign(utilGroup.style, {
      display: "flex",
      gap: "1px",
      alignItems: "center",
      flexShrink: "0",
    });

    // helper: make SVG icon button
    const makeSvgBtn = (svgPath, tooltip) => {
      const b = this._makeIconButton("", tooltip);
      b.innerHTML = `<span style="width:11px;height:11px;display:flex;align-items:center;pointer-events:none;color:inherit">${svgPath}</span>`;
      Object.assign(b.style, {
        width: "20px",
        height: "20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0",
      });
      return b;
    };

    // Fit-to-view button
    const fitBtn = makeSvgBtn(
      `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" style="width:11px;height:11px"><path d="M1 4V1h3M8 1h3v3M11 8v3H8M4 11H1V8"/></svg>`,
      "뷰에 맞추기 (F)"
    );
    fitBtn.addEventListener("click", () => this._controller?.fitToView());
    utilGroup.appendChild(fitBtn);

    // Grid arrange button
    const gridBtn = makeSvgBtn(
      `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" style="width:11px;height:11px"><rect x="1" y="1" width="4" height="4" rx="0.5"/><rect x="7" y="1" width="4" height="4" rx="0.5"/><rect x="1" y="7" width="4" height="4" rx="0.5"/><rect x="7" y="7" width="4" height="4" rx="0.5"/></svg>`,
      "그리드 정렬"
    );
    gridBtn.addEventListener("click", () => this._arrangeGrid());
    utilGroup.appendChild(gridBtn);

    const divider2 = document.createElement("span");
    Object.assign(divider2.style, {
      width: "1px",
      height: "14px",
      background: "rgba(255,255,255,0.1)",
      flexShrink: "0",
      margin: "0 2px",
    });
    utilGroup.appendChild(divider2);

    // Slot layout toggle (H/V)
    const slotHBtn = makeSvgBtn(
      `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" style="width:11px;height:11px"><rect x="1" y="3" width="10" height="6" rx="1"/><line x1="4" y1="3" x2="4" y2="9"/><line x1="8" y1="3" x2="8" y2="9"/></svg>`,
      "슬롯 좌/우 배치"
    );
    slotHBtn.addEventListener("click", () => this._setSlotLayout("horizontal"));
    utilGroup.appendChild(slotHBtn);

    const slotVBtn = makeSvgBtn(
      `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" style="width:11px;height:11px"><rect x="3" y="1" width="6" height="10" rx="1"/><line x1="3" y1="4" x2="9" y2="4"/><line x1="3" y1="8" x2="9" y2="8"/></svg>`,
      "슬롯 상/하 배치"
    );
    slotVBtn.addEventListener("click", () => this._setSlotLayout("vertical"));
    utilGroup.appendChild(slotVBtn);

    this._slotHBtn = slotHBtn;
    this._slotVBtn = slotVBtn;

    const divider3 = document.createElement("span");
    this._divider3 = divider3;
    Object.assign(divider3.style, {
      width: "1px",
      height: "14px",
      background: "rgba(255,255,255,0.1)",
      flexShrink: "0",
    });

    // Open / focus parent SubGraph node in main graph
    const openParentBtn = makeSvgBtn(
      `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" style="width:11px;height:11px"><path d="M2 6h8M7 3l3 3-3 3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      "메인 그래프에서 노드 포커스"
    );
    openParentBtn.addEventListener("click", () => this._openParentNode());
    this._openParentBtn = openParentBtn;

    // Minimize button (collapse to title bar only)
    const minBtn = this._makeIconButton("", "최소화 (창 접기)");
    minBtn.innerHTML = `<span style="width:9px;height:9px;display:flex;align-items:center;pointer-events:none;color:inherit"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" style="width:9px;height:9px"><line x1="2" y1="7" x2="10" y2="7" stroke-linecap="round"/></svg></span>`;
    minBtn.style.fontSize = "10px";
    minBtn.style.padding = "2px";
    minBtn.addEventListener("click", () => this._toggleMinimize());
    this._minBtn = minBtn;

    // Maximize button (for floating window mode)
    const maxBtn = this._makeIconButton("", "최대화");
    maxBtn.innerHTML = `<span style="width:9px;height:9px;display:flex;align-items:center;pointer-events:none;color:inherit"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" style="width:9px;height:9px"><rect x="1.5" y="1.5" width="9" height="9" rx="0.5"/></svg></span>`;
    maxBtn.style.fontSize = "10px";
    maxBtn.style.padding = "2px";
    maxBtn.addEventListener("click", () => this._toggleMaximize());
    this._maxBtn = maxBtn;

    // close button
    const closeBtn = this._makeIconButton("✕", "Close sub-graph panel");
    this._closeBtn = closeBtn;
    closeBtn.style.fontSize = "11px";
    closeBtn.addEventListener("click", () => this.close());

    header.appendChild(breadcrumb);
    header.appendChild(dragHandle);
    header.appendChild(utilGroup);
    header.appendChild(dockGroup);
    header.appendChild(divider);
    header.appendChild(openParentBtn);
    header.appendChild(divider3);
    header.appendChild(minBtn);
    header.appendChild(maxBtn);
    header.appendChild(closeBtn);

    // ── canvas area ───────────────────────────────────────────────
    const canvasWrap = document.createElement("div");
    Object.assign(canvasWrap.style, {
      flex: "1",
      position: "relative",
      overflow: "hidden",
      minHeight: "0",
      minWidth: "0",
    });

    const canvas = document.createElement("canvas");
    Object.assign(canvas.style, {
      display: "block",
      width: "100%",
      height: "100%",
    });
    canvasWrap.appendChild(canvas);

    // content wrapper — always column so header stays at top for all dock sides
    const contentWrap = document.createElement("div");
    Object.assign(contentWrap.style, {
      flex: "1",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      minWidth: "0",
      minHeight: "0",
    });
    contentWrap.appendChild(header);
    contentWrap.appendChild(canvasWrap);

    // assemble: resizer + contentWrap (flex direction on el controls resizer side)
    el.appendChild(resizer);
    el.appendChild(contentWrap);
    outer.appendChild(el);

    this._el = el;
    this._resizerEl = resizer;
    this._breadcrumbEl = breadcrumb;
    this._headerEl = header;
    this._canvasWrapEl = canvasWrap;
    this._canvas = canvas;
  }

  _makeIconButton(text, title = "") {
    const btn = document.createElement("button");
    btn.textContent = text;
    btn.title = title;
    Object.assign(btn.style, {
      background: "none",
      border: "none",
      color: "rgba(255,255,255,0.35)",
      cursor: "pointer",
      fontSize: "10px",
      padding: "2px 4px",
      borderRadius: "3px",
      lineHeight: "1",
      flexShrink: "0",
    });
    btn.addEventListener("mouseenter", () => {
      btn.style.color = "#fff";
      btn.style.background = "rgba(255,255,255,0.1)";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.color = "rgba(255,255,255,0.35)";
      btn.style.background = "none";
    });
    return btn;
  }

  _makeDockButtons() {
    const wrap = document.createElement("div");
    Object.assign(wrap.style, {
      display: "flex",
      gap: "1px",
      alignItems: "center",
      flexShrink: "0",
    });

    const sides = [
      {
        side: "float",
        svg: `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="8" height="8" rx="1"/></svg>`,
        title: "창 모드 (플로팅)",
      },
      {
        side: "bottom",
        svg: `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="1" width="10" height="10" rx="1"/><line x1="1" y1="7" x2="11" y2="7"/></svg>`,
        title: "아래쪽 고정",
      },
      {
        side: "right",
        svg: `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="1" width="10" height="10" rx="1"/><line x1="7" y1="1" x2="7" y2="11"/></svg>`,
        title: "오른쪽 고정",
      },
      {
        side: "top",
        svg: `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="1" width="10" height="10" rx="1"/><line x1="1" y1="5" x2="11" y2="5"/></svg>`,
        title: "위쪽 고정",
      },
      {
        side: "left",
        svg: `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="1" width="10" height="10" rx="1"/><line x1="5" y1="1" x2="5" y2="11"/></svg>`,
        title: "왼쪽 고정",
      },
    ];

    for (const d of sides) {
      const btn = this._makeIconButton("", d.title);
      btn.style.width = "20px";
      btn.style.height = "20px";
      btn.style.display = "flex";
      btn.style.alignItems = "center";
      btn.style.justifyContent = "center";
      btn.style.padding = "0";
      btn.innerHTML = `<span style="width:12px;height:12px;display:flex;align-items:center;color:inherit">${d.svg}</span>`;
      btn.addEventListener("click", () => this.setDock(d.side));
      wrap.appendChild(btn);
      d._btn = btn;
    }
    this._dockBtns = sides;
    return wrap;
  }

  _startResize(e, direction) {
    e.preventDefault();
    e.stopPropagation();
    if (this._dock !== "float" || this._maximized) return;

    this._resizing = true;
    const startX = e.clientX;
    const startY = e.clientY;
    const origW = this._width;
    const origH = this._height;
    const origX = this._x;
    const origY = this._y;
    const MIN_W = this._minSize; // 280
    const MIN_H = 200;

    const resizeRight = ["r", "se", "ne"].includes(direction);
    const resizeBottom = ["b", "se", "sw"].includes(direction);
    const resizeLeft = ["l", "nw", "sw"].includes(direction);
    const resizeTop = ["t", "nw", "ne"].includes(direction);

    document.body.style.userSelect = "none";

    const onMouseMove = (ev) => {
      if (!this._resizing) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let newW = origW;
      let newH = origH;
      let newX = origX;
      let newY = origY;

      if (resizeRight) newW = Math.max(MIN_W, origW + dx);
      if (resizeBottom) newH = Math.max(MIN_H, origH + dy);
      if (resizeLeft) {
        const clampedDx = Math.min(dx, origW - MIN_W);
        newW = origW - clampedDx;
        newX = origX + clampedDx;
      }
      if (resizeTop) {
        const clampedDx2 = Math.min(dy, origH - MIN_H);
        newH = origH - clampedDx2;
        newY = origY + clampedDx2;
      }

      this._width = newW;
      this._height = newH;
      this._x = newX;
      this._y = newY;
      this._applyLayout();
    };

    const onMouseUp = () => {
      this._resizing = false;
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  _toggleMinimize() {
    if (this._maximized) this._toggleMaximize(); // un-maximize first
    this._minimized = !this._minimized;
    if (this._minBtn) {
      this._minBtn.title = this._minimized ? "복원 (창 펼치기)" : "최소화 (창 접기)";
    }
    this._applyLayout();
    if (!this._minimized) {
      // restore canvas after un-minimizing
      requestAnimationFrame(() => {
        if (this._renderer && this._canvas) {
          const w = this._canvasWrapEl.clientWidth;
          const h = this._canvasWrapEl.clientHeight;
          if (w && h) {
            this._renderer.resize(w, h);
            this._portRenderer?.resize(w, h);
            this._controller?.render();
          }
        }
      });
    }
  }

  _toggleMaximize() {
    if (this._dock !== "float") return;
    if (this._minimized) {
      this._minimized = false; // un-minimize before maximizing
      if (this._minBtn) this._minBtn.title = "최소화 (창 접기)";
    }
    this._maximized = !this._maximized;
    if (this._maximized) {
      // Save current bounds
      this._preMaximizedBounds = {
        x: this._x,
        y: this._y,
        width: this._width,
        height: this._height,
      };
    } else if (this._preMaximizedBounds) {
      // Restore previous bounds
      this._x = this._preMaximizedBounds.x;
      this._y = this._preMaximizedBounds.y;
      this._width = this._preMaximizedBounds.width;
      this._height = this._preMaximizedBounds.height;
    }

    // Update Maximize/Restore button icon/tooltip
    if (this._maxBtn) {
      if (this._maximized) {
        this._maxBtn.title = "이전 크기로 복원";
        this._maxBtn.innerHTML = `<span style="width:9px;height:9px;display:flex;align-items:center;pointer-events:none;color:inherit"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" style="width:9px;height:9px"><rect x="1.5" y="3.5" width="7" height="7" rx="0.5"/><rect x="3.5" y="1.5" width="7" height="7" rx="0.5" fill="#13151c"/></svg></span>`;
      } else {
        this._maxBtn.title = "최대화";
        this._maxBtn.innerHTML = `<span style="width:9px;height:9px;display:flex;align-items:center;pointer-events:none;color:inherit"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" style="width:9px;height:9px"><rect x="1.5" y="1.5" width="9" height="9" rx="0.5"/></svg></span>`;
      }
    }

    this._applyLayout();
  }

  // ─── Utility actions ───────────────────────────────────────────────────────

  _setSlotLayout(mode) {
    if (this._controller) {
      this._controller.slotLayout = mode;
      this._controller.render();
    }
    // Sync to main graph too
    this.parentController?.setSlotLayout(mode);
    // Update button highlight
    if (this._slotHBtn)
      this._slotHBtn.style.background = mode === "horizontal" ? "rgba(99,179,237,0.2)" : "none";
    if (this._slotVBtn)
      this._slotVBtn.style.background = mode === "vertical" ? "rgba(99,179,237,0.2)" : "none";
  }

  _arrangeGrid(colsHint = 4, gapX = 60, gapY = 40) {
    if (!this._graph || !this._controller) return;
    const nodes = [...this._graph.nodes.values()];
    if (nodes.length === 0) return;

    // Estimate max node dimensions for uniform grid
    const nodeW = 180;
    const nodeH = 100;
    const cols = Math.min(colsHint, nodes.length);

    nodes.forEach((n, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      n.pos.x = col * (nodeW + gapX);
      n.pos.y = row * (nodeH + gapY);
    });

    this._controller.render();
    setTimeout(() => this._controller?.fitToView(), 50);
  }

  _openParentNode() {
    if (!this._parentNode || !this.parentController) return;
    // Select and scroll to the SubGraph node in the main graph
    this.parentController.selection = new Set([this._parentNode.id]);
    this.parentController.render();
    // Center view on it
    const n = this._parentNode;
    const x = n.pos.x + (n.size?.w || 170) / 2;
    const y = n.pos.y + (n.size?.h || 76) / 2;
    const r = this.parentController.renderer;
    r.setTransform({
      scale: r.scale,
      offsetX: r.width / 2 - x * r.scale,
      offsetY: r.height / 2 - y * r.scale,
    });
    this.parentController.render();
  }

  // ─── Resize panel drag ─────────────────────────────────────────────────────

  _onPanelResizeMouse(type, e) {
    if (type === "move" && this._dragging) {
      const cfg = DOCK_CFG[this._dock];
      const vert = cfg.panelSize === "height";
      const delta = vert
        ? this._dock === "bottom"
          ? this._dragStart.y - e.clientY
          : e.clientY - this._dragStart.y
        : this._dock === "right"
          ? this._dragStart.x - e.clientX
          : e.clientX - this._dragStart.x;
      this._size = Math.max(this._minSize, this._sizeAtStart + delta);
      this._applyLayout();
    } else if (type === "up") {
      this._dragging = false;
      document.body.style.userSelect = "";
      this._resizerEl.style.background = "rgba(255,255,255,0.06)";
      window.removeEventListener("mousemove", this._onResizeMove);
      window.removeEventListener("mouseup", this._onResizeUp);
    }
  }

  // ─── Dock / layout ─────────────────────────────────────────────────────────

  setDock(side) {
    if (side === "float") {
      this._dock = "float";
      // First switch to float: compute initial position relative to container
      if (!this._hasBeenPositioned) {
        const outer = this.mainArea.parentElement;
        const W = outer.clientWidth || 1200;
        const H = outer.clientHeight || 800;
        this._width = Math.min(this._width, W - 40);
        this._height = Math.min(this._height, H - 40);
        this._x = Math.max(20, W - this._width - 20);
        this._y = 20;
        this._hasBeenPositioned = true;
      }
      if (this._open) this._applyLayout();
      for (const d of this._dockBtns || []) {
        d._btn.style.background = d.side === "float" ? "rgba(99,179,237,0.2)" : "none";
      }
      return;
    }
    if (!DOCK_CFG[side]) return;
    this._dock = side;
    this._minimized = false; // reset minimize when switching to docked
    this._updateResizerStyle();
    if (this._open) this._applyLayout();
    // Highlight active dock button
    for (const d of this._dockBtns || []) {
      d._btn.style.background = d.side === side ? "rgba(99,179,237,0.2)" : "none";
    }
  }

  _updateResizerStyle() {
    const cfg = DOCK_CFG[this._dock];
    if (!cfg) return; // float mode has no split resizer
    Object.assign(this._resizerEl.style, {
      cursor: cfg.cursor,
      height: cfg.resizerH,
      width: cfg.resizerW,
    });
  }

  _applyLayout() {
    if (!this._open) return;
    const cfg = DOCK_CFG[this._dock];
    const el = this._el;

    const isMax = this._maximized;
    const isMin = this._minimized;
    const isDocked = this._dock !== "float";

    // Helper to toggle visibility of header items
    const show = (item, visible, displayType = "") => {
      if (item) item.style.display = visible ? displayType : "none";
    };

    // Reset default visibility for header elements
    show(this._breadcrumbEl, true);
    show(this._utilGroup, true, "flex");
    show(this._dockGroup, true, "flex");
    show(this._divider, true);
    show(this._openParentBtn, true);
    show(this._divider3, true);
    show(this._minBtn, true);
    show(this._maxBtn, !isDocked);
    show(this._closeBtn, true);

    if (this._minBtn) {
      this._minBtn.title = isMin ? "복원 (창 펼치기)" : "최소화 (창 접기)";
      this._minBtn.innerHTML = isMin
        ? `<span style="width:9px;height:9px;display:flex;align-items:center;pointer-events:none;color:inherit;flex-shrink:0;"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" style="width:9px;height:9px"><line x1="2" y1="6" x2="10" y2="6" stroke-linecap="round"/><line x1="6" y1="2" x2="6" y2="10" stroke-linecap="round"/></svg></span>`
        : `<span style="width:9px;height:9px;display:flex;align-items:center;pointer-events:none;color:inherit;flex-shrink:0;"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" style="width:9px;height:9px"><line x1="2" y1="7" x2="10" y2="7" stroke-linecap="round"/></svg></span>`;
    }

    if (this._headerEl) {
      this._headerEl.style.padding = "0 8px";
      this._headerEl.style.justifyContent = "";
    }

    if (this._dock === "float") {
      // Hide resizer (split handle)
      if (this._resizerEl) this._resizerEl.style.display = "none";

      // Toggle resize handles: hide when maximized or minimized
      const showHandles = !isMax && !isMin;
      if (this._resizeHandles) {
        this._resizeHandles.forEach((h) => {
          h.style.display = showHandles ? "block" : "none";
        });
      }

      // Show/hide maximize button
      if (this._maxBtn) this._maxBtn.style.display = isMin ? "none" : "";

      // Minimized: show only header (height:auto), hide canvas area
      if (isMin) {
        if (this._canvasWrapEl) this._canvasWrapEl.style.display = "none";

        // Hide non-essential header buttons
        show(this._utilGroup, false);
        show(this._dockGroup, false);
        show(this._divider, false);
        show(this._openParentBtn, false);
        show(this._divider3, false);
        show(this._maxBtn, false);

        Object.assign(el.style, {
          position: "absolute",
          left: `${this._x}px`,
          top: `${this._y}px`,
          width: `${this._width}px`,
          height: "auto",
          bottom: "",
          right: "",
          flexDirection: "column",
          borderRadius: "8px",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          boxShadow: "0 12px 40px rgba(0, 0, 0, 0.65)",
        });
        this._resetMainArea();
        return;
      }

      // Normal / maximized
      if (this._canvasWrapEl) this._canvasWrapEl.style.display = "";

      // Window position/size
      Object.assign(el.style, {
        position: "absolute",
        left: isMax ? "0px" : `${this._x}px`,
        top: isMax ? "0px" : `${this._y}px`,
        width: isMax ? "100%" : `${this._width}px`,
        height: isMax ? "100%" : `${this._height}px`,
        bottom: "",
        right: "",
        flexDirection: "column",
        borderRadius: isMax ? "0" : "8px",
        border: isMax ? "none" : "1px solid rgba(255, 255, 255, 0.12)",
        boxShadow: isMax ? "none" : "0 12px 40px rgba(0, 0, 0, 0.65)",
      });

      // Keep main area full screen
      this._resetMainArea();
    } else {
      // Show resizer (split handle)
      if (this._resizerEl) this._resizerEl.style.display = "block";

      // Hide resize handles
      if (this._resizeHandles) {
        this._resizeHandles.forEach((h) => {
          h.style.display = "none";
        });
      }

      // Hide maximize button since we are docked
      if (this._maxBtn) this._maxBtn.style.display = "none";

      const HEADER_H = 28;
      const panelBase = {
        position: "absolute",
        top: "",
        bottom: "",
        left: "",
        right: "",
        height: "",
        width: "",
        flexDirection: cfg.flexDir,
        borderRadius: "0",
        border: "none",
        boxShadow: "none",
      };
      cfg.panelProp.forEach((p) => {
        panelBase[p] = "0";
      });

      if (this._minimized) {
        // Minimized: hide canvas, collapse panel
        if (this._canvasWrapEl) this._canvasWrapEl.style.display = "none";
        if (this._resizerEl) this._resizerEl.style.display = "none";

        // Hide non-essential buttons
        show(this._utilGroup, false);
        show(this._dockGroup, false);
        show(this._divider, false);
        show(this._openParentBtn, false);
        show(this._divider3, false);

        const panelStyles = { ...panelBase };
        if (cfg.panelSize === "height") {
          // top/bottom: collapse to header height, reclaim main area
          panelStyles.height = `${HEADER_H}px`;
          Object.assign(el.style, panelStyles);

          const mainStyles = { top: "0", bottom: "0", left: "0", right: "0" };
          mainStyles[cfg.mainProp] = `${HEADER_H}px`;
          Object.assign(this.mainArea.style, mainStyles);
        } else {
          // left/right: collapse to header height (28px), overlay on top of main area
          panelStyles.width = `${this._size}px`;
          panelStyles.height = `${HEADER_H}px`;
          panelStyles.bottom = ""; // unset bottom to respect height
          Object.assign(el.style, panelStyles);

          const mainStyles = { top: "0", bottom: "0", left: "0", right: "0" };
          mainStyles[cfg.mainProp] = "0px"; // overlay style
          Object.assign(this.mainArea.style, mainStyles);
        }
      } else {
        // Normal docked layout
        if (this._canvasWrapEl) this._canvasWrapEl.style.display = "";
        const panelStyles = { ...panelBase };
        panelStyles[cfg.panelSize] = `${this._size}px`;
        Object.assign(el.style, panelStyles);

        const mainStyles = { top: "0", bottom: "0", left: "0", right: "0" };
        mainStyles[cfg.mainProp] = `${this._size}px`;
        Object.assign(this.mainArea.style, mainStyles);

        this._updateResizerStyle();
      }
    }

    // Trigger sub-graph renderer resize manually
    requestAnimationFrame(() => {
      if (this._renderer && this._canvas) {
        const w = this._canvasWrapEl.clientWidth;
        const h = this._canvasWrapEl.clientHeight;
        this._renderer.resize(w, h);
        this._portRenderer?.resize(w, h);
        this._controller?.render();
      }
    });
  }

  _resetMainArea() {
    Object.assign(this.mainArea.style, { top: "0", bottom: "0", left: "0", right: "0" });
  }

  // ─── Open / close ──────────────────────────────────────────────────────────

  open(parentNode, subGraphData = null, breadcrumb = []) {
    // Save previous sub-graph before switching
    if (this._open && this._parentNode && this._parentNode.id !== parentNode.id) {
      this._saveToNode(this._parentNode);
    }

    this._parentNode = parentNode;

    // Lazy-init own editor
    if (!this._renderer) this._initEditor();

    // Load graph data
    this._graph.clear();
    this._htmlOverlay?.clear();
    if (subGraphData?.nodes?.length) {
      try {
        this._graph.fromJSON(subGraphData);
      } catch (error) {
        this._hooks?.emit?.("error", error);
      }
    }

    this._setBreadcrumb(breadcrumb.length ? breadcrumb : ["하위 플레이북", parentNode.title]);

    this._el.style.display = "flex";
    this._open = true;
    this._applyLayout();

    // Force synchronous resize+render so the canvas buffer matches actual panel
    // dimensions on first paint — avoids 300×150 default buffer being stretched
    // over the full panel area (appears black) when _initEditor ran while hidden.
    if (this._renderer && this._canvasWrapEl) {
      const w = this._canvasWrapEl.clientWidth; // reading clientWidth forces reflow
      const h = this._canvasWrapEl.clientHeight;
      if (w && h) {
        this._renderer.resize(w, h);
        this._portRenderer?.resize(w, h);
        this._controller?.render();
      }
    }

    // Sync slot layout toggle button highlights to current layout
    const currentLayout = this.parentController?.slotLayout || "horizontal";
    if (this._slotHBtn)
      this._slotHBtn.style.background =
        currentLayout === "horizontal" ? "rgba(99,179,237,0.2)" : "none";
    if (this._slotVBtn)
      this._slotVBtn.style.background =
        currentLayout === "vertical" ? "rgba(99,179,237,0.2)" : "none";
  }

  toggle(parentNode, subGraphData = null, breadcrumb = []) {
    if (this._open && this._parentNode?.id === parentNode.id) {
      this.close();
    } else {
      this.open(parentNode, subGraphData, breadcrumb);
    }
  }

  close() {
    if (!this._open) return;
    if (this._parentNode) this._saveToNode(this._parentNode);

    this._el.style.display = "none";
    this._open = false;
    this._parentNode = null;
    this._resetMainArea();
  }

  _saveToNode(node) {
    if (this._graph && node) {
      node.state.subGraphData = this._graph.toJSON();
    }
  }

  isOpen() {
    return this._open;
  }
  isOpenFor(nodeId) {
    return this._open && this._parentNode?.id === nodeId;
  }

  // ─── Breadcrumb ────────────────────────────────────────────────────────────

  _setBreadcrumb(crumbs) {
    const el = this._breadcrumbEl;
    el.innerHTML = "";
    crumbs.forEach((c, i) => {
      if (i > 0) {
        const sep = document.createElement("span");
        sep.textContent = " › ";
        sep.style.opacity = "0.3";
        el.appendChild(sep);
      }
      const span = document.createElement("span");
      span.textContent = typeof c === "object" ? (c.label ?? c.title ?? "") : c;
      const isLast = i === crumbs.length - 1;
      span.style.color = isLast ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.35)";
      if (!isLast) {
        span.style.cursor = "pointer";
        span.addEventListener("mouseenter", () => {
          span.style.color = "rgba(255,255,255,0.7)";
        });
        span.addEventListener("mouseleave", () => {
          span.style.color = "rgba(255,255,255,0.35)";
        });
      }
      el.appendChild(span);
    });
  }

  // ─── Internal editor init ──────────────────────────────────────────────────

  _initEditor() {
    const hooks = createHooks([
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
      "node:updated",
    ]);

    const graph = new Graph({ hooks, registry: this.registry });
    const renderer = new CanvasRenderer(this._canvas, {
      theme: this.theme,
      registry: this.registry,
    });

    // No separate edge canvas — edges are drawn on the main renderer canvas to render behind nodes
    const edgeRenderer = null;

    // ── Port canvas (z=20, above edge canvas) ────────────────────
    const portCanvas = document.createElement("canvas");
    Object.assign(portCanvas.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: "20",
    });
    this._canvasWrapEl.appendChild(portCanvas);
    const portRenderer = new CanvasRenderer(portCanvas, {
      theme: this.theme,
      registry: this.registry,
    });
    portRenderer.setTransform = renderer.setTransform.bind(renderer);
    portRenderer.scale = renderer.scale;
    portRenderer.offsetX = renderer.offsetX;
    portRenderer.offsetY = renderer.offsetY;

    // ── HTML overlay (z=10) ──────────────────────────────────────
    const htmlOverlay = new HtmlOverlay(this._canvasWrapEl, renderer, this.registry);
    htmlOverlay._onHeightChange = () => controller.render(); // eslint-disable-line no-use-before-define

    // ── Icon manager ─────────────────────────────────────────────
    const icons = this.iconManager ?? new IconManager();
    renderer.iconManager = icons;

    // ── Context menu ─────────────────────────────────────────────
    const contextMenu = new ContextMenu({ graph, hooks, renderer, commandStack: null });

    // ── Controller ───────────────────────────────────────────────
    const controller = new Controller({
      graph,
      renderer,
      hooks,
      htmlOverlay,
      contextMenu,
      edgeRenderer,
      portRenderer,
    });
    if (this.parentController) {
      controller.slotLayout = this.parentController.slotLayout;
    }

    // Wire context menu now that controller (and its stack) exist
    contextMenu.commandStack = controller.stack;
    setupDefaultContextMenu(contextMenu, { controller, graph, hooks });

    controller.iconManager = icons;
    // Keyboard focus guard: only handle events when mouse is over this canvas
    controller._focused = false;
    this._canvas.addEventListener("mouseenter", () => {
      controller._focused = true;
    });
    this._canvas.addEventListener("mouseleave", () => {
      controller._focused = false;
    });

    // ── Runner ───────────────────────────────────────────────────
    const runner = new Runner({ graph, registry: this.registry, hooks });
    graph.runner = runner;
    graph.controller = controller;

    hooks.on("runner:tick", ({ time }) => controller.render(time));
    hooks.on("runner:start", () => controller.render(performance.now()));
    hooks.on("runner:stop", () => controller.render(performance.now()));
    hooks.on("node:updated", () => controller.render());

    // ── ResizeObserver: keep all canvases in sync ─────────────────
    this._ro = new ResizeObserver(() => {
      const w = this._canvasWrapEl.clientWidth;
      const h = this._canvasWrapEl.clientHeight;
      renderer.resize(w, h);
      portRenderer.resize(w, h);
      controller.render();
    });
    this._ro.observe(this._canvasWrapEl);

    // ── Property panel (opens on node double-click) ──────────────
    // Mount to the outer editor container (mainArea.parentElement) so that
    // height:100% in the CSS resolves to the full editor height, not the
    // ~320px sub-panel height.  This matches how the main editor mounts its
    // PropertyPanel to `container` in createGraphEditor.
    const propertyPanel = new PropertyPanel(this.mainArea.parentElement, {
      graph,
      hooks,
      registry: this.registry,
      controller,
      render: () => controller.render(),
    });
    hooks.on("node:dblclick", (node) => propertyPanel.open(node));

    // ── Transform-change callback: keeps HTML overlay in sync ─────
    renderer.setTransformChangeCallback(() => controller.render());

    // ── Reset transform when a new sub-graph is loaded ───────────
    hooks.on("graph:deserialize", () => {
      renderer.setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
      controller.render();
    });

    this._graph = graph;
    this._renderer = renderer;
    this._edgeRenderer = renderer; // for compatibility
    this._portRenderer = portRenderer;
    this._htmlOverlay = htmlOverlay;
    this._controller = controller;
    this._contextMenu = contextMenu;
    this._propertyPanel = propertyPanel;
    this._runner = runner;
    this._hooks = hooks;
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  destroy() {
    // Always remove drag listeners — they may still be attached if drag was interrupted
    window.removeEventListener("mousemove", this._onResizeMove);
    window.removeEventListener("mouseup", this._onResizeUp);
    document.body.style.userSelect = "";
    this.close();
    this._ro?.disconnect();
    this._controller?.destroy();
    this._contextMenu?.destroy();
    this._propertyPanel?.destroy();
    this._htmlOverlay?.destroy();
    this._runner?.stop();
    if (this._el?.parentElement) this._el.remove();
  }
}
