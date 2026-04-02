/**
 * PropertyPanel - Node property editor panel
 */
export class PropertyPanel {
  constructor(container, { graph, hooks, registry, render }) {
    this.container = container;
    this.graph = graph;
    this.hooks = hooks;
    this.registry = registry;
    this.render = render;
    this._def = null; // current node type definition

    this.panel = null;
    this.currentNode = null;
    this.isVisible = false;
    this._selfUpdating = false; // prevent re-render loop while user is editing

    this._createPanel();
    this._bindHooks();
  }

  _bindHooks() {
    // Refresh when edges change
    this.hooks?.on('edge:create', () => {
      if (this._canRefresh()) this._renderContent();
    });
    this.hooks?.on('edge:delete', () => {
      if (this._canRefresh()) this._renderContent();
    });
    // Refresh when node state changes externally
    this.hooks?.on('node:updated', (node) => {
      if (this._canRefresh() && this.currentNode?.id === node?.id && !this._selfUpdating) {
        this._renderContent();
      }
    });
    // Refresh position fields when node moves
    this.hooks?.on('node:move', (node) => {
      if (this._canRefresh() && this.currentNode?.id === node?.id) {
        this._updatePositionFields();
      }
    });
    // Refresh live values on every runner tick (lightweight DOM update)
    this.hooks?.on('runner:tick', () => {
      if (this._canRefresh()) this._updateLiveValues();
    });
    this.hooks?.on('runner:stop', () => {
      if (this._canRefresh()) this._updateLiveValues();
    });
  }

  _canRefresh() {
    if (!this.isVisible || !this.currentNode) return false;
    // Don't clobber in-progress edits
    return !this.panel.querySelector('[data-field]:focus');
  }

