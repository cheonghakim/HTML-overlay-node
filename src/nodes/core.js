/**
 * Core Nodes Package
 * Provides core example nodes: Note, HtmlNote, TodoNode, and Group
 */

export function registerCoreNodes(registry, hooks) {
    // Note Node
    registry.register("core/Note", {
        title: "Note",
        size: { w: 180, h: 80 },
        inputs: [{ name: "in", datatype: "any" }],
        outputs: [{ name: "out", datatype: "any" }],
        onCreate(node) {
            node.state.text = "hello";
        },
        onExecute(node, { getInput, setOutput }) {
            const incoming = getInput("in");
            const out = (incoming ?? node.state.text ?? "").toString().toUpperCase();
            setOutput(
                "out",
                out + ` · ${Math.floor((performance.now() / 1000) % 100)}`
            );
        },
    });

    // HTML Note Node
    registry.register("core/HtmlNote", {
        title: "HTML Note",
        size: { w: 200, h: 150 },
        inputs: [{ name: "in", datatype: "any" }],
        outputs: [{ name: "out", datatype: "any" }],

        html: {
            init(node, el, { header, body }) {
                el.style.backgroundColor = "#222";
                el.style.borderRadius = "8px";
                el.style.border = "1px solid #444";
                el.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";

                header.style.backgroundColor = "#333";
                header.style.borderBottom = "1px solid #444";
                header.style.color = "#eee";
                header.style.fontSize = "12px";
                header.style.fontWeight = "bold";
                header.textContent = "My HTML Node";

                body.style.padding = "8px";
                body.style.color = "#ccc";
                body.style.fontSize = "12px";

                const contentDiv = document.createElement("div");
                contentDiv.textContent = "Event Name";
                body.appendChild(contentDiv);

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
                input.addEventListener("mousedown", (e) => e.stopPropagation());

                body.appendChild(input);
                el._input = input;
            },

            update(node, el, { header, selected }) {
                el.style.borderColor = selected ? "#6cf" : "#444";
                header.style.backgroundColor = selected ? "#3a4a5a" : "#333";

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
    });

    // Todo List Node (HTML Overlay)
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

                const list = document.createElement("ul");
                Object.assign(list.style, {
                    listStyle: "none", padding: "0", margin: "0",
                    overflow: "hidden", flex: "1"
                });

                body.append(inputRow, list);

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
                input.onmousedown = (e) => e.stopPropagation();

                el._refs = { list };
            },
            update(node, el, { selected }) {
                el.style.borderColor = selected ? "#6cf" : "#333";

                const { list } = el._refs;
                const todos = node.state.todos || [];

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
        onDraw(node, { ctx, theme, renderer }) {
            const { x, y, w, h } = node.computed;
            const headerH = 24;
            const color = node.state.color || "#39424e";
            const bgAlpha = 0.5;
            const textColor = theme.text || "#e9e9ef";

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

            ctx.fillStyle = rgba(color, bgAlpha);
            roundRect(ctx, x, y, w, h, 10);
            ctx.fill();

            ctx.fillStyle = rgba(color, 0.3);
            ctx.beginPath();
            ctx.roundRect(x, y, w, headerH, [10, 10, 0, 0]);
            ctx.fill();

            // Use screen-coordinate text rendering for consistent scale
            if (renderer && renderer._drawScreenText) {
                renderer._drawScreenText(node.title, x + 12, y + 13, {
                    fontPx: 13,
                    color: textColor,
                    baseline: "middle",
                    align: "left"
                });
            } else {
                // Fallback to world coordinates if renderer not available
                ctx.fillStyle = textColor;
                ctx.font = "600 13px system-ui";
                ctx.textBaseline = "top";
                ctx.fillText(node.title, x + 12, y + 6);
            }
        },
    });
}
