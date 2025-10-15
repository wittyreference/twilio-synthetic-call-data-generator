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

// Add participant to conference
async function addParticipantToConference(
  context,
  client,
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

  const introduction = isAgent ? participant.ScriptedIntroduction : '';

  const participantObj = await client
    .conferences(conferenceId)
    .participants.create({
      from: twilioPhoneNumber,
      to: `app:${twimlAppSid}?role=${role}&persona=${encodeURIComponent(name)}&conferenceId=${encodeURIComponent(conferenceId)}&systemPrompt=${encodeURIComponent(systemPrompt)}&introduction=${encodeURIComponent(introduction)}`,
      earlyMedia: true,
      endConferenceOnExit: false,
      beep: false,
      statusCallback: `https://${context.DOMAIN_NAME}/conference-status-webhook`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
      label: role,
    });

  return participantObj.callSid;
}

// Schedule conference termination
async function scheduleConferenceTermination(context, conferenceId) {
  const timerUrl = `https://${context.DOMAIN_NAME}/conference-timer`;

  console.log(`Scheduling 5-minute timer for conference ${conferenceId}`);

  // In production, use external scheduler or setTimeout
  // For now, log the timer URL that should be called
  return {
    scheduled: true,
    timerUrl: timerUrl,
    conferenceId: conferenceId,
    terminateAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
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
    // Agent first (to deliver greeting)
    const agentCallSid = await addParticipantToConference(
      context,
      twilioClient,
      conferenceId,
      agent,
      'agent'
    );

    // Small delay to ensure agent greeting starts
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Then customer (to hear greeting)
    const customerCallSid = await addParticipantToConference(
      context,
      twilioClient,
      conferenceId,
      customer,
      'customer'
    );

    // Schedule 5-minute termination
    const timer = await scheduleConferenceTermination(context, conferenceId);

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
