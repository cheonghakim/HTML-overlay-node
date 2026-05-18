// Duration each exec edge stays active during sequential animation (ms)
const STEP_DURATION = 620;

export function registerUtilNodes(registry) {
  registry.register("util/Trigger", {
    title: "Trigger",
    color: "#f7cb4d",
    icon: "play-circle",
    size: { w: 140, h: 80 },
    outputs: [{ name: "exec", portType: "exec" }],
    html: {
      init(node, el, { body, graph }) {
        el.classList.add("node-overlay");

        body.style.display = "flex";
        body.style.alignItems = "center";
        body.style.justifyContent = "center";

        const button = document.createElement("button");
        button.className = "premium-button";
        button.textContent = "Execute";
        button.style.width = "100%";
        button.style.textTransform = "uppercase";
        button.style.letterSpacing = "1px";
        button.style.marginTop = "22px"; // Push below exec port label (port bottom ~y=50)

        button.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();

          if (node.state._firing) return;

          // Use graph.controller / graph.runner so this works in sub-panels too
          const controller = graph?.controller;
          const runner = graph?.runner;
          if (!controller || !runner) return;

          node.state.triggered = true;
          node.state._firing = true;

          // If in Step Mode, just prepare the plan and wait for manual clicks
          if (runner.executionMode === "step") {
            runner.startStepping(node.id);
            node.state.triggered = false;
            node.state._firing = false;
            return;
          }

          // Active state styling for Run mode
          button.style.borderColor = "#4f62c0";
          button.style.color = "#7080d8";
          button.style.background = "rgba(79,98,192,0.12)";

          const { connectedEdges, execEdgeOrder } = runner.runOnce(node.id, 0);

          controller.activeEdgeTimes = new Map();

          if (execEdgeOrder.length > 0) {
            // Sequential: animate one exec edge at a time
            const startTime = performance.now();
            const totalDuration = execEdgeOrder.length * STEP_DURATION + 80;

            const animate = () => {
              const now = performance.now();
              const elapsed = now - startTime;
              const step = Math.floor(elapsed / STEP_DURATION);

              const activeNow = new Set();
              const activeNodeNow = new Set();
              if (step < execEdgeOrder.length) {
                const edgeId = execEdgeOrder[step];
                activeNow.add(edgeId);
                if (!controller.activeEdgeTimes.has(edgeId)) {
                  controller.activeEdgeTimes.set(edgeId, startTime + step * STEP_DURATION);
                }
                // Highlight the destination node of this exec edge
                const edge = runner.graph.edges.get(edgeId);
                if (edge?.toNode) activeNodeNow.add(edge.toNode);
              }

              controller.activeEdges = activeNow;
              controller.activeNodes = activeNodeNow;
              controller.render();

              if (elapsed < totalDuration) {
                requestAnimationFrame(animate);
              } else {
                _resetTrigger(controller, node, button);
              }
            };
            requestAnimationFrame(animate);
          } else if (connectedEdges.size > 0) {
            // Fallback: all data edges at once
            const startTime = performance.now();
            const totalDuration = STEP_DURATION;
            const now = performance.now();
            for (const id of connectedEdges) {
              controller.activeEdgeTimes.set(id, now);
            }

            const animate = () => {
              controller.activeEdges = connectedEdges;
              controller.render();
              if (performance.now() - startTime < totalDuration) {
                requestAnimationFrame(animate);
              } else {
                _resetTrigger(controller, node, button);
              }
            };
            requestAnimationFrame(animate);
          } else {
            _resetTrigger(controller, node, button);
          }
        });

        body.appendChild(button);
        el._btn = button;
      },
    },
    onExecute(node, { setOutput }) {
      if (node.state.triggered) {
        setOutput("exec", true);
      }
    },
  });

  registry.register("util/Watch", {
    title: "Watch",
    color: "#10b981",
    icon: "eye",
    size: { w: 180, h: 130 },
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
    html: {
      init(node, el, { body }) {
        el.classList.add("node-overlay");
        body.style.display = "flex";
        body.style.alignItems = "center";
        body.style.justifyContent = "center";
        body.style.paddingTop = "44px"; // Push display below both port rows (y=44, y=64)

        const container = document.createElement("div");
        container.className = "watch-display";
        container.style.width = "90%";
        container.style.padding = "10px";
        container.style.background = "rgba(0,0,0,0.2)";
        container.style.borderRadius = "4px";
        container.style.border = "1px solid rgba(255,255,255,0.05)";
        container.style.textAlign = "center";
        container.style.fontFamily = "'JetBrains Mono', 'Fira Code', monospace";
        container.style.fontSize = "12px";
        container.style.color = "#10b981";
        container.style.textShadow = "0 0 10px rgba(16,185,129,0.3)";
        container.textContent = node.state.displayValue || "---";

        body.appendChild(container);
        node._display = container;
      },
    },
    onExecute(node, { getInput, setOutput }) {
      const val = getInput("value");
      console.log("[Watch] onExecute called, value:", val);

      // Format value for display
      let display = "---";
      if (val !== undefined && val !== null) {
        display = typeof val === "object" ? JSON.stringify(val) : String(val);
      }

      node.state.displayValue = display;
      if (node._display) {
        node._display.textContent = display;
        // Add a brief glow effect
        node._display.style.color = "#ffffff";
        setTimeout(() => {
          if (node._display) node._display.style.color = "#10b981";
        }, 100);
      }

      // Pass through
      setOutput("exec", true); // exec signal
      setOutput("value", val); // data value
    },
  });

  registry.register("util/Print", {
    title: "Print",
    color: "#10b981",
    icon: "printer",
    size: { w: 140 },
    inputs: [
      { name: "", portType: "exec" },
      { name: "value", portType: "data", datatype: "any" },
    ],
    outputs: [{ name: "", portType: "exec" }],
    onExecute(node, { getInput, setOutput }) {
      const value = getInput("value");
      console.log("[Print]", value);
      setOutput("", true);
    },
  });

  registry.register("util/Timer", {
    title: "Timer",
    color: "#7baaf7",
    icon: "timer",
    size: { w: 140 },
    inputs: [
      { name: "", portType: "exec" },
      { name: "delay (ms)", portType: "data", datatype: "number" },
    ],
    outputs: [{ name: "", portType: "exec" }],
    async onExecute(node, { getInput, setOutput }) {
      const delay = getInput("delay (ms)") || 0;
      await new Promise((resolve) => {
        setTimeout(() => {
          resolve();
        }, delay);
      });
      setOutput("", true);
    },
  });

  // ── Widget Demo ──────────────────────────────────────────────────────────────
  // Test node that showcases all property panel widget types.
  // Connect its outputs to Watch or Print nodes to verify values update live.
  registry.register("util/WidgetDemo", {
    title: "Widget Demo",
    color: "#7c3aed",
    icon: "tune",
    size: { w: 200 },
    outputs: [
      { name: "number", portType: "data", datatype: "number" },
      { name: "text",   portType: "data", datatype: "string" },
      { name: "flag",   portType: "data", datatype: "boolean" },
    ],

    properties: [
      // Slider — real-time drag (no undo on drag, undo on release)
      { key: "amount",  label: "Amount",  widget: "slider",  min: 0, max: 100, step: 1 },
      // Number input
      { key: "gain",    label: "Gain",    widget: "number",  min: 0, max: 10,  step: 0.1 },
      // Dropdown
      { key: "mode",    label: "Mode",    widget: "select",
        options: ["linear", "exponential", { label: "S-Curve", value: "scurve" }] },
      // Toggle switch
      { key: "enabled", label: "Enabled", widget: "toggle" },
      // Color picker
      { key: "tint",    label: "Color",   widget: "color" },
      // Text input
      { key: "label",   label: "Label",   widget: "text",    placeholder: "enter label…" },
      // Multiline
      { key: "notes",   label: "Notes",   widget: "textarea", placeholder: "notes…" },
      // Slider with custom onChange — also updates a derived "clipped" key atomically
      {
        key: "threshold",
        label: "Threshold",
        widget: "slider",
        min: 0, max: 1, step: 0.01,
        onChange(node, value, { controller, graph, immediate }) {
          const clipped = value > 0.8;
          if (immediate) {
            // Live drag: mutate directly so canvas redraws without undo entry
            node.state.threshold = value;
            node.state.clipped   = clipped;
            graph.hooks.emit("node:updated", node);
          } else {
            // Release: commit to undo history
            controller.updateNodeState(node.id, {
              ...node.state, threshold: value, clipped,
            });
          }
        },
      },
    ],

    onCreate(node) {
      node.state.amount    ??= 50;
      node.state.gain      ??= 1.0;
      node.state.mode      ??= "linear";
      node.state.enabled   ??= true;
      node.state.tint      ??= "#6366f1";
      node.state.label     ??= "hello";
      node.state.notes     ??= "";
      node.state.threshold ??= 0.5;
      node.state.clipped   ??= false;
    },

    onExecute(node, { setOutput }) {
      const base = node.state.amount * node.state.gain;
      setOutput("number", node.state.mode === "exponential" ? base ** 2 / 100 : base);
      setOutput("text",   `${node.state.label} [${node.state.mode}]`);
      setOutput("flag",   node.state.enabled);
    },
  });
}

function _resetTrigger(controller, node, button) {
  controller.activeEdges = new Set();
  controller.activeEdgeTimes = new Map();
  controller.activeNodes = new Set();
  controller.render();
  node.state.triggered = false;
  node.state._firing = false;
  button.style.borderColor = "#383858";
  button.style.color = "#8888aa";
  button.style.background = "transparent";
}
