// src/groups/GroupManager.js


export class GroupManager {
  constructor({ graph, hooks }) {
    this.graph = graph;
    this.hooks = hooks;
    this._groups = [];
  }

  // ---------- CRUD ----------
  addGroup({
    title = "Group",
    x = 0,
    y = 0,
    width = 240,
    height = 160,
    color = "#39424e",
    members = [],
  } = {}) {
    // Validate parameters
    if (width < 100 || height < 60) {
      console.warn("Group size too small, using minimum size");
      width = Math.max(100, width);
      height = Math.max(60, height);
    }

    const groupNode = this.graph.addNode("core/Group", {
      title,
      x,
      y,
      width,
      height,
    });
    groupNode.state.color = color;

    // Reparent members with validation
    for (const memberId of members) {
      const node = this.graph.getNodeById(memberId);
      if (node) {
        if (node.type === "core/Group") {
          console.warn(`Cannot add group ${memberId} as member of another group`);
          continue;
        }
        this.graph.reparent(node, groupNode);
      } else {
        console.warn(`Member node ${memberId} not found, skipping`);
      }
    }

    this._groups.push(groupNode);
    this.hooks?.emit("group:change");
    return groupNode;
  }

  addGroupFromSelection({ title = "Group", margin = { x: 12, y: 12 } } = {}) {
    // Controller에서 selection을 받아와야 함
    // 여기서는 간단히 graph.nodes를 순회하며 selected 상태를 확인한다고 가정하거나
    // 외부에서 members를 넘겨받는 것이 좋음
    // 일단은 외부에서 members를 넘겨받는 addGroup을 활용.
    return null;
  }

  removeGroup(id) {
    const groupNode = this.graph.getNodeById(id);
    if (!groupNode || groupNode.type !== "core/Group") return;

    // Ungroup: reparent children to group's parent
    const children = [...groupNode.children];
    for (const child of children) {
      this.graph.reparent(child, groupNode.parent);
    }

    this.graph.removeNode(id);
    this.hooks?.emit("group:change");
  }

  // ---------- 이동/리사이즈 ----------
  // 이제 Node의 이동/리사이즈 로직을 따름.
  // Controller에서 Node 이동 시 updateWorldTransforms가 호출되므로 자동 처리됨.

  resizeGroup(id, dw, dh) {
    const g = this.graph.getNodeById(id);
    if (!g || g.type !== "core/Group") return;

    const minW = 100;
    const minH = 60;
    g.size.width = Math.max(minW, g.size.width + dw);
    g.size.height = Math.max(minH, g.size.height + dh);

    this.graph.updateWorldTransforms();
    this.hooks?.emit("group:change");
  }

  // ---------- 히트테스트 & 드래그 ----------
  // 이제 Group도 Node이므로 Controller의 Node 히트테스트 로직을 따름.
  // 단, Resize Handle은 별도 처리가 필요할 수 있음.

  hitTestResizeHandle(x, y) {
    const handleSize = 10;
    // 역순 순회 (위에 있는 것부터)
    const nodes = [...this.graph.nodes.values()].reverse();

    for (const node of nodes) {
      if (node.type !== "core/Group") continue;

      // World Transform 사용
      const { x: gx, y: gy, w: gw, h: gh } = node.computed;

      if (x >= gx + gw - handleSize && x <= gx + gw && y >= gy + gh - handleSize && y <= gy + gh) {
        return { group: node, handle: "se" };
      }
    }
    return null;
  }
}
