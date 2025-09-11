// ABOUTME: Development environment setup script for new developers
// ABOUTME: Automates initial configuration and validation for the agent-assisted pipeline

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class SetupManager {
  constructor() {
    this.rootDir = process.cwd();
    this.envPath = path.join(this.rootDir, '.env');
    this.hasErrors = false;
  }

  log(message, type = 'info') {
    const symbols = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      question: '❓',
    };
    console.log(`${symbols[type]} ${message}`);
  }

  async runCommand(command, description, optional = false) {
    this.log(`Running: ${description}`, 'info');
    try {
      const result = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
      this.log(`${description} - Success`, 'success');
      return result;
    } catch (error) {
      const level = optional ? 'warning' : 'error';
      this.log(
        `${description} - ${optional ? 'Optional step failed' : 'Failed'}: ${error.message}`,
        level
      );
      if (!optional) {
        this.hasErrors = true;
      }
      return null;
    }
  }

  checkPrerequisites() {
    this.log('Checking prerequisites...', 'info');

    // Check Node.js version
    try {
      const nodeVersion = execSync('node --version', {
        encoding: 'utf8',
      }).trim();
      const majorVersion = parseInt(nodeVersion.replace('v', '').split('.')[0]);
      if (majorVersion >= 18) {
        this.log(`Node.js version: ${nodeVersion} ✓`, 'success');
      } else {
        this.log(
          `Node.js version ${nodeVersion} is too old. Requires >= 18.0.0`,
          'error'
        );
        this.hasErrors = true;
      }
    } catch (error) {
      this.log('Node.js not found. Please install Node.js >= 18.0.0', 'error');
      this.hasErrors = true;
    }

    // Check npm
    try {
      const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
      this.log(`npm version: ${npmVersion} ✓`, 'success');
    } catch (error) {
      this.log('npm not found. Please install npm', 'error');
      this.hasErrors = true;
    }

    // Check git
    try {
      const gitVersion = execSync('git --version', { encoding: 'utf8' }).trim();
      this.log(`${gitVersion} ✓`, 'success');
    } catch (error) {
      this.log('Git not found. Please install Git', 'error');
      this.hasErrors = true;
    }

    // Check Python and uv (optional for Python development)
    try {
      const pythonVersion = execSync('python3 --version', {
        encoding: 'utf8',
      }).trim();
      this.log(`${pythonVersion} ✓`, 'success');

      try {
        const uvVersion = execSync('uv --version', { encoding: 'utf8' }).trim();
        this.log(`uv ${uvVersion} ✓`, 'success');
      } catch (uvError) {
        this.log(
          'uv not found. Install with: curl -LsSf https://astral.sh/uv/install.sh | sh',
          'warning'
        );
      }
    } catch (error) {
      this.log(
        'Python3 not found (optional for Python development)',
        'warning'
      );
    }

    return !this.hasErrors;
  }

  setupEnvironmentFile() {
    this.log('Setting up environment file...', 'info');

    if (fs.existsSync(this.envPath)) {
      this.log('.env file already exists', 'warning');
      return true;
    }

    const envTemplate = `# Environment Configuration
# Copy this file to .env and fill in your actual values

# GitHub Integration
GITHUB_TOKEN=your_github_personal_access_token_here
GITHUB_OWNER=your-github-username
GITHUB_REPO=vibe-clauding

# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid_here
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here

# Development Settings
NODE_ENV=development
PORT=3000

# AI Coding Agents (Optional)
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
GITHUB_COPILOT_ENABLED=true
CURSOR_AI_ENABLED=false
`;

    try {
      fs.writeFileSync(this.envPath, envTemplate, 'utf8');
      this.log('Created .env template file', 'success');
      this.log('Please edit .env with your actual credentials', 'warning');
      return true;
    } catch (error) {
      this.log(`Failed to create .env file: ${error.message}`, 'error');
      return false;
    }
  }

  async installDependencies() {
    this.log('Installing Node.js dependencies...', 'info');

    // Install Node.js dependencies
    await this.runCommand('npm install', 'Installing npm dependencies');

    // Install Python dependencies if pyproject.toml exists
    if (fs.existsSync(path.join(this.rootDir, 'pyproject.toml'))) {
      await this.runCommand(
        'uv sync --group test --group dev',
        'Installing Python dependencies',
        true
      );
    }

    // Install global tools
    await this.runCommand(
      'npm install -g newman',
      'Installing Newman globally',
      true
    );
  }

  async setupTwilioCLI() {
    this.log('Setting up Twilio CLI...', 'info');

    // Check if Twilio CLI is installed
    try {
      const twilioVersion = execSync('twilio --version', {
        encoding: 'utf8',
      }).trim();
      this.log(`Twilio CLI: ${twilioVersion} ✓`, 'success');

      // Install serverless plugin
      await this.runCommand(
        'twilio plugins:install @twilio-labs/plugin-serverless',
        'Installing Twilio Serverless plugin',
        true
      );
    } catch (error) {
      this.log('Twilio CLI not found. Installing...', 'info');
      await this.runCommand(
        'npm install -g twilio-cli',
        'Installing Twilio CLI',
        true
      );
      await this.runCommand(
        'twilio plugins:install @twilio-labs/plugin-serverless',
        'Installing Twilio Serverless plugin',
        true
      );
    }
  }

  setupVSCodeConfig() {
    this.log('Setting up VS Code configuration...', 'info');

    const vscodeDir = path.join(this.rootDir, '.vscode');
    if (!fs.existsSync(vscodeDir)) {
      fs.mkdirSync(vscodeDir, { recursive: true });
    }

    // Copy settings template if it doesn't exist
    const settingsPath = path.join(vscodeDir, 'settings.json');
    const templatePath = path.join(vscodeDir, 'settings.json.template');

    if (!fs.existsSync(settingsPath) && fs.existsSync(templatePath)) {
      fs.copyFileSync(templatePath, settingsPath);
    }

    // Extensions file is committed, so only create if missing
    const extensionsPath = path.join(vscodeDir, 'extensions.json');
    if (!fs.existsSync(extensionsPath)) {
      const extensions = {
        recommendations: [
          'esbenp.prettier-vscode',
          'ms-vscode.vscode-typescript-next',
          'orta.vscode-jest',
          'ms-python.python',
          'ms-python.flake8',
          'ms-python.black-formatter',
          'twilio-labs.serverless-toolkit-vscode',
          'github.copilot',
          'github.copilot-chat',
          'continue.continue',
          'tabnine.tabnine-vscode',
        ],
      };

      fs.writeFileSync(
        extensionsPath,
        JSON.stringify(extensions, null, 2),
        'utf8'
      );
    }

    this.log('VS Code configuration created', 'success');
  }

  createSampleFiles() {
    this.log('Creating sample files...', 'info');

    // Create basic todo.md if it doesn't exist
    const todoPath = path.join(this.rootDir, 'todo.md');
    if (!fs.existsSync(todoPath)) {
      const todoTemplate = `# Todo List

## Setup Tasks
- [x] Run setup script
- [ ] Configure environment variables
- [ ] Set up Twilio account
- [ ] Test voice functions

## Development Tasks
- [ ] Create first Twilio Function
- [ ] Write unit tests
- [ ] Set up CI/CD pipeline
- [ ] Deploy to Twilio

## Documentation
- [ ] Update README with project specifics
- [ ] Document API endpoints
- [ ] Create user guides
`;
      fs.writeFileSync(todoPath, todoTemplate, 'utf8');
      this.log('Created sample todo.md', 'success');
    }

    // Create sample spec.md from template
    const specPath = path.join(this.rootDir, 'spec.md');
    if (!fs.existsSync(specPath)) {
      const templatePath = path.join(this.rootDir, 'templates', 'spec.md');
      if (fs.existsSync(templatePath)) {
        fs.copyFileSync(templatePath, specPath);
        this.log('Created spec.md from template', 'success');
      }
    }
  }

  async runTests() {
    this.log('Running initial tests...', 'info');

    await this.runCommand('npm test', 'Running Jest tests', true);

    if (fs.existsSync(path.join(this.rootDir, 'pyproject.toml'))) {
      await this.runCommand('uv run pytest', 'Running Python tests', true);
    }
  }

  printNextSteps() {
    this.log('\n🎉 Setup completed! Next steps:', 'success');
    console.log('');
    console.log('1. Edit .env file with your actual credentials:');
    console.log(
      '   - GITHUB_TOKEN: Create at https://github.com/settings/tokens'
    );
    console.log(
      '   - TWILIO_ACCOUNT_SID & TWILIO_AUTH_TOKEN: From Twilio Console'
    );
    console.log('');
    console.log('2. Authenticate with Twilio CLI:');
    console.log('   twilio login');
    console.log('');
    console.log('3. Start development:');
    console.log('   npm run dev          # Start Twilio Functions locally');
    console.log('   npm run test:watch   # Run tests in watch mode');
    console.log('   npm run create-issue # Create GitHub issues from todos');
    console.log('');
    console.log('4. Open in VS Code and install recommended extensions');
    console.log('');
    console.log(
      '📚 Check the templates/ directory for spec.md and prompt_plan.md examples'
    );
    console.log('📋 Update todo.md with your project tasks');
    console.log('🤖 Use the .github/prompts/ for agent-assisted development');
  }

  async run() {
    this.log('🚀 Starting Vibe Coding setup...', 'info');
    console.log('');

    // Check prerequisites
    if (!this.checkPrerequisites()) {
      this.log(
        'Prerequisites check failed. Please install missing requirements.',
        'error'
      );
      process.exit(1);
    }

    // Setup steps
    this.setupEnvironmentFile();
    await this.installDependencies();
    await this.setupTwilioCLI();
    this.setupVSCodeConfig();
    this.createSampleFiles();
    await this.runTests();

    if (this.hasErrors) {
      this.log(
        'Setup completed with some warnings. Check the output above.',
        'warning'
      );
    } else {
      this.log('Setup completed successfully!', 'success');
    }

    this.printNextSteps();
  }
}

// Run setup if called directly
if (require.main === module) {
  const setup = new SetupManager();
  setup.run().catch(error => {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  });
}

module.exports = { SetupManager };
