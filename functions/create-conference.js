// ABOUTME: Serverless function to create synthetic conferences with customer-agent pairs
// ABOUTME: Uses conference orchestration logic to create real Twilio calls with AI participants

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

  const twilioPhoneNumber =
    context.AGENT_PHONE_NUMBER || context.TWILIO_PHONE_NUMBER;
  const twimlAppSid = context.TWIML_APP_SID;

  if (!twilioPhoneNumber) {
    throw new Error(
      'AGENT_PHONE_NUMBER or TWILIO_PHONE_NUMBER must be set in environment'
    );
  }

  if (!twimlAppSid) {
    throw new Error('TWIML_APP_SID must be set in environment');
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
  const participantParams = {
    from: twilioPhoneNumber,
    to: `app:${twimlAppSid}?syncKey=${encodeURIComponent(syncKey)}`,
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

  // Pass only the reference key in URL (much shorter!)
  const participantObj = await client
    .conferences(conferenceId)
    .participants.create(participantParams);

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
    // Agent first - this will create the conference and set callbacks
    // Agent will wait in silence for conference-start event
    const agentCallSid = await addParticipantToConference(
      context,
      twilioClient,
      conferenceId,
      agent,
      'agent',
      true // isFirstParticipant - sets conference-level callbacks
    );

    // Small delay to ensure agent joins first
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Then customer - when they join, conference-start fires
    const customerCallSid = await addParticipantToConference(
      context,
      twilioClient,
      conferenceId,
      customer,
      'customer',
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
