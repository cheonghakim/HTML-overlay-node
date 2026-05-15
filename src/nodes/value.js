/**
 * Value Nodes Package
 * Provides constant value nodes (Number, String, Boolean)
 */

const VALUE_COLOR = "#2563eb"; // vivid blue

export function registerValueNodes(registry) {
  // Number Node
  registry.register("value/Number", {
    title: "Number",
    color: VALUE_COLOR,
    size: { w: 140, h: 90 },
    outputs: [{ name: "value", portType: "data", datatype: "number" }],
    onCreate(node) {
      node.state.value = 0;
    },
    onExecute(node, { setOutput }) {
      setOutput("value", node.state.value ?? 0);
    },
    html: {
      init(node, el, { body }) {
        el.classList.add("node-overlay");

        body.style.display = "flex";
        body.style.alignItems = "flex-start";
        body.style.justifyContent = "center";
        body.style.paddingTop = "26px";

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
      update(_node, _el) {},
    },
  });

  // String Node
  registry.register("value/String", {
    title: "String",
    color: VALUE_COLOR,
    size: { w: 160 },
    outputs: [{ name: "value", datatype: "string" }],
    onCreate(node) {
      node.state.value = "Hello";
    },
    onExecute(node, { setOutput }) {
      setOutput("value", node.state.value ?? "");
    },
    onDraw(node, { ctx }) {
      const { x, y, w } = node.computed;
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = "11px var(--font-mono, monospace)";
      ctx.textAlign = "center";
      const text = String(node.state.value ?? "");
      const display = text.length > 16 ? text.substring(0, 16) + "…" : text;
      ctx.fillText(`"${display}"`, x + w / 2, y + 50);
    },
  });

  // Boolean Node
  registry.register("value/Boolean", {
    title: "Boolean",
    color: VALUE_COLOR,
    size: { w: 140 },
    outputs: [{ name: "value", portType: "data", datatype: "boolean" }],
    onCreate(node) {
      node.state.value = true;
    },
    onExecute(node, { setOutput }) {
      setOutput("value", node.state.value ?? false);
    },
    onDraw(node, { ctx }) {
      const { x, y, w } = node.computed;
      ctx.fillStyle = node.state.value
        ? "rgba(34, 197, 94, 0.9)"
        : "rgba(239, 68, 68, 0.9)";
      ctx.font = "600 13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(node.state.value), x + w / 2, y + 50);
    },
  });
}
