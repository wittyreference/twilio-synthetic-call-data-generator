// ABOUTME: Unit tests for persona-loader utility
// ABOUTME: Tests loading customer and agent personas from JSON assets via HTTP

// Mock fetch API
global.fetch = jest.fn();

// Mock context object
const mockContext = {
  DOMAIN_NAME: 'test-domain.twilio.com',
};

// Sample customer data (matching customers.json structure)
const mockCustomersData = {
  CustomerPrompts: [
    {
      CustomerName: 'Lucy Macintosh',
      ContactInformation: 'lucymacncheezy@frobozone.com',
      PhoneNumber: '+15129358764',
      Issue: 'Billing error. Double charged for last month\'s order.',
      DesiredResolution: 'Refund for the additional charge.',
      Demeanor: 'Calm but firm.',
      TechnicalProficiency: 'Medium',
      EscalationTrigger: 'If agent refuses to process refund or claims billing error doesn\'t exist',
      ConversationLengthPreference: 'Moderate - wants thorough explanation but not excessive details',
      Prompt: 'You are Lucy Macintosh, a calm but firm customer, is experiencing a billing error. She has been double charged for her last month\'s order from Howard\'s Duct Tape Warehouse. Their email address is lucymacncheezy@frobozone.com and their phone number is +15129358764. Their desired resolution is a refund for the additional charge. Keep the conversation focused and aim to resolve the issue within 5 minutes or less.',
    },
    {
      CustomerName: 'John Doe',
      ContactInformation: 'johndoe@example.com',
      PhoneNumber: '+15551234567',
      Issue: 'General inquiry',
      DesiredResolution: 'Information',
      Demeanor: 'Polite',
      TechnicalProficiency: 'High',
      EscalationTrigger: 'None',
      ConversationLengthPreference: 'Short',
      Prompt: 'You are John Doe making a general inquiry.',
    },
  ],
};

// Sample agent data (matching agents.json structure)
const mockAgentsData = {
  AgentPrompts: [
    {
      AgentName: 'Sarah',
      ScriptedIntroduction: 'Thank you for calling Howard\'s Duct Tape Warehouse, we\'ve got all the tape for your ducts. My name is Sarah. How can I help you today?',
      ResponseToIssue: 'Empathetic and eager to help.',
      CompetenceLevel: 'High',
      Attitude: 'Positive and helpful.',
      ProductKnowledge: 'Expert in all areas - billing, shipping, technical specifications, returns, and bulk orders',
      Farewell: 'I\'m glad I could help. Thank you for shopping at Howard\'s Duct Tape Warehouse!',
      Characteristics: 'Sarah is a highly competent and enthusiastic customer service agent at Howard\'s Duct Tape Warehouse.',
    },
    {
      AgentName: 'Mark',
      ScriptedIntroduction: 'Thank you for calling Howard\'s Duct Tape Warehouse, we\'ve got all the tape for your ducts. My name is Mark. How can I assist you?',
      ResponseToIssue: 'Indifferent.',
      CompetenceLevel: 'Medium',
      Attitude: 'Nonchalant.',
      ProductKnowledge: 'Good with basic shipping and returns, limited billing knowledge, weak on technical specs',
      Farewell: 'Okay, this has been resolved. Bye.',
      Characteristics: 'Mark is an agent with a more indifferent demeanor.',
    },
  ],
};

// Require the module AFTER setting up mocks
const { loadPersona, clearCache } = require('../../../../functions/utils/persona-loader');

