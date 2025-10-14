// ABOUTME: Unit tests for transcription webhook handler
// ABOUTME: Validates parsing of Language Operator results and extracting sentiment/analytics

const transcriptionWebhook = require('../../../functions/transcription-webhook');

describe('Transcription Webhook', () => {
  let context;
  let callback;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    context = global.createMockTwilioContext();
    callback = jest.fn();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe('Basic transcription handling', () => {
    it('should handle transcription-completed event', () => {
      const event = {
        TranscriptionSid: 'TRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        TranscriptionStatus: 'completed',
        TranscriptionText: 'Hello, how can I help you today?',
        RecordingSid: 'RExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        CallSid: 'CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      };

      transcriptionWebhook.handler(context, event, callback);

      expect(callback).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          success: true,
          transcriptionSid: 'TRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        })
      );
    });

    it('should extract transcription text', () => {
      const event = {
        TranscriptionSid: 'TRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        TranscriptionText: 'Thank you for calling, my name is Sarah.',
        TranscriptionStatus: 'completed',
      };

      transcriptionWebhook.handler(context, event, callback);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Thank you for calling')
      );
    });

    it('should handle missing transcription text', () => {
      const event = {
        TranscriptionSid: 'TRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        TranscriptionStatus: 'completed',
      };

      transcriptionWebhook.handler(context, event, callback);

      expect(callback).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          success: true,
          transcriptionText: undefined,
        })
      );
    });
  });

  describe('Sentiment analysis', () => {
    it('should detect positive sentiment keywords', () => {
      const event = {
        TranscriptionSid: 'TRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        TranscriptionText:
          'Thank you so much! This is great. I am very happy with the service.',
        TranscriptionStatus: 'completed',
      };

      transcriptionWebhook.handler(context, event, callback);

      const response = callback.mock.calls[0][1];
      expect(response.analytics).toBeDefined();
      expect(response.analytics.sentiment).toBe('positive');
    });

    it('should detect negative sentiment keywords', () => {
      const event = {
        TranscriptionSid: 'TRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        TranscriptionText:
          'This is terrible. I am very frustrated and angry. This is awful.',
        TranscriptionStatus: 'completed',
      };

      transcriptionWebhook.handler(context, event, callback);

      const response = callback.mock.calls[0][1];
      expect(response.analytics.sentiment).toBe('negative');
    });

    it('should detect neutral sentiment for neutral text', () => {
      const event = {
        TranscriptionSid: 'TRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        TranscriptionText:
          'I am calling about my order. Can you check the status?',
        TranscriptionStatus: 'completed',
      };

      transcriptionWebhook.handler(context, event, callback);

      const response = callback.mock.calls[0][1];
      expect(response.analytics.sentiment).toBe('neutral');
    });
  });

  describe('Resolution detection', () => {
    it('should detect successful resolution', () => {
      const event = {
        TranscriptionSid: 'TRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        TranscriptionText:
          'Thank you for resolving my issue. Problem is solved. Everything is fixed now.',
        TranscriptionStatus: 'completed',
      };

      transcriptionWebhook.handler(context, event, callback);

      const response = callback.mock.calls[0][1];
      expect(response.analytics.resolution).toBe('resolved');
    });

    it('should detect unresolved issues', () => {
      const event = {
        TranscriptionSid: 'TRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        TranscriptionText:
          'This is still not working. The problem persists. Issue remains.',
        TranscriptionStatus: 'completed',
      };

      transcriptionWebhook.handler(context, event, callback);

      const response = callback.mock.calls[0][1];
      expect(response.analytics.resolution).toBe('unresolved');
    });

    it('should default to unknown for ambiguous resolution', () => {
      const event = {
        TranscriptionSid: 'TRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        TranscriptionText: 'I am calling about my account.',
        TranscriptionStatus: 'completed',
      };

      transcriptionWebhook.handler(context, event, callback);

      const response = callback.mock.calls[0][1];
      expect(response.analytics.resolution).toBe('unknown');
    });
  });

  describe('Escalation detection', () => {
    it('should detect escalation requests', () => {
      const event = {
        TranscriptionSid: 'TRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        TranscriptionText:
          'I want to speak to a supervisor. Transfer me to a manager please.',
        TranscriptionStatus: 'completed',
      };

      transcriptionWebhook.handler(context, event, callback);

      const response = callback.mock.calls[0][1];
      expect(response.analytics.escalation).toBe(true);
    });

    it('should detect no escalation in normal conversation', () => {
      const event = {
        TranscriptionSid: 'TRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        TranscriptionText:
          'Thank you for your help. I appreciate your assistance.',
        TranscriptionStatus: 'completed',
      };

      transcriptionWebhook.handler(context, event, callback);

      const response = callback.mock.calls[0][1];
      expect(response.analytics.escalation).toBe(false);
    });

    it('should detect multiple escalation keywords', () => {
      const event = {
        TranscriptionSid: 'TRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        TranscriptionText:
          'This is ridiculous. I demand to speak to your supervisor now!',
        TranscriptionStatus: 'completed',
      };

      transcriptionWebhook.handler(context, event, callback);

      const response = callback.mock.calls[0][1];
      expect(response.analytics.escalation).toBe(true);
    });
  });

  describe('Language Operator integration', () => {
    it('should parse Language Operator JSON results', () => {
      const event = {
        TranscriptionSid: 'TRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        TranscriptionText:
          '{"sentiment": "positive", "intent": "billing_inquiry", "entities": ["account_number", "payment"]}',
        TranscriptionStatus: 'completed',
        AddOns: JSON.stringify({
          results: {
            language_operator: {
              result: {
                sentiment: 'positive',
                topics: ['billing', 'payment'],
              },
            },
          },
        }),
      };

      transcriptionWebhook.handler(context, event, callback);

      expect(callback).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          success: true,
        })
      );
    });

    it('should handle missing AddOns gracefully', () => {
      const event = {
        TranscriptionSid: 'TRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        TranscriptionText: 'Hello, how can I help you?',
        TranscriptionStatus: 'completed',
      };

      transcriptionWebhook.handler(context, event, callback);

      expect(callback).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          success: true,
          analytics: expect.any(Object),
        })
      );
    });
  });

  describe('Analytics output', () => {
    it('should include all analytics fields in response', () => {
      const event = {
        TranscriptionSid: 'TRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        TranscriptionText:
          'I am very happy. My problem is resolved. Thank you!',
        TranscriptionStatus: 'completed',
      };

      transcriptionWebhook.handler(context, event, callback);

      const response = callback.mock.calls[0][1];
      expect(response.analytics).toHaveProperty('sentiment');
      expect(response.analytics).toHaveProperty('resolution');
      expect(response.analytics).toHaveProperty('escalation');
      expect(response.analytics).toHaveProperty('wordCount');
    });

    it('should calculate word count', () => {
      const event = {
        TranscriptionSid: 'TRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        TranscriptionText: 'Hello this is a test message',
        TranscriptionStatus: 'completed',
      };

      transcriptionWebhook.handler(context, event, callback);

      const response = callback.mock.calls[0][1];
      expect(response.analytics.wordCount).toBe(6);
    });

    it('should handle empty transcription text for word count', () => {
      const event = {
        TranscriptionSid: 'TRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        TranscriptionText: '',
        TranscriptionStatus: 'completed',
      };

      transcriptionWebhook.handler(context, event, callback);

      const response = callback.mock.calls[0][1];
      expect(response.analytics.wordCount).toBe(0);
    });
  });

  describe('Error handling', () => {
    it('should handle missing TranscriptionSid', () => {
      const event = {
        TranscriptionText: 'Hello',
        TranscriptionStatus: 'completed',
      };

      transcriptionWebhook.handler(context, event, callback);

      expect(callback).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('TranscriptionSid'),
        })
      );
    });

    it('should handle failed transcription status', () => {
      const event = {
        TranscriptionSid: 'TRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        TranscriptionStatus: 'failed',
        TranscriptionText: null,
      };

      transcriptionWebhook.handler(context, event, callback);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('failed')
      );
    });

    it('should handle exceptions gracefully', () => {
      const event = null;

      transcriptionWebhook.handler(context, event, callback);

      expect(callback).toHaveBeenCalled();
      const callbackArgs = callback.mock.calls[0];
      expect(callbackArgs[1]).toHaveProperty('success', false);
    });

    it('should log errors to console', () => {
      const event = null;

      transcriptionWebhook.handler(context, event, callback);

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('Response format', () => {
    it('should include timestamp in response', () => {
      const event = {
        TranscriptionSid: 'TRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        TranscriptionText: 'Test',
        TranscriptionStatus: 'completed',
      };

      transcriptionWebhook.handler(context, event, callback);

      const response = callback.mock.calls[0][1];
      expect(response.timestamp).toBeDefined();
      expect(new Date(response.timestamp).toString()).not.toBe('Invalid Date');
    });

    it('should include all SIDs in response', () => {
      const event = {
        TranscriptionSid: 'TRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        RecordingSid: 'RExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        CallSid: 'CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        TranscriptionText: 'Test',
        TranscriptionStatus: 'completed',
      };

      transcriptionWebhook.handler(context, event, callback);

      const response = callback.mock.calls[0][1];
      expect(response.transcriptionSid).toBe(
        'TRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
      );
      expect(response.recordingSid).toBe('RExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
      expect(response.callSid).toBe('CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
    });
  });

  describe('Case sensitivity', () => {
    it('should detect keywords case-insensitively', () => {
      const event = {
        TranscriptionSid: 'TRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        TranscriptionText: 'THANK YOU! This is GREAT. I am HAPPY.',
        TranscriptionStatus: 'completed',
      };

      transcriptionWebhook.handler(context, event, callback);

      const response = callback.mock.calls[0][1];
      expect(response.analytics.sentiment).toBe('positive');
    });

    it('should handle mixed case escalation keywords', () => {
      const event = {
        TranscriptionSid: 'TRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        TranscriptionText: 'I want to speak to a SUPERVISOR.',
        TranscriptionStatus: 'completed',
      };

      transcriptionWebhook.handler(context, event, callback);

      const response = callback.mock.calls[0][1];
      expect(response.analytics.escalation).toBe(true);
    });
  });
});
