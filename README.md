# Twilio Synthetic Call Data Generator

A production-grade system for generating realistic synthetic call data using Twilio Programmable Voice and Segment CDP. Features intelligent customer-agent pairing, AI-powered conversations with OpenAI, Voice Intelligence transcription, and ML-based customer profiling with churn risk and propensity scores.

**Architecture**: Built with production-grade patterns including comprehensive test coverage for core TwiML functions, retry logic with exponential backoff, circuit breakers, and webhook signature validation.

## 🎯 What It Does

Generates realistic synthetic call data for testing, development, and analytics:

1. **Intelligent Pairing** - Matches customers with agents based on issue complexity and skills
2. **AI Conversations** - OpenAI-powered realistic agent-customer conversations with Voice Intelligence transcription
3. **Customer Profiling** - Creates and updates Segment CDP profiles with ML scores
4. **ML Analytics** - Calculates churn risk, propensity to buy, and satisfaction scores
5. **Complete Pipeline** - End-to-end automation from pairing to analytics

## 🚀 Features

✅ **One-Command Deployment** - Pre-deployment checks + deploy + post-deployment validation
✅ **Production Testing** - Smoke tests against real Twilio and Segment APIs
✅ **Comprehensive Test Coverage** - 634 tests across unit, integration, and E2E
✅ **Intelligent Pairing** - Frustrated customers → experienced agents
✅ **Segment CDP Integration** - Automatic profile creation and ML score updates
✅ **Twilio Serverless** - Conference webhooks and AI conversation orchestration  

## 🛠 Tech Stack

- **Backend**: Node.js 18+, Twilio Serverless Functions
- **AI**: OpenAI GPT-4o, Twilio Voice Intelligence
- **Data**: Segment CDP, Twilio Sync
- **Testing**: Jest (634 tests), Newman (Postman)
- **CI/CD**: GitHub Actions
- **Code Quality**: ESLint, Prettier

## 💰 Cost Estimation

**Per 100 synthetic calls** (assuming 2-minute average conversation):

| Service | Usage | Cost |
|---------|-------|------|
| Twilio Voice | 200 minutes @ $0.013/min | ~$2.60 |
| Twilio Voice Intelligence | 200 minutes @ $0.02/min | ~$4.00 |
| OpenAI GPT-4o | ~1,500 calls @ $0.015/1K tokens | ~$15-25 |
| Twilio Sync | Included in usage | Free tier |
| Segment CDP | Up to 10K MTUs/month | Free tier |
| **Total** | | **~$22-32 per 100 calls** |

**Budget Planning**:
- `MAX_DAILY_CALLS=1000` (default) = ~$220-320/day maximum
- `MAX_DAILY_CALLS=100` = ~$22-32/day for testing
- Adjust `MAX_DAILY_CALLS` in `.env` to control spending