describe('Persona Loader', () => {
  beforeEach(() => {
    // Reset fetch mock before each test
    fetch.mockClear();

    // Clear the persona cache before each test
    clearCache();
  });

  describe('loadPersona', () => {
    describe('Customer persona loading', () => {
      it('should load a customer persona by name', async () => {
        // Mock successful fetch
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockCustomersData,
        });

        const persona = await loadPersona('customer', 'Lucy Macintosh', mockContext);

        expect(persona).toBeDefined();
        expect(persona.name).toBe('Lucy Macintosh');
        expect(persona.role).toBe('customer');
        expect(persona.systemPrompt).toBeDefined();
        expect(persona.introduction).toBe(''); // Customers don't have introductions
        expect(persona.rawData).toBeDefined();
        expect(fetch).toHaveBeenCalledWith('https://test-domain.twilio.com/customers.json');
      });

      it('should build system prompt from customer data', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockCustomersData,
        });

        const persona = await loadPersona('customer', 'Lucy Macintosh', mockContext);

        // System prompt should be the customer's Prompt field
        expect(typeof persona.systemPrompt).toBe('string');
        expect(persona.systemPrompt.length).toBeGreaterThan(0);
        expect(persona.systemPrompt).toContain('Lucy Macintosh');
      });

      it('should handle customer personas from CustomerPrompts wrapper', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockCustomersData,
        });

        const persona = await loadPersona('customer', 'John Doe', mockContext);

        expect(persona).toBeDefined();
        expect(persona.name).toBe('John Doe');
      });

      it('should return null for non-existent customer', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockCustomersData,
        });

        const persona = await loadPersona('customer', 'Nonexistent Customer', mockContext);

        expect(persona).toBeNull();
      });
    });

    describe('Agent persona loading', () => {
      it('should load an agent persona by name', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockAgentsData,
        });

        const persona = await loadPersona('agent', 'Sarah', mockContext);

        expect(persona).toBeDefined();
        expect(persona.name).toBe('Sarah');
        expect(persona.role).toBe('agent');
        expect(persona.systemPrompt).toBeDefined();
        expect(persona.introduction).toBeDefined();
        expect(persona.rawData).toBeDefined();
        expect(fetch).toHaveBeenCalledWith('https://test-domain.twilio.com/agents.json');
      });

      it('should build system prompt from agent characteristics', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockAgentsData,
        });

        const persona = await loadPersona('agent', 'Sarah', mockContext);

        // System prompt should include agent data (actual values, not field names)
        expect(persona.systemPrompt).toContain('Characteristics:');
        expect(persona.systemPrompt).toContain('Response:');
        expect(persona.systemPrompt).toContain('Competence:');
        expect(persona.systemPrompt).toContain('Attitude:');
      });

      it('should extract introduction from agent data', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockAgentsData,
        });

        const persona = await loadPersona('agent', 'Sarah', mockContext);

        expect(persona.introduction).toBe(
          'Thank you for calling Howard\'s Duct Tape Warehouse, we\'ve got all the tape for your ducts. My name is Sarah. How can I help you today?'
        );
      });

      it('should handle agent personas from AgentPrompts wrapper', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockAgentsData,
        });

        const persona = await loadPersona('agent', 'Mark', mockContext);

        expect(persona).toBeDefined();
        expect(persona.name).toBe('Mark');
      });

      it('should return null for non-existent agent', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockAgentsData,
        });

        const persona = await loadPersona('agent', 'Nonexistent Agent', mockContext);

        expect(persona).toBeNull();
      });
    });

    describe('Error handling', () => {
      it('should handle missing JSON files gracefully', async () => {
        fetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        });

        const persona = await loadPersona('customer', 'Lucy Macintosh', mockContext);

        expect(persona).toBeNull();
      });

      it('should handle invalid role parameter', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockCustomersData,
        });

        const persona = await loadPersona('invalid-role', 'Test', mockContext);

        expect(persona).toBeDefined(); // Still works, just loads customers.json
      });

      it('should handle empty persona name', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockCustomersData,
        });

        const persona = await loadPersona('customer', '', mockContext);

        expect(persona).toBeNull();
      });

      it('should handle null persona name', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockCustomersData,
        });

        const persona = await loadPersona('customer', null, mockContext);

        expect(persona).toBeNull();
      });

      it('should handle undefined persona name', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockCustomersData,
        });

        const persona = await loadPersona('customer', undefined, mockContext);

        expect(persona).toBeNull();
      });
    });

    describe('Data structure handling', () => {
      it('should handle CustomerPrompts wrapper object', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockCustomersData,
        });

        const persona = await loadPersona('customer', 'Lucy Macintosh', mockContext);

        expect(persona).toBeDefined();
        expect(persona.rawData.CustomerName).toBe('Lucy Macintosh');
      });

      it('should handle AgentPrompts wrapper object', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockAgentsData,
        });

        const persona = await loadPersona('agent', 'Sarah', mockContext);

        expect(persona).toBeDefined();
        expect(persona.rawData.AgentName).toBe('Sarah');
      });

      it('should find persona by correct name field (CustomerName)', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockCustomersData,
        });

        const persona = await loadPersona('customer', 'Lucy Macintosh', mockContext);

        expect(persona).toBeDefined();
        expect(persona.rawData.CustomerName).toBe('Lucy Macintosh');
      });

      it('should find persona by correct name field (AgentName)', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockAgentsData,
        });

        const persona = await loadPersona('agent', 'Sarah', mockContext);

        expect(persona).toBeDefined();
        expect(persona.rawData.AgentName).toBe('Sarah');
      });
    });

    describe('System prompt structure', () => {
      it('should create proper OpenAI system prompt for agent', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockAgentsData,
        });

        const persona = await loadPersona('agent', 'Sarah', mockContext);

        // Check system prompt structure
        expect(persona.systemPrompt).toContain('Thank you for calling');
        expect(persona.systemPrompt).toContain('Characteristics:');
        expect(persona.systemPrompt).toContain('- Response:');
        expect(persona.systemPrompt).toContain('- Competence:');
        expect(persona.systemPrompt).toContain('- Attitude:');
        expect(persona.systemPrompt).toContain('- Product knowledge:');
      });

      it('should use customer Prompt field for system prompt', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockCustomersData,
        });

        const persona = await loadPersona('customer', 'Lucy Macintosh', mockContext);

        // Customer system prompt is just the Prompt field
        expect(persona.systemPrompt).toBe(mockCustomersData.CustomerPrompts[0].Prompt);
      });

      it('should include all agent characteristics in prompt', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockAgentsData,
        });

        const persona = await loadPersona('agent', 'Sarah', mockContext);

        const expectedValues = [
          'Empathetic and eager to help',
          'High',
          'Positive and helpful',
          'Expert in all areas',
        ];

        expectedValues.forEach(value => {
          expect(persona.systemPrompt).toContain(value);
        });
      });
    });

    describe('Return value structure', () => {
      it('should return object with required fields', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockCustomersData,
        });

        const persona = await loadPersona('customer', 'Lucy Macintosh', mockContext);

        expect(persona).toHaveProperty('name');
        expect(persona).toHaveProperty('role');
        expect(persona).toHaveProperty('systemPrompt');
        expect(persona).toHaveProperty('introduction');
        expect(persona).toHaveProperty('rawData');
      });

      it('should have string name', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockCustomersData,
        });

        const persona = await loadPersona('customer', 'Lucy Macintosh', mockContext);

        expect(typeof persona.name).toBe('string');
      });

      it('should have string role', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockAgentsData,
        });

        const persona = await loadPersona('agent', 'Sarah', mockContext);

        expect(typeof persona.role).toBe('string');
      });

      it('should have string systemPrompt', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockCustomersData,
        });

        const persona = await loadPersona('customer', 'Lucy Macintosh', mockContext);

        expect(typeof persona.systemPrompt).toBe('string');
      });

      it('should have string introduction for agents', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockAgentsData,
        });

        const persona = await loadPersona('agent', 'Sarah', mockContext);

        expect(typeof persona.introduction).toBe('string');
        expect(persona.introduction.length).toBeGreaterThan(0);
      });

      it('should have empty introduction for customers', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockCustomersData,
        });

        const persona = await loadPersona('customer', 'Lucy Macintosh', mockContext);

        expect(persona.introduction).toBe('');
      });

      it('should have rawData object', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockAgentsData,
        });

        const persona = await loadPersona('agent', 'Sarah', mockContext);

        expect(typeof persona.rawData).toBe('object');
        expect(persona.rawData).not.toBeNull();
      });
    });
  });
});
