// Duration each exec edge stays active during sequential animation (ms)
const STEP_DURATION = 620;

export function registerUtilNodes(registry) {
  registry.register("util/Trigger", {
    title: "Trigger",
    color: "#f7cb4d", // event (amber)
    size: { w: 140, h: 100 },
    outputs: [{ name: "exec", portType: "exec" }],
    html: {
      init(node, el, { body }) {
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

          const editor = window.editor;
          if (!editor?.controller || !editor?.runner) return;

          const controller = editor.controller;
          const runner = editor.runner;

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
    color: "#10b981", // info (emerald)
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
    color: "#10b981", // info (emerald)
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
    color: "#7baaf7", // event (amber)
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
