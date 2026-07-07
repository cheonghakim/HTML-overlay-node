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
    allSubmenus.forEach((submenu) => submenu.remove());

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

    Object.assign(menu.style, {
      position: "fixed",
      display: "none",
      minWidth: "168px",
      backgroundColor: "rgba(16, 16, 26, 0.97)",
      backdropFilter: "blur(20px) saturate(180%)",
      border: "1px solid rgba(255,255,255,0.09)",
      borderRadius: "4px",
      boxShadow:
        "0 8px 32px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.5), 0 0 0 0.5px rgba(255,255,255,0.04) inset",
      zIndex: "10000",
      padding: "5px",
      fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
      fontSize: "12px",
      color: "#d8d8ee",
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
        padding: "6px 10px",
        cursor: "pointer",
        transition: "background-color 0.1s ease",
        userSelect: "none",
        position: "relative",
        borderRadius: "5px",
        display: "flex",
        alignItems: "center",
      });

      // Hover effect
      itemEl.addEventListener("mouseenter", () => {
        itemEl.style.backgroundColor = "rgba(255,255,255,0.07)";

        // Clear any pending hide timeout
        if (itemEl._hideTimeout) {
          clearTimeout(itemEl._hideTimeout);
          itemEl._hideTimeout = null;
        }

        // Show submenu if exists
        if (item.submenu) {
          // Support function-based submenus for dynamic content
          const submenuItems = typeof item.submenu === "function" ? item.submenu(this.target) : item.submenu;
          this._showSubmenu(submenuItems, itemEl);
        }
      });

      itemEl.addEventListener("mouseleave", () => {
        itemEl.style.backgroundColor = "rgba(0,0,0,0)";

        // Hide submenu with delay if moving to submenu
        if (item.submenu) {
          const submenuEl = itemEl._submenuElement;
          if (submenuEl) {
            // Add delay before hiding to allow mouse to reach submenu
            itemEl._hideTimeout = setTimeout(() => {
              if (!itemEl.matches(":hover") && !this._isSubmenuTreeHovered(submenuEl)) {
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

    // Nothing to show — don't render an empty box
    if (!submenuItems || submenuItems.length === 0) return;

    const submenuEl = document.createElement("div");
    submenuEl.className = "context-submenu";

    Object.assign(submenuEl.style, {
      position: "fixed",
      minWidth: "148px",
      backgroundColor: "rgba(16, 16, 26, 0.97)",
      backdropFilter: "blur(20px) saturate(180%)",
      border: "1px solid rgba(255,255,255,0.09)",
      borderRadius: "4px",
      boxShadow:
        "0 8px 32px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.5), 0 0 0 0.5px rgba(255,255,255,0.04) inset",
      zIndex: "10001",
      padding: "5px",
      fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
      fontSize: "12px",
      color: "#d8d8ee",
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
        padding: "6px 10px",
        cursor: "pointer",
        transition: "background-color 0.1s ease",
        userSelect: "none",
        borderRadius: "5px",
        display: "flex",
        alignItems: "center",
      });

      if (subItem.submenu) {
        const arrow = document.createElement("span");
        arrow.textContent = "▶";
        arrow.style.marginLeft = "12px";
        arrow.style.fontSize = "10px";
        arrow.style.opacity = "0.7";
        contentWrapper.appendChild(arrow);

        subItemEl.addEventListener("mouseenter", () => {
          subItemEl.style.backgroundColor = "rgba(255,255,255,0.07)";
          if (subItemEl._hideTimeout) {
            clearTimeout(subItemEl._hideTimeout);
            subItemEl._hideTimeout = null;
          }
          const subItems = typeof subItem.submenu === "function" ? subItem.submenu(this.target) : subItem.submenu;
          this._showSubmenu(subItems, subItemEl);
        });

        subItemEl.addEventListener("mouseleave", () => {
          subItemEl.style.backgroundColor = "rgba(0,0,0,0)";
          const subSubMenu = subItemEl._submenuElement;
          if (subSubMenu) {
            subItemEl._hideTimeout = setTimeout(() => {
              if (!subItemEl.matches(":hover") && !this._isSubmenuTreeHovered(subSubMenu)) {
                this._hideSubmenu(subItemEl);
              }
            }, 150);
          }
        });
      } else {
        subItemEl.addEventListener("mouseenter", () => {
          subItemEl.style.backgroundColor = "rgba(255,255,255,0.07)";
        });

        subItemEl.addEventListener("mouseleave", () => {
          subItemEl.style.backgroundColor = "rgba(0,0,0,0)";
        });

        subItemEl.addEventListener("click", (e) => {
          e.stopPropagation();
          subItem.action(this.target);
          this.hide();
        });
      }

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
      const related = e.relatedTarget;
      // Stay open when moving back to the parent item or into a nested submenu
      if (related instanceof Element) {
        if (parentItemEl.contains(related)) return;
        if (this._isInSubmenuTree(related, submenuEl)) return;
      }
      this._hideSubmenu(parentItemEl);
    });

    document.body.appendChild(submenuEl);
    parentItemEl._submenuElement = submenuEl;
    submenuEl._parentItem = parentItemEl;

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
   * Hide submenu for an item, including any nested submenus
   * @private
   */
  _hideSubmenu(parentItemEl) {
    const submenuEl = parentItemEl._submenuElement;
    if (!submenuEl) return;

    // Recursively close nested submenus first
    for (const itemEl of submenuEl.children) {
      if (itemEl._submenuElement) {
        this._hideSubmenu(itemEl);
      }
      if (itemEl._hideTimeout) {
        clearTimeout(itemEl._hideTimeout);
        itemEl._hideTimeout = null;
      }
    }

    submenuEl.remove();
    parentItemEl._submenuElement = null;
  }

  /**
   * Check whether a submenu or any of its nested submenus is hovered
   * @private
   */
  _isSubmenuTreeHovered(submenuEl) {
    if (submenuEl.matches(":hover")) return true;
    for (const itemEl of submenuEl.children) {
      if (itemEl._submenuElement && this._isSubmenuTreeHovered(itemEl._submenuElement)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check whether an element lives inside the given submenu or one of its descendants
   * @private
   */
  _isInSubmenuTree(el, rootSubmenuEl) {
    let menu = el.closest(".context-submenu");
    while (menu) {
      if (menu === rootSubmenuEl) return true;
      menu = menu._parentItem ? menu._parentItem.closest(".context-submenu") : null;
    }
    return false;
  }
}
