// ABOUTME: Serverless function to create synthetic conferences with customer-agent pairs
// ABOUTME: Uses conference orchestration logic to create real Twilio calls with AI participants

// ⚠️ LOCKED FILE - DO NOT MODIFY WITHOUT MC'S EXPLICIT AUTHORIZATION ⚠️
// This file controls core call flow which is WORKING with multi-turn conversations.
// See docs/CALL-INFRASTRUCTURE-LOCKDOWN.md for details.
// Any modifications require MC to say: "I AUTHORIZE YOU TO MODIFY create-conference.js"

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Load customers and agents
async function loadCustomers(context, runtime) {
  // In Twilio serverless environment, fetch from deployed assets via HTTP
  if (context && context.DOMAIN_NAME) {
    try {
      const response = await axios.get(`https://${context.DOMAIN_NAME}/customers.json`);
      const data = response.data;
      return data.CustomerPrompts || data;
    } catch (err) {
      console.error('Error loading customers from deployed assets:', err);
    }
  }
  // Fallback for local development
  const customersPath = path.join(process.cwd(), 'assets', 'customers.json');
  const data = JSON.parse(fs.readFileSync(customersPath, 'utf8'));
  return data.CustomerPrompts || data;
}

async function loadAgents(context, runtime) {
  // In Twilio serverless environment, fetch from deployed assets via HTTP
  if (context && context.DOMAIN_NAME) {
    try {
      const response = await axios.get(`https://${context.DOMAIN_NAME}/agents.json`);
      const data = response.data;
      return data.AgentPrompts || data;
    } catch (err) {
      console.error('Error loading agents from deployed assets:', err);
    }
  }
  // Fallback for local development
  const agentsPath = path.join(process.cwd(), 'assets', 'agents.json');
  const data = JSON.parse(fs.readFileSync(agentsPath, 'utf8'));
  return data.AgentPrompts || data;
}

// Select random pair
async function selectRandomPair(context, runtime) {
  const customers = await loadCustomers(context, runtime);
  const agents = await loadAgents(context, runtime);

  const customer = customers[Math.floor(Math.random() * customers.length)];
  const agent = agents[Math.floor(Math.random() * agents.length)];

  // Generate unique conference ID
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  const conferenceId = `synth-call-${timestamp}-${random}`;

  return { customer, agent, conferenceId };
}

// Store participant data in Sync (avoids 800-char URL limit)
async function storeParticipantDataInSync(
  client,
  context,
  conferenceId,
  participant,
  role
) {
  const isAgent = role === 'agent';
  const name = isAgent ? participant.AgentName : participant.CustomerName;

  // Build system prompt for OpenAI
  const systemPrompt = isAgent
    ? `${participant.ScriptedIntroduction}\n\nCharacteristics:\n- Response: ${participant.ResponseToIssue}\n- Competence: ${participant.CompetenceLevel}\n- Attitude: ${participant.Attitude}\n- Product knowledge: ${participant.ProductKnowledge}\n\n${participant.Characteristics}`
    : participant.Prompt;

  const introduction = isAgent ? participant.ScriptedIntroduction : '';

  const syncKey = `${conferenceId}_${role}`;

  // Store in Sync
  const syncServiceSid = context.SYNC_SERVICE_SID || context.TWILIO_SYNC_SERVICE_SID;

  if (!syncServiceSid) {
    throw new Error('SYNC_SERVICE_SID or TWILIO_SYNC_SERVICE_SID must be set in environment');
  }

  const syncDoc = await client.sync.v1
    .services(syncServiceSid)
    .documents.create({
      uniqueName: syncKey,
      data: {
        role: role,
        name: name,
        systemPrompt: systemPrompt,
        introduction: introduction,
        participant: participant,
      },
      ttl: 3600, // 1 hour TTL
    });

  console.log(`Stored ${role} data in Sync: ${syncKey}`);
  return syncKey;
}

