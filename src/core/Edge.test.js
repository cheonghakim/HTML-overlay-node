import { describe, it, expect } from "vitest";
import { Edge } from "./Edge.js";

describe("Edge", () => {
  describe("constructor", () => {
    it("should create an edge with all required fields", () => {
      const edge = new Edge({
        fromNode: "node-1",
        fromPort: "port-1",
        toNode: "node-2",
        toPort: "port-2",
      });

      expect(edge.fromNode).toBe("node-1");
      expect(edge.fromPort).toBe("port-1");
      expect(edge.toNode).toBe("node-2");
      expect(edge.toPort).toBe("port-2");
      expect(edge.id).toBeDefined();
    });

    it("should use custom ID if provided", () => {
      const edge = new Edge({
        id: "custom-edge-id",
        fromNode: "node-1",
        fromPort: "port-1",
        toNode: "node-2",
        toPort: "port-2",
      });

      expect(edge.id).toBe("custom-edge-id");
    });

    it("should throw error when fromNode is missing", () => {
      expect(() => {
        new Edge({
          fromPort: "port-1",
          toNode: "node-2",
          toPort: "port-2",
        });
      }).toThrow(/requires fromNode, fromPort, toNode, and toPort/);
    });

    it("should throw error when fromPort is missing", () => {
      expect(() => {
        new Edge({
          fromNode: "node-1",
          toNode: "node-2",
          toPort: "port-2",
        });
      }).toThrow(/requires fromNode, fromPort, toNode, and toPort/);
    });

    it("should throw error when toNode is missing", () => {
      expect(() => {
        new Edge({
          fromNode: "node-1",
          fromPort: "port-1",
          toPort: "port-2",
        });
      }).toThrow(/requires fromNode, fromPort, toNode, and toPort/);
    });

    it("should throw error when toPort is missing", () => {
      expect(() => {
        new Edge({
          fromNode: "node-1",
          fromPort: "port-1",
          toNode: "node-2",
        });
      }).toThrow(/requires fromNode, fromPort, toNode, and toPort/);
    });
  });
});
