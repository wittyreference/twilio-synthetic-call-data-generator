// ABOUTME: Integration test validating local code execution works without errors
// ABOUTME: This test catches runtime failures that mocked unit tests miss

const { execSync } = require('child_process');
const path = require('path');

describe('Local Code Execution Integration Tests', () => {
  // These tests cost ~$0.07 per run (1 OpenAI call per test)
  // But they catch runtime failures that 634 mocked unit tests missed

  const timeout = 120000; // 2 minutes for real Twilio API calls

  describe('Serverless Function - Conference Creation', () => {
    it('should execute without errors and create a conference via serverless endpoint', async () => {
      // Test the NEW serverless function approach
      // This validates the production API endpoint works correctly

      const domain = process.env.SERVERLESS_DOMAIN;

      // Skip if no serverless domain configured
      if (!domain) {
        console.log('⚠️  Skipping: SERVERLESS_DOMAIN not set');
        return;
      }

      let output;
      try {
        output = execSync(`curl -s -X POST "https://${domain}/create-conference" -H "Content-Type: application/json" -d '{}'`, {
          encoding: 'utf8',
          cwd: path.join(__dirname, '..', '..'),
          env: process.env,
          timeout: timeout
        });
      } catch (error) {
        throw new Error(`Command failed with error:\n${error.message}`);
      }

      // Parse JSON response
      const response = JSON.parse(output);

      // Validate success response structure
      expect(response).toHaveProperty('success', true);
      expect(response).toHaveProperty('conferenceId');
      expect(response).toHaveProperty('customer');
      expect(response).toHaveProperty('agent');
      expect(response.customer).toHaveProperty('callSid');
      expect(response.agent).toHaveProperty('callSid');

      // Validate Call SID formats
      expect(response.customer.callSid).toMatch(/^CA[a-f0-9]{32}$/);
      expect(response.agent.callSid).toMatch(/^CA[a-f0-9]{32}$/);

      // Validate conference ID format
      expect(response.conferenceId).toMatch(/^synth-call-\d+-[a-z0-9]+$/);

      // Validate timer metadata
      expect(response).toHaveProperty('timer');
      expect(response.timer.scheduled).toBe(false);
    }, timeout);

    it('should load customer personas from assets directory', async () => {
      // This test validates that asset paths are correct
      // Would have caught the assets/customers.json vs /customers.json issue

      let output;
      try {
        output = execSync('node -e "const {loadCustomers} = require(\'./src/personas/customer-loader\'); const customers = loadCustomers(); console.log(JSON.stringify({count: customers.length, firstCustomer: customers[0].CustomerName}));"', {
          encoding: 'utf8',
          cwd: path.join(__dirname, '..', '..'),
          env: process.env
        });
      } catch (error) {
        throw new Error(`Failed to load customers: ${error.message}`);
      }

      const result = JSON.parse(output.trim());
      expect(result.count).toBeGreaterThan(0);
      expect(result.firstCustomer).toBeDefined();
    });

    it('should load agent personas from assets directory', async () => {
      // This test validates that agents.json is properly loaded
      // Would have caught the missing agents.json issue

      let output;
      try {
        output = execSync('node -e "const {loadAgents} = require(\'./src/personas/agent-loader\'); const agents = loadAgents(); console.log(JSON.stringify({count: agents.length, firstAgent: agents[0].AgentName}));"', {
          encoding: 'utf8',
          cwd: path.join(__dirname, '..', '..'),
          env: process.env
        });
      } catch (error) {
        throw new Error(`Failed to load agents: ${error.message}`);
      }

      const result = JSON.parse(output.trim());
      expect(result.count).toBeGreaterThan(0);
      expect(result.firstAgent).toBeDefined();
    });
  });

  describe('Environment Validation', () => {
    it('should have all required environment variables set', () => {
      // This test validates that .env.example matches actual requirements

      const requiredVars = [
        'TWILIO_ACCOUNT_SID',
        'TWILIO_AUTH_TOKEN',
        'OPENAI_API_KEY',
        'TWIML_APP_SID',
        'AGENT_PHONE_NUMBER',
        'SERVERLESS_DOMAIN'
      ];

      // Optional vars that are checked but not required
      const optionalVars = [
        'SYNC_SERVICE_SID',  // Falls back to TWILIO_SYNC_SERVICE_SID
        'SEGMENT_WRITE_KEY'   // Optional for analytics
      ];

      const missingVars = requiredVars.filter(varName => !process.env[varName]);

      if (missingVars.length > 0) {
        console.log('Missing required environment variables:', missingVars);
      }

      expect(missingVars).toHaveLength(0);
    });

    it('should have valid Twilio credentials format', () => {
      // Validate credential formats without making API calls
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;

      // Skip if using placeholder values from .env.example
      if (accountSid && !accountSid.includes('xxx') && !accountSid.includes('test_')) {
        expect(accountSid).toMatch(/^AC[a-f0-9]{32}$/);
      }

      // Auth tokens should be at least 32 chars (can be longer for test tokens)
      if (authToken && !authToken.includes('your_') && !authToken.includes('test_')) {
        expect(authToken.length).toBeGreaterThanOrEqual(32);
      }
    });

    it('should have valid OpenAI API key format', () => {
      const apiKey = process.env.OPENAI_API_KEY;

      // Skip if using placeholder values
      if (apiKey && !apiKey.includes('xxx')) {
        expect(apiKey).toMatch(/^sk-[A-Za-z0-9\-_]+$/);
      }
    });

    it('should have valid Sync Service SID format', () => {
      const syncSid = process.env.SYNC_SERVICE_SID;

      // Skip if using placeholder values
      if (syncSid && !syncSid.includes('xxx')) {
        expect(syncSid).toMatch(/^IS[a-f0-9]{32}$/);
      }
    });
  });

  describe('Asset Availability', () => {
    it('should have customers.json in assets directory', () => {
      const fs = require('fs');
      const customersPath = path.join(__dirname, '..', '..', 'assets', 'customers.json');

      expect(fs.existsSync(customersPath)).toBe(true);

      const customersData = JSON.parse(fs.readFileSync(customersPath, 'utf8'));
      expect(Array.isArray(customersData.CustomerPrompts)).toBe(true);
      expect(customersData.CustomerPrompts.length).toBeGreaterThan(0);
    });

    it('should have agents.json in assets directory', () => {
      const fs = require('fs');
      const agentsPath = path.join(__dirname, '..', '..', 'assets', 'agents.json');

      expect(fs.existsSync(agentsPath)).toBe(true);

      const agentsData = JSON.parse(fs.readFileSync(agentsPath, 'utf8'));
      expect(Array.isArray(agentsData.AgentPrompts)).toBe(true);
      expect(agentsData.AgentPrompts.length).toBeGreaterThan(0);
    });

    it('should have valid phone numbers in customer personas', () => {
      const fs = require('fs');
      const customersPath = path.join(__dirname, '..', '..', 'assets', 'customers.json');
      const customersData = JSON.parse(fs.readFileSync(customersPath, 'utf8'));

      customersData.CustomerPrompts.forEach(customer => {
        expect(customer.PhoneNumber).toMatch(/^\+1\d{10}$/);
      });
    });
  });
});
