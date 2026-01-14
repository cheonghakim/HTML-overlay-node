import { Registry } from "./core/Registry.js";
import { createHooks } from "./core/Hooks.js";
import { Graph } from "./core/Graph.js";
import { CanvasRenderer } from "./render/CanvasRenderer.js";
import { Controller } from "./interact/Controller.js";
import { ContextMenu } from "./interact/ContextMenu.js";
import { Runner } from "./core/Runner.js";

import { HtmlOverlay } from "./render/HtmlOverlay.js";
import { RemoveNodeCmd, ChangeGroupColorCmd } from "./core/commands.js";
import { Minimap } from "./minimap/Minimap.js";
import { PropertyPanel } from "./ui/PropertyPanel.js";
import { setupDefaultContextMenu as defaultContextMenuSetup } from "./defaults/contextMenu.js";



export function createGraphEditor(
  target,
  {
    theme,
    hooks: customHooks,
    autorun = true,
    showMinimap = true,
    enablePropertyPanel = true,
    propertyPanelContainer = null,
    setupDefaultContextMenu = true,
    setupContextMenu = null,
    plugins = [],
  } = {}
) {
  let canvas;
  let container;

  if (typeof target === "string") {
    target = document.querySelector(target);
  }

  if (!target) {
    throw new Error("createGraphEditor: target element not found");
  }

  if (target instanceof HTMLCanvasElement) {
    canvas = target;
    container = canvas.parentElement;
  } else {
    container = target;
    canvas = container.querySelector("canvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.style.display = "block";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      container.appendChild(canvas);
    }
  }

  // Ensure container has relative positioning for overlays
  if (getComputedStyle(container).position === "static") {
    container.style.position = "relative";
  }
  const hooks =
    customHooks ??
    createHooks([
      // essential hooks
      "node:create",
      "node:move",
      "node:click",
      "node:dblclick",
      "edge:create",
      "edge:delete",
      "graph:serialize",
      "graph:deserialize",
      "error",
      "runner:tick",
      "runner:start",
      "runner:stop",
      "node:resize",
      "group:change",
      "node:updated",
    ]);
  const registry = new Registry();
  const graph = new Graph({ hooks, registry });
  const renderer = new CanvasRenderer(canvas, { theme, registry });
  // HTML Overlay
  const htmlOverlay = new HtmlOverlay(canvas.parentElement, renderer, registry);

  // Register callback to sync HTML overlay transform when renderer zoom/pan changes
  renderer.setTransformChangeCallback(() => {
    htmlOverlay.syncTransform();
  });

  // Edge Canvas (above HTML overlay, for edge animations)
  const edgeCanvas = document.createElement("canvas");
  edgeCanvas.id = "edge-canvas";
  Object.assign(edgeCanvas.style, {
    position: "absolute",
    top: "0",
    left: "0",
    pointerEvents: "none", // Pass through clicks
    zIndex: "15", // Above HTML overlay (10), below port canvas (20)
  });
  canvas.parentElement.appendChild(edgeCanvas);

  // Create edge renderer (shares transform with main renderer)
  const edgeRenderer = new CanvasRenderer(edgeCanvas, { theme, registry });
  // Sync transform properties with main renderer
  Object.defineProperty(edgeRenderer, 'scale', {
    get() { return renderer.scale; },
    set(v) { renderer.scale = v; }
  });
  Object.defineProperty(edgeRenderer, 'offsetX', {
    get() { return renderer.offsetX; },
    set(v) { renderer.offsetX = v; }
  });
  Object.defineProperty(edgeRenderer, 'offsetY', {
    get() { return renderer.offsetY; },
    set(v) { renderer.offsetY = v; }
  });

  // Port Canvas (above HTML overlay)
  const portCanvas = document.createElement("canvas");
  portCanvas.id = "port-canvas";
  Object.assign(portCanvas.style, {
    position: "absolute",
    top: "0",
    left: "0",
    pointerEvents: "none", // Pass through clicks
    zIndex: "20", // Above edge canvas (15)
  });
  canvas.parentElement.appendChild(portCanvas);

  // Create port renderer (shares transform with main renderer)
  const portRenderer = new CanvasRenderer(portCanvas, { theme, registry });
  portRenderer.setTransform = renderer.setTransform.bind(renderer);
  portRenderer.scale = renderer.scale;
  portRenderer.offsetX = renderer.offsetX;
  portRenderer.offsetY = renderer.offsetY;

  const controller = new Controller({ graph, renderer, hooks, htmlOverlay, edgeRenderer, portRenderer });

  // Create context menu after controller (needs commandStack)
  const contextMenu = new ContextMenu({
    graph,
    hooks,
    renderer,
    commandStack: controller.stack,
  });

  // Connect context menu to controller
  controller.contextMenu = contextMenu;

  // Create minimap if enabled
  let minimap = null;
  if (showMinimap) {
    minimap = new Minimap(container, { graph, renderer });
  }

  // Initialize Property Panel if enabled
  let propertyPanel = null;
  if (enablePropertyPanel) {
    propertyPanel = new PropertyPanel(propertyPanelContainer || container, {
      graph,
      hooks,
      registry,
      render: () => controller.render(),
    });

    // Handle node double-click to open property panel
    hooks.on("node:dblclick", (node) => {
      propertyPanel.open(node);
    });
  }

  const runner = new Runner({ graph, registry, hooks });

  // Attach runner and controller to graph for node access
  // This allows any node (like Trigger) to execute flows without tight coupling
  graph.runner = runner;
  graph.controller = controller;

  hooks.on("runner:tick", ({ time, dt }) => {
    renderer.draw(graph, {
      selection: controller.selection,
      tempEdge: controller.connecting ? controller.renderTempEdge() : null, // 필요시 helper
      running: true,
      time,
      dt,
    });
    htmlOverlay.draw(graph, controller.selection);
  });
  hooks.on("runner:start", () => {
    // 첫 프레임 즉시 렌더
    renderer.draw(graph, {
      selection: controller.selection,
      tempEdge: controller.connecting ? controller.renderTempEdge() : null,
      running: true,
      time: performance.now(),
      dt: 0,
    });
    htmlOverlay.draw(graph, controller.selection);
  });
  hooks.on("runner:stop", () => {
    // 정지 프레임
    renderer.draw(graph, {
      selection: controller.selection,
      tempEdge: controller.connecting ? controller.renderTempEdge() : null,
      running: false,
      time: performance.now(),
      dt: 0,
    });
    htmlOverlay.draw(graph, controller.selection);
  });

  hooks.on("node:updated", () => {
    controller.render();
  });

  // Note: Example nodes have been moved to src/nodes/
  // Users can import and register them selectively:
  // import { registerAllNodes } from "html-overlay-node/nodes";
  // registerAllNodes(registry, hooks);

  // Setup context menu
  if (setupDefaultContextMenu) {
    // Use default context menu setup
    defaultContextMenuSetup(contextMenu, { controller, graph, hooks });
  }

  // Allow custom context menu setup
  if (setupContextMenu) {
    setupContextMenu(contextMenu, { controller, graph, hooks });
  }

  // Install plugins
  if (plugins && plugins.length > 0) {
    for (const plugin of plugins) {
      if (typeof plugin.install === "function") {
        try {
          plugin.install({ graph, registry, hooks, runner, controller, contextMenu }, plugin.options || {});
        } catch (err) {
          console.error(`[createGraphEditor] Failed to install plugin "${plugin.name || 'unknown'}":`, err);
          hooks?.emit?.("error", err);
        }
      } else {
        console.warn(`[createGraphEditor] Plugin "${plugin.name || 'unknown'}" does not have an install() method`);
      }
    }
  }


  // initial render & resize
  renderer.resize(canvas.clientWidth, canvas.clientHeight);
  edgeRenderer.resize(canvas.clientWidth, canvas.clientHeight);
  portRenderer.resize(canvas.clientWidth, canvas.clientHeight);
  controller.render();

  const ro = new ResizeObserver(() => {
    renderer.resize(canvas.clientWidth, canvas.clientHeight);
    edgeRenderer.resize(canvas.clientWidth, canvas.clientHeight);
    portRenderer.resize(canvas.clientWidth, canvas.clientHeight);
    controller.render();
  });
  ro.observe(canvas);

  // Wrap controller.render to update minimap
  const originalRender = controller.render.bind(controller);
  controller.render = function () {
    originalRender();
    if (minimap) {
      minimap.render();
    }
  };

  const api = {
    addGroup: (args = {}) => {
      controller.graph.groupManager.addGroup(args);
      controller.render();
    },
    graph,
    renderer,
    controller, // Expose controller for snap-to-grid access
    runner, // Expose runner for trigger
    minimap, // Expose minimap
    contextMenu,
    hooks, // Expose hooks for event handling
    registry, // Expose registry for node types
    htmlOverlay, // Expose htmlOverlay for clearing/resetting
    propertyPanel, // Expose propertyPanel
    render: () => controller.render(),
    start: () => runner.start(),
    stop: () => runner.stop(),
    destroy: () => {
      runner.stop();
      ro.disconnect();
      controller.destroy();
      htmlOverlay.destroy();
      contextMenu.destroy();
      if (propertyPanel) propertyPanel.destroy();
      if (minimap) minimap.destroy();
    },
  };

  if (autorun) runner.start();
  return api;
}
