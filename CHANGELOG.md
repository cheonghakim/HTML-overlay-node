# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-06-26

### Added

- **HiDPI / Retina rendering** — `devicePixelRatio` composited into every canvas transform matrix; all displays now render at native physical resolution (`CanvasRenderer.js`)
  > HiDPI / Retina 지원 — 모든 캔버스 변환 행렬에 `devicePixelRatio` 합성; 레티나 디스플레이에서 선명한 렌더링
- **Node search spotlight** (`Ctrl+K`) — glass-morphism overlay with live filtering and click-to-center; accessible from View menu (`index.html`, `index.css`)
  > 노드 검색 스포트라이트 (`Ctrl+K`) — 글래스모피즘 오버레이, 실시간 필터링, 클릭하여 노드 중앙 이동
- **Tab / Shift+Tab keyboard navigation** — cycles through all non-group nodes, centers viewport on each (`Controller.js`)
  > Tab / Shift+Tab 키보드 탐색 — 모든 노드를 순환하며 뷰포트 중앙 이동
- **Edit menu** in menu bar — Undo, Redo, Copy, Paste, Duplicate, Select All, Delete; all actions wired to `Controller` directly (`index.html`)
  > 메뉴바 편집 메뉴 — 실행취소, 재실행, 복사, 붙여넣기, 복제, 전체 선택, 삭제
- **Schema migration chain** in `Graph._migrate()` — forward-only declarative registry (`Graph._migrations` array) replaces the previous hardcoded `if (ver < 2)` block (`Graph.js`)
  > `Graph._migrate()` 선언적 마이그레이션 체인 — 하드코딩된 버전 분기 대신 `_migrations` 배열 레지스트리
- `CanvasRenderer.width` / `CanvasRenderer.height` getters — expose logical (CSS-pixel) dimensions; all internal viewport math now uses these instead of `canvas.width/height`
- `CanvasRenderer.clear()` — physical-pixel clear method that works regardless of current transform state
- `Controller._deleteSelection()` — extracted delete logic, callable from Edit menu without focus guard
- `Controller._panToNode(node)` — centers viewport on a given node; used by Tab nav and search spotlight

### Fixed

- **Minimap memory leak** — `window.addEventListener('mousemove/mouseup')` listeners now stored as `_onWindowMouseMove/Up` and removed in `destroy()` (`Minimap.js`)
  > 미니맵 메모리 누수 — `window` 리스너 참조 저장 후 `destroy()`에서 제거
- **SubGraphPanel drag listener leak** — `_onResizeMove` / `_onResizeUp` unconditionally removed in `destroy()`, preventing leak on mid-drag destroy (`SubGraphPanel.js`)
  > SubGraphPanel 드래그 리스너 누수 수정
- **Grid gradient GC pressure** — background `linearGradient` and `radialGradient` objects are now cached in `_gridGradientCache` and only recreated on `resize()`; eliminates per-frame allocation (`CanvasRenderer.js`)
  > 배경 그라디언트 매 프레임 재생성 문제 — `_gridGradientCache`로 캐싱, `resize()` 시에만 무효화
- **`_edgeInView()` null crash** — added guard `if (!from?.computed || !to?.computed) return true` to prevent crash during node deletion (`CanvasRenderer.js`)
  > 노드 삭제 중 `_edgeInView()` 크래시 방지
- **Menu bar hover dead zone** — `::before` pseudo-element bridge fills the 5 px gap between `.mb-item` and `.mb-dropdown`, preventing hover loss when moving the mouse into the dropdown (`index.css`)
  > 메뉴바 드롭다운 호버 사각지대 — `::before` 가상 요소로 버튼과 드롭다운 사이 갭 연결
- **Logical vs physical pixel confusion** — `canvas.width/height` (physical) replaced with `renderer.width/height` (logical CSS pixels) in all viewport-math callsites across `Controller.js`, `HtmlOverlay.js`, `SubGraphPanel.js`, `Minimap.js`
  > 뷰포트 계산의 물리/논리 픽셀 혼동 수정 — 관련 파일 전체에서 논리 픽셀 접근자로 교체

### Changed

- `CanvasRenderer.resize(w, h)` sets physical canvas buffer (`w × dpr`, `h × dpr`) while storing logical dimensions and writing CSS `style.width/height`
- `CanvasRenderer._applyTransform()` and `_resetTransform()` now compose `devicePixelRatio` into every `setTransform` call for crisp HiDPI output
- `CanvasRenderer.drawGrid()` uses `this.width/height` (logical) for all fill and gradient coordinate math

## [0.3.3] - 2025-11-xx

### Added

- Active node border highlight and selection animation
- Property panel redesign with enterprise style
- Top menu bar redesign (OS app–style glass-morphism)
- Context menu refinement

## [0.3.2] - 2025-xx-xx

### Added

- Radio button and checkbox group widgets on node property panel

## [0.3.1] - 2025-xx-xx

### Changed

- Maximum canvas size adjustment
- Canvas fit improvements

## [0.3.0] - 2025-xx-xx

### Added

- `SubGraphPanel` — resizable inline panel for editing nested graphs
- `SubNodePanel` — sub-node property editing

## [0.2.0] - 2025-xx-xx

### Added

- Modular graph editor architecture
- Canvas-based node rendering engine
- Node-logic execution system
- Minimap navigation
- Interactive UI components

## [0.0.1] - 2025-11-26

### Added

- Initial release
- Canvas-based node rendering
- Node type registration system
- Graph execution engine with double buffering
- HTML overlay support for custom UIs
- Group/parent-child node hierarchies
- Mouse interaction (pan, zoom, drag)
- Serialization/deserialization support
- Built-in node types: Note, HtmlNote, TodoNode, Group
- Hooks system for extensibility

[Unreleased]: https://github.com/cheonghakim/html-overlay-node/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/cheonghakim/html-overlay-node/compare/v0.3.3...v1.0.0
[0.3.3]: https://github.com/cheonghakim/html-overlay-node/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/cheonghakim/html-overlay-node/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/cheonghakim/html-overlay-node/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/cheonghakim/html-overlay-node/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/cheonghakim/html-overlay-node/compare/v0.0.1...v0.2.0
[0.0.1]: https://github.com/cheonghakim/html-overlay-node/releases/tag/v0.0.1
