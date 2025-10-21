// ABOUTME: Captures speech input using <Gather> and sends to /respond function
// ABOUTME: Uses Twilio's speech recognition to transcribe participant audio

// ⚠️ LOCKED FILE - DO NOT MODIFY WITHOUT MC'S EXPLICIT AUTHORIZATION ⚠️
// This file controls speech recognition and <Gather> logic which is WORKING correctly.
// See docs/CALL-INFRASTRUCTURE-LOCKDOWN.md for details.
// Any modifications require MC to say: "I AUTHORIZE YOU TO MODIFY transcribe.js"

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
  if (event.shouldDeliverIntroduction === 'true' && params.role === 'agent') {
    console.log(`🎙️  DEBUG: Agent should deliver introduction - speaking first`);
    const persona = await loadPersona(params.role, params.persona, context);
    const introduction = persona
      ? persona.introduction
      : 'Hello, how can I help you today?';

    console.log(`📢 DEBUG: Agent introduction: "${introduction.substring(0, 50)}..."`);

    // Agent speaks first, then redirects to listen mode (no <Gather> on first turn)
    // Add 2-second pause before greeting to avoid race conditions
    twiml.pause({ length: 2 });
    twiml.say({ voice: 'Polly.Joanna-Neural' }, introduction);

    const transcribeUrl = buildFunctionUrl('transcribe', {
      role: params.role,
      persona: params.persona,
      conferenceId: params.conferenceId,
      shouldDeliverIntroduction: 'false', // Already delivered, now listen
    });

    console.log(`🔄 DEBUG: Agent redirecting to listen mode: ${transcribeUrl}`);
    twiml.redirect({ method: 'POST' }, transcribeUrl);
  } else {
    // NORMAL TURN: Listen for speech
    // Use <Gather> to capture speech with enhanced speech model
    console.log(`👂 DEBUG: ${params.role} entering <Gather> mode (listening for speech)`);
    const gather = twiml.gather({
      input: 'speech',
      action: respondUrl,
      method: 'POST',
      speechTimeout: 'auto',
      speechModel: 'experimental_conversations',
      // Note: enhanced=true only works with speechModel='phone_call'
      // experimental_conversations model doesn't support enhanced
      profanityFilter: false,
    });

    console.log(`🔗 DEBUG: <Gather> action URL: ${respondUrl}`);

    // If no speech detected, redirect back to transcribe
    const transcribeUrl = buildFunctionUrl('transcribe', {
      role: params.role,
      persona: params.persona,
      conferenceId: params.conferenceId,
    });

    console.log(`🔄 DEBUG: No speech fallback redirects to: ${transcribeUrl}`);

    twiml.redirect(
      {
        method: 'POST',
      },
      transcribeUrl
    );
  }

  console.log(`✅ DEBUG: Transcribe complete - TwiML length: ${twiml.toString().length} chars`);

  const response = new Twilio.Response();
  response.appendHeader('Content-Type', 'text/xml');
  response.setBody(twiml.toString());

  callback(null, response);
};
