// ABOUTME: Unit tests for agent persona data loader
// ABOUTME: Validates loading, parsing, and validation of agent persona data

const path = require('path');

// Mock fs with manual mock factory
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  existsSync: jest.fn(),
}));

const fs = require('fs');
const AgentLoader = require('../../../src/personas/agent-loader');

describe('AgentLoader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loadAgents', () => {
    it('should load agents from agents.json file', () => {
      const mockAgentData = {
        AgentPrompts: [
          {
            AgentName: 'Test Agent',
            ScriptedIntroduction: 'Hello, I am Test Agent',
            ResponseToIssue: 'Empathetic and helpful',
            CompetenceLevel: 'High',
            Attitude: 'Positive',
            ProductKnowledge: 'Expert in all areas',
            Farewell: 'Thank you for calling',
            Characteristics: 'Test characteristics',
          },
        ],
      };

      fs.readFileSync.mockReturnValueOnce(JSON.stringify(mockAgentData));

      const agents = AgentLoader.loadAgents();

      expect(agents).toHaveLength(1);
      expect(agents[0].AgentName).toBe('Test Agent');
    });

    it('should throw error if agents.json does not exist', () => {
      fs.readFileSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      expect(() => {
        AgentLoader.loadAgents();
      }).toThrow('ENOENT: no such file or directory');
    });

    it('should throw error if agents.json is invalid JSON', () => {
      fs.readFileSync.mockReturnValue('invalid json {]');

      expect(() => {
        AgentLoader.loadAgents();
      }).toThrow();
    });

    it('should load agents from custom file path', () => {
      const mockData = { AgentPrompts: [] };
      fs.readFileSync.mockReturnValue(JSON.stringify(mockData));

      const agents = AgentLoader.loadAgents('/custom/path/agents.json');

      expect(fs.readFileSync).toHaveBeenCalledWith(
        '/custom/path/agents.json',
        'utf8'
      );
    });
  });

  describe('validateAgent', () => {
    it('should validate agent with all required fields', () => {
      const validAgent = {
        AgentName: 'Test Agent',
        ScriptedIntroduction: 'Hello',
        ResponseToIssue: 'Helpful',
        CompetenceLevel: 'High',
        Attitude: 'Positive',
        ProductKnowledge: 'Expert',
        Farewell: 'Goodbye',
        Characteristics: 'Test',
      };

      expect(() => {
        AgentLoader.validateAgent(validAgent);
      }).not.toThrow();
    });

    it('should throw error for missing AgentName', () => {
      const invalidAgent = {
        ScriptedIntroduction: 'Hello',
        ResponseToIssue: 'Helpful',
      };

      expect(() => {
        AgentLoader.validateAgent(invalidAgent);
      }).toThrow('AgentName is required');
    });

    it('should throw error for missing ScriptedIntroduction', () => {
      const invalidAgent = {
        AgentName: 'Test',
        ResponseToIssue: 'Helpful',
      };

      expect(() => {
        AgentLoader.validateAgent(invalidAgent);
      }).toThrow('ScriptedIntroduction is required');
    });

    it('should throw error for invalid CompetenceLevel', () => {
      const invalidAgent = {
        AgentName: 'Test',
        ScriptedIntroduction: 'Hello',
        ResponseToIssue: 'Helpful',
        CompetenceLevel: 'Expert', // Should be Low, Medium, or High
        Attitude: 'Positive',
        ProductKnowledge: 'Good',
        Farewell: 'Goodbye',
        Characteristics: 'Test',
      };

      expect(() => {
        AgentLoader.validateAgent(invalidAgent);
      }).toThrow('CompetenceLevel must be Low, Medium, or High');
    });

    it('should accept valid CompetenceLevel values', () => {
      const validLevels = ['Low', 'Medium', 'High'];

      validLevels.forEach(level => {
        const agent = {
          AgentName: 'Test',
          ScriptedIntroduction: 'Hello',
          ResponseToIssue: 'Helpful',
          CompetenceLevel: level,
          Attitude: 'Positive',
          ProductKnowledge: 'Expert',
          Farewell: 'Goodbye',
          Characteristics: 'Test',
        };

        expect(() => {
          AgentLoader.validateAgent(agent);
        }).not.toThrow();
      });
    });

    it('should throw error for empty required strings', () => {
      const invalidAgent = {
        AgentName: '',
        ScriptedIntroduction: 'Hello',
        ResponseToIssue: 'Helpful',
      };

      expect(() => {
        AgentLoader.validateAgent(invalidAgent);
      }).toThrow('AgentName cannot be empty');
    });
  });

  describe('getAgentByName', () => {
    beforeEach(() => {
      const mockData = {
        AgentPrompts: [
          {
            AgentName: 'Sarah',
            ScriptedIntroduction: 'Hello, I am Sarah',
            ResponseToIssue: 'Empathetic',
            CompetenceLevel: 'High',
            Attitude: 'Positive',
            ProductKnowledge: 'Expert',
            Farewell: 'Thank you',
            Characteristics: 'Test',
          },
          {
            AgentName: 'Mark',
            ScriptedIntroduction: 'Hello, I am Mark',
            ResponseToIssue: 'Indifferent',
            CompetenceLevel: 'Medium',
            Attitude: 'Nonchalant',
            ProductKnowledge: 'Good',
            Farewell: 'Bye',
            Characteristics: 'Test',
          },
        ],
      };
      fs.readFileSync.mockReturnValue(JSON.stringify(mockData));
      AgentLoader.loadAgents();
    });

    it('should find agent by exact name', () => {
      const agent = AgentLoader.getAgentByName('Sarah');

      expect(agent).toBeDefined();
      expect(agent.AgentName).toBe('Sarah');
      expect(agent.CompetenceLevel).toBe('High');
    });

    it('should return null for non-existent agent', () => {
      const agent = AgentLoader.getAgentByName('NonExistent Person');

      expect(agent).toBeNull();
    });

    it('should be case-sensitive', () => {
      const agent = AgentLoader.getAgentByName('sarah');

      expect(agent).toBeNull();
    });
  });

  describe('getAllAgents', () => {
    it('should return all loaded agents', () => {
      const mockData = {
        AgentPrompts: [
          {
            AgentName: 'Agent 1',
            ScriptedIntroduction: 'Hello',
            ResponseToIssue: 'Helpful',
            CompetenceLevel: 'Low',
            Attitude: 'Positive',
            ProductKnowledge: 'Basic',
            Farewell: 'Bye',
            Characteristics: 'Test',
          },
          {
            AgentName: 'Agent 2',
            ScriptedIntroduction: 'Hi',
            ResponseToIssue: 'Quick',
            CompetenceLevel: 'High',
            Attitude: 'Professional',
            ProductKnowledge: 'Expert',
            Farewell: 'Goodbye',
            Characteristics: 'Test',
          },
        ],
      };
      fs.readFileSync.mockReturnValue(JSON.stringify(mockData));
      AgentLoader.loadAgents();

      const agents = AgentLoader.getAllAgents();

      expect(agents).toHaveLength(2);
      expect(agents[0].AgentName).toBe('Agent 1');
      expect(agents[1].AgentName).toBe('Agent 2');
    });
  });

  describe('getRandomAgent', () => {
    beforeEach(() => {
      const mockData = {
        AgentPrompts: [
          {
            AgentName: 'Agent 1',
            ScriptedIntroduction: 'Hello',
            ResponseToIssue: 'Helpful',
            CompetenceLevel: 'Low',
            Attitude: 'Positive',
            ProductKnowledge: 'Basic',
            Farewell: 'Bye',
            Characteristics: 'Test',
          },
          {
            AgentName: 'Agent 2',
            ScriptedIntroduction: 'Hi',
            ResponseToIssue: 'Quick',
            CompetenceLevel: 'High',
            Attitude: 'Professional',
            ProductKnowledge: 'Expert',
            Farewell: 'Goodbye',
            Characteristics: 'Test',
          },
        ],
      };
      fs.readFileSync.mockReturnValue(JSON.stringify(mockData));
      AgentLoader.loadAgents();
    });

    it('should return a random agent', () => {
      const agent = AgentLoader.getRandomAgent();

      expect(agent).toBeDefined();
      expect(['Agent 1', 'Agent 2']).toContain(agent.AgentName);
    });

    it('should return different agents over multiple calls', () => {
      const agents = new Set();

      // Call 100 times to ensure we get some variety
      for (let i = 0; i < 100; i++) {
        agents.add(AgentLoader.getRandomAgent().AgentName);
      }

      // With 100 calls and 2 agents, we should get both
      expect(agents.size).toBeGreaterThan(1);
    });
  });

  describe('getAgentsByCompetence', () => {
    beforeEach(() => {
      const mockData = {
        AgentPrompts: [
          {
            AgentName: 'Agent 1',
            ScriptedIntroduction: 'Hello',
            ResponseToIssue: 'Helpful',
            CompetenceLevel: 'High',
            Attitude: 'Positive',
            ProductKnowledge: 'Expert',
            Farewell: 'Bye',
            Characteristics: 'Test',
          },
          {
            AgentName: 'Agent 2',
            ScriptedIntroduction: 'Hi',
            ResponseToIssue: 'Quick',
            CompetenceLevel: 'Low',
            Attitude: 'Bored',
            ProductKnowledge: 'Basic',
            Farewell: 'Goodbye',
            Characteristics: 'Test',
          },
          {
            AgentName: 'Agent 3',
            ScriptedIntroduction: 'Hey',
            ResponseToIssue: 'Okay',
            CompetenceLevel: 'High',
            Attitude: 'Professional',
            ProductKnowledge: 'Expert',
            Farewell: 'Thanks',
            Characteristics: 'Test',
          },
        ],
      };
      fs.readFileSync.mockReturnValue(JSON.stringify(mockData));
      AgentLoader.loadAgents();
    });

    it('should return agents by competence level', () => {
      const highAgents = AgentLoader.getAgentsByCompetence('High');

      expect(highAgents).toHaveLength(2);
      expect(highAgents.every(a => a.CompetenceLevel === 'High')).toBe(true);
    });

    it('should return empty array for non-existent competence level', () => {
      const agents = AgentLoader.getAgentsByCompetence('Expert');

      expect(agents).toHaveLength(0);
    });
  });

  describe('validateAllAgents', () => {
    it('should validate all agents successfully', () => {
      const mockData = {
        AgentPrompts: [
          {
            AgentName: 'Valid Agent 1',
            ScriptedIntroduction: 'Hello',
            ResponseToIssue: 'Helpful',
            CompetenceLevel: 'Low',
            Attitude: 'Positive',
            ProductKnowledge: 'Basic',
            Farewell: 'Bye',
            Characteristics: 'Test',
          },
          {
            AgentName: 'Valid Agent 2',
            ScriptedIntroduction: 'Hi',
            ResponseToIssue: 'Quick',
            CompetenceLevel: 'High',
            Attitude: 'Professional',
            ProductKnowledge: 'Expert',
            Farewell: 'Goodbye',
            Characteristics: 'Test',
          },
        ],
      };
      fs.readFileSync.mockReturnValue(JSON.stringify(mockData));
      AgentLoader.loadAgents();

      const result = AgentLoader.validateAllAgents();

      expect(result.valid).toBe(true);
      expect(result.validCount).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should report validation errors for invalid agents', () => {
      const mockData = {
        AgentPrompts: [
          {
            AgentName: 'Valid Agent',
            ScriptedIntroduction: 'Hello',
            ResponseToIssue: 'Helpful',
            CompetenceLevel: 'Low',
            Attitude: 'Positive',
            ProductKnowledge: 'Basic',
            Farewell: 'Bye',
            Characteristics: 'Test',
          },
          {
            AgentName: 'Invalid Agent',
            ScriptedIntroduction: '',
            CompetenceLevel: 'Expert',
          },
        ],
      };
      fs.readFileSync.mockReturnValue(JSON.stringify(mockData));
      AgentLoader.loadAgents();

      const result = AgentLoader.validateAllAgents();

      expect(result.valid).toBe(false);
      expect(result.validCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Invalid Agent');
    });
  });
});
