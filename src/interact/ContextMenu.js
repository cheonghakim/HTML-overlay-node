/**
 * ContextMenu - Extensible context menu for nodes and groups
 * Provides right-click functionality with customizable menu items
 */
export class ContextMenu {
  constructor({ graph, hooks, renderer, commandStack }) {
    this.graph = graph;
    this.hooks = hooks;
    this.renderer = renderer;
    this.commandStack = commandStack;

    this.items = [];
    this.visible = false;
    this.target = null;
    this.position = { x: 0, y: 0 };

    this.menuElement = this._createMenuElement();

    // Close menu on any click outside
    this._onDocumentClick = (e) => {
      if (!this.menuElement.contains(e.target)) {
        this.hide();
      }
    };
  }

  /**
   * Add a menu item
   * @param {string} id - Unique identifier for the menu item
   * @param {string} label - Display label
   * @param {Object} options - Options
   * @param {Function} options.action - Action to execute (receives target)
   * @param {Array} options.submenu - Submenu items
   * @param {Function} options.condition - Optional condition to show item (receives target)
   * @param {number} options.order - Optional sort order (default: 100)
   */
  addItem(id, label, options = {}) {
    const { action, submenu, condition, order = 100 } = options;

    // Either action or submenu must be provided
    if (!action && !submenu) {
      console.error("ContextMenu.addItem: either action or submenu is required");
      return;
    }

    // Remove existing item with same id
    this.removeItem(id);

    this.items.push({
      id,
      label,
      action,
      submenu,
      condition,
      order,
    });

    // Sort by order
    this.items.sort((a, b) => a.order - b.order);
  }

  /**
   * Remove a menu item by id
   * @param {string} id - Item id to remove
   */
  removeItem(id) {
    this.items = this.items.filter((item) => item.id !== id);
  }

  /**
   * Show the context menu
   * @param {Object} target - Target node/group
   * @param {number} x - Screen x position
   * @param {number} y - Screen y position
   * @param {Object} worldPos - Optional world position {x, y}
   */
  show(target, x, y, worldPos = null) {
    this.target = target;
    this.position = { x, y };
    this.worldPosition = worldPos; // Store world position for node creation
    this.visible = true;

    this._renderItems();

    // Position menu
    this.menuElement.style.left = `${x}px`;
    this.menuElement.style.top = `${y}px`;
    this.menuElement.style.display = "block";

    // Adjust position if menu goes off-screen
    requestAnimationFrame(() => {
      const rect = this.menuElement.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let adjustedX = x;
      let adjustedY = y;

      if (rect.right > vw) {
        adjustedX = vw - rect.width - 5;
      }
      if (rect.bottom > vh) {
        adjustedY = vh - rect.height - 5;
      }

      this.menuElement.style.left = `${adjustedX}px`;
      this.menuElement.style.top = `${adjustedY}px`;
    });

    // Listen for clicks to close menu
    document.addEventListener("click", this._onDocumentClick);
  }

  /**
   * Hide the context menu
   */
  hide() {
    this.visible = false;
    this.target = null;

    // Clean up any open submenus
    const allSubmenus = document.querySelectorAll(".context-submenu");
    allSubmenus.forEach(submenu => submenu.remove());

    this.menuElement.style.display = "none";
    document.removeEventListener("click", this._onDocumentClick);
  }

  /**
   * Cleanup
   */
  destroy() {
    this.hide();
    if (this.menuElement && this.menuElement.parentNode) {
      this.menuElement.parentNode.removeChild(this.menuElement);
    }
  }

  /**
   * Create the menu DOM element
   * @private
   */
  _createMenuElement() {
    const menu = document.createElement("div");
    menu.className = "html-overlay-node-context-menu";

    // Styling
    Object.assign(menu.style, {
      position: "fixed",
      display: "none",
      minWidth: "180px",
      backgroundColor: "#2a2a2e",
      border: "1px solid #444",
      borderRadius: "6px",
      boxShadow: "0 4px 16px rgba(0, 0, 0, 0.4)",
      zIndex: "10000",
      padding: "4px 0",
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: "13px",
      color: "#e9e9ef",
    });

    document.body.appendChild(menu);
    return menu;
  }

