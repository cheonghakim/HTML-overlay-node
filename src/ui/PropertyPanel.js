/** Module-level registry so only one panel is open across all editor instances. */
const _allPanels = new Set();

/**
 * PropertyPanel — node property editor.
 *
 * Widget system:
 *   Add a `properties` array to your node definition to declare widgets:
 *
 *   registry.register("my/Node", {
 *     properties: [
 *       { key: "value", label: "Value", widget: "slider", min: 0, max: 1, step: 0.01 },
 *       { key: "mode",  label: "Mode",  widget: "select", options: ["linear", "ease"] },
 *       { key: "color", label: "Color", widget: "color" },
 *       {
 *         key: "gain",
 *         label: "Gain",
 *         widget: "number",
 *         onChange(node, value, { controller, graph }) {
 *           controller.updateNodeState(node.id, { gain: value, clipped: value > 1 });
 *         }
 *       },
 *     ],
 *   });
 *
 * Supported widget types: text, number, slider, toggle, select, color, textarea
 *
 * onChange(node, value, ctx) — called on committed change (undo-safe by default).
 *   ctx = { controller, graph, immediate }
 *   immediate: true  → live drag on slider (no undo needed)
 *   immediate: false → committed value (call controller.updateNodeState for undo)
 *
 * If onChange is omitted, the panel automatically calls controller.updateNodeState
 * with undo/redo support.
 */
export class PropertyPanel {
  constructor(container, { graph, hooks, registry, controller, render }) {
    this.container  = container;
    this.graph      = graph;
    this.hooks      = hooks;
    this.registry   = registry;
    this.controller = controller;
    this.render     = render;

    this.panel       = null;
    this.currentNode = null;
    this.isVisible   = false;
    this._selfUpdating = false;

    this._createPanel();
    this._bindHooks();
    _allPanels.add(this);
  }

  // ─── Hooks ───────────────────────────────────────────────────────────────────

  _bindHooks() {
    this.hooks?.on('edge:create',  () => { if (this._canRefresh()) this._renderContent(); });
    this.hooks?.on('edge:delete',  () => { if (this._canRefresh()) this._renderContent(); });

    this.hooks?.on('node:updated', (node) => {
      if (!this._canRefresh() || this.currentNode?.id !== node?.id) return;
      if (this._selfUpdating) return;
      // Lightweight sync — only update widget values, don't destroy/recreate DOM
      this._syncWidgetValues(node);
    });

    this.hooks?.on('node:move', (node) => {
      if (this._canRefresh() && this.currentNode?.id === node?.id) {
        this._updatePositionFields();
      }
    });

    this.hooks?.on('runner:tick', () => { if (this._canRefresh()) this._updateLiveValues(); });
    this.hooks?.on('runner:stop', () => { if (this._canRefresh()) this._updateLiveValues(); });
  }

  _canRefresh() {
    if (!this.isVisible || !this.currentNode) return false;
    return !this.panel.querySelector('[data-field]:focus, [data-prop-key]:focus');
  }

  // ─── DOM shell ────────────────────────────────────────────────────────────────

