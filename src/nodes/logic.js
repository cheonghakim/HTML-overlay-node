/**
 * Logic Nodes Package
 * Provides boolean logic operation nodes
 */

export function registerLogicNodes(registry) {
  // AND Node
  registry.register("logic/AND", {
    title: "AND",
    color: "#e67c73",
    icon: "logic-and",
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
    color: "#e67c73",
    icon: "logic-or",
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
    color: "#e67c73",
    icon: "logic-not",
    size: { w: 120 },
    inputs: [{ name: "in", datatype: "boolean" }],
    outputs: [{ name: "out", datatype: "boolean" }],
    onExecute(node, { getInput, setOutput }) {
      const val = getInput("in") ?? false;
      setOutput("out", !val);
    },
  });

  // Branch Node — conditional exec routing
  registry.register("logic/Branch", {
    title: "Branch",
    color: "#f59e0b",
    icon: "fork",
    size: { w: 140 },
    inputs: [
      { name: "", portType: "exec" },
      { name: "condition", portType: "data", datatype: "boolean" },
    ],
    outputs: [
      { name: "true", portType: "exec" },
      { name: "false", portType: "exec" },
    ],
    onExecute(node, { getInput, setOutput }) {
      const cond = !!getInput("condition");
      setOutput("true", cond);
      setOutput("false", !cond);
    },
  });
}
