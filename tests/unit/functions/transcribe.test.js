// ABOUTME: Unit tests for transcribe function
// ABOUTME: Tests <Gather> configuration and conversation history handling

const path = require('path');

// Mock Runtime.getFunctions BEFORE requiring the function
global.Runtime = {
  getFunctions: () => ({
    'utils/persona-loader': {
      path: path.join(__dirname, '../../../functions/utils/persona-loader'),
    },
    'utils/url-builder': {
      path: path.join(__dirname, '../../../functions/utils/url-builder'),
    },
    'utils/webhook-validator': {
      path: path.join(__dirname, '../../../functions/utils/webhook-validator'),
    },
  }),
};

// Mock persona-loader
const mockLoadPersona = jest.fn();
jest.mock(
  '../../../functions/utils/persona-loader',
  () => ({
    loadPersona: mockLoadPersona,
  }),
  { virtual: true }
);

// NOW require the function after mocks are set up
const transcribe = require('../../../functions/transcribe');

describe('Transcribe Function', () => {
  let mockContext;
  let mockEvent;
  let mockCallback;
  let mockResponse;

  beforeEach(() => {
    // Mock Twilio Response
    mockResponse = {
      headers: {},
      body: '',
      statusCode: 200,
      appendHeader: jest.fn(function (key, value) {
        this.headers[key] = value;
        return this;
      }),
      setBody: jest.fn(function (body) {
        this.body = body;
        return this;
      }),
      setStatusCode: jest.fn(function (code) {
        this.statusCode = code;
        return this;
      }),
    };

    // Store the last created TwiML instance
    let lastTwimlInstance;

    // Mock Twilio global
    global.Twilio = {
      twiml: {
        VoiceResponse: jest.fn().mockImplementation(function () {
          this.gatherCalled = false;
          this.gatherOptions = null;
          this.redirectCalled = false;
          this.redirectUrl = null;
          this.redirectOptions = null;
          this.gatheredVerbs = [];
          this.sayCalled = false;
          this.sayOptions = null;
          this.sayMessage = null;

          // Say method on the main VoiceResponse (for agent first turn)
          this.say = jest.fn(function (options, message) {
            this.sayCalled = true;
            this.sayOptions = options;
            this.sayMessage = message;
            return this;
          });

          this.gather = jest.fn(function (options) {
            this.gatherCalled = true;
            this.gatherOptions = options;

            // Create a mock gather verb that can have say() called on it
            const gatherVerb = {
              sayCalled: false,
              sayOptions: null,
              sayMessage: null,
              say: jest.fn(function (options, message) {
                this.sayCalled = true;
                this.sayOptions = options;
                this.sayMessage = message;
                return this;
              }),
            };

            this.gatheredVerbs.push(gatherVerb);
            return gatherVerb;
          });

          this.redirect = jest.fn(function (options, url) {
            this.redirectCalled = true;
            this.redirectOptions = options;
            this.redirectUrl = url;
            return this;
          });

          this.toString = jest.fn(() => {
            return `<?xml version="1.0" encoding="UTF-8"?><Response><Gather><Say>Hello</Say></Gather><Redirect>/transcribe</Redirect></Response>`;
          });

          lastTwimlInstance = this;
          return this;
        }),
        getLastInstance: () => lastTwimlInstance,
      },
      Response: jest.fn().mockImplementation(() => mockResponse),
    };

    mockContext = {};

    mockCallback = jest.fn();

    // Reset mock persona loader
    mockLoadPersona.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic functionality', () => {
    it('should create a TwiML VoiceResponse', async () => {
      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
      };

      await transcribe.handler(mockContext, mockEvent, mockCallback);

      expect(Twilio.twiml.VoiceResponse).toHaveBeenCalled();
    });

    it('should create a Twilio Response', async () => {
      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
      };

      await transcribe.handler(mockContext, mockEvent, mockCallback);

      expect(Twilio.Response).toHaveBeenCalled();
    });

    it('should call callback with response', async () => {
      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
      };

      await transcribe.handler(mockContext, mockEvent, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(null, mockResponse);
    });
  });

  describe('Gather configuration', () => {
    it('should configure <Gather> with speech input', async () => {
      mockEvent = {
        role: 'customer',
        persona: 'John Doe',
        conferenceId: 'test-conf-456',
      };

      await transcribe.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      expect(twiml.gatherCalled).toBe(true);
      expect(twiml.gatherOptions.input).toBe('speech');
    });

    it('should set action URL to /respond endpoint', async () => {
      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
      };

      await transcribe.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      expect(twiml.gatherOptions.action).toContain('/respond');
    });

    it('should use POST method for action', async () => {
      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
      };

      await transcribe.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      expect(twiml.gatherOptions.method).toBe('POST');
    });

    it('should set speechTimeout to auto', async () => {
      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
      };

      await transcribe.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      expect(twiml.gatherOptions.speechTimeout).toBe('auto');
    });

    it('should use experimental_conversations speech model', async () => {
      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
      };

      await transcribe.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      expect(twiml.gatherOptions.speechModel).toBe(
        'experimental_conversations'
      );
    });

    it('should enable enhanced speech recognition', async () => {
      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
      };

      await transcribe.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      expect(twiml.gatherOptions.enhanced).toBe(true);
    });

    it('should disable profanity filter', async () => {
      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
      };

      await transcribe.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      expect(twiml.gatherOptions.profanityFilter).toBe(false);
    });
  });

  describe('Parameter handling', () => {
    it('should extract role from event', async () => {
      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
      };

      await transcribe.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      expect(twiml.gatherOptions.action).toContain('role=agent');
    });

    it('should extract persona from event', async () => {
      mockEvent = {
        role: 'customer',
        persona: 'John Doe',
        conferenceId: 'test-conf-456',
      };

      await transcribe.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      expect(twiml.gatherOptions.action).toContain('persona=John%20Doe'); // URL encoded
    });

    it('should extract conferenceId from event', async () => {
      mockEvent = {
        role: 'agent',
        persona: 'Angela',
        conferenceId: 'conf-789',
      };

      await transcribe.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      expect(twiml.gatherOptions.action).toContain('conferenceId=conf-789');
    });

    it('should default role to "unknown" if not provided', async () => {
      mockEvent = {
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
      };

      await transcribe.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      expect(twiml.gatherOptions.action).toContain('role=unknown');
    });

    it('should default persona to "AI" if not provided', async () => {
      mockEvent = {
        role: 'agent',
        conferenceId: 'test-conf-123',
      };

      await transcribe.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      expect(twiml.gatherOptions.action).toContain('persona=AI');
    });

    it('should default conferenceId to "unknown" if not provided', async () => {
      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
      };

      await transcribe.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      expect(twiml.gatherOptions.action).toContain('conferenceId=unknown');
    });
  });

  describe('Conversation history handling', () => {
    it('should NOT include conversationHistory in action URL (stored in Sync)', async () => {
      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
      };

      await transcribe.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      // History is stored in Sync, not passed via URL
      expect(twiml.gatherOptions.action).not.toContain('conversationHistory=');
      // Should only contain basic params
      expect(twiml.gatherOptions.action).toContain('role=agent');
      expect(twiml.gatherOptions.action).toContain('persona=Sophie');
      expect(twiml.gatherOptions.action).toContain('conferenceId=test-conf-123');
    });

    it('should NOT include conversationHistory in redirect URL (stored in Sync)', async () => {
      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
      };

      await transcribe.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      // History is stored in Sync, not passed via URL
      expect(twiml.redirectUrl).not.toContain('conversationHistory=');
      // Should only contain basic params
      expect(twiml.redirectUrl).toContain('/transcribe');
      expect(twiml.redirectUrl).toContain('role=agent');
    });
  });

  describe('Agent introduction', () => {
    it('should deliver agent introduction on first message', async () => {
      mockLoadPersona.mockReturnValue({
        name: 'Sophie',
        role: 'agent',
        introduction: 'Hello, this is Sophie from support. How can I help?',
        systemPrompt: 'You are a helpful agent',
        rawData: {},
      });

      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
        isFirstCall: 'true', // isFirstCall flag triggers introduction
      };

      await transcribe.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      // Agent speaks OUTSIDE <Gather> on first turn for proper turn-taking
      expect(twiml.sayCalled).toBe(true);
      expect(twiml.gatherCalled).toBe(false); // No gather on first agent turn
    });

    it('should use persona introduction text for agent', async () => {
      const introduction = 'Hello, this is Sarah. How may I assist you today?';
      mockLoadPersona.mockReturnValue({
        name: 'Sarah',
        role: 'agent',
        introduction: introduction,
        systemPrompt: 'You are a helpful agent',
        rawData: {},
      });

      mockEvent = {
        role: 'agent',
        persona: 'Sarah',
        conferenceId: 'test-conf-123',
        isFirstCall: 'true',
      };

      await transcribe.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      // Agent speaks directly on VoiceResponse, not within gather
      expect(twiml.sayMessage).toBe(introduction);
    });

    it('should use default introduction if persona not found', async () => {
      mockLoadPersona.mockReturnValue(null);

      mockEvent = {
        role: 'agent',
        persona: 'Unknown Agent',
        conferenceId: 'test-conf-123',
        isFirstCall: 'true',
      };

      await transcribe.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      // Agent speaks directly on VoiceResponse (not within gather) on first turn
      expect(twiml.sayMessage).toBe('Hello, how can I help you today?');
    });

    it('should NOT deliver introduction for customer role', async () => {
      mockEvent = {
        role: 'customer',
        persona: 'John Doe',
        conferenceId: 'test-conf-123',
        isFirstCall: 'true',
      };

      await transcribe.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      expect(twiml.gatheredVerbs[0].sayCalled).toBe(false);
    });

    it('should NOT deliver introduction on subsequent messages', async () => {
      mockLoadPersona.mockReturnValue({
        name: 'Sophie',
        role: 'agent',
        introduction: 'Hello, this is Sophie from support.',
        systemPrompt: 'You are a helpful agent',
        rawData: {},
      });

      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
        isFirstCall: 'false', // Not first call = no introduction
      };

      await transcribe.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      expect(twiml.gatheredVerbs[0].sayCalled).toBe(false);
    });

    it('should use Polly.Joanna-Neural voice for introduction', async () => {
      mockLoadPersona.mockReturnValue({
        name: 'Sophie',
        role: 'agent',
        introduction: 'Hello',
        systemPrompt: 'You are a helpful agent',
        rawData: {},
      });

      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
        isFirstCall: 'true',
      };

      await transcribe.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      // Agent speaks directly on VoiceResponse (not within gather) on first turn
      expect(twiml.sayOptions).toEqual({
        voice: 'Polly.Joanna-Neural',
      });
    });
  });

  describe('Redirect behavior', () => {
    it('should redirect to /transcribe endpoint', async () => {
      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
      };

      await transcribe.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      expect(twiml.redirectUrl).toContain('/transcribe');
    });

    it('should use POST method for redirect', async () => {
      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
      };

      await transcribe.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      expect(twiml.redirectOptions).toEqual({ method: 'POST' });
    });

    it('should include all parameters in redirect URL (except conversationHistory)', async () => {
      mockEvent = {
        role: 'customer',
        persona: 'Paula Green',
        conferenceId: 'synth-call-123',
      };

      await transcribe.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      expect(twiml.redirectUrl).toContain('role=customer');
      expect(twiml.redirectUrl).toContain('persona=Paula%20Green'); // URL encoded
      expect(twiml.redirectUrl).toContain('conferenceId=synth-call-123');
      // conversationHistory stored in Sync, not URL
      expect(twiml.redirectUrl).not.toContain('conversationHistory=');
    });
  });

  describe('Response format', () => {
    it('should set Content-Type header to text/xml', async () => {
      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
      };

      await transcribe.handler(mockContext, mockEvent, mockCallback);

      expect(mockResponse.appendHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/xml'
      );
    });

    it('should set response body to TwiML string', async () => {
      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
      };

      await transcribe.handler(mockContext, mockEvent, mockCallback);

      expect(mockResponse.setBody).toHaveBeenCalled();
      const bodyArg = mockResponse.setBody.mock.calls[0][0];
      expect(typeof bodyArg).toBe('string');
      expect(bodyArg).toContain('<?xml');
      expect(bodyArg).toContain('<Response>');
    });

    it('should return properly formatted TwiML XML', async () => {
      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
      };

      await transcribe.handler(mockContext, mockEvent, mockCallback);

      const bodyArg = mockResponse.setBody.mock.calls[0][0];
      expect(bodyArg).toContain('<Gather');
      expect(bodyArg).toContain('<Redirect');
      expect(bodyArg).toContain('</Response>');
    });
  });

  describe('Logging', () => {
    let consoleLogSpy;

    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
    });

    it('should log transcribe function call', async () => {
      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
      };

      await transcribe.handler(mockContext, mockEvent, mockCallback);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🎤 Transcribe function called')
      );
    });

    it('should log role and persona', async () => {
      mockEvent = {
        role: 'customer',
        persona: 'John Doe',
        conferenceId: 'synth-123',
      };

      await transcribe.handler(mockContext, mockEvent, mockCallback);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('customer')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('John Doe')
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle empty event object', async () => {
      mockEvent = {};

      await transcribe.handler(mockContext, mockEvent, mockCallback);

      expect(mockCallback).toHaveBeenCalled();
      expect(mockCallback.mock.calls[0][0]).toBeNull(); // No error
    });

    it('should handle special characters in persona name', async () => {
      mockEvent = {
        role: 'customer',
        persona: "O'Brien & Associates",
        conferenceId: 'test-conf-123',
      };

      await transcribe.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      expect(twiml.gatherOptions.action).toContain('persona=O');
    });

    it('should handle very long conversation history', async () => {
      const longHistory = 'user: test|assistant: response|'.repeat(100);
      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
        conversationHistory: longHistory,
      };

      await transcribe.handler(mockContext, mockEvent, mockCallback);

      expect(mockCallback).toHaveBeenCalled();
      expect(mockCallback.mock.calls[0][0]).toBeNull();
    });
  });
});
