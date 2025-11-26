# Free Node

[![CI](https://github.com/cheonghakim/free-node/workflows/CI/badge.svg)](https://github.com/cheonghakim/free-node/actions)
[![npm version](https://img.shields.io/npm/v/free-node.svg)](https://www.npmjs.com/package/free-node)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

**Free Node** is a customizable, LiteGraph-style node editor library for building visual programming interfaces. It uses **Canvas rendering** for fast performance and supports node type registration, execution cycle control, custom drawing, HTML overlays, and group management.

---

## ✨ Features

- 🎨 **Canvas-based rendering** - Fast and smooth performance
- 🔧 **Type registration system** - Easily create custom node types
- ⚡ **Flexible execution** - Automatic or manual execution modes  
- 🔗 **Data flow** - Connect nodes with edges for data propagation
- 💾 **Serialization** - Save and load graphs with `toJSON`/`fromJSON`
- 🖱️ **Mouse interaction** - Zoom, pan, drag nodes, and connect ports
- 🎯 **Custom drawing** - Per-node custom rendering with `onDraw`
- 🌐 **HTML overlays** - Embed interactive HTML UIs in nodes
- 📦 **Group nodes** - Organize nodes in hierarchical groups
- 🪝 **Event hooks** - Subscribe to graph events for extensibility

---

## 📦 Installation

```bash
npm install free-node
```

Or using a CDN:

```html
<script type="module">
  import { createGraphEditor } from "https://unpkg.com/free-node/dist/free-node.es.js";
</script>
```

---

## 🚀 Quick Start

```javascript
import { createGraphEditor } from "free-node";

const canvas = document.getElementById("myCanvas");
const editor = createGraphEditor(canvas, { autorun: true });
const { graph, registry, addGroup, start } = editor;

// Register and add nodes
registry.register("math/Add", {
  title: "Add",
  size: { w: 180, h: 80 },
  inputs: [
    { name: "a", datatype: "number" },
    { name: "b", datatype: "number" }
  ],
  outputs: [{ name: "result", datatype: "number" }],
  onCreate(node) { node.state.a = 0; node.state.b = 0; },
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
  members: [node1.id, node2.id]
});

start();
```

---

## 📦 Group Management

Free Node supports organizing nodes into hierarchical groups for better organization.

### Creating Groups

```javascript
const { addGroup } = editor;

// Create a group
const group = addGroup({
  title: "My Group",       // Group name
  x: 0,                    // X position
  y: 0,                    // Y position
  width: 400,              // Width (min: 100)
  height: 300,             // Height (min: 60)
  color: "#2d3748",        // Background color
  members: [node1.id, node2.id]  // Nodes to include
});
```

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
        pointerEvents: "auto"  // IMPORTANT: Enable interaction
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
    }
  },
  
  onCreate(node) {
    node.state.text = "";
  },
  
  onExecute(node, { setOutput }) {
    setOutput("text", node.state.text || "");
  }
});
```

### Best Practices

1. **Enable Interaction**: Set `pointerEvents: "auto"` on interactive elements
2. **Stop Propagation**: Prevent canvas drag with `e.stopPropagation()` on `mousedown`
3. **Update State**: Emit `"node:updated"` when state changes
4. **Store References**: Cache DOM elements in `el._refs` for performance

---

## 📚 Complete API

For full API documentation, see the comments in [src/index.js](src/index.js).

### Editor API

| Property | Description |
|----------|-------------|
| `graph` | Graph instance |
| `registry` | Node type registry |
| `hooks` | Event system |
| `render()` | Trigger manual render |
| `start()` | Start execution loop |
| `stop()` | Stop execution loop |
| `addGroup(options)` | Create a group |
| `destroy()` | Cleanup |

### Key Methods

- `registry.register(type, definition)` - Register node type
- `graph.addNode(type, options)` - Create node
- `graph.addEdge(from, fromPort, to, toPort)` - Connect nodes  
- `graph.toJSON()` / `graph.fromJSON(json)` - Serialize/deserialize
-  `hooks.on(event, callback)` - Subscribe to events

### Available Events

- `node:create` | `node:move` | `node:resize` | `node:updated`
- `edge:create` | `edge:delete`
- `group:change`
- `runner:start` | `runner:stop` | `runner:tick`
- `error`

---

## 🎨 Customization

### Custom Themes

```javascript
const editor = createGraphEditor(canvas, {
  theme: {
    background: "#1a1a1a",
    grid: "#2a2a2a",
    node: "#2d3748",
    nodeTitle: "#4a5568",
    text: "#e2e9ef",
    wire: "#63b3ed",
    selection: "#3182ce"
  }
});
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
  }
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

| Issue | Solution |
|-------|----------|
| Canvas not rendering | Ensure canvas has explicit width/height |
| Nodes not executing | Call `start()` or set `autorun: true` |
| Type errors | Register node types before using them |
| HTML overlay not interactive | Set `pointerEvents: "auto"` on elements |
| Performance issues | Limit to <1000 nodes, optimize `onExecute`/`onDraw` |

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

[ISC](LICENSE) © cheonghakim

---

## 🔗 Links

- [GitHub Repository](https://github.com/cheonghakim/free-node)
- [Issue Tracker](https://github.com/cheonghakim/free-node/issues)
- [Changelog](CHANGELOG.md)