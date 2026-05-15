/**
 * Logic Nodes Package
 * Provides boolean logic operation nodes
 */

export function registerLogicNodes(registry) {
  // AND Node
  registry.register("logic/AND", {
    title: "AND",
    color: "#9333ea", // vivid purple
    size: { w: 120 },
    inputs: [
      { name: "exec", portType: "exec" },
      { name: "a", portType: "data", datatype: "boolean" },
      { name: "b", portType: "data", datatype: "boolean" },
    ],
    outputs: [
      { name: "exec", portType: "exec" },
      { name: "result", portType: "data", datatype: "boolean" },
    ],
    onExecute(node, { getInput, setOutput }) {
      const a = getInput("a") ?? false;
      const b = getInput("b") ?? false;
      setOutput("result", a && b);
    },
  });

  // OR Node
  registry.register("logic/OR", {
    title: "OR",
    color: "#9333ea", // vivid purple
    size: { w: 120 },
    inputs: [
      { name: "a", datatype: "boolean" },
      { name: "b", datatype: "boolean" },
    ],
    outputs: [{ name: "result", datatype: "boolean" }],
    onExecute(node, { getInput, setOutput }) {
      const a = getInput("a") ?? false;
      const b = getInput("b") ?? false;
      setOutput("result", a || b);
    },
  });

  // NOT Node
  registry.register("logic/NOT", {
    title: "NOT",
    color: "#9333ea", // vivid purple
    size: { w: 120 },
    inputs: [{ name: "in", datatype: "boolean" }],
    outputs: [{ name: "out", datatype: "boolean" }],
    onExecute(node, { getInput, setOutput }) {
      const val = getInput("in") ?? false;
      setOutput("out", !val);
    },
  });
}
