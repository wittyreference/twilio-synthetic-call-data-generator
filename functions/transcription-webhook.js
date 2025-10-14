// ABOUTME: Webhook handler for Twilio transcription callbacks with sentiment analysis
// ABOUTME: Processes transcription results and extracts analytics like sentiment, resolution, and escalation

// Runtime-aware require for Twilio Functions
const getErrorUtils = () => {
  if (typeof Runtime !== 'undefined' && Runtime.getFunctions) {
    return require(Runtime.getFunctions()['utils/error-utils'].path);
  }
  return require('./utils/error-utils');
};

const { createErrorContext, logStructuredError } = getErrorUtils();

// Webhook validator
const getWebhookValidator = () => {
  if (typeof Runtime !== 'undefined' && Runtime.getFunctions) {
    return require(Runtime.getFunctions()['utils/webhook-validator'].path);
  }
  return require('./utils/webhook-validator');
};

const { validateOrReject } = getWebhookValidator();

exports.handler = function (context, event, callback) {
  // Validate webhook signature
  if (!validateOrReject(context, event, callback)) {
    return; // Validation failed, callback already called
  }

  try {
    // Validate required fields
    if (!event || !event.TranscriptionSid) {
      console.error('Missing required TranscriptionSid');
      return callback(null, {
        success: false,
        error: 'Missing required field: TranscriptionSid',
      });
    }

    const transcriptionSid = event.TranscriptionSid;
    const transcriptionStatus = event.TranscriptionStatus;
    const transcriptionText = event.TranscriptionText || '';
    const recordingSid = event.RecordingSid;
    const callSid = event.CallSid;

    console.log(
      `Processing transcription ${transcriptionSid} with status: ${transcriptionStatus}`
    );

    if (transcriptionText) {
      console.log(`Transcription text: ${transcriptionText}`);
    }

    // Perform sentiment analysis
    const analytics = analyzeTranscription(transcriptionText);

    // Parse AddOns if present
    if (event.AddOns) {
      try {
        const addOns =
          typeof event.AddOns === 'string'
            ? JSON.parse(event.AddOns)
            : event.AddOns;

        if (addOns.results && addOns.results.language_operator) {
          console.log('Language Operator results detected');
          // Language Operator data is available but we'll use our own analytics
        }
      } catch (parseError) {
        console.error('Error parsing AddOns:', parseError.message);
      }
    }

    const response = {
      success: true,
      transcriptionSid: transcriptionSid,
      transcriptionText: event.TranscriptionText,
      recordingSid: recordingSid,
      callSid: callSid,
      analytics: analytics,
      timestamp: new Date().toISOString(),
    };

    callback(null, response);
  } catch (error) {
    // Enhanced structured error logging with context
    const errorContext = createErrorContext({
      functionName: 'transcription-webhook',
      operation: 'transcription processing',
      transcriptionSid: event.TranscriptionSid,
      callSid: event.CallSid,
      recordingSid: event.RecordingSid,
      additionalContext: {
        transcriptionStatus: event.TranscriptionStatus,
      },
    });

    logStructuredError(error, errorContext);

    callback(null, {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};

function analyzeTranscription(text) {
  if (!text) {
    return {
      sentiment: 'neutral',
      resolution: 'unknown',
      escalation: false,
      wordCount: 0,
    };
  }

  const lowerText = text.toLowerCase();

  // Sentiment analysis
  const positiveKeywords = [
    'thank',
    'great',
    'happy',
    'excellent',
    'wonderful',
    'appreciate',
    'pleased',
    'satisfied',
  ];
  const negativeKeywords = [
    'terrible',
    'frustrated',
    'angry',
    'awful',
    'horrible',
    'disappointed',
    'upset',
    'worst',
  ];

  let positiveCount = 0;
  let negativeCount = 0;

  positiveKeywords.forEach(keyword => {
    if (lowerText.includes(keyword)) positiveCount++;
  });

  negativeKeywords.forEach(keyword => {
    if (lowerText.includes(keyword)) negativeCount++;
  });

  let sentiment = 'neutral';
  if (positiveCount > negativeCount) {
    sentiment = 'positive';
  } else if (negativeCount > positiveCount) {
    sentiment = 'negative';
  }

  // Resolution detection
  const resolvedKeywords = [
    'resolved',
    'solved',
    'fixed',
    'working now',
    'problem is solved',
  ];
  const unresolvedKeywords = [
    'not working',
    'still',
    'persists',
    'remains',
    'issue remains',
  ];

  let resolution = 'unknown';
  let resolvedCount = 0;
  let unresolvedCount = 0;

  resolvedKeywords.forEach(keyword => {
    if (lowerText.includes(keyword)) resolvedCount++;
  });

  unresolvedKeywords.forEach(keyword => {
    if (lowerText.includes(keyword)) unresolvedCount++;
  });

  if (resolvedCount > unresolvedCount) {
    resolution = 'resolved';
  } else if (unresolvedCount > resolvedCount) {
    resolution = 'unresolved';
  }

  // Escalation detection
  const escalationKeywords = [
    'supervisor',
    'manager',
    'transfer',
    'speak to',
    'escalate',
    'demand',
  ];
  let escalation = false;

  escalationKeywords.forEach(keyword => {
    if (lowerText.includes(keyword)) {
      escalation = true;
    }
  });

  // Word count
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  return {
    sentiment,
    resolution,
    escalation,
    wordCount,
  };
}
