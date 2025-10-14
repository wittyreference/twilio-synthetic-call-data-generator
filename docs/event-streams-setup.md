# Twilio Event Streams Setup Guide

This guide walks through configuring Twilio Event Streams to send call events to AWS EventBridge for processing by the synthetic call data generator pipeline.

## Overview

Twilio Event Streams allows you to subscribe to events from Twilio services and route them to AWS EventBridge. This enables real-time processing of call events including:

- `call.initiated` - Call started
- `call.completed` - Call ended
- `recording.completed` - Recording available
- `transcription.completed` - Transcription available with analytics

## Prerequisites

- Twilio account with Event Streams enabled
- AWS account with EventBridge access
- AWS CLI configured with appropriate credentials
- Twilio CLI installed (`npm install -g twilio-cli`)

## Step 1: Create AWS EventBridge Event Bus

First, create a dedicated event bus for Twilio events:

```bash
aws events create-event-bus \
  --name twilio-call-events \
  --region us-east-1
```

Note the Event Bus ARN - you'll need this for Twilio configuration.

## Step 2: Create IAM Role for Twilio

Twilio needs permission to put events on your EventBridge bus. Create an IAM role with the policy defined in `docs/aws-iam-policy.json`:

```bash
# Create the IAM policy
aws iam create-policy \
  --policy-name TwilioEventStreamPolicy \
  --policy-document file://docs/aws-iam-policy.json

# Create trust policy for Twilio
cat > trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::177053350312:root"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": "YOUR_TWILIO_ACCOUNT_SID"
        }
      }
    }
  ]
}
EOF

# Create the IAM role
aws iam create-role \
  --role-name TwilioEventStreamRole \
  --assume-role-policy-document file://trust-policy.json

# Attach the policy to the role
aws iam attach-role-policy \
  --role-name TwilioEventStreamRole \
  --policy-arn arn:aws:iam::YOUR_AWS_ACCOUNT_ID:policy/TwilioEventStreamPolicy
```

## Step 3: Configure Twilio Event Streams Sink

Create an Event Streams sink pointing to your EventBridge bus:

```bash
twilio api:events:v1:sinks:create \
  --description "Synthetic Call Data EventBridge Sink" \
  --sink-type aws-eventbridge \
  --sink-configuration '{"region":"us-east-1","event_bus_arn":"arn:aws:events:us-east-1:YOUR_AWS_ACCOUNT_ID:event-bus/twilio-call-events","role_arn":"arn:aws:iam::YOUR_AWS_ACCOUNT_ID:role/TwilioEventStreamRole"}'
```

Save the Sink SID from the response.

## Step 4: Create Event Streams Subscription

Subscribe to the events you need:

```bash
twilio api:events:v1:subscriptions:create \
  --description "Call and Recording Events" \
  --sink-sid DGXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX \
  --types '{"type":"com.twilio.voice.call.completed","schema_version":1}' \
  --types '{"type":"com.twilio.voice.recording.completed","schema_version":1}' \
  --types '{"type":"com.twilio.voice.transcription.completed","schema_version":1}'
```

## Step 5: Create EventBridge Rules

Create rules to route events to your processing functions:

### Rule 1: Call Completed Events

```bash
aws events put-rule \
  --name twilio-call-completed \
  --event-bus-name twilio-call-events \
  --event-pattern '{
    "source": ["aws.partner/twilio.com"],
    "detail-type": ["com.twilio.voice.call.completed"]
  }'

# Add target (Lambda, SQS, etc.)
aws events put-targets \
  --rule twilio-call-completed \
  --event-bus-name twilio-call-events \
  --targets "Id"="1","Arn"="arn:aws:lambda:us-east-1:YOUR_AWS_ACCOUNT_ID:function:process-call-completed"
```

### Rule 2: Transcription Completed Events

```bash
aws events put-rule \
  --name twilio-transcription-completed \
  --event-bus-name twilio-call-events \
  --event-pattern '{
    "source": ["aws.partner/twilio.com"],
    "detail-type": ["com.twilio.voice.transcription.completed"]
  }'

# Add target for Segment profile updater
aws events put-targets \
  --rule twilio-transcription-completed \
  --event-bus-name twilio-call-events \
  --targets "Id"="1","Arn"="arn:aws:lambda:us-east-1:YOUR_AWS_ACCOUNT_ID:function:update-segment-profile"
```

