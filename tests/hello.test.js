// ABOUTME: Unit tests for hello.js Twilio Voice function
// ABOUTME: Tests TwiML generation and voice response logic

const { handler } = require('../functions/hello');

// Mock Twilio TwiML classes
const mockTwimlResponse = {
  say: jest.fn().mockReturnThis(),
  pause: jest.fn().mockReturnThis(),
  gather: jest.fn().mockReturnThis(),
  hangup: jest.fn().mockReturnThis(),
  toString: jest
    .fn()
    .mockReturnValue(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'
    ),
};

global.Twilio = {
  twiml: {
    VoiceResponse: jest.fn().mockImplementation(() => mockTwimlResponse),
  },
};

describe('hello function', () => {
  let mockCallback;
  let mockContext;

  beforeEach(() => {
    mockCallback = jest.fn();
    mockContext = {
      ACCOUNT_SID: 'test_account_sid',
      AUTH_TOKEN: 'test_auth_token',
    };

    // Reset all mocks
    jest.clearAllMocks();
  });

  test('should create VoiceResponse and handle incoming call', () => {
    const mockEvent = {
      From: '+15551234567',
      To: '+15559876543',
      CallSid: 'CA1234567890abcdef',
    };

    handler(mockContext, mockEvent, mockCallback);

    // Verify TwiML VoiceResponse was created
    expect(global.Twilio.twiml.VoiceResponse).toHaveBeenCalled();

    // Verify callback was called with TwiML response
    expect(mockCallback).toHaveBeenCalledWith(null, mockTwimlResponse);
  });

  test('should log call details', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    const mockEvent = {
      From: '+15551234567',
      To: '+15559876543',
      CallSid: 'CA1234567890abcdef',
    };

    handler(mockContext, mockEvent, mockCallback);

    expect(consoleSpy).toHaveBeenCalledWith(
      'Received call from +15551234567 to +15559876543, CallSid: CA1234567890abcdef'
    );

    consoleSpy.mockRestore();
  });

  test('should create TwiML with proper voice settings', () => {
    const mockEvent = {
      From: '+15551234567',
      To: '+15559876543',
      CallSid: 'CA1234567890abcdef',
    };

    handler(mockContext, mockEvent, mockCallback);

    // Verify say was called with proper voice settings
    expect(mockTwimlResponse.say).toHaveBeenCalledWith(
      {
        voice: 'alice',
        language: 'en-US',
      },
      expect.stringContaining('Hello! Thank you for calling')
    );
  });

  test('should include gather for menu options', () => {
    const mockEvent = {
      From: '+15551234567',
      To: '+15559876543',
      CallSid: 'CA1234567890abcdef',
    };

    handler(mockContext, mockEvent, mockCallback);

    // Verify gather was called with proper configuration
    expect(mockTwimlResponse.gather).toHaveBeenCalledWith(
      {
        numDigits: 1,
        action: '/voice-menu',
        method: 'POST',
      },
      expect.any(Function)
    );
  });

  test('should end with hangup', () => {
    const mockEvent = {
      From: '+15551234567',
      To: '+15559876543',
      CallSid: 'CA1234567890abcdef',
    };

    handler(mockContext, mockEvent, mockCallback);

    expect(mockTwimlResponse.hangup).toHaveBeenCalled();
  });
});
