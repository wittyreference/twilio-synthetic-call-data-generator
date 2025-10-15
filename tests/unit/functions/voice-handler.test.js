// ABOUTME: Unit tests for voice-handler function
// ABOUTME: Tests TwiML Application entry point and redirect to transcribe

const path = require('path');

// Mock Runtime.getFunctions BEFORE requiring the function
global.Runtime = {
  getFunctions: () => ({
    'utils/url-builder': {
      path: path.join(__dirname, '../../../functions/utils/url-builder'),
    },
    'utils/webhook-validator': {
      path: path.join(__dirname, '../../../functions/utils/webhook-validator'),
    },
  }),
};

const voiceHandler = require('../../../functions/voice-handler');

describe('Voice Handler Function', () => {
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
          this.redirectCalled = false;
          this.redirectUrl = null;
          this.redirectOptions = null;

          this.redirect = jest.fn(function (options, url) {
            this.redirectCalled = true;
            this.redirectOptions = options;
            this.redirectUrl = url;
            return this;
          });

          this.toString = jest.fn(() => {
            return `<?xml version="1.0" encoding="UTF-8"?><Response><Redirect method="POST">/transcribe</Redirect></Response>`;
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

      await voiceHandler.handler(mockContext, mockEvent, mockCallback);

      expect(Twilio.twiml.VoiceResponse).toHaveBeenCalled();
    });

    it('should create a Twilio Response', async () => {
      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
      };

      await voiceHandler.handler(mockContext, mockEvent, mockCallback);

      expect(Twilio.Response).toHaveBeenCalled();
    });

    it('should call callback with response', async () => {
      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
      };

      await voiceHandler.handler(mockContext, mockEvent, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(null, mockResponse);
    });
  });

  describe('Parameter handling', () => {
    it('should extract role from event', async () => {
      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
      };

      await voiceHandler.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      expect(twiml.redirectUrl).toContain('role=agent');
    });

    it('should extract persona from event', async () => {
      mockEvent = {
        role: 'customer',
        persona: 'John Doe',
        conferenceId: 'test-conf-456',
      };

      await voiceHandler.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      expect(twiml.redirectUrl).toContain('persona=John%20Doe'); // URL builder uses encodeURIComponent
    });

    it('should extract conferenceId from event', async () => {
      mockEvent = {
        role: 'agent',
        persona: 'Angela',
        conferenceId: 'conf-789',
      };

      await voiceHandler.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      expect(twiml.redirectUrl).toContain('conferenceId=conf-789');
    });

    it('should default role to "unknown" if not provided', async () => {
      mockEvent = {
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
      };

      await voiceHandler.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      expect(twiml.redirectUrl).toContain('role=unknown');
    });

    it('should default persona to "AI" if not provided', async () => {
      mockEvent = {
        role: 'agent',
        conferenceId: 'test-conf-123',
      };

      await voiceHandler.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      expect(twiml.redirectUrl).toContain('persona=AI');
    });

    it('should default conferenceId to "unknown" if not provided', async () => {
      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
      };

      await voiceHandler.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      expect(twiml.redirectUrl).toContain('conferenceId=unknown');
    });
  });

  describe('TwiML redirect', () => {
    it('should redirect to /transcribe endpoint', async () => {
      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
      };

      await voiceHandler.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      expect(twiml.redirectUrl).toContain('/transcribe');
    });

    it('should use POST method for redirect', async () => {
      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
      };

      await voiceHandler.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      expect(twiml.redirectOptions).toEqual({ method: 'POST' });
    });

    it('should include all parameters in redirect URL', async () => {
      mockEvent = {
        role: 'customer',
        persona: 'Paula Green',
        conferenceId: 'synth-call-123',
      };

      await voiceHandler.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      expect(twiml.redirectUrl).toContain('role=customer');
      expect(twiml.redirectUrl).toContain('persona=Paula%20Green'); // URL builder uses encodeURIComponent
      expect(twiml.redirectUrl).toContain('conferenceId=synth-call-123');
    });
  });

  describe('Response format', () => {
    it('should set Content-Type header to text/xml', async () => {
      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
      };

      await voiceHandler.handler(mockContext, mockEvent, mockCallback);

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

      await voiceHandler.handler(mockContext, mockEvent, mockCallback);

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

      await voiceHandler.handler(mockContext, mockEvent, mockCallback);

      const bodyArg = mockResponse.setBody.mock.calls[0][0];
      expect(bodyArg).toContain('<Redirect');
      expect(bodyArg).toContain('</Redirect>');
      expect(bodyArg).toContain('</Response>');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty event object', async () => {
      mockEvent = {};

      await voiceHandler.handler(mockContext, mockEvent, mockCallback);

      expect(mockCallback).toHaveBeenCalled();
      expect(mockCallback.mock.calls[0][0]).toBeNull(); // No error
    });

    it('should handle special characters in persona name', async () => {
      mockEvent = {
        role: 'customer',
        persona: "O'Brien & Associates",
        conferenceId: 'test-conf-123',
      };

      await voiceHandler.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      // Should be URL encoded
      expect(twiml.redirectUrl).toContain('persona=O');
    });

    it('should handle very long persona names', async () => {
      const longName = 'A'.repeat(200);
      mockEvent = {
        role: 'agent',
        persona: longName,
        conferenceId: 'test-conf-123',
      };

      await voiceHandler.handler(mockContext, mockEvent, mockCallback);

      expect(mockCallback).toHaveBeenCalled();
      expect(mockCallback.mock.calls[0][0]).toBeNull();
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

    it('should log voice handler call', async () => {
      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
      };

      await voiceHandler.handler(mockContext, mockEvent, mockCallback);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('📞 Voice handler called')
      );
    });

    it('should log role and persona in legacy mode', async () => {
      mockEvent = {
        role: 'customer',
        persona: 'John Doe',
        conferenceId: 'synth-123',
      };

      await voiceHandler.handler(mockContext, mockEvent, mockCallback);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('customer')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('John Doe')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('(legacy)')
      );
    });
  });
});
