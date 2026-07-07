// src/ui/PreviewWindow.js

export class PreviewWindow {
  constructor(parentContainer) {
    this.parent = parentContainer;
    this.audioAnalyser = null;
    this.threeDGeom = null;
    this.activeTab = "3d"; // "3d" or "audio"
    this.minimized = false;

    this._createDOM();
    this._bindEvents();
    this._startLoop();

    window.PreviewWindowInstance = this;
  }

  _createDOM() {
    // Container
    this.el = document.createElement("div");
    this.el.className = "preview-window";
    Object.assign(this.el.style, {
      position: "absolute",
      right: "20px",
      bottom: "20px",
      width: "300px",
      height: "280px",
      minWidth: "200px",
      minHeight: "180px",
      zIndex: "100",
      display: "flex",
      flexDirection: "column",
      resize: "both",
      overflow: "hidden"
    });

    // Header
    const header = document.createElement("div");
    header.className = "preview-header";
    header.innerHTML = `
      <span class="preview-title">Live Preview</span>
      <div class="preview-controls">
        <button class="preview-min-btn" title="Minimize">−</</button>
      </div>
    `;
    this.el.appendChild(header);

    // Tab Bar
    const tabBar = document.createElement("div");
    tabBar.className = "preview-tabbar";
    tabBar.innerHTML = `
      <button class="preview-tab active" data-tab="3d">3D Render</button>
      <button class="preview-tab" data-tab="audio">Audio Wave</button>
    `;
    this.el.appendChild(tabBar);

    // Body container
    const body = document.createElement("div");
    body.className = "preview-body";
    body.style.flex = "1";
    body.style.position = "relative";
    this.el.appendChild(body);

    // 3D Canvas
    this.canvas3d = document.createElement("canvas");
    this.canvas3d.style.position = "absolute";
    this.canvas3d.style.inset = "0";
    this.canvas3d.style.width = "100%";
    this.canvas3d.style.height = "100%";
    this.canvas3d.style.display = "block";
    body.appendChild(this.canvas3d);

    // Audio Canvas
    this.canvasAudio = document.createElement("canvas");
    this.canvasAudio.style.position = "absolute";
    this.canvasAudio.style.inset = "0";
    this.canvasAudio.style.width = "100%";
    this.canvasAudio.style.height = "100%";
    this.canvasAudio.style.display = "none";
    body.appendChild(this.canvasAudio);

    this.parent.appendChild(this.el);

    this.ctx3d = this.canvas3d.getContext("2d");
    this.ctxAudio = this.canvasAudio.getContext("2d");

    this._dom = { header, tabBar, body, minBtn: header.querySelector(".preview-min-btn") };
  }

