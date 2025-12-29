# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Comprehensive test suite with Vitest
- ESLint and Prettier for code quality
- JSDoc comments for public APIs
- CI/CD with GitHub Actions
- Improved error handling and validation
- CONTRIBUTING.md for developer guidelines

### Fixed

- **BREAKING**: Fixed `Registry.unregister()` logic bug (was throwing error when type existed instead of when it didn't)
- Improved error messages with contextual information

### Changed

- Enhanced package.json with proper metadata and exports
- Improved .gitignore coverage
- Better README documentation

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

[Unreleased]: https://github.com/cheonghakim/html-overlay-node/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/cheonghakim/html-overlay-node/releases/tag/v0.0.1
