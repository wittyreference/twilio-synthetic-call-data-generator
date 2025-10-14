# Quick Start Guide

**⚡ Get up and running in 5 minutes** - This is a condensed guide for developers who want to try the system immediately.

> **For production deployment with advanced configuration**, see [deployment-guide.md](deployment-guide.md)

## Prerequisites

- **Node.js** v18+ installed
- **Twilio Account** with credits
- **Segment Workspace** (free tier OK)
- **10 minutes** of your time

---

## Step 1: Clone & Install (2 min)

```bash
# Clone the repository
git clone <repository-url>
cd twilio-synthetic-call-data-generator

# Install dependencies
npm install
```

---

## Step 2: Configure Environment (2 min)

Create `.env` file:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Get these from https://console.twilio.com
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here

# Get this from https://app.segment.com → Connections → Sources → Node.js
SEGMENT_WRITE_KEY=your_segment_write_key_here

# Optional: For testing
AGENT_PHONE_NUMBER=+15551234567
```

**Where to find credentials:**

1. **Twilio**: [console.twilio.com](https://console.twilio.com) → Account Info
2. **Segment**: [app.segment.com](https://app.segment.com) → Connections → Sources → Add Source → Node.js → Copy Write Key

---

## Step 3: Validate Setup (1 min)

Run the pre-deployment check:

```bash
npm run pre-deploy
```

**Expected output:**
```
✓ ALL CHECKS PASSED (7/7)
🎉 Ready for deployment!
```

If any checks fail, follow the error messages to fix them.

---

## Step 4: Deploy to Twilio (2 min)

Deploy serverless functions:

```bash
npm run deploy
```

This will:
1. Run pre-deployment checks
2. Deploy functions to Twilio
3. Run post-deployment validation

**Expected output:**
```
✓ ALL VALIDATIONS PASSED (4/4)
🎉 Deployment is healthy and operational!
```

---

## Step 5: Configure Error Monitoring (1 min)

Set up real-time error monitoring with Twilio Debugger webhook:

```bash
npm run configure-debugger
```

This will display instructions for manual configuration. Follow these steps:

1. Go to [console.twilio.com/monitor/debugger](https://console.twilio.com/monitor/debugger)
2. Click **Settings** (gear icon in top right)
3. Under **Webhook**, enter the URL shown in the script output
4. Click **Save**

**What this does:**
- Captures ALL Twilio errors/warnings in real-time
- Automatically classifies error severity (CRITICAL, HIGH, MEDIUM, LOW)
- Takes automated remediation actions
- Structured JSON error logging for debugging

For more details, see [error-handling-guide.md](error-handling-guide.md).

---

## Step 6: Generate Synthetic Calls (1 min)

Run a test generation:

```bash
node src/main.js
```

**What happens:**
1. Loads 10 customers and 10 agents
2. Selects intelligent customer-agent pairing
3. Creates Segment profiles
4. Creates Twilio conference
5. Adds participants with AI conversation
6. Simulates call completion
7. Updates Segment with ML scores

---

## Verify It's Working

### Check Twilio Console

1. Go to [console.twilio.com/monitor/logs/conferences](https://console.twilio.com/monitor/logs/conferences)
2. See your generated conference
3. Click to view participants

### Check Segment Debugger

1. Go to [app.segment.com](https://app.segment.com)
2. Navigate to Connections → Sources → Your Source → Debugger
3. See events:
   - `identify` calls with customer profiles
   - `call_completed` track events with analytics

### Check Error Monitoring

1. Go to [console.twilio.com/monitor/debugger](https://console.twilio.com/monitor/debugger)
2. View any errors/warnings from your calls
3. Check Function logs to see error handler responses
4. Verify automated remediation actions are logged

---

## Common Commands

```bash
# Pre-deployment validation
npm run pre-deploy

# Deploy with extra safety (includes smoke test)
npm run deploy:safe

# Post-deployment validation only
npm run post-deploy

# Run smoke test (tests real APIs without deploying)
npm run smoke-test

# Run all tests
npm test

# Test coverage report
npm run test:coverage

# Start local development server
npm run dev
```

---

## Troubleshooting

### "TWILIO_ACCOUNT_SID is missing"

**Solution:** Add credentials to `.env` file

### "Twilio authentication failed"

**Solution:** Verify credentials at [console.twilio.com](https://console.twilio.com)

### "Segment write key is missing"

**Solution:**
1. Go to [app.segment.com](https://app.segment.com)
2. Connections → Sources → Add Source → Node.js
3. Copy the Write Key to `.env`

### "Test suite failed"

**Solution:**
```bash
npm run test:coverage
```

Check which tests are failing and fix them.

### "No serverless services deployed"

**Solution:**
```bash
twilio login
twilio serverless:deploy
```

### "Error handler webhook not receiving errors"

**Solution:**
1. Verify Debugger webhook is configured in [Twilio Console](https://console.twilio.com/monitor/debugger)
2. Check the webhook URL matches your deployed function
3. Test with an intentional error (invalid phone number)
4. View Function logs to verify webhook receives requests

---

## Next Steps

1. **Read the full docs**: [deployment-guide.md](deployment-guide.md)
2. **Understand the API**: [api-documentation.md](api-documentation.md)
3. **Configure Segment destinations**: [segment-setup-guide.md](segment-setup-guide.md)
4. **Scale up**: Generate multiple conferences, set up cron jobs, etc.

---

## Production Deployment Checklist

Before deploying to production:

- [ ] All tests passing (`npm test`)
- [ ] Pre-deployment checks passing (`npm run pre-deploy`)
- [ ] Smoke test passing (`npm run smoke-test`)
- [ ] Credentials configured in `.env`
- [ ] Segment destinations configured
- [ ] Twilio phone numbers provisioned
- [ ] Usage limits and alerts configured
- [ ] Monitoring set up
- [ ] Error handler webhook configured
- [ ] Debugger webhook tested with intentional error

**Deploy with:**
```bash
npm run deploy:safe
```

---

## Support

- **Documentation**: See `docs/` directory
- **Issues**: Create a GitHub issue
- **Twilio Support**: [support.twilio.com](https://support.twilio.com)
- **Segment Support**: [segment.com/help](https://segment.com/help)

---

**You're ready to generate synthetic call data!** 🎉

Run `node src/main.js` to create your first synthetic conference call.
