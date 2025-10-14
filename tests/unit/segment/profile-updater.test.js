// ABOUTME: Tests for Segment CDP profile updates based on call outcomes
// ABOUTME: Validates churn risk and propensity to buy calculations from analytics data

const ProfileUpdater = require('../../../src/segment/profile-updater');

// Mock Segment Analytics
const mockIdentify = jest.fn();
const mockTrack = jest.fn();

jest.mock('@segment/analytics-node', () => {
  const MockAnalytics = jest.fn().mockImplementation(() => ({
    identify: mockIdentify,
    track: mockTrack,
  }));
  return {
    Analytics: MockAnalytics,
  };
});

describe('Segment Profile Updater', () => {
  let profileUpdater;

  beforeEach(() => {
    mockIdentify.mockClear();
    mockTrack.mockClear();

    mockIdentify.mockImplementation((params, callback) => {
      if (callback) callback(null);
    });
    mockTrack.mockImplementation((params, callback) => {
      if (callback) callback(null);
    });

    const { Analytics } = require('@segment/analytics-node');
    const analytics = new Analytics();
    profileUpdater = new ProfileUpdater(analytics);
  });

  describe('Profile update from call analytics', () => {
    it('should update profile with call analytics', async () => {
      const userId = 'cust_a3e3835ce1df229cce1271a25b0c8822';
      const analytics = {
        sentiment: 'positive',
        resolution: 'resolved',
        escalation: false,
        wordCount: 250,
      };

      await profileUpdater.updateFromCallAnalytics(userId, analytics);

      const callArgs = mockIdentify.mock.calls[0][0];
      expect(callArgs.userId).toBe(userId);
      expect(callArgs.traits).toBeDefined();
    });

    it('should increment total_calls counter', async () => {
      const userId = 'cust_test';
      const analytics = {
        sentiment: 'positive',
        resolution: 'resolved',
        escalation: false,
        wordCount: 100,
      };

      await profileUpdater.updateFromCallAnalytics(userId, analytics);

      const callArgs = mockIdentify.mock.calls[0][0];
      expect(callArgs.traits.total_calls).toBe(1);
    });

    it('should track call_completed event', async () => {
      const userId = 'cust_test';
      const analytics = {
        sentiment: 'positive',
        resolution: 'resolved',
        escalation: false,
        wordCount: 100,
      };

      await profileUpdater.updateFromCallAnalytics(userId, analytics);

      expect(mockTrack).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: userId,
          event: 'call_completed',
          properties: expect.objectContaining({
            sentiment: 'positive',
            resolution: 'resolved',
            escalation: false,
          }),
        }),
        expect.any(Function)
      );
    });
  });

  describe('Churn risk calculation', () => {
    it('should calculate low churn risk for positive resolved calls', async () => {
      const userId = 'cust_test';
      const analytics = {
        sentiment: 'positive',
        resolution: 'resolved',
        escalation: false,
        wordCount: 100,
      };

      await profileUpdater.updateFromCallAnalytics(userId, analytics);

      const callArgs = mockIdentify.mock.calls[0][0];
      expect(callArgs.traits.churn_risk).toBeLessThanOrEqual(30);
    });

    it('should calculate high churn risk for negative unresolved calls', async () => {
      const userId = 'cust_test';
      const analytics = {
        sentiment: 'negative',
        resolution: 'unresolved',
        escalation: false,
        wordCount: 100,
      };

      await profileUpdater.updateFromCallAnalytics(userId, analytics);

      const callArgs = mockIdentify.mock.calls[0][0];
      expect(callArgs.traits.churn_risk).toBeGreaterThanOrEqual(60);
    });

    it('should increase churn risk for escalated calls', async () => {
      const userId = 'cust_test';
      const analytics = {
        sentiment: 'neutral',
        resolution: 'resolved',
        escalation: true,
        wordCount: 100,
      };

      await profileUpdater.updateFromCallAnalytics(userId, analytics);

      const callArgs = mockIdentify.mock.calls[0][0];
      expect(callArgs.traits.churn_risk).toBeGreaterThanOrEqual(40);
    });

    it('should cap churn risk at 100', async () => {
      const userId = 'cust_test';
      const analytics = {
        sentiment: 'negative',
        resolution: 'unresolved',
        escalation: true,
        wordCount: 500, // Long call
      };

      await profileUpdater.updateFromCallAnalytics(userId, analytics);

      const callArgs = mockIdentify.mock.calls[0][0];
      expect(callArgs.traits.churn_risk).toBeLessThanOrEqual(100);
    });
  });

  describe('Propensity to buy calculation', () => {
    it('should calculate high propensity for positive resolved calls', async () => {
      const userId = 'cust_test';
      const analytics = {
        sentiment: 'positive',
        resolution: 'resolved',
        escalation: false,
        wordCount: 100,
      };

      await profileUpdater.updateFromCallAnalytics(userId, analytics);

      const callArgs = mockIdentify.mock.calls[0][0];
      expect(callArgs.traits.propensity_to_buy).toBeGreaterThanOrEqual(60);
    });

    it('should calculate low propensity for negative calls', async () => {
      const userId = 'cust_test';
      const analytics = {
        sentiment: 'negative',
        resolution: 'unresolved',
        escalation: false,
        wordCount: 100,
      };

      await profileUpdater.updateFromCallAnalytics(userId, analytics);

      const callArgs = mockIdentify.mock.calls[0][0];
      expect(callArgs.traits.propensity_to_buy).toBeLessThanOrEqual(40);
    });

    it('should reduce propensity for escalated calls', async () => {
      const userId = 'cust_test';
      const analytics = {
        sentiment: 'neutral',
        resolution: 'resolved',
        escalation: true,
        wordCount: 100,
      };

      await profileUpdater.updateFromCallAnalytics(userId, analytics);

      const callArgs = mockIdentify.mock.calls[0][0];
      expect(callArgs.traits.propensity_to_buy).toBeLessThanOrEqual(50);
    });

    it('should cap propensity to buy at 100', async () => {
      const userId = 'cust_test';
      const analytics = {
        sentiment: 'positive',
        resolution: 'resolved',
        escalation: false,
        wordCount: 50, // Quick resolution
      };

      await profileUpdater.updateFromCallAnalytics(userId, analytics);

      const callArgs = mockIdentify.mock.calls[0][0];
      expect(callArgs.traits.propensity_to_buy).toBeLessThanOrEqual(100);
    });
  });

  describe('Satisfaction score calculation', () => {
    it('should calculate high satisfaction for positive resolved calls', async () => {
      const userId = 'cust_test';
      const analytics = {
        sentiment: 'positive',
        resolution: 'resolved',
        escalation: false,
        wordCount: 100,
      };

      await profileUpdater.updateFromCallAnalytics(userId, analytics);

      const callArgs = mockIdentify.mock.calls[0][0];
      expect(callArgs.traits.satisfaction_score).toBeGreaterThanOrEqual(70);
    });

    it('should calculate low satisfaction for negative calls', async () => {
      const userId = 'cust_test';
      const analytics = {
        sentiment: 'negative',
        resolution: 'unresolved',
        escalation: true,
        wordCount: 100,
      };

      await profileUpdater.updateFromCallAnalytics(userId, analytics);

      const callArgs = mockIdentify.mock.calls[0][0];
      expect(callArgs.traits.satisfaction_score).toBeLessThanOrEqual(40);
    });

    it('should handle neutral sentiment appropriately', async () => {
      const userId = 'cust_test';
      const analytics = {
        sentiment: 'neutral',
        resolution: 'resolved',
        escalation: false,
        wordCount: 100,
      };

      await profileUpdater.updateFromCallAnalytics(userId, analytics);

      const callArgs = mockIdentify.mock.calls[0][0];
      expect(callArgs.traits.satisfaction_score).toBeGreaterThanOrEqual(40);
      expect(callArgs.traits.satisfaction_score).toBeLessThanOrEqual(70);
    });
  });

  describe('Call duration impact', () => {
    it('should factor in word count as proxy for call duration', async () => {
      const userId = 'cust_test';
      const shortCall = {
        sentiment: 'positive',
        resolution: 'resolved',
        escalation: false,
        wordCount: 50, // Quick resolution
      };

      await profileUpdater.updateFromCallAnalytics(userId, shortCall);

      const shortCallArgs = mockIdentify.mock.calls[0][0];
      const shortCallPropensity = shortCallArgs.traits.propensity_to_buy;

      mockIdentify.mockClear();

      const longCall = {
        sentiment: 'positive',
        resolution: 'resolved',
        escalation: false,
        wordCount: 500, // Long call
      };

      await profileUpdater.updateFromCallAnalytics(userId, longCall);

      const longCallArgs = mockIdentify.mock.calls[0][0];
      const longCallPropensity = longCallArgs.traits.propensity_to_buy;

      // Short calls with same outcome should have higher propensity
      expect(shortCallPropensity).toBeGreaterThan(longCallPropensity);
    });
  });

  describe('Webhook integration', () => {
    it('should update from transcription webhook data', async () => {
      const webhookData = {
        userId: 'cust_test',
        analytics: {
          sentiment: 'positive',
          resolution: 'resolved',
          escalation: false,
          wordCount: 150,
        },
        transcriptionSid: 'TRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        callSid: 'CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      };

      await profileUpdater.updateFromWebhook(webhookData);

      expect(mockIdentify).toHaveBeenCalled();
      expect(mockTrack).toHaveBeenCalled();

      const callArgs = mockIdentify.mock.calls[0][0];
      expect(callArgs.userId).toBe('cust_test');
    });

    it('should include webhook metadata in track event', async () => {
      const webhookData = {
        userId: 'cust_test',
        analytics: {
          sentiment: 'positive',
          resolution: 'resolved',
          escalation: false,
          wordCount: 150,
        },
        transcriptionSid: 'TRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        callSid: 'CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      };

      await profileUpdater.updateFromWebhook(webhookData);

      expect(mockTrack).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            transcriptionSid: 'TRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
            callSid: 'CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
          }),
        }),
        expect.any(Function)
      );
    });
  });

  describe('Error handling', () => {
    it('should handle Segment API errors', async () => {
      const userId = 'cust_test';
      const analytics = {
        sentiment: 'positive',
        resolution: 'resolved',
        escalation: false,
        wordCount: 100,
      };

      mockIdentify.mockImplementation((params, callback) => {
        if (callback) callback(new Error('Segment API error'));
      });

      await expect(
        profileUpdater.updateFromCallAnalytics(userId, analytics)
      ).rejects.toThrow('Segment API error');
    });

    it('should validate required analytics fields', async () => {
      const userId = 'cust_test';
      const invalidAnalytics = {
        sentiment: 'positive',
        // Missing resolution, escalation, wordCount
      };

      await expect(
        profileUpdater.updateFromCallAnalytics(userId, invalidAnalytics)
      ).rejects.toThrow('required');
    });
  });

  describe('Initialization', () => {
    it('should initialize with write key', () => {
      const writeKey = 'test_write_key_12345';
      const updater = ProfileUpdater.initialize(writeKey);

      expect(updater).toBeInstanceOf(ProfileUpdater);
    });

    it('should throw error for missing write key', () => {
      expect(() => ProfileUpdater.initialize()).toThrow(
        'Segment write key is required'
      );
    });
  });
});
