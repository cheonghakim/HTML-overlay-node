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
      height: "24px",
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
  _ensureNodeElement(node, def) {
    let el = this.nodes.get(node.id);
    if (!el) {
      // 1) 사용자 정의 render 함수가 있으면 우선 사용
      if (def.html?.render) {
        el = def.html.render(node);
      }
      // 2) 아니면 기본 레이아웃 사용 (html 설정이 있는 경우)
      else if (def.html) {
        el = this._createDefaultNodeLayout(node);
        // 초기화 훅
        if (def.html.init) {
          def.html.init(node, el, el._domParts);
        }
      } else {
        return null; // HTML 없음
      }

      if (!el) return null;

      el.style.position = "absolute";
      el.style.pointerEvents = "none"; // 기본적으로 캔버스 통과
      this.container.appendChild(el);
      this.nodes.set(node.id, el);
    }
    return el;
  }

  /** 그래프와 변환 동기화하여 렌더링 */
  draw(graph, selection = new Set()) {
    // 컨테이너 전체에 월드 변환 적용 (CSS 픽셀 기준)
    const { scale, offsetX, offsetY } = this.renderer;
    this.container.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    this.container.style.transformOrigin = "0 0";

    const seen = new Set();

    for (const node of graph.nodes.values()) {
      const def = this.registry.types.get(node.type);

      // render 함수가 있거나, html 설정 객체가 있으면 처리
      const hasHtml = !!(def?.html);
      if (!hasHtml) continue;

      const el = this._ensureNodeElement(node, def);
      if (!el) continue;

      // 노드 위치/크기 동기화 (월드 좌표 → 컨테이너 내부는 이미 scale/translate 적용)
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
          body: parts.body
        });
      }

      seen.add(node.id);
    }

    // 없어진 노드 제거
    for (const [id, el] of this.nodes) {
      if (!seen.has(id)) {
        el.remove();
        this.nodes.delete(id);
      }
    }
  }

  clear() {
    // Remove all node elements
    for (const [, el] of this.nodes) {
      el.remove();
    }
    this.nodes.clear();
  }

  destroy() {
    this.clear();
    this.container.remove();
  }
}
