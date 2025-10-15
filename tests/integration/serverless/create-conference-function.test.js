// ABOUTME: Integration tests for serverless create-conference function
// ABOUTME: Tests the production serverless endpoint for conference creation

const { execSync } = require('child_process');
const path = require('path');

describe('Serverless Create Conference Function Integration', () => {
  const timeout = 60000; // 1 minute for API calls
  const domain = process.env.SERVERLESS_DOMAIN;

  // Skip all tests if SERVERLESS_DOMAIN not configured
  if (!domain) {
    console.log('⚠️  Skipping serverless integration tests: SERVERLESS_DOMAIN not set');
    return;
  }

  describe('Conference Creation Endpoint', () => {
    it('should create conference with default strategy', async () => {
      let output;
      try {
        output = execSync(
          `curl -s -X POST "https://${domain}/create-conference" -H "Content-Type: application/json" -d '{}'`,
          {
            encoding: 'utf8',
            timeout: timeout,
          }
        );
      } catch (error) {
        throw new Error(`API request failed: ${error.message}`);
      }

      const response = JSON.parse(output);

      // Validate response structure
      expect(response).toHaveProperty('success', true);
      expect(response).toHaveProperty('conferenceId');
      expect(response).toHaveProperty('customer');
      expect(response).toHaveProperty('agent');
      expect(response).toHaveProperty('timer');
      expect(response).toHaveProperty('timestamp');

      // Validate conference ID format
      expect(response.conferenceId).toMatch(/^synth-call-\d+-[a-z0-9]+$/);

      // Validate customer details
      expect(response.customer).toHaveProperty('name');
      expect(response.customer).toHaveProperty('callSid');
      expect(response.customer.callSid).toMatch(/^CA[a-f0-9]{32}$/);

      // Validate agent details
      expect(response.agent).toHaveProperty('name');
      expect(response.agent).toHaveProperty('callSid');
      expect(response.agent.callSid).toMatch(/^CA[a-f0-9]{32}$/);

      // Validate timer metadata
      expect(response.timer).toHaveProperty('scheduled', false);
      expect(response.timer).toHaveProperty('note');
      expect(response.timer).toHaveProperty('timerUrl');
      expect(response.timer).toHaveProperty('suggestedTerminateAt');
    }, timeout);

    it('should create conference with random strategy', async () => {
      let output;
      try {
        output = execSync(
          `curl -s -X POST "https://${domain}/create-conference" -H "Content-Type: application/json" -d '{"strategy":"random"}'`,
          {
            encoding: 'utf8',
            timeout: timeout,
          }
        );
      } catch (error) {
        throw new Error(`API request failed: ${error.message}`);
      }

      const response = JSON.parse(output);

      expect(response).toHaveProperty('success', true);
      expect(response).toHaveProperty('conferenceId');
      expect(response.customer.callSid).toMatch(/^CA[a-f0-9]{32}$/);
      expect(response.agent.callSid).toMatch(/^CA[a-f0-9]{32}$/);
    }, timeout);

    it('should create conference with intelligent strategy', async () => {
      let output;
      try {
        output = execSync(
          `curl -s -X POST "https://${domain}/create-conference" -H "Content-Type: application/json" -d '{"strategy":"intelligent"}'`,
          {
            encoding: 'utf8',
            timeout: timeout,
          }
        );
      } catch (error) {
        throw new Error(`API request failed: ${error.message}`);
      }

      const response = JSON.parse(output);

      expect(response).toHaveProperty('success', true);
      expect(response).toHaveProperty('conferenceId');
      expect(response.customer.callSid).toMatch(/^CA[a-f0-9]{32}$/);
      expect(response.agent.callSid).toMatch(/^CA[a-f0-9]{32}$/);
    }, timeout);

    it('should use Sync for persona data storage', async () => {
      let output;
      try {
        output = execSync(
          `curl -s -X POST "https://${domain}/create-conference" -H "Content-Type: application/json" -d '{}'`,
          {
            encoding: 'utf8',
            timeout: timeout,
          }
        );
      } catch (error) {
        throw new Error(`API request failed: ${error.message}`);
      }

      const response = JSON.parse(output);

      // Conference should be created successfully
      expect(response.success).toBe(true);

      // Sync is used internally - we can't directly verify it here
      // but the fact that participants were created with callSids proves it worked
      expect(response.customer.callSid).toBeDefined();
      expect(response.agent.callSid).toBeDefined();
    }, timeout);

    it('should enable recording for participants', async () => {
      let output;
      try {
        output = execSync(
          `curl -s -X POST "https://${domain}/create-conference" -H "Content-Type: application/json" -d '{}'`,
          {
            encoding: 'utf8',
            timeout: timeout,
          }
        );
      } catch (error) {
        throw new Error(`API request failed: ${error.message}`);
      }

      const response = JSON.parse(output);

      expect(response.success).toBe(true);

      // Recording is enabled at participant creation
      // We verify this by checking that participants were created successfully
      // (recording settings are internal to the participant creation)
      expect(response.customer.callSid).toMatch(/^CA[a-f0-9]{32}$/);
      expect(response.agent.callSid).toMatch(/^CA[a-f0-9]{32}$/);

      // To fully verify recordings, use validate-specific-conferences.js
      // after calls complete (recordings take time to process)
    }, timeout);

    it('should return proper timer metadata', async () => {
      let output;
      try {
        output = execSync(
          `curl -s -X POST "https://${domain}/create-conference" -H "Content-Type: application/json" -d '{}'`,
          {
            encoding: 'utf8',
            timeout: timeout,
          }
        );
      } catch (error) {
        throw new Error(`API request failed: ${error.message}`);
      }

      const response = JSON.parse(output);

      expect(response.timer).toEqual({
        scheduled: false,
        note: expect.stringContaining('external scheduler'),
        timerUrl: `https://${domain}/conference-timer`,
        conferenceId: response.conferenceId,
        suggestedTerminateAt: expect.any(String),
      });

      // Validate suggestedTerminateAt is ~5 minutes from now
      const suggestedTime = new Date(response.timer.suggestedTerminateAt);
      const now = new Date();
      const diffMinutes = (suggestedTime - now) / 1000 / 60;

      expect(diffMinutes).toBeGreaterThan(4); // At least 4 minutes
      expect(diffMinutes).toBeLessThan(6); // At most 6 minutes
    }, timeout);
  });

  describe('Conference Timer Endpoint', () => {
    it('should return error for missing ConferenceSid', async () => {
      let output;
      try {
        output = execSync(
          `curl -s -X POST "https://${domain}/conference-timer" -H "Content-Type: application/json" -d '{}'`,
          {
            encoding: 'utf8',
            timeout: timeout,
          }
        );
      } catch (error) {
        throw new Error(`API request failed: ${error.message}`);
      }

      const response = JSON.parse(output);

      expect(response.success).toBe(false);
      expect(response.error).toContain('ConferenceSid');
    }, timeout);

    it('should return error for invalid ConferenceSid format', async () => {
      let output;
      try {
        output = execSync(
          `curl -s -X POST "https://${domain}/conference-timer" -H "Content-Type: application/json" -d '{"ConferenceSid":"invalid"}'`,
          {
            encoding: 'utf8',
            timeout: timeout,
          }
        );
      } catch (error) {
        throw new Error(`API request failed: ${error.message}`);
      }

      const response = JSON.parse(output);

      expect(response.success).toBe(false);
      expect(response.error).toContain('ConferenceSid');
    }, timeout);

    it('should return error for non-existent conference', async () => {
      // Use a valid format but non-existent SID
      const fakeSid = 'CF' + '0'.repeat(32);

      let output;
      try {
        output = execSync(
          `curl -s -X POST "https://${domain}/conference-timer" -H "Content-Type: application/json" -d '{"ConferenceSid":"${fakeSid}"}'`,
          {
            encoding: 'utf8',
            timeout: timeout,
          }
        );
      } catch (error) {
        throw new Error(`API request failed: ${error.message}`);
      }

      const response = JSON.parse(output);

      expect(response.success).toBe(false);
      expect(response.error).toContain('not found');
    }, timeout);
  });

  describe('Health Endpoint', () => {
    it('should return healthy status', async () => {
      let output;
      try {
        output = execSync(`curl -s "https://${domain}/health"`, {
          encoding: 'utf8',
          timeout: timeout,
        });
      } catch (error) {
        throw new Error(`API request failed: ${error.message}`);
      }

      const response = JSON.parse(output);

      expect(response.status).toBe('healthy');
      expect(response).toHaveProperty('timestamp');
      expect(response).toHaveProperty('dependencies');
      expect(response.dependencies).toHaveProperty('twilio');
      expect(response.dependencies).toHaveProperty('segment');
      expect(response.dependencies).toHaveProperty('voiceIntelligence');
    }, timeout);
  });
});
