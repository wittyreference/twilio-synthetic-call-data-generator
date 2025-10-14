// ABOUTME: Creates Segment CDP profiles from customer personas
// ABOUTME: Handles batch profile creation with initial trait values and deterministic user IDs

const crypto = require('crypto');

/**
 * Generates a deterministic user ID from phone number
 * @param {string} phoneNumber - E.164 formatted phone number
 * @returns {string} User ID with cust_ prefix
 */
function generateUserId(phoneNumber) {
  const hash = crypto.createHash('md5').update(phoneNumber).digest('hex');
  return `cust_${hash}`;
}

/**
 * Converts string to snake_case
 * @param {string} str - String to convert
 * @returns {string} Snake-cased string
 */
function toSnakeCase(str) {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

/**
 * Maps customer data to Segment traits
 * @param {Object} customer - Customer persona object
 * @returns {Object} Segment traits object
 */
function mapCustomerToTraits(customer) {
  return {
    name: customer.CustomerName,
    email: customer.ContactInformation,
    phone: customer.PhoneNumber,
    current_issue: customer.Issue,
    desired_resolution: customer.DesiredResolution,
    demeanor: customer.Demeanor,
    technical_proficiency: customer.TechnicalProficiency,
    escalation_trigger: customer.EscalationTrigger,
    conversation_preference: customer.ConversationLengthPreference,
    // Initial metric values
    total_calls: 0,
    churn_risk: 0,
    propensity_to_buy: 0,
    satisfaction_score: 0,
  };
}

class ProfileCreator {
  constructor(analytics) {
    this.analytics = analytics;
  }

  /**
   * Creates a Segment profile for a single customer
   * @param {Object} customer - Customer persona object
   * @returns {Promise<void>}
   */
  async createProfile(customer) {
    // Validate required fields
    if (!customer.CustomerName) {
      throw new Error('CustomerName is required');
    }
    if (!customer.ContactInformation) {
      throw new Error('ContactInformation is required');
    }
    if (!customer.PhoneNumber) {
      throw new Error('PhoneNumber is required');
    }

    // Generate deterministic user ID from phone number
    const userId = generateUserId(customer.PhoneNumber);

    // Map customer data to Segment traits
    const traits = mapCustomerToTraits(customer);

    // Send identify call to Segment
    return new Promise((resolve, reject) => {
      this.analytics.identify(
        {
          userId: userId,
          traits: traits,
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
   * Creates Segment profiles for multiple customers in batch
   * @param {Array<Object>} customers - Array of customer persona objects
   * @returns {Promise<Object>} Summary of batch operation
   */
  async createBatchProfiles(customers) {
    let profilesCreated = 0;
    const errors = [];

    for (const customer of customers) {
      try {
        await this.createProfile(customer);
        profilesCreated++;
      } catch (error) {
        errors.push(`Failed to create profile for ${customer.CustomerName}: ${error.message}`);
      }
    }

    // Flush all events to Segment
    try {
      await new Promise((resolve, reject) => {
        this.analytics.flush((err) => {
          if (err) {
            console.warn('Warning: Failed to flush analytics:', err.message);
            resolve(); // Don't fail the whole operation
          } else {
            resolve();
          }
        });
      });
    } catch (flushError) {
      console.warn('Warning: Flush error:', flushError.message);
    }

    return {
      success: errors.length === 0,
      profilesCreated: profilesCreated,
      errors: errors,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Static factory method to initialize ProfileCreator with Segment write key
   * @param {string} writeKey - Segment write key
   * @returns {ProfileCreator} Initialized ProfileCreator instance
   */
  static initialize(writeKey) {
    if (!writeKey) {
      throw new Error('Segment write key is required');
    }

    const { Analytics } = require('@segment/analytics-node');
    const analytics = new Analytics({ writeKey: writeKey });

    return new ProfileCreator(analytics);
  }
}

module.exports = ProfileCreator;
