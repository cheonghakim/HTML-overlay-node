export function registerUtilNodes(registry) {
    registry.register("util/Trigger", {
        title: "Trigger",
        size: { w: 140, h: 80 },
        outputs: [{ name: "triggered", portType: "exec" }],
        html: {
            init(node, el, { header, body }) {
                // Styling
                el.style.minWidth = "140px";
                el.style.backgroundColor = "#1e1e23";
                el.style.border = "1px solid #3a3a40";
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
                body.style.minHeight = "32px"; // Ensure consistent body height

                const button = document.createElement("button");
                button.textContent = "Fire!";
                Object.assign(button.style, {
                    padding: "8px 16px",
                    background: "#4a9eff",
                    border: "none",
                    borderRadius: "4px",
                    color: "#fff",
                    fontSize: "14px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    pointerEvents: "auto",
                });

                button.addEventListener("click", (e) => {
                    e.stopPropagation();
                    e.preventDefault();

                    node.state.triggered = true;

                    // Access controller and runner from window.editor
                    const editor = window.editor;
                    if (!editor || !editor.controller || !editor.runner) {
                        console.error("[Trigger] Editor, controller, or runner not found");
                        return;
                    }

                    const controller = editor.controller;
                    const runner = editor.runner;

                    // Execute connected nodes using runner
                    const result = runner.runOnce(node.id, 0);
                    const connectedEdges = result.connectedEdges;

                    // Set active edges on controller (will be rendered on port canvas)
                    controller.activeEdges = connectedEdges;

                    // Show animation
                    const startTime = performance.now();
                    const animationDuration = 500;

                    const animate = () => {
                        const elapsed = performance.now() - startTime;
                        if (elapsed < animationDuration) {
                            controller.render();
                            requestAnimationFrame(animate);
                        } else {
                            controller.activeEdges = new Set();
                            controller.render();
                            node.state.triggered = false;
                        }
                    };

                    animate();
                });

                body.appendChild(button);
            },
        },
        onExecute(node, { setOutput }) {
            if (node.state.triggered) {
                console.log("[Trigger] Outputting triggered: true");
                setOutput("triggered", true);
            }
        },
    });

    registry.register("util/Watch", {
        title: "Watch",
        inputs: [{ name: "value", portType: "data", datatype: "any" }],
        onExecute(node, { getInput }) {
            const value = getInput("value");
            console.log("[Watch] onExecute called, value:", value);
        },
    });

    registry.register("util/Print", {
        title: "Print",
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
        inputs: [
            { name: "", portType: "exec" },
            { name: "delay (ms)", portType: "data", datatype: "number" },
        ],
        outputs: [{ name: "", portType: "exec" }],
        async onExecute(node, { getInput, setOutput }) {
            const delay = getInput("delay (ms)") || 0;
            await new Promise((resolve) => {
                setTimeout(() => {
                    console.log("[Timer] Triggered after", delay, "ms");
                    resolve();
                }, delay);
            });
            setOutput("", true);
        },
    });
}
