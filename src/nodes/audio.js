// src/nodes/audio.js

let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    window.audioCtx = audioCtx;
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

export function registerAudioNodes(registry, hooks) {
  // ── Oscillator Node ────────────────────────────────────────────────
  registry.register("audio/Oscillator", {
    title: "Oscillator",
    color: "#a855f7", // purple
    inputs: [
      { name: "exec", portType: "exec" },
      { name: "frequency", portType: "data", datatype: "number" }
    ],
    outputs: [
      { name: "exec", portType: "exec" },
      { name: "signal", portType: "data", datatype: "object" }
    ],
    properties: [
      { key: "waveform", label: "Waveform", widget: "select", options: ["sine", "square", "sawtooth", "triangle"] },
      { key: "frequency", label: "Frequency", widget: "slider", min: 100, max: 2000, step: 1 }
    ],
    onCreate(node) {
      node.state.waveform = node.state.waveform || "sine";
      node.state.frequency = node.state.frequency ?? 440;
    },
    html: {
      init(node, el, { body, graph }) {
        el._graph = graph;
        el.style.width = "180px";
        const wrapper = document.createElement("div");
        wrapper.className = "node-custom-ui";
        wrapper.style.padding = "48px 10px 12px 10px";
        wrapper.style.pointerEvents = "auto";
        wrapper.addEventListener("mousedown", (e) => e.stopPropagation());

        // Waveform selector
        const select = document.createElement("select");
        select.className = "node-select";
        select.style.width = "100%";
        select.style.marginBottom = "6px";
        ["sine", "square", "sawtooth", "triangle"].forEach(w => {
          const opt = document.createElement("option");
          opt.value = w;
          opt.textContent = w.toUpperCase();
          opt.selected = node.state.waveform === w;
          select.appendChild(opt);
        });
        select.addEventListener("change", () => {
          graph.controller.updateNodeState(node.id, { ...node.state, waveform: select.value });
        });

        // Frequency slider
        const slider = document.createElement("input");
        slider.type = "range";
        slider.className = "node-slider";
        slider.min = "100";
        slider.max = "2000";
        slider.value = node.state.frequency;
        slider.style.width = "100%";

        slider.addEventListener("input", () => {
          graph.controller.updateNodeState(node.id, { ...node.state, frequency: Number(slider.value) });
        });

        wrapper.appendChild(select);
        wrapper.appendChild(slider);
        body.appendChild(wrapper);
      },
      update(node, el, { body }) {
        const select = body.querySelector("select");
        if (select) select.value = node.state.waveform;

        const slider = body.querySelector("input[type='range']");
        if (slider) {
          const graph = el._graph || window.editor.graph;
          const port = node.inputs.find(p => p.name === "frequency" && p.portType === "data");
          const isConnected = port ? Array.from(graph.edges.values()).some(e => e.toNode === node.id && e.toPort === port.id) : false;

          slider.disabled = isConnected;
          slider.style.opacity = isConnected ? "0.35" : "1";
          slider.value = node.state.frequency;
        }
      }
    },
    onExecute(node, { getInput, setOutput }) {
      const ctx = getAudioContext();
      if (!node._audioNode) {
        const osc = ctx.createOscillator();
        osc.type = node.state.waveform;
        osc.frequency.setValueAtTime(node.state.frequency, ctx.currentTime);
        osc.start();
        node._audioNode = osc;
        
        // Cleanup on graph destroy or stop
        hooks.on("runner:stop", () => {
          try {
            osc.stop();
          } catch(e){ /* ignore */ }
          node._audioNode = null;
        });
      }

      const osc = node._audioNode;
      // Frequency: Port input overrides widget state (Widget-to-Port)
      const freq = getInput("frequency") ?? node.state.frequency;
      osc.type = node.state.waveform;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      setOutput("signal", osc);
      setOutput("exec", true);
    }
  });

  // ── Gain Node ──────────────────────────────────────────────────────
  registry.register("audio/Gain", {
    title: "Volume Gain",
    color: "#a855f7",
    inputs: [
      { name: "exec", portType: "exec" },
      { name: "signal", portType: "data", datatype: "object" },
      { name: "gain", portType: "data", datatype: "number" }
    ],
    outputs: [
      { name: "exec", portType: "exec" },
      { name: "signal", portType: "data", datatype: "object" }
    ],
    properties: [
      { key: "gain", label: "Gain", widget: "slider", min: 0, max: 2, step: 0.01 }
    ],
    onCreate(node) {
      node.state.gain = node.state.gain ?? 0.5;
    },
    html: {
      init(node, el, { body, graph }) {
        el._graph = graph;
        el.style.width = "180px";
        const wrapper = document.createElement("div");
        wrapper.className = "node-custom-ui";
        wrapper.style.padding = "68px 10px 12px 10px";
        wrapper.style.pointerEvents = "auto";
        wrapper.addEventListener("mousedown", (e) => e.stopPropagation());

        // Gain Slider
        const slider = document.createElement("input");
        slider.type = "range";
        slider.className = "node-slider";
        slider.min = "0";
        slider.max = "2";
        slider.step = "0.01";
        slider.value = node.state.gain;
        slider.style.width = "100%";

        slider.addEventListener("input", () => {
          graph.controller.updateNodeState(node.id, { ...node.state, gain: Number(slider.value) });
        });

        wrapper.appendChild(slider);
        body.appendChild(wrapper);
      },
      update(node, el, { body }) {
        const slider = body.querySelector("input");
        if (slider) {
          const graph = el._graph || window.editor.graph;
          const port = node.inputs.find(p => p.name === "gain" && p.portType === "data");
          const isConnected = port ? Array.from(graph.edges.values()).some(e => e.toNode === node.id && e.toPort === port.id) : false;

          slider.disabled = isConnected;
          slider.style.opacity = isConnected ? "0.35" : "1";
          slider.value = node.state.gain;
        }
      }
    },
    onExecute(node, { getInput, setOutput }) {
      const ctx = getAudioContext();
      if (!node._audioNode) {
        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(node.state.gain, ctx.currentTime);
        node._audioNode = gainNode;

        hooks.on("runner:stop", () => {
          node._audioNode = null;
          node._connectedInput = null;
        });
      }

      const gainNode = node._audioNode;
      const inputSignal = getInput("signal");

      if (inputSignal && inputSignal !== node._connectedInput) {
        if (node._connectedInput) {
          try { node._connectedInput.disconnect(gainNode); } catch(e){ /* ignore */ }
        }
        inputSignal.connect(gainNode);
        node._connectedInput = inputSignal;
      }

      // Gain: Port overrides widget state (Widget-to-Port)
      const gainVal = getInput("gain") ?? node.state.gain;
      gainNode.gain.setValueAtTime(gainVal, ctx.currentTime);

      setOutput("signal", gainNode);
      setOutput("exec", true);
    }
  });

  // ── Mixer Node ──────────────────────────────────────────────────────
  registry.register("audio/Mixer", {
    title: "Audio Mixer",
    color: "#a855f7",
    inputs: [
      { name: "exec", portType: "exec" }
    ],
    outputs: [
      { name: "exec", portType: "exec" },
      { name: "signal", portType: "data", datatype: "object" }
    ],
    onCreate(node) {
      // Create initial two channels
      node.addInput("channel_1", "object", "data");
      node.addInput("channel_2", "object", "data");
      node.state.gain_1 = 0.5;
      node.state.gain_2 = 0.5;
    },
    html: {
      init(node, el, { body, graph }) {
        el.style.width = "200px";
        const wrapper = document.createElement("div");
        wrapper.className = "node-custom-ui";
        wrapper.style.padding = "48px 10px 12px 10px";
        wrapper.style.pointerEvents = "auto";
        wrapper.style.display = "flex";
        wrapper.style.flexDirection = "column";
        wrapper.style.gap = "4px";
        wrapper.addEventListener("mousedown", (e) => e.stopPropagation());

        // Add channel button (Dynamic Slots)
        const addBtn = document.createElement("button");
        addBtn.className = "node-btn";
        addBtn.textContent = "+ Add Channel";
        addBtn.style.width = "100%";
        addBtn.style.padding = "4px";
        addBtn.style.marginBottom = "6px";
        addBtn.addEventListener("click", () => {
          const nextIdx = node.inputs.filter(p => p.name.startsWith("channel_")).length + 1;
          const portName = `channel_${nextIdx}`;
          
          // Use toggleWidgetToPort helper or add directly
          graph.controller.toggleWidgetToPort(node.id, portName);
          node.state[`gain_${nextIdx}`] = 0.5;
          graph.render();
        });

        wrapper.appendChild(addBtn);
        body.appendChild(wrapper);
      },
      update(node, el, { body }) {
        // Re-draw sliders for each channel input
        let container = body.querySelector(".mixer-channels-container");
        if (!container) {
          container = document.createElement("div");
          container.className = "mixer-channels-container";
          container.style.display = "flex";
          container.style.flexDirection = "column";
          container.style.gap = "4px";
          body.appendChild(container);
        }
        container.innerHTML = "";

        const dataInputs = node.inputs.filter(p => p.name.startsWith("channel_"));
        dataInputs.forEach((p, idx) => {
          const chNum = p.name.split("_")[1];
          const row = document.createElement("div");
          row.style.display = "flex";
          row.style.alignItems = "center";
          row.style.gap = "6px";

          const label = document.createElement("span");
          label.textContent = `Ch ${chNum}`;
          label.style.fontSize = "9px";
          label.style.color = "#999";
          label.style.width = "28px";

          const slider = document.createElement("input");
          slider.type = "range";
          slider.className = "node-slider";
          slider.min = "0";
          slider.max = "1";
          slider.step = "0.01";
          slider.value = node.state[`gain_${chNum}`] ?? 0.5;
          slider.style.flex = "1";
          slider.addEventListener("input", () => {
            node.state[`gain_${chNum}`] = Number(slider.value);
          });

          const delBtn = document.createElement("span");
          delBtn.textContent = "×";
          delBtn.style.cursor = "pointer";
          delBtn.style.color = "#ef4444";
          delBtn.style.fontWeight = "bold";
          delBtn.style.padding = "0 4px";
          delBtn.addEventListener("click", () => {
            const graph = el.parentElement.__editorGraph || window.editor.graph;
            graph.controller.toggleWidgetToPort(node.id, p.name);
          });

          row.appendChild(label);
          row.appendChild(slider);
          if (dataInputs.length > 1) {
            row.appendChild(delBtn);
          }
          container.appendChild(row);
        });
      }
    },
    onExecute(node, { getInput, setOutput }) {
      const ctx = getAudioContext();
      if (!node._audioNode) {
        node._audioNode = ctx.createGain(); // Mixer master node
        node._channelGains = new Map(); // chPortId -> GainNode

        hooks.on("runner:stop", () => {
          node._audioNode = null;
          node._channelGains = null;
        });
      }

      const masterGain = node._audioNode;
      const dataInputs = node.inputs.filter(p => p.name.startsWith("channel_"));

      dataInputs.forEach((port) => {
        const inputSignal = getInput(port.name);
        const chNum = port.name.split("_")[1];
        const gainVal = node.state[`gain_${chNum}`] ?? 0.5;

        let chGainNode = node._channelGains.get(port.id);
        if (!chGainNode) {
          chGainNode = ctx.createGain();
          chGainNode.connect(masterGain);
          node._channelGains.set(port.id, chGainNode);
        }

        chGainNode.gain.setValueAtTime(gainVal, ctx.currentTime);

        if (inputSignal && inputSignal !== port._connectedNode) {
          if (port._connectedNode) {
            try { port._connectedNode.disconnect(chGainNode); } catch(e){ /* ignore */ }
          }
          inputSignal.connect(chGainNode);
          port._connectedNode = inputSignal;
        } else if (!inputSignal && port._connectedNode) {
          try { port._connectedNode.disconnect(chGainNode); } catch(e){ /* ignore */ }
          port._connectedNode = null;
        }
      });

      setOutput("signal", masterGain);
      setOutput("exec", true);
    }
  });

  // ── Destination Node ────────────────────────────────────────────────
  registry.register("audio/Destination", {
    title: "Audio Out",
    color: "#ef4444", // red
    inputs: [
      { name: "exec", portType: "exec" },
      { name: "signal", portType: "data", datatype: "object" }
    ],
    outputs: [
      { name: "exec", portType: "exec" }
    ],
    onExecute(node, { getInput, setOutput }) {
      const ctx = getAudioContext();
      if (!node._audioNode) {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.connect(ctx.destination);
        node._audioNode = analyser;

        hooks.on("runner:stop", () => {
          node._audioNode = null;
          node._connectedInput = null;
        });
      }

      const analyser = node._audioNode;
      const inputSignal = getInput("signal");

      if (inputSignal && inputSignal !== node._connectedInput) {
        if (node._connectedInput) {
          try { node._connectedInput.disconnect(analyser); } catch(e){ /* ignore */ }
        }
        inputSignal.connect(analyser);
        node._connectedInput = inputSignal;
      } else if (!inputSignal && node._connectedInput) {
        try { node._connectedInput.disconnect(analyser); } catch(e){ /* ignore */ }
        node._connectedInput = null;
      }

      // Bind the analyser node to the visualizer PreviewWindow
      if (window.PreviewWindowInstance && analyser) {
        window.PreviewWindowInstance.setAudioAnalyser(analyser);
      }

      setOutput("exec", true);
    }
  });
}
