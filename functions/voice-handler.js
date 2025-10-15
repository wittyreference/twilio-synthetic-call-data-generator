// ABOUTME: Initial TwiML handler for AI participant calls - routes to transcribe function
// ABOUTME: Receives incoming calls to the TwiML Application and starts the conversation loop

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
    const twiml = new Twilio.twiml.VoiceResponse();

    // NEW: Check if we have a syncKey (new method) or old parameters (legacy)
    const syncKey = event.syncKey;

    let params;

    if (syncKey) {
      // NEW METHOD: Fetch participant data from Sync
      console.log(`📦 Fetching participant data from Sync: ${syncKey}`);

      const client = context.getTwilioClient();
      const syncServiceSid = context.SYNC_SERVICE_SID || context.TWILIO_SYNC_SERVICE_SID;

      if (!syncServiceSid) {
        throw new Error('SYNC_SERVICE_SID or TWILIO_SYNC_SERVICE_SID must be set in environment');
      }

      const syncDoc = await client.sync.v1
        .services(syncServiceSid)
        .documents(syncKey)
        .fetch();

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

    // Redirect to transcribe function to start the conversation loop
    // Only mark as first call for AGENT (so they speak greeting)
    // Customer starts in listen mode (isFirstCall=false means they use <Gather>)
    const transcribeUrl = buildFunctionUrl('transcribe', {
      role: params.role,
      persona: params.persona,
      conferenceId: params.conferenceId,
      isFirstCall: params.role === 'agent' ? 'true' : 'false',
      syncKey: syncKey, // Pass syncKey along for subsequent calls
    });

    twiml.redirect(
      {
        method: 'POST',
      },
      transcribeUrl
    );

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
