// src/nodes/threeD.js

export function registerThreeDNodes(registry, hooks) {
  // ── 3D Geometry Node ────────────────────────────────────────────────
  registry.register("3d/Geometry", {
    title: "3D Shape",
    color: "#06b6d4", // cyan
    size: { w: 180 },
    inputs: [
      { name: "exec", portType: "exec" }
    ],
    outputs: [
      { name: "exec", portType: "exec" },
      { name: "geometry", portType: "data", datatype: "object" }
    ],
    properties: [
      { key: "shape", label: "Shape", widget: "select", options: ["cube", "pyramid", "sphere"] },
      { key: "size", label: "Scale Size", widget: "slider", min: 10, max: 200, step: 1 }
    ],
    onCreate(node) {
      node.state.shape = node.state.shape || "cube";
      node.state.size = node.state.size ?? 80;
    },
    html: {
      init(node, el, { body, graph }) {
        el.style.width = "180px";
        const wrapper = document.createElement("div");
        wrapper.className = "node-custom-ui";
        wrapper.style.padding = "40px 10px 12px 10px";
        wrapper.style.pointerEvents = "auto";
        wrapper.addEventListener("mousedown", (e) => e.stopPropagation());

        // Shape selector
        const select = document.createElement("select");
        select.className = "node-select";
        select.style.width = "100%";
        select.style.marginBottom = "6px";
        ["cube", "pyramid", "sphere"].forEach(s => {
          const opt = document.createElement("option");
          opt.value = s;
          opt.textContent = s.toUpperCase();
          opt.selected = node.state.shape === s;
          select.appendChild(opt);
        });
        select.addEventListener("change", () => {
          graph.controller.updateNodeState(node.id, { ...node.state, shape: select.value });
        });

        // Size slider
        const slider = document.createElement("input");
        slider.type = "range";
        slider.className = "node-slider";
        slider.min = "10";
        slider.max = "200";
        slider.value = node.state.size;
        slider.style.width = "100%";
        slider.addEventListener("input", () => {
          graph.controller.updateNodeState(node.id, { ...node.state, size: Number(slider.value) });
        });

        wrapper.appendChild(select);
        wrapper.appendChild(slider);
        body.appendChild(wrapper);
      },
      update(node, el, { body }) {
        const select = body.querySelector("select");
        if (select) select.value = node.state.shape;

        const slider = body.querySelector("input[type='range']");
        if (slider) slider.value = node.state.size;
      }
    },
    onExecute(node, { setOutput }) {
      const s = node.state.size;
      let vertices = [];
      let edges = [];

      if (node.state.shape === "cube") {
        vertices = [
          { x: -s, y: -s, z: -s },
          { x:  s, y: -s, z: -s },
          { x:  s, y:  s, z: -s },
          { x: -s, y:  s, z: -s },
          { x: -s, y: -s, z:  s },
          { x:  s, y: -s, z:  s },
          { x:  s, y:  s, z:  s },
          { x: -s, y:  s, z:  s }
        ];
        edges = [
          [0, 1], [1, 2], [2, 3], [3, 0], // front face
          [4, 5], [5, 6], [6, 7], [7, 4], // back face
          [0, 4], [1, 5], [2, 6], [3, 7]  // links
        ];
      } else if (node.state.shape === "pyramid") {
        vertices = [
          { x: -s, y:  s, z: -s },
          { x:  s, y:  s, z: -s },
          { x:  s, y:  s, z:  s },
          { x: -s, y:  s, z:  s },
          { x:  0, y: -s, z:  0 } // peak
        ];
        edges = [
          [0, 1], [1, 2], [2, 3], [3, 0], // base
          [0, 4], [1, 4], [2, 4], [3, 4]  // sides
        ];
      } else {
        // Sphere (wireframe rings)
        const rings = 6;
        const segments = 12;
        for (let i = 0; i <= rings; i++) {
          const theta = (i * Math.PI) / rings;
          const sinTheta = Math.sin(theta);
          const cosTheta = Math.cos(theta);

          for (let j = 0; j < segments; j++) {
            const phi = (j * 2 * Math.PI) / segments;
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);

            vertices.push({
              x: s * sinTheta * cosPhi,
              y: s * cosTheta,
              z: s * sinTheta * sinPhi
            });
          }
        }
        // Wireframe edges
        for (let i = 0; i < rings; i++) {
          for (let j = 0; j < segments; j++) {
            const i1 = i * segments + j;
            const i2 = i1 + segments;
            const jNext = (j + 1) % segments;
            const i3 = i * segments + jNext;

            edges.push([i1, i2]); // vertical line
            edges.push([i1, i3]); // horizontal line
          }
        }
      }

      setOutput("geometry", { vertices, edges });
      setOutput("exec", true);
    }
  });

  // ── 3D Transform Node ──────────────────────────────────────────────
  registry.register("3d/Transform", {
    title: "3D Transform",
    color: "#06b6d4",
    size: { w: 180 },
    inputs: [
      { name: "exec", portType: "exec" },
      { name: "geometry", portType: "data", datatype: "object" },
      { name: "rotation_x", portType: "data", datatype: "number" },
      { name: "rotation_y", portType: "data", datatype: "number" },
      { name: "rotation_z", portType: "data", datatype: "number" }
    ],
    outputs: [
      { name: "exec", portType: "exec" },
      { name: "geometry", portType: "data", datatype: "object" }
    ],
    properties: [
      { key: "rx", label: "Rot X", widget: "slider", min: -180, max: 180, step: 1 },
      { key: "ry", label: "Rot Y", widget: "slider", min: -180, max: 180, step: 1 },
      { key: "rz", label: "Rot Z", widget: "slider", min: -180, max: 180, step: 1 }
    ],
    onCreate(node) {
      node.state.rx = node.state.rx ?? 0;
      node.state.ry = node.state.ry ?? 0;
      node.state.rz = node.state.rz ?? 0;
    },
    html: {
      init(node, el, { body, graph }) {
        el._graph = graph;
        el.style.width = "180px";
        const wrapper = document.createElement("div");
        wrapper.className = "node-custom-ui";
        wrapper.style.padding = "108px 10px 12px 10px";
        wrapper.style.pointerEvents = "auto";
        wrapper.style.display = "flex";
        wrapper.style.flexDirection = "column";
        wrapper.style.gap = "4px";
        wrapper.addEventListener("mousedown", (e) => e.stopPropagation());

        // Generate sliders for Rot X, Y, Z
        ["rx", "ry", "rz"].forEach(k => {
          const row = document.createElement("div");
          row.style.display = "flex";
          row.style.alignItems = "center";
          row.style.gap = "6px";

          const label = document.createElement("span");
          label.textContent = k.substring(1).toUpperCase();
          label.style.fontSize = "9px";
          label.style.color = "#999";
          label.style.width = "12px";

          const slider = document.createElement("input");
          slider.type = "range";
          slider.className = "node-slider";
          slider.min = "-180";
          slider.max = "180";
          slider.value = node.state[k];
          slider.style.flex = "1";
          slider.addEventListener("input", () => {
            node.state[k] = Number(slider.value);
          });

          row.appendChild(label);
          row.appendChild(slider);
          wrapper.appendChild(row);
        });

        body.appendChild(wrapper);
      },
      update(node, el, { body }) {
        const sliders = body.querySelectorAll("input");
        const keys = ["rx", "ry", "rz"];
        const ports = ["rotation_x", "rotation_y", "rotation_z"];
        const graph = el._graph || window.editor.graph;

        sliders.forEach((slider, idx) => {
          const port = node.inputs.find(p => p.name === ports[idx] && p.portType === "data");
          const isConnected = port ? Array.from(graph.edges.values()).some(e => e.toNode === node.id && e.toPort === port.id) : false;

          slider.disabled = isConnected;
          slider.style.opacity = isConnected ? "0.35" : "1";
          slider.value = node.state[keys[idx]];
        });
      }
    },
    onExecute(node, { getInput, setOutput }) {
      const geom = getInput("geometry");
      if (!geom || !geom.vertices) {
        setOutput("exec", true);
        return;
      }

      // Auto-rotate if not connected to ports to make the viewer feel alive
      if (getInput("rotation_x") === undefined) {
        node.state.rx = (node.state.rx + 1) % 360;
      }
      if (getInput("rotation_y") === undefined) {
        node.state.ry = (node.state.ry + 1.5) % 360;
      }
      if (getInput("rotation_z") === undefined) {
        node.state.rz = (node.state.rz + 0.5) % 360;
      }

      // Convert angles to radians
      const rx = ((getInput("rotation_x") ?? node.state.rx) * Math.PI) / 180;
      const ry = ((getInput("rotation_y") ?? node.state.ry) * Math.PI) / 180;
      const rz = ((getInput("rotation_z") ?? node.state.rz) * Math.PI) / 180;

      // Transform vertices
      const cosX = Math.cos(rx), sinX = Math.sin(rx);
      const cosY = Math.cos(ry), sinY = Math.sin(ry);
      const cosZ = Math.cos(rz), sinZ = Math.sin(rz);

      const transformedVertices = geom.vertices.map(v => {
        let x = v.x;
        let y = v.y;
        let z = v.z;

        // Rotate X
        let y1 = y * cosX - z * sinX;
        let z1 = y * sinX + z * cosX;

        // Rotate Y
        let x2 = x * cosY + z1 * sinY;
        let z2 = -x * sinY + z1 * cosY;

        // Rotate Z
        let x3 = x2 * cosZ - y1 * sinZ;
        let y3 = x2 * sinZ + y1 * cosZ;

        return { x: x3, y: y3, z: z2 };
      });

      setOutput("geometry", { vertices: transformedVertices, edges: geom.edges });
      setOutput("exec", true);
    }
  });

  // ── 3D Viewer Node ──────────────────────────────────────────────────
  registry.register("3d/Viewer", {
    title: "3D Viewer",
    color: "#06b6d4",
    inputs: [
      { name: "exec", portType: "exec" },
      { name: "geometry", portType: "data", datatype: "object" }
    ],
    outputs: [
      { name: "exec", portType: "exec" }
    ],
    onExecute(node, { getInput, setOutput }) {
      const geom = getInput("geometry");
      if (window.PreviewWindowInstance && geom) {
        window.PreviewWindowInstance.set3DGeometry(geom);
      }
      setOutput("exec", true);
    }
  });
}
