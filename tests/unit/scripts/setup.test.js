// ABOUTME: Unit tests for scripts/setup.js SetupManager class
// ABOUTME: Tests environment setup, dependency installation, and configuration validation

// Mock dependencies BEFORE requiring them
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn(),
  copyFileSync: jest.fn(),
}));

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

// Now require the mocked modules
const fs = require('fs');
const child_process = require('child_process');
const { SetupManager } = require('../../../scripts/setup');

describe('SetupManager', () => {
  let setupManager;
  let consoleLogSpy;

  beforeEach(() => {
    setupManager = new SetupManager();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('checkPrerequisites', () => {
    it('should detect Node.js version correctly', () => {
      child_process.execSync.mockReturnValueOnce('v18.16.0\n');
      child_process.execSync.mockReturnValueOnce('9.5.1\n');
      child_process.execSync.mockReturnValueOnce('git version 2.39.0\n');

      const result = setupManager.checkPrerequisites();

      expect(result).toBe(true);
      expect(child_process.execSync).toHaveBeenCalledWith(
        'node --version',
        expect.any(Object)
      );
    });

    it('should fail when Node.js version < 18', () => {
      child_process.execSync.mockReturnValueOnce('v16.14.0\n');

      const result = setupManager.checkPrerequisites();

      expect(result).toBe(false);
      expect(setupManager.hasErrors).toBe(true);
    });

    it('should detect Node.js version 20 as valid', () => {
      child_process.execSync.mockReturnValueOnce('v20.10.0\n');
      child_process.execSync.mockReturnValueOnce('9.5.1\n');
      child_process.execSync.mockReturnValueOnce('git version 2.39.0\n');

      const result = setupManager.checkPrerequisites();

      expect(result).toBe(true);
      expect(setupManager.hasErrors).toBe(false);
    });

    it('should detect npm installation', () => {
      child_process.execSync.mockReturnValueOnce('v18.16.0\n');
      child_process.execSync.mockReturnValueOnce('9.5.1\n');
      child_process.execSync.mockReturnValueOnce('git version 2.39.0\n');

      setupManager.checkPrerequisites();

      expect(child_process.execSync).toHaveBeenCalledWith(
        'npm --version',
        expect.any(Object)
      );
    });

    it('should fail when npm is not installed', () => {
      child_process.execSync.mockReturnValueOnce('v18.16.0\n');
      child_process.execSync.mockImplementationOnce(() => {
        throw new Error('npm not found');
      });

      const result = setupManager.checkPrerequisites();

      expect(result).toBe(false);
      expect(setupManager.hasErrors).toBe(true);
    });

    it('should detect git installation', () => {
      child_process.execSync.mockReturnValueOnce('v18.16.0\n');
      child_process.execSync.mockReturnValueOnce('9.5.1\n');
      child_process.execSync.mockReturnValueOnce('git version 2.39.0\n');

      setupManager.checkPrerequisites();

      expect(child_process.execSync).toHaveBeenCalledWith(
        'git --version',
        expect.any(Object)
      );
    });

    it('should fail when git is not installed', () => {
      child_process.execSync.mockReturnValueOnce('v18.16.0\n');
      child_process.execSync.mockReturnValueOnce('9.5.1\n');
      child_process.execSync.mockImplementationOnce(() => {
        throw new Error('git not found');
      });

      const result = setupManager.checkPrerequisites();

      expect(result).toBe(false);
      expect(setupManager.hasErrors).toBe(true);
    });

    it('should detect Python3 and uv (optional tools)', () => {
      child_process.execSync.mockReturnValueOnce('v18.16.0\n');
      child_process.execSync.mockReturnValueOnce('9.5.1\n');
      child_process.execSync.mockReturnValueOnce('git version 2.39.0\n');
      child_process.execSync.mockReturnValueOnce('Python 3.11.0\n');
      child_process.execSync.mockReturnValueOnce('uv 0.1.0\n');

      const result = setupManager.checkPrerequisites();

      expect(result).toBe(true);
      expect(child_process.execSync).toHaveBeenCalledWith(
        'python3 --version',
        expect.any(Object)
      );
      expect(child_process.execSync).toHaveBeenCalledWith(
        'uv --version',
        expect.any(Object)
      );
    });

    it('should handle missing optional tools gracefully', () => {
      child_process.execSync.mockReturnValueOnce('v18.16.0\n');
      child_process.execSync.mockReturnValueOnce('9.5.1\n');
      child_process.execSync.mockReturnValueOnce('git version 2.39.0\n');
      child_process.execSync.mockImplementationOnce(() => {
        throw new Error('python3 not found');
      });

      const result = setupManager.checkPrerequisites();

      expect(result).toBe(true);
      expect(setupManager.hasErrors).toBe(false);
    });

    it('should handle missing uv when Python exists', () => {
      child_process.execSync.mockReturnValueOnce('v18.16.0\n');
      child_process.execSync.mockReturnValueOnce('9.5.1\n');
      child_process.execSync.mockReturnValueOnce('git version 2.39.0\n');
      child_process.execSync.mockReturnValueOnce('Python 3.11.0\n');
      child_process.execSync.mockImplementationOnce(() => {
        throw new Error('uv not found');
      });

      const result = setupManager.checkPrerequisites();

      expect(result).toBe(true);
    });
  });

  describe('setupEnvironmentFile', () => {
    it('should create .env file from template when it does not exist', () => {
      fs.existsSync.mockReturnValue(false);
      fs.writeFileSync.mockImplementation(() => {});

      const result = setupManager.setupEnvironmentFile();

      expect(result).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.env'),
        expect.stringContaining('GITHUB_TOKEN'),
        'utf8'
      );
    });

    it('should not overwrite existing .env file', () => {
      fs.existsSync.mockReturnValue(true);

      const result = setupManager.setupEnvironmentFile();

      expect(result).toBe(true);
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should write correct environment variable template', () => {
      fs.existsSync.mockReturnValue(false);
      let writtenContent;
      fs.writeFileSync.mockImplementation((path, content) => {
        writtenContent = content;
      });

      setupManager.setupEnvironmentFile();

      expect(writtenContent).toContain('GITHUB_TOKEN=');
      expect(writtenContent).toContain('TWILIO_ACCOUNT_SID=');
      expect(writtenContent).toContain('TWILIO_AUTH_TOKEN=');
      expect(writtenContent).toContain('NODE_ENV=development');
    });

    it('should handle filesystem errors gracefully', () => {
      fs.existsSync.mockReturnValue(false);
      fs.writeFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = setupManager.setupEnvironmentFile();

      expect(result).toBe(false);
    });
  });

  describe('installDependencies', () => {
    it('should run npm install successfully', async () => {
      child_process.execSync.mockReturnValue('');
      fs.existsSync.mockReturnValue(false);

      await setupManager.installDependencies();

      expect(child_process.execSync).toHaveBeenCalledWith(
        'npm install',
        expect.any(Object)
      );
    });

    it('should install Python dependencies when pyproject.toml exists', async () => {
      child_process.execSync.mockReturnValue('');
      fs.existsSync.mockImplementation(filePath => {
        return filePath.includes('pyproject.toml');
      });

      await setupManager.installDependencies();

      expect(child_process.execSync).toHaveBeenCalledWith(
        'uv sync --group test --group dev',
        expect.any(Object)
      );
    });

    it('should skip Python dependencies when pyproject.toml does not exist', async () => {
      child_process.execSync.mockReturnValue('');
      fs.existsSync.mockReturnValue(false);

      await setupManager.installDependencies();

      expect(child_process.execSync).not.toHaveBeenCalledWith(
        expect.stringContaining('uv sync'),
        expect.any(Object)
      );
    });

    it('should install Newman globally (optional)', async () => {
      child_process.execSync.mockReturnValue('');
      fs.existsSync.mockReturnValue(false);

      await setupManager.installDependencies();

      expect(child_process.execSync).toHaveBeenCalledWith(
        'npm install -g newman',
        expect.any(Object)
      );
    });

    it('should handle npm install failures', async () => {
      child_process.execSync.mockImplementation(cmd => {
        if (cmd === 'npm install') {
          throw new Error('npm install failed');
        }
        return '';
      });
      fs.existsSync.mockReturnValue(false);

      await setupManager.installDependencies();

      expect(setupManager.hasErrors).toBe(true);
    });
  });

  describe('setupTwilioCLI', () => {
    it('should detect existing Twilio CLI installation', async () => {
      child_process.execSync.mockReturnValueOnce('twilio-cli/5.2.0\n');
      child_process.execSync.mockReturnValueOnce('');

      await setupManager.setupTwilioCLI();

      expect(child_process.execSync).toHaveBeenCalledWith(
        'twilio --version',
        expect.any(Object)
      );
    });

    it('should install Twilio CLI when not found', async () => {
      child_process.execSync.mockImplementationOnce(() => {
        throw new Error('twilio: command not found');
      });
      child_process.execSync.mockReturnValue('');

      await setupManager.setupTwilioCLI();

      expect(child_process.execSync).toHaveBeenCalledWith(
        'npm install -g twilio-cli',
        expect.any(Object)
      );
    });

    it('should install serverless plugin', async () => {
      child_process.execSync.mockReturnValueOnce('twilio-cli/5.2.0\n');
      child_process.execSync.mockReturnValueOnce('');

      await setupManager.setupTwilioCLI();

      expect(child_process.execSync).toHaveBeenCalledWith(
        'twilio plugins:install @twilio-labs/plugin-serverless',
        expect.any(Object)
      );
    });

    it('should handle installation failures gracefully', async () => {
      child_process.execSync.mockImplementation(() => {
        throw new Error('Installation failed');
      });

      await setupManager.setupTwilioCLI();

      // Should not throw, handles errors gracefully
      expect(true).toBe(true);
    });
  });

  describe('setupVSCodeConfig', () => {
    it('should create .vscode directory if it does not exist', () => {
      fs.existsSync.mockReturnValue(false);
      fs.mkdirSync.mockImplementation(() => {});
      fs.writeFileSync.mockImplementation(() => {});

      setupManager.setupVSCodeConfig();

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('.vscode'),
        expect.any(Object)
      );
    });

    it('should create extensions.json with correct recommendations', () => {
      fs.existsSync.mockImplementation(filePath => {
        return !filePath.includes('extensions.json');
      });
      fs.mkdirSync.mockImplementation(() => {});
      let extensionsContent;
      fs.writeFileSync.mockImplementation((path, content) => {
        if (path.includes('extensions.json')) {
          extensionsContent = content;
        }
      });

      setupManager.setupVSCodeConfig();

      const parsed = JSON.parse(extensionsContent);
      expect(parsed.recommendations).toContain('github.copilot');
      expect(parsed.recommendations).toContain(
        'twilio-labs.serverless-toolkit-vscode'
      );
    });

    it('should copy settings template if available', () => {
      fs.existsSync.mockImplementation(filePath => {
        if (filePath.includes('settings.json.template')) return true;
        if (filePath.includes('settings.json')) return false;
        return true;
      });
      fs.mkdirSync.mockImplementation(() => {});
      fs.copyFileSync.mockImplementation(() => {});
      fs.writeFileSync.mockImplementation(() => {});

      setupManager.setupVSCodeConfig();

      expect(fs.copyFileSync).toHaveBeenCalled();
    });

    it('should not overwrite existing settings.json', () => {
      fs.existsSync.mockReturnValue(true);
      fs.copyFileSync.mockImplementation(() => {});
      fs.writeFileSync.mockImplementation(() => {});

      setupManager.setupVSCodeConfig();

      expect(fs.copyFileSync).not.toHaveBeenCalled();
    });
  });

  describe('createSampleFiles', () => {
    it('should create todo.md when it does not exist', () => {
      fs.existsSync.mockReturnValue(false);
      fs.writeFileSync.mockImplementation(() => {});

      setupManager.createSampleFiles();

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('todo.md'),
        expect.stringContaining('# Todo List'),
        'utf8'
      );
    });

    it('should not overwrite existing todo.md', () => {
      fs.existsSync.mockImplementation(filePath => {
        return filePath.includes('todo.md');
      });
      fs.writeFileSync.mockImplementation(() => {});
      fs.copyFileSync.mockImplementation(() => {});

      setupManager.createSampleFiles();

      expect(fs.writeFileSync).not.toHaveBeenCalledWith(
        expect.stringContaining('todo.md'),
        expect.any(String),
        expect.any(String)
      );
    });

    it('should copy spec.md from template', () => {
      fs.existsSync.mockImplementation(filePath => {
        if (filePath.includes('spec.md') && !filePath.includes('template'))
          return false;
        if (filePath.includes('templates/spec.md')) return true;
        return false;
      });
      fs.copyFileSync.mockImplementation(() => {});
      fs.writeFileSync.mockImplementation(() => {});

      setupManager.createSampleFiles();

      expect(fs.copyFileSync).toHaveBeenCalled();
    });

    it('should handle missing template files', () => {
      fs.existsSync.mockReturnValue(false);
      fs.writeFileSync.mockImplementation(() => {});

      setupManager.createSampleFiles();

      expect(fs.copyFileSync).not.toHaveBeenCalled();
    });
  });

  describe('runTests', () => {
    it('should run Jest tests', async () => {
      child_process.execSync.mockReturnValue('');
      fs.existsSync.mockReturnValue(false);

      await setupManager.runTests();

      expect(child_process.execSync).toHaveBeenCalledWith(
        'npm test',
        expect.any(Object)
      );
    });

    it('should run pytest when pyproject.toml exists', async () => {
      child_process.execSync.mockReturnValue('');
      fs.existsSync.mockReturnValue(true);

      await setupManager.runTests();

      expect(child_process.execSync).toHaveBeenCalledWith(
        'uv run pytest',
        expect.any(Object)
      );
    });

    it('should handle test failures gracefully', async () => {
      child_process.execSync.mockImplementation(() => {
        throw new Error('Tests failed');
      });
      fs.existsSync.mockReturnValue(false);

      await setupManager.runTests();

      // Should not throw, tests are optional
      expect(true).toBe(true);
    });
  });

  describe('runCommand', () => {
    it('should execute commands successfully', async () => {
      child_process.execSync.mockReturnValue('command output');

      const result = await setupManager.runCommand('echo test', 'Test command');

      expect(result).toBe('command output');
      expect(child_process.execSync).toHaveBeenCalledWith(
        'echo test',
        expect.any(Object)
      );
    });

    it('should capture command output', async () => {
      const output = 'successful execution';
      child_process.execSync.mockReturnValue(output);

      const result = await setupManager.runCommand(
        'some command',
        'Description'
      );

      expect(result).toBe(output);
    });

    it('should handle optional commands differently', async () => {
      child_process.execSync.mockImplementation(() => {
        throw new Error('Command failed');
      });

      const result = await setupManager.runCommand(
        'optional-cmd',
        'Optional command',
        true
      );

      expect(result).toBe(null);
      expect(setupManager.hasErrors).toBe(false);
    });

    it('should set hasErrors flag for failed non-optional commands', async () => {
      child_process.execSync.mockImplementation(() => {
        throw new Error('Command failed');
      });

      const result = await setupManager.runCommand(
        'required-cmd',
        'Required command',
        false
      );

      expect(result).toBe(null);
      expect(setupManager.hasErrors).toBe(true);
    });
  });

  describe('log', () => {
    it('should log info messages with info symbol', () => {
      setupManager.log('Test message', 'info');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Test message')
      );
    });

    it('should log success messages with success symbol', () => {
      setupManager.log('Success', 'success');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Success')
      );
    });

    it('should log error messages with error symbol', () => {
      setupManager.log('Error occurred', 'error');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error occurred')
      );
    });

    it('should log warning messages with warning symbol', () => {
      setupManager.log('Warning', 'warning');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Warning')
      );
    });
  });
});
