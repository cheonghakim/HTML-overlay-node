/**
 * Value Nodes Package
 * Provides constant value nodes (Number, String, Boolean)
 */

export function registerValueNodes(registry) {
  // Number Node
  registry.register("value/Number", {
    title: "Number",
    color: "#3b82f6", // data (blue)
    size: { w: 140 },
    outputs: [{ name: "value", portType: "data", datatype: "number" }],
    onCreate(node) {
      node.state.value = 0;
    },
    onExecute(node, { setOutput }) {
      console.log("[Number] Outputting value:", node.state.value ?? 0);
      setOutput("value", node.state.value ?? 0);
    },
    html: {
      init(node, el, { body }) {
        el.classList.add("node-overlay");

        body.style.display = "flex";
        body.style.alignItems = "center";
        body.style.justifyContent = "center";

        const input = document.createElement("input");
        input.className = "premium-input";
        input.type = "number";
        input.style.textAlign = "center";
        input.value = node.state.value ?? 0;

        input.addEventListener("change", (e) => {
          node.state.value = parseFloat(e.target.value) || 0;
        });

        input.addEventListener("mousedown", (e) => e.stopPropagation());
        input.addEventListener("keydown", (e) => e.stopPropagation());

        body.appendChild(input);
      },
      update(_node, _el, _opts) {
        // Selection is handled by the canvas renderer
      },
    },
    onDraw(node, { ctx }) {
      // const { x, y } = node.computed;
      // ctx.fillStyle = "#8f8";
      // ctx.font = "14px sans-serif";
      // ctx.textAlign = "center";
      // ctx.fillText(String(node.state.value ?? 0), x + 70, y + 42);
    },
  });

  // String Node
  registry.register("value/String", {
    title: "String",
    color: "#3b82f6", // data (blue)
    size: { w: 160 },
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
    color: "#3b82f6", // data (blue)
    size: { w: 140 },
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
      ctx.font = "600 14px var(--font-main)";
      ctx.textAlign = "center";
      ctx.fillText(String(node.state.value), x + 70, y + 42);
    },
  });
}
