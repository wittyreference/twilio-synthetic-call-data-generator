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
  const twiml = new Twilio.twiml.VoiceResponse();

  // Extract conversation parameters
  const params = extractConversationParams(event);

  console.log(
    `📞 Voice handler called for ${params.role}: ${params.persona} in conference ${params.conferenceId}`
  );

  // Redirect to transcribe function to start the conversation loop
  // Only mark as first call for AGENT (so they speak greeting)
  // Customer starts in listen mode (isFirstCall=false means they use <Gather>)
  const transcribeUrl = buildFunctionUrl('transcribe', {
    role: params.role,
    persona: params.persona,
    conferenceId: params.conferenceId,
    isFirstCall: params.role === 'agent' ? 'true' : 'false',
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
};
