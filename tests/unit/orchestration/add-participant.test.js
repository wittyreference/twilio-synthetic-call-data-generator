// ABOUTME: Unit tests for participant addition to conferences
// ABOUTME: Validates TwiML Application configuration and retry logic

const addParticipant = require('../../../src/orchestration/add-participant');

// Mock Twilio client
const mockCreate = jest.fn();

const createMockTwilioClient = () => ({
  conferences: jest.fn((sid) => ({
    participants: {
      create: mockCreate,
    },
  })),
});

describe('Add Participant Module', () => {
  const TWIML_APP_SID = 'APf6ae15d8f3df8d16e98d9d1afeb9e6b6';

  beforeEach(() => {
    mockCreate.mockClear();
  });

  describe('addCustomerToConference', () => {
    it('should add customer to conference using TwiML Application', async () => {
      const client = createMockTwilioClient();
      const customer = {
        CustomerName: 'Lucy Macintosh',
      };
      const conferenceSid = 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      const customerPhoneNumber = '+15129358764';

      mockCreate.mockResolvedValue({
        sid: 'CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        callSid: 'CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        conferenceSid: conferenceSid,
      });

      const result = await addParticipant.addCustomerToConference(
        client,
        conferenceSid,
        customer,
        TWIML_APP_SID,
        customerPhoneNumber
      );

      expect(mockCreate).toHaveBeenCalledWith({
        from: customerPhoneNumber,
        to: `app:${TWIML_APP_SID}?role=customer&persona=Lucy%20Macintosh&conferenceId=${conferenceSid}`,
        earlyMedia: true,
        endConferenceOnExit: false,
        beep: false,
      });

      expect(result).toEqual({
        participantSid: 'CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        callSid: 'CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        conferenceSid: conferenceSid,
        participantType: 'customer',
        customerName: customer.CustomerName,
      });
    });

    it('should URL encode customer name in TwiML App parameters', async () => {
      const client = createMockTwilioClient();
      const customer = {
        CustomerName: "O'Brien & Associates",
      };
      const conferenceSid = 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      const customerPhoneNumber = '+15129358764';

      mockCreate.mockResolvedValue({
        sid: 'CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        callSid: 'CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        conferenceSid: conferenceSid,
      });

      await addParticipant.addCustomerToConference(
        client,
        conferenceSid,
        customer,
        TWIML_APP_SID,
        customerPhoneNumber
      );

      const callArgs = mockCreate.mock.calls[0][0];
      // JavaScript's encodeURIComponent encodes apostrophes and ampersands
      expect(callArgs.to).toContain("persona=O'Brien%20%26%20Associates");
    });

    it('should handle missing customer name', async () => {
      const client = createMockTwilioClient();
      const customer = {};
      const conferenceSid = 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      const customerPhoneNumber = '+15129358764';

      await expect(
        addParticipant.addCustomerToConference(
          client,
          conferenceSid,
          customer,
          TWIML_APP_SID,
          customerPhoneNumber
        )
      ).rejects.toThrow('Customer must have CustomerName');
    });

    it('should handle missing TwiML Application SID', async () => {
      const client = createMockTwilioClient();
      const customer = {
        CustomerName: 'Lucy Macintosh',
      };
      const conferenceSid = 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      const customerPhoneNumber = '+15129358764';

      await expect(
        addParticipant.addCustomerToConference(
          client,
          conferenceSid,
          customer,
          null,
          customerPhoneNumber
        )
      ).rejects.toThrow('TwiML Application SID is required');
    });

    it('should handle missing customer phone number', async () => {
      const client = createMockTwilioClient();
      const customer = {
        CustomerName: 'Lucy Macintosh',
      };
      const conferenceSid = 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

      await expect(
        addParticipant.addCustomerToConference(
          client,
          conferenceSid,
          customer,
          TWIML_APP_SID,
          null
        )
      ).rejects.toThrow('Customer phone number is required');
    });

    it('should validate E.164 phone number format', async () => {
      const client = createMockTwilioClient();
      const customer = {
        CustomerName: 'Lucy Macintosh',
      };
      const conferenceSid = 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      const customerPhoneNumber = '5129358764'; // Missing +

      await expect(
        addParticipant.addCustomerToConference(
          client,
          conferenceSid,
          customer,
          TWIML_APP_SID,
          customerPhoneNumber
        )
      ).rejects.toThrow('E.164 format');
    });
  });

  describe('addAgentToConference', () => {
    it('should add agent to conference using TwiML Application', async () => {
      const client = createMockTwilioClient();
      const agent = {
        AgentName: 'Sarah',
      };
      const conferenceSid = 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      const agentPhoneNumber = '+15129998888';

      mockCreate.mockResolvedValue({
        sid: 'CAyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy',
        callSid: 'CAyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy',
        conferenceSid: conferenceSid,
      });

      const result = await addParticipant.addAgentToConference(
        client,
        conferenceSid,
        agent,
        TWIML_APP_SID,
        agentPhoneNumber
      );

      expect(mockCreate).toHaveBeenCalledWith({
        from: agentPhoneNumber,
        to: `app:${TWIML_APP_SID}?role=agent&persona=Sarah&conferenceId=${conferenceSid}`,
        earlyMedia: true,
        endConferenceOnExit: false,
        beep: false,
      });

      expect(result).toEqual({
        participantSid: 'CAyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy',
        callSid: 'CAyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy',
        conferenceSid: conferenceSid,
        participantType: 'agent',
        agentName: agent.AgentName,
      });
    });

    it('should URL encode agent name in TwiML App parameters', async () => {
      const client = createMockTwilioClient();
      const agent = {
        AgentName: 'Sarah Smith-Jones',
      };
      const conferenceSid = 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      const agentPhoneNumber = '+15129998888';

      mockCreate.mockResolvedValue({
        sid: 'CAyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy',
        callSid: 'CAyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy',
        conferenceSid: conferenceSid,
      });

      await addParticipant.addAgentToConference(
        client,
        conferenceSid,
        agent,
        TWIML_APP_SID,
        agentPhoneNumber
      );

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.to).toContain('persona=Sarah%20Smith-Jones');
    });

    it('should include role and conferenceId in TwiML App URL', async () => {
      const client = createMockTwilioClient();
      const agent = {
        AgentName: 'Sarah',
      };
      const conferenceSid = 'CFabc123def456';
      const agentPhoneNumber = '+15129998888';

      mockCreate.mockResolvedValue({
        sid: 'CAyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy',
        callSid: 'CAyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy',
        conferenceSid: conferenceSid,
      });

      await addParticipant.addAgentToConference(
        client,
        conferenceSid,
        agent,
        TWIML_APP_SID,
        agentPhoneNumber
      );

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.to).toContain('role=agent');
      expect(callArgs.to).toContain(`conferenceId=${conferenceSid}`);
    });

    it('should handle missing agent name', async () => {
      const client = createMockTwilioClient();
      const agent = {};
      const conferenceSid = 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      const agentPhoneNumber = '+15129998888';

      await expect(
        addParticipant.addAgentToConference(
          client,
          conferenceSid,
          agent,
          TWIML_APP_SID,
          agentPhoneNumber
        )
      ).rejects.toThrow('Agent must have AgentName');
    });

    it('should handle missing TwiML Application SID', async () => {
      const client = createMockTwilioClient();
      const agent = {
        AgentName: 'Sarah',
      };
      const conferenceSid = 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      const agentPhoneNumber = '+15129998888';

      await expect(
        addParticipant.addAgentToConference(
          client,
          conferenceSid,
          agent,
          null,
          agentPhoneNumber
        )
      ).rejects.toThrow('TwiML Application SID is required');
    });

    it('should validate agent phone number format', async () => {
      const client = createMockTwilioClient();
      const agent = {
        AgentName: 'Sarah',
      };
      const conferenceSid = 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      const agentPhoneNumber = '5129998888'; // Missing +

      await expect(
        addParticipant.addAgentToConference(
          client,
          conferenceSid,
          agent,
          TWIML_APP_SID,
          agentPhoneNumber
        )
      ).rejects.toThrow('E.164 format');
    });
  });

  describe('Retry logic', () => {
    it('should retry on network errors up to 3 times', async () => {
      const client = createMockTwilioClient();
      const customer = {
        CustomerName: 'Lucy Macintosh',
      };
      const conferenceSid = 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      const customerPhoneNumber = '+15129358764';

      // Fail twice, then succeed
      mockCreate
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          sid: 'CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
          callSid: 'CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
          conferenceSid: conferenceSid,
        });

      const result = await addParticipant.addCustomerToConference(
        client,
        conferenceSid,
        customer,
        TWIML_APP_SID,
        customerPhoneNumber
      );

      expect(mockCreate).toHaveBeenCalledTimes(3);
      expect(result.participantSid).toBe('CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
    });

    it('should fail after 3 retry attempts', async () => {
      const client = createMockTwilioClient();
      const customer = {
        CustomerName: 'Lucy Macintosh',
      };
      const conferenceSid = 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      const customerPhoneNumber = '+15129358764';

      mockCreate.mockRejectedValue(new Error('Network error'));

      await expect(
        addParticipant.addCustomerToConference(
          client,
          conferenceSid,
          customer,
          TWIML_APP_SID,
          customerPhoneNumber
        )
      ).rejects.toThrow('Failed after 3 retries');

      expect(mockCreate).toHaveBeenCalledTimes(3);
    });

    it('should not retry on validation errors', async () => {
      const client = createMockTwilioClient();
      const customer = {
        CustomerName: 'Lucy Macintosh',
      };
      const conferenceSid = 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      const customerPhoneNumber = 'invalid';

      await expect(
        addParticipant.addCustomerToConference(
          client,
          conferenceSid,
          customer,
          TWIML_APP_SID,
          customerPhoneNumber
        )
      ).rejects.toThrow('E.164 format');

      expect(mockCreate).toHaveBeenCalledTimes(0);
    });

    it('should not retry on client errors (4xx)', async () => {
      const client = createMockTwilioClient();
      const customer = {
        CustomerName: 'Lucy Macintosh',
      };
      const conferenceSid = 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      const customerPhoneNumber = '+15129358764';

      const twilioError = new Error('Invalid TwiML Application');
      twilioError.status = 400; // Use status instead of code
      mockCreate.mockRejectedValue(twilioError);

      await expect(
        addParticipant.addCustomerToConference(
          client,
          conferenceSid,
          customer,
          TWIML_APP_SID,
          customerPhoneNumber
        )
      ).rejects.toThrow('Failed to add customer');

      expect(mockCreate).toHaveBeenCalledTimes(1); // No retries
    });
  });

  describe('TwiML Application configuration', () => {
    it('should use app: URL format for participants', async () => {
      const client = createMockTwilioClient();
      const customer = {
        CustomerName: 'Lucy Macintosh',
      };
      const conferenceSid = 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      const customerPhoneNumber = '+15129358764';

      mockCreate.mockResolvedValue({
        sid: 'CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        callSid: 'CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        conferenceSid: conferenceSid,
      });

      await addParticipant.addCustomerToConference(
        client,
        conferenceSid,
        customer,
        TWIML_APP_SID,
        customerPhoneNumber
      );

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.to).toMatch(/^app:AP/);
    });

    it('should set correct beep and endConferenceOnExit settings', async () => {
      const client = createMockTwilioClient();
      const agent = {
        AgentName: 'Sarah',
      };
      const conferenceSid = 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      const agentPhoneNumber = '+15129998888';

      mockCreate.mockResolvedValue({
        sid: 'CAyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy',
        callSid: 'CAyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy',
        conferenceSid: conferenceSid,
      });

      await addParticipant.addAgentToConference(
        client,
        conferenceSid,
        agent,
        TWIML_APP_SID,
        agentPhoneNumber
      );

      const callArgs = mockCreate.mock.calls[0][0];

      expect(callArgs.beep).toBe(false);
      expect(callArgs.endConferenceOnExit).toBe(false);
      expect(callArgs.earlyMedia).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should include conference SID in error messages', async () => {
      const client = createMockTwilioClient();
      const customer = {
        CustomerName: 'Lucy Macintosh',
      };
      const conferenceSid = 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      const customerPhoneNumber = '+15129358764';

      const apiError = new Error('Twilio API error');
      mockCreate.mockRejectedValue(apiError);

      await expect(
        addParticipant.addCustomerToConference(
          client,
          conferenceSid,
          customer,
          TWIML_APP_SID,
          customerPhoneNumber
        )
      ).rejects.toThrow(conferenceSid);
    });

    it('should handle Twilio API errors gracefully', async () => {
      const client = createMockTwilioClient();
      const customer = {
        CustomerName: 'Lucy Macintosh',
      };
      const conferenceSid = 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      const customerPhoneNumber = '+15129358764';

      // Twilio uses status codes (not error codes) for HTTP errors
      const twilioError = new Error('Conference not found');
      twilioError.status = 404; // Use status instead of code
      mockCreate.mockRejectedValue(twilioError);

      await expect(
        addParticipant.addCustomerToConference(
          client,
          conferenceSid,
          customer,
          TWIML_APP_SID,
          customerPhoneNumber
        )
      ).rejects.toThrow('Failed to add customer');
    });
  });
});
