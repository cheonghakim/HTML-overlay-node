import { describe, it, expect, beforeEach } from "vitest";
import { Graph } from "./Graph.js";
import { Registry } from "./Registry.js";
import { createHooks } from "./Hooks.js";

describe("Graph", () => {
  let graph;
  let registry;
  let hooks;

  beforeEach(() => {
    registry = new Registry();
    hooks = createHooks(["node:create", "edge:create"]);
    graph = new Graph({ hooks, registry });

    // Register a test node type
    registry.register("test/node", {
      title: "Test Node",
      size: { w: 100, h: 50 },
      inputs: [{ name: "in", datatype: "any" }],
      outputs: [{ name: "out", datatype: "any" }],
    });
  });

  describe("constructor", () => {
    it("should create a graph with empty nodes and edges", () => {
      expect(graph.nodes).toBeInstanceOf(Map);
      expect(graph.edges).toBeInstanceOf(Map);
      expect(graph.nodes.size).toBe(0);
      expect(graph.edges.size).toBe(0);
    });

    it("should throw error when registry is missing", () => {
      expect(() => {
        new Graph({ hooks });
      }).toThrow(/requires a registry/);
    });

    it("should initialize GroupManager", () => {
      expect(graph.groupManager).toBeDefined();
    });
  });

  describe("addNode", () => {
    it("should add a node to the graph", () => {
      const node = graph.addNode("test/node", { x: 100, y: 200 });
      expect(node).toBeDefined();
      expect(node.type).toBe("test/node");
      expect(node.title).toBe("Test Node");
      expect(node.pos.x).toBe(100);
      expect(node.pos.y).toBe(200);
      expect(graph.nodes.has(node.id)).toBe(true);
    });

    it("should add inputs and outputs from definition", () => {
      const node = graph.addNode("test/node");
      expect(node.inputs.length).toBe(1);
      expect(node.inputs[0].name).toBe("in");
      expect(node.outputs.length).toBe(1);
      expect(node.outputs[0].name).toBe("out");
    });

    it("should throw error for unknown node type with available types", () => {
      expect(() => {
        graph.addNode("unknown/type");
      }).toThrow(/Available types: test\/node/);
    });

    it("should emit node:create event", () => {
      let emittedNode = null;
      hooks.on("node:create", (node) => {
        emittedNode = node;
      });

      const node = graph.addNode("test/node");
      expect(emittedNode).toBe(node);
    });

    it("should call onCreate callback if defined", () => {
      let onCreateCalled = false;
      registry.register("test/with-oncreate", {
        title: "Test",
        onCreate: (node) => {
          onCreateCalled = true;
          node.state.initialized = true;
        },
      });

      const node = graph.addNode("test/with-oncreate");
      expect(onCreateCalled).toBe(true);
      expect(node.state.initialized).toBe(true);
    });
  });

  describe("getNodeById", () => {
    it("should return node by ID", () => {
      const node = graph.addNode("test/node");
      const found = graph.getNodeById(node.id);
      expect(found).toBe(node);
    });

    it("should return null for non-existent ID", () => {
      const found = graph.getNodeById("non-existent");
      expect(found).toBe(null);
    });
  });

  describe("removeNode", () => {
    it("should remove a node from the graph", () => {
      const node = graph.addNode("test/node");
      graph.removeNode(node.id);
      expect(graph.nodes.has(node.id)).toBe(false);
    });

    it("should remove edges connected to the node", () => {
      const node1 = graph.addNode("test/node");
      const node2 = graph.addNode("test/node");

      const edge = graph.addEdge(
        node1.id,
        node1.outputs[0].id,
        node2.id,
        node2.inputs[0].id
      );

      graph.removeNode(node1.id);
      expect(graph.edges.has(edge.id)).toBe(false);
    });
  });

  describe("addEdge", () => {
    it("should add an edge between two nodes", () => {
      const node1 = graph.addNode("test/node");
      const node2 = graph.addNode("test/node");

      const edge = graph.addEdge(
        node1.id,
        node1.outputs[0].id,
        node2.id,
        node2.inputs[0].id
      );

      expect(edge).toBeDefined();
      expect(edge.fromNode).toBe(node1.id);
      expect(edge.toNode).toBe(node2.id);
      expect(graph.edges.has(edge.id)).toBe(true);
    });

    it("should throw error when source node doesn't exist", () => {
      const node = graph.addNode("test/node");
      expect(() => {
        graph.addEdge("non-existent", "port", node.id, "port");
      }).toThrow(/source node "non-existent" not found/);
    });

    it("should throw error when target node doesn't exist", () => {
      const node = graph.addNode("test/node");
      expect(() => {
        graph.addEdge(node.id, "port", "non-existent", "port");
      }).toThrow(/target node "non-existent" not found/);
    });

    it("should emit edge:create event", () => {
      let emittedEdge = null;
      hooks.on("edge:create", (edge) => {
        emittedEdge = edge;
      });

      const node1 = graph.addNode("test/node");
      const node2 = graph.addNode("test/node");
      const edge = graph.addEdge(
        node1.id,
        node1.outputs[0].id,
        node2.id,
        node2.inputs[0].id
      );

      expect(emittedEdge).toBe(edge);
    });
  });

  describe("clear", () => {
    it("should remove all nodes and edges", () => {
      const node1 = graph.addNode("test/node");
      const node2 = graph.addNode("test/node");
      graph.addEdge(node1.id, node1.outputs[0].id, node2.id, node2.inputs[0].id);

      expect(graph.nodes.size).toBe(2);
      expect(graph.edges.size).toBe(1);

      graph.clear();

      expect(graph.nodes.size).toBe(0);
      expect(graph.edges.size).toBe(0);
    });
  });

  describe("data flow", () => {
    it("should set and get output values", () => {
      const node = graph.addNode("test/node");
      graph.setOutput(node.id, node.outputs[0].id, "test-value");

      graph.swapBuffers();

      const value = graph.getInput(node.id, "any-port");
      expect(value).toBeUndefined(); // No edge connected
    });

    it("should retrieve input value from connected edge", () => {
      const node1 = graph.addNode("test/node");
      const node2 = graph.addNode("test/node");
      graph.addEdge(node1.id, node1.outputs[0].id, node2.id, node2.inputs[0].id);

      graph.setOutput(node1.id, node1.outputs[0].id, "test-value");
      graph.swapBuffers();

      const value = graph.getInput(node2.id, node2.inputs[0].id);
      expect(value).toBe("test-value");
    });
  });

  describe("serialization", () => {
    it("should serialize graph to JSON", () => {
      const node = graph.addNode("test/node", { x: 100, y: 200 });
      const json = graph.toJSON();

      expect(json.nodes).toBeInstanceOf(Array);
      expect(json.nodes.length).toBe(1);
      expect(json.nodes[0].type).toBe("test/node");
      expect(json.nodes[0].x).toBe(100);
      expect(json.nodes[0].y).toBe(200);
      expect(json.edges).toBeInstanceOf(Array);
    });

    it("should deserialize graph from JSON", () => {
      const node1 = graph.addNode("test/node", { x: 100, y: 200 });
      const node2 = graph.addNode("test/node", { x: 300, y: 400 });
      const edge = graph.addEdge(
        node1.id,
        node1.outputs[0].id,
        node2.id,
        node2.inputs[0].id
      );

      const json = graph.toJSON();
      graph.clear();

      graph.fromJSON(json);

      expect(graph.nodes.size).toBe(2);
      expect(graph.edges.size).toBe(1);
      expect(graph.getNodeById(node1.id)).toBeDefined();
      expect(graph.getNodeById(node2.id)).toBeDefined();
    });
  });
});
