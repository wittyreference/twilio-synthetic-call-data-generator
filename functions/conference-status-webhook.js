// ABOUTME: Twilio serverless function to handle conference status callbacks
// ABOUTME: Processes conference-end, participant-leave, recording-completed, and call-ended events

// Runtime-aware require for Twilio Functions
const getErrorUtils = () => {
  if (typeof Runtime !== 'undefined' && Runtime.getFunctions) {
    return require(Runtime.getFunctions()['utils/error-utils'].path);
  }
  return require('./utils/error-utils');
};

const {
  retryWithBackoff,
  CircuitBreaker,
  createErrorContext,
  logStructuredError,
} = getErrorUtils();

// Webhook validator
const getWebhookValidator = () => {
  if (typeof Runtime !== 'undefined' && Runtime.getFunctions) {
    return require(Runtime.getFunctions()['utils/webhook-validator'].path);
  }
  return require('./utils/webhook-validator');
};

const { validateOrReject } = getWebhookValidator();

// Circuit breaker for Voice Intelligence service
const voiceIntelligenceCircuit = new CircuitBreaker('VoiceIntelligence', {
  failureThreshold: 3,
  resetTimeout: 30000, // 30 seconds
});

/**
 * Conference Status Webhook Handler
 *
 * Handles status callbacks from Twilio conferences, calls, and recordings.
 *
 * Expected events:
 * - conference-end: When a conference ends
 * - participant-leave: When a participant leaves a conference
 * - recording-completed: When a conference recording is completed
 * - call-ended: When an individual call ends
 *
 * @param {object} context - Twilio serverless context
 * @param {object} event - Event data from Twilio status callback
 * @param {function} callback - Callback function to return response
 */