  _createPanel() {
    this.panel = document.createElement('div');
    this.panel.className = 'property-panel';
    this.panel.style.display = 'none';

    this.panel.innerHTML = `
      <div class="panel-inner">
        <div class="panel-header">
          <div class="panel-title">
            <span class="title-text">Node Properties</span>
          </div>
          <button class="panel-close" type="button">×</button>
        </div>
        <div class="panel-content">
          <!-- Content will be dynamically generated -->
        </div>
      </div>
    `;

    this.container.appendChild(this.panel);

    this.panel.querySelector('.panel-close').addEventListener('click', () => {
      this.close();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.close();
      }
    });
  }

  open(node) {
    if (!node) return;
    this.currentNode = node;
    this._def = this.registry?.types?.get(node.type) || null;
    this.isVisible = true;
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

  _renderContent() {
    const node = this.currentNode;
    if (!node) return;

    const content = this.panel.querySelector('.panel-content');
    content.innerHTML = `
      <div class="section">
        <div class="section-title">Basic Info</div>
        <div class="section-body">
          <div class="field">
            <label>Type</label>
            <input type="text" value="${node.type}" readonly />
          </div>
          <div class="field">
            <label>Title</label>
            <input type="text" data-field="title" value="${node.title || ''}" />
          </div>
          <div class="field">
            <label>ID</label>
            <input type="text" value="${node.id}" readonly />
          </div>
        </div>
      </div>

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
      </div>

      ${this._renderConnections(node)}
      ${this._renderPorts(node)}
      ${this._renderLiveValues(node)}
      ${this._renderState(node)}

      <div class="panel-actions">
        <button class="btn-secondary panel-close-btn">Close</button>
      </div>
    `;

    this._attachInputListeners();
  }

  _renderConnections(node) {
    const edges = [...this.graph.edges.values()];
    const incoming = edges.filter(e => e.toNode === node.id);
    const outgoing = edges.filter(e => e.fromNode === node.id);

    if (!incoming.length && !outgoing.length) return '';

    const edgeLabel = (e, dir) => {
      const otherId = dir === 'in' ? e.fromNode : e.toNode;
      const other = this.graph.nodes.get(otherId);
      return `<div class="port-item">
        <span class="port-icon data"></span>
        <span class="port-name" style="font-size:10px;color:#5a5a78;">${other?.title ?? otherId}</span>
      </div>`;
    };

    return `
      <div class="section">
        <div class="section-title">Connections</div>
        <div class="section-body">
          ${incoming.length ? `
            <div class="port-group">
              <div class="port-group-title">Incoming (${incoming.length})</div>
              ${incoming.map(e => edgeLabel(e, 'in')).join('')}
            </div>` : ''}
          ${outgoing.length ? `
            <div class="port-group">
              <div class="port-group-title">Outgoing (${outgoing.length})</div>
              ${outgoing.map(e => edgeLabel(e, 'out')).join('')}
            </div>` : ''}
        </div>
      </div>
    `;
  }

  _renderLiveValues(node) {
    // Show live runtime values from the graph buffer (inputs & outputs)
    const cur = this.graph?._curBuf?.();
    if (!cur) return '';

    const lines = [];

    for (const input of node.inputs) {
      const key = `${node.id}:${input.id}`;
      // For inputs: look at the connected upstream node's output
      for (const edge of this.graph.edges.values()) {
        if (edge.toNode === node.id && edge.toPort === input.id) {
          const upKey = `${edge.fromNode}:${edge.fromPort}`;
          const val = cur.get(upKey);
          if (val !== undefined) {
            lines.push(`<div class="port-item">
              <span class="port-icon data"></span>
              <span class="port-name">↳ ${input.name}</span>
              <span class="port-type" style="color:var(--color-primary);background:rgba(99,102,241,0.1);">${JSON.stringify(val)}</span>
            </div>`);
          }
          break;
        }
      }
    }

    for (const output of node.outputs) {
      const key = `${node.id}:${output.id}`;
      const val = cur.get(key);
      if (val !== undefined) {
        lines.push(`<div class="port-item">
          <span class="port-icon exec" style="background:#10b981;"></span>
          <span class="port-name">↳ ${output.name}</span>
          <span class="port-type" style="color:#10b981;background:rgba(16,185,129,0.1);">${JSON.stringify(val)}</span>
        </div>`);
      }
    }

    if (!lines.length) return '';

    return `
      <div class="section">
        <div class="section-title">Live Values</div>
        <div class="section-body">
          ${lines.join('')}
        </div>
      </div>
    `;
  }

  _renderPorts(node) {
    if (!node.inputs.length && !node.outputs.length) return '';

    return `
      <div class="section">
        <div class="section-title">Ports</div>
        <div class="section-body">
          ${node.inputs.length ? `
            <div class="port-group">
              <div class="port-group-title">Inputs (${node.inputs.length})</div>
              ${node.inputs.map(p => `
                <div class="port-item">
                  <span class="port-icon ${p.portType || 'data'}"></span>
                  <span class="port-name">${p.name}</span>
                  ${p.datatype ? `<span class="port-type">${p.datatype}</span>` : ''}
                </div>
              `).join('')}
            </div>
          ` : ''}
          ${node.outputs.length ? `
            <div class="port-group">
              <div class="port-group-title">Outputs (${node.outputs.length})</div>
              ${node.outputs.map(p => `
                <div class="port-item">
                  <span class="port-icon ${p.portType || 'data'}"></span>
                  <span class="port-name">${p.name}</span>
                  ${p.datatype ? `<span class="port-type">${p.datatype}</span>` : ''}
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  _renderState(node) {
    if (!node.state) return '';

    // Only show primitive, non-private keys
    const entries = Object.entries(node.state).filter(([key, value]) => {
      if (key.startsWith('_')) return false;
      const t = typeof value;
      return t === 'string' || t === 'number' || t === 'boolean';
    });

    if (!entries.length) return '';

    const fieldHtml = ([key, value]) => {
      if (typeof value === 'boolean') {
        return `
          <div class="field">
            <label>${key}</label>
            <select data-field="state.${key}">
              <option value="true"${value ? ' selected' : ''}>true</option>
              <option value="false"${!value ? ' selected' : ''}>false</option>
            </select>
          </div>`;
      }
      return `
        <div class="field">
          <label>${key}</label>
          <input type="${typeof value === 'number' ? 'number' : 'text'}"
                 data-field="state.${key}"
                 value="${value}" />
        </div>`;
    };

    return `
      <div class="section">
        <div class="section-title">State</div>
        <div class="section-body">
          ${entries.map(fieldHtml).join('')}
        </div>
      </div>
    `;
  }

  _attachInputListeners() {
    this.panel.querySelectorAll('[data-field]').forEach(input => {
      input.addEventListener('change', () => {
        this._selfUpdating = true;
        this._handleFieldChange(input.dataset.field, input.value);
        this._selfUpdating = false;
      });
    });

    this.panel.querySelector('.panel-close-btn')?.addEventListener('click', () => {
      this.close();
    });
  }

  _handleFieldChange(field, value) {
    const node = this.currentNode;
    if (!node) return;

    switch (field) {
      case 'title':
        node.title = value;
        break;
      case 'x':
        node.pos.x = parseFloat(value);
        this.graph.updateWorldTransforms();
        break;
      case 'y':
        node.pos.y = parseFloat(value);
        this.graph.updateWorldTransforms();
        break;
      case 'width':
        node.size.width = parseFloat(value);
        break;
      case 'height':
        node.size.height = parseFloat(value);
        break;
      default:
        if (field.startsWith('state.')) {
          const key = field.substring(6);
          if (node.state && key in node.state) {
            const orig = node.state[key];
            if (typeof orig === 'boolean') {
              node.state[key] = value === 'true';
            } else if (typeof orig === 'number') {
              node.state[key] = parseFloat(value);
            } else {
              node.state[key] = value;
            }
          }
        }
    }

    this.hooks?.emit('node:updated', node);
    this.render?.();
  }

  /** Lightweight update of position fields only (no full re-render) */
  _updatePositionFields() {
    const node = this.currentNode;
    if (!node) return;
    const xEl = this.panel.querySelector('[data-field="x"]');
    const yEl = this.panel.querySelector('[data-field="y"]');
    if (xEl) xEl.value = Math.round(node.computed.x);
    if (yEl) yEl.value = Math.round(node.computed.y);
  }

  /** Lightweight in-place update of the Live Values section */
  _updateLiveValues() {
    const node = this.currentNode;
    if (!node) return;

    const cur = this.graph?._curBuf?.();
    if (!cur) return;

    // Find or create the live values section container
    let section = this.panel.querySelector('.live-values-section');
    const newHtml = this._renderLiveValues(node);

    if (!newHtml) {
      // No live values — remove section if present
      if (section) section.remove();
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.innerHTML = newHtml;
    const newSection = wrapper.firstElementChild;
    newSection.classList.add('live-values-section');

    if (section) {
      section.replaceWith(newSection);
    } else {
      // Insert before the State section, or before panel-actions
      const stateSection = this.panel.querySelectorAll('.section');
      const actions = this.panel.querySelector('.panel-actions');
      // insert as second-to-last section (before actions)
      if (actions) {
        actions.before(newSection);
      } else {
        this.panel.querySelector('.panel-content').appendChild(newSection);
      }
    }
  }

  destroy() {
    this.panel?.remove();
  }
}