**Cost-Saving Tips**:
- Use shorter conversations for testing (set max turns in persona data)
- Start with `MAX_DAILY_CALLS=10` during development
- Monitor OpenAI usage at [platform.openai.com/usage](https://platform.openai.com/usage)
- Use Twilio's free trial credits for initial testing

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Detailed Setup](#detailed-setup)
- [Development Workflow](#development-workflow)
- [Testing Strategy](#testing-strategy)
- [Automation Scripts](#automation-scripts)
- [CI/CD Pipeline](#cicd-pipeline)
- [AI Coding Agents Setup](#ai-coding-agents-setup)
- [Agent-Assisted Development](#agent-assisted-development)
- [Project Structure](#project-structure)
- [Contributing](#contributing)

## 📚 Documentation Quick Links

- **⚡ [Quick Start Guide](docs/quick-start.md)** - 5-minute setup for trying the system
- **📦 [Deployment Guide](docs/deployment-guide.md)** - Production deployment with advanced configuration
- **🏗️ [Architecture](docs/architecture.md)** - System architecture and data flow diagrams
- **🔧 [API Documentation](docs/api-documentation.md)** - Complete API reference
- **🚨 [Error Handling Guide](docs/error-handling-guide.md)** - Error handling patterns and debugging
- **📊 [Segment Setup](docs/segment-setup-guide.md)** - Configure Segment CDP integration
- **🔄 [Event Streams Setup](docs/event-streams-setup.md)** - Configure Twilio Event Streams
- **💾 [Sync Setup](docs/sync-setup-guide.md)** - Configure Twilio Sync for state management

## ⚡ Quick Start (5 Minutes)

### 1. Install & Configure

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Get from https://console.twilio.com
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here

# Get from https://app.segment.com → Sources → Node.js
SEGMENT_WRITE_KEY=your_segment_write_key_here
```

### 2. Validate Setup

```bash
# Run pre-deployment checks (validates env, tests, APIs)
npm run pre-deploy
```

**Expected:** `✓ ALL CHECKS PASSED (7/7)`

### 3. Deploy to Twilio

```bash
# Deploy with automatic validation
npm run deploy
```

This runs:
1. Pre-deployment checks
2. Twilio serverless deployment
3. Post-deployment validation

### 4. Generate Synthetic Calls

```bash
# Create your first synthetic conference
node src/main.js
```

**What happens:**
- Pairs a customer with an agent (intelligent matching)
- Creates Segment CDP profiles
- Generates Twilio conference with AI conversation
- Updates profiles with ML scores (churn risk, propensity, satisfaction)

---

**📖 For detailed instructions, see [docs/quick-start.md](docs/quick-start.md)**

---

## 🛠 Development Tools

### Deployment Automation

```bash
# Pre-deployment validation (env, tests, credentials, data files)
npm run pre-deploy

# Safe deployment with all checks
npm run deploy:safe

# Post-deployment validation
npm run post-deploy

# Smoke test (validates real APIs without deploying)
npm run smoke-test
```

### Testing

```bash
# Run all tests (634 tests, 26 suites)
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# E2E tests only
npm run test:e2e
```

### Development

```bash
# Start local Twilio serverless development server
npm run dev

# Validate customer and agent data
node scripts/validate-customers.js
node scripts/validate-agents.js
```

**Get your tokens:**
- GitHub token: [github.com/settings/tokens](https://github.com/settings/tokens)
- Twilio credentials: [console.twilio.com](https://console.twilio.com)
- OpenAI API key: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- Anthropic API key: [console.anthropic.com](https://console.anthropic.com)

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
npm run dev                # Start local Twilio Functions server
npm run build              # Run linting, tests, and formatting checks

# Testing
npm test                   # Run all Jest tests
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Generate coverage report
npm run test:api           # Run Newman API tests
uv run pytest              # Run Python tests (if applicable)

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

## 🤖 AI Coding Agents Setup

This template supports multiple AI coding assistants to maximize development productivity:

### Supported AI Agents

#### 1. **Claude Code** (Anthropic) - Primary Agent
- **Best for**: Architecture, complex logic, test-driven development
- **Setup**: Use this template directly with Claude Code CLI
- **Configuration**: Pre-configured with `.github/CLAUDE.md`

#### 2. **GitHub Copilot** (OpenAI)
- **Best for**: Code completion, boilerplate generation, quick fixes  
- **Setup**: Install VS Code extension `GitHub.copilot`
- **Configuration**: Automatically works with VS Code workspace settings

#### 3. **OpenAI Codex** (via API)
- **Best for**: Custom integrations, automated code generation scripts
- **Setup**: Add `OPENAI_API_KEY` to `.env` file
- **Configuration**: Use in custom automation scripts

#### 4. **Cursor AI** (Custom)
- **Best for**: IDE-integrated AI assistance
- **Setup**: Use Cursor IDE instead of VS Code
- **Configuration**: Workspace settings template included

### AI Agent Coordination Strategy

**For Maximum Efficiency:**

1. **Planning Phase**: Use Claude Code for architecture and specification
2. **Implementation**: Use GitHub Copilot for rapid code completion
3. **Testing**: Use Claude Code for comprehensive test generation
4. **Debugging**: Use any agent for specific error resolution
5. **Refactoring**: Use Claude Code for structural improvements

### Environment Configuration

Add AI agent credentials to your `.env` file:

```bash
# AI Coding Agents (Optional)
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
GITHUB_COPILOT_ENABLED=true
CURSOR_AI_ENABLED=false
```

### VS Code Extensions for AI

The setup script automatically configures these extensions:

```json
{
  "recommendations": [
    "GitHub.copilot",
    "GitHub.copilot-chat", 
    "ms-vscode.vscode-ai",
    "Continue.continue",
    "TabNine.tabnine-vscode"
  ]
}
```

### Agent-Specific Workflows

#### Using Claude Code
```bash
# Start with specification and planning
# Use .github/prompts/plan.md for structured planning
# Follow TDD approach with comprehensive tests
```

#### Using GitHub Copilot  
```bash
# Enable in VS Code settings
# Use for rapid code completion during implementation
# Leverage chat feature for quick explanations
```

#### Using Multiple Agents
```bash
# 1. Plan with Claude Code
# 2. Implement with Copilot completions  
# 3. Test with Claude Code comprehensive tests
# 4. Debug with any agent as needed
```

### AI Agent Best Practices

- **Context Switching**: Use different agents for different types of tasks
- **Validation**: Always run tests after AI-generated code
- **Review**: Human review of all AI-generated critical functionality
- **Iteration**: Use multiple agents to validate complex solutions

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

- **Tests Required**: Comprehensive test coverage for all code
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

**Ready to build?** Start with `git clone` and `npm run setup` - you'll be ready to party! 🚀