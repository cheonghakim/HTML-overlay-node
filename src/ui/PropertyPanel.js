/**
 * PropertyPanel - Node property editor panel
 */
export class PropertyPanel {
  constructor(container, { graph, hooks, registry, render }) {
    this.container = container;
    this.graph = graph;
    this.hooks = hooks;
    this.registry = registry;
    this.render = render; // Store render callback

    this.panel = null;
    this.currentNode = null;
    this.isVisible = false;

    this._createPanel();
  }

  _createPanel() {
    // Create panel element
    this.panel = document.createElement('div');
    this.panel.className = 'property-panel';
    this.panel.style.display = 'none';

    // Panel HTML structure
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

    // Event listeners
    this.panel.querySelector('.panel-close').addEventListener('click', () => {
      this.close();
    });

    // Close on ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.close();
      }
    });
  }

  open(node) {
    if (!node) return;

    this.currentNode = node;
    this.isVisible = true;

    // Update content
    this._renderContent();

    // Show panel
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
        <div class="section-title">Position & Size</div>
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
      
      ${this._renderPorts(node)}
      ${this._renderState(node)}
      
      <div class="panel-actions">
        <button class="btn-secondary panel-close-btn">Close</button>
      </div>
    `;

    // Add event listeners for inputs
    this._attachInputListeners();
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
    if (!node.state || Object.keys(node.state).length === 0) return '';

    return `
      <div class="section">
        <div class="section-title">State</div>
        <div class="section-body">
          ${Object.entries(node.state).map(([key, value]) => `
            <div class="field">
              <label>${key}</label>
              <input 
                type="${typeof value === 'number' ? 'number' : 'text'}" 
                data-field="state.${key}" 
                value="${value}" 
              />
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  _attachInputListeners() {
    const inputs = this.panel.querySelectorAll('[data-field]');

    inputs.forEach(input => {
      input.addEventListener('change', () => {
        this._handleFieldChange(input.dataset.field, input.value);
      });
    });

    // Close button
    this.panel.querySelector('.panel-close-btn').addEventListener('click', () => {
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
        // Handle state fields
        if (field.startsWith('state.')) {
          const key = field.substring(6);
          if (node.state) {
            const originalValue = node.state[key];
            node.state[key] = typeof originalValue === 'number' ? parseFloat(value) : value;
          }
        }
    }

    // Emit update event
    this.hooks?.emit('node:updated', node);

    // Trigger render to update canvas immediately
    if (this.render) {
      this.render();
    }
  }

  destroy() {
    if (this.panel) {
      this.panel.remove();
    }
  }
}
