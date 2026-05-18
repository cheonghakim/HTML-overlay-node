/**
 * Core Nodes Package
 * Provides core example nodes: Note, HtmlNote, TodoNode, and Group
 */

export function registerCoreNodes(registry, hooks) {
    // Note Node
    registry.register("core/Note", {
        title: "Note",
        color: "#06b6d4", // vivid cyan
        icon: "note-text",
        size: { w: 180 },
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
        color: "#2563eb", // vivid blue
        icon: "code-braces",
        size: { w: 220 },
        inputs: [{ name: "in", datatype: "any" }],
        outputs: [{ name: "out", datatype: "any" }],

        html: {
            init(node, el, { body }) {
                el.classList.add("node-overlay");

                body.style.display = "flex";
                body.style.flexDirection = "column";
                body.style.gap = "8px";

                const label = document.createElement("label");
                label.className = "premium-label";
                label.textContent = "Data Input";
                body.appendChild(label);

                const input = document.createElement("input");
                input.className = "premium-input";
                input.placeholder = "Type message...";
                input.addEventListener("input", (e) => {
                    node.state.text = e.target.value;
                });
                input.addEventListener("mousedown", (e) => e.stopPropagation());

                body.appendChild(input);
                el._input = input;
            },

            update(node, el, _opts) {
                // Selection is handled by the canvas renderer
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
        title: "Task list",
        color: "#059669", // vivid emerald
        icon: "format-list-checks",
        size: { w: 240, h: 300 },
        inputs: [{ name: "in", datatype: "any" }],
        outputs: [{ name: "out", datatype: "any" }],
        html: {
            init(node, el, { body }) {
                el.classList.add("node-overlay");

                body.style.display = "flex";
                body.style.flexDirection = "column";

                const label = document.createElement("label");
                label.className = "premium-label";
                label.textContent = "New Task";
                body.appendChild(label);

                const inputRow = document.createElement("div");
                Object.assign(inputRow.style, { display: "flex", gap: "6px", marginBottom: "12px" });

                const input = document.createElement("input");
                input.className = "premium-input";
                input.placeholder = "What needs to be done?";

                const addBtn = document.createElement("button");
                addBtn.className = "premium-button";
                addBtn.textContent = "Add";

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
            update(node, el, _opts) {
                // Selection is handled by the canvas renderer
                const { list } = el._refs;
                const todos = node.state.todos || [];

                list.innerHTML = "";
                todos.forEach((todo) => {
                    const li = document.createElement("li");
                    Object.assign(li.style, {
                        display: "flex", alignItems: "center", padding: "6px 0",
                        borderBottom: "1px solid rgba(255,255,255,0.03)"
                    });

                    const chk = document.createElement("input");
                    chk.type = "checkbox";
                    chk.checked = todo.done;
                    Object.assign(chk.style, {
                        marginRight: "8px",
                        accentColor: "#5568d0",
                        pointerEvents: "auto",
                    });
                    chk.onchange = () => {
                        todo.done = chk.checked;
                        hooks.emit("node:updated", node);
                    };
                    chk.onmousedown = (e) => e.stopPropagation();

                    const span = document.createElement("span");
                    span.textContent = todo.text;
                    span.style.flex = "1";
                    span.style.fontSize = "11px";
                    span.style.textDecoration = todo.done ? "line-through" : "none";
                    span.style.color = todo.done ? "#404060" : "#8888a8";

                    const del = document.createElement("button");
                    del.textContent = "×";
                    Object.assign(del.style, {
                        background: "none", border: "none", color: "#4a3a4a",
                        cursor: "pointer", fontSize: "14px",
                        pointerEvents: "auto",
                        transition: "color 0.12s ease",
                    });
                    del.addEventListener("mouseover", () => { del.style.color = "#ff4d4d"; });
                    del.addEventListener("mouseout", () => { del.style.color = "#4a3a4a"; });
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
        color: "#64748b", // slate (groups stay neutral)
        size: { w: 240, h: 160 },
        onDraw(node, { ctx, theme, renderer }) {
            const { x, y, w, h } = node.computed;
            const headerH = theme.headerHeight ?? 22;
            const color = node.state.color || node.color || "#39424e";
            const bgAlpha = 0.12;
            const textColor = theme.text || "#e9e9ef";
            const r = theme.groupRadius ?? 18;

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

            ctx.save();
            ctx.shadowColor = rgba(color, 0.16);
            ctx.shadowBlur = 18;
            ctx.fillStyle = rgba(color, bgAlpha);
            roundRect(ctx, x, y, w, h, r);
            ctx.fill();
            ctx.restore();

            const bodyGradient = ctx.createLinearGradient(x, y, x, y + h);
            bodyGradient.addColorStop(0, "rgba(255,255,255,0.035)");
            bodyGradient.addColorStop(1, "rgba(255,255,255,0.01)");
            ctx.fillStyle = bodyGradient;
            roundRect(ctx, x, y, w, h, r);
            ctx.fill();

            ctx.strokeStyle = rgba(color, 0.34);
            ctx.lineWidth = 1;
            roundRect(ctx, x, y, w, h, r);
            ctx.stroke();

            const headerGradient = ctx.createLinearGradient(x, y, x + w, y + headerH);
            headerGradient.addColorStop(0, rgba(color, 0.28));
            headerGradient.addColorStop(1, rgba(color, 0.14));
            ctx.fillStyle = headerGradient;
            ctx.beginPath();
            ctx.roundRect(x, y, w, headerH, [r, r, 0, 0]);
            ctx.fill();

            ctx.strokeStyle = rgba(color, 0.4);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, y + headerH);
            ctx.lineTo(x + w, y + headerH);
            ctx.stroke();

            ctx.fillStyle = rgba(color, 0.9);
            ctx.beginPath();
            ctx.roundRect(x, y, w, 2, [r, r, 0, 0]);
            ctx.fill();

            // Use screen-coordinate text rendering for consistent scale
            if (renderer && renderer._drawScreenText) {
                renderer._drawScreenText(node.title, x + 14, y + headerH / 2, {
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
                ctx.fillText(node.title, x + 14, y + 8);
            }
        },
    });
}
