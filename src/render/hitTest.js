// src/render/hitTest.js
export function hitTestNode(node, x, y) {
  const {
    x: nx,
    y: ny,
    w: width,
    h: height,
  } = node.computed || {
    x: node.pos.x,
    y: node.pos.y,
    w: node.size.width,
    h: node.size.height,
  };
  return x >= nx && x <= nx + width && y >= ny && y <= ny + height;
}

export function portRect(node, port, idx, dir) {
  const {
    x: nx,
    y: ny,
    w: width,
    h: height,
  } = node.computed || {
    x: node.pos.x,
    y: node.pos.y,
    w: node.size.width,
    h: node.size.height,
  };

  // Fixed spacing
  const headerHeight = 28;
  const y = ny + headerHeight + 10 + idx * 24;

  // Ports centered on node edges (half inside, half outside)
  const portWidth = 12;
  const portHeight = 12;

  if (dir === "in") {
    return { x: nx - portWidth / 2, y: y - portHeight / 2, w: portWidth, h: portHeight };
  }
  if (dir === "out") {
    return { x: nx + width - portWidth / 2, y: y - portHeight / 2, w: portWidth, h: portHeight };
  }
}
