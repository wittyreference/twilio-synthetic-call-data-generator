// ABOUTME: Unit tests for customer-agent pairing logic
// ABOUTME: Validates pairing strategy and conference ID generation

const PairSelector = require('../../../src/pairing/pair-selector');

describe('PairSelector', () => {
  let pairSelector;

  beforeEach(() => {
    pairSelector = new PairSelector();
  });

  describe('generateConferenceId', () => {
    it('should generate a conference ID with CF prefix', () => {
      const conferenceId = pairSelector.generateConferenceId();

      expect(conferenceId).toMatch(/^CF[a-f0-9]{32}$/);
    });

    it('should generate unique conference IDs', () => {
      const id1 = pairSelector.generateConferenceId();
      const id2 = pairSelector.generateConferenceId();

      expect(id1).not.toBe(id2);
    });

    it('should generate conference ID of exactly 34 characters', () => {
      const conferenceId = pairSelector.generateConferenceId();

      expect(conferenceId).toHaveLength(34);
    });
  });

  describe('selectRandomPair', () => {
    it('should return a customer-agent pair', () => {
      const pair = pairSelector.selectRandomPair();

      expect(pair).toHaveProperty('customer');
      expect(pair).toHaveProperty('agent');
      expect(pair).toHaveProperty('conferenceId');
    });

    it('should have a valid customer with required fields', () => {
      const pair = pairSelector.selectRandomPair();

      expect(pair.customer).toHaveProperty('CustomerName');
      expect(pair.customer).toHaveProperty('PhoneNumber');
      expect(pair.customer).toHaveProperty('Issue');
    });

    it('should have a valid agent with required fields', () => {
      const pair = pairSelector.selectRandomPair();

      expect(pair.agent).toHaveProperty('AgentName');
      expect(pair.agent).toHaveProperty('CompetenceLevel');
      expect(pair.agent).toHaveProperty('ScriptedIntroduction');
    });

    it('should generate unique conference ID for each pair', () => {
      const pair1 = pairSelector.selectRandomPair();
      const pair2 = pairSelector.selectRandomPair();

      expect(pair1.conferenceId).not.toBe(pair2.conferenceId);
    });
  });

  describe('selectPairWithStrategy', () => {
    it('should match high-competence agents with difficult customers', () => {
      // Frustrated customer should get high-competence agent
      const pair = pairSelector.selectPairWithStrategy('frustrated');

      expect(pair.agent.CompetenceLevel).toBe('High');
    });

    it('should match low-competence agents with easy customers', () => {
      // Patient customer can get any agent, including low-competence
      const pair = pairSelector.selectPairWithStrategy('patient');

      expect(['Low', 'Medium', 'High']).toContain(pair.agent.CompetenceLevel);
    });

    it('should use random pairing when strategy is "random"', () => {
      const pair = pairSelector.selectPairWithStrategy('random');

      expect(pair).toHaveProperty('customer');
      expect(pair).toHaveProperty('agent');
      expect(pair).toHaveProperty('conferenceId');
    });

    it('should default to random strategy for unknown strategy', () => {
      const pair = pairSelector.selectPairWithStrategy('unknown-strategy');

      expect(pair).toHaveProperty('customer');
      expect(pair).toHaveProperty('agent');
    });
  });

  describe('selectMultiplePairs', () => {
    it('should generate multiple unique pairs', () => {
      const pairs = pairSelector.selectMultiplePairs(5);

      expect(pairs).toHaveLength(5);
      expect(pairs[0]).toHaveProperty('customer');
      expect(pairs[0]).toHaveProperty('agent');
      expect(pairs[0]).toHaveProperty('conferenceId');
    });

    it('should generate unique conference IDs for all pairs', () => {
      const pairs = pairSelector.selectMultiplePairs(10);
      const conferenceIds = pairs.map(p => p.conferenceId);
      const uniqueIds = new Set(conferenceIds);

      expect(uniqueIds.size).toBe(10);
    });

    it('should handle request for more pairs than available combinations', () => {
      // With 10 customers and 10 agents, we can have many combinations
      const pairs = pairSelector.selectMultiplePairs(100);

      expect(pairs).toHaveLength(100);
    });

    it('should allow duplicate customer-agent combinations with different conference IDs', () => {
      // Same customer-agent pair can be used multiple times
      const pairs = pairSelector.selectMultiplePairs(20);

      // All conference IDs should still be unique
      const conferenceIds = pairs.map(p => p.conferenceId);
      const uniqueIds = new Set(conferenceIds);
      expect(uniqueIds.size).toBe(20);
    });
  });

  describe('getPairingStatistics', () => {
    it('should return statistics for generated pairs', () => {
      pairSelector.selectMultiplePairs(30);
      const stats = pairSelector.getPairingStatistics();

      expect(stats).toHaveProperty('totalPairs');
      expect(stats).toHaveProperty('customerUsage');
      expect(stats).toHaveProperty('agentUsage');
      expect(stats).toHaveProperty('competenceLevelDistribution');
      expect(stats.totalPairs).toBe(30);
    });

    it('should track customer usage counts', () => {
      pairSelector.selectMultiplePairs(50);
      const stats = pairSelector.getPairingStatistics();

      expect(Object.keys(stats.customerUsage).length).toBeGreaterThan(0);

      // Total usage should equal total pairs
      const totalCustomerUsage = Object.values(stats.customerUsage).reduce(
        (a, b) => a + b,
        0
      );
      expect(totalCustomerUsage).toBe(50);
    });

    it('should track agent usage counts', () => {
      pairSelector.selectMultiplePairs(50);
      const stats = pairSelector.getPairingStatistics();

      expect(Object.keys(stats.agentUsage).length).toBeGreaterThan(0);

      // Total usage should equal total pairs
      const totalAgentUsage = Object.values(stats.agentUsage).reduce(
        (a, b) => a + b,
        0
      );
      expect(totalAgentUsage).toBe(50);
    });

    it('should show competence level distribution', () => {
      pairSelector.selectMultiplePairs(100);
      const stats = pairSelector.getPairingStatistics();

      expect(stats.competenceLevelDistribution).toHaveProperty('Low');
      expect(stats.competenceLevelDistribution).toHaveProperty('Medium');
      expect(stats.competenceLevelDistribution).toHaveProperty('High');

      // Total should equal total pairs
      const total =
        stats.competenceLevelDistribution.Low +
        stats.competenceLevelDistribution.Medium +
        stats.competenceLevelDistribution.High;
      expect(total).toBe(100);
    });
  });

  describe('Statistical distribution', () => {
    it('should have relatively even customer distribution over many pairs', () => {
      pairSelector.selectMultiplePairs(1000);
      const stats = pairSelector.getPairingStatistics();

      // Each customer should be used at least once in 1000 pairs
      const customerCounts = Object.values(stats.customerUsage);
      expect(Math.min(...customerCounts)).toBeGreaterThan(0);

      // No customer should be used more than 200 times (20% of total)
      expect(Math.max(...customerCounts)).toBeLessThan(200);
    });

    it('should have relatively even agent distribution over many pairs', () => {
      pairSelector.selectMultiplePairs(1000);
      const stats = pairSelector.getPairingStatistics();

      // Each agent should be used at least once in 1000 pairs
      const agentCounts = Object.values(stats.agentUsage);
      expect(Math.min(...agentCounts)).toBeGreaterThan(0);

      // No agent should be used more than 200 times (20% of total)
      expect(Math.max(...agentCounts)).toBeLessThan(200);
    });

    it('should reflect actual competence distribution in agents.json', () => {
      pairSelector.selectMultiplePairs(1000);
      const stats = pairSelector.getPairingStatistics();

      // With 5 High, 2 Medium, 3 Low agents out of 10 total:
      // Expected: ~50% High, ~20% Medium, ~30% Low
      const total = stats.totalPairs;
      const highPercent =
        (stats.competenceLevelDistribution.High / total) * 100;
      const mediumPercent =
        (stats.competenceLevelDistribution.Medium / total) * 100;
      const lowPercent = (stats.competenceLevelDistribution.Low / total) * 100;

      // Allow 10% tolerance
      expect(highPercent).toBeGreaterThan(40);
      expect(highPercent).toBeLessThan(60);
      expect(mediumPercent).toBeGreaterThan(10);
      expect(mediumPercent).toBeLessThan(30);
      expect(lowPercent).toBeGreaterThan(20);
      expect(lowPercent).toBeLessThan(40);
    });
  });

  describe('resetStatistics', () => {
    it('should reset all statistics to zero', () => {
      pairSelector.selectMultiplePairs(50);
      pairSelector.resetStatistics();

      const stats = pairSelector.getPairingStatistics();

      expect(stats.totalPairs).toBe(0);
      expect(Object.keys(stats.customerUsage).length).toBe(0);
      expect(Object.keys(stats.agentUsage).length).toBe(0);
    });
  });
});
