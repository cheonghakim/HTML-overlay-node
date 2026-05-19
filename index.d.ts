// Type declarations for html-overlay-node

// ─── Port / Edge / Node primitives ────────────────────────────────────────────

export type PortType = "exec" | "data";
export type DataType = "any" | "number" | "string" | "boolean" | "object" | "array";
export type EdgeStyle = "bezier" | "orthogonal" | "line";
export type ExecMode = "run" | "step";
export type DockSide = "bottom" | "top" | "left" | "right";

export interface PortDef {
  id?: string;
  name: string;
  portType: PortType;
  datatype?: DataType;
  dir?: "in" | "out";
  defaultValue?: unknown;
}

export interface NodeState {
  [key: string]: unknown;
}

export interface NodeSize {
  w: number;
  h: number;
}

export interface NodePos {
  x: number;
  y: number;
}

export interface Node {
  id: string;
  type: string;
  title: string;
  pos: NodePos;
  size: NodeSize;
  inputs: PortDef[];
  outputs: PortDef[];
  state: NodeState;
  color?: string;
  icon?: string;
  [key: string]: unknown;
}

export interface Edge {
  id: string;
  fromNode: string;
  fromPort: string;
  toNode: string;
  toPort: string;
}

// ─── Graph serialization ───────────────────────────────────────────────────────

export interface GraphMeta {
  name?: string;
  description?: string;
  author?: string;
}

export interface GraphJSON {
  version: number;
  meta?: GraphMeta;
  nodes: Partial<Node>[];
  edges: Partial<Edge>[];
}

// ─── Graph ────────────────────────────────────────────────────────────────────

export interface Graph {
  nodes: Map<string, Node>;
  edges: Map<string, Edge>;
  hooks: Hooks;
  runner?: Runner;
  controller?: Controller;

  addNode(type: string, options?: Partial<Node>): Node;
  removeNode(nodeId: string): void;
  getNodeById(nodeId: string): Node | undefined;
  addEdge(fromNode: string, fromPort: string, toNode: string, toPort: string): Edge;
  removeEdge(edgeId: string): void;
  clear(): void;
  toJSON(): GraphJSON;
  fromJSON(data: GraphJSON): void;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export interface NodeExecuteContext {
  /** Set the value of an output port by port name. */
  setOutput(portName: string, value: unknown): void;
  /** Get the current value of an input port by port name. */
  getInput(portName: string): unknown;
  /** Reference to the parent graph. */
  graph: Graph;
}

export interface NodeHtmlParts {
  body: HTMLElement;
  header?: HTMLElement;
  [key: string]: HTMLElement | undefined;
}

// ─── Property panel widget system ─────────────────────────────────────────────

export type WidgetType = "text" | "number" | "slider" | "toggle" | "select" | "radio" | "checkbox-group" | "color" | "textarea";

export interface SelectOption {
  label: string;
  value: unknown;
}

export interface OnChangeContext {
  controller: Controller;
  graph: Graph;
  /** true during slider drag — no undo entry needed; false on committed change */
  immediate: boolean;
}

export interface PropertyWidget {
  /** Key in node.state to bind. */
  key: string;
  /** Display label. Defaults to key. */
  label?: string;
  /** Widget type. Default: "text". */
  widget?: WidgetType;
  /** Min value (number, slider). */
  min?: number;
  /** Max value (number, slider). */
  max?: number;
  /** Step (number, slider). */
  step?: number;
  /** Options for select widget. */
  options?: (string | SelectOption)[];
  /** Placeholder text (text, textarea). */
  placeholder?: string;
  /** Make the widget read-only (display only). */
  readonly?: boolean;
  /**
   * Called when the value changes.
   * If omitted, the panel automatically calls controller.updateNodeState (undo-safe).
   * When provided, you control what happens — call controller.updateNodeState
   * yourself if you want undo support, or do anything else.
   */
  onChange?(node: Node, value: unknown, ctx: OnChangeContext): void;
}

export interface NodeHtmlDef {
  /** Called once when the HTML element is first created. */
  init(node: Node, el: HTMLElement, parts: NodeHtmlParts & { graph: Graph }): void;
  /** Called on every render to sync node state → DOM. */
  update?(node: Node, el: HTMLElement, parts: NodeHtmlParts): void;
  /** Called when the element is removed. */
  destroy?(node: Node, el: HTMLElement): void;
}

export interface NodeDefinition {
  title?: string;
  color?: string;
  icon?: string;
  size?: { w?: number; h?: number };
  inputs?: PortDef[];
  outputs?: PortDef[];
  /**
   * Declare property panel widgets for this node type.
   * Each entry binds a widget to a node.state key.
   * When present, the property panel renders these instead of the auto-generated state fields.
   */
  properties?: PropertyWidget[];
  /** HTML overlay descriptor. If provided, the node renders an HTML body. */
  html?: NodeHtmlDef;
  /** Called once when a node instance is first created. */
  onCreate?(node: Node): void;
  /** Called every runner tick (run mode) or on each step. */
  onExecute?(node: Node, ctx: NodeExecuteContext): void;
}

export interface Registry {
  /** Register a new node type. Throws if the type is already registered. */
  register(type: string, definition: NodeDefinition): void;
  /** Register or silently replace a node type. Use this to override built-in nodes. */
  registerOrReplace(type: string, definition: NodeDefinition): void;
  /** Remove a single registered type. */
  unregister(type: string): void;
  /** Remove all registered types — use for clean-slate custom-only setups. */
  removeAll(): void;
  get(type: string): NodeDefinition | undefined;
  has(type: string): boolean;
  /** The underlying Map of type → definition. */
  types: Map<string, NodeDefinition>;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export type HookName =
  | "node:create"
  | "node:move"
  | "node:click"
  | "node:dblclick"
  | "node:resize"
  | "node:updated"
  | "edge:create"
  | "edge:delete"
  | "graph:serialize"
  | "graph:deserialize"
  | "group:change"
  | "runner:tick"
  | "runner:start"
  | "runner:stop"
  | "error"
  | string;

export interface Hooks {
  on(event: HookName, handler: (payload?: unknown) => void): void;
  off(event: HookName, handler: (payload?: unknown) => void): void;
  emit(event: HookName, payload?: unknown): void;
}

// ─── Runner ───────────────────────────────────────────────────────────────────

export interface RunOnceResult {
  connectedNodes: Set<string>;
  connectedEdges: Set<string>;
  execEdgeOrder: string[];
}

export interface Runner {
  start(): void;
  stop(): void;
  setExecutionMode(mode: ExecMode): void;
  /** Execute a single node synchronously and return traversal results. */
  runOnce(startNodeId: string, dt?: number): RunOnceResult;
}

// ─── Controller (high-level API) ──────────────────────────────────────────────

export interface AddNodeOptions {
  title?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  state?: NodeState;
}

export interface Controller {
  /** The graph being edited. */
  graph: Graph;
  /** When true, graph mutations are blocked; only pan/zoom work. */
  readOnly: boolean;
  /** Whether snap-to-grid is active (toggle with G key). */
  snapToGrid: boolean;
  /** Grid cell size in pixels. Default: 20. */
  gridSize: number;

