// ABOUTME: Tests for conference timer Twilio function
// ABOUTME: Validates timer-based conference termination via Twilio API

const conferenceTimer = require('../../../functions/conference-timer');

// Mock Twilio client
const mockUpdate = jest.fn();
const mockFetch = jest.fn();

const createMockTwilioContext = () => {
  return {
    getTwilioClient: jest.fn(() => ({
      conferences: jest.fn(sid => ({
        update: mockUpdate,
        fetch: mockFetch,
      })),
    })),
  };
};

describe('Conference Timer Function', () => {
  let context;
  let callback;

  beforeEach(() => {
    context = createMockTwilioContext();
    callback = jest.fn();
    mockUpdate.mockClear();
    mockFetch.mockClear();
  });

  describe('Basic timer functionality', () => {
    it('should terminate a conference by updating status to completed', async () => {
      const event = {
        ConferenceSid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      };

      mockFetch.mockResolvedValue({
        sid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        status: 'in-progress',
        friendlyName: 'Test Conference',
      });

      mockUpdate.mockResolvedValue({
        sid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        status: 'completed',
      });

      await conferenceTimer.handler(context, event, callback);

      expect(mockUpdate).toHaveBeenCalledWith({ status: 'completed' });
      expect(callback).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          success: true,
          conferenceSid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
          action: 'terminated',
        })
      );
    });

    it('should handle missing ConferenceSid', async () => {
      const event = {};

      await conferenceTimer.handler(context, event, callback);

      expect(callback).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('ConferenceSid'),
        })
      );
    });

    it('should handle empty ConferenceSid', async () => {
      const event = {
        ConferenceSid: '',
      };

      await conferenceTimer.handler(context, event, callback);

      expect(callback).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('ConferenceSid'),
        })
      );
    });
  });

  describe('Conference status validation', () => {
    it('should check conference exists before terminating', async () => {
      const event = {
        ConferenceSid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      };

      mockFetch.mockResolvedValue({
        sid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        status: 'in-progress',
      });

      mockUpdate.mockResolvedValue({
        sid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        status: 'completed',
      });

      await conferenceTimer.handler(context, event, callback);

      expect(mockFetch).toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should handle conference not found', async () => {
      const event = {
        ConferenceSid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      };

      const notFoundError = new Error('Conference not found');
      notFoundError.status = 404;
      mockFetch.mockRejectedValue(notFoundError);

      await conferenceTimer.handler(context, event, callback);

      expect(callback).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('not found'),
        })
      );
    });

    it('should skip termination if conference already completed', async () => {
      const event = {
        ConferenceSid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      };

      mockFetch.mockResolvedValue({
        sid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        status: 'completed',
      });

      await conferenceTimer.handler(context, event, callback);

      expect(mockUpdate).not.toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          success: true,
          action: 'already_completed',
          message: expect.stringContaining('already completed'),
        })
      );
    });
  });

  describe('Error handling', () => {
    it('should handle Twilio API errors', async () => {
      const event = {
        ConferenceSid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      };

      mockFetch.mockResolvedValue({
        sid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        status: 'in-progress',
      });

      const apiError = new Error('Twilio API error');
      apiError.status = 500;
      mockUpdate.mockRejectedValue(apiError);

      await conferenceTimer.handler(context, event, callback);

      expect(callback).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('API error'),
        })
      );
    });

    it('should handle network errors', async () => {
      const event = {
        ConferenceSid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      };

      const networkError = new Error('Network timeout');
      mockFetch.mockRejectedValue(networkError);

      await conferenceTimer.handler(context, event, callback);

      expect(callback).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('timeout'),
        })
      );
    });

    it('should handle exceptions gracefully', async () => {
      const event = {
        ConferenceSid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      };

      const unexpectedError = new Error('Unexpected error');
      mockFetch.mockRejectedValue(unexpectedError);

      await conferenceTimer.handler(context, event, callback);

      expect(callback).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          success: false,
        })
      );
    });
  });

  describe('Response format', () => {
    it('should include timestamp in response', async () => {
      const event = {
        ConferenceSid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      };

      mockFetch.mockResolvedValue({
        sid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        status: 'in-progress',
      });

      mockUpdate.mockResolvedValue({
        sid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        status: 'completed',
      });

      await conferenceTimer.handler(context, event, callback);

      const response = callback.mock.calls[0][1];
      expect(response).toHaveProperty('timestamp');
      expect(response.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should include conference SID in success response', async () => {
      const event = {
        ConferenceSid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      };

      mockFetch.mockResolvedValue({
        sid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        status: 'in-progress',
      });

      mockUpdate.mockResolvedValue({
        sid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        status: 'completed',
      });

      await conferenceTimer.handler(context, event, callback);

      const response = callback.mock.calls[0][1];
      expect(response.conferenceSid).toBe('CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
    });

    it('should include previous status in response', async () => {
      const event = {
        ConferenceSid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      };

      mockFetch.mockResolvedValue({
        sid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        status: 'in-progress',
      });

      mockUpdate.mockResolvedValue({
        sid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        status: 'completed',
      });

      await conferenceTimer.handler(context, event, callback);

      const response = callback.mock.calls[0][1];
      expect(response.previousStatus).toBe('in-progress');
    });
  });

  describe('Logging', () => {
    let consoleLogSpy;
    let consoleErrorSpy;

    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should log conference termination', async () => {
      const event = {
        ConferenceSid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      };

      mockFetch.mockResolvedValue({
        sid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        status: 'in-progress',
      });

      mockUpdate.mockResolvedValue({
        sid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        status: 'completed',
      });

      await conferenceTimer.handler(context, event, callback);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Terminating conference')
      );
    });

    it('should log errors to console', async () => {
      const event = {
        ConferenceSid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      };

      const error = new Error('Test error');
      mockFetch.mockRejectedValue(error);

      await conferenceTimer.handler(context, event, callback);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error'),
        expect.anything()
      );
    });
  });

  describe('Conference SID validation', () => {
    it('should accept valid conference SID starting with CF', async () => {
      const event = {
        ConferenceSid: 'CF1234567890abcdef1234567890abcdef',
      };

      mockFetch.mockResolvedValue({
        sid: event.ConferenceSid,
        status: 'in-progress',
      });

      mockUpdate.mockResolvedValue({
        sid: event.ConferenceSid,
        status: 'completed',
      });

      await conferenceTimer.handler(context, event, callback);

      expect(callback).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          success: true,
        })
      );
    });

    it('should validate SID format', async () => {
      const event = {
        ConferenceSid: 'INVALID',
      };

      await conferenceTimer.handler(context, event, callback);

      expect(callback).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('valid'),
        })
      );
    });
  });
});