// Add participant to conference
async function addParticipantToConference(
  context,
  client,
  conferenceId,
  participant,
  role,
  isFirstParticipant = false
) {
  const isAgent = role === 'agent';
  const name = isAgent ? participant.AgentName : participant.CustomerName;

  console.log(`Adding ${role}: ${name} to conference ${conferenceId}`);

  const agentPhoneNumber = context.AGENT_PHONE_NUMBER || context.TWILIO_PHONE_NUMBER;
  const twimlAppSid = context.TWIML_APP_SID;

  if (!agentPhoneNumber) {
    throw new Error(
      'AGENT_PHONE_NUMBER or TWILIO_PHONE_NUMBER must be set in environment'
    );
  }

  if (!twimlAppSid) {
    throw new Error('TWIML_APP_SID must be set in environment');
  }

  // Determine the 'from' phone number based on role
  // Customer: use their phone number for Segment tracking
  // Agent: use agent/contact center phone number
  const fromPhoneNumber = isAgent ? agentPhoneNumber : participant.PhoneNumber;

  if (!fromPhoneNumber) {
    throw new Error(`Missing phone number for ${role}: ${name}`);
  }

  // Store participant data in Sync to avoid 800-char URL limit
  const syncKey = await storeParticipantDataInSync(
    client,
    context,
    conferenceId,
    participant,
    role
  );

  // Build participant creation parameters
  //
  // ⚠️  CRITICAL: Custom parameters MUST be passed as query string on 'to' field
  // DO NOT modify this pattern - custom params do NOT work as top-level properties
  // See: https://www.twilio.com/docs/voice/api/conference-participant-resource#custom-parameters
  //
  // CORRECT:   to: 'app:APxxx?sync_key=foo&role=bar'
  // INCORRECT: { to: 'app:APxxx', sync_key: 'foo', role: 'bar' }
  //
  // IMPORTANT: Use snake_case (not camelCase) to match Twilio's convention
  // These parameters are received in voice-handler as event.sync_key, event.conference_id, event.role
  const customParams = new URLSearchParams({
    sync_key: syncKey,       // Use snake_case for consistency with Twilio
    conference_id: conferenceId,
    role: role,
  });

  const participantParams = {
    from: fromPhoneNumber,
    to: `app:${twimlAppSid}?${customParams.toString()}`, // TwiML App with custom params in query string
    earlyMedia: true,
    endConferenceOnExit: false,
    beep: false,
    timeLimit: 300, // Auto-terminate participant after 5 minutes (300 seconds)
    record: true, // Enable recording
    recordingStatusCallback: `https://${context.DOMAIN_NAME}/transcription-webhook`,
    recordingStatusCallbackEvent: ['completed'],
    recordingStatusCallbackMethod: 'POST',
    statusCallback: `https://${context.DOMAIN_NAME}/conference-status-webhook`,
    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    statusCallbackMethod: 'POST',
    label: role,
  };

  console.log(`📤 DEBUG: Creating participant with to=${participantParams.to}`);

  // Conference orchestration: Customer starts conference, Agent joins running conference
  // - Customer (first participant): startConferenceOnEnter=true (starts conference immediately)
  // - Agent (second participant): startConferenceOnEnter=true (joins running conference)
  // Customer waits in <Gather>, then Agent joins and immediately delivers greeting
  if (isAgent) {
    participantParams.startConferenceOnEnter = true; // Agent joins running conference
    console.log(`🎙️  Agent will join running conference and deliver greeting`);
  } else {
    participantParams.startConferenceOnEnter = true; // Customer starts conference
    console.log(`👤 Customer will start conference when they join`);
  }

  // If this is the first participant, add conference-level callbacks
  if (isFirstParticipant) {
    console.log(`📞 Setting conference-level callbacks for ${conferenceId}`);
    participantParams.conferenceStatusCallback = `https://${context.DOMAIN_NAME}/conference-status-webhook`;
    participantParams.conferenceStatusCallbackEvent = ['start', 'end', 'join', 'leave'];
    participantParams.conferenceStatusCallbackMethod = 'POST';
    participantParams.conferenceRecord = 'record-from-start';
    participantParams.conferenceRecordingStatusCallback = `https://${context.DOMAIN_NAME}/transcription-webhook`;
    participantParams.conferenceRecordingStatusCallbackEvent = ['in-progress', 'completed'];
  }

  // Create participant via Participants API
  const participantObj = await client
    .conferences(conferenceId)
    .participants.create(participantParams);

  console.log(`📥 DEBUG: Participant created, response:`);
  console.log(`  CallSid: ${participantObj.callSid}`);
  console.log(`  Label: ${participantObj.label}`);
  console.log(`  ConferenceSid: ${participantObj.conferenceSid}`);

  return participantObj.callSid;
}

