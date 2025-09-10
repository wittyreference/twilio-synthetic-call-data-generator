// ABOUTME: Unit tests for voice-menu.js Twilio Voice function
// ABOUTME: Tests menu selection handling and conditional TwiML responses

const { handler } = require('../functions/voice-menu');

// Mock Twilio TwiML classes
const mockTwimlResponse = {
  say: jest.fn().mockReturnThis(),
  pause: jest.fn().mockReturnThis(),
  redirect: jest.fn().mockReturnThis(),
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

describe('voice-menu function', () => {
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

  test('should create VoiceResponse and handle menu selection', () => {
    const mockEvent = {
      Digits: '1',
      From: '+15551234567',
    };

    handler(mockContext, mockEvent, mockCallback);

    // Verify TwiML VoiceResponse was created
    expect(global.Twilio.twiml.VoiceResponse).toHaveBeenCalled();

    // Verify callback was called with TwiML response
    expect(mockCallback).toHaveBeenCalledWith(null, mockTwimlResponse);
  });

  test('should log caller digits', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    const mockEvent = {
      Digits: '1',
      From: '+15551234567',
    };

    handler(mockContext, mockEvent, mockCallback);

    expect(consoleSpy).toHaveBeenCalledWith('Caller +15551234567 pressed: 1');

    consoleSpy.mockRestore();
  });

  test('should handle option 1 - information', () => {
    const mockEvent = {
      Digits: '1',
      From: '+15551234567',
    };

    handler(mockContext, mockEvent, mockCallback);

    // Verify information message was said
    expect(mockTwimlResponse.say).toHaveBeenCalledWith(
      {
        voice: 'alice',
        language: 'en-US',
      },
      'You selected information. This is a demo Twilio Voice application built with serverless functions. Visit twilio.com to learn more.'
    );

    // Verify call ends with goodbye and hangup
    expect(mockTwimlResponse.pause).toHaveBeenCalledWith({ length: 1 });
    expect(mockTwimlResponse.say).toHaveBeenCalledWith(
      'Thank you for calling. Goodbye!'
    );
    expect(mockTwimlResponse.hangup).toHaveBeenCalled();
  });

  test('should handle option 2 - support', () => {
    const mockEvent = {
      Digits: '2',
      From: '+15551234567',
    };

    handler(mockContext, mockEvent, mockCallback);

    // Verify support message was said
    expect(mockTwimlResponse.say).toHaveBeenCalledWith(
      {
        voice: 'alice',
        language: 'en-US',
      },
      'You selected support. For technical support, please visit our documentation or contact our support team.'
    );

    // Verify call ends with goodbye and hangup
    expect(mockTwimlResponse.pause).toHaveBeenCalledWith({ length: 1 });
    expect(mockTwimlResponse.say).toHaveBeenCalledWith(
      'Thank you for calling. Goodbye!'
    );
    expect(mockTwimlResponse.hangup).toHaveBeenCalled();
  });

  test('should handle option 0 - redirect to main menu', () => {
    const mockEvent = {
      Digits: '0',
      From: '+15551234567',
    };

    handler(mockContext, mockEvent, mockCallback);

    // Verify redirect to main menu
    expect(mockTwimlResponse.redirect).toHaveBeenCalledWith('/hello');

    // Should not end call for redirect
    expect(mockTwimlResponse.hangup).not.toHaveBeenCalled();
  });

  test('should handle invalid selection with error message and redirect', () => {
    const mockEvent = {
      Digits: '9',
      From: '+15551234567',
    };

    handler(mockContext, mockEvent, mockCallback);

    // Verify error message
    expect(mockTwimlResponse.say).toHaveBeenCalledWith(
      {
        voice: 'alice',
        language: 'en-US',
      },
      'Invalid selection. Please try again.'
    );

    // Verify redirect back to main menu
    expect(mockTwimlResponse.redirect).toHaveBeenCalledWith('/hello');

    // Should not end call for redirect
    expect(mockTwimlResponse.hangup).not.toHaveBeenCalled();
  });

  test('should handle empty digits as invalid selection', () => {
    const mockEvent = {
      Digits: '',
      From: '+15551234567',
    };

    handler(mockContext, mockEvent, mockCallback);

    // Verify error message for empty input
    expect(mockTwimlResponse.say).toHaveBeenCalledWith(
      {
        voice: 'alice',
        language: 'en-US',
      },
      'Invalid selection. Please try again.'
    );

    // Verify redirect back to main menu
    expect(mockTwimlResponse.redirect).toHaveBeenCalledWith('/hello');
  });

  test('should handle undefined digits as invalid selection', () => {
    const mockEvent = {
      From: '+15551234567',
      // Digits is undefined
    };

    handler(mockContext, mockEvent, mockCallback);

    // Verify error message for undefined input
    expect(mockTwimlResponse.say).toHaveBeenCalledWith(
      {
        voice: 'alice',
        language: 'en-US',
      },
      'Invalid selection. Please try again.'
    );

    // Verify redirect back to main menu
    expect(mockTwimlResponse.redirect).toHaveBeenCalledWith('/hello');
  });

  test('should not hang up for redirect options (0 and invalid)', () => {
    const redirectOptions = ['0', '9', '', undefined];

    redirectOptions.forEach(digits => {
      jest.clearAllMocks();

      const mockEvent = {
        Digits: digits,
        From: '+15551234567',
      };

      handler(mockContext, mockEvent, mockCallback);

      // Should redirect but not hang up
      expect(mockTwimlResponse.redirect).toHaveBeenCalledWith('/hello');
      expect(mockTwimlResponse.hangup).not.toHaveBeenCalled();
      expect(mockTwimlResponse.pause).not.toHaveBeenCalled();
    });
  });

  test('should hang up for valid selections (1 and 2)', () => {
    const validOptions = ['1', '2'];

    validOptions.forEach(digits => {
      jest.clearAllMocks();

      const mockEvent = {
        Digits: digits,
        From: '+15551234567',
      };

      handler(mockContext, mockEvent, mockCallback);

      // Should end call for valid selections
      expect(mockTwimlResponse.pause).toHaveBeenCalledWith({ length: 1 });
      expect(mockTwimlResponse.say).toHaveBeenCalledWith(
        'Thank you for calling. Goodbye!'
      );
      expect(mockTwimlResponse.hangup).toHaveBeenCalled();
    });
  });
});
