// src/core/commands.js
import { Edge } from "./Edge.js";
import { deepClone } from "../utils/utils.js";

// Find an edge id by its endpoints (fallback for undo)
function findEdgeId(graph, a, b, c, d) {
  for (const [id, e] of graph.edges) {
    if (
      e.fromNode === a &&
      e.fromPort === b &&
      e.toNode === c &&
      e.toPort === d
    )
      return id;
  }
  return null;
}

export function MoveNodeCmd(node, fromPos, toPos) {
  return {
    do() {
      node.pos = { ...toPos };
    },
    undo() {
      node.pos = { ...fromPos };
    },
  };
}

export function MoveNodesCmd(nodesInfo) {
  // nodesInfo: Array<{ node, fromPos, toPos }>
  return {
    do() {
      for (const { node, toPos } of nodesInfo) {
        node.pos = { ...toPos };
      }
    },
    undo() {
      for (const { node, fromPos } of nodesInfo) {
        node.pos = { ...fromPos };
      }
    },
  };
}

/** Returns "exec"|"data"|null for a port given its node and direction */
function portTypeOf(graph, nodeId, portId, dir) {
  const node = graph.nodes.get(nodeId);
  if (!node) return null;
  const list = dir === "out" ? node.outputs : node.inputs;
  return list.find(p => p.id === portId)?.portType ?? null;
}

/** Returns the data-type ("any", "number", …) of a port */
function dataTypeOf(graph, nodeId, portId, dir) {
  const node = graph.nodes.get(nodeId);
  if (!node) return "any";
  const list = dir === "out" ? node.outputs : node.inputs;
  return list.find(p => p.id === portId)?.datatype ?? "any";
}

function hasPath(graph, startNodeId, targetNodeId, visited = new Set()) {
  if (startNodeId === targetNodeId) return true;
  visited.add(startNodeId);
  
  for (const edge of graph.edges.values()) {
    if (edge.fromNode === startNodeId) {
      const nextNodeId = edge.toNode;
      if (!visited.has(nextNodeId)) {
        if (hasPath(graph, nextNodeId, targetNodeId, visited)) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Check whether two ports can be connected.
 * Returns { ok: boolean, reason?: string }
 */
export function checkPortCompatibility(graph, fromNode, fromPort, toNode, toPort) {
  // Prevent cycle/circular reference
  if (hasPath(graph, toNode, fromNode)) {
    return { ok: false, reason: "Cyclic connection detected (Loops not allowed)" };
  }

  const fromPT = portTypeOf(graph, fromNode, fromPort, "out");
  const toPT   = portTypeOf(graph, toNode,   toPort,  "in");
  if (fromPT && toPT && fromPT !== toPT) {
    return { ok: false, reason: `Cannot connect ${fromPT} → ${toPT} port` };
  }
  const fromDT = dataTypeOf(graph, fromNode, fromPort, "out");
  const toDT   = dataTypeOf(graph, toNode,   toPort,  "in");
  if (fromDT !== "any" && toDT !== "any" && fromDT !== toDT) {
    return { ok: true, warn: `Type mismatch: ${fromDT} → ${toDT}` };
  }
  return { ok: true };
}

export function AddEdgeCmd(graph, fromNode, fromPort, toNode, toPort) {
  let addedId = null;
  return {
    do() {
      const compat = checkPortCompatibility(graph, fromNode, fromPort, toNode, toPort);
      if (!compat.ok) return; // silently reject incompatible connections
      graph.addEdge(fromNode, fromPort, toNode, toPort);
      addedId = findEdgeId(graph, fromNode, fromPort, toNode, toPort);
    },
    undo() {
      const id =
        addedId ?? findEdgeId(graph, fromNode, fromPort, toNode, toPort);
      if (id != null) graph.edges.delete(id);
    },
  };
}

export function RemoveEdgeCmd(graph, edgeId) {
  const e = graph.edges.get(edgeId);
  if (!e) return null;
  // capture for undo
  const snapshot = new Edge({
    ...e,
    route: deepClone(e.route),
  });
  return {
    do() {
      graph.edges.delete(edgeId);
    },
    undo() {
      graph.edges.set(edgeId, snapshot);
    },
  };
}

// Optional: group multiple commands as one (used for "rewire")
export function CompoundCmd(cmds) {
  return {
    do() {
      cmds.forEach((c) => c?.do());
    },
    undo() {
      [...cmds].reverse().forEach((c) => c?.undo());
    },
  };
}

export function RemoveNodeCmd(graph, node) {
  let removedNode = null;
  let removedEdges = [];

  return {
    do() {
      // Store the node and its connected edges for undo
      removedNode = node;
      removedEdges = graph.edges
        ? [...graph.edges.values()].filter((e) => {
          return e.fromNode === node.id || e.toNode === node.id;
        })
        : [];

      // Remove edges first
      for (const edge of removedEdges) {
        graph.edges.delete(edge.id);
      }
      // Remove the node
      graph.nodes.delete(node.id);
    },

    undo() {
      // Restore node
      if (removedNode) {
        graph.nodes.set(removedNode.id, removedNode);
      }
      // Restore edges
      for (const edge of removedEdges) {
        graph.edges.set(edge.id, edge);
      }
    },
  };
}

export function ResizeNodeCmd(node, fromSize, toSize) {
  return {
    do() {
      node.size.width = toSize.w;
      node.size.height = toSize.h;
    },
    undo() {
      node.size.width = fromSize.w;
      node.size.height = fromSize.h;
    },
  };
}

export function ChangeGroupColorCmd(node, fromColor, toColor) {
  return {
    do() {
      node.state.color = toColor;
    },
    undo() {
      node.state.color = fromColor;
    },
  };
}

export function ReparentCmd(graph, node, fromParent, toParent) {
  return {
    do() {
      graph.reparent(node, toParent);
    },
    undo() {
      graph.reparent(node, fromParent);
    },
  };
}

export function ChangeEdgeRouteCmd(graph, edgeId, fromRoute, toRoute) {
  return {
    do() {
      const edge = graph.edges.get(edgeId);
      if (edge) edge.route = deepClone(toRoute);
    },
    undo() {
      const edge = graph.edges.get(edgeId);
      if (edge) edge.route = deepClone(fromRoute);
    },
  };
}

export function AddNodeCmd(graph, type, data) {
  return {
    addedNode: null,
    do() {
      this.addedNode = graph.addNode(type, data);
      if (data.state) this.addedNode.state = deepClone(data.state);
    },
    undo() {
      if (this.addedNode) graph.removeNode(this.addedNode.id);
    },
  };
}

export function AddGroupCmd(groupManager, args) {
  return {
    addedGroup: null,
    do() {
      this.addedGroup = groupManager.addGroup(args);
    },
    undo() {
      if (this.addedGroup) groupManager.removeGroup(this.addedGroup.id);
    },
  };
}

export function RemoveGroupCmd(groupManager, groupNode) {
  // To undo a group removal, we need to recreate it with the same members
  const args = {
    title: groupNode.title,
    x: groupNode.pos.x,
    y: groupNode.pos.y,
    width: groupNode.size.width,
    height: groupNode.size.height,
    color: groupNode.state.color,
    members: [...groupNode.children].map(n => n.id)
  };
  
  return {
    do() {
      groupManager.removeGroup(groupNode.id);
    },
    undo() {
      groupManager.addGroup(args);
    }
  };
}