  _createPanel() {
    this.panel = document.createElement('div');
    this.panel.className = 'property-panel';
    this.panel.style.display = 'none';

    this.panel.innerHTML = `
      <div class="panel-inner">
        <div class="panel-header">
          <div class="panel-title"><span class="title-text">Node Properties</span></div>
          <button class="panel-close" type="button">×</button>
        </div>
        <div class="panel-content"></div>
      </div>
    `;

    this.container.appendChild(this.panel);

    this.panel.querySelector('.panel-close').addEventListener('click', () => this.close());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) this.close();
    });
  }

  // ─── Open / close ─────────────────────────────────────────────────────────────

  open(node) {
    if (!node) return;
    // Close every other panel before opening this one
    for (const other of _allPanels) {
      if (other !== this && other.isVisible) other.close();
    }
    this.currentNode = node;
    this.isVisible   = true;
    this._renderContent();
    this.panel.style.display = 'block';
    this.panel.classList.add('panel-visible');
  }

  close() {
    this.isVisible = false;
    this.panel.classList.remove('panel-visible');
    setTimeout(() => {
      this.panel.style.display = 'none';
      this.currentNode = null;
    }, 200);
  }

  // ─── Full render ──────────────────────────────────────────────────────────────

  _renderContent() {
    const node = this.currentNode;
    if (!node) return;

    const content = this.panel.querySelector('.panel-content');
    content.innerHTML = `
      ${this._renderBasicInfo(node)}
      ${this._renderPositionSize(node)}
      ${this._renderConnections(node)}
      ${this._renderPorts(node)}
      ${this._renderLiveValues(node)}
      ${this._renderStateSection(node)}
      <div class="panel-actions">
        <button class="btn-secondary panel-close-btn">Close</button>
      </div>
    `;

    this._attachInputListeners();
  }

  // ─── Section renderers ────────────────────────────────────────────────────────

  _renderBasicInfo(node) {
    return `
      <div class="section">
        <div class="section-title">Basic Info</div>
        <div class="section-body">
          <div class="field">
            <label>Type</label>
            <input type="text" value="${_esc(node.type)}" readonly />
          </div>
          <div class="field">
            <label>Title</label>
            <input type="text" data-field="title" value="${_esc(node.title || '')}" />
          </div>
          <div class="field">
            <label>ID</label>
            <input type="text" value="${_esc(node.id)}" readonly />
          </div>
        </div>
      </div>`;
  }

  _renderPositionSize(node) {
    return `
      <div class="section">
        <div class="section-title">Position &amp; Size</div>
        <div class="section-body">
          <div class="field-row">
            <div class="field">
              <label>X</label>
              <input type="number" data-field="x" value="${Math.round(node.computed.x)}" />
            </div>
            <div class="field">
              <label>Y</label>
              <input type="number" data-field="y" value="${Math.round(node.computed.y)}" />
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label>Width</label>
              <input type="number" data-field="width" value="${node.computed.w}" />
            </div>
            <div class="field">
              <label>Height</label>
              <input type="number" data-field="height" value="${node.computed.h}" />
            </div>
          </div>
        </div>
      </div>`;
  }

  /**
   * State section — uses declared `properties` widgets when available,
   * falls back to auto-rendering primitive state keys.
   */
  _renderStateSection(node) {
    const def = this._getDef(node);
    if (def?.properties?.length) {
      return this._renderPropertyWidgets(node, def.properties);
    }
    return this._renderStateAuto(node);
  }

  // ─── Declared widget system ───────────────────────────────────────────────────

  /**
   * Render the Properties section from a node def's `properties` array.
   * Each entry describes one widget bound to a node.state key.
   */
  _renderPropertyWidgets(node, properties) {
    if (!properties?.length) return '';
    const rows = properties.map(p => this._renderSingleWidget(p, node)).join('');
    return `
      <div class="section">
        <div class="section-title">Properties</div>
        <div class="section-body">${rows}</div>
      </div>`;
  }

  _renderSingleWidget(propDef, node) {
    const { key, label, widget = 'text', min, max, step, options, placeholder, readonly } = propDef;
    const value = node.state[key];
    const lbl   = label ?? key;
    const ro    = readonly ? true : false;

    let input;
    switch (widget) {
      case 'number':
        input = `<input type="number" data-prop-key="${key}"
          value="${value ?? ''}"
          ${min  !== undefined ? `min="${min}"`   : ''}
          ${max  !== undefined ? `max="${max}"`   : ''}
          ${step !== undefined ? `step="${step}"` : ''}
          ${ro ? 'readonly' : ''} />`;
        break;

      case 'slider': {
        const sMin  = min  ?? 0;
        const sMax  = max  ?? 1;
        const sStep = step ?? 0.01;
        const sVal  = value ?? sMin;
        const disp  = typeof sVal === 'number' ? sVal.toFixed(step != null && step >= 1 ? 0 : 2) : sVal;
        input = `<div class="prop-slider-wrap">
          <input type="range" data-prop-key="${key}" data-prop-widget="slider"
            value="${sVal}" min="${sMin}" max="${sMax}" step="${sStep}"
            ${ro ? 'disabled' : ''} />
          <span class="prop-slider-val" data-prop-display="${key}">${disp}</span>
        </div>`;
        break;
      }

      case 'toggle':
        input = `<label class="prop-toggle">
          <input type="checkbox" data-prop-key="${key}" data-prop-widget="toggle"
            ${value ? 'checked' : ''} ${ro ? 'disabled' : ''} />
          <span class="prop-toggle-track"></span>
        </label>`;
        break;

      case 'select': {
        const opts = options ?? [];
        const currentVal = String(value ?? '');
        const currentLabel = (() => {
          const match = opts.find(o => String(typeof o === 'object' ? o.value : o) === currentVal);
          if (!match) return currentVal;
          return typeof match === 'object' ? match.label : match;
        })();
        const itemsHtml = opts.map(opt => {
          const v = typeof opt === 'object' ? opt.value : opt;
          const l = typeof opt === 'object' ? opt.label : opt;
          const sel = String(v) === currentVal;
          return `<div class="prop-select-item${sel ? ' selected' : ''}" data-value="${_esc(String(v))}" role="option" tabindex="-1">${_esc(l)}</div>`;
        }).join('');
        input = `<div class="prop-select-wrap${ro ? ' prop-select-disabled' : ''}" data-prop-key="${key}" data-prop-widget="select" role="combobox">
          <button type="button" class="prop-select-btn" ${ro ? 'disabled' : ''}>
            <span class="prop-select-label">${_esc(currentLabel)}</span>
            <svg class="prop-select-arrow" viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 1l4 4 4-4"/></svg>
          </button>
          <div class="prop-select-menu" role="listbox">${itemsHtml}</div>
        </div>`;
        break;
      }

      case 'color':
        input = `<input type="color" data-prop-key="${key}"
          value="${value ?? '#000000'}" ${ro ? 'disabled' : ''} />`;
        break;

      case 'textarea':
        input = `<textarea data-prop-key="${key}" rows="3"
          ${placeholder ? `placeholder="${_esc(placeholder)}"` : ''}
          ${ro ? 'readonly' : ''}>${_esc(String(value ?? ''))}</textarea>`;
        break;

      default: // 'text'
        input = `<input type="text" data-prop-key="${key}"
          value="${_esc(String(value ?? ''))}"
          ${placeholder ? `placeholder="${_esc(placeholder)}"` : ''}
          ${ro ? 'readonly' : ''} />`;
    }

    return `<div class="field"><label>${_esc(lbl)}</label>${input}</div>`;
  }

  /**
   * Lightweight sync: update widget values from node.state without rebuilding DOM.
   * Called on node:updated to avoid destroying focus or scroll position.
   */
  _syncWidgetValues(node) {
    if (!node || !this.panel) return;
    const def = this._getDef(node);

    if (def?.properties?.length) {
      // Sync declared property widgets
      for (const propDef of def.properties) {
        const { key, widget = 'text', step } = propDef;
        const value = node.state[key];
        const el    = this.panel.querySelector(`[data-prop-key="${key}"]`);
        if (!el || document.activeElement === el) continue;
        this._setWidgetValue(el, value, widget, step);
        // Update slider display label
        if (widget === 'slider') {
          const disp = this.panel.querySelector(`[data-prop-display="${key}"]`);
          if (disp) disp.textContent = typeof value === 'number'
            ? value.toFixed(step != null && step >= 1 ? 0 : 2)
            : String(value ?? '');
        }
      }
    } else {
      // Sync auto-rendered state fields
      this.panel.querySelectorAll('[data-field^="state."]').forEach(el => {
        if (document.activeElement === el) return;
        const key = el.dataset.field.substring(6);
        if (key in node.state) this._setWidgetValue(el, node.state[key]);
      });
    }
  }

  _getWidgetValue(el, widget) {
    if (widget === 'toggle') return el.checked;
    if (widget === 'select') {
      // Custom select: read from the selected item's data-value
      return el.querySelector('.prop-select-item.selected')?.dataset.value ?? '';
    }
    if (el.type === 'number' || el.type === 'range') return parseFloat(el.value);
    return el.value;
  }

  _setWidgetValue(el, value, widget, _step) {
    if (widget === 'toggle') { el.checked = Boolean(value); return; }
    if (el.type === 'checkbox') { el.checked = Boolean(value); return; }
    if (widget === 'select') {
      // Custom select: update selected class and displayed label
      const str = String(value ?? '');
      el.querySelectorAll('.prop-select-item').forEach(item => {
        item.classList.toggle('selected', item.dataset.value === str);
      });
      const label = el.querySelector('.prop-select-item.selected')?.textContent ?? str;
      const labelEl = el.querySelector('.prop-select-label');
      if (labelEl) labelEl.textContent = label;
      return;
    }
    if (el.tagName === 'TEXTAREA') { el.value = String(value ?? ''); return; }
    el.value = value ?? '';
  }

  // ─── Event listeners ──────────────────────────────────────────────────────────

  _attachInputListeners() {
    const node = this.currentNode;
    if (!node) return;
    const def = this._getDef(node);

    // ── Declared property widgets ─────────────────────────────────
    this.panel.querySelectorAll('[data-prop-key]').forEach(el => {
      const key      = el.dataset.propKey;
      const widgetEl = el.dataset.propWidget; // 'slider' | 'toggle' | undefined
      const propDef  = def?.properties?.find(p => p.key === key);
      const { onChange } = propDef ?? {};

      const commit = (immediate = false) => {
        const value = this._getWidgetValue(el, widgetEl ?? propDef?.widget ?? 'text');
        this._selfUpdating = true;

        if (onChange) {
          onChange(node, value, {
            controller: this.controller,
            graph:      this.graph,
            immediate,
          });
        } else if (!immediate) {
          // Default commit: undo-safe state update
          this.controller?.updateNodeState(node.id, { [key]: value });
        } else {
          // Default live drag: direct mutation + render (no undo entry)
          node.state[key] = value;
          this.hooks?.emit('node:updated', node);
          this.render?.();
        }

        this._selfUpdating = false;

        // Update slider display label in real-time
        if (widgetEl === 'slider') {
          const dispEl = this.panel.querySelector(`[data-prop-display="${key}"]`);
          const sVal = parseFloat(el.value);
          const step = propDef?.step;
          if (dispEl) dispEl.textContent = sVal.toFixed(step != null && step >= 1 ? 0 : 2);
        }
      };

      if (widgetEl === 'slider') {
        el.addEventListener('input',  () => commit(true));   // live drag — no undo
        el.addEventListener('change', () => commit(false));  // release — undo recorded
      } else if (widgetEl === 'select') {
        // Custom dropdown: wire up item clicks and open/close toggle
        const btn  = el.querySelector('.prop-select-btn');
        const menu = el.querySelector('.prop-select-menu');

        btn?.addEventListener('click', (e) => {
          e.stopPropagation();
          const isOpen = el.classList.contains('prop-select-open');
          // Close any other open dropdowns first
          document.querySelectorAll('.prop-select-wrap.prop-select-open').forEach(w => w.classList.remove('prop-select-open'));
          if (!isOpen) el.classList.add('prop-select-open');
        });

        menu?.querySelectorAll('.prop-select-item').forEach(item => {
          item.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.querySelectorAll('.prop-select-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            const labelEl = el.querySelector('.prop-select-label');
            if (labelEl) labelEl.textContent = item.textContent;
            el.classList.remove('prop-select-open');
            commit(false);
          });
        });
      } else {
        el.addEventListener('change', () => commit(false));
      }
    });

    // Close open dropdowns when clicking outside the panel
    const _closeDropdowns = (e) => {
      if (!this.panel.contains(e.target)) {
        this.panel.querySelectorAll('.prop-select-wrap.prop-select-open')
          .forEach(w => w.classList.remove('prop-select-open'));
      }
    };
    if (this._dropdownCleanup) document.removeEventListener('click', this._dropdownCleanup);
    document.addEventListener('click', _closeDropdowns);
    this._dropdownCleanup = _closeDropdowns;

    // ── Auto-rendered state fields (data-field="state.*") ─────────
    this.panel.querySelectorAll('[data-field]').forEach(el => {
      el.addEventListener('change', () => {
        this._selfUpdating = true;
        this._handleFieldChange(el.dataset.field, el.value);
        this._selfUpdating = false;
      });
    });

    this.panel.querySelector('.panel-close-btn')?.addEventListener('click', () => this.close());
  }

  // ─── Auto-rendered state fallback ─────────────────────────────────────────────

  _renderStateAuto(node) {
    if (!node.state) return '';
    const entries = Object.entries(node.state).filter(([k, v]) => {
      if (k.startsWith('_')) return false;
      const t = typeof v;
      return t === 'string' || t === 'number' || t === 'boolean';
    });
    if (!entries.length) return '';

    const fieldHtml = ([key, value]) => {
      if (typeof value === 'boolean') {
        return `<div class="field"><label>${_esc(key)}</label>
          <select data-field="state.${key}">
            <option value="true"${value ? ' selected' : ''}>true</option>
            <option value="false"${!value ? ' selected' : ''}>false</option>
          </select></div>`;
      }
      return `<div class="field"><label>${_esc(key)}</label>
        <input type="${typeof value === 'number' ? 'number' : 'text'}"
               data-field="state.${key}" value="${_esc(String(value))}" /></div>`;
    };

    return `
      <div class="section">
        <div class="section-title">State</div>
        <div class="section-body">${entries.map(fieldHtml).join('')}</div>
      </div>`;
  }

  _handleFieldChange(field, value) {
    const node = this.currentNode;
    if (!node || !this.controller) return;
    switch (field) {
      case 'title':  this.controller.updateNodeProperty(node.id, 'title',  value); break;
      case 'x':      this.controller.updateNodeProperty(node.id, 'x',      parseFloat(value)); break;
      case 'y':      this.controller.updateNodeProperty(node.id, 'y',      parseFloat(value)); break;
      case 'width':  this.controller.updateNodeProperty(node.id, 'width',  parseFloat(value)); break;
      case 'height': this.controller.updateNodeProperty(node.id, 'height', parseFloat(value)); break;
      default:
        if (field.startsWith('state.')) {
          const key  = field.substring(6);
          const orig = node.state[key];
          if (node.state && key in node.state) {
            const next = { ...node.state };
            if (typeof orig === 'boolean')     next[key] = value === 'true';
            else if (typeof orig === 'number') next[key] = parseFloat(value);
            else                               next[key] = value;
            this.controller.updateNodeState(node.id, next);
          }
        }
    }
  }

  // ─── Connections / Ports / Live values ────────────────────────────────────────

  _renderConnections(node) {
    const edges    = [...this.graph.edges.values()];
    const incoming = edges.filter(e => e.toNode   === node.id);
    const outgoing = edges.filter(e => e.fromNode === node.id);
    if (!incoming.length && !outgoing.length) return '';

    const edgeLabel = (e, dir) => {
      const otherId = dir === 'in' ? e.fromNode : e.toNode;
      const other   = this.graph.nodes.get(otherId);
      return `<div class="port-item">
        <span class="port-icon data"></span>
        <span class="port-name" style="font-size:10px;color:#5a5a78;">${_esc(other?.title ?? otherId)}</span>
      </div>`;
    };

    return `
      <div class="section">
        <div class="section-title">Connections</div>
        <div class="section-body">
          ${incoming.length ? `<div class="port-group">
            <div class="port-group-title">Incoming (${incoming.length})</div>
            ${incoming.map(e => edgeLabel(e, 'in')).join('')}
          </div>` : ''}
          ${outgoing.length ? `<div class="port-group">
            <div class="port-group-title">Outgoing (${outgoing.length})</div>
            ${outgoing.map(e => edgeLabel(e, 'out')).join('')}
          </div>` : ''}
        </div>
      </div>`;
  }

  _renderPorts(node) {
    if (!node.inputs.length && !node.outputs.length) return '';
    return `
      <div class="section">
        <div class="section-title">Ports</div>
        <div class="section-body">
          ${node.inputs.length ? `<div class="port-group">
            <div class="port-group-title">Inputs (${node.inputs.length})</div>
            ${node.inputs.map(p => `<div class="port-item">
              <span class="port-icon ${p.portType || 'data'}"></span>
              <span class="port-name">${_esc(p.name)}</span>
              ${p.datatype ? `<span class="port-type">${_esc(p.datatype)}</span>` : ''}
            </div>`).join('')}
          </div>` : ''}
          ${node.outputs.length ? `<div class="port-group">
            <div class="port-group-title">Outputs (${node.outputs.length})</div>
            ${node.outputs.map(p => `<div class="port-item">
              <span class="port-icon ${p.portType || 'data'}"></span>
              <span class="port-name">${_esc(p.name)}</span>
              ${p.datatype ? `<span class="port-type">${_esc(p.datatype)}</span>` : ''}
            </div>`).join('')}
          </div>` : ''}
        </div>
      </div>`;
  }

  _renderLiveValues(node) {
    const cur = this.graph?._curBuf?.();
    if (!cur) return '';
    const lines = [];
    for (const input of node.inputs) {
      for (const edge of this.graph.edges.values()) {
        if (edge.toNode === node.id && edge.toPort === input.id) {
          const val = cur.get(`${edge.fromNode}:${edge.fromPort}`);
          if (val !== undefined) {
            lines.push(`<div class="port-item">
              <span class="port-icon data"></span>
              <span class="port-name">↳ ${_esc(input.name)}</span>
              <span class="port-type" style="color:var(--color-primary);background:rgba(99,102,241,0.1);">${_esc(JSON.stringify(val))}</span>
            </div>`);
          }
          break;
        }
      }
    }
    for (const output of node.outputs) {
      const val = cur.get(`${node.id}:${output.id}`);
      if (val !== undefined) {
        lines.push(`<div class="port-item">
          <span class="port-icon exec" style="background:#10b981;"></span>
          <span class="port-name">↳ ${_esc(output.name)}</span>
          <span class="port-type" style="color:#10b981;background:rgba(16,185,129,0.1);">${_esc(JSON.stringify(val))}</span>
        </div>`);
      }
    }
    if (!lines.length) return '';
    return `
      <div class="section live-values-section">
        <div class="section-title">Live Values</div>
        <div class="section-body">${lines.join('')}</div>
      </div>`;
  }

  // ─── Lightweight position + live-value updates ────────────────────────────────

  _updatePositionFields() {
    const node = this.currentNode;
    if (!node) return;
    const xEl = this.panel.querySelector('[data-field="x"]');
    const yEl = this.panel.querySelector('[data-field="y"]');
    if (xEl) xEl.value = Math.round(node.computed.x);
    if (yEl) yEl.value = Math.round(node.computed.y);
  }

  _updateLiveValues() {
    const node = this.currentNode;
    if (!node) return;
    const newHtml = this._renderLiveValues(node);
    let section   = this.panel.querySelector('.live-values-section');
    if (!newHtml) { section?.remove(); return; }
    const wrapper    = document.createElement('div');
    wrapper.innerHTML = newHtml;
    const newSection  = wrapper.firstElementChild;
    if (section) {
      section.replaceWith(newSection);
    } else {
      const actions = this.panel.querySelector('.panel-actions');
      actions ? actions.before(newSection) : this.panel.querySelector('.panel-content').appendChild(newSection);
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  _getDef(node) {
    return this.registry?.types?.get(node?.type) ?? null;
  }

  destroy() {
    _allPanels.delete(this);
    if (this._dropdownCleanup) document.removeEventListener('click', this._dropdownCleanup);
    this.panel?.remove();
  }
}

/** Minimal HTML-escape for attribute/text values. */
function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
