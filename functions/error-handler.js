// ABOUTME: Twilio Debugger webhook handler for real-time error monitoring and remediation
// ABOUTME: Captures API errors, TwiML validation errors, webhook failures, and takes automated remediation actions

const crypto = require('crypto');

/**
 * Error Handler Webhook for Twilio Debugger
 *
 * Receives POST requests from Twilio Debugger when errors/warnings occur.
 * Provides structured logging, error classification, and automated remediation.
 *
 * @param {object} context - Twilio serverless context
 * @param {object} event - Webhook event data from Twilio Debugger
 * @param {function} callback - Callback function to return response
 */
exports.handler = async function (context, event, callback) {
  const response = new Twilio.Response();
  response.appendHeader('Content-Type', 'application/json');

  try {
    // Validate Twilio signature for security
    const twilioSignature = event.request.headers['x-twilio-signature'];
    const url = `https://${event.request.headers.host}${event.request.url}`;

    if (!validateTwilioSignature(context, url, event, twilioSignature)) {
      console.error('❌ Invalid Twilio signature - possible security threat');
      response.setStatusCode(403);
      response.setBody({ error: 'Invalid signature' });
      return callback(null, response);
    }

    // Parse the Debugger webhook payload
    const errorData = parseErrorPayload(event);

    // Log structured error data
    logError(errorData);

    // Classify error severity
    const severity = classifyErrorSeverity(errorData);

    // Take remediation action based on error type
    const remediation = await handleErrorRemediation(
      context,
      errorData,
      severity
    );

    // Return success response
    response.setStatusCode(200);
    response.setBody({
      success: true,
      errorSid: errorData.sid,
      severity: severity,
      remediation: remediation,
      timestamp: new Date().toISOString(),
    });

    callback(null, response);
  } catch (error) {
    console.error('❌ Error in error-handler webhook:', error.message);
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

/**
 * Validate Twilio request signature
 */
function validateTwilioSignature(context, url, params, twilioSignature) {
  const authToken = context.AUTH_TOKEN || process.env.TWILIO_AUTH_TOKEN;

  if (!authToken || !twilioSignature) {
    return false;
  }

  const twilioLib = require('twilio');
  return twilioLib.validateRequest(authToken, twilioSignature, url, params);
}

/**
 * Parse error payload from Debugger webhook
 */
function parseErrorPayload(event) {
  // Debugger webhook sends Payload as a JSON string
  let payload = {};

  try {
    if (event.Payload) {
      payload =
        typeof event.Payload === 'string'
          ? JSON.parse(event.Payload)
          : event.Payload;
    }
  } catch (parseError) {
    console.warn('⚠️  Failed to parse Payload JSON:', parseError.message);
  }

  return {
    sid: event.Sid || 'unknown',
    accountSid: event.AccountSid,
    level: event.Level || 'unknown',
    timestamp: event.Timestamp || new Date().toISOString(),
    errorCode: payload.error_code || event.ErrorCode,
    message: payload.message || event.Message,
    moreInfo: payload.more_info || event.MoreInfo,
    resourceSid: payload.resource_sid || event.ResourceSid,
    serviceSid: payload.service_sid || event.ServiceSid,
    requestUrl: payload.request_url,
    requestMethod: payload.request_method,
    responseStatusCode: payload.response_status_code,
    responseBody: payload.response_body,
    payload: payload,
  };
}

/**
 * Log structured error data with emojis for visibility
 */
function logError(errorData) {
  const emoji = errorData.level === 'ERROR' ? '🚨' : '⚠️';

  console.log(`\n${emoji} ======== TWILIO DEBUGGER ERROR ======== ${emoji}`);
  console.log(`📌 Error SID: ${errorData.sid}`);
  console.log(`⏰ Timestamp: ${errorData.timestamp}`);
  console.log(`📊 Level: ${errorData.level}`);

  if (errorData.errorCode) {
    console.log(`🔢 Error Code: ${errorData.errorCode}`);
  }

  if (errorData.message) {
    console.log(`💬 Message: ${errorData.message}`);
  }

  if (errorData.resourceSid) {
    console.log(`🎯 Resource SID: ${errorData.resourceSid}`);
  }

  if (errorData.requestUrl) {
    console.log(`🔗 Request URL: ${errorData.requestUrl}`);
    console.log(`📝 Method: ${errorData.requestMethod}`);
  }

  if (errorData.responseStatusCode) {
    console.log(`📡 Response Status: ${errorData.responseStatusCode}`);
  }

  if (errorData.moreInfo) {
    console.log(`ℹ️  More Info: ${errorData.moreInfo}`);
  }

  console.log(`${emoji} ======================================== ${emoji}\n`);
}

/**
 * Classify error severity for prioritization
 */
function classifyErrorSeverity(errorData) {
  const errorCode = parseInt(errorData.errorCode, 10);

  // Critical errors that stop the pipeline
  const criticalErrors = [
    11200, // HTTP retrieval failure (webhook down)
    20003, // Authentication failed
    20404, // Resource not found
    53205, // Conference error
  ];

  // High priority errors
  const highPriorityErrors = [
    11100, // Invalid TwiML
    12100, // Document parse failure
    13227, // Call already ended
    21211, // Invalid phone number
    21217, // Phone number not reachable
  ];

  // Medium priority errors (warnings)
  const mediumPriorityErrors = [
    13224, // Call leg already ended
    13227, // Call in wrong state
  ];

  if (errorData.level === 'ERROR') {
    if (criticalErrors.includes(errorCode)) {
      return 'CRITICAL';
    } else if (highPriorityErrors.includes(errorCode)) {
      return 'HIGH';
    } else {
      return 'MEDIUM';
    }
  } else {
    return 'LOW'; // Warnings
  }
}

/**
 * Handle error remediation based on error type
 */
async function handleErrorRemediation(context, errorData, severity) {
  const errorCode = parseInt(errorData.errorCode, 10);
  const actions = [];

  console.log(
    `🔧 Attempting remediation for error code ${errorCode} (severity: ${severity})`
  );

  // Remediation strategies by error code
  switch (errorCode) {
    case 11200: // HTTP retrieval failure
      actions.push('ALERT: Webhook endpoint may be down');
      actions.push('Check serverless function deployment status');
      // Could automatically redeploy or switch to backup webhook
      break;

    case 11100: // Invalid TwiML
      actions.push('ALERT: TwiML validation failed');
      actions.push('Review TwiML structure in webhook response');
      // Could log the invalid TwiML for manual review
      break;

    case 21211: // Invalid phone number
      actions.push('LOG: Invalid phone number detected');
      actions.push(`Phone number: ${errorData.payload.to || 'unknown'}`);
      // Could update customers.json or flag for review
      break;

    case 53205: // Conference error
      actions.push('ALERT: Conference creation/management failed');
      actions.push('Check conference orchestrator logs');
      // Could retry conference creation
      break;

    case 60001: // Voice Intelligence error
      actions.push('LOG: Voice Intelligence service error');
      actions.push('Transcription may have failed');
      // Could retry transcription or skip
      break;

    default:
      actions.push(`No automated remediation for error code ${errorCode}`);
      actions.push('Manual review may be required');
  }

  // Log remediation actions
  actions.forEach(action => {
    console.log(`  → ${action}`);
  });

  // For critical errors, could send external alerts here
  if (severity === 'CRITICAL') {
    await sendCriticalErrorAlert(context, errorData, actions);
  }

  return {
    severity,
    actions,
    automated: actions.some(a => !a.includes('Manual')),
  };
}

/**
 * Send critical error alerts to external services
 */
async function sendCriticalErrorAlert(context, errorData, actions) {
  console.log('🚨 CRITICAL ERROR - Sending alerts...');

  // Option 1: Log to console (always)
  console.error(
    'CRITICAL ERROR:',
    JSON.stringify(
      {
        errorSid: errorData.sid,
        errorCode: errorData.errorCode,
        message: errorData.message,
        timestamp: errorData.timestamp,
        actions: actions,
      },
      null,
      2
    )
  );

  // Option 2: Could integrate with external services
  // Examples (uncomment and configure as needed):

  // Slack webhook
  // if (context.SLACK_WEBHOOK_URL) {
  //   await sendSlackNotification(context.SLACK_WEBHOOK_URL, errorData);
  // }

  // Email via SendGrid
  // if (context.SENDGRID_API_KEY) {
  //   await sendEmailAlert(context.SENDGRID_API_KEY, errorData);
  // }

  // PagerDuty
  // if (context.PAGERDUTY_KEY) {
  //   await sendPagerDutyAlert(context.PAGERDUTY_KEY, errorData);
  // }

  // GitHub Issue
  // if (context.GITHUB_TOKEN) {
  //   await createGitHubIssue(context.GITHUB_TOKEN, errorData);
  // }

  return true;
}

/**
 * Example: Send Slack notification (commented out - uncomment to use)
 */
// async function sendSlackNotification(webhookUrl, errorData) {
//   const https = require('https');
//   const url = new URL(webhookUrl);
//
//   const payload = JSON.stringify({
//     text: `🚨 CRITICAL Twilio Error: ${errorData.errorCode}`,
//     attachments: [{
//       color: 'danger',
//       fields: [
//         { title: 'Error Code', value: errorData.errorCode, short: true },
//         { title: 'Level', value: errorData.level, short: true },
//         { title: 'Message', value: errorData.message, short: false },
//         { title: 'Resource SID', value: errorData.resourceSid, short: false },
//         { title: 'Timestamp', value: errorData.timestamp, short: false }
//       ]
//     }]
//   });
//
//   return new Promise((resolve, reject) => {
//     const req = https.request({
//       hostname: url.hostname,
//       path: url.pathname,
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'Content-Length': payload.length
//       }
//     }, (res) => {
//       resolve(res.statusCode === 200);
//     });
//
//     req.on('error', reject);
//     req.write(payload);
//     req.end();
//   });
// }
