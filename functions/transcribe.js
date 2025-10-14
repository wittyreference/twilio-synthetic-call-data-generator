// ABOUTME: Captures speech input using <Gather> and sends to /respond function
// ABOUTME: Uses Twilio's speech recognition to transcribe participant audio

const personaPath = Runtime.getFunctions()['utils/persona-loader'].path;
const { loadPersona } = require(personaPath);

const urlPath = Runtime.getFunctions()['utils/url-builder'].path;
const { buildFunctionUrl, extractConversationParams } = require(urlPath);

const validatorPath = Runtime.getFunctions()['utils/webhook-validator'].path;
const { validateOrReject } = require(validatorPath);

exports.handler = async function (context, event, callback) {
  // Validate webhook signature
  if (!validateOrReject(context, event, callback)) {
    return; // Validation failed, callback already called
  }
  const twiml = new Twilio.twiml.VoiceResponse();

  // Extract conversation parameters (no conversationHistory in params anymore - stored in Sync)
  const params = extractConversationParams(event);

  console.log(`🎤 Transcribe function called for ${params.role}: ${params.persona}`);

  // Build respond URL (only basic params - history retrieved from Sync)
  const respondUrl = buildFunctionUrl('respond', {
    role: params.role,
    persona: params.persona,
    conferenceId: params.conferenceId,
  });

  // AGENT FIRST TURN: Speak greeting without listening
  // This allows the customer to hear the agent first, then respond
  if (event.isFirstCall === 'true' && params.role === 'agent') {
    const persona = await loadPersona(params.role, params.persona, context);
    const introduction = persona
      ? persona.introduction
      : 'Hello, how can I help you today?';

    // Agent speaks first, then redirects to listen mode (no <Gather> on first turn)
    twiml.say({ voice: 'Polly.Joanna-Neural' }, introduction);

    const transcribeUrl = buildFunctionUrl('transcribe', {
      role: params.role,
      persona: params.persona,
      conferenceId: params.conferenceId,
      isFirstCall: 'false', // Mark as no longer first call
    });

    twiml.redirect({ method: 'POST' }, transcribeUrl);
  } else {
    // NORMAL TURN: Listen for speech
    // Use <Gather> to capture speech with enhanced speech model
    const gather = twiml.gather({
      input: 'speech',
      action: respondUrl,
      method: 'POST',
      speechTimeout: 'auto',
      speechModel: 'experimental_conversations',
      enhanced: true,
      profanityFilter: false,
    });

    // If no speech detected, redirect back to transcribe
    const transcribeUrl = buildFunctionUrl('transcribe', {
      role: params.role,
      persona: params.persona,
      conferenceId: params.conferenceId,
    });

    twiml.redirect(
      {
        method: 'POST',
      },
      transcribeUrl
    );
  }

  const response = new Twilio.Response();
  response.appendHeader('Content-Type', 'text/xml');
  response.setBody(twiml.toString());

  callback(null, response);
};