exports.handler = async function (context, event, callback) {
  // Validate webhook signature
  if (!validateOrReject(context, event, callback)) {
    return; // Validation failed, callback already called
  }

  try {
    // Validate event has StatusCallbackEvent
    if (!event || !event.StatusCallbackEvent) {
      console.error('❌ Missing StatusCallbackEvent in webhook payload');
      return callback(null, {
        success: false,
        error: 'StatusCallbackEvent is required',
        timestamp: new Date().toISOString(),
      });
    }

    const eventType = event.StatusCallbackEvent;
    const timestamp = new Date().toISOString();

    console.log(`📞 Received webhook event: ${eventType}`);
    console.log(`⏰ Timestamp: ${timestamp}`);

    // Handle different event types
    let response = {
      success: true,
      event: eventType,
      timestamp,
    };

    switch (eventType) {
      case 'conference-start':
        response = await handleConferenceStart(context, event, timestamp);
        break;

      case 'conference-end':
        response = handleConferenceEnd(event, timestamp);
        break;

      case 'participant-join':
        response = await handleParticipantJoin(context, event, timestamp);
        break;

      case 'participant-leave':
        response = handleParticipantLeave(event, timestamp);
        break;

      case 'recording-completed':
        response = await handleRecordingCompleted(context, event, timestamp);
        break;

      case 'call-ended':
        response = handleCallEnded(event, timestamp);
        break;

      default:
        console.log(`⚠️  Unknown event type: ${eventType}`);
        response = {
          success: true,
          event: eventType,
          message: 'Unknown event type processed',
          timestamp,
        };
    }

    // Return successful response
    callback(null, response);
  } catch (error) {
    // Enhanced structured error logging with context
    const errorContext = createErrorContext({
      functionName: 'conference-status-webhook',
      operation: event.StatusCallbackEvent,
      conferenceSid: event.ConferenceSid,
      callSid: event.CallSid,
      recordingSid: event.RecordingSid,
    });

    logStructuredError(error, errorContext);

    callback(null, {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Handles conference-end events
 */
function handleConferenceEnd(event, timestamp) {
  const conferenceSid = event.ConferenceSid;
  const friendlyName = event.FriendlyName;
  const duration = event.Duration;

  console.log(`✅ Conference ended: ${conferenceSid}`);
  if (friendlyName) {
    console.log(`   Name: ${friendlyName}`);
  }
  if (duration) {
    console.log(`   Duration: ${duration} seconds`);
  }

  return {
    success: true,
    event: 'conference-end',
    conferenceSid,
    friendlyName,
    duration,
    timestamp,
  };
}

/**
 * Handles participant-leave events
 */
function handleParticipantLeave(event, timestamp) {
  const conferenceSid = event.ConferenceSid;
  const callSid = event.CallSid;
  const participantLabel = event.ParticipantLabel;

  console.log(`👋 Participant left conference: ${conferenceSid}`);
  console.log(`   Call SID: ${callSid}`);
  if (participantLabel) {
    console.log(`   Label: ${participantLabel}`);
  }

  return {
    success: true,
    event: 'participant-leave',
    conferenceSid,
    callSid,
    participantLabel,
    timestamp,
  };
}

/**
 * Handles recording-completed events
 * Creates a Voice Intelligence transcript for the recording
 */
async function handleRecordingCompleted(context, event, timestamp) {
  const recordingSid = event.RecordingSid;
  const recordingUrl = event.RecordingUrl;
  const conferenceSid = event.ConferenceSid;
  const duration = event.Duration;
  const recordingStatus = event.RecordingStatus;

  console.log(`🎙️  Recording completed: ${recordingSid}`);
  if (conferenceSid) {
    console.log(`   Conference: ${conferenceSid}`);
  }
  if (duration) {
    console.log(`   Duration: ${duration} seconds`);
  }
  if (recordingUrl) {
    console.log(`   URL: ${recordingUrl}`);
  }
  if (recordingStatus) {
    console.log(`   Status: ${recordingStatus}`);
  }

  // Create Voice Intelligence transcript with retry logic and circuit breaker
  try {
    const twilioClient = context.getTwilioClient();
    const voiceIntelligenceSid =
      context.VOICE_INTELLIGENCE_SID || process.env.VOICE_INTELLIGENCE_SID;

    if (!voiceIntelligenceSid) {
      console.warn(
        '⚠️  VOICE_INTELLIGENCE_SID not configured - skipping transcription'
      );
    } else {
      console.log(
        `🧠 Creating Voice Intelligence transcript for recording ${recordingSid}...`
      );

      // Use circuit breaker with fallback
      const transcript = await voiceIntelligenceCircuit.execute(
        async () => {
          // Retry with exponential backoff
          return await retryWithBackoff(
            async () => {
              return await twilioClient.intelligence.v2
                .services(voiceIntelligenceSid)
                .transcripts.create({
                  serviceSid: voiceIntelligenceSid,
                  channel: {
                    media_properties: {
                      media_url: `https://api.twilio.com${recordingUrl}`,
                    },
                  },
                });
            },
            {
              maxAttempts: 3,
              baseDelay: 1000,
              operationName: 'Voice Intelligence transcript creation',
            }
          );
        },
        // Fallback: skip transcription if Voice Intelligence is down
        () => {
          console.warn(
            '⚠️  Voice Intelligence circuit breaker OPEN - skipping transcription'
          );
          return null;
        }
      );

      if (transcript) {
        console.log(`✅ Transcript created: ${transcript.sid}`);

        return {
          success: true,
          event: 'recording-completed',
          recordingSid,
          recordingUrl,
          conferenceSid,
          duration,
          recordingStatus,
          transcriptSid: transcript.sid,
          timestamp,
        };
      } else {
        console.warn('⚠️  Transcript creation skipped due to circuit breaker');
      }
    }
  } catch (error) {
    // Enhanced structured error logging with context
    const errorContext = createErrorContext({
      functionName: 'conference-status-webhook',
      operation: 'Voice Intelligence transcript creation',
      recordingSid,
      conferenceSid,
      additionalContext: {
        recordingUrl,
        voiceIntelligenceCircuitState: voiceIntelligenceCircuit.getState(),
      },
    });

    logStructuredError(error, errorContext);

    // Don't fail the webhook - graceful degradation
    // Error will be captured by Debugger webhook if critical
  }

  return {
    success: true,
    event: 'recording-completed',
    recordingSid,
    recordingUrl,
    conferenceSid,
    duration,
    recordingStatus,
    timestamp,
  };
}

/**
 * Handles conference-start events
 * This fires when the conference actually begins (both participants connected)
 * We use this to signal the agent to start their greeting
 */
async function handleConferenceStart(context, event, timestamp) {
  const conferenceSid = event.ConferenceSid;
  const friendlyName = event.FriendlyName;

  console.log(`🎬 Conference started: ${conferenceSid}`);
  if (friendlyName) {
    console.log(`   Name: ${friendlyName}`);
  }

  // Find the agent participant and redirect them to start greeting
  try {
    const client = context.getTwilioClient();

    // Get all participants
    const participants = await client
      .conferences(conferenceSid)
      .participants.list();

    // Find agent (labeled as 'agent')
    const agent = participants.find(p => p.label === 'agent');

    if (agent) {
      console.log(`👤 Found agent participant: ${agent.callSid}`);
      console.log(`🎙️  Redirecting agent to start greeting...`);

      // Redirect agent's call to start greeting
      await client.calls(agent.callSid).update({
        twiml: `<Response><Redirect method="POST">https://${context.DOMAIN_NAME}/transcribe?role=agent&amp;conferenceId=${friendlyName}&amp;isFirstCall=true&amp;syncKey=${friendlyName}_agent</Redirect></Response>`,
      });

      console.log(`✅ Agent redirected to start greeting`);
    } else {
      console.warn(`⚠️  Agent participant not found in conference ${conferenceSid}`);
    }
  } catch (error) {
    console.error(`❌ Error redirecting agent:`, error);
  }

  return {
    success: true,
    event: 'conference-start',
    conferenceSid,
    friendlyName,
    timestamp,
  };
}

/**
 * Handles participant-join events
 */
async function handleParticipantJoin(context, event, timestamp) {
  const conferenceSid = event.ConferenceSid;
  const callSid = event.CallSid;
  const participantLabel = event.ParticipantLabel;

  console.log(`👋 Participant joined conference: ${conferenceSid}`);
  console.log(`   Call SID: ${callSid}`);
  if (participantLabel) {
    console.log(`   Label: ${participantLabel}`);
  }

  return {
    success: true,
    event: 'participant-join',
    conferenceSid,
    callSid,
    participantLabel,
    timestamp,
  };
}

/**
 * Handles call-ended events
 */
function handleCallEnded(event, timestamp) {
  const callSid = event.CallSid;
  const callDuration = event.CallDuration;
  const callStatus = event.CallStatus;

  console.log(`📞 Call ended: ${callSid}`);
  if (callDuration) {
    console.log(`   Duration: ${callDuration} seconds`);
  }
  if (callStatus) {
    console.log(`   Status: ${callStatus}`);
  }

  return {
    success: true,
    event: 'call-ended',
    callSid,
    callDuration,
    callStatus,
    timestamp,
  };
}
