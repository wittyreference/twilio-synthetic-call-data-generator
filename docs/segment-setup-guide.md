# Segment Setup Guide

Quick guide to get Segment ready to receive data from the synthetic call generator.

## Step 1: Create a Node.js Source

1. Go to https://app.segment.com
2. Navigate to **Connections** → **Sources**
3. Click **Add Source**
4. Search for and select **Node.js**
5. Name it: `Twilio Synthetic Call Generator`
6. Click **Add Source**
7. **Copy the Write Key** - it looks like `Ab3Cd4Ef5Gh6Ij7Kl8Mn9Op0Qr1St2U`

## Step 2: Add Write Key to .env

Add this line to your `.env` file (create it from `.env.example` if needed):

```bash
SEGMENT_WRITE_KEY=your_actual_write_key_here
```

## Step 3: Set Up a Destination (Optional but Recommended)

To actually see the data, connect a destination to your source:

### Option A: Segment Debugger (Easiest - No Setup)
- The debugger is automatically available
- Go to **Sources** → **Twilio Synthetic Call Generator** → **Debugger**
- Data will appear here in real-time when you run the smoke test

### Option B: Google Sheets (Great for Testing)
1. In your source, click **Add Destination**
2. Search for **Google Sheets**
3. Authorize with your Google account
4. Configure which events to send
5. Data will appear in a spreadsheet automatically

### Option C: Webhook (For Custom Processing)
1. Add **Webhooks** as a destination
2. Point it to your own endpoint
3. Useful for debugging or custom integrations

### Option D: Data Warehouse (Production Use)
- **BigQuery**, **Redshift**, **Snowflake**, etc.
- Best for production analytics
- Requires warehouse setup

## Step 4: Test the Connection

Run the smoke test to verify everything works:

```bash
npm run smoke-test
```

You should see:
```
✓ SEGMENT_WRITE_KEY is set
✓ Segment identify() call succeeded
✓ Segment flush() succeeded
✓ Created Segment profile for: Lucy Macintosh
✓ Updated Segment profile with call analytics
```

## Step 5: View Data in Segment Debugger

1. Go to your source in Segment
2. Click **Debugger** tab
3. You should see events like:
   - `identify` - Customer profile creation
   - `track - call_completed` - Call analytics

## What Data Gets Sent?

### Profile Creation (identify)
```json
{
  "userId": "cust_a3e3835ce1df229cce1271a25b0c8822",
  "traits": {
    "name": "Lucy Macintosh",
    "email": "lucy.macintosh@example.com",
    "phone": "+15129358764",
    "technical_proficiency": "Medium",
    "demeanor": "Calm but firm",
    "total_calls": 0,
    "churn_risk": 0,
    "propensity_to_buy": 0,
    "satisfaction_score": 0
  }
}
```

### Profile Update (identify + track)
```json
{
  "userId": "cust_a3e3835ce1df229cce1271a25b0c8822",
  "traits": {
    "total_calls": 1,
    "churn_risk": 25,
    "propensity_to_buy": 75,
    "satisfaction_score": 80,
    "last_call_sentiment": "positive",
    "last_call_resolution": "resolved",
    "last_call_escalated": false
  }
}
```

```json
{
  "userId": "cust_a3e3835ce1df229cce1271a25b0c8822",
  "event": "call_completed",
  "properties": {
    "sentiment": "positive",
    "resolution": "resolved",
    "escalation": false,
    "wordCount": 150,
    "churnRisk": 25,
    "propensityToBuy": 75,
    "satisfactionScore": 80
  }
}
```

## Troubleshooting

### "Invalid write key" error
- Double-check you copied the entire write key
- Make sure there are no extra spaces
- Verify it's from the Node.js source (not a different source type)

### Data not appearing in debugger
- Wait 5-10 seconds after running smoke test
- Refresh the debugger page
- Check that the source is not paused

### "Failed to flush" warnings
- This is usually fine - it's async
- Data still gets sent
- Only a problem if it consistently fails

## Rate Limits

Segment has generous rate limits:
- **Free tier**: 1,000 events/month
- **Team tier**: 10,000 events/month
- **Business tier**: Unlimited

For this project:
- 10 customer profiles = 10 identify calls
- Each call generates 1 identify + 1 track = 2 events
- 100 synthetic calls = 210 events total

You're well within limits! 🎉

## Next Steps

Once you verify the smoke test works:
1. Run `npm run smoke-test` to see it live
2. Check Segment debugger to see the data
3. Set up a destination if you want to store/analyze the data
4. Ready to generate synthetic call data at scale!
