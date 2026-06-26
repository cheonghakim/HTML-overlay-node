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

export function portRect(node, port, idx, dir, layoutMode = "horizontal") {
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

  // Ports centered on node edges (half inside, half outside)
  const portWidth = 12;
  const portHeight = 12;

  if (layoutMode === "vertical") {
    if (dir === "in") {
      const numPorts = node.inputs ? node.inputs.length : 1;
      const x = nx + (width / (numPorts + 1)) * (idx + 1);
      return { x: x - portWidth / 2, y: ny - portHeight / 2, w: portWidth, h: portHeight };
    }
    if (dir === "out") {
      const numPorts = node.outputs ? node.outputs.length : 1;
      const x = nx + (width / (numPorts + 1)) * (idx + 1);
      return { x: x - portWidth / 2, y: ny + height - portHeight / 2, w: portWidth, h: portHeight };
    }
  } else {
    // Fixed spacing sync with CanvasRenderer default header height
    const headerHeight = 22;
    const padding = 8;
    const portSpacing = 20;
    const y = ny + headerHeight + padding + (idx * portSpacing) + portSpacing / 2;

    if (dir === "in") {
      return { x: nx - portWidth / 2, y: y - portHeight / 2, w: portWidth, h: portHeight };
    }
    if (dir === "out") {
      return { x: nx + width - portWidth / 2, y: y - portHeight / 2, w: portWidth, h: portHeight };
    }
  }
}
