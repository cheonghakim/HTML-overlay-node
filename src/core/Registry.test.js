import { describe, it, expect, beforeEach } from "vitest";
import { Registry } from "./Registry.js";

describe("Registry", () => {
  let registry;

  beforeEach(() => {
    registry = new Registry();
  });

  describe("register", () => {
    it("should register a new node type", () => {
      const def = { title: "Test Node", size: { w: 100, h: 50 } };
      registry.register("test/node", def);
      expect(registry.types.has("test/node")).toBe(true);
      expect(registry.types.get("test/node")).toBe(def);
    });

    it("should throw error when registering duplicate type", () => {
      const def = { title: "Test" };
      registry.register("test/node", def);
      expect(() => {
        registry.register("test/node", def);
      }).toThrow(/already registered/);
    });

    it("should throw error when type is not a string", () => {
      expect(() => {
        registry.register(null, {});
      }).toThrow(/must be a non-empty string/);
    });

    it("should throw error when definition is not an object", () => {
      expect(() => {
        registry.register("test/node", null);
      }).toThrow(/must be an object/);
    });
  });

  describe("unregister", () => {
    it("should unregister an existing type", () => {
      const def = { title: "Test" };
      registry.register("test/node", def);
      registry.unregister("test/node");
      expect(registry.types.has("test/node")).toBe(false);
    });

    it("should throw error when unregistering non-existent type", () => {
      expect(() => {
        registry.unregister("non/existent");
      }).toThrow(/is not registered/);
    });
  });

  describe("removeAll", () => {
    it("should remove all registered types", () => {
      registry.register("test/a", { title: "A" });
      registry.register("test/b", { title: "B" });
      expect(registry.types.size).toBe(2);

      registry.removeAll();
      expect(registry.types.size).toBe(0);
    });
  });

  describe("createInstance", () => {
    it("should return the definition for a registered type", () => {
      const def = { title: "Test" };
      registry.register("test/node", def);
      const instance = registry.createInstance("test/node");
      expect(instance).toBe(def);
    });

    it("should throw error for unknown type with available types listed", () => {
      registry.register("test/a", { title: "A" });
      registry.register("test/b", { title: "B" });
      expect(() => {
        registry.createInstance("unknown");
      }).toThrow(/Available types: test\/a, test\/b/);
    });

    it("should show 'none' when no types are available", () => {
      expect(() => {
        registry.createInstance("unknown");
      }).toThrow(/Available types: none/);
    });
  });
});
