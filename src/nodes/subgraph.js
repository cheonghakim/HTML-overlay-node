/**
 * util/SubGraph — node that encapsulates a nested graph.
 *
 * Sub-graph data is stored as graph JSON in node.state.subGraphData.
 * Clicking the expand icon opens the SubGraphPanel split-pane editor.
 * When the panel closes the edited sub-graph is saved back automatically.
 *
 * Execution:
 *   - Finds the entry exec node (first node with an exec-in port and no
 *     incoming exec edges) and runs it via runOnce.
 *   - If the sub-panel is open for this node, the active edges/nodes are
 *     animated inside the panel with a sequential step-through.
 */

import { Graph } from '../core/Graph.js';
import { Runner } from '../core/Runner.js';
import { createHooks } from '../core/Hooks.js';

const SUB_HOOKS = [
  'node:create', 'node:move', 'node:click', 'node:dblclick',
  'edge:create', 'edge:delete', 'graph:serialize', 'graph:deserialize',
  'error', 'runner:tick', 'runner:start', 'runner:stop',
  'node:resize', 'group:change', 'node:updated',
];

const STEP_DURATION = 600; // ms per exec edge in animation

/** Find the first exec node that has no incoming exec edges (= graph entry). */
function findEntryNode(graph) {
  for (const node of graph.nodes.values()) {
    const hasExecIn = node.inputs.some(p => p.portType === 'exec');
    if (!hasExecIn) continue;
    const hasIncoming = [...graph.edges.values()].some(e => {
      if (e.toNode !== node.id) return false;
      const port = node.inputs.find(p => p.id === e.toPort);
      return port?.portType === 'exec';
    });
    if (!hasIncoming) return node.id;
  }
  // Fallback: very first node
  return graph.nodes.keys().next().value ?? null;
}

/** Animate exec-edge traversal sequentially in the sub-panel controller. */
function animateInPanel(subCtrl, execEdgeOrder, connectedNodes, graph, startTime = performance.now()) {
  const totalDuration = execEdgeOrder.length * STEP_DURATION + 80;

  subCtrl.activeEdgeTimes = new Map();

  const tick = () => {
    const now = performance.now();
    const elapsed = now - startTime;
    const step = Math.floor(elapsed / STEP_DURATION);

    const activeEdgeNow = new Set();
    const activeNodeNow = new Set();

    if (step < execEdgeOrder.length) {
      const edgeId = execEdgeOrder[step];
      activeEdgeNow.add(edgeId);
      if (!subCtrl.activeEdgeTimes.has(edgeId)) {
        subCtrl.activeEdgeTimes.set(edgeId, startTime + step * STEP_DURATION);
      }
      const edge = graph.edges.get(edgeId);
      if (edge?.toNode) activeNodeNow.add(edge.toNode);
    }

    subCtrl.activeEdges = activeEdgeNow;
    subCtrl.activeNodes = activeNodeNow;
    subCtrl.render();

    if (elapsed < totalDuration) {
      requestAnimationFrame(tick);
    } else {
      subCtrl.activeEdges = new Set();
      subCtrl.activeNodes = new Set();
      subCtrl.activeEdgeTimes = new Map();
      subCtrl.render();
    }
  };

  requestAnimationFrame(tick);
}

export function registerSubGraphNodes(registry) {
  registry.register("util/SubGraph", {
    title: "Sub Graph",
    color: "#7c3aed",
    icon: "expand",
    size: { w: 170 },
    inputs:  [{ name: "", portType: "exec" }],
    outputs: [{ name: "", portType: "exec" }],

    onCreate(node) {
      if (!node.state.subGraphData) {
        node.state.subGraphData = {
          version: 2,
          meta: { name: node.title },
          nodes: [], edges: [],
        };
      }
    },

    onExecute(node, { setOutput, graph: mainGraph }) {
      const subPanel = mainGraph?.controller?.subNodePanel;
      const panelOpen = subPanel?.isOpenFor(node.id);

      // ── Choose execution graph ──────────────────────────────────
      let execGraph, execRunner;

      if (panelOpen && subPanel._graph?.nodes?.size > 0) {
        execGraph  = subPanel._graph;
        execRunner = subPanel._runner;
      } else {
        // Headless execution from saved data
        const data = node.state.subGraphData;
        if (!data?.nodes?.length) {
          setOutput("", true);
          return;
        }
        const dataStr = JSON.stringify(data);
        if (!node._subGraph || node._subGraphHash !== dataStr) {
          const hooks = createHooks(SUB_HOOKS);
          const g = new Graph({ hooks, registry });
          try {
            g.fromJSON(data);
          } catch (error) {
            mainGraph?.hooks?.emit?.("error", error);
            setOutput("", true);
            return;
          }
          node._subGraph   = g;
          node._subRunner  = new Runner({ graph: g, registry, hooks });
          node._subGraphHash = dataStr;
        }
        execGraph  = node._subGraph;
        execRunner = node._subRunner;
      }

      if (!execGraph || !execRunner) { setOutput("", true); return; }

      // ── Execute ─────────────────────────────────────────────────
      const entryId = findEntryNode(execGraph);
      if (!entryId) { setOutput("", true); return; }

      const result = execRunner.runOnce(entryId, 0);

      // ── Animate in panel ─────────────────────────────────────────
      // Capture start time here so sub-graph animation is aligned with
      // the outer animation (both start when the trigger fires).
      if (panelOpen && subPanel._controller) {
        const subCtrl = subPanel._controller;
        if (result.execEdgeOrder?.length > 0) {
          // Pass a shared startTime so the outer and inner animations are in sync
          animateInPanel(subCtrl, result.execEdgeOrder, result.connectedNodes, execGraph, performance.now());
        } else if (result.connectedEdges?.size > 0) {
          // Data-only flow: light everything at once
          subCtrl.activeEdges = result.connectedEdges;
          subCtrl.activeNodes = result.connectedNodes;
          const now = performance.now();
          subCtrl.activeEdgeTimes = new Map();
          for (const id of result.connectedEdges) subCtrl.activeEdgeTimes.set(id, now);
          subCtrl.render();
          setTimeout(() => {
            subCtrl.activeEdges = new Set();
            subCtrl.activeNodes = new Set();
            subCtrl.render();
          }, 800);
        }
      }

      setOutput("", true);
    },
  });
}
