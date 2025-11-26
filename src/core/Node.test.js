import { describe, it, expect, beforeEach } from "vitest";
import { Node } from "./Node.js";

describe("Node", () => {
  describe("constructor", () => {
    it("should create a node with default values", () => {
      const node = new Node({ type: "test/node" });
      expect(node.type).toBe("test/node");
      expect(node.title).toBe("test/node");
      expect(node.pos).toEqual({ x: 0, y: 0 });
      expect(node.size).toEqual({ width: 160, height: 60 });
      expect(node.inputs).toEqual([]);
      expect(node.outputs).toEqual([]);
      expect(node.state).toEqual({});
      expect(node.id).toBeDefined();
    });

    it("should create a node with custom values", () => {
      const node = new Node({
        id: "custom-id",
        type: "test/node",
        title: "Custom Title",
        x: 100,
        y: 200,
        width: 300,
        height: 400,
      });
      expect(node.id).toBe("custom-id");
      expect(node.type).toBe("test/node");
      expect(node.title).toBe("Custom Title");
      expect(node.pos).toEqual({ x: 100, y: 200 });
      expect(node.size).toEqual({ width: 300, height: 400 });
    });

    it("should throw error when type is missing", () => {
      expect(() => {
        new Node({});
      }).toThrow(/type is required/);
    });

    it("should initialize tree structure", () => {
      const node = new Node({ type: "test/node" });
      expect(node.parent).toBe(null);
      expect(node.children).toBeInstanceOf(Set);
      expect(node.children.size).toBe(0);
      expect(node.computed).toEqual({ x: 0, y: 0, w: 0, h: 0 });
    });
  });

  describe("addInput", () => {
    let node;

    beforeEach(() => {
      node = new Node({ type: "test/node" });
    });

    it("should add an input port", () => {
      const port = node.addInput("test", "number");
      expect(port.name).toBe("test");
      expect(port.datatype).toBe("number");
      expect(port.dir).toBe("in");
      expect(port.id).toBeDefined();
      expect(node.inputs).toContain(port);
      expect(node.inputs.length).toBe(1);
    });

    it("should default datatype to 'any'", () => {
      const port = node.addInput("test");
      expect(port.datatype).toBe("any");
    });

    it("should throw error when name is missing", () => {
      expect(() => {
        node.addInput("");
      }).toThrow(/must be a non-empty string/);
    });

    it("should throw error when name is not a string", () => {
      expect(() => {
        node.addInput(null);
      }).toThrow(/must be a non-empty string/);
    });
  });

  describe("addOutput", () => {
    let node;

    beforeEach(() => {
      node = new Node({ type: "test/node" });
    });

    it("should add an output port", () => {
      const port = node.addOutput("result", "string");
      expect(port.name).toBe("result");
      expect(port.datatype).toBe("string");
      expect(port.dir).toBe("out");
      expect(port.id).toBeDefined();
      expect(node.outputs).toContain(port);
      expect(node.outputs.length).toBe(1);
    });

    it("should default datatype to 'any'", () => {
      const port = node.addOutput("result");
      expect(port.datatype).toBe("any");
    });

    it("should throw error when name is missing", () => {
      expect(() => {
        node.addOutput("");
      }).toThrow(/must be a non-empty string/);
    });
  });
});
