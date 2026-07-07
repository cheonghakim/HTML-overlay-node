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
        const categories = {};
        for (const [key, typeDef] of graph.registry.types.entries()) {
            const parts = key.split("/");
            const categoryRaw = parts.length > 1 ? parts[0] : "Core";
            const category = categoryRaw === "3d" ? "3D" : categoryRaw.charAt(0).toUpperCase() + categoryRaw.slice(1);
            const sublabel = typeDef.title || (parts.length > 1 ? parts[1] : key);

            if (!categories[category]) {
                categories[category] = [];
            }

            categories[category].push({
                id: `add-${key}`,
                label: sublabel,
                action: () => {
                    const worldPos = contextMenu.worldPosition || { x: 100, y: 100 };
                    const node = graph.addNode(key, {
                        x: worldPos.x,
                        y: worldPos.y,
                    });
                    hooks?.emit("node:updated", node);
                    controller.render();
                },
            });
        }

        const submenuItems = [];
        for (const [catName, items] of Object.entries(categories)) {
            submenuItems.push({
                id: `cat-${catName}`,
                label: catName,
                submenu: items,
            });
        }
        // Sort categories alphabetically
        submenuItems.sort((a, b) => a.label.localeCompare(b.label));
        return submenuItems;
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

    // Bypass / Mute options
    contextMenu.addItem("bypass-node", "Bypass Node (Ctrl+B)", {
        condition: (target) => target && target.type !== "core/Group" && target.type !== "core/Reroute" && !target.bypass,
        action: (target) => {
            controller.selection.clear();
            controller.selection.add(target.id);
            controller.toggleBypassSelection();
        },
        order: 12,
    });
    contextMenu.addItem("unbypass-node", "Unbypass Node (Ctrl+B)", {
        condition: (target) => target && target.type !== "core/Group" && target.type !== "core/Reroute" && target.bypass,
        action: (target) => {
            controller.selection.clear();
            controller.selection.add(target.id);
            controller.toggleBypassSelection();
        },
        order: 12,
    });

    contextMenu.addItem("mute-node", "Mute Node (Ctrl+M)", {
        condition: (target) => target && target.type !== "core/Group" && target.type !== "core/Reroute" && !target.mute,
        action: (target) => {
            controller.selection.clear();
            controller.selection.add(target.id);
            controller.toggleMuteSelection();
        },
        order: 13,
    });
    contextMenu.addItem("unmute-node", "Unmute Node (Ctrl+M)", {
        condition: (target) => target && target.type !== "core/Group" && target.type !== "core/Reroute" && target.mute,
        action: (target) => {
            controller.selection.clear();
            controller.selection.add(target.id);
            controller.toggleMuteSelection();
        },
        order: 13,
    });

    // Toggle widgets ↔ input ports
    const getWidgetToggleSubmenu = (target) => {
        if (!target) return [];
        const typeDef = graph.registry.types.get(target.type);
        if (!typeDef || !typeDef.properties) return [];
        
        return typeDef.properties.map((prop) => {
            const hasPort = target.inputs.some(p => p.name === prop.key && p.portType === "data");
            return {
                id: `toggle-widget-port-${prop.key}`,
                label: hasPort ? `Disable Port: ${prop.label}` : `Enable Port: ${prop.label}`,
                action: (target) => {
                    controller.toggleWidgetToPort(target.id, prop.key);
                }
            };
        });
    };

    contextMenu.addItem("toggle-ports", "Toggle Input Ports", {
        condition: (target) => {
            if (!target || target.type === "core/Group" || target.type === "core/Reroute") return false;
            const typeDef = graph.registry.types.get(target.type);
            return typeDef && typeDef.properties && typeDef.properties.length > 0;
        },
        submenu: getWidgetToggleSubmenu,
        order: 15,
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
