// ABOUTME: Sends transcribed speech to OpenAI and returns AI response as TwiML
// ABOUTME: Maintains conversation history and loops back to /transcribe for continuous dialogue

const { OpenAI } = require('openai');
const personaPath = Runtime.getFunctions()['utils/persona-loader'].path;
const { loadPersona } = require(personaPath);

const urlPath = Runtime.getFunctions()['utils/url-builder'].path;
const { buildFunctionUrl, extractConversationParams } = require(urlPath);

const validatorPath = Runtime.getFunctions()['utils/webhook-validator'].path;
const { validateOrReject } = require(validatorPath);

const conversationValidatorPath =
  Runtime.getFunctions()['utils/conversation-validator'].path;
const {
  validateConversationHistory,
  validateMessagesForOpenAI,
  sanitizeUserMessage,
} = require(conversationValidatorPath);

const syncManagerPath = Runtime.getFunctions()['utils/sync-manager'].path;
const { checkRateLimit, getConversationHistory, storeConversationHistory } =
  require(syncManagerPath);

exports.handler = async function (context, event, callback) {
  // Validate webhook signature
  if (!validateOrReject(context, event, callback)) {
    return; // Validation failed, callback already called
  }
  const twiml = new Twilio.twiml.VoiceResponse();

  // Extract conversation parameters
  const params = extractConversationParams(event);
  const speechResult = event.SpeechResult || '';

  // Check rate limit (1000 calls/day default - configurable via MAX_DAILY_CALLS env var)
  const maxDailyCalls = parseInt(context.MAX_DAILY_CALLS || '1000');
  const rateLimitResult = await checkRateLimit(context, maxDailyCalls);

  if (!rateLimitResult.allowed) {
    console.error(
      `❌ RATE LIMIT EXCEEDED: ${rateLimitResult.currentCount}/${rateLimitResult.limit} calls today`
    );
    twiml.say(
      { voice: 'Polly.Joanna-Neural' },
      'I apologize, but the service has reached its daily usage limit. Please try again tomorrow.'
    );
    twiml.hangup();

    const response = new Twilio.Response();
    response.appendHeader('Content-Type', 'text/xml');
    response.setBody(twiml.toString());
    return callback(null, response);
  }

  console.log(`💬 Respond function called for ${params.role}: ${params.persona}`);
  console.log(`   Speech detected: "${speechResult}"`);

  if (!speechResult) {
    console.log('⚠️  No speech detected, redirecting to transcribe');
    const transcribeUrl = buildFunctionUrl('transcribe', params);
    twiml.redirect(
      {
        method: 'POST',
      },
      transcribeUrl
    );

    const response = new Twilio.Response();
    response.appendHeader('Content-Type', 'text/xml');
    response.setBody(twiml.toString());
    return callback(null, response);
  }

  try {
    // Load persona data
    const persona = await loadPersona(params.role, params.persona, context);
    if (!persona) {
      console.error(`❌ Persona not found: ${params.role}/${params.persona}`);
      twiml.say(
        { voice: 'Polly.Joanna-Neural' },
        'I apologize, but there was an error loading my configuration. Please contact support.'
      );
      const transcribeUrl = buildFunctionUrl('transcribe', params);
      twiml.redirect({ method: 'POST' }, transcribeUrl);

      const response = new Twilio.Response();
      response.appendHeader('Content-Type', 'text/xml');
      response.setBody(twiml.toString());
      return callback(null, response);
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: context.OPENAI_API_KEY,
    });

    // Retrieve conversation history from Sync (using conferenceId as conversation ID)
    const conversationId = params.conferenceId;
    let existingHistory = [];

    try {
      existingHistory = await getConversationHistory(context, conversationId);
    } catch (error) {
      console.warn(
        `⚠️  Failed to retrieve conversation history from Sync: ${error.message}`
      );
      // Continue with empty history - conversation will start fresh
    }

    // Validate existing history (prevent tampering/corruption)
    const historyValidation = validateConversationHistory(
      JSON.stringify(existingHistory),
      false // Don't allow system prompts from Sync - we set our own
    );

    if (!historyValidation.valid) {
      console.error(
        `❌ SECURITY: Invalid conversation history from Sync: ${historyValidation.error}`
      );
      // Start fresh conversation - clear corrupted history
      existingHistory = [];
    }

    // Build message array with system prompt + validated history
    const systemPrompt = persona.systemPrompt;
    let messages = [
      {
        role: 'system',
        content: systemPrompt,
      },
      ...(historyValidation.valid ? historyValidation.messages : []),
    ];

    // Sanitize and add user message
    const sanitizedSpeech = sanitizeUserMessage(speechResult);
    messages.push({
      role: 'user',
      content: sanitizedSpeech,
    });

    // Final validation before sending to OpenAI
    const messagesValidation = validateMessagesForOpenAI(messages);
    if (!messagesValidation.valid) {
      console.error(
        `❌ SECURITY: Invalid messages for OpenAI: ${messagesValidation.error}`
      );
      throw new Error('Invalid message structure');
    }

    // Get OpenAI response
    console.log(`🤖 Sending to OpenAI with ${messages.length} messages`);
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages,
      temperature: 0.7,
      max_tokens: 150,
    });

    const aiResponse = completion.choices[0].message.content;
    console.log(`✅ OpenAI response: "${aiResponse}"`);

    // Add assistant message to history
    messages.push({
      role: 'assistant',
      content: aiResponse,
    });

    // Save history to Sync WITHOUT system prompt (to prevent injection)
    // We'll re-add system prompt on next call
    const historyWithoutSystem = messages.filter(
      (msg) => msg.role !== 'system'
    );

    try {
      await storeConversationHistory(
        context,
        conversationId,
        historyWithoutSystem
      );
    } catch (error) {
      console.error(
        `⚠️  Failed to store conversation history in Sync: ${error.message}`
      );
      // Continue anyway - conversation can proceed without persisted history
    }

    // Build redirect URL (no conversation history in URL anymore!)
    const transcribeUrl = buildFunctionUrl('transcribe', {
      role: params.role,
      persona: params.persona,
      conferenceId: params.conferenceId,
    });

    // Say the response and redirect back to transcribe
    twiml.say({ voice: 'Polly.Joanna-Neural' }, aiResponse);
    twiml.redirect({ method: 'POST' }, transcribeUrl);
  } catch (error) {
    console.error('❌ Error in respond function:', error);

    // Provide specific error messages based on error type
    let errorMessage = 'I apologize, but I am experiencing technical difficulties. Please try again.';

    if (error.message && error.message.includes('API key')) {
      errorMessage = 'I apologize, but my AI service is not configured correctly. Please contact support.';
      console.error('❌ OpenAI API key missing or invalid');
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      errorMessage = 'I apologize, but I am unable to reach my AI service. Please try again in a moment.';
      console.error(`❌ Network error: ${error.code}`);
    } else if (error.status === 429) {
      errorMessage = 'I apologize, but my AI service is currently overloaded. Please try again shortly.';
      console.error('❌ OpenAI rate limit exceeded');
    }

    twiml.say({ voice: 'Polly.Joanna-Neural' }, errorMessage);

    // Build redirect URL (no conversation history in URL)
    const transcribeUrl = buildFunctionUrl('transcribe', {
      role: params.role,
      persona: params.persona,
      conferenceId: params.conferenceId,
    });
    twiml.redirect({ method: 'POST' }, transcribeUrl);
  }

  const response = new Twilio.Response();
  response.appendHeader('Content-Type', 'text/xml');
  response.setBody(twiml.toString());

  callback(null, response);
};
