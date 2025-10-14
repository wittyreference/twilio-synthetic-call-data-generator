// ABOUTME: Unit tests for respond function
// ABOUTME: Tests OpenAI integration and conversation history management

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
    'utils/conversation-validator': {
      path: path.join(__dirname, '../../../functions/utils/conversation-validator'),
    },
    'utils/sync-manager': {
      path: path.join(__dirname, '../../../functions/utils/sync-manager'),
    },
  }),
  getTwilioClient: jest.fn(), // Mock for Sync client
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

// Mock OpenAI
const mockCreate = jest.fn();
const mockOpenAI = jest.fn().mockImplementation(() => ({
  chat: {
    completions: {
      create: mockCreate,
    },
  },
}));

jest.mock('openai', () => ({
  OpenAI: mockOpenAI,
}));

// Mock Sync functions
const mockCheckRateLimit = jest.fn();
const mockGetConversationHistory = jest.fn();
const mockStoreConversationHistory = jest.fn();

jest.mock(
  '../../../functions/utils/sync-manager',
  () => ({
    checkRateLimit: mockCheckRateLimit,
    getConversationHistory: mockGetConversationHistory,
    storeConversationHistory: mockStoreConversationHistory,
  }),
  { virtual: true }
);

// NOW require the function after mocks are set up
const respond = require('../../../functions/respond');

