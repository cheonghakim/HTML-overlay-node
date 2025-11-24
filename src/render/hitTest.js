// src/render/hitTest.js
export function hitTestNode(node, x, y) {
  const { x: nx, y: ny, w: width, h: height } = node.computed || {
    x: node.pos.x,
    y: node.pos.y,
    w: node.size.width,
    h: node.size.height,
  };
  return x >= nx && x <= nx + width && y >= ny && y <= ny + height;
}

export function portRect(node, port, idx, dir) {
  const { x: nx, y: ny, w: width } = node.computed || {
    x: node.pos.x,
    y: node.pos.y,
    w: node.size.width,
  };
  const pad = 8,
    row = 20;
  const y = ny + 28 + idx * row;
  if (dir === "in") return { x: nx - pad, y, w: pad, h: 14 };
  if (dir === "out") return { x: nx + width, y, w: pad, h: 14 };
}