  /** Add a node (recorded in undo history). */
  addNode(type: string, options?: AddNodeOptions): Node;
  /** Remove a node by ID (recorded in undo history). */
  removeNode(nodeId: string): void;
  /** Add an edge (recorded in undo history). */
  addEdge(fromNode: string, fromPort: string, toNode: string, toPort: string): void;
  /** Update node state (recorded in undo history). */
  updateNodeState(nodeId: string, newState: NodeState): void;
  /** Update a single node property — title, x, y, width, height (recorded in undo history). */
  updateNodeProperty(nodeId: string, prop: string, value: unknown): void;
  /** Pan + zoom so all nodes fit the viewport. */
  fitToView(): void;
  /** Arrange all nodes in a grid layout. */
  autoLayout(): void;
  /** Undo the last action. */
  undo(): void;
  /** Redo the last undone action. */
  redo(): void;
  /** Force a full redraw of all canvas layers and HTML overlay. */
  render(): void;
}

// ─── SubGraphPanel ────────────────────────────────────────────────────────────

export interface SubGraphPanel {
  /** True when the panel is currently open. */
  readonly isOpen: boolean;
  /** Open the panel for a SubGraph node. */
  open(node: Node, subGraphData: GraphJSON, breadcrumb?: string[]): void;
  /** Close the panel and save edited sub-graph data back to the node. */
  close(): void;
  /** True if the panel is open for the given node ID. */
  isOpenFor(nodeId: string): boolean;
  /** Change which side the panel is docked to. */
  setDock(side: DockSide): void;
}

// ─── Plugin API ───────────────────────────────────────────────────────────────

export interface PluginContext {
  graph: Graph;
  registry: Registry;
  hooks: Hooks;
  runner: Runner;
  controller: Controller;
  contextMenu: ContextMenu;
}

export interface Plugin {
  name?: string;
  options?: Record<string, unknown>;
  install(context: PluginContext, options: Record<string, unknown>): void;
}

// ─── ContextMenu ──────────────────────────────────────────────────────────────

export interface ContextMenuItemDef {
  label: string;
  action(): void;
  disabled?: boolean;
  separator?: boolean;
}

export interface ContextMenu {
  addItem(item: ContextMenuItemDef): void;
  destroy(): void;
}

// ─── createGraphEditor options ────────────────────────────────────────────────

export interface GraphEditorOptions {
  /** Color theme. Default: system preference or "dark". */
  theme?: "dark" | "light";
  /** Custom hooks instance. Created internally if omitted. */
  hooks?: Hooks;
  /** Start the runner automatically after creation. Default: true. */
  autorun?: boolean;
  /** Show the interactive minimap. Default: true. */
  showMinimap?: boolean;
  /** Enable the node property panel (opens on double-click). Default: true. */
  enablePropertyPanel?: boolean;
  /** Container for the property panel. Defaults to the editor container. */
  propertyPanelContainer?: HTMLElement | null;
  /** Show the keyboard shortcut help overlay (?). Default: true. */
  enableHelp?: boolean;
  /** Override shortcut descriptions shown in the help overlay. */
  helpShortcuts?: Record<string, string> | null;
  /** Wire up the built-in right-click context menu. Default: true. */
  setupDefaultContextMenu?: boolean;
  /** Provide a custom context menu setup function called after creation. */
  setupContextMenu?: ((menu: ContextMenu, ctx: { controller: Controller; graph: Graph; hooks: Hooks }) => void) | null;
  /** Plugins to install. Each must implement `install(ctx, options)`. */
  plugins?: Plugin[];
}

// ─── GraphEditor (return value of createGraphEditor) ─────────────────────────

export interface GraphEditor {
  /** The data model. */
  graph: Graph;
  /** Main canvas renderer. Use to change edge style or read transform. */
  renderer: CanvasRenderer;
  /** Edge canvas renderer (shares transform with main renderer). */
  edgeRenderer: CanvasRenderer;
  /** High-level controller — use this for all programmatic mutations. */
  controller: Controller;
  /** The execution engine. */
  runner: Runner;
  /** HTML overlay manager. */
  htmlOverlay: HtmlOverlay;
  /** Node type registry. */
  registry: Registry;
  /** Event bus. */
  hooks: Hooks;
  /** Context menu instance. */
  contextMenu: ContextMenu;
  /** Split-pane sub-graph editor panel (primary name). */
  subGraphPanel: SubGraphPanel;
  /** Alias for subGraphPanel. */
  subNodePanel: SubGraphPanel;
  /** Minimap instance (null if showMinimap: false). */
  minimap: Minimap | null;
  /** Property panel instance (null if enablePropertyPanel: false). */
  propertyPanel: PropertyPanel | null;