  /**
   * Render menu items based on current target
   * @private
   */
  _renderItems() {
    this.menuElement.innerHTML = "";

    const visibleItems = this.items.filter((item) => {
      if (item.condition) {
        return item.condition(this.target);
      }
      return true;
    });

    if (visibleItems.length === 0) {
      this.hide();
      return;
    }

    visibleItems.forEach((item) => {
      const itemEl = document.createElement("div");
      itemEl.className = "context-menu-item";

      // Create item content wrapper
      const contentWrapper = document.createElement("div");
      Object.assign(contentWrapper.style, {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
      });

      const labelEl = document.createElement("span");
      labelEl.textContent = item.label;
      contentWrapper.appendChild(labelEl);

      // Add arrow indicator if item has submenu
      if (item.submenu) {
        const arrow = document.createElement("span");
        arrow.textContent = "▶";
        arrow.style.marginLeft = "12px";
        arrow.style.fontSize = "10px";
        arrow.style.opacity = "0.7";
        contentWrapper.appendChild(arrow);
      }

      itemEl.appendChild(contentWrapper);

      Object.assign(itemEl.style, {
        padding: "4px 8px",
        cursor: "pointer",
        transition: "background-color 0.15s ease",
        userSelect: "none",
        position: "relative",
      });

      // Hover effect
      itemEl.addEventListener("mouseenter", () => {
        itemEl.style.backgroundColor = "#3a3a3e";

        // Clear any pending hide timeout
        if (itemEl._hideTimeout) {
          clearTimeout(itemEl._hideTimeout);
          itemEl._hideTimeout = null;
        }

        // Show submenu if exists
        if (item.submenu) {
          // Support function-based submenus for dynamic content
          const submenuItems = typeof item.submenu === 'function'
            ? item.submenu()
            : item.submenu;
          this._showSubmenu(submenuItems, itemEl);
        }
      });

      itemEl.addEventListener("mouseleave", (e) => {
        itemEl.style.backgroundColor = "transparent";

        // Hide submenu with delay if moving to submenu
        if (item.submenu) {
          const submenuEl = itemEl._submenuElement;
          if (submenuEl) {
            // Add delay before hiding to allow mouse to reach submenu
            itemEl._hideTimeout = setTimeout(() => {
              if (!submenuEl.contains(document.elementFromPoint(e.clientX, e.clientY))) {
                this._hideSubmenu(itemEl);
              }
            }, 150); // 150ms delay
          }
        }
      });

      // Click handler
      if (!item.submenu) {
        itemEl.addEventListener("click", (e) => {
          e.stopPropagation();
          item.action(this.target);
          this.hide();
        });
      }

      this.menuElement.appendChild(itemEl);
    });
  }

  /**
   * Show submenu for an item
   * @private
   */
  _showSubmenu(submenuItems, parentItemEl) {
    // Remove any existing submenu
    this._hideSubmenu(parentItemEl);

    const submenuEl = document.createElement("div");
    submenuEl.className = "context-submenu";

    Object.assign(submenuEl.style, {
      position: "fixed",
      minWidth: "140px",
      backgroundColor: "#2a2a2e",
      border: "1px solid #444",
      borderRadius: "6px",
      boxShadow: "0 4px 16px rgba(0, 0, 0, 0.4)",
      zIndex: "10001",
      padding: "4px 0",
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: "13px",
      color: "#e9e9ef",
    });

    submenuItems.forEach((subItem) => {
      const subItemEl = document.createElement("div");
      subItemEl.className = "context-submenu-item";

      // Create content with color swatch if available
      const contentWrapper = document.createElement("div");
      Object.assign(contentWrapper.style, {
        display: "flex",
        alignItems: "center",
        gap: "8px",
      });

      // Color swatch
      if (subItem.color) {
        const swatch = document.createElement("div");
        Object.assign(swatch.style, {
          width: "16px",
          height: "16px",
          borderRadius: "3px",
          backgroundColor: subItem.color,
          border: "1px solid #555",
          flexShrink: "0",
        });
        contentWrapper.appendChild(swatch);
      }

      const labelEl = document.createElement("span");
      labelEl.textContent = subItem.label;
      contentWrapper.appendChild(labelEl);

      subItemEl.appendChild(contentWrapper);

      Object.assign(subItemEl.style, {
        padding: "4px 8px",
        cursor: "pointer",
        transition: "background-color 0.15s ease",
        userSelect: "none",
      });

      subItemEl.addEventListener("mouseenter", () => {
        subItemEl.style.backgroundColor = "#3a3a3e";
      });

      subItemEl.addEventListener("mouseleave", () => {
        subItemEl.style.backgroundColor = "transparent";
      });

      subItemEl.addEventListener("click", (e) => {
        e.stopPropagation();
        subItem.action(this.target);
        this.hide();
      });

      submenuEl.appendChild(subItemEl);
    });

    // Keep submenu open when hovering over it
    submenuEl.addEventListener("mouseenter", () => {
      // Clear parent's hide timeout
      if (parentItemEl._hideTimeout) {
        clearTimeout(parentItemEl._hideTimeout);
        parentItemEl._hideTimeout = null;
      }
    });

    submenuEl.addEventListener("mouseleave", (e) => {
      if (!parentItemEl.contains(e.relatedTarget)) {
        this._hideSubmenu(parentItemEl);
      }
    });

    document.body.appendChild(submenuEl);
    parentItemEl._submenuElement = submenuEl;

    // Position submenu next to parent item
    requestAnimationFrame(() => {
      const parentRect = parentItemEl.getBoundingClientRect();
      const submenuRect = submenuEl.getBoundingClientRect();

      let left = parentRect.right + 2;
      let top = parentRect.top;

      // Adjust if submenu goes off-screen
      if (left + submenuRect.width > window.innerWidth) {
        left = parentRect.left - submenuRect.width - 2;
      }

      if (top + submenuRect.height > window.innerHeight) {
        top = window.innerHeight - submenuRect.height - 5;
      }

      submenuEl.style.left = `${left}px`;
      submenuEl.style.top = `${top}px`;
    });
  }

  /**
   * Hide submenu for an item
   * @private
   */
  _hideSubmenu(parentItemEl) {
    if (parentItemEl._submenuElement) {
      parentItemEl._submenuElement.remove();
      parentItemEl._submenuElement = null;
    }
  }
}