## Step 6: Verify Event Flow

Test the event flow:

1. Make a test call using the conference orchestrator
2. Check CloudWatch Logs for EventBridge rule executions
3. Verify events are reaching your target Lambda functions

```bash
# View recent events
aws events list-rule-names-by-target \
  --target-arn arn:aws:lambda:us-east-1:YOUR_AWS_ACCOUNT_ID:function:process-call-completed

# Check CloudWatch Logs
aws logs tail /aws/lambda/process-call-completed --follow
```

## Event Payload Structure

### Call Completed Event

```json
{
  "version": "0",
  "id": "abcd1234-...",
  "detail-type": "com.twilio.voice.call.completed",
  "source": "aws.partner/twilio.com",
  "account": "YOUR_AWS_ACCOUNT_ID",
  "time": "2025-10-07T12:00:00Z",
  "region": "us-east-1",
  "detail": {
    "call_sid": "CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "account_sid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "from": "+15551234567",
    "to": "+15559876543",
    "call_status": "completed",
    "call_duration": "300",
    "direction": "outbound-api"
  }
}
```

### Transcription Completed Event

```json
{
  "version": "0",
  "id": "xyz789-...",
  "detail-type": "com.twilio.voice.transcription.completed",
  "source": "aws.partner/twilio.com",
  "account": "YOUR_AWS_ACCOUNT_ID",
  "time": "2025-10-07T12:05:00Z",
  "region": "us-east-1",
  "detail": {
    "transcription_sid": "TRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "recording_sid": "RExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "call_sid": "CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "transcription_text": "Full transcription...",
    "transcription_status": "completed"
  }
}
```

## Integration with Segment

To update Segment profiles from EventBridge:

1. Create a Lambda function that:
   - Receives EventBridge transcription events
   - Extracts analytics (sentiment, resolution, escalation)
   - Calls `ProfileUpdater.updateFromWebhook()`

2. Set environment variables:
   ```bash
   SEGMENT_WRITE_KEY=your_segment_write_key
   ```

3. Deploy the Lambda function:
   ```bash
   # Example using Serverless Framework
   serverless deploy --function update-segment-profile
   ```

## Monitoring and Troubleshooting

### CloudWatch Metrics

Monitor these CloudWatch metrics:

- `AWS/Events/Invocations` - Number of rule invocations
- `AWS/Events/FailedInvocations` - Failed invocations
- `AWS/Lambda/Duration` - Processing time
- `AWS/Lambda/Errors` - Lambda errors

### Common Issues

**Issue**: Events not appearing in EventBridge
- Verify IAM role has correct permissions
- Check Event Streams subscription is active
- Ensure External ID matches Twilio Account SID

**Issue**: Lambda not receiving events
- Verify EventBridge rule event pattern matches
- Check Lambda execution role has permissions
- Review CloudWatch Logs for errors

**Issue**: High latency
- Consider using SQS queue between EventBridge and Lambda
- Implement batch processing for high-volume scenarios
- Use Lambda reserved concurrency

## Cost Optimization

- **EventBridge**: First 100M events/month free, then $1.00 per million
- **Lambda**: 1M requests free, then $0.20 per million
- **CloudWatch Logs**: $0.50 per GB ingested

For 1000 calls/day:
- ~3000 events/day (call, recording, transcription)
- ~90,000 events/month
- **Estimated cost**: Free tier covers this usage

## Security Best Practices

1. **Use least privilege IAM policies** - Only grant necessary permissions
2. **Enable CloudTrail** - Audit all EventBridge API calls
3. **Encrypt event data** - Use AWS KMS for sensitive data
4. **Rotate IAM credentials** - Regularly rotate the Twilio IAM role
5. **Monitor for anomalies** - Set CloudWatch alarms for unusual patterns

## References

- [Twilio Event Streams Documentation](https://www.twilio.com/docs/events)
- [AWS EventBridge Documentation](https://docs.aws.amazon.com/eventbridge/)
- [Twilio-AWS Integration Guide](https://www.twilio.com/docs/events/aws-eventbridge)
