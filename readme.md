# HTML-overlay-Node

[![npm version](https://img.shields.io/npm/v/html-overlay-node.svg)](https://www.npmjs.com/package/html-overlay-node)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**HTML-overlay-Node** is a customizable, LiteGraph-style node editor library for building visual programming interfaces. It uses **Canvas rendering** for fast performance and supports node type registration, execution cycle control, custom drawing, HTML overlays, and group management.

---

## ✨ Features

- 🎨 **Production-quality design** - Professional dark theme with refined aesthetics
- 🔧 **Type registration system** - Easily create custom node types
- 🔌 **Dual port system** - Exec ports (flow control) and data ports (values)
- ⚡ **Flexible execution** - Automatic or manual execution modes with trigger nodes
- 🔗 **Multiple edge styles** - Curved, orthogonal, or straight connections
- 💾 **Serialization** - Save and load graphs with `toJSON`/`fromJSON`
- 🖱️ **Rich interactions** - Zoom, pan, drag, box select, and snap-to-grid
- ⌨️ **Keyboard shortcuts** - Undo/redo, align, group, and more
- 🎯 **Custom drawing** - Per-node custom rendering with `onDraw`
- 🌐 **HTML overlays** - Embed interactive HTML UIs with proper port layering
- 📦 **Group nodes** - Organize nodes in hierarchical groups
- 🪝 **Event hooks** - Subscribe to graph events for extensibility
- 🎥 **Visual feedback** - Smooth animations and hover states

---

## Demo

- 🏠 [Demo](https://cheonghakim.github.io/HTML-overlay-node/)

## 🚀 Quick Start

```javascript
import { createGraphEditor } from "html-overlay-node";

// One-liner Initialization!
// Pass a selector or HTMLElement. Canvas and overlays are created automatically.
const editor = createGraphEditor("#editor-container", {
  autorun: true,
  enablePropertyPanel: true, // Integrated property panel (default: true)
});

const { graph, registry, addGroup, start } = editor;
```

### 💅 Styles (Required)

Make sure to import the necessary CSS files for the editor and Property Panel to look correctly:

```javascript
import "html-overlay-node/index.css";
import "html-overlay-node/src/ui/PropertyPanel.css";
```

// Register and add nodes
registry.register("math/Add", {
title: "Add",
size: { w: 180, h: 80 },
inputs: [
{ name: "a", datatype: "number" },
{ name: "b", datatype: "number" },
],
outputs: [{ name: "result", datatype: "number" }],
onCreate(node) {
node.state.a = 0;
node.state.b = 0;
},
onExecute(node, { getInput, setOutput }) {
const a = getInput("a") ?? node.state.a;
const b = getInput("b") ?? node.state.b;
setOutput("result", a + b);
},
});

// Add nodes
const node1 = graph.addNode("math/Add", { x: 100, y: 100 });
const node2 = graph.addNode("math/Add", { x: 100, y: 200 });

// Create a group
addGroup({
title: "Math Operations",
x: 50,
y: 50,
width: 300,
height: 300,
color: "#4a5568",
members: [node1.id, node2.id],
});

start();

````

---

## 📦 Group Management

HTML-overlay-Node supports organizing nodes into hierarchical groups for better organization.

### Creating Groups

```javascript
const { addGroup } = editor;

// Create a group
const group = addGroup({
  title: "My Group", // Group name
  x: 0, // X position
  y: 0, // Y position
  width: 400, // Width (min: 100)
  height: 300, // Height (min: 60)
  color: "#2d3748", // Background color
  members: [node1.id, node2.id], // Nodes to include
});
````

### Group Features

- **Hierarchical Structure**: Groups can contain multiple nodes
- **Automatic Movement**: Nodes inside the group move with the group
- **Resizable**: Resize groups using the handle in the bottom-right corner
- **Custom Colors**: Set group colors for visual organization
- **Local Coordinates**: World and local coordinates automatically managed

### Advanced Group Operations

```javascript
// Access GroupManager
const groupManager = graph.groupManager;

// Reparent a node to a group
graph.reparent(node, group);

// Remove node from group (reparent to root)
graph.reparent(node, null);

// Resize a group
groupManager.resizeGroup(group.id, 50, 50); // add 50px to width and height

// Remove a group (children are un-grouped)
groupManager.removeGroup(group.id);

// Listen to group events
hooks.on("group:change", () => {
  console.log("Group structure changed");
});
```

---

## 🌐 HTML Overlays

Create interactive HTML UIs inside nodes.

### Basic Example

```javascript
registry.register("ui/TextInput", {
  title: "Text Input",
  size: { w: 220, h: 100 },
  outputs: [{ name: "text", datatype: "string" }],

  html: {
    init(node, el, { header, body }) {
      el.style.backgroundColor = "#1a1a1a";
      el.style.borderRadius = "8px";

      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = "Enter text...";
      Object.assign(input.style, {
        width: "100%",
        padding: "8px",
        background: "#111",
        border: "1px solid #444",
        color: "#fff",
        pointerEvents: "auto", // IMPORTANT: Enable interaction
      });

      input.addEventListener("input", (e) => {
        node.state.text = e.target.value;
        hooks.emit("node:updated", node);
      });

      input.addEventListener("mousedown", (e) => e.stopPropagation()); // Prevent drag

      body.appendChild(input);
      el._input = input;
    },

    update(node, el, { selected }) {
      el.style.borderColor = selected ? "#3b82f6" : "#333";
      if (el._input.value !== (node.state.text || "")) {
        el._input.value = node.state.text || "";
      }
    },
  },

  onCreate(node) {
    node.state.text = "";
  },

  onExecute(node, { setOutput }) {
    setOutput("text", node.state.text || "");
  },
});
```

### Best Practices

1. **Enable Interaction**: Set `pointerEvents: "auto"` on interactive elements
2. **Stop Propagation**: Prevent canvas drag with `e.stopPropagation()` on `mousedown`
3. **Update State**: Emit `"node:updated"` when state changes
4. **Store References**: Cache DOM elements in `el._refs` for performance
5. **Port Visibility**: HTML overlays are rendered below ports for proper visibility

---

## 🔌 Port Types

HTML-overlay-Node supports two types of ports for different purposes:

### Exec Ports (Flow Control)

Exec ports control the execution flow between nodes.

```javascript
registry.register("util/Print", {
  title: "Print",
  inputs: [
    { name: "exec", portType: "exec" }, // Execution input
    { name: "value", portType: "data", datatype: "any" },
  ],
  outputs: [
    { name: "exec", portType: "exec" }, // Execution output
  ],
  onExecute(node, { getInput }) {
    console.log("[Print]", getInput("value"));
  },
});
```

### Data Ports (Values)

Data ports transfer values between nodes.

```javascript
registry.register("math/Add", {
  title: "Add",
  inputs: [
    { name: "exec", portType: "exec" },
    { name: "a", portType: "data", datatype: "number" },
    { name: "b", portType: "data", datatype: "number" },
  ],
  outputs: [
    { name: "exec", portType: "exec" },
    { name: "result", portType: "data", datatype: "number" },
  ],
  onExecute(node, { getInput, setOutput }) {
    const result = (getInput("a") ?? 0) + (getInput("b") ?? 0);
    setOutput("result", result);
  },
});
```

### Visual Style

- **Exec ports**: Emerald green rounded squares (8×8px)
- **Data ports**: Indigo blue circles (10px diameter)
- Both have subtle outlines for depth

---

## ⌨️ Keyboard Shortcuts

| Shortcut                        | Action                      |
| ------------------------------- | --------------------------- |
| **Selection**                   |                             |
| `Click`                         | Select node                 |
| `Shift + Click`                 | Add to selection            |
| `Ctrl + Drag`                   | Box select                  |
| **Editing**                     |                             |
| `Delete`                        | Delete selected nodes       |
| `Ctrl + Z`                      | Undo                        |
| `Ctrl + Y` / `Ctrl + Shift + Z` | Redo                        |
| **Grouping**                    |                             |
| `Ctrl + G`                      | Create group from selection |
| **Alignment**                   |                             |
| `A`                             | Align nodes horizontally    |
| `Shift + A`                     | Align nodes vertically      |
| **Tools**                       |                             |
| `G`                             | Toggle snap-to-grid         |
| `?`                             | Toggle shortcuts help       |
| **Navigation**                  |                             |
| `Middle Click + Drag`           | Pan canvas                  |
| `Mouse Wheel`                   | Zoom in/out                 |
| `Right Click`                   | Context menu                |

---

## 📚 Complete API

For full API documentation, see the comments in [src/index.js](src/index.js).

### Editor API

| Property            | Description           |
| ------------------- | --------------------- |
| `graph`             | Graph instance        |
| `registry`          | Node type registry    |
| `hooks`             | Event system          |
| `render()`          | Trigger manual render |
| `start()`           | Start execution loop  |
| `stop()`            | Stop execution loop   |
| `addGroup(options)` | Create a group        |
| `destroy()`         | Cleanup               |

### Key Methods

- `registry.register(type, definition)` - Register node type
- `graph.addNode(type, options)` - Create node
- `graph.addEdge(from, fromPort, to, toPort)` - Connect nodes
- `graph.toJSON()` / `graph.fromJSON(json)` - Serialize/deserialize
- `hooks.on(event, callback)` - Subscribe to events

### Available Events

- `node:create` | `node:move` | `node:resize` | `node:updated`
- `edge:create` | `edge:delete`
- `group:change`
- `runner:start` | `runner:stop` | `runner:tick`
- `error`

---

## 🎨 Customization

### Theme Colors

```javascript
const editor = createGraphEditor(canvas, {
  theme: {
    bg: "#0d0d0f", // Canvas background
    grid: "#1a1a1d", // Grid lines
    node: "#16161a", // Node background
    nodeBorder: "#2a2a2f", // Node border
    title: "#1f1f24", // Node header
    text: "#e4e4e7", // Primary text
    textMuted: "#a1a1aa", // Secondary text
    port: "#6366f1", // Data port color (indigo)
    portExec: "#10b981", // Exec port color (emerald)
    edge: "#52525b", // Edge color
    edgeActive: "#8b5cf6", // Active edge (purple)
    accent: "#6366f1", // Accent color
    accentBright: "#818cf8", // Bright accent
  },
});
```

### Edge Styles

```javascript
// Set edge style
editor.renderer.setEdgeStyle("orthogonal"); // or "curved", "line"
```

### Custom Node Drawing

```javascript
registry.register("visual/Circle", {
  title: "Circle",
  size: { w: 120, h: 120 },
  onDraw(node, { ctx, theme }) {
    const { x, y, width, height } = node.computed;
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const radius = Math.min(width, height) / 3;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = theme.wire;
    ctx.fill();
  },
});
```

---

## 💾 Serialization

```javascript
// Save
const json = graph.toJSON();
localStorage.setItem("myGraph", JSON.stringify(json));

// Load
const saved = JSON.parse(localStorage.getItem("myGraph"));
graph.fromJSON(saved);
```

---

## 🐛 Troubleshooting

| Issue                        | Solution                                            |
| ---------------------------- | --------------------------------------------------- |
| Canvas not rendering         | Ensure canvas has explicit width/height             |
| Nodes not executing          | Call `start()` or set `autorun: true`               |
| Type errors                  | Register node types before using them               |
| HTML overlay not interactive | Set `pointerEvents: "auto"` on elements             |
| Performance issues           | Limit to <1000 nodes, optimize `onExecute`/`onDraw` |

---

## 🤝 Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md).

```bash
npm install   # Install dependencies
npm run dev   # Start dev server
npm test      # Run tests
npm run lint  # Check code quality
npm run build # Build library
```

---

## 📄 License

[MIT](LICENSE) © cheonghakim

---

## 🔗 Links

- [GitHub Repository](https://github.com/cheonghakim/html-overlay-node)
- [Issue Tracker](https://github.com/cheonghakim/html-overlay-node/issues)
- [Changelog](CHANGELOG.md)
