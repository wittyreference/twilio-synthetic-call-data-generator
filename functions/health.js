// ABOUTME: Health check endpoint for monitoring serverless function status and dependencies
// ABOUTME: Returns service health, version info, and dependency status for monitoring systems

// Runtime-aware require for Twilio Functions
const getErrorUtils = () => {
  if (typeof Runtime !== 'undefined' && Runtime.getFunctions) {
    return require(Runtime.getFunctions()['utils/error-utils'].path);
  }
  return require('./utils/error-utils');
};

const { CircuitBreaker } = getErrorUtils();

exports.handler = async function (context, event, callback) {
  const response = new Twilio.Response();
  response.appendHeader('Content-Type', 'application/json');
  response.appendHeader('Access-Control-Allow-Origin', '*');

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'twilio-synthetic-call-data-generator',
    version: '1.0.0',
    dependencies: {
      twilio: { status: 'unknown', message: null },
      segment: { status: 'unknown', message: null },
      voiceIntelligence: { status: 'unknown', message: null },
    },
    environment: {
      hasAccountSid: !!context.ACCOUNT_SID,
      hasAuthToken: !!context.AUTH_TOKEN,
      hasSegmentKey: !!context.SEGMENT_WRITE_KEY,
      hasVoiceIntelligenceSid: !!context.VOICE_INTELLIGENCE_SID,
    },
  };

  try {
    // Check Twilio API connectivity
    const twilioClient = context.getTwilioClient();

    try {
      await twilioClient.api.accounts(context.ACCOUNT_SID).fetch();
      health.dependencies.twilio.status = 'healthy';
      health.dependencies.twilio.message = 'Connected to Twilio API';
    } catch (error) {
      health.dependencies.twilio.status = 'unhealthy';
      health.dependencies.twilio.message = error.message;
      health.status = 'degraded';
    }

    // Check Voice Intelligence service if configured
    if (context.VOICE_INTELLIGENCE_SID) {
      try {
        await twilioClient.intelligence.v2
          .services(context.VOICE_INTELLIGENCE_SID)
          .fetch();
        health.dependencies.voiceIntelligence.status = 'healthy';
        health.dependencies.voiceIntelligence.message =
          'Voice Intelligence service accessible';
      } catch (error) {
        health.dependencies.voiceIntelligence.status = 'degraded';
        health.dependencies.voiceIntelligence.message = error.message;
        health.status = 'degraded';
      }
    } else {
      health.dependencies.voiceIntelligence.status = 'not_configured';
      health.dependencies.voiceIntelligence.message =
        'VOICE_INTELLIGENCE_SID not set';
    }

    // Check Segment configuration
    if (context.SEGMENT_WRITE_KEY) {
      health.dependencies.segment.status = 'configured';
      health.dependencies.segment.message = 'Segment write key present';
    } else {
      health.dependencies.segment.status = 'not_configured';
      health.dependencies.segment.message = 'SEGMENT_WRITE_KEY not set';
      health.status = 'degraded';
    }

    // Overall health determination
    const allHealthy = Object.values(health.dependencies).every(
      dep => dep.status === 'healthy' || dep.status === 'configured'
    );

    if (!allHealthy && health.status === 'healthy') {
      health.status = 'degraded';
    }

    response.setStatusCode(health.status === 'healthy' ? 200 : 503);
    response.setBody(health);
  } catch (error) {
    console.error('❌ Health check failed:', error.message);

    health.status = 'unhealthy';
    health.error = error.message;

    response.setStatusCode(503);
    response.setBody(health);
  }

  callback(null, response);
};
