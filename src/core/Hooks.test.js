import { describe, it, expect } from "vitest";
import { createHooks } from "./Hooks.js";

describe("Hooks", () => {
  describe("createHooks", () => {
    it("should create a hooks system with specified events", () => {
      const hooks = createHooks(["test:event", "another:event"]);
      expect(hooks).toBeDefined();
      expect(typeof hooks.on).toBe("function");
      expect(typeof hooks.off).toBe("function");
      expect(typeof hooks.emit).toBe("function");
    });
  });

  describe("on", () => {
    it("should register an event listener", () => {
      const hooks = createHooks(["test:event"]);
      let called = false;
      hooks.on("test:event", () => {
        called = true;
      });
      hooks.emit("test:event");
      expect(called).toBe(true);
    });

    it("should register multiple listeners for same event", () => {
      const hooks = createHooks(["test:event"]);
      let count = 0;
      hooks.on("test:event", () => count++);
      hooks.on("test:event", () => count++);
      hooks.emit("test:event");
      expect(count).toBe(2);
    });

    it("should pass data to listeners", () => {
      const hooks = createHooks(["test:event"]);
      let receivedData = null;
      hooks.on("test:event", (data) => {
        receivedData = data;
      });
      hooks.emit("test:event", { value: 42 });
      expect(receivedData).toEqual({ value: 42 });
    });
  });

  describe("off", () => {
    it("should unregister a specific listener", () => {
      const hooks = createHooks(["test:event"]);
      let count = 0;
      const listener = () => count++;

      hooks.on("test:event", listener);
      hooks.emit("test:event");
      expect(count).toBe(1);

      hooks.off("test:event", listener);
      hooks.emit("test:event");
      expect(count).toBe(1); // Still 1, not 2
    });

    it("should not affect other listeners", () => {
      const hooks = createHooks(["test:event"]);
      let count1 = 0;
      let count2 = 0;
      const listener1 = () => count1++;
      const listener2 = () => count2++;

      hooks.on("test:event", listener1);
      hooks.on("test:event", listener2);

      hooks.off("test:event", listener1);
      hooks.emit("test:event");

      expect(count1).toBe(0);
      expect(count2).toBe(1);
    });
  });

  describe("emit", () => {
    it("should call all registered listeners", () => {
      const hooks = createHooks(["test:event"]);
      const calls = [];
      hooks.on("test:event", () => calls.push(1));
      hooks.on("test:event", () => calls.push(2));
      hooks.on("test:event", () => calls.push(3));

      hooks.emit("test:event");
      expect(calls).toEqual([1, 2, 3]);
    });

    it("should not throw when emitting event with no listeners", () => {
      const hooks = createHooks(["test:event"]);
      expect(() => {
        hooks.emit("test:event");
      }).not.toThrow();
    });

    it("should pass multiple arguments to listeners", () => {
      const hooks = createHooks(["test:event"]);
      let receivedArgs = null;
      hooks.on("test:event", (...args) => {
        receivedArgs = args;
      });
      hooks.emit("test:event", "arg1", "arg2", 123);
      expect(receivedArgs).toEqual(["arg1", "arg2", 123]);
    });
  });
});
