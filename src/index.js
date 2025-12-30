import { Registry } from "./core/Registry.js";
import { createHooks } from "./core/Hooks.js";
import { Graph } from "./core/Graph.js";
import { CanvasRenderer } from "./render/CanvasRenderer.js";
import { Controller } from "./interact/Controller.js";
import { ContextMenu } from "./interact/ContextMenu.js";
import { Runner } from "./core/Runner.js";

import { HtmlOverlay } from "./render/HtmlOverlay.js";
import { RemoveNodeCmd, ChangeGroupColorCmd } from "./core/commands.js";
import { Minimap } from "./minimap/Minimap.js";
import { PropertyPanel } from "./ui/PropertyPanel.js";



export function createGraphEditor(
  target,
  {
    theme,
    hooks: customHooks,
    autorun = true,
    showMinimap = true,
    enablePropertyPanel = true,
    propertyPanelContainer = null,
  } = {}
) {
  let canvas;
  let container;

  if (typeof target === "string") {
    target = document.querySelector(target);
  }

  if (!target) {
    throw new Error("createGraphEditor: target element not found");
  }

  if (target instanceof HTMLCanvasElement) {
    canvas = target;
    container = canvas.parentElement;
  } else {
    container = target;
    canvas = container.querySelector("canvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.style.display = "block";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      container.appendChild(canvas);
    }
  }

  // Ensure container has relative positioning for overlays
  if (getComputedStyle(container).position === "static") {
    container.style.position = "relative";
  }
  const hooks =
    customHooks ??
    createHooks([
      // essential hooks
      "node:create",
      "node:move",
      "node:click",
      "node:dblclick",
      "edge:create",
      "edge:delete",
      "graph:serialize",
      "graph:deserialize",
      "error",
      "runner:tick",
      "runner:start",
      "runner:stop",
      "node:resize",
      "group:change",
      "node:updated",
    ]);
  const registry = new Registry();
  const graph = new Graph({ hooks, registry });
  const renderer = new CanvasRenderer(canvas, { theme, registry });
  // HTML Overlay
  const htmlOverlay = new HtmlOverlay(canvas.parentElement, renderer, registry);

  // Port Canvas (above HTML overlay)
  const portCanvas = document.createElement("canvas");
  portCanvas.id = "port-canvas";
  Object.assign(portCanvas.style, {
    position: "absolute",
    top: "0",
    left: "0",
    pointerEvents: "none", // Pass through clicks
    zIndex: "20", // Above HTML overlay (z-index 10)
  });
  canvas.parentElement.appendChild(portCanvas);

  // Create port renderer (shares transform with main renderer)
  const portRenderer = new CanvasRenderer(portCanvas, { theme, registry });
  portRenderer.setTransform = renderer.setTransform.bind(renderer);
  portRenderer.scale = renderer.scale;
  portRenderer.offsetX = renderer.offsetX;
  portRenderer.offsetY = renderer.offsetY;

  const controller = new Controller({ graph, renderer, hooks, htmlOverlay, portRenderer });

  // Create context menu after controller (needs commandStack)
  const contextMenu = new ContextMenu({
    graph,
    hooks,
    renderer,
    commandStack: controller.stack,
  });

  // Connect context menu to controller
  controller.contextMenu = contextMenu;

  // Create minimap if enabled
  let minimap = null;
  if (showMinimap) {
    minimap = new Minimap(container, { graph, renderer });
  }

  // Initialize Property Panel if enabled
  let propertyPanel = null;
  if (enablePropertyPanel) {
    propertyPanel = new PropertyPanel(propertyPanelContainer || container, {
      graph,
      hooks,
      registry,
      render: () => controller.render(),
    });

    // Handle node double-click to open property panel
    hooks.on("node:dblclick", (node) => {
      propertyPanel.open(node);
    });
  }

  const runner = new Runner({ graph, registry, hooks });

  hooks.on("runner:tick", ({ time, dt }) => {
    renderer.draw(graph, {
      selection: controller.selection,
      tempEdge: controller.connecting ? controller.renderTempEdge() : null, // 필요시 helper
      running: true,
      time,
      dt,
    });
    htmlOverlay.draw(graph, controller.selection);
  });
  hooks.on("runner:start", () => {
    // 첫 프레임 즉시 렌더
    renderer.draw(graph, {
      selection: controller.selection,
      tempEdge: controller.connecting ? controller.renderTempEdge() : null,
      running: true,
      time: performance.now(),
      dt: 0,
    });
    htmlOverlay.draw(graph, controller.selection);
  });
  hooks.on("runner:stop", () => {
    // 정지 프레임
    renderer.draw(graph, {
      selection: controller.selection,
      tempEdge: controller.connecting ? controller.renderTempEdge() : null,
      running: false,
      time: performance.now(),
      dt: 0,
    });
    htmlOverlay.draw(graph, controller.selection);
  });

  hooks.on("node:updated", () => {
    controller.render();
  });

  // default node
  registry.register("core/Note", {
    title: "Note",
    size: { w: 180, h: 80 },
    inputs: [{ name: "in", datatype: "any" }],
    outputs: [{ name: "out", datatype: "any" }],
    onCreate(node) {
      node.state.text = "hello";
    },
    onExecute(node, { dt, getInput, setOutput }) {
      // Simple passthrough with uppercase and a heartbeat value
      const incoming = getInput("in");
      const out = (incoming ?? node.state.text ?? "").toString().toUpperCase();
      setOutput(
        "out",
        out + ` · ${Math.floor((performance.now() / 1000) % 100)}`
      );
    },
    onDraw(node, { ctx, theme }) {
      const pr = 8;
      const { x, y } = node.pos;
      const { width: w } = node.size;
      const lx = x + pr; // 월드 x
      const ly = y + 24 + 6; // 타이틀 바(24) 아래 여백 6
      // renderer._drawScreenText(node.state.text ?? "hello", lx, ly, {
      //   fontPx: 11,
      //   color: theme.text,
      //   baseline: "top",
      //   align: "left",
      // });
    },
  });

  // HTML Custom Node Example
  registry.register("core/HtmlNote", {
    title: "HTML Note",
    size: { w: 200, h: 150 },
    inputs: [{ name: "in", datatype: "any" }],
    outputs: [{ name: "out", datatype: "any" }],

    // HTML Overlay Configuration
    html: {
      // 초기화: 헤더/바디 구성
      init(node, el, { header, body }) {
        el.style.backgroundColor = "#222";
        el.style.borderRadius = "8px";
        el.style.border = "1px solid #444";
        el.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";

        // Header
        header.style.backgroundColor = "#333";
        header.style.borderBottom = "1px solid #444";
        header.style.color = "#eee";
        header.style.fontSize = "12px";
        header.style.fontWeight = "bold";
        header.textContent = "My HTML Node";

        // Body
        body.style.padding = "8px";
        body.style.color = "#ccc";
        body.style.fontSize = "12px";

        const contentDiv = document.createElement("div");
        contentDiv.textContent = "Event Name";
        body.appendChild(contentDiv);

        // Add some interactive content
        const input = document.createElement("input");
        Object.assign(input.style, {
          marginTop: "4px",
          padding: "4px",
          background: "#111",
          border: "1px solid #555",
          color: "#fff",
          borderRadius: "4px",
          pointerEvents: "auto",
        });
        input.placeholder = "Type here...";
        input.addEventListener("input", (e) => {
          node.state.text = e.target.value;
        });
        input.addEventListener("mousedown", (e) => e.stopPropagation()); // 캔버스 드래그 방지

        body.appendChild(input);

        // Store input ref for updates
        el._input = input;
      },

      // 매 프레임(또는 필요시) 업데이트
      update(node, el, { header, _body, selected }) {
        el.style.borderColor = selected ? "#6cf" : "#444";
        header.style.backgroundColor = selected ? "#3a4a5a" : "#333";

        // 상태 동기화 (외부에서 변경되었을 경우)
        if (el._input.value !== (node.state.text || "")) {
          el._input.value = node.state.text || "";
        }
      }
    },

    onCreate(node) {
      node.state.text = "";
    },
    onExecute(node, { getInput, setOutput }) {
      const incoming = getInput("in");
      setOutput("out", incoming);
    },
    // onDraw는 생략 가능 (HTML이 덮으니까)
    // 하지만 포트 등은 그려야 할 수도 있음. 
    // 현재 구조상 CanvasRenderer가 기본 노드를 그리므로, 
    // 투명하게 하거나 겹쳐서 그릴 수 있음.
  });

  // Todo List Node Example (HTML Overlay)
  registry.register("core/TodoNode", {
    title: "Todo List",
    size: { w: 240, h: 300 },
    inputs: [{ name: "in", datatype: "any" }],
    outputs: [{ name: "out", datatype: "any" }],
    html: {
      init(node, el, { header, body }) {
        el.style.backgroundColor = "#1e1e24";
        el.style.borderRadius = "8px";
        el.style.boxShadow = "0 4px 12px rgba(0,0,0,0.5)";
        el.style.border = "1px solid #333";

        header.style.backgroundColor = "#2a2a31";
        header.style.padding = "8px";
        header.style.fontWeight = "bold";
        header.style.color = "#e9e9ef";
        header.textContent = node.title;

        body.style.display = "flex";
        body.style.flexDirection = "column";
        body.style.padding = "8px";
        body.style.color = "#e9e9ef";

        // Input Area
        const inputRow = document.createElement("div");
        Object.assign(inputRow.style, { display: "flex", gap: "4px", marginBottom: "8px" });

        const input = document.createElement("input");
        Object.assign(input.style, {
          flex: "1", padding: "6px", borderRadius: "4px",
          border: "1px solid #444", background: "#141417", color: "#fff",
          pointerEvents: "auto",
        });
        input.placeholder = "Add task...";

        const addBtn = document.createElement("button");
        addBtn.textContent = "+";
        Object.assign(addBtn.style, {
          padding: "0 12px", cursor: "pointer", background: "#4f5b66",
          color: "#fff", border: "none", borderRadius: "4px",
          pointerEvents: "auto",
        });

        inputRow.append(input, addBtn);

        // List Area
        const list = document.createElement("ul");
        Object.assign(list.style, {
          listStyle: "none", padding: "0", margin: "0",
          overflow: "hidden", flex: "1"
        });

        body.append(inputRow, list);

        // Logic
        const addTodo = () => {
          const text = input.value.trim();
          if (!text) return;
          const todos = node.state.todos || [];
          node.state.todos = [...todos, { id: Date.now(), text, done: false }];
          input.value = "";
          hooks.emit("node:updated", node);
        };

        addBtn.onclick = addTodo;
        input.onkeydown = (e) => {
          if (e.key === "Enter") addTodo();
          e.stopPropagation();
        };
        input.onmousedown = (e) => e.stopPropagation(); // prevent drag

        el._refs = { list };
      },
      update(node, el, { selected }) {
        el.style.borderColor = selected ? "#6cf" : "#333";

        const { list } = el._refs;
        const todos = node.state.todos || [];

        // Re-render list (simple approach)
        list.innerHTML = "";
        todos.forEach((todo) => {
          const li = document.createElement("li");
          Object.assign(li.style, {
            display: "flex", alignItems: "center", padding: "6px 0",
            borderBottom: "1px solid #2a2a31"
          });

          const chk = document.createElement("input");
          chk.type = "checkbox";
          chk.checked = todo.done;
          chk.style.marginRight = "8px";
          chk.style.pointerEvents = "auto";
          chk.onchange = () => {
            todo.done = chk.checked;
            hooks.emit("node:updated", node);
          };
          chk.onmousedown = (e) => e.stopPropagation();

          const span = document.createElement("span");
          span.textContent = todo.text;
          span.style.flex = "1";
          span.style.textDecoration = todo.done ? "line-through" : "none";
          span.style.color = todo.done ? "#777" : "#eee";

          const del = document.createElement("button");
          del.textContent = "×";
          Object.assign(del.style, {
            background: "none", border: "none", color: "#f44",
            cursor: "pointer", fontSize: "16px",
            pointerEvents: "auto",
          });
          del.onclick = () => {
            node.state.todos = node.state.todos.filter((t) => t.id !== todo.id);
            hooks.emit("node:updated", node);
          };
          del.onmousedown = (e) => e.stopPropagation();

          li.append(chk, span, del);
          list.appendChild(li);
        });
      }
    },
    onCreate(node) {
      node.state.todos = [
        { id: 1, text: "Welcome to Free Node", done: false },
        { id: 2, text: "Try adding a task", done: true },
      ];
    },
  });

  // ===== MATH NODES =====
  registry.register("math/Add", {
    title: "Add",
    size: { w: 140, h: 100 },
    inputs: [
      { name: "exec", portType: "exec" },
      { name: "a", portType: "data", datatype: "number" },
      { name: "b", portType: "data", datatype: "number" },
    ],
    outputs: [
      { name: "exec", portType: "exec" },
      { name: "result", portType: "data", datatype: "number" },
    ],
    onCreate(node) {
      node.state.a = 0;
      node.state.b = 0;
    },
    onExecute(node, { getInput, setOutput }) {
      const a = getInput("a") ?? 0;
      const b = getInput("b") ?? 0;
      const result = a + b;
      console.log("[Add] a:", a, "b:", b, "result:", result);
      setOutput("result", result);
    },
  });

  registry.register("math/Subtract", {
    title: "Subtract",
    size: { w: 140, h: 80 },
    inputs: [
      { name: "a", datatype: "number" },
      { name: "b", datatype: "number" },
    ],
    outputs: [{ name: "result", datatype: "number" }],
    onExecute(node, { getInput, setOutput }) {
      const a = getInput("a") ?? 0;
      const b = getInput("b") ?? 0;
      setOutput("result", a - b);
    },
  });

  registry.register("math/Multiply", {
    title: "Multiply",
    size: { w: 140, h: 100 },
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
      const a = getInput("a") ?? 0;
      const b = getInput("b") ?? 0;
      const result = a * b;
      console.log("[Multiply] a:", a, "b:", b, "result:", result);
      setOutput("result", result);
    },
  });

  registry.register("math/Divide", {
    title: "Divide",
    size: { w: 140, h: 80 },
    inputs: [
      { name: "a", datatype: "number" },
      { name: "b", datatype: "number" },
    ],
    outputs: [{ name: "result", datatype: "number" }],
    onExecute(node, { getInput, setOutput }) {
      const a = getInput("a") ?? 0;
      const b = getInput("b") ?? 1;
      setOutput("result", b !== 0 ? a / b : 0);
    },
  });

  // ===== LOGIC NODES =====
  registry.register("logic/AND", {
    title: "AND",
    size: { w: 120, h: 100 },
    inputs: [
      { name: "exec", portType: "exec" },
      { name: "a", portType: "data", datatype: "boolean" },
      { name: "b", portType: "data", datatype: "boolean" },
    ],
    outputs: [
      { name: "exec", portType: "exec" },
      { name: "result", portType: "data", datatype: "boolean" },
    ],
    onExecute(node, { getInput, setOutput }) {
      const a = getInput("a") ?? false;
      const b = getInput("b") ?? false;
      console.log("[AND] Inputs - a:", a, "b:", b);
      const result = a && b;
      console.log("[AND] Result:", result);
      setOutput("result", result);
    },
  });

  registry.register("logic/OR", {
    title: "OR",
    size: { w: 120, h: 80 },
    inputs: [
      { name: "a", datatype: "boolean" },
      { name: "b", datatype: "boolean" },
    ],
    outputs: [{ name: "result", datatype: "boolean" }],
    onExecute(node, { getInput, setOutput }) {
      const a = getInput("a") ?? false;
      const b = getInput("b") ?? false;
      setOutput("result", a || b);
    },
  });

  registry.register("logic/NOT", {
    title: "NOT",
    size: { w: 120, h: 70 },
    inputs: [{ name: "in", datatype: "boolean" }],
    outputs: [{ name: "out", datatype: "boolean" }],
    onExecute(node, { getInput, setOutput }) {
      const val = getInput("in") ?? false;
      setOutput("out", !val);
    },
  });

  // ===== VALUE NODES =====
  registry.register("value/Number", {
    title: "Number",
    size: { w: 140, h: 60 },
    outputs: [{ name: "value", portType: "data", datatype: "number" }],
    onCreate(node) {
      node.state.value = 0;
    },
    onExecute(node, { setOutput }) {
      console.log("[Number] Outputting value:", node.state.value ?? 0);
      setOutput("value", node.state.value ?? 0);
    },
    html: {
      init(node, el, { header, body }) {
        el.style.backgroundColor = "#1e1e24";
        el.style.border = "1px solid #444";
        el.style.borderRadius = "8px";

        header.style.backgroundColor = "#2a2a31";
        header.style.borderBottom = "1px solid #444";
        header.style.color = "#eee";
        header.style.fontSize = "12px";
        header.textContent = "Number";

        body.style.padding = "12px";
        body.style.display = "flex";
        body.style.alignItems = "center";
        body.style.justifyContent = "center";

        const input = document.createElement("input");
        input.type = "number";
        input.value = node.state.value ?? 0;
        Object.assign(input.style, {
          width: "100%",
          padding: "6px",
          background: "#141417",
          border: "1px solid #444",
          borderRadius: "4px",
          color: "#fff",
          fontSize: "14px",
          textAlign: "center",
          pointerEvents: "auto",
        });

        input.addEventListener("change", (e) => {
          node.state.value = parseFloat(e.target.value) || 0;
        });

        input.addEventListener("mousedown", (e) => e.stopPropagation());
        input.addEventListener("keydown", (e) => e.stopPropagation());

        body.appendChild(input);
      },
      update(node, el, { header, body, selected }) {
        el.style.borderColor = selected ? "#6cf" : "#444";
        header.style.backgroundColor = selected ? "#3a4a5a" : "#2a2a31";
      },
    },
    onDraw(node, { ctx, theme }) {
      const { x, y } = node.computed;
      ctx.fillStyle = "#8f8";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(node.state.value ?? 0), x + 70, y + 42);
    },
  });

  registry.register("value/String", {
    title: "String",
    size: { w: 160, h: 60 },
    outputs: [{ name: "value", datatype: "string" }],
    onCreate(node) {
      node.state.value = "Hello";
    },
    onExecute(node, { setOutput }) {
      setOutput("value", node.state.value ?? "");
    },
    onDraw(node, { ctx, theme }) {
      const { x, y } = node.computed;
      ctx.fillStyle = "#8f8";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      const text = String(node.state.value ?? "");
      const displayText = text.length > 15 ? text.substring(0, 15) + "..." : text;
      ctx.fillText(displayText, x + 80, y + 42);
    },
  });

  registry.register("value/Boolean", {
    title: "Boolean",
    size: { w: 140, h: 60 },
    outputs: [{ name: "value", portType: "data", datatype: "boolean" }],
    onCreate(node) {
      node.state.value = true;
    },
    onExecute(node, { setOutput }) {
      console.log("[Boolean] Outputting value:", node.state.value ?? false);
      setOutput("value", node.state.value ?? false);
    },
    onDraw(node, { ctx, theme }) {
      const { x, y } = node.computed;
      ctx.fillStyle = node.state.value ? "#8f8" : "#f88";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(node.state.value), x + 70, y + 42);
    },
  });

  // ===== UTILITY NODES =====
  registry.register("util/Print", {
    title: "Print",
    size: { w: 140, h: 80 },
    inputs: [
      { name: "exec", portType: "exec" },
      { name: "value", portType: "data", datatype: "any" },
    ],
    onCreate(node) {
      node.state.lastValue = null;
    },
    onExecute(node, { getInput }) {
      const val = getInput("value");
      if (val !== node.state.lastValue) {
        console.log("[Print]", val);
        node.state.lastValue = val;
      }
    },
  });

  registry.register("util/Watch", {
    title: "Watch",
    size: { w: 180, h: 110 },
    inputs: [
      { name: "exec", portType: "exec" },
      { name: "value", portType: "data", datatype: "any" },
    ],
    outputs: [
      { name: "exec", portType: "exec" },
      { name: "value", portType: "data", datatype: "any" },
    ],
    onCreate(node) {
      node.state.displayValue = "---";
    },
    onExecute(node, { getInput, setOutput }) {
      const val = getInput("value");
      console.log("[Watch] onExecute called, value:", val);
      node.state.displayValue = String(val ?? "---");
      setOutput("value", val);
    },
    onDraw(node, { ctx, theme }) {
      const { x, y } = node.computed;
      ctx.fillStyle = "#fa3";
      ctx.font = "11px monospace";
      ctx.textAlign = "left";
      const text = String(node.state.displayValue ?? "---");
      const displayText = text.length > 20 ? text.substring(0, 20) + "..." : text;
      ctx.fillText(displayText, x + 8, y + 50);
    },
  });

  registry.register("util/Timer", {
    title: "Timer",
    size: { w: 140, h: 60 },
    outputs: [{ name: "time", datatype: "number" }],
    onCreate(node) {
      node.state.startTime = performance.now();
    },
    onExecute(node, { setOutput }) {
      const elapsed = (performance.now() - (node.state.startTime ?? 0)) / 1000;
      setOutput("time", elapsed.toFixed(2));
    },
  });

  // Trigger Node with Button (HTML Overlay)
  registry.register("util/Trigger", {
    title: "Trigger",
    size: { w: 140, h: 80 },
    outputs: [{ name: "exec", portType: "exec" }], // Changed to exec port

    html: {
      init(node, el, { header, body }) {
        el.style.backgroundColor = "#1e1e24";
        el.style.border = "1px solid #444";
        el.style.borderRadius = "8px";

        header.style.backgroundColor = "#2a2a31";
        header.style.borderBottom = "1px solid #444";
        header.style.color = "#eee";
        header.style.fontSize = "12px";
        header.textContent = "Trigger";

        body.style.padding = "12px";
        body.style.display = "flex";
        body.style.alignItems = "center";
        body.style.justifyContent = "center";

        const button = document.createElement("button");
        button.textContent = "Fire!";
        Object.assign(button.style, {
          padding: "8px 16px",
          background: "#4a9eff",
          border: "none",
          borderRadius: "4px",
          color: "#fff",
          fontWeight: "bold",
          cursor: "pointer",
          pointerEvents: "auto",
          transition: "background 0.2s",
        });

        button.addEventListener("mousedown", (e) => {
          e.stopPropagation();
          button.style.background = "#2a7ede";
        });

        button.addEventListener("mouseup", () => {
          button.style.background = "#4a9eff";
        });

        button.addEventListener("click", (e) => {
          e.stopPropagation();
          node.state.triggered = true;
          console.log("[Trigger] Button clicked!");

          // Use runner.runOnce for connected node execution
          if (node.__runnerRef && node.__controllerRef) {
            console.log("[Trigger] Runner and controller found");
            const runner = node.__runnerRef;
            const controller = node.__controllerRef;
            const graph = controller.graph;
            console.log("[Trigger] Calling runner.runOnce with node.id:", node.id);

            // Execute connected nodes using runner
            const result = runner.runOnce(node.id, 0);
            const connectedEdges = result.connectedEdges;



            // Show animation with manual rendering
            const startTime = performance.now();
            const animationDuration = 500;

            const animate = () => {
              const elapsed = performance.now() - startTime;
              if (elapsed < animationDuration) {
                controller.renderer.draw(graph, {
                  selection: controller.selection,
                  tempEdge: null,
                  running: true,
                  time: performance.now(),
                  dt: 0,
                  activeEdges: connectedEdges, // Only animate connected edges
                });
                controller.htmlOverlay?.draw(graph, controller.selection);
                requestAnimationFrame(animate);
              } else {
                controller.render();
                node.state.triggered = false;
              }
            };

            animate();
          }
        });

        body.appendChild(button);
      },

      update(node, el, { header, body, selected }) {
        el.style.borderColor = selected ? "#6cf" : "#444";
        header.style.backgroundColor = selected ? "#3a4a5a" : "#2a2a31";
      },
    },

    onCreate(node) {
      node.state.triggered = false;
    },

    onExecute(node, { setOutput }) {
      console.log("[Trigger] Outputting triggered:", node.state.triggered);
      setOutput("triggered", node.state.triggered);
    },
  });

  // Group Node
  registry.register("core/Group", {
    title: "Group",
    size: { w: 240, h: 160 },
    onDraw(node, { ctx, theme }) {
      const { x, y, w, h } = node.computed;
      const headerH = 24;
      const color = node.state.color || "#39424e";
      const bgAlpha = 0.5;
      const textColor = theme.text || "#e9e9ef";

      // Helper for rgba
      const rgba = (hex, a) => {
        const c = hex.replace("#", "");
        const n = parseInt(
          c.length === 3
            ? c
              .split("")
              .map((x) => x + x)
              .join("")
            : c,
          16
        );
        const r = (n >> 16) & 255,
          g = (n >> 8) & 255,
          b = n & 255;
        return `rgba(${r},${g},${b},${a})`;
      };

      // Helper for roundRect
      const roundRect = (ctx, x, y, w, h, r) => {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
      };

      // Body
      ctx.fillStyle = rgba(color, bgAlpha);
      roundRect(ctx, x, y, w, h, 10);
      ctx.fill();

      // Header bar (subtle)
      ctx.fillStyle = rgba(color, 0.3);
      ctx.beginPath();
      ctx.roundRect(x, y, w, headerH, [10, 10, 0, 0]);
      ctx.fill();

      // Title - top left with better styling
      ctx.fillStyle = textColor;
      ctx.font = "600 13px system-ui";
      ctx.textBaseline = "top";
      ctx.fillText(node.title, x + 12, y + 6);
    },
  });

  /**
  * Setup default context menu items
  * This function can be customized or replaced by users
  */
  function setupDefaultContextMenu(contextMenu, { controller, graph, hooks }) {
    // Add Node submenu (canvas background only)
    const nodeTypes = [];
    for (const [key, typeDef] of graph.registry.types.entries()) {
      nodeTypes.push({
        id: `add-${key}`,
        label: typeDef.title || key,
        action: () => {
          // Get world position from context menu
          const worldPos = contextMenu.worldPosition || { x: 100, y: 100 };

          // Add node at click position
          const node = graph.addNode(key, {
            x: worldPos.x,
            y: worldPos.y,
          });

          hooks?.emit("node:updated", node);
          controller.render(); // Update minimap and canvas
        },
      });
    }

    contextMenu.addItem("add-node", "Add Node", {
      condition: (target) => !target,
      submenu: nodeTypes,
      order: 5,
    });

    // Delete Node (for all nodes except groups)
    contextMenu.addItem("delete-node", "Delete Node", {
      condition: (target) => target && target.type !== "core/Group",
      action: (target) => {
        const cmd = RemoveNodeCmd(graph, target);
        controller.stack.exec(cmd);
        hooks?.emit("node:updated", target);
      },
      order: 10,
    });

    // Change Group Color (for groups only) - with submenu
    const colors = [
      { name: "Default", color: "#39424e" },
      { name: "Slate", color: "#4a5568" },
      { name: "Gray", color: "#2d3748" },
      { name: "Blue", color: "#1a365d" },
      { name: "Green", color: "#22543d" },
      { name: "Red", color: "#742a2a" },
      { name: "Purple", color: "#44337a" },
    ];

    contextMenu.addItem("change-group-color", "Change Color", {
      condition: (target) => target && target.type === "core/Group",
      submenu: colors.map((colorInfo) => ({
        id: `color-${colorInfo.color}`,
        label: colorInfo.name,
        color: colorInfo.color,
        action: (target) => {
          const currentColor = target.state.color || "#39424e";
          const cmd = ChangeGroupColorCmd(target, currentColor, colorInfo.color);
          controller.stack.exec(cmd);
          hooks?.emit("node:updated", target);
        },
      })),
      order: 20,
    });
    contextMenu.addItem("delete-group", "Delete Group", {
      condition: (target) => target && target.type === "core/Group",
      action: (target) => {
        const cmd = RemoveNodeCmd(graph, target);
        controller.stack.exec(cmd);
        hooks?.emit("node:updated", target);
      },
      order: 20,
    });
  }


  // Setup default context menu items
  // Users can easily override, remove, or add items here
  setupDefaultContextMenu(contextMenu, { controller, graph, hooks });

  // initial render & resize
  renderer.resize(canvas.clientWidth, canvas.clientHeight);
  portRenderer.resize(canvas.clientWidth, canvas.clientHeight);
  controller.render();

  const ro = new ResizeObserver(() => {
    renderer.resize(canvas.clientWidth, canvas.clientHeight);
    portRenderer.resize(canvas.clientWidth, canvas.clientHeight);
    controller.render();
  });
  ro.observe(canvas);

  // Wrap controller.render to update minimap
  const originalRender = controller.render.bind(controller);
  controller.render = function () {
    originalRender();
    if (minimap) {
      minimap.render();
    }
  };

  const api = {
    addGroup: (args = {}) => {
      controller.graph.groupManager.addGroup(args);
      controller.render();
    },
    graph,
    renderer,
    controller, // Expose controller for snap-to-grid access
    runner, // Expose runner for trigger
    minimap, // Expose minimap
    contextMenu,
    hooks, // Expose hooks for event handling
    registry, // Expose registry for node types
    htmlOverlay, // Expose htmlOverlay for clearing/resetting
    propertyPanel, // Expose propertyPanel
    render: () => controller.render(),
    start: () => runner.start(),
    stop: () => runner.stop(),
    destroy: () => {
      runner.stop();
      ro.disconnect();
      controller.destroy();
      htmlOverlay.destroy();
      contextMenu.destroy();
      if (propertyPanel) propertyPanel.destroy();
      if (minimap) minimap.destroy();
    },
  };

  if (autorun) runner.start();
  return api;
}
