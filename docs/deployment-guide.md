# Deployment Guide

**📦 Production deployment with advanced configuration** - Complete guide with security, monitoring, and scaling best practices.

> **For a quick 5-minute trial**, see [quick-start.md](quick-start.md)

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Twilio Serverless Deployment](#twilio-serverless-deployment)
4. [Segment CDP Configuration](#segment-cdp-configuration)
5. [Running the Generator](#running-the-generator)
6. [Monitoring and Validation](#monitoring-and-validation)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools

- **Node.js**: v18 or higher ([download](https://nodejs.org/))
- **Twilio CLI**: Latest version
- **Twilio Account**: Active account with credits
- **Segment Account**: Workspace with write access

### Install Twilio CLI

```bash
npm install -g twilio-cli
```

### Install Twilio Serverless Plugin

```bash
twilio plugins:install @twilio-labs/plugin-serverless
```

### Verify Installation

```bash
twilio --version
twilio plugins
```

---

## Environment Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd twilio-synthetic-call-data-generator
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Twilio Credentials (from console.twilio.com)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here

# Segment CDP (from app.segment.com)
SEGMENT_WRITE_KEY=your_segment_write_key_here

# Optional: Agent Phone Number for Testing
AGENT_PHONE_NUMBER=+15551234567
```

### 4. Find Your Twilio Credentials

1. Go to [console.twilio.com](https://console.twilio.com)
2. Copy **Account SID** and **Auth Token** from the dashboard
3. Purchase a phone number if you don't have one: **Phone Numbers → Buy a Number**

### 5. Find Your Segment Write Key

See [segment-setup-guide.md](segment-setup-guide.md) for detailed instructions.

---

## Twilio Serverless Deployment

The system uses Twilio Functions for webhooks and call control.

### 1. Authenticate Twilio CLI

```bash
twilio login
```

This opens a browser for authentication.

### 2. Deploy Serverless Functions

```bash
twilio serverless:deploy
```

This deploys:
- `conference-status-webhook.js` - Tracks conference lifecycle events
- `conference-timer.js` - Manages conference duration
- `transcription-webhook.js` - Processes call transcriptions
- `error-handler.js` - Real-time error monitoring and remediation

### 3. Note Your Function URLs

After deployment, you'll see URLs like:

```
https://your-service-xxxx.twil.io/conference-status-webhook
https://your-service-xxxx.twil.io/conference-timer
https://your-service-xxxx.twil.io/transcription-webhook
https://your-service-xxxx.twil.io/error-handler
```

Save these URLs - you'll need them for webhook configuration.

### 4. Configure Error Monitoring

Set up real-time error monitoring with Twilio Debugger webhook:

```bash
npm run configure-debugger
```

This will display instructions for manual configuration. Follow these steps:

1. Go to [console.twilio.com/monitor/debugger](https://console.twilio.com/monitor/debugger)
2. Click **Settings** (gear icon in top right)
3. Under **Webhook**, enter: `https://your-service-xxxx.twil.io/error-handler`
4. Click **Save**

**What this does:**
- Captures ALL Twilio service errors/warnings automatically
- Real-time notifications via webhook POST
- Automated error severity classification
- Structured JSON error logging
- Automated remediation actions based on error codes

**Test the error handler:**

Create an intentional error to verify the webhook is working:

```bash
# Try calling an invalid phone number via Twilio API
curl -X POST "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Calls.json" \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  --data-urlencode "To=+15551234567" \
  --data-urlencode "From=$AGENT_PHONE_NUMBER" \
  --data-urlencode "Url=http://demo.twilio.com/docs/voice.xml"
```

Then check:
1. Twilio Debugger shows the error
2. Function logs show error-handler webhook execution
3. Error is classified and logged correctly

For more details, see [error-handling-guide.md](error-handling-guide.md).

### 5. Configure Webhook Environment Variables

Update your deployed functions with environment variables:

```bash
twilio serverless:env:set \
  SEGMENT_WRITE_KEY=your_segment_write_key_here
```

---

## Segment CDP Configuration

### 1. Create Segment Source

1. Go to [app.segment.com](https://app.segment.com)
2. Navigate to **Connections → Sources**
3. Click **Add Source**
4. Choose **Node.js** source
5. Name it "Twilio Call Data Generator"
6. Copy the **Write Key**

### 2. Configure Destinations

Add destinations to receive the synthetic data:

**Recommended Destinations:**
- **Segment Debugger** (built-in) - Real-time event inspection
- **Google Sheets** - Data export and analysis
- **Webhook** - Custom integrations
- **Twilio Engage** - Customer engagement campaigns

See [segment-setup-guide.md](segment-setup-guide.md) for detailed setup.

### 3. Verify Data Flow

Run the smoke test to ensure Segment is receiving data:

```bash
npm run smoke-test
```

Check the Segment Debugger for events:
- `identify` calls with customer profiles
- `call_completed` track events with analytics

---

## Running the Generator

### 1. Validate Configuration

Run the smoke test to ensure everything is connected:

```bash
npm run smoke-test
```

Expected output:
```
✓ Connected to Twilio account
✓ Segment identify() call succeeded
✓ Created Segment profile
✓ Updated Segment profile with call analytics
✓ ALL TESTS PASSED! (8/8)
```

### 2. Validate Customer and Agent Data

```bash
node scripts/validate-customers.js
node scripts/validate-agents.js
```

### 3. Generate Synthetic Calls

**Option A: Single Conference**

```bash
node src/main.js
```

**Option B: Batch Generation**

```bash
# Generate 10 conferences
for i in {1..10}; do node src/main.js; sleep 5; done
```

**Option C: Scheduled Generation**

Use a cron job to generate calls periodically:

```bash
# Run every hour
0 * * * * cd /path/to/project && node src/main.js
```

### 4. Monitor Execution

Watch the console output for:
- Customer-agent pairing
- Conference creation
- Participant addition
- Webhook events
- Segment profile updates

---

## Monitoring and Validation

### 1. Twilio Console Monitoring

**Conference Logs:**
1. Go to [console.twilio.com](https://console.twilio.com)
2. Navigate to **Monitor → Logs → Conferences**
3. View active and completed conferences

**Call Logs:**
1. Navigate to **Monitor → Logs → Calls**
2. Filter by conference SID
3. Check participant call statuses

**Function Logs:**
1. Navigate to **Functions & Assets → Services**
2. Click your service
3. View function execution logs

### 2. Segment Monitoring

**Debugger:**
1. Go to **Connections → Sources → Twilio Call Data Generator**
2. Click **Debugger** tab
3. View real-time events

**Event Delivery:**
1. Check **Event Delivery** tab
2. Verify successful delivery to destinations
3. Investigate any errors

### 3. Data Validation

Run E2E tests to validate the complete pipeline:

```bash
npm run test:e2e
```

Check test results:
- Conference creation
- Profile updates
- ML score calculations
- Event tracking

---

## Troubleshooting

### Issue: Smoke Test Fails with "Analytics is not a constructor"

**Solution:**
Ensure you're using the correct import syntax:

```javascript
const { Analytics } = require('@segment/analytics-node');
```

Not:
```javascript
const Analytics = require('@segment/analytics-node');
```

### Issue: Twilio Authentication Error

**Solution:**
1. Verify credentials in `.env`
2. Re-authenticate Twilio CLI: `twilio login`
3. Check account status at console.twilio.com

### Issue: Segment Events Not Appearing

**Solution:**
1. Verify `SEGMENT_WRITE_KEY` in `.env`
2. Check Segment Debugger for errors
3. Ensure source is enabled
4. Run: `npm run smoke-test` to test connection

### Issue: Serverless Deployment Fails

**Solution:**
1. Check Twilio CLI version: `twilio --version`
2. Update plugin: `twilio plugins:update`
3. Verify function syntax in `functions/` directory
4. Check deployment logs for specific errors

### Issue: Conference Creation Fails

**Solution:**
1. Verify phone number is provisioned and active
2. Check account credits at console.twilio.com
3. Ensure webhook URLs are accessible
4. Review function logs for errors
5. Check Debugger webhook for error notifications

### Issue: Error Handler Not Receiving Errors

**Solution:**
1. Verify Debugger webhook is configured at [console.twilio.com/monitor/debugger](https://console.twilio.com/monitor/debugger)
2. Check webhook URL matches deployed function: `https://your-service-xxxx.twil.io/error-handler`
3. Test with intentional error (see deployment section)
4. Verify function is deployed: `twilio serverless:list`
5. Check function logs for webhook execution

### Issue: Errors Not Being Classified Correctly

**Solution:**
1. Review error code in Twilio Debugger
2. Check error-handler.js classification logic
3. Verify structured error logging in function logs
4. See [error-handling-guide.md](error-handling-guide.md) for error code reference

### Issue: Missing Dependencies

**Solution:**
```bash
rm -rf node_modules package-lock.json
npm install
```

### Issue: Test Failures

**Solution:**
1. Clear Jest cache: `npm run test:clear`
2. Run tests individually to isolate issue
3. Check for environment variable conflicts
4. Ensure all mocks are properly configured

---

## Production Best Practices

### 1. Security

- **Never commit `.env` file** - Add to `.gitignore`
- **Rotate credentials** regularly
- **Use environment-specific keys** (dev/staging/prod)
- **Enable two-factor authentication** on Twilio and Segment

### 2. Cost Management

- **Monitor Twilio usage** at console.twilio.com/usage
- **Set usage alerts** to avoid unexpected charges
- **Use short conference durations** for testing
- **Clean up old conferences** regularly

### 3. Data Quality

- **Validate customer/agent data** before generation
- **Monitor Segment event delivery** rates
- **Review ML scores** for realism
- **Archive historical data** for analysis

### 4. Scalability

- **Batch conference creation** with delays to avoid rate limits
- **Use Twilio's bulk API** for large-scale generation
- **Implement retry logic** for transient failures
- **Monitor API rate limits**

### 5. Compliance

- **Anonymize PII** in logs and monitoring
- **Follow TCPA regulations** for phone calls
- **Review data retention policies**
- **Document data lineage** for synthetic data

---

## Next Steps

1. **Review [segment-setup-guide.md](segment-setup-guide.md)** for Segment configuration
2. **Check [API documentation](api-documentation.md)** for integration details
3. **Run smoke test** to validate deployment
4. **Generate test conferences** to verify end-to-end flow
5. **Monitor Segment Debugger** for event delivery

---

## Support

- **Twilio Support**: https://support.twilio.com
- **Segment Support**: https://segment.com/help
- **GitHub Issues**: [Create an issue](https://github.com/your-repo/issues)
- **Documentation**: See `docs/` directory

---

**Deployment Checklist:**

- [ ] Node.js v18+ installed
- [ ] Twilio CLI installed and authenticated
- [ ] Dependencies installed (`npm install`)
- [ ] `.env` file configured
- [ ] Twilio credentials verified
- [ ] Segment write key added
- [ ] Serverless functions deployed
- [ ] Error handler webhook configured
- [ ] Debugger webhook tested
- [ ] Smoke test passed
- [ ] Customer/agent data validated
- [ ] Test conference created successfully
- [ ] Segment events visible in Debugger
- [ ] Monitoring configured
- [ ] Production best practices reviewed

**You're ready to generate synthetic call data!** 🎉
