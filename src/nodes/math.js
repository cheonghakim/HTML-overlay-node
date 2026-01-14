/**
 * Math Nodes Package
 * Provides basic mathematical operation nodes
 */

export function registerMathNodes(registry) {
    // Add Node
    registry.register("math/Add", {
        title: "Add",
        size: { w: 140, h: 100 },
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
            const a = getInput("a") ?? 0;
            const b = getInput("b") ?? 0;
            const result = a + b;
            console.log("[Add] a:", a, "b:", b, "result:", result);
            setOutput("result", result);
        },
    });

    // Subtract Node
    registry.register("math/Subtract", {
        title: "Subtract",
        size: { w: 140, h: 80 },
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
        size: { w: 140, h: 100 },
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
            const a = getInput("a") ?? 0;
            const b = getInput("b") ?? 0;
            const result = a * b;
            console.log("[Multiply] a:", a, "b:", b, "result:", result);
            setOutput("result", result);
        },
    });

    // Divide Node
    registry.register("math/Divide", {
        title: "Divide",
        size: { w: 140, h: 80 },
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
