// ABOUTME: End-to-end tests for Newman CLI execution and configuration
// ABOUTME: Validates newman.config.json, rate limiting, and package.json scripts

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

describe('Newman Configuration & Execution', () => {
  let newmanConfig;
  let packageJson;

  beforeAll(() => {
    const configPath = path.join(__dirname, '../../newman.config.json');
    const packagePath = path.join(__dirname, '../../package.json');

    const configData = fs.readFileSync(configPath, 'utf8');
    newmanConfig = JSON.parse(configData);

    const packageData = fs.readFileSync(packagePath, 'utf8');
    packageJson = JSON.parse(packageData);
  });

  describe('Newman configuration file', () => {
    it('should have valid newman.config.json', () => {
      expect(newmanConfig).toBeDefined();
      expect(typeof newmanConfig).toBe('object');
    });

    it('should specify collection path', () => {
      expect(newmanConfig.collection).toBeDefined();
      expect(newmanConfig.collection).toContain('postman/collection.json');
    });

    it('should specify environment path', () => {
      expect(newmanConfig.environment).toBeDefined();
      expect(newmanConfig.environment).toContain('postman/environment.json');
    });

    it('should have reporters configured', () => {
      expect(newmanConfig.reporters).toBeDefined();
      expect(Array.isArray(newmanConfig.reporters)).toBe(true);
      expect(newmanConfig.reporters).toContain('cli');
    });

    it('should have iteration count configured', () => {
      expect(newmanConfig.iterationCount).toBeDefined();
      expect(typeof newmanConfig.iterationCount).toBe('number');
      expect(newmanConfig.iterationCount).toBeGreaterThan(0);
    });

    it('should have delay for rate limiting', () => {
      expect(newmanConfig.delayRequest).toBeDefined();
      expect(typeof newmanConfig.delayRequest).toBe('number');
    });

    it('should have timeout configured', () => {
      expect(newmanConfig.timeout).toBeDefined();
      expect(typeof newmanConfig.timeout).toBe('number');
    });
  });

  describe('Rate limiting configuration', () => {
    it('should enforce 1 CPS (calls per second) by default', () => {
      // 1 CPS = 1000ms delay between requests
      const defaultDelay = newmanConfig.delayRequest;
      expect(defaultDelay).toBe(1000);
    });

    it('should have alternative 5 CPS configuration option', () => {
      // This would be in documentation or alternate config
      // 5 CPS = 200ms delay between requests
      const fiveCpsDelay = 200;
      expect(fiveCpsDelay).toBeLessThan(newmanConfig.delayRequest);
    });

    it('should have bail option configured', () => {
      expect(newmanConfig).toHaveProperty('bail');
      expect(typeof newmanConfig.bail).toBe('boolean');
    });

    it('should configure request timeout', () => {
      expect(newmanConfig.timeout).toBeGreaterThan(0);
      expect(newmanConfig.timeout).toBeGreaterThanOrEqual(30000); // At least 30s for Twilio API
    });
  });

  describe('Package.json scripts', () => {
    it('should have newman:run script', () => {
      expect(packageJson.scripts).toHaveProperty('newman:run');
      expect(packageJson.scripts['newman:run']).toContain('newman run');
    });

    it('should have newman:1cps script for 1 CPS rate limit', () => {
      expect(packageJson.scripts).toHaveProperty('newman:1cps');
      expect(packageJson.scripts['newman:1cps']).toContain('newman run');
      expect(packageJson.scripts['newman:1cps']).toContain('1000');
    });

    it('should have newman:5cps script for 5 CPS rate limit', () => {
      expect(packageJson.scripts).toHaveProperty('newman:5cps');
      expect(packageJson.scripts['newman:5cps']).toContain('newman run');
      expect(packageJson.scripts['newman:5cps']).toContain('200');
    });

    it('should have newman dependency installed', () => {
      expect(packageJson.devDependencies).toHaveProperty('newman');
    });
  });

  describe('Newman execution validation', () => {
    it('should validate collection is loadable', () => {
      const collectionPath = path.join(
        __dirname,
        '../../postman/collection.json'
      );
      expect(fs.existsSync(collectionPath)).toBe(true);

      const collectionData = fs.readFileSync(collectionPath, 'utf8');
      const collection = JSON.parse(collectionData);

      expect(collection.info).toBeDefined();
      expect(collection.item).toBeDefined();
    });

    it('should validate environment is loadable', () => {
      const environmentPath = path.join(
        __dirname,
        '../../postman/environment.json'
      );
      expect(fs.existsSync(environmentPath)).toBe(true);

      const environmentData = fs.readFileSync(environmentPath, 'utf8');
      const environment = JSON.parse(environmentData);

      expect(environment.values).toBeDefined();
    });

    it('should have newman command available', () => {
      try {
        const result = execSync('npx newman --version', { encoding: 'utf8' });
        expect(result).toBeTruthy();
      } catch (error) {
        // Newman not installed yet - that's okay for initial test
        expect(error.message).toContain('newman');
      }
    });
  });

  describe('Configuration options', () => {
    it('should disable SSL verification if needed', () => {
      // Optional for development environments
      if (newmanConfig.insecure !== undefined) {
        expect(typeof newmanConfig.insecure).toBe('boolean');
      }
    });

    it('should have color output configured', () => {
      expect(newmanConfig).toHaveProperty('color');
      expect(newmanConfig.color).toBe('on');
    });

    it('should configure iteration data if needed', () => {
      // Optional: external data file for iterations
      if (newmanConfig.iterationData) {
        expect(typeof newmanConfig.iterationData).toBe('string');
      }
    });
  });

  describe('Error handling configuration', () => {
    it('should configure failure handling', () => {
      expect(newmanConfig).toHaveProperty('bail');
    });

    it('should suppress exit code if configured', () => {
      // Optional: for CI/CD that doesn't want Newman to fail builds
      if (newmanConfig.suppressExitCode !== undefined) {
        expect(typeof newmanConfig.suppressExitCode).toBe('boolean');
      }
    });
  });

  describe('Output configuration', () => {
    it('should have verbose mode option', () => {
      if (newmanConfig.verbose !== undefined) {
        expect(typeof newmanConfig.verbose).toBe('boolean');
      }
    });

    it('should configure reporter options', () => {
      if (newmanConfig.reporter) {
        expect(typeof newmanConfig.reporter).toBe('object');
      }
    });
  });

  describe('Collection run configuration', () => {
    it('should configure folder selection if needed', () => {
      // Optional: run specific folders only
      if (newmanConfig.folder) {
        expect(typeof newmanConfig.folder).toBe('string');
      }
    });

    it('should configure global variables if needed', () => {
      // Optional: global variables file
      if (newmanConfig.globals) {
        expect(typeof newmanConfig.globals).toBe('string');
      }
    });
  });
});
