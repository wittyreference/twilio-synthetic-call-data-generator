// ABOUTME: Module for adding participants (agents and customers) to Twilio conferences
// ABOUTME: Uses TwiML Application with OpenAI integration for AI-powered conversations

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Validates E.164 phone number format
 */
function isValidE164Phone(phoneNumber) {
  return /^\+[1-9]\d{1,14}$/.test(phoneNumber);
}

/**
 * Creates a delay for retry logic
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Adds a customer to a conference using TwiML Application
 * @param {Object} client - Twilio client instance
 * @param {string} conferenceSid - Conference SID
 * @param {Object} customer - Customer object with CustomerName, PhoneNumber
 * @param {string} twimlAppSid - TwiML Application SID
 * @param {string} customerPhoneNumber - Phone number to call the customer from (E.164 format)
 * @returns {Promise<Object>} Participant information
 */
async function addCustomerToConference(client, conferenceSid, customer, twimlAppSid, customerPhoneNumber) {
  // Validate customer data
  if (!customer.CustomerName) {
    throw new Error('Customer must have CustomerName');
  }

  if (!twimlAppSid) {
    throw new Error('TwiML Application SID is required');
  }

  if (!customerPhoneNumber) {
    throw new Error('Customer phone number is required');
  }

  if (!isValidE164Phone(customerPhoneNumber)) {
    throw new Error('Customer phone number must be in E.164 format (e.g., +15551234567)');
  }

  // Build TwiML Application URL with parameters
  const twimlAppUrl = `app:${twimlAppSid}?role=customer&persona=${encodeURIComponent(customer.CustomerName)}&conferenceId=${encodeURIComponent(conferenceSid)}`;

  // Retry logic for network errors
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const participant = await client.conferences(conferenceSid).participants.create({
        from: customerPhoneNumber,
        to: twimlAppUrl,
        earlyMedia: true,
        endConferenceOnExit: false,
        beep: false,
      });

      return {
        participantSid: participant.sid,
        callSid: participant.callSid,
        conferenceSid: conferenceSid,
        participantType: 'customer',
        customerName: customer.CustomerName,
      };
    } catch (error) {
      lastError = error;

      // Don't retry on validation/client errors (4xx status codes)
      if (error.status && error.status >= 400 && error.status < 500) {
        throw new Error(
          `Failed to add customer to conference ${conferenceSid}: ${error.message}`
        );
      }

      // Retry on network/server errors
      if (attempt < MAX_RETRIES) {
        console.log(`Retry attempt ${attempt} for customer ${customer.CustomerName}...`);
        await delay(RETRY_DELAY_MS * attempt);
      }
    }
  }

  // All retries failed
  throw new Error(
    `Failed after ${MAX_RETRIES} retries to add customer to conference ${conferenceSid}: ${lastError.message}`
  );
}

/**
 * Adds an AI agent to a conference using TwiML Application
 * @param {Object} client - Twilio client instance
 * @param {string} conferenceSid - Conference SID
 * @param {Object} agent - Agent object with AgentName
 * @param {string} twimlAppSid - TwiML Application SID
 * @param {string} agentPhoneNumber - Phone number to call the agent from (E.164 format)
 * @returns {Promise<Object>} Participant information
 */
async function addAgentToConference(client, conferenceSid, agent, twimlAppSid, agentPhoneNumber) {
  // Validate agent data
  if (!agent.AgentName) {
    throw new Error('Agent must have AgentName');
  }

  if (!twimlAppSid) {
    throw new Error('TwiML Application SID is required');
  }

  if (!agentPhoneNumber) {
    throw new Error('Agent phone number is required');
  }

  if (!isValidE164Phone(agentPhoneNumber)) {
    throw new Error('Agent phone number must be in E.164 format (e.g., +15551234567)');
  }

  // Build TwiML Application URL with parameters
  const twimlAppUrl = `app:${twimlAppSid}?role=agent&persona=${encodeURIComponent(agent.AgentName)}&conferenceId=${encodeURIComponent(conferenceSid)}`;

  // Retry logic for network errors
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const participant = await client.conferences(conferenceSid).participants.create({
        from: agentPhoneNumber,
        to: twimlAppUrl,
        earlyMedia: true,
        endConferenceOnExit: false,
        beep: false,
      });

      return {
        participantSid: participant.sid,
        callSid: participant.callSid,
        conferenceSid: conferenceSid,
        participantType: 'agent',
        agentName: agent.AgentName,
      };
    } catch (error) {
      lastError = error;

      // Don't retry on validation/client errors (4xx status codes)
      if (error.status && error.status >= 400 && error.status < 500) {
        throw new Error(
          `Failed to add agent to conference ${conferenceSid}: ${error.message}`
        );
      }

      // Retry on network/server errors
      if (attempt < MAX_RETRIES) {
        console.log(`Retry attempt ${attempt} for agent ${agent.AgentName}...`);
        await delay(RETRY_DELAY_MS * attempt);
      }
    }
  }

  // All retries failed
  throw new Error(
    `Failed after ${MAX_RETRIES} retries to add agent to conference ${conferenceSid}: ${lastError.message}`
  );
}

module.exports = {
  addCustomerToConference,
  addAgentToConference,
};
