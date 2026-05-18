# Free Node — HTML Overlay Node Editor

[![npm version](https://img.shields.io/npm/v/html-overlay-node.svg)](https://www.npmjs.com/package/html-overlay-node)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**Free Node** is an enterprise-grade visual node editor that combines Canvas performance with the full power of HTML/CSS for node UI.

**Free Node**는 Canvas의 고성능 렌더링과 HTML/CSS의 완전한 UI 표현력을 결합한 엔터프라이즈급 비주얼 노드 에디터입니다.

> **Live Demo** · **[https://cheonghakim.github.io/HTML-overlay-node/](https://cheonghakim.github.io/HTML-overlay-node/)**

---

## Why Free Node?

Traditional node editors force a hard choice:

- **Pure Canvas** — High performance, but extremely difficult to style or build rich interactive widgets.
- **Pure DOM** — Easy to style, but performance collapses under complex edge animations or large graphs.

**Free Node's hybrid architecture**:

- **Canvas layer** handles heavy lifting: thousands of edges, animated signal flow, background grid, minimap.
- **HTML overlay** handles UI: node bodies with inputs, sliders, buttons, dropdowns — all with full CSS power.

### 왜 Free Node인가?

기존 노드 에디터는 두 가지 선택지 사이에서 타협합니다:

- **순수 Canvas** — 성능은 좋지만 CSS 스타일링 불가, 인터랙티브 위젯 구현이 매우 어렵습니다.
- **순수 DOM** — 스타일링은 쉽지만 복잡한 그래프에서 성능이 급격히 저하됩니다.

**Free Node의 하이브리드 아키텍처**:

- **Canvas**가 무거운 작업을 담당: 수천 개의 연결선, 에메랄드 신호 애니메이션, 배경 그리드, 미니맵
- **HTML 오버레이**가 UI를 담당: 입력 폼, 슬라이더, 버튼 등 모든 CSS 위젯

---

## Key Features / 주요 기능

| Feature | 기능 |
|:--------|:-----|
| Hybrid Canvas + HTML rendering | 하이브리드 Canvas + HTML 렌더링 |
| Emerald signal flow animation | 에메랄드 신호 흐름 시각화 |
| Interactive minimap (drag & click) | 드래그/클릭 가능한 인터랙티브 미니맵 |
| Full undo / redo (Ctrl+Z / Ctrl+Y) | 완전한 실행 취소/재실행 |
| Grid snap (G key) | 정밀 그리드 스냅 |
| Node grouping (Ctrl+G) | 노드 그룹화 |
| Copy / Paste / Duplicate | 복사 / 붙여넣기 / 복제 |
| Fit to View (F key) | 전체 보기 맞춤 |
| Bezier / Orthogonal / Straight edges | 3가지 연결선 스타일 |
| Property panel (double-click node) | 속성 패널 (노드 더블클릭) |
| Sub-graph editor (nested graphs) | 서브 그래프 에디터 (중첩 그래프) |
| Read-only mode | 읽기 전용 모드 |
| Run / Step execution modes | Run / Step 실행 모드 |
| Plugin API | 플러그인 API |
| TypeScript declarations | TypeScript 타입 선언 |
| Zero dependencies | 제로 외부 의존성 |

---

## Installation / 설치

```bash
npm install html-overlay-node
```

---

## Quick Start / 빠른 시작

```javascript
import { createGraphEditor } from "html-overlay-node";
import { registerAllNodes } from "html-overlay-node/nodes";
import "html-overlay-node/index.css";
import "html-overlay-node/src/ui/PropertyPanel.css"; // required for property panel

const editor = createGraphEditor("#editor-container", {
  theme: "dark",
  showMinimap: true,
  enablePropertyPanel: true,
});

registerAllNodes(editor.registry, editor.hooks);
```

> **Note**: Both CSS files are required. `index.css` provides the core editor styles; `PropertyPanel.css` provides the property panel styles.
>
> **참고**: CSS 파일 두 개 모두 필요합니다.

---

## createGraphEditor Options / 옵션

```typescript
createGraphEditor(target, options?)
```

| Option | Type | Default | Description |
|:-------|:-----|:--------|:------------|
| `theme` | `"dark" \| "light"` | system preference | Color theme |
| `autorun` | `boolean` | `true` | Start runner automatically |
| `showMinimap` | `boolean` | `true` | Show interactive minimap |
| `enablePropertyPanel` | `boolean` | `true` | Enable property panel on double-click |
| `propertyPanelContainer` | `HTMLElement \| null` | editor container | Mount point for property panel |
| `enableHelp` | `boolean` | `true` | Show keyboard help overlay (?) |
| `helpShortcuts` | `Record<string,string> \| null` | built-in list | Override shortcut descriptions |
| `setupDefaultContextMenu` | `boolean` | `true` | Wire up built-in right-click menu |
| `setupContextMenu` | `function \| null` | `null` | Custom context menu setup |
| `plugins` | `Plugin[]` | `[]` | Plugins to install |
| `hooks` | `Hooks` | auto-created | Provide your own hooks instance |

---

## Editor API (High-Level)

The returned `editor` object exposes these properties:

```javascript
editor.graph          // Graph data model (nodes Map, edges Map)
editor.registry       // Node type registry
editor.hooks          // Event bus (on / off / emit)
editor.controller     // High-level controller — use for all mutations
editor.runner         // Execution engine
editor.renderer       // Main CanvasRenderer
editor.htmlOverlay    // HTML overlay manager
editor.subGraphPanel  // Sub-graph split-pane editor
editor.minimap        // Minimap (null if showMinimap: false)
editor.propertyPanel  // Property panel (null if disabled)
editor.contextMenu    // Context menu
editor.iconManager    // Icon manager

editor.render()                         // Force full redraw
editor.start()                          // Start runner
editor.stop()                           // Stop runner
editor.setEdgeStyle("bezier" | "orthogonal" | "line")
editor.setExecutionMode("run" | "step") // Switch execution mode
editor.destroy()                        // Full teardown
```

### Controller API (all mutations → undo history)

```javascript
const node = editor.controller.addNode("math/Multiply", {
  title: "My Multiplier",
  x: 100, y: 100,
  state: { factor: 2 },
});

editor.controller.removeNode(node.id);

editor.controller.addEdge(fromNodeId, fromPortId, toNodeId, toPortId);

editor.controller.updateNodeState(node.id, { value: 42 });

editor.controller.updateNodeProperty(node.id, "title", "New Title");

editor.controller.fitToView();    // Fit all nodes into viewport
editor.controller.autoLayout();   // Arrange nodes in a grid

editor.controller.undo();         // Ctrl+Z
editor.controller.redo();         // Ctrl+Y

editor.controller.readOnly = true; // Block all mutations; allow pan/zoom only
```

---

## Execution Modes / 실행 모드

```javascript
editor.setExecutionMode("run");  // Continuous — runner ticks every animation frame
editor.setExecutionMode("step"); // Manual — click Step button or call runner.step()
```

- **Run mode**: The runner calls `onExecute` on all exec-connected nodes every frame.
- **Step mode**: Each click advances one exec edge, highlighting the active node and edge.

---

## Hooks (Event Bus) / 이벤트 훅

```javascript
editor.hooks.on("node:create",      (node) => { ... });
editor.hooks.on("node:click",       (node) => { ... });
editor.hooks.on("node:dblclick",    (node) => { ... });
editor.hooks.on("node:move",        (node) => { ... });
editor.hooks.on("node:resize",      (node) => { ... });
editor.hooks.on("node:updated",     (node) => { ... });
editor.hooks.on("edge:create",      (edge) => { ... });
editor.hooks.on("edge:delete",      (edge) => { ... });
editor.hooks.on("graph:serialize",  (json)  => { ... });
editor.hooks.on("graph:deserialize",(json)  => { ... });
editor.hooks.on("runner:tick",      ({ time, dt }) => { ... });
editor.hooks.on("runner:start",     () => { ... });
editor.hooks.on("runner:stop",      () => { ... });
editor.hooks.on("error",            (err)  => { ... });
```

---

## Registering Custom Nodes / 커스텀 노드 등록

### Pure Logic Node

```javascript
editor.registry.register("math/Multiply", {
  title: "Multiply",
  color: "#2563eb",
  inputs: [
    { name: "exec", portType: "exec" },
    { name: "a", portType: "data", datatype: "number" },
    { name: "b", portType: "data", datatype: "number" },
  ],
  outputs: [
    { name: "exec", portType: "exec" },
    { name: "result", portType: "data", datatype: "number" },
  ],
  onExecute(node, { setOutput, getInput }) {
    const a = getInput("a") ?? node.state.a ?? 0;
    const b = getInput("b") ?? node.state.b ?? 0;
    setOutput("result", a * b);
    setOutput("exec", true);
  },
});
```

### HTML Overlay Node / HTML 오버레이 노드

Use the `html` property to render a real HTML form inside the node body.  
`node.state` is automatically serialized and included in undo/redo.

```javascript
editor.registry.register("ui/Slider", {
  title: "Value Slider",
  size: { w: 200 },
  outputs: [
    { name: "value", portType: "data", datatype: "number" },
  ],
  onCreate(node) {
    if (node.state.value === undefined) node.state.value = 50;
  },
  html: {
    init(node, el, { body, graph }) {
      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = "0";
      slider.max = "100";
      slider.value = node.state.value;
      slider.addEventListener("input", () => {
        // updateNodeState records the change in undo history
        graph.controller.updateNodeState(node.id, { value: Number(slider.value) });
      });
      body.appendChild(slider);
    },
    update(node, el, { body }) {
      const slider = body.querySelector("input");
      if (slider) slider.value = node.state.value;
    },
  },
  onExecute(node, { setOutput }) {
    setOutput("value", node.state.value);
  },
});
```

---

## Property Panel Widgets / 속성 패널 위젯

노드 정의에 `properties` 배열을 추가하면 속성 패널이 자동으로 위젯을 렌더링합니다.  
`onChange`로 값 변경 시 동작을 완전히 제어할 수 있습니다.

```javascript
editor.registry.register("audio/Gain", {
  title: "Gain",
  inputs:  [{ name: "exec", portType: "exec" }, { name: "signal", portType: "data", datatype: "number" }],
  outputs: [{ name: "exec", portType: "exec" }, { name: "out",    portType: "data", datatype: "number" }],

  properties: [
    // Slider — real-time drag feedback, undo recorded on release
    { key: "gain",   label: "Gain",    widget: "slider", min: 0, max: 2,   step: 0.01 },
    { key: "pan",    label: "Pan",     widget: "slider", min: -1, max: 1,  step: 0.01 },

    // Number input
    { key: "delay",  label: "Delay (ms)", widget: "number", min: 0, max: 5000, step: 10 },

    // Toggle (on/off)
    { key: "mute",   label: "Mute",    widget: "toggle" },

    // Dropdown
    { key: "curve",  label: "Curve",   widget: "select",
      options: ["linear", "exponential", { label: "S-Curve", value: "scurve" }] },

    // Color picker
    { key: "color",  label: "Color",   widget: "color" },

    // Multiline text
    { key: "notes",  label: "Notes",   widget: "textarea" },

    // Custom onChange — full control over what happens
    {
      key: "threshold",
      label: "Threshold",
      widget: "slider",
      min: -60, max: 0, step: 0.5,
      onChange(node, value, { controller, graph, immediate }) {
        if (immediate) {
          // Live drag: update state directly (no undo entry)
          node.state.threshold = value;
          node.state.clipping  = value > -6;
          graph.hooks.emit("node:updated", node);
        } else {
          // Committed: record in undo history
          controller.updateNodeState(node.id, {
            threshold: value,
            clipping:  value > -6,
          });
        }
      },
    },
  ],

  onCreate(node) {
    node.state.gain      ??= 1;
    node.state.pan       ??= 0;
    node.state.mute      ??= false;
    node.state.curve     ??= "linear";
    node.state.threshold ??= -12;
    node.state.clipping  ??= false;
  },

  onExecute(node, { getInput, setOutput }) {
    if (node.state.mute) { setOutput("exec", true); return; }
    const signal = getInput("signal") ?? 0;
    setOutput("out", signal * node.state.gain);
    setOutput("exec", true);
  },
});
```

### Supported Widget Types / 지원 위젯 타입

| Widget | Description | Options |
|:-------|:------------|:--------|
| `"text"` | 텍스트 입력 | `placeholder` |
| `"number"` | 숫자 입력 | `min`, `max`, `step` |
| `"slider"` | 슬라이더 (실시간 드래그) | `min`, `max`, `step` |
| `"toggle"` | 토글 스위치 | — |
| `"select"` | 드롭다운 | `options: string[] \| { label, value }[]` |
| `"color"` | 컬러 피커 | — |
| `"textarea"` | 여러 줄 텍스트 | `placeholder` |

---

## Bidirectional Binding / 양방향 데이터 바인딩

속성 패널 위젯과 `node.state`는 완전한 양방향으로 동기화됩니다.

### DOM → state (사용자 입력 → 상태 저장)

사용자가 위젯 값을 변경하면 다음 흐름으로 처리됩니다.

```
widget change event
  → commit(immediate)
      → onChange(node, value, ctx)   ← 사용자 정의 핸들러 (선택)
        OR controller.updateNodeState(node.id, { key: value })  ← 기본 동작 (undo 기록)
          → node.state[key] = value
          → hooks.emit("node:updated", node)
```

**Slider live drag**: `immediate = true` — 드래그 중엔 `node.state`를 직접 변경하고 `node:updated`를 emit합니다. Undo 히스토리에는 기록되지 않아 히스토리가 폭발하지 않습니다. 마우스를 떼는 순간 `immediate = false`로 한 번만 undo 항목이 기록됩니다.

### state → DOM (외부 상태 변경 → 위젯 동기화)

`node:updated` 훅이 발생하면 패널은 DOM을 재구성하지 않고 위젯 값만 가볍게 동기화합니다. 이는 슬라이더 조작 중 focus 손실이나 스크롤 위치 초기화를 방지합니다.

```
hooks.emit("node:updated", node)
  → _syncWidgetValues(node)  ← DOM 재구성 없이 값만 업데이트
      for each property widget:
        _setWidgetValue(element, node.state[key], widget)
```

### onExecute에서 최신 상태 반영

위젯으로 변경된 값은 즉시 `node.state`에 반영되므로 다음 `onExecute` 호출 시 최신 값을 사용합니다.

```javascript
onExecute(node, { getInput, setOutput }) {
  // node.state.gain은 슬라이더 조작 즉시 최신값 반영
  const signal = getInput("signal") ?? 0;
  setOutput("out", signal * node.state.gain);
  setOutput("exec", true);
}
```

### 외부에서 상태 직접 변경

Runner나 다른 노드에서 `node.state`를 직접 변경하고 `node:updated`를 emit하면 속성 패널 위젯이 자동 동기화됩니다.

```javascript
// 외부에서 상태 변경 후 위젯 동기화 트리거
node.state.gain = 0.5;
hooks.emit("node:updated", node);
// → 속성 패널의 gain 슬라이더가 0.5로 자동 업데이트됨
```

Undo 히스토리에도 기록하려면 `controller.updateNodeState`를 사용합니다.

```javascript
controller.updateNodeState(node.id, { gain: 0.5 });
// → node.state 업데이트 + undo 스택에 기록 + node:updated emit + 패널 동기화
```

### 완전한 바인딩 흐름 요약

```
[사용자 위젯 조작]
       ↓
  commit(immediate)
       ↓
  onChange OR updateNodeState
       ↓
  node.state[key] 업데이트
       ↓
  node:updated 훅 emit
       ↙              ↘
패널 위젯 동기화    onExecute 다음 호출시 최신값 사용
(_syncWidgetValues)    (setOutput 반영)
```

---

## Built-in Node Types / 내장 노드 타입

Register all at once:

```javascript
import { registerAllNodes } from "html-overlay-node/nodes";
registerAllNodes(editor.registry, editor.hooks);
```

Or register selectively:

```javascript
import {
  registerMathNodes,
  registerLogicNodes,
  registerValueNodes,
  registerUtilNodes,
  registerCoreNodes,
  registerSubGraphNodes,
} from "html-overlay-node/nodes";

registerMathNodes(editor.registry);    // math/Add, math/Subtract, math/Multiply, math/Divide
registerLogicNodes(editor.registry);   // logic/Branch, logic/Not, logic/And, logic/Or
registerValueNodes(editor.registry);   // value/Number, value/String, value/Boolean
registerUtilNodes(editor.registry, editor.hooks); // util/Print, util/Watch, util/Trigger, util/Delay, util/Log
registerCoreNodes(editor.registry);    // core/Note, core/HtmlNote, core/TodoNode, core/Group
registerSubGraphNodes(editor.registry); // util/SubGraph (nested graph editor)
```

---

## Sub-Graph Editor / 서브 그래프 에디터

`util/SubGraph` nodes contain a full nested graph. Clicking the expand icon opens a split-pane editor docked inside the main editor area.

```javascript
// Open the sub-graph panel programmatically
const sgNode = editor.graph.nodes.get("my-subgraph-node-id");
editor.subGraphPanel.open(sgNode, sgNode.state.subGraphData, ["Main", sgNode.title]);

// Check if the panel is open for a specific node
editor.subGraphPanel.isOpenFor("my-subgraph-node-id"); // boolean

// Close the panel (saves edited data back to the node automatically)
editor.subGraphPanel.close();

// Change dock side ("bottom" | "top" | "left" | "right")
editor.subGraphPanel.setDock("right");
```

Sub-graph execution is automatic:
- When the panel is **open**: executes live in the visible sub-editor and animates edges.
- When the panel is **closed**: executes headlessly from the node's saved `state.subGraphData`.

---

## Graph Serialization / 그래프 직렬화

```javascript
// Save
const json = editor.graph.toJSON();
localStorage.setItem("graph", JSON.stringify(json));

// Load
const json = JSON.parse(localStorage.getItem("graph"));
editor.graph.clear();
editor.graph.fromJSON(json);
editor.render();
```

Graph JSON format:

```json
{
  "version": 2,
  "meta": { "name": "My Graph", "description": "", "author": "" },
  "nodes": [ { "id": "n1", "type": "math/Add", "x": 100, "y": 100, "state": { "a": 10 } } ],
  "edges": [ { "id": "e1", "fromNode": "n1", "fromPort": "po-exec", "toNode": "n2", "toPort": "pi-exec" } ]
}
```

---

## Plugin API / 플러그인 API

```javascript
const myPlugin = {
  name: "my-plugin",
  install({ graph, registry, hooks, runner, controller, contextMenu }, options) {
    // Register custom nodes
    registry.register("my/Node", { ... });

    // Listen to events
    hooks.on("node:create", (node) => {
      console.log("Node created:", node.type);
    });

    // Add context menu items
    contextMenu.addItem({
      label: "Export selection",
      action: () => { /* ... */ },
    });
  },
};

const editor = createGraphEditor("#editor", {
  plugins: [{ ...myPlugin, options: { apiKey: "..." } }],
});
```

---

## Custom Context Menu / 커스텀 컨텍스트 메뉴

```javascript
import { setupDefaultContextMenu } from "html-overlay-node/defaults";

const editor = createGraphEditor("#editor", {
  setupDefaultContextMenu: false, // disable built-in menu
  setupContextMenu(menu, { controller, graph, hooks }) {
    setupDefaultContextMenu(menu, { controller, graph, hooks }); // include defaults
    menu.addItem({ label: "My Action", action: () => { ... } });
  },
});
```

---

## Read-Only Mode / 읽기 전용 모드

```javascript
// Block all mutations; only pan and zoom remain active
editor.controller.readOnly = true;

// Re-enable editing
editor.controller.readOnly = false;
```

---

## Edge Labels / 연결선 레이블

Edges rendered in orthogonal style show a small label at the midpoint. Port names are used as labels automatically. To customize, set `name` on the port definition:

```javascript
{ name: "result", portType: "data", datatype: "number" }
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
| Duplicate | `Ctrl + D` | 복제 |
| Group | `Ctrl + G` | 그룹화 |
| Ungroup | `Ctrl + Shift + G` | 그룹 해제 |

### View / 뷰

| Action | Shortcut | 동작 |
|:-------|:---------|:-----|
| Zoom in / out | `Ctrl + (+/-)` or `Wheel` | 확대 / 축소 |
| Fit to view | `F` | 전체 보기 맞춤 |
| Grid snap toggle | `G` | 그리드 스냅 토글 |
| Align horizontal | `A` | 수평 정렬 |
| Align vertical | `Shift + A` | 수직 정렬 |
| Pan | `Middle-button drag` | 화면 이동 |
| Help | `?` | 단축키 도움말 |

---

## TypeScript / 타입스크립트

Type declarations are included in the package:

```typescript
import { createGraphEditor, GraphEditor, GraphEditorOptions, NodeDefinition } from "html-overlay-node";

const editor: GraphEditor = createGraphEditor("#editor", {
  theme: "dark",
} satisfies GraphEditorOptions);
```

---

## Development / 개발

```bash
npm install
npm run dev          # Start dev server (localhost:5173)
npm test             # Run tests
npm run test:coverage # Coverage report
npm run build        # Production library build
BUILD_DEMO=1 npm run build # Demo build (GitHub Pages)
```

---

## License / 라이선스

[MIT](LICENSE) © cheonghakim
