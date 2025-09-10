# Vibe Clauding - Agent-Assisted Development Pipeline

A production-ready template for rapid software development using AI agents, test-driven development, and automated workflows. Build Twilio Voice applications with comprehensive testing, CI/CD, and GitHub integration.

## 🚀 Features

✅ **Complete CI/CD Pipeline** - Automated testing, linting, and deployment  
✅ **Twilio Voice Integration** - Pre-configured serverless functions with TTS  
✅ **Test-Driven Development** - Jest, pytest, Newman with 80% coverage targets  
✅ **GitHub Automation** - Bidirectional sync between todos and issues  
✅ **Agent-Assisted Workflow** - Structured prompts for AI-powered development  
✅ **One-Command Setup** - Automated environment configuration  

## 🛠 Tech Stack

- **Backend**: Node.js, Twilio Functions, Python
- **Testing**: Jest, pytest, Newman (Postman)
- **CI/CD**: GitHub Actions
- **Package Management**: npm, uv
- **Code Quality**: ESLint, Prettier, Black

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Detailed Setup](#detailed-setup)
- [Development Workflow](#development-workflow)
- [Testing Strategy](#testing-strategy)
- [Automation Scripts](#automation-scripts)
- [CI/CD Pipeline](#cicd-pipeline)
- [Agent-Assisted Development](#agent-assisted-development)
- [Project Structure](#project-structure)
- [Contributing](#contributing)

## ⚡ Quick Start

### 1. Clone the Repository

```bash
# Clone this template repository
git clone https://github.com/wittyreference/vibe-clauding.git
cd vibe-clauding

# Set up your own git remote
git remote set-url origin https://github.com/wittyreference/your-project.git
```

### 2. Run Automated Setup

```bash
# This script handles everything for you
npm run setup
```

The setup script will:
- ✅ Check prerequisites (Node.js ≥18, npm, git)
- ✅ Install all dependencies (Node.js and Python)
- ✅ Create `.env` template file
- ✅ Set up Twilio CLI and serverless plugin
- ✅ Configure VS Code settings and extensions
- ✅ Create sample project files
- ✅ Run initial tests

### 3. Configure Credentials

Edit the `.env` file created by setup:

```bash
# Required for GitHub integration
GITHUB_TOKEN=your_github_personal_access_token
GITHUB_OWNER=your-github-username
GITHUB_REPO=vibe-clauding

# Required for Twilio integration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
```

**Get your tokens:**
- GitHub token: [github.com/settings/tokens](https://github.com/settings/tokens)
- Twilio credentials: [console.twilio.com](https://console.twilio.com)

### 4. Start Development

```bash
# Start Twilio Functions locally
npm run dev

# In another terminal, run tests in watch mode
npm run test:watch

# Create GitHub issues from your todos
npm run create-issue from-todos
```

## 📖 Detailed Setup

If you prefer manual setup or encounter issues:

### Prerequisites

**Required:**
- Node.js ≥18.0.0 ([nodejs.org](https://nodejs.org))
- npm ≥8.0.0 (comes with Node.js)
- Git ([git-scm.com](https://git-scm.com))

**Optional (for Python development):**
- Python 3.8+
- uv package manager: `curl -LsSf https://astral.sh/uv/install.sh | sh`

### Manual Installation Steps

1. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

2. **Install Python dependencies** (if using Python):
   ```bash
   uv sync --group test --group dev
   ```

3. **Install global tools:**
   ```bash
   npm install -g twilio-cli newman
   twilio plugins:install @twilio-labs/plugin-serverless
   ```

4. **Authenticate with Twilio:**
   ```bash
   twilio login
   ```

5. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

## 🔄 Development Workflow

### Core Commands

```bash
# Development
npm run dev                 # Start local Twilio Functions server
npm run build              # Run linting, tests, and formatting checks

# Testing
npm test                   # Run all Jest tests
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Generate coverage report
npm run test:api           # Run Newman API tests
uv run pytest             # Run Python tests (if applicable)

# Code Quality
npm run lint               # Check code quality
npm run lint:fix           # Fix linting issues automatically
npm run format             # Format code with Prettier
npm run format:check       # Check if code is formatted

# Deployment
npm run twilio:deploy      # Deploy to Twilio production
npm run twilio:deploy:dev  # Deploy to development environment
```

### Agent-Assisted Development Process

1. **Brainstorm** using `.github/prompts/brainstorm.md`
2. **Create specification** in `spec.md` 
3. **Generate plan** using `.github/prompts/plan.md` → `prompt_plan.md`
4. **Track tasks** in `todo.md`
5. **Follow TDD** with `.github/prompts/tdd.md`
6. **Sync with GitHub** using automation scripts

## 🧪 Testing Strategy

### Test-Driven Development (TDD)

We practice strict TDD with comprehensive coverage:

1. **Write failing test** (Red)
2. **Write minimal code** to pass (Green)  
3. **Refactor** while keeping tests green

### Test Types & Coverage

- **Unit Tests**: Individual function testing (Jest/pytest)
- **Integration Tests**: Component interactions
- **API Tests**: End-to-end validation (Newman)
- **Coverage Target**: >80% for all test types

### Running Tests

```bash
# Node.js tests
npm test                    # All tests
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage

# Python tests
uv run pytest              # All Python tests  
uv run pytest --cov        # With coverage
uv run pytest-watch        # Watch mode

# API tests
npm run test:api            # Run Postman collection
newman run postman/collection.json -e postman/environment.json
```

## 🤖 Automation Scripts

### GitHub Issue Management

**Create issues from todos:**
```bash
npm run create-issue from-todos    # Convert todo.md items to GitHub issues
npm run create-issue create "Title" "Body" "label1,label2"  # Custom issue
```

**Sync todos with GitHub issues:**
```bash
npm run sync-todos                 # Full bidirectional sync
npm run sync-todos todos-to-issues # One-way: todos → issues
npm run sync-todos issues-to-todos # One-way: issues → todos
```

### Project Management

The automation scripts maintain consistency between:
- `todo.md` ↔ GitHub Issues
- Local task tracking ↔ Team visibility
- Completed todos automatically close GitHub issues
- New GitHub issues appear in `todo.md`

## 🚀 CI/CD Pipeline

### GitHub Actions Workflow

Our CI/CD pipeline (`.github/workflows/ci.yml`) automatically:

1. **Test Node.js** - Runs Jest tests with coverage
2. **Test Python** - Runs pytest with coverage  
3. **API Testing** - Validates endpoints with Newman
4. **Code Quality** - ESLint, Prettier, Black formatting
5. **Sync Management** - Updates GitHub issues from todos
6. **Deploy** - Pushes to Twilio on merge to main

### Required GitHub Secrets

Set these in your repository settings → Secrets:

```
TWILIO_ACCOUNT_SID    # Your Twilio Account SID
TWILIO_AUTH_TOKEN     # Your Twilio Auth Token
```

The `GITHUB_TOKEN` is automatically provided by GitHub Actions.

### Deployment Environments

- **Development**: `npm run twilio:deploy:dev`
- **Production**: `npm run twilio:deploy:prod` (auto-deployed via CI/CD)

## 🧠 Agent-Assisted Development

### Prompt Templates

Use these structured prompts in `.github/prompts/`:

- `brainstorm.md` - Idea generation with chat models
- `plan.md` - Create detailed implementation plans  
- `tdd.md` - Test-driven development guidance
- `code-review.md` - Code quality reviews
- `do-issues.md` - GitHub issue management

### Development Templates

- `templates/spec.md` - Software specification template
- `templates/prompt_plan.md` - Implementation planning template

### Workflow Integration

1. Generate ideas → `spec.md`
2. Create implementation plan → `prompt_plan.md`  
3. Break into tasks → `todo.md`
4. Follow TDD cycle
5. Sync progress with GitHub Issues
6. Deploy via CI/CD

## 📁 Project Structure

```
vibe-clauding/
├── .github/
│   ├── workflows/ci.yml        # CI/CD pipeline
│   ├── prompts/               # Agent prompt templates
│   └── CLAUDE.md              # Claude Code configuration
├── functions/                 # Twilio Functions
│   ├── hello.js              # Voice TTS example
│   └── voice-menu.js         # Voice menu handling
├── scripts/                  # Automation utilities
│   ├── setup.js              # Development setup
│   ├── create-github-issue.js # Issue creation
│   └── sync-todos.js         # Todo-issue sync
├── tests/                    # Test files
├── templates/               # Project templates
├── postman/                 # API test collections
├── package.json             # Node.js dependencies & scripts
├── pyproject.toml          # Python dependencies & config
├── jest.config.js          # Jest test configuration
├── newman.config.json      # Newman API test config
└── README.md              # This file
```

## 🎯 Example Use Cases

### Voice Application Development
```bash
# Clone and setup
git clone <repo> && cd vibe-clauding && npm run setup

# Create voice function (TDD approach)
# 1. Write test in tests/my-function.test.js
# 2. Write function in functions/my-function.js  
# 3. Test locally: npm run dev
# 4. Deploy: npm run twilio:deploy
```

### Team Task Management
```bash
# Add tasks to todo.md
echo "- [ ] Implement user authentication" >> todo.md

# Sync with GitHub Issues
npm run sync-todos

# Mark completed in todo.md
# Issues automatically close via CI/CD
```

## 🤝 Contributing

1. **Fork** the repository
2. **Create** feature branch: `git checkout -b feature/amazing-feature`
3. **Follow TDD**: Write tests first, then implementation
4. **Run checks**: `npm run build` (linting + tests + formatting)
5. **Commit** changes: Use conventional commits
6. **Push** and create **Pull Request**

### Development Standards

- **Tests Required**: >80% coverage for all code
- **TDD Approach**: Red → Green → Refactor
- **Code Quality**: Must pass ESLint + Prettier
- **Documentation**: Update relevant docs
- **No Secrets**: Never commit credentials

## 📚 Additional Resources

- **Twilio Functions**: [twilio.com/docs/serverless](https://www.twilio.com/docs/serverless)
- **Jest Testing**: [jestjs.io](https://jestjs.io)
- **Newman API Testing**: [learning.postman.com/docs/running-collections/using-newman-cli](https://learning.postman.com/docs/running-collections/using-newman-cli)
- **GitHub Actions**: [docs.github.com/actions](https://docs.github.com/en/actions)

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Ready to build?** Start with `git clone` and `npm run setup` - you'll be coding in minutes! 🚀