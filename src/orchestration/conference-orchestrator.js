// ABOUTME: Conference creation orchestrator that coordinates the complete flow
// ABOUTME: Uses TwiML Application for AI-powered conversations with OpenAI integration

const PairSelector = require('../pairing/pair-selector');
const { addCustomerToConference, addAgentToConference } = require('./add-participant');

const TIMER_DURATION_SECONDS = 300; // 5 minutes

/**
 * Validates E.164 phone number format
 */
function isValidE164Phone(phoneNumber) {
  return /^\+[1-9]\d{1,14}$/.test(phoneNumber);
}

/**
 * Attempts to rollback (terminate) a conference if creation fails partway through
 */
async function rollbackConference(client, conferenceSid) {
  try {
    console.log(`Attempting to rollback conference ${conferenceSid}...`);
    const conference = await client.conferences(conferenceSid).fetch();

    if (conference.status !== 'completed') {
      await client.conferences(conferenceSid).update({ status: 'completed' });
      console.log(`Successfully rolled back conference ${conferenceSid}`);
    }
  } catch (rollbackError) {
    console.error(`Failed to rollback conference ${conferenceSid}:`, rollbackError.message);
    // Don't throw - rollback is best-effort
  }
}

/**
 * Creates a complete conference with customer and agent participants
 * @param {Object} client - Twilio client instance
 * @param {string} twimlAppSid - TwiML Application SID for voice handling
 * @param {string} agentPhoneNumber - Phone number for agent (E.164 format)
 * @param {string} customerPhoneNumber - Phone number for customer (E.164 format)
 * @param {Object} options - Configuration options
 * @param {string} options.strategy - Pairing strategy ('random', 'frustrated', etc.)
 * @returns {Promise<Object>} Conference details with participants
 */
async function createConference(client, twimlAppSid, agentPhoneNumber, customerPhoneNumber, options = {}) {
  const { strategy = 'random' } = options;

  // Validate TwiML Application SID
  if (!twimlAppSid) {
    throw new Error('TwiML Application SID is required');
  }

  // Validate agent phone number
  if (!agentPhoneNumber) {
    throw new Error('Agent phone number is required');
  }

  if (!isValidE164Phone(agentPhoneNumber)) {
    throw new Error('Agent phone number must be in E.164 format (e.g., +15551234567)');
  }

  // Validate customer phone number
  if (!customerPhoneNumber) {
    throw new Error('Customer phone number is required');
  }

  if (!isValidE164Phone(customerPhoneNumber)) {
    throw new Error('Customer phone number must be in E.164 format (e.g., +15551234567)');
  }

  let conferenceSid;

  try {
    // Step 1: Select customer-agent pair
    console.log(`Selecting customer-agent pair using strategy: ${strategy}`);
    const pairSelector = new PairSelector();
    const pair = pairSelector.selectPairWithStrategy(strategy);
    const conferenceId = pair.conferenceId;

    console.log(`Selected pair: ${pair.customer.CustomerName} <-> ${pair.agent.AgentName}`);
    console.log(`Conference ID: ${conferenceId}`);

    // Step 2: Create conference
    console.log('Creating conference...');
    const conference = await client.conferences.create({
      friendlyName: conferenceId,
      record: 'record-from-start',
      recordingStatusCallback: '/conference-status-webhook',
      recordingStatusCallbackMethod: 'POST',
      statusCallback: '/conference-status-webhook',
      statusCallbackMethod: 'POST',
      beep: false,
      startConferenceOnEnter: true,
      endConferenceOnExit: false,
      maxParticipants: 2,
    });

    conferenceSid = conference.sid;
    console.log(`Conference created: ${conferenceSid}`);

    // Step 3: Add customer to conference
    console.log(`Adding customer ${pair.customer.CustomerName} to conference...`);
    const customerParticipant = await addCustomerToConference(
      client,
      conferenceSid,
      pair.customer,
      twimlAppSid,
      customerPhoneNumber
    );
    console.log(`Customer added: ${customerParticipant.participantSid}`);

    // Step 4: Add agent to conference
    console.log(`Adding agent ${pair.agent.AgentName} to conference...`);
    const agentParticipant = await addAgentToConference(
      client,
      conferenceSid,
      pair.agent,
      twimlAppSid,
      agentPhoneNumber
    );
    console.log(`Agent added: ${agentParticipant.participantSid}`);

    // Step 5: Schedule timer (simulated - actual scheduling would happen externally)
    console.log(`Scheduling ${TIMER_DURATION_SECONDS}s timer for conference ${conferenceSid}...`);
    const timerScheduled = true; // In production, this would trigger actual scheduling

    // Return complete conference details
    return {
      conferenceSid: conferenceSid,
      conferenceId: conferenceId,
      customer: {
        participantSid: customerParticipant.participantSid,
        callSid: customerParticipant.callSid,
        customerName: pair.customer.CustomerName,
        phoneNumber: customerPhoneNumber,
      },
      agent: {
        participantSid: agentParticipant.participantSid,
        callSid: agentParticipant.callSid,
        agentName: pair.agent.AgentName,
        phoneNumber: agentPhoneNumber,
      },
      timerScheduled: timerScheduled,
      timerDuration: TIMER_DURATION_SECONDS,
      timestamp: new Date().toISOString(),
    };

  } catch (error) {
    console.error('Error during conference creation:', error.message);

    // Attempt rollback if conference was created
    if (conferenceSid) {
      await rollbackConference(client, conferenceSid);
    }

    throw error;
  }
}

module.exports = {
  createConference,
};