// Note: Conference auto-termination
// Participants are automatically terminated after 5 minutes via timeLimit parameter
// This prevents runaway conversations and controls costs
// For manual early termination, call the conference-timer endpoint:
// POST https://DOMAIN/conference-timer with {"ConferenceSid": "CFXXXX"}
async function scheduleConferenceTermination(context, conferenceId, client) {
  const timerUrl = `https://${context.DOMAIN_NAME}/conference-timer`;
  const delayMs = 5 * 60 * 1000; // 5 minutes

  console.log(`Conference ${conferenceId} will auto-terminate after 5 minutes (timeLimit)`);
  console.log(`For early manual termination, call: ${timerUrl}?ConferenceSid=${conferenceId}`);

  // Return metadata for reference
  return {
    scheduled: true,
    method: 'timeLimit parameter on participant',
    note: 'Participants auto-terminate after 5 minutes via Twilio timeLimit',
    timerUrl: timerUrl,
    conferenceId: conferenceId,
    terminatesAt: new Date(Date.now() + delayMs).toISOString(),
  };
}

exports.handler = async function (context, event, callback) {
  const response = new Twilio.Response();
  response.appendHeader('Content-Type', 'application/json');
  response.appendHeader('Access-Control-Allow-Origin', '*');

  try {
    console.log('🎬 Starting conference creation...');

    // Select random customer-agent pair - pass context and Runtime from global scope
    const { customer, agent, conferenceId } = await selectRandomPair(
      context,
      typeof Runtime !== 'undefined' ? Runtime : null
    );

    console.log(
      `Selected pair: ${customer.CustomerName} <-> ${agent.AgentName}`
    );
    console.log(`Conference ID: ${conferenceId}`);

    const twilioClient = context.getTwilioClient();

    // Create conference by adding participants
    // Customer first - starts the conference when they join (startConferenceOnEnter=true)
    // Customer will wait in <Gather> mode for agent to join
    const customerCallSid = await addParticipantToConference(
      context,
      twilioClient,
      conferenceId,
      customer,
      'customer',
      true // isFirstParticipant - sets conference-level callbacks
    );

    // Small delay to ensure customer joins first and conference is ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Then agent - joins running conference, immediately delivers greeting
    const agentCallSid = await addParticipantToConference(
      context,
      twilioClient,
      conferenceId,
      agent,
      'agent',
      false // not first participant
    );

    // Schedule 5-minute termination
    const timer = await scheduleConferenceTermination(context, conferenceId, twilioClient);

    const result = {
      success: true,
      conferenceId: conferenceId,
      customer: {
        name: customer.CustomerName,
        callSid: customerCallSid,
        phone: customer.CustomerPhoneNumber,
      },
      agent: {
        name: agent.AgentName,
        callSid: agentCallSid,
        phone: agent.AgentPhoneNumber,
      },
      timer: timer,
      timestamp: new Date().toISOString(),
    };

    console.log('✅ Conference created successfully');
    console.log(JSON.stringify(result, null, 2));

    response.setStatusCode(201);
    response.setBody(result);
    callback(null, response);
  } catch (error) {
    console.error('❌ Error creating conference:', error.message);
    console.error(error.stack);

    response.setStatusCode(500);
    response.setBody({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
    callback(null, response);
  }
};
