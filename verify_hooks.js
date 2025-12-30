import { createHooks } from "./src/core/Hooks.js";

function assert(condition, message) {
    if (!condition) {
        console.error("FAILED:", message);
        process.exit(1);
    }
}

console.log("Testing Hooks.js...");

const hooks = createHooks(["test:event"]);
let count = 0;

console.log("Adding two listeners...");
hooks.on("test:event", () => { count++; console.log("Listener 1 called, count:", count); });
hooks.on("test:event", () => { count++; console.log("Listener 2 called, count:", count); });

console.log("Emitting first time...");
hooks.emit("test:event");
assert(count === 2, "Count should be 2 after first emit, got " + count);

console.log("Emitting second time...");
hooks.emit("test:event");
assert(count === 4, "Count should be 4 after second emit, got " + count);

const listenerToOff = () => { count += 10; console.log("ListenerToOff called, count:", count); };
console.log("Adding listenerToOff...");
hooks.on("test:event", listenerToOff);

console.log("Emitting third time...");
hooks.emit("test:event");
// Original 2 + new + listenerToOff = 4 + 2 + 10 = 16? No, wait.
// Listeners now: L1, L2, L3 (receivedData), L4 (listenerToOff).
// Wait, I didn't add receivedData in this script yet.
// So: L1, L2, L4.
// Count was 4. Emit runs L1, L2, L4.
// L1 runs: count = 5.
// L2 runs: count = 6.
// L4 runs: count = 16.
assert(count === 16, "Count should be 16 after third emit, got " + count);

console.log("Calling hooks.off...");
hooks.off("test:event", listenerToOff);

console.log("Emitting fourth time...");
hooks.emit("test:event");
// Count was 16. Emit runs L1, L2.
// L1 runs: count = 17.
// L2 runs: count = 18.
assert(count === 18, "Count should be 18 after fourth emit, got " + count);

console.log("All manual tests passed!");
