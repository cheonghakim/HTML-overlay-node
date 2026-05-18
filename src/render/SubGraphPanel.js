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

import { Graph } from '../core/Graph.js';
import { CanvasRenderer } from './CanvasRenderer.js';
import { Controller } from '../interact/Controller.js';
import { HtmlOverlay } from './HtmlOverlay.js';
import { Runner } from '../core/Runner.js';
import { createHooks } from '../core/Hooks.js';
import { IconManager } from './IconManager.js';
import { ContextMenu } from '../interact/ContextMenu.js';
import { PropertyPanel } from '../ui/PropertyPanel.js';
import { setupDefaultContextMenu } from '../defaults/contextMenu.js';

// Dock configuration — maps dock side to CSS properties
const DOCK_CFG = {
  bottom: { flexDir: 'column',         mainProp: 'bottom', panelProp: ['bottom','left','right'], panelSize: 'height', cursor: 'ns-resize', resizerH: '4px', resizerW: '100%' },
  top:    { flexDir: 'column-reverse',  mainProp: 'top',    panelProp: ['top','left','right'],    panelSize: 'height', cursor: 'ns-resize', resizerH: '4px', resizerW: '100%' },
  right:  { flexDir: 'row',            mainProp: 'right',  panelProp: ['top','right','bottom'],   panelSize: 'width',  cursor: 'ew-resize', resizerH: '100%', resizerW: '4px' },
  left:   { flexDir: 'row-reverse',    mainProp: 'left',   panelProp: ['top','left','bottom'],    panelSize: 'width',  cursor: 'ew-resize', resizerH: '100%', resizerW: '4px' },
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

    this._dock = 'bottom';
    this._size = 320;      // px  (height for top/bottom, width for left/right)
    this._minSize = 120;

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

    // Panel-resize drag state
    this._dragging = false;
    this._dragStart = null;
    this._sizeAtStart = 0;

    this._onResizeMove = this._onPanelResizeMouse.bind(this, 'move');
    this._onResizeUp   = this._onPanelResizeMouse.bind(this, 'up');

    this._buildDOM();
  }

  // ─── DOM construction ─────────────────────────────────────────────────────

  _buildDOM() {
    const outer = this.mainArea.parentElement; // overall container

    // ── wrapper ──────────────────────────────────────────────────
    const el = document.createElement('div');
    el.className = 'sg-panel';
    Object.assign(el.style, {
      position: 'absolute',
      zIndex: '50',
      background: '#0e1015',
      boxSizing: 'border-box',
      display: 'none',
      flexDirection: 'column',
      // overflow intentionally not set — PropertyPanel is mounted here and
      // must not be clipped. Inner contentWrap handles its own overflow.
    });

    // ── separator / resize handle ─────────────────────────────────
    const resizer = document.createElement('div');
    resizer.className = 'sg-resizer';
    Object.assign(resizer.style, {
      flexShrink: '0',
      background: 'rgba(255,255,255,0.06)',
      transition: 'background 0.12s',
      zIndex: '1',
    });
    resizer.addEventListener('mouseenter', () => { resizer.style.background = 'rgba(99,179,237,0.35)'; });
    resizer.addEventListener('mouseleave', () => { if (!this._dragging) resizer.style.background = 'rgba(255,255,255,0.06)'; });
    resizer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this._dragging = true;
      this._dragStart = { x: e.clientX, y: e.clientY };
      this._sizeAtStart = this._size;
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', this._onResizeMove);
      window.addEventListener('mouseup',   this._onResizeUp);
    });

    // ── header ────────────────────────────────────────────────────
    const header = document.createElement('div');
    Object.assign(header.style, {
      height: '28px',
      flexShrink: '0',
      display: 'flex',
      alignItems: 'center',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      padding: '0 8px',
      gap: '5px',
      background: '#13151c',
      fontSize: '10px',
      color: 'rgba(255,255,255,0.5)',
      fontFamily: '"Inter", system-ui, sans-serif',
      userSelect: 'none',
    });

    // breadcrumb
    const breadcrumb = document.createElement('div');
    breadcrumb.className = 'sg-breadcrumb';
    Object.assign(breadcrumb.style, {
      flex: '1',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
    });

    // dock buttons
    const dockGroup = this._makeDockButtons();

    // divider
    const divider = document.createElement('span');
    Object.assign(divider.style, { width: '1px', height: '14px', background: 'rgba(255,255,255,0.1)', flexShrink: '0' });

    // close button
    const closeBtn = this._makeIconButton('✕', 'Close sub-graph panel');
    closeBtn.style.fontSize = '11px';
    closeBtn.addEventListener('click', () => this.close());

    header.appendChild(breadcrumb);
    header.appendChild(dockGroup);
    header.appendChild(divider);
    header.appendChild(closeBtn);

    // ── canvas area ───────────────────────────────────────────────
    const canvasWrap = document.createElement('div');
    Object.assign(canvasWrap.style, {
      flex: '1',
      position: 'relative',
      overflow: 'hidden',
      minHeight: '0',
      minWidth: '0',
    });

    const canvas = document.createElement('canvas');
    Object.assign(canvas.style, {
      display: 'block',
      width: '100%',
      height: '100%',
    });
    canvasWrap.appendChild(canvas);

    // content wrapper — always column so header stays at top for all dock sides
    const contentWrap = document.createElement('div');
    Object.assign(contentWrap.style, {
      flex: '1',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      minWidth: '0',
      minHeight: '0',
    });
    contentWrap.appendChild(header);
    contentWrap.appendChild(canvasWrap);

    // assemble: resizer + contentWrap (flex direction on el controls resizer side)
    el.appendChild(resizer);
    el.appendChild(contentWrap);
    outer.appendChild(el);

    this._el           = el;
    this._resizerEl    = resizer;
    this._breadcrumbEl = breadcrumb;
    this._headerEl     = header;
    this._canvasWrapEl = canvasWrap;
    this._canvas       = canvas;
  }

  _makeIconButton(text, title = '') {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.title = title;
    Object.assign(btn.style, {
      background: 'none',
      border: 'none',
      color: 'rgba(255,255,255,0.35)',
      cursor: 'pointer',
      fontSize: '10px',
      padding: '2px 4px',
      borderRadius: '3px',
      lineHeight: '1',
      flexShrink: '0',
    });
    btn.addEventListener('mouseenter', () => { btn.style.color = '#fff'; btn.style.background = 'rgba(255,255,255,0.1)'; });
    btn.addEventListener('mouseleave', () => { btn.style.color = 'rgba(255,255,255,0.35)'; btn.style.background = 'none'; });
    return btn;
  }

  _makeDockButtons() {
    const wrap = document.createElement('div');
    Object.assign(wrap.style, { display: 'flex', gap: '1px', alignItems: 'center' });

    const sides = [
      { side: 'bottom', svg: `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="1" width="10" height="10" rx="1"/><line x1="1" y1="7" x2="11" y2="7"/></svg>`, title: '아래쪽 고정' },
      { side: 'right',  svg: `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="1" width="10" height="10" rx="1"/><line x1="7" y1="1" x2="7" y2="11"/></svg>`,  title: '오른쪽 고정' },
      { side: 'top',    svg: `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="1" width="10" height="10" rx="1"/><line x1="1" y1="5" x2="11" y2="5"/></svg>`,    title: '위쪽 고정' },
      { side: 'left',   svg: `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="1" width="10" height="10" rx="1"/><line x1="5" y1="1" x2="5" y2="11"/></svg>`,   title: '왼쪽 고정' },
    ];

    for (const d of sides) {
      const btn = this._makeIconButton('', d.title);
      btn.style.width = '20px';
      btn.style.height = '20px';
      btn.style.display = 'flex';
      btn.style.alignItems = 'center';
      btn.style.justifyContent = 'center';
      btn.style.padding = '0';
      btn.innerHTML = `<span style="width:12px;height:12px;display:flex;align-items:center;color:inherit">${d.svg}</span>`;
      btn.addEventListener('click', () => this.setDock(d.side));
      wrap.appendChild(btn);
      d._btn = btn;
    }
    this._dockBtns = sides;
    return wrap;
  }

  // ─── Resize panel drag ─────────────────────────────────────────────────────

  _onPanelResizeMouse(type, e) {
    if (type === 'move' && this._dragging) {
      const cfg = DOCK_CFG[this._dock];
      const vert = cfg.panelSize === 'height';
      const delta = vert
        ? (this._dock === 'bottom' ? this._dragStart.y - e.clientY : e.clientY - this._dragStart.y)
        : (this._dock === 'right'  ? this._dragStart.x - e.clientX : e.clientX - this._dragStart.x);
      this._size = Math.max(this._minSize, this._sizeAtStart + delta);
      this._applyLayout();
    } else if (type === 'up') {
      this._dragging = false;
      document.body.style.userSelect = '';
      this._resizerEl.style.background = 'rgba(255,255,255,0.06)';
      window.removeEventListener('mousemove', this._onResizeMove);
      window.removeEventListener('mouseup',   this._onResizeUp);
    }
  }

  // ─── Dock / layout ─────────────────────────────────────────────────────────

  setDock(side) {
    if (!DOCK_CFG[side]) return;
    this._dock = side;
    this._updateResizerStyle();
    if (this._open) this._applyLayout();
    // Highlight active dock button
    for (const d of (this._dockBtns || [])) {
      d._btn.style.background = d.side === side ? 'rgba(99,179,237,0.2)' : 'none';
    }
  }

  _updateResizerStyle() {
    const cfg = DOCK_CFG[this._dock];
    Object.assign(this._resizerEl.style, {
      cursor:  cfg.cursor,
      height:  cfg.resizerH,
      width:   cfg.resizerW,
    });
  }

  _applyLayout() {
    if (!this._open) return;
    const cfg  = DOCK_CFG[this._dock];
    const s    = this._size;
    const el   = this._el;

    // Panel position
    const panelStyles = {
      top: '', bottom: '', left: '', right: '',
      height: '', width: '',
      flexDirection: cfg.flexDir,
    };
    cfg.panelProp.forEach(p => { panelStyles[p] = '0'; });
    panelStyles[cfg.panelSize] = `${s}px`;
    Object.assign(el.style, panelStyles);

    // Shrink main area
    const mainStyles = { top: '0', bottom: '0', left: '0', right: '0' };
    mainStyles[cfg.mainProp] = `${s}px`;
    Object.assign(this.mainArea.style, mainStyles);

    this._updateResizerStyle();

    // Trigger renderer resize
    requestAnimationFrame(() => {
      if (this._renderer) {
        this._renderer.resize(this._canvas.clientWidth, this._canvas.clientHeight);
        this._controller?.render();
      }
    });
  }

  _resetMainArea() {
    Object.assign(this.mainArea.style, { top: '0', bottom: '0', left: '0', right: '0' });
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
    if (subGraphData?.nodes?.length) {
      try {
        this._graph.fromJSON(subGraphData);
      } catch (error) {
        this._hooks?.emit?.('error', error);
      }
    }

    this._setBreadcrumb(
      breadcrumb.length ? breadcrumb : ['하위 플레이북', parentNode.title]
    );

    this._el.style.display = 'flex';
    this._open = true;
    this._applyLayout();
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

    this._el.style.display = 'none';
    this._open = false;
    this._parentNode = null;
    this._resetMainArea();
  }

  _saveToNode(node) {
    if (this._graph && node) {
      node.state.subGraphData = this._graph.toJSON();
    }
  }

  isOpen()          { return this._open; }
  isOpenFor(nodeId) { return this._open && this._parentNode?.id === nodeId; }

  // ─── Breadcrumb ────────────────────────────────────────────────────────────

  _setBreadcrumb(crumbs) {
    const el = this._breadcrumbEl;
    el.innerHTML = '';
    crumbs.forEach((c, i) => {
      if (i > 0) {
        const sep = document.createElement('span');
        sep.textContent = ' › ';
        sep.style.opacity = '0.3';
        el.appendChild(sep);
      }
      const span = document.createElement('span');
      span.textContent = typeof c === 'object' ? (c.label ?? c.title ?? '') : c;
      const isLast = i === crumbs.length - 1;
      span.style.color = isLast ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.35)';
      if (!isLast) {
        span.style.cursor = 'pointer';
        span.addEventListener('mouseenter', () => { span.style.color = 'rgba(255,255,255,0.7)'; });
        span.addEventListener('mouseleave', () => { span.style.color = 'rgba(255,255,255,0.35)'; });
      }
      el.appendChild(span);
    });
  }

  // ─── Internal editor init ──────────────────────────────────────────────────

  _initEditor() {
    const hooks = createHooks([
      'node:create', 'node:move', 'node:click', 'node:dblclick',
      'edge:create', 'edge:delete', 'graph:serialize', 'graph:deserialize',
      'error', 'runner:tick', 'runner:start', 'runner:stop',
      'node:resize', 'group:change', 'node:updated',
    ]);

    const graph    = new Graph({ hooks, registry: this.registry });
    const renderer = new CanvasRenderer(this._canvas, { theme: this.theme, registry: this.registry });

    // ── Edge canvas (z=15, above HTML overlay) ───────────────────
    const edgeCanvas = document.createElement('canvas');
    Object.assign(edgeCanvas.style, {
      position: 'absolute', top: '0', left: '0',
      width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: '15',
    });
    this._canvasWrapEl.appendChild(edgeCanvas);
    const edgeRenderer = new CanvasRenderer(edgeCanvas, { theme: this.theme, registry: this.registry });
    // Share transform with main renderer via getters
    Object.defineProperty(edgeRenderer, 'scale',   { get: () => renderer.scale });
    Object.defineProperty(edgeRenderer, 'offsetX', { get: () => renderer.offsetX });
    Object.defineProperty(edgeRenderer, 'offsetY', { get: () => renderer.offsetY });

    // ── Port canvas (z=20, above edge canvas) ────────────────────
    const portCanvas = document.createElement('canvas');
    Object.assign(portCanvas.style, {
      position: 'absolute', top: '0', left: '0',
      width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: '20',
    });
    this._canvasWrapEl.appendChild(portCanvas);
    const portRenderer = new CanvasRenderer(portCanvas, { theme: this.theme, registry: this.registry });

    // ── HTML overlay (z=10) ──────────────────────────────────────
    const htmlOverlay = new HtmlOverlay(this._canvasWrapEl, renderer, this.registry);
    htmlOverlay._onHeightChange = () => controller.render();  // eslint-disable-line no-use-before-define

    // ── Icon manager ─────────────────────────────────────────────
    const icons = this.iconManager ?? new IconManager();
    renderer.iconManager    = icons;
    edgeRenderer.iconManager = icons;

    // ── Context menu ─────────────────────────────────────────────
    const contextMenu = new ContextMenu({ graph, hooks, renderer, commandStack: null });

    // ── Controller ───────────────────────────────────────────────
    const controller = new Controller({
      graph, renderer, hooks, htmlOverlay, contextMenu, edgeRenderer, portRenderer,
    });

    // Wire context menu now that controller (and its stack) exist
    contextMenu.commandStack = controller.stack;
    setupDefaultContextMenu(contextMenu, { controller, graph, hooks });

    controller.iconManager = icons;
    // Keyboard focus guard: only handle events when mouse is over this canvas
    controller._focused = false;
    this._canvas.addEventListener('mouseenter', () => { controller._focused = true; });
    this._canvas.addEventListener('mouseleave', () => { controller._focused = false; });

    // ── Runner ───────────────────────────────────────────────────
    const runner = new Runner({ graph, registry: this.registry, hooks });
    graph.runner     = runner;
    graph.controller = controller;

    hooks.on('runner:tick',  ({ time }) => controller.render(time));
    hooks.on('runner:start', ()         => controller.render(performance.now()));
    hooks.on('runner:stop',  ()         => controller.render(performance.now()));
    hooks.on('node:updated', ()         => controller.render());

    // ── ResizeObserver: keep all canvases in sync ─────────────────
    this._ro = new ResizeObserver(() => {
      const w = this._canvas.clientWidth;
      const h = this._canvas.clientHeight;
      renderer.resize(w, h);
      edgeRenderer.resize(w, h);
      portRenderer.resize(w, h);
      controller.render();
    });
    this._ro.observe(this._canvas);

    // ── Property panel (opens on node double-click) ──────────────
    // Mount to the outer editor container (mainArea.parentElement) so that
    // height:100% in the CSS resolves to the full editor height, not the
    // ~320px sub-panel height.  This matches how the main editor mounts its
    // PropertyPanel to `container` in createGraphEditor.
    const propertyPanel = new PropertyPanel(this.mainArea.parentElement, {
      graph, hooks, registry: this.registry, controller,
      render: () => controller.render(),
    });
    hooks.on('node:dblclick', (node) => propertyPanel.open(node));

    // ── Transform-change callback: keeps HTML overlay in sync ─────
    renderer.setTransformChangeCallback(() => controller.render());

    // ── Reset transform when a new sub-graph is loaded ───────────
    hooks.on('graph:deserialize', () => {
      renderer.setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
      controller.render();
    });

    this._graph         = graph;
    this._renderer      = renderer;
    this._edgeRenderer  = edgeRenderer;
    this._portRenderer  = portRenderer;
    this._htmlOverlay   = htmlOverlay;
    this._controller    = controller;
    this._contextMenu   = contextMenu;
    this._propertyPanel = propertyPanel;
    this._runner        = runner;
    this._hooks         = hooks;
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  destroy() {
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
