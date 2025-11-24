import { Registry } from "./core/Registry.js";
import { createHooks } from "./core/Hooks.js";
import { Graph } from "./core/Graph.js";
import { CanvasRenderer } from "./render/CanvasRenderer.js";
import { Controller } from "./interact/Controller.js";
import { Runner } from "./core/Runner.js";

import { HtmlOverlay } from "./render/HtmlOverlay.js";

export function createGraphEditor(
  canvas,
  { theme, hooks: customHooks, autorun = true } = {}
) {
  const hooks =
    customHooks ??
    createHooks([
      // essential hooks
      "node:create",
      "node:move",
      "edge:create",
      "edge:delete",
      "graph:serialize",
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

  const controller = new Controller({ graph, renderer, hooks, htmlOverlay });
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
        contentDiv.textContent = "Content: -- 인션이";
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
        
        body.appendChild(document.createTextNode("Content:"));
        body.appendChild(input);
        
        // Store input ref for updates
        el._input = input;
      },
      
      // 매 프레임(또는 필요시) 업데이트
      update(node, el, { header, body, selected }) {
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
          overflowY: "auto", flex: "1"
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

  // Group Node
  registry.register("core/Group", {
    title: "Group",
    size: { w: 240, h: 160 },
    onDraw(node, { ctx, theme }) {
      const { x, y, w, h } = node.computed;
      const headerH = 22;
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

      // Header
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x, y, w, headerH + 6, [10, 10, 0, 0]);
      ctx.fill();

      // Title
      ctx.fillStyle = textColor;
      ctx.font = "12px system-ui";
      ctx.textBaseline = "middle";
      ctx.fillText(node.title, x + 10, y + headerH / 2);
    },
  });


  // initial render & resize

  renderer.resize(canvas.clientWidth, canvas.clientHeight);
  controller.render();

  const ro = new ResizeObserver(() => {
    renderer.resize(canvas.clientWidth, canvas.clientHeight);
    controller.render();
  });
  ro.observe(canvas);

  const api = {
    addGroup: (args = {}) => {
      controller.graph.groupManager.addGroup(args);
      controller.render();
    },
    graph,
    renderer,
    render: () => controller.render(),
    start: () => runner.start(),
    stop: () => runner.stop(),
    destroy: () => {
      runner.stop();
      ro.disconnect();
    },
  };

  if (autorun) runner.start();
  return api;
}