describe('Respond Function', () => {
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
          this.sayCalled = false;
          this.sayOptions = null;
          this.sayMessage = null;

          this.redirect = jest.fn(function (options, url) {
            this.redirectCalled = true;
            this.redirectOptions = options;
            this.redirectUrl = url;
            return this;
          });

          this.say = jest.fn(function (options, message) {
            this.sayCalled = true;
            this.sayOptions = options;
            this.sayMessage = message;
            return this;
          });

          this.toString = jest.fn(() => {
            return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Hello</Say><Redirect>/transcribe</Redirect></Response>`;
          });

          lastTwimlInstance = this;
          return this;
        }),
        getLastInstance: () => lastTwimlInstance,
      },
      Response: jest.fn().mockImplementation(() => mockResponse),
    };

    mockContext = {
      OPENAI_API_KEY: 'sk-test-key-1234567890',
      SYNC_SERVICE_SID: 'ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      MAX_DAILY_CALLS: '1000',
      getTwilioClient: jest.fn(() => ({})), // Mock Twilio client
    };

    mockCallback = jest.fn();

    // Reset mocks
    mockLoadPersona.mockReset();
    mockOpenAI.mockClear();
    mockCreate.mockReset();

    // Reset Sync mocks with default return values
    mockCheckRateLimit.mockReset();
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      currentCount: 1,
      limit: 1000,
      resetsAt: new Date().toISOString(),
    });

    mockGetConversationHistory.mockReset();
    mockGetConversationHistory.mockResolvedValue([]); // Empty history by default

    mockStoreConversationHistory.mockReset();
    mockStoreConversationHistory.mockResolvedValue({
      sid: 'ETxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    });
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
        SpeechResult: '',
      };

      await respond.handler(mockContext, mockEvent, mockCallback);

      expect(Twilio.twiml.VoiceResponse).toHaveBeenCalled();
    });

    it('should create a Twilio Response', async () => {
      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
        SpeechResult: '',
      };

      await respond.handler(mockContext, mockEvent, mockCallback);

      expect(Twilio.Response).toHaveBeenCalled();
    });

    it('should call callback with response', async () => {
      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
        SpeechResult: '',
      };

      await respond.handler(mockContext, mockEvent, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(null, mockResponse);
    });
  });

  describe('No speech handling', () => {
    it('should redirect to transcribe when no SpeechResult', async () => {
      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
        SpeechResult: '',
      };

      await respond.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      expect(twiml.redirectCalled).toBe(true);
      expect(twiml.redirectUrl).toContain('/transcribe');
    });

    it('should include all parameters in redirect when no speech', async () => {
      mockEvent = {
        role: 'customer',
        persona: 'John Doe',
        conferenceId: 'test-456',
        SpeechResult: '',
        conversationHistory: 'test-history',
      };

      await respond.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      expect(twiml.redirectUrl).toContain('role=customer');
      expect(twiml.redirectUrl).toContain('persona=John%20Doe');
      expect(twiml.redirectUrl).toContain('conferenceId=test-456');
      expect(twiml.redirectUrl).toContain('conversationHistory=test-history');
    });

    it('should NOT call OpenAI when no speech detected', async () => {
      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
        SpeechResult: '',
      };

      await respond.handler(mockContext, mockEvent, mockCallback);

      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should NOT say anything when no speech detected', async () => {
      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
        SpeechResult: '',
      };

      await respond.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      expect(twiml.sayCalled).toBe(false);
    });
  });

  describe('Parameter handling', () => {
    beforeEach(() => {
      mockLoadPersona.mockReturnValue({
        name: 'Sophie',
        role: 'agent',
        systemPrompt: 'You are a helpful agent',
        introduction: 'Hello',
        rawData: {},
      });

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Test response',
            },
          },
        ],
      });
    });

    it('should extract role from event', async () => {
      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
        SpeechResult: 'Hello',
      };

      await respond.handler(mockContext, mockEvent, mockCallback);

      // loadPersona is called with role, persona, and context
      expect(mockLoadPersona).toHaveBeenCalledWith('agent', 'Sophie', mockContext);
    });

    it('should extract persona from event', async () => {
      mockEvent = {
        role: 'customer',
        persona: 'John Doe',
        conferenceId: 'test-conf-456',
        SpeechResult: 'Hello',
      };

      await respond.handler(mockContext, mockEvent, mockCallback);

      // loadPersona is called with role, persona, and context
      expect(mockLoadPersona).toHaveBeenCalledWith(
        'customer',
        'John Doe',
        mockContext
      );
    });

    it('should extract SpeechResult from event', async () => {
      const speechText = 'I need help with my account';
      mockEvent = {
        role: 'customer',
        persona: 'John Doe',
        conferenceId: 'test-conf-123',
        SpeechResult: speechText,
      };

      await respond.handler(mockContext, mockEvent, mockCallback);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: speechText,
            }),
          ]),
        })
      );
    });

    it('should default role to "unknown" if not provided', async () => {
      mockEvent = {
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
        SpeechResult: 'Hello',
      };

      await respond.handler(mockContext, mockEvent, mockCallback);

      // loadPersona is called with role, persona, and context
      expect(mockLoadPersona).toHaveBeenCalledWith(
        'unknown',
        'Sophie',
        mockContext
      );
    });

    it('should default persona to "AI" if not provided', async () => {
      mockEvent = {
        role: 'agent',
        conferenceId: 'test-conf-123',
        SpeechResult: 'Hello',
      };

      await respond.handler(mockContext, mockEvent, mockCallback);

      // loadPersona is called with role, persona, and context
      expect(mockLoadPersona).toHaveBeenCalledWith('agent', 'AI', mockContext);
    });
  });

  describe('OpenAI integration', () => {
    beforeEach(() => {
      mockLoadPersona.mockReturnValue({
        name: 'Sophie',
        role: 'agent',
        systemPrompt: 'You are a helpful customer service agent',
        introduction: 'Hello',
        rawData: {},
      });
    });

    it('should initialize OpenAI with API key from context', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Test response' } }],
      });

      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
        SpeechResult: 'Hello',
      };

      await respond.handler(mockContext, mockEvent, mockCallback);

      expect(mockOpenAI).toHaveBeenCalledWith({
        apiKey: 'sk-test-key-1234567890',
      });
    });

    it('should call OpenAI chat.completions.create', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Test response' } }],
      });

      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
        SpeechResult: 'Hello',
      };

      await respond.handler(mockContext, mockEvent, mockCallback);

      expect(mockCreate).toHaveBeenCalled();
    });

    it('should use gpt-4o-mini model', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Test response' } }],
      });

      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
        SpeechResult: 'Hello',
      };

      await respond.handler(mockContext, mockEvent, mockCallback);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini',
        })
      );
    });

    it('should set temperature to 0.7', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Test response' } }],
      });

      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
        SpeechResult: 'Hello',
      };

      await respond.handler(mockContext, mockEvent, mockCallback);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.7,
        })
      );
    });

    it('should set max_tokens to 150', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Test response' } }],
      });

      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
        SpeechResult: 'Hello',
      };

      await respond.handler(mockContext, mockEvent, mockCallback);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 150,
        })
      );
    });

    it('should extract response from OpenAI completion', async () => {
      const aiResponse = 'How can I help you today?';
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: aiResponse } }],
      });

      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
        SpeechResult: 'Hello',
      };

      await respond.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      expect(twiml.sayMessage).toBe(aiResponse);
    });
  });

  describe('Conversation history', () => {
    beforeEach(() => {
      mockLoadPersona.mockReturnValue({
        name: 'Sophie',
        role: 'agent',
        systemPrompt: 'You are a helpful agent',
        introduction: 'Hello',
        rawData: {},
      });

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Test response' } }],
      });
    });

    it('should add system prompt on first message', async () => {
      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
        SpeechResult: 'Hello',
        conversationHistory: '',
      };

      await respond.handler(mockContext, mockEvent, mockCallback);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            {
              role: 'system',
              content: 'You are a helpful agent',
            },
          ]),
        })
      );
    });

    it('should NOT add system prompt on subsequent messages', async () => {
      const existingHistory = JSON.stringify([
        { role: 'system', content: 'You are a helpful agent' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
      ]);

      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
        SpeechResult: 'I need help',
        conversationHistory: existingHistory,
      };

      await respond.handler(mockContext, mockEvent, mockCallback);

      const callArgs = mockCreate.mock.calls[0][0];
      const systemMessages = callArgs.messages.filter(
        (m) => m.role === 'system'
      );
      expect(systemMessages).toHaveLength(1);
    });

    it('should parse existing conversation history from Sync', async () => {
      const existingHistory = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
      ];

      // Mock Sync to return existing history
      mockGetConversationHistory.mockResolvedValue(existingHistory);

      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
        SpeechResult: 'I need help',
      };

      await respond.handler(mockContext, mockEvent, mockCallback);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            { role: 'system', content: 'You are a helpful agent' },
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there' },
            { role: 'user', content: 'I need help' },
          ]),
        })
      );
    });

    it('should add user message to conversation', async () => {
      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
        SpeechResult: 'I need help with my account',
        conversationHistory: '',
      };

      await respond.handler(mockContext, mockEvent, mockCallback);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            {
              role: 'user',
              content: 'I need help with my account',
            },
          ]),
        })
      );
    });

    it('should add assistant response to history in Sync', async () => {
      const aiResponse = 'I can help you with that';
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: aiResponse } }],
      });

      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
        SpeechResult: 'Hello',
      };

      await respond.handler(mockContext, mockEvent, mockCallback);

      // Should store history to Sync
      expect(mockStoreConversationHistory).toHaveBeenCalledWith(
        mockContext,
        'test-conf-123',
        expect.arrayContaining([
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: aiResponse }
        ])
      );
    });

    it('should handle malformed conversation history from Sync gracefully', async () => {
      const aiResponse = 'Test response';
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: aiResponse } }],
      });

      // Mock Sync to return malformed history
      mockGetConversationHistory.mockResolvedValue([
        { role: 'invalid', content: 'Bad data' },
        { invalid: 'structure' }
      ]);

      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
        SpeechResult: 'Hello',
      };

      await respond.handler(mockContext, mockEvent, mockCallback);

      // Should still process the request (validation clears corrupted history)
      const twiml = Twilio.twiml.getLastInstance();
      expect(twiml.sayCalled).toBe(true);
      expect(twiml.sayMessage).toBe(aiResponse);

      // Should call OpenAI - history was validated and cleared, then assistant response added
      expect(mockCreate).toHaveBeenCalled();

      // Should store the new clean conversation in Sync
      expect(mockStoreConversationHistory).toHaveBeenCalledWith(
        mockContext,
        'test-conf-123',
        expect.arrayContaining([
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: aiResponse }
        ])
      );
    });

    it('should store conversation history in Sync', async () => {
      const aiResponse = 'How can I help?';
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: aiResponse } }],
      });

      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
        SpeechResult: 'Hello',
      };

      await respond.handler(mockContext, mockEvent, mockCallback);

      // Should store history to Sync (without system prompt)
      expect(mockStoreConversationHistory).toHaveBeenCalledWith(
        mockContext,
        'test-conf-123',
        expect.arrayContaining([
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: aiResponse }
        ])
      );

      // URL should NOT contain conversationHistory (it's in Sync now)
      const twiml = Twilio.twiml.getLastInstance();
      expect(twiml.redirectUrl).not.toContain('conversationHistory=');
    });
  });

  describe('TwiML response', () => {
    beforeEach(() => {
      mockLoadPersona.mockReturnValue({
        name: 'Sophie',
        role: 'agent',
        systemPrompt: 'You are a helpful agent',
        introduction: 'Hello',
        rawData: {},
      });
    });

    it('should say AI response using Polly.Joanna-Neural voice', async () => {
      const aiResponse = 'I can help you with that';
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: aiResponse } }],
      });

      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
        SpeechResult: 'Hello',
      };

      await respond.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      expect(twiml.sayCalled).toBe(true);
      expect(twiml.sayOptions).toEqual({ voice: 'Polly.Joanna-Neural' });
      expect(twiml.sayMessage).toBe(aiResponse);
    });

    it('should redirect to transcribe after saying response', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Test response' } }],
      });

      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
        SpeechResult: 'Hello',
      };

      await respond.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      expect(twiml.redirectCalled).toBe(true);
      expect(twiml.redirectUrl).toContain('/transcribe');
    });

    it('should include all parameters in redirect URL', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Test response' } }],
      });

      mockEvent = {
        role: 'customer',
        persona: 'John Doe',
        conferenceId: 'test-456',
        SpeechResult: 'Hello',
      };

      await respond.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      expect(twiml.redirectUrl).toContain('role=customer');
      expect(twiml.redirectUrl).toContain('persona=John%20Doe'); // URL builder uses encodeURIComponent
      expect(twiml.redirectUrl).toContain('conferenceId=test-456');
    });

    it('should use POST method for redirect', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Test response' } }],
      });

      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
        SpeechResult: 'Hello',
      };

      await respond.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      expect(twiml.redirectOptions).toEqual({ method: 'POST' });
    });
  });

  describe('Error handling', () => {
    beforeEach(() => {
      mockLoadPersona.mockReturnValue({
        name: 'Sophie',
        role: 'agent',
        systemPrompt: 'You are a helpful agent',
        introduction: 'Hello',
        rawData: {},
      });
    });

    it('should handle persona not found error', async () => {
      mockLoadPersona.mockReturnValue(null);

      mockEvent = {
        role: 'agent',
        persona: 'Unknown',
        conferenceId: 'test-conf-123',
        SpeechResult: 'Hello',
      };

      await respond.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      expect(twiml.sayCalled).toBe(true);
      expect(twiml.sayMessage).toContain('error loading my configuration');
    });

    it('should handle OpenAI API error', async () => {
      mockCreate.mockRejectedValue(new Error('OpenAI API error'));

      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
        SpeechResult: 'Hello',
      };

      await respond.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      expect(twiml.sayCalled).toBe(true);
      expect(twiml.sayMessage).toContain('technical difficulties');
    });

    it('should redirect to transcribe on error', async () => {
      mockCreate.mockRejectedValue(new Error('OpenAI API error'));

      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
        SpeechResult: 'Hello',
        conversationHistory: 'test-history',
      };

      await respond.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      expect(twiml.redirectCalled).toBe(true);
      expect(twiml.redirectUrl).toContain('/transcribe');
    });

    it('should not include conversation history in URL on error', async () => {
      mockCreate.mockRejectedValue(new Error('OpenAI API error'));

      const existingHistory = [
        { role: 'user', content: 'Previous message' },
        { role: 'assistant', content: 'Previous response' },
      ];

      // Mock Sync to return existing history
      mockGetConversationHistory.mockResolvedValue(existingHistory);

      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
        SpeechResult: 'Hello',
      };

      await respond.handler(mockContext, mockEvent, mockCallback);

      const twiml = Twilio.twiml.getLastInstance();
      // History stays in Sync, NOT in URL
      expect(twiml.redirectUrl).not.toContain('conversationHistory=');
      // URL should only contain basic params
      expect(twiml.redirectUrl).toContain('/transcribe');
      expect(twiml.redirectUrl).toContain('role=agent');
      expect(twiml.redirectUrl).toContain('conferenceId=test-conf-123');
    });

    it('should log error to console', async () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation();
      mockCreate.mockRejectedValue(new Error('OpenAI API error'));

      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
        SpeechResult: 'Hello',
      };

      await respond.handler(mockContext, mockEvent, mockCallback);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error in respond function'),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Response format', () => {
    beforeEach(() => {
      mockLoadPersona.mockReturnValue({
        name: 'Sophie',
        role: 'agent',
        systemPrompt: 'You are a helpful agent',
        introduction: 'Hello',
        rawData: {},
      });

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Test response' } }],
      });
    });

    it('should set Content-Type header to text/xml', async () => {
      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
        SpeechResult: 'Hello',
      };

      await respond.handler(mockContext, mockEvent, mockCallback);

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
        SpeechResult: 'Hello',
      };

      await respond.handler(mockContext, mockEvent, mockCallback);

      expect(mockResponse.setBody).toHaveBeenCalled();
      const bodyArg = mockResponse.setBody.mock.calls[0][0];
      expect(typeof bodyArg).toBe('string');
      expect(bodyArg).toContain('<?xml');
      expect(bodyArg).toContain('<Response>');
    });
  });

  describe('Logging', () => {
    let consoleLogSpy;

    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      mockLoadPersona.mockReturnValue({
        name: 'Sophie',
        role: 'agent',
        systemPrompt: 'You are a helpful agent',
        introduction: 'Hello',
        rawData: {},
      });

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Test response' } }],
      });
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
    });

    it('should log respond function call', async () => {
      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
        SpeechResult: 'Hello',
      };

      await respond.handler(mockContext, mockEvent, mockCallback);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('💬 Respond function called')
      );
    });

    it('should log speech result', async () => {
      const speechText = 'I need help';
      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
        SpeechResult: speechText,
      };

      await respond.handler(mockContext, mockEvent, mockCallback);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(speechText)
      );
    });

    it('should log OpenAI request', async () => {
      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
        SpeechResult: 'Hello',
      };

      await respond.handler(mockContext, mockEvent, mockCallback);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🤖 Sending to OpenAI')
      );
    });

    it('should log OpenAI response', async () => {
      const aiResponse = 'How can I help?';
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: aiResponse } }],
      });

      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
        SpeechResult: 'Hello',
      };

      await respond.handler(mockContext, mockEvent, mockCallback);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ OpenAI response')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(aiResponse)
      );
    });

    it('should log warning when no speech detected', async () => {
      mockEvent = {
        role: 'agent',
        persona: 'Sophie',
        conferenceId: 'test-conf-123',
        SpeechResult: '',
      };

      await respond.handler(mockContext, mockEvent, mockCallback);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️  No speech detected')
      );
    });
  });
});
