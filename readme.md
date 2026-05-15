# Free Node — HTML Overlay Node Editor

[![npm version](https://img.shields.io/npm/v/html-overlay-node.svg)](https://www.npmjs.com/package/html-overlay-node)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**Free Node** is an enterprise-grade visual node editor that combines Canvas performance with the full power of HTML/CSS for node UI.

**Free Node**는 Canvas의 고성능 렌더링과 HTML/CSS의 완전한 UI 표현력을 결합한 엔터프라이즈급 비주얼 노드 에디터입니다.

> **Live Demo** · **[https://cheonghakim.github.io/HTML-overlay-node/](https://cheonghakim.github.io/HTML-overlay-node/)**

---

## Why Free Node?

### The Problem

Traditional node editors force a hard choice:

- **Pure Canvas** — High performance, but extremely difficult to style or build rich interactive widgets (inputs, dropdowns, custom controls).
- **Pure DOM** — Easy to style and interact with, but performance collapses under complex edge animations or large graphs.

### Our Solution — Hybrid Architecture

- **Canvas layer** handles heavy lifting: thousands of edges, animated emerald emerald signals, background grid.
- **HTML overlay** handles UI: node bodies, forms, sliders, and any custom widget — all with full CSS power.

### 왜 Free Node인가?

기존 노드 에디터는 보통 두 가지 선택지 사이에서 타협합니다:

- **순수 Canvas** — 성능은 좋지만 CSS 스타일링이 불가능하고 인터랙티브 위젯 구현이 매우 어렵습니다.
- **순수 DOM** — 스타일과 인터랙션은 쉽지만 복잡한 그래프에서 성능이 급격히 저하됩니다.

**Free Node의 하이브리드 아키텍처**:

- **Canvas**가 무거운 작업을 담당: 수천 개의 연결선, 에메랄드 신호 애니메이션, 배경 그리드
- **HTML 오버레이**가 UI를 담당: 노드 내 입력 폼, 슬라이더, 버튼 등 모든 CSS 위젯

---

## Key Features / 주요 기능

| Feature | 기능 |
|:--------|:-----|
| Hybrid Canvas + HTML rendering | 하이브리드 Canvas + HTML 렌더링 |
| **Emerald Signal Flow** | 선명한 에메랄드 그린 데이터 흐름 시각화 |
| **Interactive Minimap** | 드래그 및 클릭으로 이동 가능한 인터랙티브 미니맵 |
| **One-Line Undo/Redo API** | 한 줄의 코드로 관리되는 강력한 실행 취소/재실행 |
| **Advanced Grid Snap** | 노드와 연결선 핸들 모두 지원하는 정밀 그리드 스냅 |
| Node grouping (Ctrl+G) | 노드 그룹화 및 지능형 부모-자식 관리 |
| Copy / Paste / Duplicate | 노드 복사 / 붙여넣기 / 복제 |
| Fit to View (F) | 전체 보기 맞춤 및 자동 레이아웃(Grid) |
| Multi-edge styles | Bezier, Orthogonal, Straight 스타일 지원 |
| Property panel | 속성 패널 연동 및 실시간 상태 수정 |
| Zero dependencies | 제로 외부 의존성 및 고성능 보장 |

---

## Quick Start / 빠른 시작

### Installation / 설치

```bash
npm install html-overlay-node
```

### Basic Usage / 기본 사용

```javascript
import { createGraphEditor } from "html-overlay-node";
import { registerAllNodes } from "html-overlay-node/nodes";
import "html-overlay-node/index.css";

const editor = createGraphEditor("#editor-container", {
  theme: "dark",        
  showMinimap: true,    
  enablePropertyPanel: true,
});

// Register built-in node types
registerAllNodes(editor.registry, editor.hooks);

// Add a node with one line (automatically undoable)
editor.controller.addNode("math/Multiply", { x: 100, y: 100 });
```

---

## Keyboard Shortcuts / 단축키

### Selection & Edit / 선택 및 편집

| Action | Shortcut | 동작 |
|:-------|:---------|:-----|
| Box select | `Ctrl + Drag` | 박스 선택 |
| Select all | `Ctrl + A` | 전체 선택 |
| Undo / Redo | `Ctrl + Z` / `Ctrl + Y` | 실행 취소 / 재실행 |
| Delete | `Delete` / `Backspace` | 삭제 |
| Copy / Paste | `Ctrl + C` / `Ctrl + V` | 복사 / 붙여넣기 |

### View & Layout / 뷰 및 레이아웃

| Action | Shortcut | 동작 |
|:-------|:---------|:-----|
| Zoom In / Out | `Ctrl + (+/-)` or `Wheel` | 확대 / 축소 |
| Fit to view | `F` | 전체 보기 맞춤 |
| Grid Snap | `G` | 그리드 스냅 토글 (노드/링크 모두 적용) |
| Align nodes | `A` (Horiz) / `Shift+A` (Vert) | 노드 정렬 |
| Pan | `Middle-button drag` | 화면 이동 |

---

## Editor API (High-Level)

`editor.controller`를 통해 제공되는 고수준 API는 모든 동작을 자동으로 Undo 히스토리에 기록합니다.

```javascript
// Add node with undo support
const node = editor.controller.addNode("math/Multiply", { title: "My Multiplier" });

// Update node state (captured in history)
editor.controller.updateNodeState(node.id, { factor: 10 });

// Update general properties
editor.controller.updateNodeProperty(node.id, "title", "New Title");

// Align all nodes in a grid
editor.controller.autoLayout();

// Manual History Control
editor.controller.undo();
editor.controller.redo();
```

### Core API

```javascript
editor.graph          // Graph data model (nodes, edges)
editor.renderer       // Main CanvasRenderer
editor.render()       // Force redraw (includes Minimap sync)
editor.setEdgeStyle("bezier" | "orthogonal" | "line")
editor.destroy()      // Full cleanup
```

---

## HTML Overlay Nodes / HTML 오버레이 노드

`html` 속성으로 노드 내부에 HTML/CSS를 자유롭게 삽입합니다. `node.state`를 사용하면 별도의 설정 없이도 모든 상태가 JSON 직렬화 및 Undo/Redo에 포함됩니다.

```javascript
editor.registry.register("ui/Slider", {
  title: "Value Slider",
  html: {
    init(node, el, { body }) {
      const slider = document.createElement("input");
      slider.type = "range";
      slider.addEventListener("input", (e) => {
        // Use high-level API for automatic undo/redo support
        editor.controller.updateNodeState(node.id, { value: e.target.value });
      });
      body.appendChild(slider);
    }
  }
});
```

---

## Development / 개발

```bash
npm install
npm run dev        # Start dev server
npm test           # Run tests
npm run build      # Production build
```

---

## License / 라이선스

[MIT](LICENSE) © cheonghakim
