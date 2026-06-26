import { triggerSubGraphAnimation } from "./subgraph.js";

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

          const { connectedEdges, execEdgeOrder, executionSteps } = runner.runOnce(node.id, 0);

          controller.activeEdgeTimes = new Map();

          const steps = executionSteps || execEdgeOrder.map(edgeId => ({ nodeId: runner.graph.edges.get(edgeId)?.toNode, edgeId }));

          if (steps.length > 0) {
            // Sequential step-based animation: each step waits for sub-graph before advancing
            const runStep = (stepIdx) => {
              if (stepIdx >= steps.length) {
                _resetTrigger(controller, node, button);
                return;
              }

              const s = steps[stepIdx];
              const activeNow = new Set();
              const activeNodeNow = new Set();

              if (s.nodeId) activeNodeNow.add(s.nodeId);
              // Show the OUTGOING edge (= next step's incoming edge) together with this node.
              // Skip if the next step is the SAME node — that means it's a repeated step
              // for a data-dependency edge, and its edgeId is the incoming exec edge to this
              // node (not an outgoing edge), which would cause a duplicate highlight.
              const nextStep = steps[stepIdx + 1];
              const outEdgeId = (nextStep && nextStep.nodeId !== s.nodeId) ? nextStep.edgeId : undefined;
              if (outEdgeId) {
                activeNow.add(outEdgeId);
                if (!controller.activeEdgeTimes.has(outEdgeId)) {
                  controller.activeEdgeTimes.set(outEdgeId, performance.now());
                }
              }

              // Check whether this step involves an open sub-graph panel
              const nodeObj = s.nodeId ? runner.graph.nodes.get(s.nodeId) : null;
              const subPanel = runner.graph?.controller?.subNodePanel;
              const hasOpenSubPanel = nodeObj?.type === 'util/SubGraph' && subPanel?.isOpenFor(nodeObj.id);


              if (hasOpenSubPanel) {
                // steps[stepIdx+1].edgeId is unreliable for SubGraph because Runner inserts
                // data-dependency steps (edgeId=null) between exec steps. Find the exec
                // outgoing edge directly from the graph instead.
                const sgExecPort = nodeObj.outputs.find(p => p.portType === 'exec');
                let subOutEdgeId = null;
                if (sgExecPort) {
                  for (const edge of runner.graph.edges.values()) {
                    if (edge.fromNode === nodeObj.id && edge.fromPort === sgExecPort.id) {
                      subOutEdgeId = edge.id;
                      break;
                    }
                  }
                }
                const subActiveNow = new Set();
                if (subOutEdgeId) subActiveNow.add(subOutEdgeId);

                controller.activeEdges = new Set();
                controller.activeNodes = activeNodeNow;
                if (subOutEdgeId) controller.activeEdgeTimes.delete(subOutEdgeId);

                // Primary signal: onComplete callback from animateInPanel
                let subDone = false;
                triggerSubGraphAnimation(nodeObj, runner.graph, performance.now(), () => {
                  subDone = true;
                });

                // Fallback timeout in case onComplete never fires
                const subResult = nodeObj._subGraphResult;
                const subSteps  = subResult?.executionSteps || [];
                const subEnd = performance.now() +
                  (subSteps.length > 0 ? subSteps.length * STEP_DURATION + 300 : STEP_DURATION + 300);

                // Render loop: keeps main canvas alive during sub-animation.
                // Transitions to post-glow once sub-animation signals done.
                const subRender = () => {
                  controller.render(performance.now());
                  if (!subDone && performance.now() < subEnd) {
                    requestAnimationFrame(subRender);
                  } else {
                    // Post-glow: SubGraph node + its exec outgoing edge for STEP_DURATION
                    if (subOutEdgeId) controller.activeEdgeTimes.set(subOutEdgeId, performance.now());
                    controller.activeEdges = subActiveNow;
                    controller.activeNodes = activeNodeNow;
                    const postEnd = performance.now() + STEP_DURATION;
                    const postRaf = () => {
                      controller.render(performance.now());
                      if (performance.now() < postEnd) {
                        requestAnimationFrame(postRaf);
                      } else {
                        runStep(stepIdx + 1);
                      }
                    };
                    requestAnimationFrame(postRaf);
                  }
                };
                requestAnimationFrame(subRender);
              } else {
                // Normal step: show edge/node active for STEP_DURATION then advance
                controller.activeEdges = activeNow;
                controller.activeNodes = activeNodeNow;

                const stepEnd = performance.now() + STEP_DURATION;
                const stepRaf = () => {
                  controller.render(performance.now());
                  if (performance.now() < stepEnd) {
                    requestAnimationFrame(stepRaf);
                  } else {
                    runStep(stepIdx + 1);
                  }
                };
                requestAnimationFrame(stepRaf);
              }
            };

            runStep(0);
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
