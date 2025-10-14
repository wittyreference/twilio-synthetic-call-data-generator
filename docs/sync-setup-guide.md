# Twilio Sync Setup Guide

This guide walks you through setting up Twilio Sync for conversation state management and rate limiting.

## What is Twilio Sync?

Twilio Sync is a serverless state management service that enables your Twilio Functions to store and retrieve data without managing infrastructure. This project uses Sync for:

1. **Conversation History Storage** - Stores OpenAI message history between function calls
2. **Rate Limiting** - Tracks daily API call counts to prevent cost overruns

## Why Sync Instead of URL Parameters?

**Before (URL-based storage):**
- ❌ 2KB URL limit - conversations trimmed after ~10 exchanges
- ❌ Conversation history visible in logs (security risk)
- ❌ No encryption
- ❌ No rate limiting

**After (Sync-based storage):**
- ✅ Unlimited conversation length
- ✅ Encrypted storage with automatic 1-hour expiration
- ✅ Rate limiting: 1000 OpenAI calls/day (configurable)
- ✅ Cleaner URLs with only essential parameters

## Prerequisites

- Twilio Account (free trial works)
- Twilio CLI installed ([guide](https://www.twilio.com/docs/twilio-cli/quickstart))

## Step 1: Create a Sync Service

### Option A: Via Twilio Console (Recommended)

1. Go to [Twilio Console → Sync → Services](https://console.twilio.com/us1/develop/sync/services)
2. Click **"Create new Sync Service"**
3. Name it: `synthetic-call-data-sync` (or your preference)
4. Click **"Create"**
5. Copy the **Service SID** (starts with `IS...`)

### Option B: Via Twilio CLI

```bash
# Create Sync service
twilio api:sync:v1:services:create \
  --friendly-name "synthetic-call-data-sync"

# Output will include the SID
# Service SID: ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Step 2: Add to Environment Variables

Add the Sync Service SID to your `.env` file:

```env
SYNC_SERVICE_SID=ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Step 3: Configure Rate Limiting (Optional)

By default, the system allows **1000 OpenAI calls per day** (~$0.70/day at gpt-4o-mini pricing).

**⚠️ IMPORTANT:** Configure this based on your budget and expected usage!

### To Change the Limit

Edit `.env`:

```env
# Conservative (low cost)
MAX_DAILY_CALLS=100    # ~$0.07/day

# Default (moderate usage)
MAX_DAILY_CALLS=1000   # ~$0.70/day

# High volume (enterprise)
MAX_DAILY_CALLS=10000  # ~$7/day
```

### Rate Limit Behavior

**When limit is reached:**
1. OpenAI API calls are blocked
2. Caller hears: "I apologize, but the service has reached its daily usage limit. Please try again tomorrow."
3. Call is hung up gracefully
4. Error logged with current count

**Reset Schedule:**
- Limits reset at **midnight UTC** automatically
- No manual intervention required
- Sync documents auto-expire after 24 hours

### Monitoring Usage

Check current usage:

```bash
# View today's call count in Twilio Console
# Navigate to: Sync → Services → Your Service → Documents
# Look for document named: rate_limit_YYYY-MM-DD
```

Or programmatically:

```javascript
const { getRateLimitStatus } = require('./functions/utils/sync-manager');

const status = await getRateLimitStatus(context);
console.log(`Calls today: ${status.currentCount}/${status.limit}`);
console.log(`Remaining: ${status.remaining}`);
console.log(`Resets at: ${status.resetsAt}`);
```

## Step 4: Verify Setup

Run the pre-deployment check:

```bash
npm run pre-deploy
```

**Expected output:**
```
✓ Environment variables validated
✓ SYNC_SERVICE_SID found
✓ Rate limit configured (1000 calls/day)
```

## How It Works

### Conversation Storage

Each conversation is stored in a Sync Document with:
- **Unique Name:** `conversation_{conferenceId}`
- **Data:** Array of OpenAI messages (without system prompt)
- **TTL:** 1 hour (auto-deleted after conference ends)

```javascript
// Example Sync document
{
  "uniqueName": "conversation_CF123456",
  "data": {
    "messages": [
      { "role": "user", "content": "Hello" },
      { "role": "assistant", "content": "Hi! How can I help?" },
      { "role": "user", "content": "I have a question..." }
    ],
    "lastUpdated": "2025-10-09T12:34:56.789Z"
  },
  "ttl": 3600
}
```

### Rate Limiting

Daily call counts are stored in date-stamped documents:
- **Unique Name:** `rate_limit_2025-10-09`
- **Data:** `{ count: 42, lastUpdated: "..." }`
- **TTL:** 24 hours (auto-resets daily)

```javascript
// Example rate limit document
{
  "uniqueName": "rate_limit_2025-10-09",
  "data": {
    "count": 42,
    "lastUpdated": "2025-10-09T12:34:56.789Z"
  },
  "ttl": 86400
}
```

## Troubleshooting

### Error: "SYNC_SERVICE_SID environment variable is required"

**Solution:** Add `SYNC_SERVICE_SID` to your `.env` file and redeploy:

```bash
echo "SYNC_SERVICE_SID=ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" >> .env
npm run deploy
```

### Error: "Rate limiting unavailable, allowing request (fail-open mode)"

**Cause:** Sync service unavailable or credentials invalid

**Solution:**
1. Verify `SYNC_SERVICE_SID` is correct
2. Check Twilio account has Sync enabled
3. Verify auth token is valid

**Note:** System operates in "fail-open" mode - if rate limiting fails, requests are allowed (with warning logs)

### Conversation history not persisting

**Check:**
1. Sync service is active: `twilio api:sync:v1:services:fetch --sid ISxxxxxx`
2. Documents are being created: View in Twilio Console → Sync → Documents
3. TTL hasn't expired (conversations expire after 1 hour)

### Rate limit not resetting

**Expected behavior:** Limits reset automatically at midnight UTC

**If stuck:**
1. Delete the rate limit document manually
2. Or wait until TTL expires (24 hours)

```bash
# Delete today's rate limit document
twilio api:sync:v1:services:documents:remove \
  --service-sid ISxxxxxx \
  --sid rate_limit_2025-10-09
```

## Cost Considerations

### Twilio Sync Pricing

- **Free Tier:** 50,000 Sync operations/month
- **Paid:** $0.05 per 1,000 operations after free tier

### Estimated Sync Costs

**For 1,000 conversations/day:**
- Operations per conversation: ~10-15 (read + write + rate check)
- Monthly operations: 1,000 × 30 × 12 = 360,000 ops
- Cost: (360,000 - 50,000) / 1,000 × $0.05 = **$15.50/month**

**vs. OpenAI Costs:**
- 1,000 calls/day × 30 days × $0.03/call = **$900/month**

Sync is ~1.7% of total AI costs.

## Template Deployment Notes

**⚠️ For Template Users:**

When deploying this as a template for others:

1. **Document clearly in README:**
   - Sync Service SID is required
   - Rate limits MUST be configured per user's budget
   - Default 1000 calls/day may be too high/low for their use case

2. **Provide configuration guidance:**
   - Link to cost calculator
   - Explain pricing implications
   - Show examples for different usage levels

3. **Consider adding to setup script:**
   ```bash
   # Auto-create Sync service during setup
   npm run setup  # Creates Sync service and adds to .env
   ```

## Security Best Practices

1. **Never commit `.env` file** - Contains sensitive SYNC_SERVICE_SID
2. **Use environment variables** - Never hardcode SIDs in code
3. **Set appropriate TTLs** - Don't store conversation data longer than needed
4. **Monitor usage** - Set up alerts for unusual Sync activity
5. **Rotate credentials** - Regenerate auth tokens periodically

## Additional Resources

- [Twilio Sync Documentation](https://www.twilio.com/docs/sync)
- [Sync Pricing](https://www.twilio.com/sync/pricing)
- [Sync Best Practices](https://www.twilio.com/docs/sync/best-practices)
- [Rate Limiting Patterns](https://www.twilio.com/docs/usage/tutorials/how-to-set-up-your-express-app-rate-limiting-twilio-and-node-js)

## Next Steps

- ✅ Sync configured? → Continue to [Deployment Guide](deployment-guide.md)
- ❓ Need help? → Check [Troubleshooting](#troubleshooting)
- 📊 Want to monitor? → Set up [CloudWatch integration](https://www.twilio.com/docs/usage/monitor-alert)
