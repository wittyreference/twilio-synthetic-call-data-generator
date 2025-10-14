# Contributing to Twilio Synthetic Call Data Generator

Thank you for your interest in contributing! This project follows Test-Driven Development (TDD) principles and maintains high code quality standards.

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18+ and npm v8+
- **Twilio Account** with credits ([sign up](https://www.twilio.com/try-twilio))
- **Segment Workspace** (free tier is fine)
- **OpenAI API Key** for AI conversations

### Setup

1. **Fork the repository**
   ```bash
   # Click "Fork" on GitHub, then:
   git clone https://github.com/YOUR-USERNAME/twilio-synthetic-call-data-generator.git
   cd twilio-synthetic-call-data-generator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

4. **Run tests**
   ```bash
   npm test
   ```

   **Expected**: All tests should pass (634 tests)

5. **Set up pre-commit hooks (optional but recommended)**
   ```bash
   # Ensure code is formatted and linted before commits
   npm run lint
   npm run format
   ```

## 🧪 Development Workflow

We practice **Test-Driven Development (TDD)**:

1. **Write a failing test first**
   ```bash
   # Create your test in tests/unit/, tests/integration/, or tests/e2e/
   npm run test:watch  # Run tests in watch mode
   ```

2. **Implement the feature**
   - Write minimal code to make the test pass
   - Follow existing code patterns
   - Add inline comments explaining WHY, not just WHAT

3. **Refactor**
   - Clean up code while keeping tests green
   - Run full test suite: `npm test`

4. **Lint and format**
   ```bash
   npm run lint:fix
   npm run format
   ```

## 📋 Code Standards

### Testing Requirements

- **All new features must have tests**
- **All tests must pass** before creating a PR
- **Coverage**: Aim for >80% on new code
- **Types of tests**:
  - Unit tests: `tests/unit/` - Test individual functions
  - Integration tests: `tests/integration/` - Test module interactions
  - E2E tests: `tests/e2e/` - Test complete workflows

### Code Style

- **ESLint**: Code must pass `npm run lint`
- **Prettier**: Code must be formatted with `npm run format`
- **Comments**:
  - All files start with 2-line `// ABOUTME:` header
  - Inline comments explain WHY, not WHAT
  - Avoid temporal references ("recently changed", "new", etc.)
- **Naming**: Use descriptive, evergreen names (no "new", "improved", etc.)

### Commit Messages

Follow conventional commit format:

```
type(scope): brief description

Longer description if needed (optional)

Fixes #123
```

**Types**: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`

**Examples**:
- `feat(pairing): add complexity-based agent matching`
- `fix(transcribe): handle empty speech results gracefully`
- `docs(readme): update cost estimation section`
- `test(respond): add tests for OpenAI error handling`

## 🔄 Pull Request Process

### Before Submitting

1. **Ensure all tests pass**
   ```bash
   npm test
   npm run test:coverage
   ```

2. **Lint and format code**
   ```bash
   npm run lint:fix
   npm run format
   ```

3. **Run pre-deployment checks**
   ```bash
   npm run pre-deploy
   ```

4. **Update documentation**
   - Update README.md if adding features
   - Update relevant docs in `/docs`
   - Add JSDoc comments for new functions

### Creating the PR

1. **Create a descriptive title**
   - Good: "Add retry logic to Twilio API calls with exponential backoff"
   - Bad: "Fix bug"

2. **Fill out the PR template** (auto-populated when you create PR)
   - Describe what changed and why
   - Link related issues
   - Add screenshots/videos for UI changes
   - List breaking changes (if any)

3. **Request review**
   - Tag relevant maintainers
   - Respond to feedback promptly
   - Make requested changes in new commits (don't force-push during review)

### PR Requirements

- ✅ All tests passing
- ✅ No lint errors
- ✅ Code formatted with Prettier
- ✅ Documentation updated
- ✅ CHANGELOG.md updated (for significant changes)
- ✅ No secrets or credentials committed

## 🐛 Reporting Bugs

**Found a bug?** Open an issue with:

1. **Clear title**: "Conference webhook fails when recording is disabled"
2. **Environment**: Node version, OS, Twilio account type
3. **Steps to reproduce**: Numbered list of exact steps
4. **Expected behavior**: What should happen
5. **Actual behavior**: What actually happens
6. **Logs/screenshots**: Include relevant error messages

**Use the bug report template** when creating issues.

## 💡 Suggesting Features

**Have an idea?** Open an issue with:

1. **Problem statement**: What problem does this solve?
2. **Proposed solution**: How would it work?
3. **Alternatives considered**: Other approaches you thought about
4. **Use cases**: Who would benefit and how?

**Use the feature request template** when creating issues.

## 📖 Documentation

Good documentation is as important as good code!

- **Code comments**: Explain complex logic
- **README updates**: For new features or changed behavior
- **API docs**: Update `/docs/api-documentation.md` for new APIs
- **Examples**: Add usage examples for new features

## 🔒 Security

**Found a security vulnerability?**

**DO NOT open a public issue.** See [SECURITY.md](SECURITY.md) for reporting instructions.

## 📜 Code of Conduct

Be respectful and constructive:

- Welcome newcomers
- Respect differing viewpoints
- Accept constructive criticism gracefully
- Focus on what's best for the community

## 🏆 Recognition

Contributors are recognized in:
- GitHub contributors page
- Release notes for significant contributions
- Special thanks in README for major features

## ❓ Questions?

- **General questions**: Open a GitHub Discussion
- **Bug reports**: Open an issue
- **Feature requests**: Open an issue
- **Security issues**: See [SECURITY.md](SECURITY.md)

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing!** 🎉

Your efforts help make this project better for everyone.
