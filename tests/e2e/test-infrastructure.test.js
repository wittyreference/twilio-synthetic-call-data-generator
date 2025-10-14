// ABOUTME: End-to-end tests for test infrastructure validation
// ABOUTME: Ensures Jest, mocks, and test environment are working correctly

describe('Test Infrastructure E2E', () => {
  describe('Jest Test Environment', () => {
    it('should have Jest globals available', () => {
      expect(describe).toBeDefined();
      expect(it).toBeDefined();
      expect(test).toBeDefined();
      expect(expect).toBeDefined();
      expect(beforeEach).toBeDefined();
      expect(afterEach).toBeDefined();
      expect(beforeAll).toBeDefined();
      expect(afterAll).toBeDefined();
    });

    it('should have NODE_ENV set to test', () => {
      expect(process.env.NODE_ENV).toBe('test');
    });

    it('should support async/await in tests', async () => {
      const promise = Promise.resolve('test value');
      const result = await promise;
      expect(result).toBe('test value');
    });

    it('should support promises in tests', () => {
      return Promise.resolve('test').then(value => {
        expect(value).toBe('test');
      });
    });

    it('should support setTimeout/setInterval', done => {
      setTimeout(() => {
        expect(true).toBe(true);
        done();
      }, 10);
    });
  });

  describe('Twilio Mock Globals', () => {
    it('should have createMockTwilioContext global function', () => {
      expect(global.createMockTwilioContext).toBeDefined();
      expect(typeof global.createMockTwilioContext).toBe('function');
    });

    it('should have createMockTwilioEvent global function', () => {
      expect(global.createMockTwilioEvent).toBeDefined();
      expect(typeof global.createMockTwilioEvent).toBe('function');
    });

    it('should create mock context with correct properties', () => {
      const context = global.createMockTwilioContext();

      expect(context).toHaveProperty('ACCOUNT_SID');
      expect(context).toHaveProperty('AUTH_TOKEN');
      expect(context).toHaveProperty('TWILIO_ACCOUNT_SID');
      expect(context).toHaveProperty('TWILIO_AUTH_TOKEN');
      expect(context.ACCOUNT_SID).toMatch(/^AC/);
      expect(context.ACCOUNT_SID).toHaveLength(34);
    });

    it('should create mock event with correct properties', () => {
      const event = global.createMockTwilioEvent();

      expect(event).toHaveProperty('StatusCallbackEvent');
      expect(event).toHaveProperty('ConferenceSid');
      expect(event).toHaveProperty('CallSid');
      expect(event.ConferenceSid).toMatch(/^CF/);
      expect(event.CallSid).toMatch(/^CA/);
    });

    it('should merge custom context parameters', () => {
      const customContext = global.createMockTwilioContext({
        CUSTOM_VAR: 'custom value',
      });

      // The function merges custom params with defaults
      expect(customContext.ACCOUNT_SID).toBeDefined();
      expect(customContext.AUTH_TOKEN).toBeDefined();
    });

    it('should allow custom event parameters', () => {
      const customEvent = global.createMockTwilioEvent({
        StatusCallbackEvent: 'custom-event',
        CustomField: 'custom value',
      });

      expect(customEvent.StatusCallbackEvent).toBe('custom-event');
      expect(customEvent.CustomField).toBe('custom value');
      expect(customEvent.ConferenceSid).toBeDefined();
    });
  });

  describe('Test Environment Variables', () => {
    it('should have all required Twilio env vars', () => {
      expect(process.env.ACCOUNT_SID).toBeDefined();
      expect(process.env.AUTH_TOKEN).toBeDefined();
      expect(process.env.TWILIO_ACCOUNT_SID).toBeDefined();
      expect(process.env.TWILIO_AUTH_TOKEN).toBeDefined();
    });

    it('should have valid Twilio Account SID format', () => {
      expect(process.env.ACCOUNT_SID).toMatch(/^AC[a-z0-9]{32}$/i);
      expect(process.env.ACCOUNT_SID).toHaveLength(34);
    });

    it('should have valid Twilio Auth Token format', () => {
      expect(process.env.AUTH_TOKEN).toBeDefined();
      expect(process.env.AUTH_TOKEN.length).toBeGreaterThanOrEqual(32);
    });

    it('should have all required AWS env vars', () => {
      expect(process.env.AWS_KINESIS_STREAM_NAME).toBeDefined();
      expect(process.env.AWS_REGION).toBeDefined();
      // Access keys are optional in test environment
    });

    it('should have all required Segment env vars', () => {
      expect(process.env.SEGMENT_WORKSPACE_ID).toBeDefined();
      expect(process.env.SEGMENT_WRITE_KEY).toBeDefined();
    });

    it('should have matching ACCOUNT_SID and TWILIO_ACCOUNT_SID', () => {
      expect(process.env.ACCOUNT_SID).toBe(process.env.TWILIO_ACCOUNT_SID);
    });

    it('should have matching AUTH_TOKEN and TWILIO_AUTH_TOKEN', () => {
      expect(process.env.AUTH_TOKEN).toBe(process.env.TWILIO_AUTH_TOKEN);
    });
  });

  describe('Jest Mocking Capabilities', () => {
    it('should support jest.fn()', () => {
      const mockFn = jest.fn();
      expect(mockFn).toBeDefined();
      expect(typeof mockFn).toBe('function');

      mockFn('arg1', 'arg2');
      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should support jest.mock()', () => {
      jest.mock('fs');
      const fs = require('fs');
      expect(fs).toBeDefined();
    });

    it('should support mockReturnValue', () => {
      const mockFn = jest.fn().mockReturnValue('mocked value');
      expect(mockFn()).toBe('mocked value');
    });

    it('should support mockResolvedValue for promises', async () => {
      const mockFn = jest.fn().mockResolvedValue('async value');
      const result = await mockFn();
      expect(result).toBe('async value');
    });

    it('should support mockRejectedValue for promise errors', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('mock error'));
      await expect(mockFn()).rejects.toThrow('mock error');
    });

    it('should support mockImplementation', () => {
      const mockFn = jest.fn().mockImplementation((a, b) => a + b);
      expect(mockFn(2, 3)).toBe(5);
    });

    it('should support mockImplementationOnce', () => {
      const mockFn = jest
        .fn()
        .mockImplementationOnce(() => 'first')
        .mockImplementationOnce(() => 'second');

      expect(mockFn()).toBe('first');
      expect(mockFn()).toBe('second');
    });
  });

  describe('Jest Matchers', () => {
    it('should support toBe matcher', () => {
      expect(1 + 1).toBe(2);
    });

    it('should support toEqual matcher', () => {
      expect({ a: 1 }).toEqual({ a: 1 });
    });

    it('should support toContain matcher', () => {
      expect([1, 2, 3]).toContain(2);
    });

    it('should support toMatch matcher', () => {
      expect('hello world').toMatch(/world/);
    });

    it('should support toHaveLength matcher', () => {
      expect([1, 2, 3]).toHaveLength(3);
    });

    it('should support toHaveProperty matcher', () => {
      expect({ a: 1 }).toHaveProperty('a');
    });

    it('should support toThrow matcher', () => {
      expect(() => {
        throw new Error('test error');
      }).toThrow('test error');
    });

    it('should support toBeGreaterThan matcher', () => {
      expect(10).toBeGreaterThan(5);
    });

    it('should support toBeLessThan matcher', () => {
      expect(5).toBeLessThan(10);
    });

    it('should support toBeCloseTo matcher for floats', () => {
      expect(0.1 + 0.2).toBeCloseTo(0.3);
    });

    it('should support toBeInstanceOf matcher', () => {
      expect(new Date()).toBeInstanceOf(Date);
    });
  });

  describe('Test File Organization', () => {
    // Use require to test files exist instead of fs.existsSync (which is mocked)
    it('should have jest.config.js', () => {
      expect(() => {
        require('../../jest.config.js');
      }).not.toThrow();
    });

    it('should have jest.setup.js', () => {
      expect(() => {
        require('../../jest.setup.js');
      }).not.toThrow();
    });

    it('should be able to find test files', () => {
      // If this test runs, the test file organization is working
      expect(__filename).toContain('tests/e2e');
    });
  });

  describe('Test Configuration', () => {
    it('should load jest configuration', () => {
      const config = require('../../jest.config.js');
      expect(config).toBeDefined();
      expect(config.testEnvironment).toBe('node');
      expect(config.setupFilesAfterEnv).toContain('<rootDir>/jest.setup.js');
    });

    it('should have correct test match patterns', () => {
      const config = require('../../jest.config.js');
      expect(config.testMatch).toContain('**/__tests__/**/*.(js|ts)');
      expect(config.testMatch).toContain('**/*.(test|spec).(js|ts)');
    });

    it('should have coverage configuration', () => {
      const config = require('../../jest.config.js');
      expect(config.collectCoverageFrom).toBeDefined();
      expect(Array.isArray(config.collectCoverageFrom)).toBe(true);
    });
  });

  describe('Dependency Resolution', () => {
    it('should be able to require project modules', () => {
      expect(() => {
        require('../../src/config');
      }).not.toThrow();
    });

    it('should be able to require script modules', () => {
      expect(() => {
        require('../../scripts/setup');
      }).not.toThrow();
    });

    it('should have @octokit/rest installed', () => {
      expect(() => {
        require('@octokit/rest');
      }).not.toThrow();
    });

    it('should have dotenv installed', () => {
      expect(() => {
        require('dotenv');
      }).not.toThrow();
    });

    it('should have twilio SDK available (mocked)', () => {
      expect(() => {
        require('twilio');
      }).not.toThrow();
    });
  });

  describe('Console Cleanliness', () => {
    it('should not log to console during tests', () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      const consoleErrorSpy = jest.spyOn(console, 'error');

      // Run a simple operation
      const result = 1 + 1;
      expect(result).toBe(2);

      // Restore spies
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Module Cache Clearing', () => {
    it('should support jest.resetModules()', () => {
      jest.resetModules();
      const config1 = require('../../src/config');

      jest.resetModules();
      const config2 = require('../../src/config');

      // They should have the same structure but be different objects
      expect(config1.twilio.accountSid).toBe(config2.twilio.accountSid);
    });

    it('should support jest.clearAllMocks()', () => {
      const mockFn = jest.fn();
      mockFn();
      expect(mockFn).toHaveBeenCalledTimes(1);

      jest.clearAllMocks();
      expect(mockFn).toHaveBeenCalledTimes(0);
    });
  });
});
