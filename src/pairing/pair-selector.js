// ABOUTME: Customer-agent pairing logic module
// ABOUTME: Handles pairing strategy, conference ID generation, and statistics tracking

const { loadCustomers, getAllCustomers, getRandomCustomer } = require('../personas/customer-loader');
const { loadAgents, getAllAgents, getRandomAgent, getAgentsByCompetence } = require('../personas/agent-loader');
const crypto = require('crypto');

class PairSelector {
  constructor() {
    // Load customers and agents
    try {
      loadCustomers();
      loadAgents();
    } catch (error) {
      // If files don't exist, arrays will be empty
      // This allows for testing with mocked data
    }

    // Statistics tracking
    this.statistics = {
      totalPairs: 0,
      customerUsage: {},
      agentUsage: {},
      competenceLevelDistribution: {
        Low: 0,
        Medium: 0,
        High: 0
      }
    };
  }

  /**
   * Generates a unique conference ID with CF prefix
   * Format: CF + 32 hex characters (like Twilio conference SIDs)
   */
  generateConferenceId() {
    const randomBytes = crypto.randomBytes(16);
    const hexString = randomBytes.toString('hex');
    return `CF${hexString}`;
  }

  /**
   * Selects a random customer-agent pair
   */
  selectRandomPair() {
    const customer = getRandomCustomer();
    const agent = getRandomAgent();
    const conferenceId = this.generateConferenceId();

    // Track statistics
    this._updateStatistics(customer, agent);

    return {
      customer,
      agent,
      conferenceId,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Selects a pair using a specific strategy
   * @param {string} strategy - Pairing strategy: 'random', 'frustrated', 'patient', etc.
   */
  selectPairWithStrategy(strategy) {
    const customer = getRandomCustomer();
    let agent;

    switch (strategy) {
      case 'frustrated':
        // Match difficult customers with high-competence agents
        const highAgents = getAgentsByCompetence('High');
        agent = highAgents[Math.floor(Math.random() * highAgents.length)];
        break;

      case 'patient':
        // Patient customers can work with any agent
        agent = getRandomAgent();
        break;

      case 'random':
      default:
        // Random pairing
        agent = getRandomAgent();
        break;
    }

    const conferenceId = this.generateConferenceId();

    // Track statistics
    this._updateStatistics(customer, agent);

    return {
      customer,
      agent,
      conferenceId,
      strategy,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generates multiple customer-agent pairs
   * @param {number} count - Number of pairs to generate
   * @param {string} strategy - Optional pairing strategy
   */
  selectMultiplePairs(count, strategy = 'random') {
    const pairs = [];

    for (let i = 0; i < count; i++) {
      const pair = strategy === 'random'
        ? this.selectRandomPair()
        : this.selectPairWithStrategy(strategy);
      pairs.push(pair);
    }

    return pairs;
  }

  /**
   * Updates statistics for a pairing
   * @private
   */
  _updateStatistics(customer, agent) {
    this.statistics.totalPairs++;

    // Track customer usage
    const customerName = customer.CustomerName;
    this.statistics.customerUsage[customerName] =
      (this.statistics.customerUsage[customerName] || 0) + 1;

    // Track agent usage
    const agentName = agent.AgentName;
    this.statistics.agentUsage[agentName] =
      (this.statistics.agentUsage[agentName] || 0) + 1;

    // Track competence level distribution
    const competence = agent.CompetenceLevel;
    this.statistics.competenceLevelDistribution[competence]++;
  }

  /**
   * Gets current pairing statistics
   */
  getPairingStatistics() {
    return {
      totalPairs: this.statistics.totalPairs,
      customerUsage: { ...this.statistics.customerUsage },
      agentUsage: { ...this.statistics.agentUsage },
      competenceLevelDistribution: { ...this.statistics.competenceLevelDistribution }
    };
  }

  /**
   * Resets all statistics
   */
  resetStatistics() {
    this.statistics = {
      totalPairs: 0,
      customerUsage: {},
      agentUsage: {},
      competenceLevelDistribution: {
        Low: 0,
        Medium: 0,
        High: 0
      }
    };
  }
}

module.exports = PairSelector;
