/**
 * Math Nodes Package
 * Provides basic mathematical operation nodes
 */

const MATH_COLOR = "#659fd6"; // vivid rose-red

export function registerMathNodes(registry) {
    registry.register("math/Add", {
        title: "Add",
        color: MATH_COLOR,
        icon: "plus",
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
            node.state.a = a;
            node.state.b = b;
            node.state.result = result;
            setOutput("result", result);
            setOutput("exec", true);
        },
    });

    registry.register("math/Subtract", {
        title: "Subtract",
        color: MATH_COLOR,
        icon: "minus",
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

    registry.register("math/Multiply", {
        title: "Multiply",
        color: MATH_COLOR,
        icon: "times",
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
            setOutput("result", result);
            setOutput("exec", true);
        },
    });

    registry.register("math/Divide", {
        title: "Divide",
        color: MATH_COLOR,
        icon: "divide",
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

    registry.register("math/Clock", {
        title: "Time Clock",
        color: MATH_COLOR,
        icon: "clock",
        size: { w: 140 },
        inputs: [
            { name: "exec", portType: "exec" }
        ],
        outputs: [
            { name: "exec", portType: "exec" },
            { name: "time", portType: "data", datatype: "number" }
        ],
        onCreate(node) {
            node.state.startTime = Date.now();
        },
        onExecute(node, { setOutput }) {
            if (!node.state.startTime) node.state.startTime = Date.now();
            const elapsed = (Date.now() - node.state.startTime) / 1000;
            setOutput("time", elapsed);
            setOutput("exec", true);
        }
    });

    registry.register("math/Sine", {
        title: "Sine Wave",
        color: MATH_COLOR,
        icon: "sin",
        size: { w: 140 },
        inputs: [
            { name: "exec", portType: "exec" },
            { name: "input", portType: "data", datatype: "number" }
        ],
        outputs: [
            { name: "exec", portType: "exec" },
            { name: "result", portType: "data", datatype: "number" }
        ],
        onExecute(node, { getInput, setOutput }) {
            const val = getInput("input") ?? 0;
            setOutput("result", Math.sin(val));
            setOutput("exec", true);
        }
    });
}
