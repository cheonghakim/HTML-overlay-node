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
export function animateInPanel(subCtrl, executionSteps, execEdgeOrder, _connectedNodes, _graph, _startTime = performance.now(), onComplete = null) {
  const steps = executionSteps || execEdgeOrder.map(edgeId => ({ nodeId: _graph.edges.get(edgeId)?.toNode, edgeId }));

  subCtrl.activeEdgeTimes = new Map();

  const runSubStep = (stepIdx) => {
    if (stepIdx >= steps.length) {
      subCtrl.activeEdges = new Set();
      subCtrl.activeNodes = new Set();
      subCtrl.activeEdgeTimes = new Map();
      subCtrl.render();
      onComplete?.();
      return;
    }

    const s = steps[stepIdx];
    const activeEdgeNow = new Set();
    const activeNodeNow = new Set();

    if (s.nodeId) activeNodeNow.add(s.nodeId);
    // Show outgoing edge (next step's incoming = current node's outgoing)
    const outEdgeId = steps[stepIdx + 1]?.edgeId;
    if (outEdgeId) {
      activeEdgeNow.add(outEdgeId);
      if (!subCtrl.activeEdgeTimes.has(outEdgeId)) {
        subCtrl.activeEdgeTimes.set(outEdgeId, performance.now());
      }
    }

    subCtrl.activeEdges = activeEdgeNow;
    subCtrl.activeNodes = activeNodeNow;

    const stepEnd = performance.now() + STEP_DURATION;
    const stepRaf = () => {
      subCtrl.render(performance.now());
      if (performance.now() < stepEnd) {
        requestAnimationFrame(stepRaf);
      } else {
        runSubStep(stepIdx + 1);
      }
    };
    requestAnimationFrame(stepRaf);
  };

  runSubStep(0);
}

/** Trigger nested sub-graph animation. */
export function triggerSubGraphAnimation(node, mainGraph, startTime = performance.now(), onComplete = null) {
  const subPanel = mainGraph?.controller?.subNodePanel;
  if (!subPanel || !subPanel.isOpenFor(node.id) || !subPanel._controller) return;

  const result = node._subGraphResult;
  if (!result) return;

  const subCtrl = subPanel._controller;
  const steps = result.executionSteps || [];
  if (steps.length > 0 || result.execEdgeOrder?.length > 0) {
    animateInPanel(subCtrl, result.executionSteps, result.execEdgeOrder, result.connectedNodes, subPanel._graph, startTime, onComplete);
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
      onComplete?.();
    }, 800);
  } else {
    onComplete?.();
  }
}

export function registerSubGraphNodes(registry) {
  registry.register("util/SubGraph", {
    title: "Sub Graph",
    color: "#7c3aed",
    icon: "subgraph",
    size: { w: 170, h: 76 },
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

    html: {
      init(node, el, { body, graph }) {
        el.classList.add('node-overlay');
        Object.assign(body.style, {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px 10px',
        });

        const btn = document.createElement('button');
        btn.className = 'premium-button';
        Object.assign(btn.style, {
          width: '100%',
          fontSize: '10px',
          letterSpacing: '0.6px',
          textTransform: 'uppercase',
        });
        btn.textContent = '▶  Open Sub-Playbook';

        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const panel = graph?.controller?.subNodePanel;
          if (!panel) return;
          panel.toggle(node, node.state.subGraphData, ['메인 그래프', node.title]);
        });

        body.appendChild(btn);
        el._graphRef = graph;
        el._openBtn = btn;
      },

      update(node, el) {
        if (!el._openBtn || !el._graphRef) return;
        const panel = el._graphRef?.controller?.subNodePanel;
        if (!panel) {
          el._openBtn.style.opacity = '0.4';
          el._openBtn.style.pointerEvents = 'none';
          return;
        }
        el._openBtn.style.opacity = '';
        el._openBtn.style.pointerEvents = '';
        const isOpen = panel.isOpenFor(node.id);
        el._openBtn.textContent = isOpen ? '▼  Close Sub-Playbook' : '▶  Open Sub-Playbook';
        el._openBtn.style.background = isOpen ? 'rgba(124,58,237,0.22)' : '';
        el._openBtn.style.borderColor = isOpen ? 'rgba(124,58,237,0.55)' : '';
        el._openBtn.style.color = isOpen ? '#a78bfa' : '';
      },
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
      node._subGraphResult = result;

      setOutput("", true);
    },
  });
}
