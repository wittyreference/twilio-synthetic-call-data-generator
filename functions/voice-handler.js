// ABOUTME: Initial TwiML handler for AI participant calls - routes to transcribe function
// ABOUTME: Receives incoming calls to the TwiML Application and starts the conversation loop

// ⚠️ LOCKED FILE - DO NOT MODIFY WITHOUT MC'S EXPLICIT AUTHORIZATION ⚠️
// This file controls initial call routing which is WORKING correctly.
// See docs/CALL-INFRASTRUCTURE-LOCKDOWN.md for details.
// Any modifications require MC to say: "I AUTHORIZE YOU TO MODIFY voice-handler.js"

const urlBuilderPath = Runtime.getFunctions()['utils/url-builder'].path;
const { buildFunctionUrl, extractConversationParams } = require(urlBuilderPath);

const validatorPath = Runtime.getFunctions()['utils/webhook-validator'].path;
const { validateOrReject } = require(validatorPath);

exports.handler = async function (context, event, callback) {
  // Validate webhook signature
  if (!validateOrReject(context, event, callback)) {
    return; // Validation failed, callback already called
  }

  try {
    // CRITICAL: Twilio sends parameters in snake_case (sync_key, conference_id, role)
    // NOT camelCase (syncKey, conferenceId, role) - this was the root cause!
    console.log(`🔍 DEBUG: voice-handler received event keys: ${Object.keys(event).join(', ')}`);
    console.log(`🔍 DEBUG: event.sync_key = ${event.sync_key}`);
    console.log(`🔍 DEBUG: event.conference_id = ${event.conference_id}`);
    console.log(`🔍 DEBUG: event.role = ${event.role}`);

    const twiml = new Twilio.twiml.VoiceResponse();

    // NEW: Derive syncKey from conference context
    // When participants join via TwiML App, Twilio doesn't pass custom params
    // Instead, we derive syncKey from: FriendlyName (conferenceId) + CallSid label lookup
    // CRITICAL: Twilio sends parameters as snake_case (sync_key), not camelCase (syncKey)
    let syncKey = event.sync_key; // Try direct param first (passed from create-conference)

    if (!syncKey && event.ConferenceSid) {
      // We're in a conference - fetch conference details to get FriendlyName
      console.log(`🔍 DEBUG: Fetching conference details for ${event.ConferenceSid}`);
      const client = context.getTwilioClient();
      const conference = await client.conferences(event.ConferenceSid).fetch();
      const conferenceId = conference.friendlyName;

      // Get participant label (role) from the call
      const participants = await client.conferences(event.ConferenceSid).participants.list();
      const thisParticipant = participants.find(p => p.callSid === event.CallSid);
      const role = thisParticipant ? thisParticipant.label : 'unknown';

      syncKey = `${conferenceId}_${role}`;
      console.log(`🔍 DEBUG: Derived syncKey from conference: ${syncKey}`);
    }

    console.log(`🔍 DEBUG: Final syncKey = ${syncKey}`);

    let params;

    if (syncKey) {
      // NEW METHOD: Fetch participant data from Sync
      console.log(`📦 DEBUG: Fetching participant data from Sync: ${syncKey}`);

      const client = context.getTwilioClient();
      const syncServiceSid = context.SYNC_SERVICE_SID || context.TWILIO_SYNC_SERVICE_SID;

      console.log(`🔍 DEBUG: Sync Service SID = ${syncServiceSid}`);

      if (!syncServiceSid) {
        console.error(`❌ DEBUG: No Sync Service SID found in environment!`);
        throw new Error('SYNC_SERVICE_SID or TWILIO_SYNC_SERVICE_SID must be set in environment');
      }

      console.log(`🔍 DEBUG: Attempting to fetch Sync document...`);
      const syncDoc = await client.sync.v1
        .services(syncServiceSid)
        .documents(syncKey)
        .fetch();

      console.log(`✅ DEBUG: Successfully fetched Sync document`);

      const data = syncDoc.data;

      params = {
        role: data.role,
        persona: data.name,
        conferenceId: syncKey.split('_')[0], // Extract conferenceId from key
        systemPrompt: data.systemPrompt,
        introduction: data.introduction,
      };

      console.log(
        `📞 Voice handler called for ${params.role}: ${params.persona} (from Sync)`
      );
    } else {
      // LEGACY METHOD: Extract parameters from URL (backwards compatibility)
      params = extractConversationParams(event);

      console.log(
        `📞 Voice handler called for ${params.role}: ${params.persona} (legacy)`
      );
    }

    // Build transcribe URL with parameters
    // For agent's first call, set shouldDeliverIntroduction=true so they speak first
    // IMPORTANT: Only pass minimal params - transcribe loads persona data from Sync itself
    // Do NOT pass systemPrompt or introduction (they're huge and bloat the URL)
    const transcribeParams = {
      role: params.role,
      persona: params.persona,
      conferenceId: params.conferenceId,
      shouldDeliverIntroduction: params.role === 'agent' ? 'true' : 'false',
    };

    console.log(`🔍 DEBUG: transcribeParams = ${JSON.stringify(transcribeParams)}`);
    const transcribeUrl = buildFunctionUrl('transcribe', transcribeParams);
    console.log(`📞 Voice handler redirecting to transcribe for ${params.role}: ${params.persona}`);
    console.log(`🔗 Transcribe URL: ${transcribeUrl}`);

    // Redirect to transcribe function to start conversation
    twiml.redirect({ method: 'POST' }, transcribeUrl);

    const response = new Twilio.Response();
    response.appendHeader('Content-Type', 'text/xml');
    response.setBody(twiml.toString());

    callback(null, response);
  } catch (error) {
    console.error('❌ Error in voice-handler:', error.message);

    const response = new Twilio.Response();
    response.appendHeader('Content-Type', 'text/xml');
    response.setStatusCode(500);

    const twiml = new Twilio.twiml.VoiceResponse();
    twiml.say('We encountered an error. Please try again later.');
    twiml.hangup();

    response.setBody(twiml.toString());
    callback(null, response);
  }
};
