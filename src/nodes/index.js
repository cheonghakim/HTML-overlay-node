/**
 * Node Packages - Main Export
 * 
 * This module exports all node registration functions.
 * Users can import individual packages or registerAllNodes for convenience.
 * 
 * @example
 * // Import specific packages
 * import { registerMathNodes, registerLogicNodes } from "html-overlay-node/nodes";
 * registerMathNodes(editor.registry);
 * registerLogicNodes(editor.registry);
 * 
 * @example
 * // Import all nodes at once
 * import { registerAllNodes } from "html-overlay-node/nodes";
 * registerAllNodes(editor.registry, editor.hooks);
 */

import { registerMathNodes } from "./math.js";
import { registerLogicNodes } from "./logic.js";
import { registerValueNodes } from "./value.js";
import { registerUtilNodes } from "./util.js";
import { registerCoreNodes } from "./core.js";

export { registerMathNodes } from "./math.js";
export { registerLogicNodes } from "./logic.js";
export { registerValueNodes } from "./value.js";
export { registerUtilNodes } from "./util.js";
export { registerCoreNodes } from "./core.js";

/**
 * Register all example nodes at once
 * @param {Registry} registry - Node registry instance
 * @param {Hooks} hooks - Hooks instance (required for TodoNode)
 */
export function registerAllNodes(registry, hooks) {
    registerMathNodes(registry);
    registerLogicNodes(registry);
    registerValueNodes(registry);
    registerUtilNodes(registry);
    registerCoreNodes(registry, hooks);
}
