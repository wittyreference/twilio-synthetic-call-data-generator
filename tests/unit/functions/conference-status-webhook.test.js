// ABOUTME: Unit tests for conference status webhook handler
// ABOUTME: Validates handling of conference, call, and recording completion events

const conferenceStatusWebhook = require('../../../functions/conference-status-webhook');

describe('Conference Status Webhook', () => {
  let context;
  let callback;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    // Create mock Twilio context
    context = global.createMockTwilioContext();

    // Mock callback
    callback = jest.fn();

    // Spy on console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe('conference-end event', () => {
    it('should handle conference-end event successfully', () => {
      const event = {
        StatusCallbackEvent: 'conference-end',
        ConferenceSid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        FriendlyName: 'Test Conference',
        AccountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        Timestamp: '2025-10-07T12:00:00Z',
      };

      conferenceStatusWebhook.handler(context, event, callback);

      expect(callback).toHaveBeenCalledWith(null, expect.any(Object));
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Conference ended')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
      );
    });

    it('should extract conference metadata from event', () => {
      const event = {
        StatusCallbackEvent: 'conference-end',
        ConferenceSid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        FriendlyName: 'Customer-Agent Call',
        AccountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        Timestamp: '2025-10-07T12:00:00Z',
        Duration: '300',
      };

      conferenceStatusWebhook.handler(context, event, callback);

      expect(callback).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          success: true,
          event: 'conference-end',
          conferenceSid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        })
      );
    });

    it('should log conference duration if provided', () => {
      const event = {
        StatusCallbackEvent: 'conference-end',
        ConferenceSid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        Duration: '245',
      };

      conferenceStatusWebhook.handler(context, event, callback);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Duration: 245 seconds')
      );
    });
  });

  describe('participant-leave event', () => {
    it('should handle participant-leave event', () => {
      const event = {
        StatusCallbackEvent: 'participant-leave',
        ConferenceSid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        CallSid: 'CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        ParticipantLabel: 'customer',
      };

      conferenceStatusWebhook.handler(context, event, callback);

      expect(callback).toHaveBeenCalledWith(null, expect.any(Object));
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Participant left')
      );
    });

    it('should log participant label if provided', () => {
      const event = {
        StatusCallbackEvent: 'participant-leave',
        ConferenceSid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        CallSid: 'CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        ParticipantLabel: 'agent',
      };

      conferenceStatusWebhook.handler(context, event, callback);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('agent')
      );
    });
  });

  describe('recording-completed event', () => {
    it('should handle recording-completed event', async () => {
      const event = {
        StatusCallbackEvent: 'recording-completed',
        RecordingSid: 'RExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        RecordingUrl: 'https://api.twilio.com/recordings/RExx',
        ConferenceSid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        Duration: '180',
        RecordingStatus: 'completed',
      };

      await conferenceStatusWebhook.handler(context, event, callback);

      expect(callback).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          success: true,
          event: 'recording-completed',
          recordingSid: 'RExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        })
      );
    });

    it('should log recording URL and duration', () => {
      const event = {
        StatusCallbackEvent: 'recording-completed',
        RecordingSid: 'RExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        RecordingUrl: 'https://api.twilio.com/recordings/RExx.mp3',
        Duration: '180',
      };

      conferenceStatusWebhook.handler(context, event, callback);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Recording completed')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('180 seconds')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('https://api.twilio.com/recordings/RExx.mp3')
      );
    });
  });

  describe('call-ended event', () => {
    it('should handle call-ended event', () => {
      const event = {
        StatusCallbackEvent: 'call-ended',
        CallSid: 'CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        CallDuration: '120',
        CallStatus: 'completed',
      };

      conferenceStatusWebhook.handler(context, event, callback);

      expect(callback).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          success: true,
          event: 'call-ended',
        })
      );
    });

    it('should log call duration and status', () => {
      const event = {
        StatusCallbackEvent: 'call-ended',
        CallSid: 'CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        CallDuration: '150',
        CallStatus: 'completed',
      };

      conferenceStatusWebhook.handler(context, event, callback);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Call ended')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('150')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('completed')
      );
    });
  });

  describe('Error handling', () => {
    it('should handle missing StatusCallbackEvent', () => {
      const event = {
        ConferenceSid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      };

      conferenceStatusWebhook.handler(context, event, callback);

      expect(callback).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('StatusCallbackEvent'),
        })
      );
    });

    it('should handle unknown event types gracefully', () => {
      const event = {
        StatusCallbackEvent: 'unknown-event-type',
        ConferenceSid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      };

      conferenceStatusWebhook.handler(context, event, callback);

      expect(callback).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          success: true,
          event: 'unknown-event-type',
        })
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown event')
      );
    });

    it('should handle exceptions gracefully', () => {
      const event = null;

      conferenceStatusWebhook.handler(context, event, callback);

      expect(callback).toHaveBeenCalled();
      const callbackArgs = callback.mock.calls[0];
      expect(callbackArgs[0]).toBe(null); // Error should be null (Twilio pattern)
      expect(callbackArgs[1]).toHaveProperty('success', false);
    });
  });

  describe('Response format', () => {
    it('should return properly formatted success response', () => {
      const event = {
        StatusCallbackEvent: 'conference-end',
        ConferenceSid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      };

      conferenceStatusWebhook.handler(context, event, callback);

      expect(callback).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          success: true,
          event: 'conference-end',
          conferenceSid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
          timestamp: expect.any(String),
        })
      );
    });

    it('should include timestamp in all responses', () => {
      const event = {
        StatusCallbackEvent: 'conference-end',
        ConferenceSid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      };

      conferenceStatusWebhook.handler(context, event, callback);

      const response = callback.mock.calls[0][1];
      expect(response.timestamp).toBeDefined();
      expect(new Date(response.timestamp).toString()).not.toBe('Invalid Date');
    });
  });

  describe('Logging', () => {
    it('should log all relevant event data', () => {
      const event = {
        StatusCallbackEvent: 'conference-end',
        ConferenceSid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        FriendlyName: 'Test Conference',
        Duration: '300',
      };

      conferenceStatusWebhook.handler(context, event, callback);

      expect(consoleLogSpy).toHaveBeenCalled();
      const allLogs = consoleLogSpy.mock.calls
        .map(call => call.join(' '))
        .join('\n');
      expect(allLogs).toContain('CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
      expect(allLogs).toContain('300');
    });

    it('should not log errors for successful events', () => {
      const event = {
        StatusCallbackEvent: 'conference-end',
        ConferenceSid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      };

      conferenceStatusWebhook.handler(context, event, callback);

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should log errors for failed events', () => {
      const event = null;

      conferenceStatusWebhook.handler(context, event, callback);

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('Integration with Twilio context', () => {
    it('should receive and use Twilio context', () => {
      const event = {
        StatusCallbackEvent: 'conference-end',
        ConferenceSid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      };

      conferenceStatusWebhook.handler(context, event, callback);

      expect(callback).toHaveBeenCalled();
      // Context is available but not necessarily used in this webhook
    });

    it('should work with minimal context', () => {
      const minimalContext = {};
      const event = {
        StatusCallbackEvent: 'conference-end',
        ConferenceSid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      };

      conferenceStatusWebhook.handler(minimalContext, event, callback);

      expect(callback).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          success: true,
        })
      );
    });
  });
});
