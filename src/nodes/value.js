/**
 * Value Nodes Package
 * Provides constant value nodes (Number, String, Boolean)
 */

export function registerValueNodes(registry) {
    // Number Node
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
            update(node, el, { header, selected }) {
                el.style.borderColor = selected ? "#6cf" : "#444";
                header.style.backgroundColor = selected ? "#3a4a5a" : "#2a2a31";
            },
        },
        onDraw(node, { ctx }) {
            const { x, y } = node.computed;
            ctx.fillStyle = "#8f8";
            ctx.font = "14px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(String(node.state.value ?? 0), x + 70, y + 42);
        },
    });

    // String Node
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
        onDraw(node, { ctx }) {
            const { x, y } = node.computed;
            ctx.fillStyle = "#8f8";
            ctx.font = "12px sans-serif";
            ctx.textAlign = "center";
            const text = String(node.state.value ?? "");
            const displayText = text.length > 15 ? text.substring(0, 15) + "..." : text;
            ctx.fillText(displayText, x + 80, y + 42);
        },
    });

    // Boolean Node
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
        onDraw(node, { ctx }) {
            const { x, y } = node.computed;
            ctx.fillStyle = node.state.value ? "#8f8" : "#f88";
            ctx.font = "14px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(String(node.state.value), x + 70, y + 42);
        },
    });
}
