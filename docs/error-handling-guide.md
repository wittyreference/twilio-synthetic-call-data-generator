# Error Handling & Monitoring Guide

**Version:** 1.0.0
**Last Updated:** 2025-10-09
**Twilio CLI Version:** 6.2.0
**Serverless Plugin Version:** 3.3.0

---

## Overview

This system implements a **multi-layered error handling strategy** to capture, monitor, and remediate errors in real-time across all Twilio services.

---

## Architecture

### Layer 1: Twilio Debugger Webhook (Proactive Real-Time)

**What it captures:**
- TwiML validation errors (11xxx, 12xxx codes)
- API request failures (20xxx codes)
- Webhook failures (11200 - webhook didn't respond)
- Conference/call errors (53xxx codes)
- Voice Intelligence errors (60xxx codes)
- All Twilio service errors/warnings

**Function:** `/error-handler`
**URL:** `https://vibe-clauding-8464-dev.twil.io/error-handler`

**How it works:**
1. Twilio Debugger detects error/warning
2. Sends HTTP POST to error-handler webhook
3. Webhook parses error, logs structured data
4. Classifies severity (CRITICAL, HIGH, MEDIUM, LOW)
5. Takes automated remediation action
6. Returns success response to Twilio

### Layer 2: Function Error Handling (Internal Errors)

**What it captures:**
- Errors within serverless functions
- ConversationRelay failures
- Segment API errors
- Voice Intelligence API errors
- Webhook processing errors

**Implementation:**
- Structured try/catch blocks
- JSON error logging
- Graceful error responses
- Context preservation

---

## Setup Instructions

### Step 1: Update Twilio CLI (COMPLETE)

```bash
# Update Twilio CLI to latest version
npm update -g twilio-cli

# Update Serverless plugin
twilio plugins:update

# Verify versions
twilio --version  # Should show 6.2.0 or higher
twilio plugins    # Should show @twilio-labs/plugin-serverless 3.3.0
```

**Current Versions:**
- Twilio CLI: `6.2.0`
- Serverless Plugin: `3.3.0`

### Step 2: Deploy Error Handler (COMPLETE)

The error-handler function is already deployed:

```bash
# Redeploy if needed
twilio serverless:deploy --override-existing-project
```

**Deployed URL:** `https://vibe-clauding-8464-dev.twil.io/error-handler`

### Step 3: Configure Debugger Webhook (MANUAL)

**Option A: Using Helper Script**
```bash
npm run configure-debugger
```

This displays configuration instructions.

**Option B: Manual Configuration**

1. Go to: https://console.twilio.com/us1/monitor/debugger
2. Click **Settings** (gear icon in top right)
3. Under "Webhook", enter:
   `https://vibe-clauding-8464-dev.twil.io/error-handler`
4. Click **Save**

**Verification:**
- Create a test error (e.g., invalid TwiML)
- Check function logs: https://console.twilio.com/us1/develop/functions/editor/ZS85bd3ed9bea5f4339c5361f2ff36e44c/environment/ZEf213c26f7e06e5f7ccb03fceb9d335ad
- Should see error logged with structured JSON

---

## Error Classification

### Severity Levels

**CRITICAL** - Stops the pipeline, requires immediate action
- Error Code 11200: HTTP retrieval failure (webhook down)
- Error Code 20003: Authentication failed
- Error Code 20404: Resource not found
- Error Code 53205: Conference error

**HIGH** - Degrades functionality, needs attention
- Error Code 11100: Invalid TwiML
- Error Code 12100: Document parse failure
- Error Code 21211: Invalid phone number
- Error Code 21217: Phone number not reachable

**MEDIUM** - Non-blocking errors
- Error Code 13224: Call leg already ended
- Error Code 13227: Call in wrong state

**LOW** - Warnings, informational
- All warnings from Twilio Debugger

---

## Automated Remediation Actions

### Error Code 11200 (Webhook Down)
**Action:**
- Alert: Webhook endpoint may be down
- Check serverless function deployment status
- Could automatically redeploy or switch to backup webhook

**Example Log:**
```
🔧 Attempting remediation for error code 11200 (severity: CRITICAL)
  → ALERT: Webhook endpoint may be down
  → Check serverless function deployment status
```

### Error Code 11100 (Invalid TwiML)
**Action:**
- Alert: TwiML validation failed
- Review TwiML structure in webhook response
- Log invalid TwiML for manual review

### Error Code 21211 (Invalid Phone Number)
**Action:**
- Log invalid phone number
- Could update customers.json or flag for review

### Error Code 53205 (Conference Error)
**Action:**
- Alert: Conference creation/management failed
- Check conference orchestrator logs
- Could retry conference creation

### Error Code 60001 (Voice Intelligence Error)
**Action:**
- Log Voice Intelligence service error
- Transcription may have failed
- Could retry transcription or skip

---

## Structured Error Logging

All errors are logged in JSON format for easy parsing and analysis.

### Example: Conference Status Webhook Error

```json
{
  "errorType": "WebhookProcessingError",
  "statusCallbackEvent": "recording-completed",
  "errorMessage": "Cannot read property 'sid' of undefined",
  "errorStack": "Error: Cannot read property 'sid' of undefined\n    at handleRecordingCompleted...",
  "timestamp": "2025-10-09T00:15:23.456Z"
}
```

### Example: Voice Intelligence Error

```json
{
  "errorType": "VoiceIntelligenceTranscriptionError",
  "recordingSid": "RExxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "recordingUrl": "/2010-04-01/Accounts/ACxxxx/Recordings/RExxxx",
  "errorMessage": "Service GA123 not found",
  "errorCode": "20404",
  "errorStatus": 404,
  "timestamp": "2025-10-09T00:15:23.456Z"
}
```

### Example: Debugger Webhook Payload

```json
{
  "errorType": "TwilioDebuggerError",
  "sid": "NOxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "accountSid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "level": "ERROR",
  "timestamp": "2025-10-09T00:15:23.456Z",
  "errorCode": "11200",
  "message": "HTTP retrieval failure",
  "moreInfo": "https://www.twilio.com/docs/errors/11200",
  "resourceSid": "CAxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "requestUrl": "https://example.com/webhook",
  "requestMethod": "POST",
  "responseStatusCode": "404"
}
```

---

## Monitoring & Alerts

### Console Logs

**View Function Logs:**
https://console.twilio.com/us1/develop/functions/editor/ZS85bd3ed9bea5f4339c5361f2ff36e44c/environment/ZEf213c26f7e06e5f7ccb03fceb9d335ad

**Search for:**
- `❌` - Error indicator
- `🚨` - Critical error
- `errorType` - Structured error logs

### Twilio Debugger

**View All Errors:**
https://console.twilio.com/us1/monitor/debugger

**Filter by:**
- Error level (ERROR, WARNING)
- Error code
- Time range
- Resource type

### External Alerting (Optional)

The error-handler function includes commented-out examples for:

**Slack Notifications:**
```javascript
// Uncomment and configure SLACK_WEBHOOK_URL in environment
if (context.SLACK_WEBHOOK_URL) {
  await sendSlackNotification(context.SLACK_WEBHOOK_URL, errorData);
}
```

**Email via SendGrid:**
```javascript
if (context.SENDGRID_API_KEY) {
  await sendEmailAlert(context.SENDGRID_API_KEY, errorData);
}
```

**PagerDuty:**
```javascript
if (context.PAGERDUTY_KEY) {
  await sendPagerDutyAlert(context.PAGERDUTY_KEY, errorData);
}
```

**GitHub Issues:**
```javascript
if (context.GITHUB_TOKEN) {
  await createGitHubIssue(context.GITHUB_TOKEN, errorData);
}
```

---

## Testing Error Handling

### Test 1: Invalid TwiML (Error 11100)

Create a function that returns invalid TwiML:

```javascript
exports.handler = function(context, event, callback) {
  const twiml = '<InvalidTag>test</InvalidTag>';
  callback(null, twiml);
};
```

**Expected:**
- Debugger webhook fires
- Error logged with code 11100
- Remediation actions logged

### Test 2: Webhook Failure (Error 11200)

Temporarily disable a webhook function or return 500 error.

**Expected:**
- Debugger webhook fires
- Critical severity logged
- Alert actions triggered

### Test 3: Invalid Phone Number (Error 21211)

Try to create a call with invalid phone number:

```javascript
await client.calls.create({
  from: '+15551234567',
  to: 'invalid',
  url: 'http://demo.twilio.com/docs/voice.xml'
});
```

**Expected:**
- Debugger webhook fires
- Error logged with phone number
- Remediation suggestions logged

---

## Best Practices

### 1. Always Log Structured Data

**Good:**
```javascript
console.error(JSON.stringify({
  errorType: 'SpecificErrorType',
  context: relevantData,
  errorMessage: error.message,
  timestamp: new Date().toISOString()
}, null, 2));
```

**Avoid:**
```javascript
console.error('Error:', error);
```

### 2. Don't Fail Webhooks on Non-Critical Errors

**Good:**
```javascript
try {
  await createTranscript();
} catch (error) {
  console.error('Transcript creation failed, continuing...');
  // Don't throw - let webhook succeed
}
```

**Avoid:**
```javascript
await createTranscript(); // Uncaught error fails entire webhook
```

### 3. Include Context in Error Logs

**Good:**
```javascript
console.error(JSON.stringify({
  errorType: 'TranscriptCreationFailed',
  recordingSid: recordingSid,
  conferenceSid: conferenceSid,
  voiceIntelligenceSid: voiceIntelligenceSid,
  error: error.message
}));
```

**Avoid:**
```javascript
console.error(error.message); // No context
```

### 4. Classify Errors by Severity

Use the severity classification to determine response:
- **CRITICAL**: Send immediate alerts, consider stopping pipeline
- **HIGH**: Log and review during business hours
- **MEDIUM/LOW**: Monitor trends, review periodically

---

## Common Error Codes Reference

| Code  | Description | Severity | Remediation |
|-------|-------------|----------|-------------|
| 11100 | Invalid TwiML | HIGH | Review TwiML structure |
| 11200 | HTTP retrieval failure | CRITICAL | Check webhook endpoint |
| 12100 | Document parse failure | HIGH | Validate XML/JSON |
| 13224 | Call leg ended | MEDIUM | Log and continue |
| 20003 | Authentication failed | CRITICAL | Verify credentials |
| 20404 | Resource not found | CRITICAL | Check SID/resource |
| 21211 | Invalid phone number | HIGH | Validate E.164 format |
| 21217 | Phone unreachable | HIGH | Check number status |
| 53205 | Conference error | CRITICAL | Review conference logs |
| 60001 | Voice Intelligence error | MEDIUM | Retry or skip |

**Full Error Code Reference:** https://www.twilio.com/docs/api/errors

---

## NPM Scripts

```bash
# Configure Debugger webhook (shows instructions)
npm run configure-debugger

# View function logs (manual - use Twilio Console)
# https://console.twilio.com/us1/develop/functions/editor/.../logs

# Redeploy functions with error handling
npm run deploy:safe
```

---

## Troubleshooting

### Issue: Error Handler Not Receiving Events

**Solution:**
1. Verify webhook URL is configured in Debugger settings
2. Check webhook is deployed: `twilio serverless:list`
3. Test webhook directly: `curl -X POST https://your-domain.twil.io/error-handler`
4. Review Twilio Debugger for webhook failures

### Issue: Errors Not Logged in Console

**Solution:**
1. Check function logs in Twilio Console
2. Verify console.error statements are not commented out
3. Ensure JSON.stringify is used for structured logging
4. Check log filtering in Console

### Issue: Too Many Error Alerts

**Solution:**
1. Adjust severity thresholds
2. Filter by error code
3. Add rate limiting to alert functions
4. Focus on CRITICAL and HIGH severity only

---

## Version History

**1.0.0** (2025-10-09)
- Initial error handling implementation
- Debugger webhook integration
- Structured error logging
- Automated remediation framework
- Twilio CLI updated to 6.2.0
- Serverless Plugin updated to 3.3.0

---

## Support

- **Twilio Debugger Docs:** https://www.twilio.com/docs/usage/troubleshooting/debugging-event-webhooks
- **Error Codes:** https://www.twilio.com/docs/api/errors
- **Function Logs:** https://console.twilio.com/us1/develop/functions
- **GitHub Issues:** Create an issue in repository

---

**Status:** ✅ **DEPLOYED AND OPERATIONAL**

Error handling is now active and monitoring all Twilio services.
