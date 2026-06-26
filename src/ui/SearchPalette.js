/**
 * SearchPalette - Searchable node type selector overlay
 */
export class SearchPalette {
  constructor(container, { registry, onSelect }) {
    this.container = container;
    this.registry = registry;
    this.onSelect = onSelect;
    this.visible = false;
    this.hlIdx = -1;
    this.worldX = 0;
    this.worldY = 0;

    this.el = null;
    this.input = null;
    this.resultsContainer = null;
    this.matches = [];

    this._clickOutsideHandler = null;

    this._createElements();
    this._bindEvents();
  }

  _createElements() {
    this.el = document.createElement("div");
    this.el.className = "node-palette-overlay";
    this.el.style.display = "none";
    this.el.style.position = "absolute";
    this.el.style.zIndex = "10000";

    this.el.innerHTML = `
      <div class="node-palette-panel">
        <div class="node-palette-header">
          <svg class="node-palette-icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" stroke-width="1.5"/>
            <path d="M10 10L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <input class="node-palette-input" type="text" placeholder="Search node type..." autocomplete="off" spellcheck="false" />
        </div>
        <div class="node-palette-results"></div>
        <div class="node-palette-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> spawn</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    `;

    this.container.appendChild(this.el);
    this.input = this.el.querySelector(".node-palette-input");
    this.resultsContainer = this.el.querySelector(".node-palette-results");
  }

  _bindEvents() {
    this.input.addEventListener("input", (e) => {
      this.filter(e.target.value);
    });

    this.input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        this.hlIdx = Math.min(this.hlIdx + 1, this.matches.length - 1);
        this._updateHighlight();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        this.hlIdx = Math.max(this.hlIdx - 1, 0);
        this._updateHighlight();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (this.hlIdx >= 0 && this.hlIdx < this.matches.length) {
          this._select(this.matches[this.hlIdx]);
        } else if (this.matches.length > 0) {
          this._select(this.matches[0]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.hide();
      }
    });

    // Close when clicking outside of the panel
    this._clickOutsideHandler = (e) => {
      if (!this.visible) return;
      if (!this.el.contains(e.target)) {
        this.hide();
      }
    };
    window.addEventListener("mousedown", this._clickOutsideHandler);
  }

  isOpen() {
    return this.visible;
  }

  show(clientX, clientY, worldPos) {
    this.visible = true;
    this.worldX = worldPos.x;
    this.worldY = worldPos.y;

    // Position relative to container
    const rect = this.container.getBoundingClientRect();
    let left = clientX - rect.left;
    let top = clientY - rect.top;

    // Collision detection: palette panel is styled to 280px width
    const w = 280;
    const h = 320;
    if (left + w > rect.width) {
      left = rect.width - w - 10;
    }
    if (left < 10) left = 10;

    if (top + h > rect.height) {
      top = rect.height - h - 10;
    }
    if (top < 10) top = 10;

    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
    this.el.style.display = "block";

    this.input.value = "";
    this.filter("");
    
    // Defer focus slightly to ensure the element is visible
    setTimeout(() => {
      if (this.visible && this.input) {
        this.input.focus();
      }
    }, 10);
  }

  hide() {
    if (!this.visible) return;
    this.visible = false;
    this.el.style.display = "none";
  }

  filter(query) {
    const q = query.toLowerCase().trim();
    const allTypes = Array.from(this.registry.types.entries()); // Array of [typeKey, def]

    const filtered = allTypes
      .filter(([type]) => type !== "core/Group")
      .map(([type, def]) => ({
        type,
        title: def.title || type.split("/").pop(),
        color: def.color || "#555555"
      }))
      .filter(item => {
        return item.title.toLowerCase().includes(q) || item.type.toLowerCase().includes(q);
      });

    // Sort by category first, then by title
    this.matches = filtered.sort((a, b) => {
      const catA = a.type.split("/")[0];
      const catB = b.type.split("/")[0];
      if (catA !== catB) return catA.localeCompare(catB);
      return a.title.localeCompare(b.title);
    });

    this.hlIdx = this.matches.length > 0 ? 0 : -1;
    this._renderResults();
  }

  _renderResults() {
    this.resultsContainer.innerHTML = "";

    if (this.matches.length === 0) {
      this.resultsContainer.innerHTML = `<div class="node-palette-empty">No node types found</div>`;
      return;
    }

    this.matches.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "node-palette-item";
      if (index === this.hlIdx) {
        row.classList.add("highlighted");
      }

      const category = item.type.includes("/") ? item.type.split("/")[0] : "other";

      row.innerHTML = `
        <span class="node-palette-dot" style="background: ${item.color}"></span>
        <span class="node-palette-title">${item.title}</span>
        <span class="node-palette-type">${category}</span>
      `;

      row.addEventListener("click", () => {
        this._select(item);
      });

      this.resultsContainer.appendChild(row);
    });
  }

  _updateHighlight() {
    const items = this.resultsContainer.querySelectorAll(".node-palette-item");
    items.forEach((item, index) => {
      item.classList.toggle("highlighted", index === this.hlIdx);
    });

    if (this.hlIdx >= 0) {
      const activeItem = items[this.hlIdx];
      if (activeItem) {
        activeItem.scrollIntoView({ block: "nearest" });
      }
    }
  }

  _select(item) {
    if (this.onSelect) {
      this.onSelect(item.type, this.worldX, this.worldY);
    }
    this.hide();
  }

  destroy() {
    if (this._clickOutsideHandler) {
      window.removeEventListener("mousedown", this._clickOutsideHandler);
    }
    if (this.el && this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
  }
}
