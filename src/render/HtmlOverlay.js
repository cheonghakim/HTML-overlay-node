// 캔버스 위에 붙는 DOM 오버레이. 캔버스의 scale/offset에 맞춰 CSS transform을 적용.
// 동기화 하기 까다로워서 아직 적용하지 않음
export class HtmlOverlay {
  /**
   * @param {HTMLElement} host  캔버스를 감싸는 래퍼( position: relative )
   * @param {CanvasRenderer} renderer
   * @param {Registry} registry
   */
  constructor(host, renderer, registry) {
    this.host = host;
    this.renderer = renderer;
    this.registry = registry;
    this.container = document.createElement("div");
    Object.assign(this.container.style, {
      position: "absolute",
      inset: "0",
      pointerEvents: "none", // 기본은 통과
      zIndex: "10",
    });
    host.appendChild(this.container);

    /** @type {Map<string, HTMLElement>} */
    this.nodes = new Map();

    /** ResizeObserver instances keyed by node id */
    this._observers = new Map();

    /** Callback to trigger canvas re-render; set by createGraphEditor */
    this._onHeightChange = null;
  }

  /** 기본 노드 레이아웃 생성 (헤더 + 바디) */
  _createDefaultNodeLayout(_node) {
    const container = document.createElement("div");
    container.className = "node-overlay";
    Object.assign(container.style, {
      position: "absolute",
      display: "flex",
      flexDirection: "column",
      boxSizing: "border-box",
      pointerEvents: "none", // 기본은 통과 (캔버스 인터랙션 위해)
      overflow: "hidden", // 둥근 모서리 등
    });

    const header = document.createElement("div");
    header.className = "node-header";
    Object.assign(header.style, {
      height: "22px",
      flexShrink: "0",
      display: "flex",
      alignItems: "center",
      padding: "0 8px",
      cursor: "grab",
      userSelect: "none",
      pointerEvents: "none", // 헤더 클릭시 드래그는 캔버스가 처리
    });

    const body = document.createElement("div");
    body.className = "node-body";
    Object.assign(body.style, {
      flex: "1",
      position: "relative",
      overflow: "hidden",
      // 바디 내부는 인터랙션 가능하게? 아니면 이것도 none하고 자식만 auto?
      // 일단 바디는 auto로 두면 바디 영역 클릭시 드래그가 안됨.
      // 그래서 바디도 none으로 하고, 내부 컨텐츠(input 등)만 auto로 하는게 맞음.
      pointerEvents: "none",
    });

    container.appendChild(header);
    container.appendChild(body);

    // 나중에 접근하기 쉽게 프로퍼티로 저장
    container._domParts = { header, body };
    return container;
  }

  /** 노드용 엘리먼트 생성(한 번만) */
  _ensureNodeElement(node, def, graph) {
    let el = this.nodes.get(node.id);
    if (!el) {
      // 1) 사용자 정의 render 함수가 있으면 우선 사용
      if (def.html?.render) {
        el = def.html.render(node);
      }
      // 2) 아니면 기본 레이아웃 사용 (html 설정이 있는 경우)
      else if (def.html) {
        el = this._createDefaultNodeLayout(node);
        // 초기화 훅 - graph reference 전달
        if (def.html.init) {
          def.html.init(node, el, { ...el._domParts, graph });
        }
      } else {
        return null; // HTML 없음
      }

      if (!el) return null;

      el.style.position = "absolute";
      el.style.pointerEvents = "none"; // 기본적으로 캔버스 통과
      this.container.appendChild(el);
      this.nodes.set(node.id, el);

      // 노드 크기를 실제 HTML 콘텐츠 크기에 맞게 보정 (커질 때만)
      this._syncSizeToContent(node, el);

      // ResizeObserver: sync node height when body content resizes
      this._attachResizeObserver(node, el);
    }
    return el;
  }

  /**
   * 노드 크기를 HTML 콘텐츠에 맞게 보정한다 (커질 때만, 최초 1회).
   * - init()이 지정한 인라인 width가 node.size.width보다 크면 채택
   *   (draw()가 매 프레임 el 크기를 node.size로 덮어쓰므로 여기서 동기화해야 함)
   * - 기본 레이아웃(body)의 콘텐츠 높이가 노드 높이를 넘으면 잘리지 않게 확장
   */
  _syncSizeToContent(node, el) {
    const inlineW = parseFloat(el.style.width);
    if (Number.isFinite(inlineW) && inlineW > node.size.width) {
      node.size.width = inlineW;
      node.computed.w = inlineW;
    }

    const body = el._domParts?.body;
    if (!body) return;

    // 최종 노드 폭 기준으로 콘텐츠 높이 측정
    el.style.width = `${node.size.width}px`;
    const headerH = 22;
    const minH = headerH + body.scrollHeight;
    if (minH > node.size.height) {
      node.size.height = minH;
      node.computed.h = minH;
      this._onHeightChange?.();
    }
  }

