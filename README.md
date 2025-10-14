# Twilio Synthetic Call Data Generator

A production-grade system for generating realistic synthetic call data using Twilio Programmable Voice and Segment CDP. Features random customer-agent pairing for realistic scenarios (including challenging interactions), AI-powered conversations with OpenAI, Voice Intelligence transcription, and ML-based customer profiling with churn risk and propensity scores.

**Architecture**: Built with production-grade patterns including comprehensive test coverage for core TwiML functions, retry logic with exponential backoff, circuit breakers, and webhook signature validation.

## 🎯 What It Does

Generates realistic synthetic call data for testing, development, and analytics:

1. **Random Pairing** - Creates realistic scenarios including challenging interactions (frustrated customers with inexperienced agents)
2. **AI Conversations** - OpenAI-powered realistic agent-customer conversations with Voice Intelligence transcription
3. **Customer Profiling** - Creates and updates Segment CDP profiles with ML scores
4. **ML Analytics** - Calculates churn risk, propensity to buy, and satisfaction scores
5. **Complete Pipeline** - End-to-end automation from pairing to analytics

## 🚀 Features

✅ **One-Command Deployment** - Pre-deployment checks + deploy + post-deployment validation
✅ **Production Testing** - Smoke tests against real Twilio and Segment APIs
✅ **Comprehensive Test Coverage** - 634 tests across unit, integration, and E2E
✅ **Realistic Pairing** - Random customer-agent matching creates diverse, realistic scenarios
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
| OpenAI GPT-4o-mini | ~1M tokens @ $0.15/1M input, $0.60/1M output | ~$0.25 |
| Twilio Sync | Included in usage | Free tier |
| Segment CDP | Up to 10K MTUs/month | Free tier |
| **Total** | | **~$7 per 100 calls** |

**Budget Planning**:
- `MAX_DAILY_CALLS=1000` (default) = ~$70/day maximum
- `MAX_DAILY_CALLS=100` = ~$7/day for testing
- Adjust `MAX_DAILY_CALLS` in `.env` to control spending

**Cost-Saving Tips**:
- Use shorter conversations for testing (set max turns in persona data)
- Start with `MAX_DAILY_CALLS=10` during development
- Monitor OpenAI usage at [platform.openai.com/usage](https://platform.openai.com/usage)
- Use Twilio's free trial credits for initial testing

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Development Tools](#development-tools)
- [Detailed Setup](#detailed-setup)
- [Development Workflow](#development-workflow)
- [Testing Strategy](#testing-strategy)
- [CI/CD Pipeline](#cicd-pipeline)
- [Project Structure](#project-structure)
- [Example Use Cases](#example-use-cases)
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
- Pairs a customer with an agent (random for realistic scenarios)
- Creates Segment CDP profiles
- Generates Twilio conference with AI conversation
- Updates profiles with ML scores (churn risk, propensity, satisfaction)

**Pairing Strategies** (configurable):
- `random` (default) - Random pairing for diverse scenarios (frustrated customer + inexperienced agent = sparks fly! 🔥)
- `frustrated` - Match difficult customers with experienced agents
- `patient` - Patient customers with any agent

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
# All tests (634 tests)
npm test

# Watch mode for development
npm run test:watch

# Coverage report
npm run test:coverage

# API tests (Newman/Postman)
npm run test:api
newman run postman/collection.json -e postman/environment.json
```

## 🚀 CI/CD Pipeline

### GitHub Actions Workflow

The CI/CD pipeline (`.github/workflows/test.yml`) automatically:

1. **Test Node.js** - Runs Jest tests with coverage
2. **Code Quality** - ESLint and Prettier validation
3. **API Testing** - Validates endpoints with Newman

### Required GitHub Secrets

Set these in your repository settings → Secrets:

```
TWILIO_ACCOUNT_SID    # Your Twilio Account SID
TWILIO_AUTH_TOKEN     # Your Twilio Auth Token
```

The `GITHUB_TOKEN` is automatically provided by GitHub Actions.

### Deployment Environments

- **Development**: `npm run twilio:deploy:dev`
- **Production**: `npm run twilio:deploy:prod`

## 📁 Project Structure

```
twilio-synthetic-call-data-generator/
├── .github/
│   ├── workflows/test.yml      # CI/CD pipeline
│   ├── ISSUE_TEMPLATE/        # Bug/feature templates
│   └── PULL_REQUEST_TEMPLATE.md
├── functions/                 # Twilio Serverless Functions
│   ├── voice-handler.js      # Conference participant routing
│   ├── transcribe.js         # Speech-to-text capture
│   ├── respond.js           # OpenAI response generation
│   ├── conference-status-webhook.js
│   ├── transcription-webhook.js
│   └── utils/               # Shared utilities
├── src/                     # Core application
│   ├── main.js             # Entry point
│   ├── personas/           # Customer/agent loaders
│   ├── pairing/            # Pairing strategies
│   ├── orchestration/      # Conference creation
│   └── segment/            # CDP integration
├── scripts/                # Deployment & validation
│   ├── pre-deployment-check.js
│   ├── post-deployment-validation.js
│   └── smoke-test.js
├── tests/                  # 634 tests (unit/integration/e2e)
├── docs/                   # Documentation
├── postman/               # API test collections
├── customers.json         # Customer personas
├── package.json          # Dependencies & scripts
└── README.md            # This file
```

## 🎯 Example Use Cases

### Generate Test Data for Analytics Pipeline
```bash
# Generate 100 synthetic calls with random pairing
node scripts/generate-bulk-calls.js --count 100 --cps 1

# Results: Recordings, transcripts, Voice Intelligence insights
# → Feeds into Segment CDP → Data warehouse → BI tools
```

### Train ML Models on Customer Service Data
```bash
# Generate diverse scenarios (frustrated + inexperienced agent, etc.)
npm run start  # Creates random pairings

# Extract Voice Intelligence operator results
# → Sentiment analysis, PII detection, call classification
# → Use for supervised ML training data
```

### Test Voice Application Changes
```bash
# Deploy new TwiML function
npm run deploy

# Validate with E2E tests
npm run smoke-test

# Generate synthetic calls to test behavior
node src/main.js
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