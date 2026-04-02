# HTML-overlay-Node

[![npm version](https://img.shields.io/npm/v/html-overlay-node.svg)](https://www.npmjs.com/package/html-overlay-node)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**HTML-overlay-Node**는 Canvas의 정밀함과 HTML의 유연함을 결합한 전문가용 노드 에디터 라이브러리입니다. 장난감 같은 디자인에서 벗어나 실제 프로덕션 환경에 적합한 날카롭고 세련된 UI/UX를 지향합니다.

---

## ⚡ 주요 특징

- **전문가급 디자인**: 2px의 날카로운 라운딩 처리와 깊이감 있는 다크 테마로 도구의 전문성을 극대화했습니다.
- **카테고리별 컬러 시스템**: Math, Logic, Data 등 노드 성격에 따른 정교한 컬러 코딩으로 복잡한 그래프의 가독성을 높였습니다.
- **강력한 듀얼 포트**: 실행 제어(Flow)를 위한 Exec 포트와 데이터 전송(Data) 포트를 분리하여 복잡한 로직 설계가 가능합니다.
- **인터랙티브 HTML 오버레이**: 노드 내부의 복잡한 UI는 HTML로, 전체 연결은 Canvas로 처리하여 성능과 확장성을 모두 잡았습니다.
- **파워 유저 생산성**: 정렬(Align), 그룹화(Group), Undo/Redo 등 실제 작업 시간을 단축해주는 풍부한 단축키를 지원합니다.
- **정밀한 시각 릴레이**: 노드 실행 상태를 보여주는 완벽하게 밀착된 테두리 애니메이션을 통해 실시간 피드백을 제공합니다.

---

## 🚀 시작하기

Vite나 Webpack 환경에서 바로 시작할 수 있습니다.

```javascript
import { createGraphEditor } from "html-overlay-node";
import "html-overlay-node/index.css";

// 단 한 줄로 에디터 초기화
const editor = createGraphEditor("#editor-container", {
  autorun: true,
  enablePropertyPanel: true
});

const { graph, registry, start } = editor;

// 노드 등록 예시 (컬러 코드 포함)
registry.register("math/Add", {
  title: "Add",
  color: "#f43f5e", // 연산 노드는 로즈 핑크
  size: { w: 180, h: 80 },
  inputs: [
    { name: "a", datatype: "number" },
    { name: "b", datatype: "number" },
  ],
  outputs: [{ name: "result", datatype: "number" }],
  onExecute(node, { getInput, setOutput }) {
    const a = getInput("a") ?? 0;
    const b = getInput("b") ?? 0;
    setOutput("result", a + b);
  },
});

start();
```

---

## 🎨 디자인 커스터마이징

다크 모드를 기본으로 하지만, 프로젝트 테마에 맞춰 모든 색상을 조정할 수 있습니다.

```javascript
const editor = createGraphEditor("#container", {
  theme: {
    bg: "#0d0d0f",
    accent: "#6366f1", // 메인 포인트 컬러
    node: "#16161a",  // 노드 배경
    title: "#1f1f24"  // 노드 헤더
  }
});
```

---

## ⌨️ 생산성을 높여주는 단축키

| 기능 | 단축키 |
| :--- | :--- |
| **노드 삭제** | `Delete` |
| **수평 정렬** | `A` |
| **수직 정렬** | `Shift + A` |
| **그룹 생성** | `Ctrl + G` |
| **그리드 스냅**| `G` |
| **되돌리기** | `Ctrl + Z` / `Ctrl + Y` |
| **영역 선택** | `Ctrl + Drag` |

---

## 💾 데이터 다루기

그래프 통째로 JSON으로 뽑거나, 저장된 데이터를 불러오는 것도 간단합니다.

```javascript
// 현재 그래프 저장
const data = graph.toJSON();

// 데이터 불러오기
graph.fromJSON(data);
```

---

## 🔗 관련 링크
- [GitHub Repository](https://github.com/cheonghakim/html-overlay-node)
- [Issue Tracker](https://github.com/cheonghakim/html-overlay-node/issues)

---

## 📄 라이선스
[MIT](LICENSE) © cheonghakim
G.md).

```bash
npm install   # Install dependencies
npm run dev   # Start dev server
npm test      # Run tests
npm run lint  # Check code quality
npm run build # Build library
```

---

## 📄 License

[MIT](LICENSE) © cheonghakim

---

## 🔗 Links

- [GitHub Repository](https://github.com/cheonghakim/html-overlay-node)
- [Issue Tracker](https://github.com/cheonghakim/html-overlay-node/issues)
- [Changelog](CHANGELOG.md)
