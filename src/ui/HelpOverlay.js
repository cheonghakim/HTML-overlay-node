/**
 * HelpOverlay - Modular help keyboard shortcuts overlay
 */
export class HelpOverlay {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      shortcuts: options.shortcuts || this._getDefaultShortcuts(),
      onToggle: options.onToggle || null,
    };

    this.isVisible = false;
    this.overlay = null;
    this.toggleBtn = null;

    this._createElements();
    this._bindEvents();
  }

  _getDefaultShortcuts() {
    return [
      {
        group: "Selection",
        items: [
          { label: "Select node", key: "Click" },
          { label: "Multi-select", key: "Shift+Click" },
          { label: "Box select", key: "Ctrl+Drag" },
        ],
      },
      {
        group: "Edit",
        items: [
          { label: "Delete", key: "Del" },
          { label: "Undo", key: "Ctrl+Z" },
          { label: "Redo", key: "Ctrl+Y" },
        ],
      },
      {
        group: "Group & Align",
        items: [
          { label: "Create group", key: "Ctrl+G" },
          { label: "Align horizontal", key: "A" },
          { label: "Align vertical", key: "Shift+A" },
        ],
      },
      {
        group: "View",
        items: [
          { label: "Toggle snap", key: "G" },
          { label: "Pan", key: "Mid+Drag" },
          { label: "Zoom", key: "Scroll" },
          { label: "Context menu", key: "RClick" },
        ],
      },
    ];
  }

  _createElements() {
    // Create Toggle Button
    this.toggleBtn = document.createElement("div");
    this.toggleBtn.id = "helpToggle";
    this.toggleBtn.title = "단축키 (?)";
    this.toggleBtn.textContent = "?";
    this.container.appendChild(this.toggleBtn);

    // Create Overlay
    this.overlay = document.createElement("div");
    this.overlay.id = "helpOverlay";

    const sectionsHtml = this.options.shortcuts
      .map(
        (group) => `
      <h4>${group.group}</h4>
      ${group.items
        .map(
          (item) => `
        <div class="shortcut-item">
          <span>${item.label}</span>
          <span class="shortcut-key">${item.key}</span>
        </div>
      `
        )
        .join("")}
    `
      )
      .join("");

    this.overlay.innerHTML = `
      <h3>
        <span>Keyboard Shortcuts</span>
        <button class="close-btn" id="helpClose" title="Close">×</button>
      </h3>
      ${sectionsHtml}
    `;

    this.container.appendChild(this.overlay);
  }

  _bindEvents() {
    this.toggleBtn.addEventListener("click", () => this.toggle());

    const closeBtn = this.overlay.querySelector("#helpClose");
    if (closeBtn) {
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.close();
      });
    }

    // Close when clicking outside
    document.addEventListener("mousedown", (e) => {
      if (this.isVisible) {
        if (!this.overlay.contains(e.target) && !this.toggleBtn.contains(e.target)) {
          this.close();
        }
      }
    });

    // Keyboard shortcuts
    window.addEventListener("keydown", (e) => {
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        // Only toggle if not typing in an input
        if (!["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
          e.preventDefault();
          this.toggle();
        }
      }

      if (e.key === "Escape" && this.isVisible) {
        this.close();
      }
    });
  }

  toggle() {
    if (this.isVisible) this.close();
    else this.open();
  }

  open() {
    this.isVisible = true;
    this.overlay.classList.add("visible");
    this.toggleBtn.classList.add("active");
    if (this.options.onToggle) this.options.onToggle(true);
  }

  close() {
    this.isVisible = false;
    this.overlay.classList.remove("visible");
    this.toggleBtn.classList.remove("active");
    if (this.options.onToggle) this.options.onToggle(false);
  }

  destroy() {
    this.toggleBtn?.remove();
    this.overlay?.remove();
  }
}
