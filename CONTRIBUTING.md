# Contributing to Free Node

Thank you for your interest in contributing to Free Node! This document provides guidelines and instructions for contributing.

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Git

### Setup

```bash
# Clone the repository
git clone https://github.com/cheonghakim/html-overlay-node.git
cd html-overlay-node

# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test
```

## Development Workflow

### Code Style

We use ESLint and Prettier to maintain code quality:

```bash
# Check linting
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

### Testing

- Write tests for all new features
- Ensure existing tests pass before submitting PR
- Aim for high test coverage

```bash
# Run tests once
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Building

```bash
# Build the library
npm run build
```

This creates UMD and ES module builds in the `dist/` directory.

## Pull Request Process

1. **Fork the repository** and create your branch from `main`

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow the existing code style
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**

   ```bash
   npm run lint
   npm test
   npm run build
   ```

4. **Commit your changes**
   - Use clear, descriptive commit messages
   - Follow the format: `type: description`
   - Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

   Examples:

   ```
   feat: add custom node validation
   fix: resolve edge connection issue
   docs: update README with new API
   ```

5. **Push to your fork** and submit a pull request

6. **Wait for review** - maintainers will review your PR and may request changes

## Reporting Bugs

When reporting bugs, please include:

- Clear, descriptive title
- Steps to reproduce
- Expected behavior
- Actual behavior
- Browser/Node.js version
- Code sample (if applicable)

Use the GitHub issue tracker: https://github.com/cheonghakim/html-overlay-node/issues

## Feature Requests

We welcome feature requests! Please:

- Check if the feature has already been requested
- Provide clear use case and rationale
- Be open to discussion and alternatives

## Code of Conduct

### Our Standards

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Acknowledge contributions

### Unacceptable Behavior

- Harassment or discriminatory language
- Trolling or inflammatory comments
- Personal attacks
- Publishing others' private information

## Questions?

Feel free to open an issue with the `question` label or reach out to the maintainers.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