  _bindEvents() {
    // Draggable header
    let isDragging = false;
    let startX = 0, startY = 0;
    let origX = 0, origY = 0;

    const onMouseDown = (e) => {
      if (e.target.closest("button")) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = this.el.getBoundingClientRect();
      const parentRect = this.parent.getBoundingClientRect();
      origX = rect.left - parentRect.left;
      origY = rect.top - parentRect.top;

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      e.preventDefault();
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      // Restrict within parent boundary
      const newX = Math.max(0, Math.min(this.parent.clientWidth - this.el.clientWidth, origX + dx));
      const newY = Math.max(0, Math.min(this.parent.clientHeight - this.el.clientHeight, origY + dy));

      this.el.style.left = `${newX}px`;
      this.el.style.top = `${newY}px`;
      this.el.style.right = "auto";
      this.el.style.bottom = "auto";
    };

    const onMouseUp = () => {
      isDragging = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    this._dom.header.addEventListener("mousedown", onMouseDown);

    // Minimize toggle
    this._dom.minBtn.addEventListener("click", () => {
      this.minimized = !this.minimized;
      if (this.minimized) {
        this._prevHeight = this.el.style.height;
        this.el.style.height = "32px";
        this.el.style.resize = "none";
        this._dom.minBtn.textContent = "+";
        this._dom.tabBar.style.display = "none";
        this._dom.body.style.display = "none";
      } else {
        this.el.style.height = this._prevHeight || "280px";
        this.el.style.resize = "both";
        this._dom.minBtn.textContent = "−";
        this._dom.tabBar.style.display = "flex";
        this._dom.body.style.display = "block";
        this._resizeCanvases();
      }
    });

    // Tab switcher
    this._dom.tabBar.addEventListener("click", (e) => {
      const tabBtn = e.target.closest(".preview-tab");
      if (!tabBtn) return;
      
      const tab = tabBtn.dataset.tab;
      this.activeTab = tab;

      this._dom.tabBar.querySelectorAll(".preview-tab").forEach(btn => {
        btn.classList.toggle("active", btn === tabBtn);
      });

      this.canvas3d.style.display = tab === "3d" ? "block" : "none";
      this.canvasAudio.style.display = tab === "audio" ? "block" : "none";

      this._resizeCanvases();
    });

    // Handle resize
    if (typeof ResizeObserver !== "undefined") {
      const resizeOb = new ResizeObserver(() => {
        if (!this.minimized) {
          this._resizeCanvases();
        }
      });
      resizeOb.observe(this.el);
    }

    // Click to wake up AudioContext (Autoplay Policy waker)
    this.el.addEventListener("click", () => {
      if (window.audioCtx && window.audioCtx.state === "suspended") {
        window.audioCtx.resume().catch(() => {});
      }
    });
  }

  _resizeCanvases() {
    const w = this._dom.body.clientWidth;
    const h = this._dom.body.clientHeight;
    
    if (w > 0 && h > 0) {
      if (this.canvas3d.width !== w || this.canvas3d.height !== h) {
        this.canvas3d.width = w;
        this.canvas3d.height = h;
      }
      if (this.canvasAudio.width !== w || this.canvasAudio.height !== h) {
        this.canvasAudio.width = w;
        this.canvasAudio.height = h;
      }
    }
  }

  setAudioAnalyser(analyser) {
    this.audioAnalyser = analyser;
  }

  set3DGeometry(geom) {
    this.threeDGeom = geom;
  }

  _startLoop() {
    const tick = () => {
      if (!this.minimized) {
        if (this.activeTab === "3d") {
          this._render3D();
        } else {
          this._renderAudio();
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  _render3D() {
    const ctx = this.ctx3d;
    const w = this.canvas3d.width;
    const h = this.canvas3d.height;
    ctx.clearRect(0, 0, w, h);

    // Draw background grid/dark screen
    ctx.fillStyle = "#0c0f12";
    ctx.fillRect(0, 0, w, h);

    // Draw grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 20) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    if (!this.threeDGeom || !this.threeDGeom.vertices || this.threeDGeom.vertices.length === 0) {
      ctx.fillStyle = "#666";
      ctx.font = "11px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No 3D Input Received", w / 2, h / 2);
      return;
    }

    const { vertices, edges } = this.threeDGeom;

    // Camera parameters
    const F = 240; // focal length
    const D = 320; // distance from camera
    const cx = w / 2;
    const cy = h / 2;

    // Project 3D to 2D
    const projected = vertices.map(v => {
      // Perspective projection mapping formula
      const denom = v.z + D;
      if (denom === 0) return { x: cx, y: cy };
      const px = (v.x * F) / denom + cx;
      const py = (v.y * F) / denom + cy;
      return { x: px, y: py };
    });

    // Draw edges
    ctx.strokeStyle = "#06b6d4"; // neon cyan
    ctx.lineWidth = 1.8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.shadowColor = "rgba(6, 182, 212, 0.6)";
    ctx.shadowBlur = 8;

    edges.forEach(([i, j]) => {
      const p1 = projected[i];
      const p2 = projected[j];
      if (p1 && p2) {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    });

    // Draw vertex dots
    ctx.fillStyle = "#fff";
    ctx.shadowBlur = 0; // reset shadow
    projected.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  _renderAudio() {
    const ctx = this.ctxAudio;
    const w = this.canvasAudio.width;
    const h = this.canvasAudio.height;
    ctx.clearRect(0, 0, w, h);

    // Dark screen
    ctx.fillStyle = "#0c0f12";
    ctx.fillRect(0, 0, w, h);

    if (window.audioCtx && window.audioCtx.state === "suspended") {
      ctx.fillStyle = "#34d399";
      ctx.font = "11px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Click Window to Enable Audio", w / 2, h / 2);
      return;
    }

    if (!this.audioAnalyser) {
      ctx.fillStyle = "#666";
      ctx.font = "11px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No Audio Output Playing", w / 2, h / 2);
      return;
    }

    const analyser = this.audioAnalyser;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    // Draw oscilloscope wave
    analyser.getByteTimeDomainData(dataArray);

    ctx.lineWidth = 2;
    ctx.strokeStyle = "#10b981"; // emerald neon
    ctx.shadowColor = "rgba(16, 185, 129, 0.6)";
    ctx.shadowBlur = 8;
    ctx.beginPath();

    const sliceWidth = w / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const offset = (dataArray[i] / 128.0) - 1.0;
      // Invert offset because canvas Y-axis goes downwards, and scale amplitude slightly (0.7) for margin padding
      const y = ((-offset * 0.7) + 1.0) * (h / 2);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.lineTo(w, h / 2);
    ctx.stroke();
    ctx.shadowBlur = 0; // reset
  }

  destroy() {
    if (this.el && this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
  }
}
