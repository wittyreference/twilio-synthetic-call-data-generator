// ABOUTME: End-to-end tests for Postman collection validation
// ABOUTME: Validates collection structure, pre-request scripts, and Newman compatibility

const fs = require('fs');
const path = require('path');

describe('Postman Collection Structure', () => {
  let collection;
  let environment;

  beforeAll(() => {
    const collectionPath = path.join(
      __dirname,
      '../../postman/collection.json'
    );
    const environmentPath = path.join(
      __dirname,
      '../../postman/environment.json'
    );

    // Load collection and environment files
    const collectionData = fs.readFileSync(collectionPath, 'utf8');
    collection = JSON.parse(collectionData);

    const environmentData = fs.readFileSync(environmentPath, 'utf8');
    environment = JSON.parse(environmentData);
  });

  describe('Collection metadata', () => {
    it('should have valid Postman collection schema', () => {
      expect(collection.info).toBeDefined();
      expect(collection.info.name).toBe('Twilio Synthetic Call Data Generator');
      expect(collection.info.schema).toMatch(
        /^https:\/\/schema\.getpostman\.com/
      );
    });

    it('should have description', () => {
      expect(collection.info.description).toBeDefined();
      expect(collection.info.description).toContain('synthetic call data');
    });

    it('should have version information', () => {
      expect(collection.info.version).toBeDefined();
    });
  });

  describe('Collection structure', () => {
    it('should have item array for requests', () => {
      expect(collection.item).toBeDefined();
      expect(Array.isArray(collection.item)).toBe(true);
      expect(collection.item.length).toBeGreaterThan(0);
    });

    it('should have Create Conference request', () => {
      const createConferenceRequest = collection.item.find(
        item => item.name === 'Create Conference'
      );

      expect(createConferenceRequest).toBeDefined();
      expect(createConferenceRequest.request).toBeDefined();
      expect(createConferenceRequest.request.method).toBe('POST');
    });

    it('should have Get Conference Status request', () => {
      const getStatusRequest = collection.item.find(
        item => item.name === 'Get Conference Status'
      );

      expect(getStatusRequest).toBeDefined();
      expect(getStatusRequest.request.method).toBe('GET');
    });

    it('should have Terminate Conference request', () => {
      const terminateRequest = collection.item.find(
        item => item.name === 'Terminate Conference'
      );

      expect(terminateRequest).toBeDefined();
      expect(terminateRequest.request.method).toBe('POST');
    });
  });

  describe('Pre-request script', () => {
    it('should have collection-level pre-request script', () => {
      expect(collection.event).toBeDefined();
      const preRequestEvent = collection.event.find(
        e => e.listen === 'prerequest'
      );
      expect(preRequestEvent).toBeDefined();
      expect(preRequestEvent.script).toBeDefined();
      expect(preRequestEvent.script.exec).toBeDefined();
    });

    it('should select random customer in pre-request script', () => {
      const preRequestEvent = collection.event.find(
        e => e.listen === 'prerequest'
      );
      const scriptLines = preRequestEvent.script.exec.join('\n');

      expect(scriptLines).toContain('customers');
      expect(scriptLines).toContain('Math.random');
      expect(scriptLines).toContain('pm.environment.set');
    });

    it('should select random agent in pre-request script', () => {
      const preRequestEvent = collection.event.find(
        e => e.listen === 'prerequest'
      );
      const scriptLines = preRequestEvent.script.exec.join('\n');

      expect(scriptLines).toContain('agents');
      expect(scriptLines).toContain('Math.random');
      expect(scriptLines).toContain('agentName');
    });

    it('should set customer variables in environment', () => {
      const preRequestEvent = collection.event.find(
        e => e.listen === 'prerequest'
      );
      const scriptLines = preRequestEvent.script.exec.join('\n');

      expect(scriptLines).toContain("pm.environment.set('customerName'");
      expect(scriptLines).toContain("pm.environment.set('customerPhone'");
    });

    it('should set agent variables in environment', () => {
      const preRequestEvent = collection.event.find(
        e => e.listen === 'prerequest'
      );
      const scriptLines = preRequestEvent.script.exec.join('\n');

      expect(scriptLines).toContain("pm.environment.set('agentName'");
    });
  });

  describe('Environment configuration', () => {
    it('should have valid environment schema', () => {
      expect(environment.name).toBe('Twilio Synthetic Generator');
      expect(environment.values).toBeDefined();
      expect(Array.isArray(environment.values)).toBe(true);
    });

    it('should have TWILIO_ACCOUNT_SID variable', () => {
      const accountSid = environment.values.find(
        v => v.key === 'TWILIO_ACCOUNT_SID'
      );
      expect(accountSid).toBeDefined();
      expect(accountSid.enabled).toBe(true);
    });

    it('should have TWILIO_AUTH_TOKEN variable', () => {
      const authToken = environment.values.find(
        v => v.key === 'TWILIO_AUTH_TOKEN'
      );
      expect(authToken).toBeDefined();
      expect(authToken.enabled).toBe(true);
    });

    it('should have AGENT_PHONE_NUMBER variable', () => {
      const agentPhone = environment.values.find(
        v => v.key === 'AGENT_PHONE_NUMBER'
      );
      expect(agentPhone).toBeDefined();
      expect(agentPhone.enabled).toBe(true);
    });

    it('should have BASE_URL variable', () => {
      const baseUrl = environment.values.find(v => v.key === 'BASE_URL');
      expect(baseUrl).toBeDefined();
      expect(baseUrl.value).toContain('twil.io');
    });
  });

  describe('Request validation', () => {
    it('should use environment variables in requests', () => {
      const createRequest = collection.item.find(
        item => item.name === 'Create Conference'
      );

      // Check authentication uses TWILIO_ACCOUNT_SID
      const authUsername = createRequest.request.auth.basic.find(
        b => b.key === 'username'
      );
      expect(authUsername.value).toContain('{{TWILIO_ACCOUNT_SID}}');
    });

    it('should have authentication configured', () => {
      const createRequest = collection.item.find(
        item => item.name === 'Create Conference'
      );

      expect(createRequest.request.auth).toBeDefined();
      expect(createRequest.request.auth.type).toBe('basic');
    });

    it('should have request body for Create Conference', () => {
      const createRequest = collection.item.find(
        item => item.name === 'Create Conference'
      );

      expect(createRequest.request.body).toBeDefined();
      expect(createRequest.request.body.mode).toBe('urlencoded');
    });
  });

  describe('Test scripts', () => {
    it('should have test assertions for Create Conference', () => {
      const createRequest = collection.item.find(
        item => item.name === 'Create Conference'
      );

      const testEvent = createRequest.event?.find(e => e.listen === 'test');
      expect(testEvent).toBeDefined();
      expect(testEvent.script.exec).toBeDefined();

      const scriptLines = testEvent.script.exec.join('\n');
      expect(scriptLines).toContain('pm.test');
      expect(scriptLines).toContain('pm.response.to.have.status');
    });

    it('should save conference SID from response', () => {
      const createRequest = collection.item.find(
        item => item.name === 'Create Conference'
      );

      const testEvent = createRequest.event?.find(e => e.listen === 'test');
      const scriptLines = testEvent.script.exec.join('\n');

      expect(scriptLines).toContain('pm.environment.set');
      expect(scriptLines).toContain('conferenceId');
    });

    it('should validate response schema', () => {
      const createRequest = collection.item.find(
        item => item.name === 'Create Conference'
      );

      const testEvent = createRequest.event?.find(e => e.listen === 'test');
      const scriptLines = testEvent.script.exec.join('\n');

      expect(scriptLines).toContain('jsonData');
      expect(scriptLines).toMatch(/conferenceId/);
    });
  });

  describe('Collection variables', () => {
    it('should define collection variables if needed', () => {
      // Collection variables are optional but useful
      if (collection.variable) {
        expect(Array.isArray(collection.variable)).toBe(true);
      }
    });
  });

  describe('Newman compatibility', () => {
    it('should be valid JSON', () => {
      const collectionPath = path.join(
        __dirname,
        '../../postman/collection.json'
      );
      const collectionData = fs.readFileSync(collectionPath, 'utf8');

      expect(() => JSON.parse(collectionData)).not.toThrow();
    });

    it('should have valid environment JSON', () => {
      const environmentPath = path.join(
        __dirname,
        '../../postman/environment.json'
      );
      const environmentData = fs.readFileSync(environmentPath, 'utf8');

      expect(() => JSON.parse(environmentData)).not.toThrow();
    });

    it('should use Postman v2.1 schema', () => {
      expect(collection.info.schema).toContain('v2.1');
    });
  });
});