  /** Force a full redraw. */
  render(): void;
  /** Start the runner. */
  start(): void;
  /** Stop the runner. */
  stop(): void;
  /** Change the edge rendering style. */
  setEdgeStyle(style: EdgeStyle): void;
  /** Switch between "run" (continuous) and "step" (manual) execution mode. */
  setExecutionMode(mode: ExecMode): void;
  /** Add a group programmatically. */
  addGroup(args?: Record<string, unknown>): void;
  /** Tear down all event listeners, resize observers, and sub-components. */
  destroy(): void;
}

// ─── Supporting renderer / UI types (opaque) ─────────────────────────────────

export interface CanvasRenderer {
  canvas: HTMLCanvasElement;
  scale: number;
  offsetX: number;
  offsetY: number;
  setEdgeStyle(style: EdgeStyle): void;
  resize(width: number, height: number): void;
  zoomAt(factor: number, cx: number, cy: number): void;
}

export interface HtmlOverlay {
  clear(): void;
  destroy(): void;
}

export interface Minimap {
  render(): void;
  destroy(): void;
}

export interface PropertyPanel {
  open(node: Node): void;
  destroy(): void;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Create and mount a graph editor into the given container element or CSS selector.
 *
 * @example
 * ```ts
 * import { createGraphEditor } from "html-overlay-node";
 * import { registerAllNodes } from "html-overlay-node/nodes";
 * import "html-overlay-node/index.css";
 * import "html-overlay-node/src/ui/PropertyPanel.css";
 *
 * const editor = createGraphEditor("#editor", { theme: "dark", showMinimap: true });
 * registerAllNodes(editor.registry, editor.hooks);
 * ```
 */
export function createGraphEditor(
  target: string | HTMLElement | HTMLCanvasElement,
  options?: GraphEditorOptions
): GraphEditor;

// ─── Misc exports ─────────────────────────────────────────────────────────────

export interface IconManager {
  register(name: string, svgPath: string): void;
}

export { IconManager };

// ─── html-overlay-node/nodes ──────────────────────────────────────────────────
// These are re-exported from "html-overlay-node/nodes" sub-path.

export declare function registerMathNodes(registry: Registry, hooks?: Hooks): void;
export declare function registerLogicNodes(registry: Registry, hooks?: Hooks): void;
export declare function registerValueNodes(registry: Registry, hooks?: Hooks): void;
export declare function registerUtilNodes(registry: Registry, hooks?: Hooks): void;
export declare function registerCoreNodes(registry: Registry, hooks?: Hooks): void;
export declare function registerSubGraphNodes(registry: Registry): void;
/** Register all built-in node types at once. */
export declare function registerAllNodes(registry: Registry, hooks?: Hooks): void;

// ─── html-overlay-node/defaults ───────────────────────────────────────────────

export declare function setupDefaultContextMenu(
  menu: ContextMenu,
  ctx: { controller: Controller; graph: Graph; hooks: Hooks }
): void;
