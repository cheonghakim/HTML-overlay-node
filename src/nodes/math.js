/**
 * Math Nodes Package
 * Provides basic mathematical operation nodes
 */

export function registerMathNodes(registry) {
    // Add Node
    registry.register("math/Add", {
        title: "Add",
        color: "#f43f5e", // math (rose)
        size: { w: 140 },
        inputs: [
            { name: "exec", portType: "exec" },
            { name: "a", portType: "data", datatype: "number" },
            { name: "b", portType: "data", datatype: "number" },
        ],
        outputs: [
            { name: "exec", portType: "exec" },
            { name: "result", portType: "data", datatype: "number" },
        ],
        onCreate(node) {
            node.state.a = 0;
            node.state.b = 0;
        },
        onExecute(node, { getInput, setOutput }) {
            const a = getInput("a") ?? node.state.a ?? 0;
            const b = getInput("b") ?? node.state.b ?? 0;
            const result = a + b;
            // Sync state so PropertyPanel shows actual values
            node.state.a = a;
            node.state.b = b;
            node.state.result = result;
            console.log("[Add] a:", a, "b:", b, "result:", result);
            setOutput("result", result);
            setOutput("exec", true);
        },
    });

    // Subtract Node
    registry.register("math/Subtract", {
        title: "Subtract",
        color: "#f43f5e", // math (rose)
        size: { w: 140 },
        inputs: [
            { name: "a", datatype: "number" },
            { name: "b", datatype: "number" },
        ],
        outputs: [{ name: "result", datatype: "number" }],
        onExecute(node, { getInput, setOutput }) {
            const a = getInput("a") ?? 0;
            const b = getInput("b") ?? 0;
            setOutput("result", a - b);
        },
    });

    // Multiply Node
    registry.register("math/Multiply", {
        title: "Multiply",
        color: "#f43f5e", // math (rose)
        size: { w: 140 },
        inputs: [
            { name: "exec", portType: "exec" },
            { name: "a", portType: "data", datatype: "number" },
            { name: "b", portType: "data", datatype: "number" },
        ],
        outputs: [
            { name: "exec", portType: "exec" },
            { name: "result", portType: "data", datatype: "number" },
        ],
        onExecute(node, { getInput, setOutput }) {
            const a = getInput("a") ?? node.state?.a ?? 0;
            const b = getInput("b") ?? node.state?.b ?? 0;
            const result = a * b;
            if (node.state) {
                node.state.a = a;
                node.state.b = b;
                node.state.result = result;
            }
            console.log("[Multiply] a:", a, "b:", b, "result:", result);
            setOutput("result", result);
            setOutput("exec", true);
        },
    });

    // Divide Node
    registry.register("math/Divide", {
        title: "Divide",
        color: "#f43f5e", // math (rose)
        size: { w: 140 },
        inputs: [
            { name: "a", datatype: "number" },
            { name: "b", datatype: "number" },
        ],
        outputs: [{ name: "result", datatype: "number" }],
        onExecute(node, { getInput, setOutput }) {
            const a = getInput("a") ?? 0;
            const b = getInput("b") ?? 1;
            setOutput("result", b !== 0 ? a / b : 0);
        },
    });
}
