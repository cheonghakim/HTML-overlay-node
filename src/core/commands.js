// src/core/commands.js

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

export function AddEdgeCmd(graph, fromNode, fromPort, toNode, toPort) {
  let addedId = null;
  return {
    do() {
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
  const snapshot = { ...e, route: e.route ? { ...e.route } : null };
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
      if (edge) edge.route = JSON.parse(JSON.stringify(toRoute));
    },
    undo() {
      const edge = graph.edges.get(edgeId);
      if (edge) edge.route = JSON.parse(JSON.stringify(fromRoute));
    },
  };
}

export function AddNodeCmd(graph, type, data) {
  return {
    addedNode: null,
    do() {
      this.addedNode = graph.addNode(type, data);
      if (data.state) this.addedNode.state = JSON.parse(JSON.stringify(data.state));
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
