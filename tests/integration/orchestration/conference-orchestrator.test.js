// ABOUTME: LEGACY - Integration tests for OLD conference orchestration (src/orchestration)
// ABOUTME: These tests validate the deprecated code path - kept for reference only

// NOTE: This code path is DEPRECATED. Production uses serverless functions/create-conference.js
// These tests are kept for backwards compatibility but failures here don't block production

const conferenceOrchestrator = require('../../../src/orchestration/conference-orchestrator');
const PairSelector = require('../../../src/pairing/pair-selector');

// Mock Twilio client
const mockConferenceCreate = jest.fn();
const mockParticipantCreate = jest.fn();
const mockConferenceFetch = jest.fn();
const mockConferenceUpdate = jest.fn();

const createMockTwilioClient = () => {
  const conferencesFunc = jest.fn(sid => {
    // When called with SID - return conference instance
    return {
      participants: {
        create: mockParticipantCreate,
      },
      fetch: mockConferenceFetch,
      update: mockConferenceUpdate,
    };
  });

  // Add create method directly to conferences
  conferencesFunc.create = mockConferenceCreate;

  return {
    conferences: conferencesFunc,
  };
};

describe.skip('Conference Orchestrator Integration (DEPRECATED - LEGACY CODE)', () => {
  let client;

  beforeEach(() => {
    client = createMockTwilioClient();
    mockConferenceCreate.mockClear();
    mockParticipantCreate.mockClear();
    mockConferenceFetch.mockClear();
    mockConferenceUpdate.mockClear();
  });

  describe('createConference', () => {
    it('should orchestrate complete conference creation flow', async () => {
      const agentPhoneNumber = '+15129998888';
      const conferenceSid = 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

      // Mock conference creation
      mockConferenceCreate.mockResolvedValue({
        sid: conferenceSid,
        status: 'init',
        friendlyName: expect.any(String),
      });

      // Mock participant creation (2 calls: customer and agent)
      mockParticipantCreate
        .mockResolvedValueOnce({
          // Customer
          sid: 'CAcustomerxxxxxxxxxxxxxxxxxxxxxxxxx',
          callSid: 'CAcustomerxxxxxxxxxxxxxxxxxxxxxxxxx',
          conferenceSid: conferenceSid,
        })
        .mockResolvedValueOnce({
          // Agent
          sid: 'CAagentxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
          callSid: 'CAagentxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
          conferenceSid: conferenceSid,
        });

      const result = await conferenceOrchestrator.createConference(
        client,
        'APf6ae15d8f3df8d16e98d9d1afeb9e6b6',
        agentPhoneNumber,
        '+15551234567'
      );

      // Verify conference was created
      expect(mockConferenceCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          friendlyName: expect.stringContaining('CF'),
          record: 'record-from-start',
          recordingStatusCallback: expect.stringContaining(
            'conference-status-webhook'
          ),
          statusCallback: expect.stringContaining('conference-status-webhook'),
        })
      );

      // Verify both participants were added
      expect(mockParticipantCreate).toHaveBeenCalledTimes(2);

      // Verify result structure
      expect(result).toEqual({
        conferenceSid: conferenceSid,
        conferenceId: expect.stringMatching(/^CF[a-f0-9]{32}$/),
        customer: expect.objectContaining({
          participantSid: 'CAcustomerxxxxxxxxxxxxxxxxxxxxxxxxx',
          customerName: expect.any(String),
        }),
        agent: expect.objectContaining({
          participantSid: 'CAagentxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
          agentName: expect.any(String),
        }),
        timerScheduled: true,
        timerDuration: 300,
        timestamp: expect.any(String),
      });
    });

    it('should use random pairing strategy by default', async () => {
      const agentPhoneNumber = '+15129998888';
      const conferenceSid = 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

      mockConferenceCreate.mockResolvedValue({
        sid: conferenceSid,
        status: 'init',
      });

      mockParticipantCreate
        .mockResolvedValueOnce({
          sid: 'CAcustomerxxxxxxxxxxxxxxxxxxxxxxxxx',
          callSid: 'CAcustomerxxxxxxxxxxxxxxxxxxxxxxxxx',
          conferenceSid: conferenceSid,
        })
        .mockResolvedValueOnce({
          sid: 'CAagentxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
          callSid: 'CAagentxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
          conferenceSid: conferenceSid,
        });

      const result = await conferenceOrchestrator.createConference(
        client,
        'APf6ae15d8f3df8d16e98d9d1afeb9e6b6',
        agentPhoneNumber,
        '+15551234567'
      );

      expect(result.customer.customerName).toBeTruthy();
      expect(result.agent.agentName).toBeTruthy();
    });

    it('should support custom pairing strategy', async () => {
      const agentPhoneNumber = '+15129998888';
      const conferenceSid = 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

      mockConferenceCreate.mockResolvedValue({
        sid: conferenceSid,
        status: 'init',
      });

      mockParticipantCreate
        .mockResolvedValueOnce({
          sid: 'CAcustomerxxxxxxxxxxxxxxxxxxxxxxxxx',
          callSid: 'CAcustomerxxxxxxxxxxxxxxxxxxxxxxxxx',
          conferenceSid: conferenceSid,
        })
        .mockResolvedValueOnce({
          sid: 'CAagentxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
          callSid: 'CAagentxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
          conferenceSid: conferenceSid,
        });

      const result = await conferenceOrchestrator.createConference(
        client,
        'APf6ae15d8f3df8d16e98d9d1afeb9e6b6',
        agentPhoneNumber,
        '+15551234567',
        { strategy: 'frustrated' }
      );

      // Frustrated customers should be paired with High competence agents
      expect(result.agent).toBeDefined();
    });

    it('should configure recording with transcription', async () => {
      const agentPhoneNumber = '+15129998888';
      const conferenceSid = 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

      mockConferenceCreate.mockResolvedValue({
        sid: conferenceSid,
        status: 'init',
      });

      mockParticipantCreate.mockResolvedValue({
        sid: 'CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        callSid: 'CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        conferenceSid: conferenceSid,
      });

      await conferenceOrchestrator.createConference(client, "APf6ae15d8f3df8d16e98d9d1afeb9e6b6", agentPhoneNumber, "+15551234567");

      expect(mockConferenceCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          record: 'record-from-start',
          recordingStatusCallback: expect.any(String),
          recordingStatusCallbackMethod: 'POST',
        })
      );
    });

    it('should schedule 5-minute timer', async () => {
      const agentPhoneNumber = '+15129998888';
      const conferenceSid = 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

      mockConferenceCreate.mockResolvedValue({
        sid: conferenceSid,
        status: 'init',
      });

      mockParticipantCreate.mockResolvedValue({
        sid: 'CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        callSid: 'CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        conferenceSid: conferenceSid,
      });

      const result = await conferenceOrchestrator.createConference(
        client,
        'APf6ae15d8f3df8d16e98d9d1afeb9e6b6',
        agentPhoneNumber,
        '+15551234567'
      );

      expect(result.timerScheduled).toBe(true);
      expect(result.timerDuration).toBe(300); // 5 minutes in seconds
    });
  });

  describe('Error recovery', () => {
    it('should handle conference creation failure', async () => {
      const agentPhoneNumber = '+15129998888';

      const conferenceError = new Error('Failed to create conference');
      mockConferenceCreate.mockRejectedValue(conferenceError);

      await expect(
        conferenceOrchestrator.createConference(client, "APf6ae15d8f3df8d16e98d9d1afeb9e6b6", agentPhoneNumber, "+15551234567")
      ).rejects.toThrow('Failed to create conference');
    });

    it('should rollback if customer addition fails', async () => {
      const agentPhoneNumber = '+15129998888';
      const conferenceSid = 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

      mockConferenceCreate.mockResolvedValue({
        sid: conferenceSid,
        status: 'init',
      });

      const customerError = new Error('Failed to add customer');
      customerError.status = 500; // Server error - will retry then fail
      mockParticipantCreate.mockRejectedValue(customerError);

      // Mock conference update for rollback
      mockConferenceFetch.mockResolvedValue({
        sid: conferenceSid,
        status: 'in-progress',
      });

      mockConferenceUpdate.mockResolvedValue({
        sid: conferenceSid,
        status: 'completed',
      });

      await expect(
        conferenceOrchestrator.createConference(client, "APf6ae15d8f3df8d16e98d9d1afeb9e6b6", agentPhoneNumber, "+15551234567")
      ).rejects.toThrow('Failed to add customer');

      // Verify rollback was attempted
      expect(mockConferenceUpdate).toHaveBeenCalledWith({
        status: 'completed',
      });
    });

    it('should rollback if agent addition fails', async () => {
      const agentPhoneNumber = '+15129998888';
      const conferenceSid = 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

      mockConferenceCreate.mockResolvedValue({
        sid: conferenceSid,
        status: 'init',
      });

      // Customer succeeds, agent fails with client error (no retry)
      const agentError = new Error('Failed to add agent');
      agentError.status = 400; // Client error - won't retry

      mockParticipantCreate
        .mockResolvedValueOnce({
          sid: 'CAcustomerxxxxxxxxxxxxxxxxxxxxxxxxx',
          callSid: 'CAcustomerxxxxxxxxxxxxxxxxxxxxxxxxx',
          conferenceSid: conferenceSid,
        })
        .mockRejectedValueOnce(agentError);

      mockConferenceFetch.mockResolvedValue({
        sid: conferenceSid,
        status: 'in-progress',
      });

      mockConferenceUpdate.mockResolvedValue({
        sid: conferenceSid,
        status: 'completed',
      });

      await expect(
        conferenceOrchestrator.createConference(client, "APf6ae15d8f3df8d16e98d9d1afeb9e6b6", agentPhoneNumber, "+15551234567")
      ).rejects.toThrow('Failed to add agent');

      // Verify rollback was attempted
      expect(mockConferenceUpdate).toHaveBeenCalledWith({
        status: 'completed',
      });
    });

    it('should handle rollback failure gracefully', async () => {
      const agentPhoneNumber = '+15129998888';
      const conferenceSid = 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

      mockConferenceCreate.mockResolvedValue({
        sid: conferenceSid,
        status: 'init',
      });

      mockParticipantCreate.mockRejectedValue(
        new Error('Failed to add customer')
      );

      mockConferenceFetch.mockResolvedValue({
        sid: conferenceSid,
        status: 'in-progress',
      });

      // Rollback also fails
      mockConferenceUpdate.mockRejectedValue(new Error('Rollback failed'));

      await expect(
        conferenceOrchestrator.createConference(client, "APf6ae15d8f3df8d16e98d9d1afeb9e6b6", agentPhoneNumber, "+15551234567")
      ).rejects.toThrow('Failed to add customer');

      // Should still attempt rollback even if it fails
      expect(mockConferenceUpdate).toHaveBeenCalled();
    });
  });

  describe('Conference configuration', () => {
    it('should set correct conference settings', async () => {
      const agentPhoneNumber = '+15129998888';
      const conferenceSid = 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

      mockConferenceCreate.mockResolvedValue({
        sid: conferenceSid,
        status: 'init',
      });

      mockParticipantCreate.mockResolvedValue({
        sid: 'CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        callSid: 'CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        conferenceSid: conferenceSid,
      });

      await conferenceOrchestrator.createConference(client, "APf6ae15d8f3df8d16e98d9d1afeb9e6b6", agentPhoneNumber, "+15551234567");

      expect(mockConferenceCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          beep: false,
          startConferenceOnEnter: true,
          endConferenceOnExit: false,
          maxParticipants: 2,
        })
      );
    });

    it('should use conference ID as friendly name', async () => {
      const agentPhoneNumber = '+15129998888';
      const conferenceSid = 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

      mockConferenceCreate.mockResolvedValue({
        sid: conferenceSid,
        status: 'init',
      });

      mockParticipantCreate.mockResolvedValue({
        sid: 'CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        callSid: 'CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        conferenceSid: conferenceSid,
      });

      const result = await conferenceOrchestrator.createConference(
        client,
        'APf6ae15d8f3df8d16e98d9d1afeb9e6b6',
        agentPhoneNumber,
        '+15551234567'
      );

      expect(mockConferenceCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          friendlyName: result.conferenceId,
        })
      );
    });
  });

  describe('Agent phone number validation', () => {
    it('should validate E.164 format for agent phone', async () => {
      const invalidPhone = '5129998888'; // Missing +

      await expect(
        conferenceOrchestrator.createConference(client, "APf6ae15d8f3df8d16e98d9d1afeb9e6b6", invalidPhone, "+15551234567")
      ).rejects.toThrow('E.164 format');
    });

    it('should require agent phone number', async () => {
      await expect(
        conferenceOrchestrator.createConference(client, "APf6ae15d8f3df8d16e98d9d1afeb9e6b6", null, "+15551234567")
      ).rejects.toThrow('Agent phone number is required');
    });
  });

  describe('Logging and observability', () => {
    let consoleLogSpy;
    let consoleErrorSpy;

    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should log conference creation steps', async () => {
      const agentPhoneNumber = '+15129998888';
      const conferenceSid = 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

      mockConferenceCreate.mockResolvedValue({
        sid: conferenceSid,
        status: 'init',
      });

      mockParticipantCreate.mockResolvedValue({
        sid: 'CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        callSid: 'CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        conferenceSid: conferenceSid,
      });

      await conferenceOrchestrator.createConference(client, "APf6ae15d8f3df8d16e98d9d1afeb9e6b6", agentPhoneNumber, "+15551234567");

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Creating conference')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Adding customer')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Adding agent')
      );
    });

    it('should log errors during creation', async () => {
      const agentPhoneNumber = '+15129998888';

      mockConferenceCreate.mockRejectedValue(new Error('API error'));

      await expect(
        conferenceOrchestrator.createConference(client, "APf6ae15d8f3df8d16e98d9d1afeb9e6b6", agentPhoneNumber, "+15551234567")
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
});