  _attachResizeObserver(node, el) {
    if (typeof ResizeObserver === "undefined") return;
    const target = el._domParts?.body ?? el;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const headerH = 22;
        const contentH = entry.contentRect.height;
        const newH = Math.max(node.size.height, headerH + contentH);
        if (Math.abs(newH - node.size.height) > 1) {
          node.size.height = newH;
          node.computed.h = newH;
          this._onHeightChange?.();
        }
      }
    });
    obs.observe(target);
    this._observers.set(node.id, obs);
  }

  /**
   * 뷰포트 컬링 기준값.
   * LOD_HIDE_HTML: 이 배율 미만에서는 HTML 오버레이 전체 숨김 (캔버스 전용 렌더)
   */
  static LOD_HIDE_HTML = 0.35;

  /** 그래프와 변환 동기화하여 렌더링 */
  draw(graph, selection = new Set()) {
    // 컨테이너 전체에 월드 변환 적용 (CSS 픽셀 기준)
    const { scale, offsetX, offsetY } = this.renderer;
    this.container.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    this.container.style.transformOrigin = "0 0";

    // LOD: 줌이 너무 낮으면 HTML 오버레이 전체 숨기고 조기 종료
    if (scale < HtmlOverlay.LOD_HIDE_HTML) {
      for (const el of this.nodes.values()) el.style.display = "none";
      if (this._stepBtn) this._stepBtn.style.display = "none";
      return;
    }

    // 뷰포트 범위 (월드 좌표, 여유 margin 포함) — 논리(CSS) 픽셀 기준
    const margin = 100 / scale;
    const vLeft   = -offsetX / scale - margin;
    const vTop    = -offsetY / scale - margin;
    const vRight  = vLeft + this.renderer.width  / scale + margin * 2;
    const vBottom = vTop  + this.renderer.height / scale + margin * 2;

    const seen = new Set();

    for (const node of graph.nodes.values()) {
      const def = this.registry.types.get(node.type);

      // render 함수가 있거나, html 설정 객체가 있으면 처리
      const hasHtml = !!def?.html;
      if (!hasHtml) continue;

      const el = this._ensureNodeElement(node, def, graph);
      if (!el) continue;

      // 뷰포트 컬링: 완전히 밖에 있으면 DOM에서 숨김
      const { x, y, w, h } = node.computed;
      const inView = x < vRight && x + w > vLeft && y < vBottom && y + h > vTop;
      if (!inView) {
        el.style.display = "none";
        seen.add(node.id);
        continue;
      }

      // 뷰포트 안: 표시 복원 + 위치 동기화
      el.style.display = "";
      el.style.left = `${node.computed.x}px`;
      el.style.top = `${node.computed.y}px`;
      el.style.width = `${node.computed.w}px`;
      el.style.height = `${node.computed.h}px`;

      // 선택 상태 등 업데이트 훅
      if (def.html.update) {
        // 기본 레이아웃이면 header/body도 함께 전달
        const parts = el._domParts || {};
        def.html.update(node, el, {
          selected: selection.has(node.id),
          header: parts.header,
          body: parts.body,
        });
      }

      seen.add(node.id);
    }

    // ── Interactive Stepping Play Button ─────────────────────
    this._drawStepOverlay(graph);

    // 없어진 노드 제거
    for (const [id, el] of this.nodes) {
      if (!seen.has(id)) {
        el.remove();
        this.nodes.delete(id);
      }
    }
  }

  _drawStepOverlay(graph) {
    const runner = graph.runner;
    if (!runner || runner.executionMode !== "step" || !runner.activePlan) {
      if (this._stepBtn) {
        this._stepBtn.style.display = "none";
      }
      return;
    }

    const nextStep = runner.activePlan[runner.activeStepIndex];
    if (!nextStep) {
      if (this._stepBtn) this._stepBtn.style.display = "none";
      return;
    }

    const node = graph.nodes.get(nextStep.nodeId);
    if (!node) return;

    if (!this._stepBtn) {
      this._stepBtn = document.createElement("button");
      this._stepBtn.className = "step-play-button";
      this._stepBtn.innerHTML = `
        <svg width="6" height="8" viewBox="0 0 6 8" fill="currentColor" style="display: block; margin-left: 1px;">
          <path d="M0 0 L6 4 L0 8 Z" />
        </svg>
      `;
      Object.assign(this._stepBtn.style, {
        position: "absolute",
        zIndex: "100",
        width: "16px",
        height: "16px",
        borderRadius: "4px",
        border: "none",
        background: "rgba(255, 255, 255, 0.12)",
        color: "#34d399",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "auto",
        transition: "transform 0.1s, background 0.15s, color 0.15s",
        padding: "0",
      });
      this._stepBtn.addEventListener("mouseenter", () => {
        this._stepBtn.style.background = "rgba(52, 211, 153, 0.25)";
        this._stepBtn.style.color = "#a7f3d0";
        this._stepBtn.style.transform = "scale(1.08)";
      });
      this._stepBtn.addEventListener("mouseleave", () => {
        this._stepBtn.style.background = "rgba(255, 255, 255, 0.12)";
        this._stepBtn.style.color = "#34d399";
        this._stepBtn.style.transform = "scale(1)";
      });
      this._stepBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        runner.executeNextStep();
      });
      this.container.appendChild(this._stepBtn);
    }

    // Position the button in the top-right corner of the node (header area)
    this._stepBtn.style.display = "flex";
    this._stepBtn.style.left = `${node.computed.x + node.computed.w - 24}px`;
    this._stepBtn.style.top = `${node.computed.y + 3}px`;
  }

  /**
   * Sync container transform with renderer state (lightweight update)
   * Called when zoom/pan occurs without needing full redraw
   */
  syncTransform() {
    const { scale, offsetX, offsetY } = this.renderer;
    this.container.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    this.container.style.transformOrigin = "0 0";
  }

  clear() {
    for (const [, obs] of this._observers) obs.disconnect();
    this._observers.clear();
    for (const [, el] of this.nodes) el.remove();
    this.nodes.clear();
  }

  destroy() {
    this.clear();
    this.container.remove();
  }
}
