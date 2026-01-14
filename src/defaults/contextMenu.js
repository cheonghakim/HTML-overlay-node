/**
 * Default Context Menu Setup
 * 
 * This module provides the default context menu configuration.
 * Users can import and use this directly, modify it, or create their own.
 * 
 * @example
 * import { setupDefaultContextMenu } from "html-overlay-node/defaults";
 * setupDefaultContextMenu(editor.contextMenu, { controller, graph, hooks });
 */

import { RemoveNodeCmd, ChangeGroupColorCmd } from "../core/commands.js";

/**
 * Setup default context menu items
 * @param {ContextMenu} contextMenu - Context menu instance
 * @param {Object} options - Configuration options
 * @param {Controller} options.controller - Controller instance
 * @param {Graph} options.graph - Graph instance
 * @param {Hooks} options.hooks - Hooks instance
 */
export function setupDefaultContextMenu(contextMenu, { controller, graph, hooks }) {
    // Add Node submenu (canvas background only)
    // Use a function to dynamically generate node types when menu is shown
    const getNodeTypes = () => {
        const nodeTypes = [];
        for (const [key, typeDef] of graph.registry.types.entries()) {
            nodeTypes.push({
                id: `add-${key}`,
                label: typeDef.title || key,
                action: () => {
                    // Get world position from context menu
                    const worldPos = contextMenu.worldPosition || { x: 100, y: 100 };

                    // Add node at click position
                    const node = graph.addNode(key, {
                        x: worldPos.x,
                        y: worldPos.y,
                    });

                    hooks?.emit("node:updated", node);
                    controller.render(); // Update minimap and canvas
                },
            });
        }
        return nodeTypes;
    };

    contextMenu.addItem("add-node", "Add Node", {
        condition: (target) => !target,
        submenu: getNodeTypes, // Pass function instead of array
        order: 5,
    });

    // Delete Node (for all nodes except groups)
    contextMenu.addItem("delete-node", "Delete Node", {
        condition: (target) => target && target.type !== "core/Group",
        action: (target) => {
            const cmd = RemoveNodeCmd(graph, target);
            controller.stack.exec(cmd);
            hooks?.emit("node:updated", target);
        },
        order: 10,
    });

    // Change Group Color (for groups only) - with submenu
    const colors = [
        { name: "Default", color: "#39424e" },
        { name: "Slate", color: "#4a5568" },
        { name: "Gray", color: "#2d3748" },
        { name: "Blue", color: "#1a365d" },
        { name: "Green", color: "#22543d" },
        { name: "Red", color: "#742a2a" },
        { name: "Purple", color: "#44337a" },
    ];

    contextMenu.addItem("change-group-color", "Change Color", {
        condition: (target) => target && target.type === "core/Group",
        submenu: colors.map((colorInfo) => ({
            id: `color-${colorInfo.color}`,
            label: colorInfo.name,
            color: colorInfo.color,
            action: (target) => {
                const currentColor = target.state.color || "#39424e";
                const cmd = ChangeGroupColorCmd(target, currentColor, colorInfo.color);
                controller.stack.exec(cmd);
                hooks?.emit("node:updated", target);
            },
        })),
        order: 20,
    });

    contextMenu.addItem("delete-group", "Delete Group", {
        condition: (target) => target && target.type === "core/Group",
        action: (target) => {
            const cmd = RemoveNodeCmd(graph, target);
            controller.stack.exec(cmd);
            hooks?.emit("node:updated", target);
        },
        order: 20,
    });
}
