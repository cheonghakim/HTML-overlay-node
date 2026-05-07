# HTML-overlay-Node

[![npm version](https://img.shields.io/npm/v/html-overlay-node.svg)](https://www.npmjs.com/package/html-overlay-node)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**HTML-overlay-Node** is a professional-grade node editor engine that combines the high-performance rendering of Canvas with the flexible UI interface of HTML.
**HTML-overlay-Node**는 Canvas의 고성능 렌더링과 HTML의 유연한 UI 인터페이스를 결합한 전문가용 노드 에디터 엔진입니다.

---

## 🎯 Why HTML-overlay-Node? (의도 및 목적)

### The Problem

Traditional node editors often force a choice:

- **Pure Canvas**: High performance for many nodes/edges, but extremely difficult to style or implement complex interactive widgets (inputs, dropdowns).
- **Pure DOM**: Easy to style and rich interactivity, but performance degrades rapidly with complex edge animations or large graphs.

### Our Solution

We solve this by using a **Hybrid Architecture**:

- **Canvas** handles the "Heavy Lifting": Rendering thousands of connection lines (Edges), background grids, and high-frequency "Marching Ants" flow animations.
- **HTML Overlays** handle the "User Interface": Nodes, sliders, buttons, and custom widgets are rendered as DOM elements, allowing full CSS power and seamless interaction.

### 의도 및 목적

기존의 노드 에디터들은 보통 두 가지 선택지 중 하나로 구현됩니다:

- **순수 Canvas**: 수많은 노드와 엣지를 처리하는 성능은 좋지만, 스타일링이 어렵고 복잡한 인터랙티브 위젯(입력창, 드롭다운 등)을 구현하기 매우 까다롭습니다.
- **순수 DOM**: 스타일링과 인터랙션은 쉽지만, 복잡한 엣지 애니메이션이나 대규모 그래프에서는 성능이 급격히 저하됩니다.

**HTML-overlay-Node**는 **하이브리드 아키텍처**를 통해 이 문제를 해결합니다:

- **Canvas**는 "무거운 작업"을 담당합니다: 수천 개의 연결선(Edges), 배경 그리드, 고주파 'Marching Ants' 흐름 애니메이션을 렌더링합니다.
- **HTML 오버레이**는 "사용자 인터페이스"를 담당합니다: 노드 본체, 슬라이더, 버튼 등은 DOM 요소로 렌더링되어 CSS의 강력한 기능과 매끄러운 인터랙션을 그대로 활용할 수 있습니다.

---

## 🚀 Core Advantages (주요 장점)

- **Performance & Scalability**: Smooth 60fps even with complex logic flows and large-scale graphs.
- **Infinite Customizability**: Build nodes using standard HTML/CSS. No need to learn complex Canvas drawing APIs for UI.
- **Engineering Aesthetics**: Meticulously crafted dark theme with 2px precision rounding and category-based color coding.
- **Logic-Ready**: Built-in support for both Execution Flow (events) and Data Flow (values).

### 주요 장점

- **성능과 확장성**: 복잡한 로직 흐름과 대규모 그래프에서도 부드러운 60fps 성능을 유지합니다.
- **무한한 커스터마이징**: 표준 HTML/CSS를 사용하여 노드를 구축할 수 있습니다. UI를 위해 복잡한 Canvas 드로잉 API를 배울 필요가 없습니다.
- **엔지니어링 미학**: 2px의 정밀한 라운딩과 카테고리별 컬러 코딩이 적용된 정교한 다크 테마를 제공합니다.
- **로직 최적화**: 실행 흐름(이벤트)과 데이터 흐름(값)을 모두 지원하도록 설계되었습니다.

---

## 🛝Demo
- **[https://cheonghakim.github.io/HTML-overlay-node/](https://cheonghakim.github.io/HTML-overlay-node/)**

## ✨ 핵심 기능 (Key Features)

- **하이브리드 렌더링**: 노드 본체와 복잡한 위젯은 HTML로, 연결선(Edge)과 고주파 애니메이션은 Canvas로 처리하여 성능과 커스터마이징의 균형을 잡았습니다.
- **실시간 실행 흐름 시각화**: 노드 실행 상태와 데이터 흐름을 'Marching Ants' 테두리 및 흐르는 점 애니메이션으로 가시화하여 로직의 흐름을 직관적으로 파악할 수 있습니다.
- **전문가급 디자인 시스템**: 2px의 정밀한 라운딩, 깊이감 있는 다크 테마, 카테고리별 컬러 코딩으로 대규모 그래프에서도 높은 가독성을 유지합니다.
- **강력한 듀얼 포트 시스템**: 실행 제어(Execution Flow)와 데이터 전용(Data Flow) 포트를 분리 지원하여 함수형/이벤트 기반 로직 설계를 완벽히 지원합니다.
- **생산성 도구**: Undo/Redo, 그룹화(Group), 자동 정렬(Aligning), 그리드 스냅, 다중 선택 등 실제 작업 효율을 극대화하는 파워 유저 기능을 내장하고 있습니다.

---

## 🚀 빠른 시작 (Quick Start)

Vite나 Webpack 환경에서 다음과 같이 손쉽게 에디터를 구축할 수 있습니다.

```javascript
import { createGraphEditor } from "html-overlay-node";
import "html-overlay-node/index.css";

const editor = createGraphEditor("#editor-container", {
  theme: {
    accent: "#6366f1", // 주요 강조 색상 (Indigo)
    flowSpeed: 150     // 애니메이션 흐름 속도 (px/sec)
  }
});

const { graph, registry, start } = editor;

// 노드 등록 및 시작
registry.register("math/Add", { ... });
start();
```

---

## 🧩 플러그인 시스템 (Plugins & Node Registration)

`registry`를 통해 새로운 기능을 동적으로 확장할 수 있습니다.

```javascript
registry.register("math/Multiply", {
  title: "Multiply",
  color: "#f43f5e", // 카테고리 컬러
  inputs: [
    { name: "a", portType: "data" },
    { name: "b", portType: "data" },
  ],
  outputs: [{ name: "result", portType: "data" }],
  // 실행 로직 정의
  onExecute(node, { getInput, setOutput }) {
    const a = getInput("a") ?? 1;
    const b = getInput("b") ?? 1;
    setOutput("result", a * b);
  },
});
```

---

## 🖼️ UI & 위젯 (HTML Overlays & Widgets)

HTML의 강점을 살려 노드 내부에 복잡한 UI를 직접 구현할 수 있습니다. `renderHtml` 함수를 통해 DOM 요소를 직접 제어하거나 내장 위젯을 사용할 수 있습니다.

```javascript
registry.register("ui/Slider", {
  html: true, // HTML 오버레이 활성화
  renderHtml(node, container) {
    container.innerHTML = `<input type="range" class="hon-slider" />`;
    const input = container.querySelector("input");
    input.oninput = (e) => {
      node.state.value = e.target.value;
      // 상태 변경 시 그래프 갱신 알림
    };
  },
});
```

---

## 🎨 CSS 디자인 토큰 (Design Tokens)

`index.css`에 정의된 CSS 변수를 덮어쓰는 것만으로도 전체 에디터의 룩앤필을 브랜드에 맞게 조정할 수 있습니다.

| 변수명              | 설명             | 기본값                   |
| :------------------ | :--------------- | :----------------------- |
| `--hon-bg`          | 캔버스 배경색    | `#0d0d0f`                |
| `--hon-node-bg`     | 노드 내부 배경색 | `#16161a`                |
| `--hon-node-border` | 노드 테두리 색상 | `rgba(255,255,255,0.08)` |
| `--hon-accent`      | 강조 포인트 컬러 | `#4f46e5`                |
| `--hon-text`        | 기본 텍스트 색상 | `#e2e8f0`                |
| `--hon-grid`        | 그리드 점 색상   | `rgba(255,255,255,0.03)` |

---

## ⌨️ 생산성 단축키

| 기능                 | 단축키                  |
| :------------------- | :---------------------- |
| **노드 삭제**        | `Delete`                |
| **수평/수직 정렬**   | `A` / `Shift + A`       |
| **그룹 생성**        | `Ctrl + G`              |
| **그리드 스냅 토글** | `G`                     |
| **실행 취소/재실행** | `Ctrl + Z` / `Ctrl + Y` |
| **미니맵 토글**      | `M`                     |

---

## 💾 데이터 직렬화 (Serialization)

그래프의 모든 상태는 JSON 형식으로 저장하고 불러올 수 있습니다.

```javascript
// 현재 캔버스 상태 저장
const snapshot = graph.toJSON();

// 데이터 복원 (트랜지션 애니메이션 포함)
graph.fromJSON(snapshot);
```

---

## 🛠️ 개발 가이드 (Development)

```bash
npm install   # 의존성 설치
npm run dev   # 개발 서버 시작
npm test      # 테스트 실행
npm run build # 프로덕션 빌드
```

---

## 📄 라이선스

[MIT](LICENSE) © cheonghakim
