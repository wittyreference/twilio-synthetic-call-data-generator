// ABOUTME: Updates Segment CDP profiles based on call analytics
// ABOUTME: Calculates churn risk, propensity to buy, and satisfaction scores from call outcomes

/**
 * Calculates churn risk score (0-100) based on call analytics
 * Higher score = higher risk of customer churning
 */
function calculateChurnRisk(analytics) {
  let risk = 50; // Start at baseline

  // Sentiment impact
  if (analytics.sentiment === 'negative') {
    risk += 30;
  } else if (analytics.sentiment === 'positive') {
    risk -= 20;
  }

  // Resolution impact
  if (analytics.resolution === 'unresolved') {
    risk += 25;
  } else if (analytics.resolution === 'resolved') {
    risk -= 15;
  }

  // Escalation impact
  if (analytics.escalation) {
    risk += 20;
  }

  // Call duration impact (word count proxy)
  // Long calls indicate complexity/frustration
  if (analytics.wordCount > 300) {
    risk += 10;
  } else if (analytics.wordCount < 100) {
    risk -= 5;
  }

  // Cap at 0-100
  return Math.max(0, Math.min(100, risk));
}

/**
 * Calculates propensity to buy score (0-100) based on call analytics
 * Higher score = higher likelihood of purchase
 */
function calculatePropensityToBuy(analytics) {
  let propensity = 50; // Start at baseline

  // Sentiment impact
  if (analytics.sentiment === 'positive') {
    propensity += 30;
  } else if (analytics.sentiment === 'negative') {
    propensity -= 25;
  }

  // Resolution impact
  if (analytics.resolution === 'resolved') {
    propensity += 20;
  } else if (analytics.resolution === 'unresolved') {
    propensity -= 15;
  }

  // Escalation impact (negative for buying intent)
  if (analytics.escalation) {
    propensity -= 20;
  }

  // Call duration impact
  // Quick resolutions indicate efficiency, boost propensity
  if (analytics.wordCount < 100) {
    propensity += 10;
  } else if (analytics.wordCount > 300) {
    propensity -= 10;
  }

  // Cap at 0-100
  return Math.max(0, Math.min(100, propensity));
}

/**
 * Calculates satisfaction score (0-100) based on call analytics
 */
function calculateSatisfactionScore(analytics) {
  let satisfaction = 50; // Start at baseline

  // Sentiment is primary driver
  if (analytics.sentiment === 'positive') {
    satisfaction += 35;
  } else if (analytics.sentiment === 'negative') {
    satisfaction -= 35;
  }

  // Resolution impact
  if (analytics.resolution === 'resolved') {
    satisfaction += 15;
  } else if (analytics.resolution === 'unresolved') {
    satisfaction -= 20;
  }

  // Escalation impact
  if (analytics.escalation) {
    satisfaction -= 15;
  }

  // Cap at 0-100
  return Math.max(0, Math.min(100, satisfaction));
}

class ProfileUpdater {
  constructor(analytics) {
    this.analytics = analytics;
  }

  /**
   * Updates a customer profile based on call analytics
   * @param {string} userId - Customer user ID
   * @param {Object} analytics - Call analytics object
   * @returns {Promise<void>}
   */
  async updateFromCallAnalytics(userId, analytics) {
    // Validate required fields
    if (!analytics.sentiment) {
      throw new Error('sentiment is required');
    }
    if (!analytics.resolution) {
      throw new Error('resolution is required');
    }
    if (analytics.escalation === undefined) {
      throw new Error('escalation is required');
    }
    if (!analytics.wordCount) {
      throw new Error('wordCount is required');
    }

    // Calculate scores
    const churnRisk = calculateChurnRisk(analytics);
    const propensityToBuy = calculatePropensityToBuy(analytics);
    const satisfactionScore = calculateSatisfactionScore(analytics);

    // Update profile with new traits
    await new Promise((resolve, reject) => {
      this.analytics.identify(
        {
          userId: userId,
          traits: {
            total_calls: 1, // In production, this would increment
            churn_risk: churnRisk,
            propensity_to_buy: propensityToBuy,
            satisfaction_score: satisfactionScore,
            last_call_sentiment: analytics.sentiment,
            last_call_resolution: analytics.resolution,
            last_call_escalated: analytics.escalation,
          },
          timestamp: new Date(),
        },
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });

    // Track call completion event
    await new Promise((resolve, reject) => {
      this.analytics.track(
        {
          userId: userId,
          event: 'call_completed',
          properties: {
            sentiment: analytics.sentiment,
            resolution: analytics.resolution,
            escalation: analytics.escalation,
            wordCount: analytics.wordCount,
            churnRisk: churnRisk,
            propensityToBuy: propensityToBuy,
            satisfactionScore: satisfactionScore,
          },
          timestamp: new Date(),
        },
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  /**
   * Updates profile from transcription webhook data
   * @param {Object} webhookData - Webhook payload
   * @returns {Promise<void>}
   */
  async updateFromWebhook(webhookData) {
    const { userId, analytics, transcriptionSid, callSid } = webhookData;

    // Validate required fields
    if (!userId) {
      throw new Error('userId is required');
    }
    if (!analytics) {
      throw new Error('analytics is required');
    }

    // Calculate scores
    const churnRisk = calculateChurnRisk(analytics);
    const propensityToBuy = calculatePropensityToBuy(analytics);
    const satisfactionScore = calculateSatisfactionScore(analytics);

    // Update profile
    await new Promise((resolve, reject) => {
      this.analytics.identify(
        {
          userId: userId,
          traits: {
            total_calls: 1,
            churn_risk: churnRisk,
            propensity_to_buy: propensityToBuy,
            satisfaction_score: satisfactionScore,
            last_call_sentiment: analytics.sentiment,
            last_call_resolution: analytics.resolution,
            last_call_escalated: analytics.escalation,
          },
          timestamp: new Date(),
        },
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });

    // Track event with webhook metadata
    await new Promise((resolve, reject) => {
      this.analytics.track(
        {
          userId: userId,
          event: 'call_completed',
          properties: {
            sentiment: analytics.sentiment,
            resolution: analytics.resolution,
            escalation: analytics.escalation,
            wordCount: analytics.wordCount,
            churnRisk: churnRisk,
            propensityToBuy: propensityToBuy,
            satisfactionScore: satisfactionScore,
            transcriptionSid: transcriptionSid,
            callSid: callSid,
          },
          timestamp: new Date(),
        },
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  /**
   * Static factory method to initialize ProfileUpdater with Segment write key
   * @param {string} writeKey - Segment write key
   * @returns {ProfileUpdater} Initialized ProfileUpdater instance
   */
  static initialize(writeKey) {
    if (!writeKey) {
      throw new Error('Segment write key is required');
    }

    const { Analytics } = require('@segment/analytics-node');
    const analytics = new Analytics({ writeKey: writeKey });

    return new ProfileUpdater(analytics);
  }
}

module.exports = ProfileUpdater;
