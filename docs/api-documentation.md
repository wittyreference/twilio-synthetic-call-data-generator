# API Documentation

Complete API reference for the Twilio Synthetic Call Data Generator.

## Table of Contents

1. [Core Modules](#core-modules)
2. [Personas](#personas)
3. [Pairing](#pairing)
4. [Orchestration](#orchestration)
5. [Segment Integration](#segment-integration)
6. [Serverless Functions](#serverless-functions)
7. [Configuration](#configuration)
8. [Data Models](#data-models)

---

## Core Modules

### Main Entry Point

**File:** `src/main.js`

Orchestrates the complete synthetic call generation pipeline.

**Usage:**

```javascript
node src/main.js
```

**Process Flow:**

1. Load customer and agent personas
2. Select intelligent customer-agent pairing
3. Create Segment profiles for all customers
4. Create Twilio conference
5. Add customer and agent participants
6. Simulate call completion with analytics
7. Update Segment profiles with ML scores

---

## Personas

### Customer Loader

**File:** `src/personas/customer-loader.js`

Loads and validates customer persona data from JSON files.

#### `loadCustomers(filePath)`

Loads customer personas from a JSON file.

**Parameters:**
- `filePath` (string, optional): Path to customers JSON file. Defaults to `customers.json`

**Returns:** Array of customer objects

**Throws:** Error if file doesn't exist or contains invalid JSON

**Example:**

```javascript
const { loadCustomers } = require('./src/personas/customer-loader');

const customers = loadCustomers();
console.log(`Loaded ${customers.length} customers`);
```

#### `validateCustomer(customer)`

Validates a customer object against required schema.

**Parameters:**
- `customer` (object): Customer object to validate

**Returns:** `true` if valid

**Throws:** Error if validation fails

**Required Fields:**
- `CustomerName` (string)
- `PhoneNumber` (string, E.164 format)
- `ContactInformation` (string, valid email)
- `TechnicalProficiency` (string: "Low", "Medium", "High")
- `PastInteractions` (array)
- `PreferredContactMethod` (string)
- `CurrentIssue` (string)

**Example:**

```javascript
const { validateCustomer } = require('./src/personas/customer-loader');

const customer = {
  CustomerName: "John Doe",
  PhoneNumber: "+15551234567",
  ContactInformation: "john@example.com",
  TechnicalProficiency: "Medium",
  // ... other fields
};

validateCustomer(customer); // throws if invalid
```

#### `getCustomerByName(name)`

Finds a customer by exact name match.

**Parameters:**
- `name` (string): Customer name to search

**Returns:** Customer object or `null`

**Example:**

```javascript
const customer = getCustomerByName("Emily Watson");
if (customer) {
  console.log(`Found: ${customer.PhoneNumber}`);
}
```

#### `getCustomerByPhone(phoneNumber)`

Finds a customer by phone number.

**Parameters:**
- `phoneNumber` (string): Phone number to search

**Returns:** Customer object or `null`

**Example:**

```javascript
const customer = getCustomerByPhone("+15551234567");
```

#### `getRandomCustomer()`

Returns a random customer from loaded personas.

**Returns:** Random customer object

**Example:**

```javascript
const customer = getRandomCustomer();
console.log(`Selected: ${customer.CustomerName}`);
```

---

### Agent Loader

**File:** `src/personas/agent-loader.js`

Loads and validates agent persona data from JSON files.

#### `loadAgents(filePath)`

Loads agent personas from a JSON file.

**Parameters:**
- `filePath` (string, optional): Path to agents JSON file. Defaults to `agents.json`

**Returns:** Array of agent objects

**Example:**

```javascript
const { loadAgents } = require('./src/personas/agent-loader');

const agents = loadAgents();
console.log(`Loaded ${agents.length} agents`);
```

#### `validateAgent(agent)`

Validates an agent object against required schema.

**Parameters:**
- `agent` (object): Agent object to validate

**Returns:** `true` if valid

**Throws:** Error if validation fails

**Required Fields:**
- `AgentName` (string)
- `PhoneNumber` (string, E.164 format)
- `Competence` (string: "Low", "Medium", "High")
- `Communication` (string: "Poor", "Average", "Excellent")
- `Experience` (string)
- `Specialization` (string)

---

## Pairing

### Pair Selector

**File:** `src/pairing/pair-selector.js`

Intelligently pairs customers with agents based on compatibility factors.

#### `selectPair(customers, agents)`

Selects optimal customer-agent pairing.

**Parameters:**
- `customers` (array): Array of customer objects
- `agents` (array): Array of agent objects

**Returns:** Object with `customer` and `agent` properties

**Pairing Strategy:**

1. **Frustrated customers** → **High competence agents**
2. **Low technical proficiency** → **Excellent communication agents**
3. **Complex issues** → **Experienced agents**
4. **Random selection** from filtered pool

**Example:**

```javascript
const { selectPair } = require('./src/pairing/pair-selector');

const customers = loadCustomers();
const agents = loadAgents();

const { customer, agent } = selectPair(customers, agents);
console.log(`Paired: ${customer.CustomerName} with ${agent.AgentName}`);
```

#### `generateConferenceId(customer, agent)`

Generates a deterministic conference ID.

**Parameters:**
- `customer` (object): Customer object
- `agent` (object): Agent object

**Returns:** String in format `CF{32-char-hex}`

**Example:**

```javascript
const conferenceId = generateConferenceId(customer, agent);
// Output: "CF7bdf13de62d3197bf501f3b3c595f9eb"
```

---

## Orchestration

### Conference Orchestrator

**File:** `src/orchestration/conference-orchestrator.js`

Creates and manages Twilio conferences using TwiML Application for AI-powered conversations.

#### `createConference(twilioClient, twimlAppSid, agentPhoneNumber, customerPhoneNumber, options)`

Creates a Twilio conference with customer and agent participants using OpenAI integration.

**Parameters:**
- `twilioClient` (object): Initialized Twilio client
- `twimlAppSid` (string): TwiML Application SID for voice handling
- `agentPhoneNumber` (string): Phone number for agent participant (E.164)
- `customerPhoneNumber` (string): Phone number for customer participant (E.164)
- `options` (object, optional): Configuration options
  - `strategy` (string): Pairing strategy ('random', 'frustrated', etc.)

**Returns:** Promise resolving to object:
```javascript
{
  conferenceSid: "CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  conferenceId: "CF1234567890abcdef1234567890abcd",
  customer: {
    participantSid: "CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    callSid: "CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    customerName: "Lucy Macintosh",
    phoneNumber: "+15551234567"
  },
  agent: {
    participantSid: "CAyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy",
    callSid: "CAyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy",
    agentName: "Sarah",
    phoneNumber: "+15559998888"
  },
  timerScheduled: true,
  timerDuration: 300,
  timestamp: "2025-01-15T10:00:00.000Z"
}
```

**Example:**

```javascript
const twilio = require('twilio');
const { createConference } = require('./src/orchestration/conference-orchestrator');

const client = twilio(accountSid, authToken);

const result = await createConference(
  client,
  'APf6ae15d8f3df8d16e98d9d1afeb9e6b6', // TwiML App SID
  '+15559998888', // Agent phone
  '+15551234567', // Customer phone
  { strategy: 'random' }
);

console.log(`Conference created: ${result.conferenceSid}`);
```

---

### Add Participant

**File:** `src/orchestration/add-participant.js`

Adds participants to Twilio conferences using TwiML Application with OpenAI integration.

#### `addCustomerToConference(twilioClient, conferenceSid, customer, twimlAppSid, customerPhoneNumber)`

Adds a customer to an existing conference using TwiML Application.

**Parameters:**
- `twilioClient` (object): Initialized Twilio client
- `conferenceSid` (string): Conference SID
- `customer` (object): Customer persona object with `CustomerName`
- `twimlAppSid` (string): TwiML Application SID
- `customerPhoneNumber` (string): Phone number to call customer from (E.164)

**Returns:** Promise resolving to participant object
```javascript
{
  participantSid: "CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  callSid: "CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  conferenceSid: "CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  participantType: "customer",
  customerName: "Lucy Macintosh"
}
```

**Features:**
- Uses TwiML Application for voice handling
- Automatic retry on network errors (max 3 attempts)
- Exponential backoff (1s, 2s, 4s)
- No retry on 4xx client errors
- Input validation with E.164 phone format
- URL-encoded parameters

**Example:**

```javascript
const participant = await addCustomerToConference(
  client,
  'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  { CustomerName: 'Lucy Macintosh' },
  'APf6ae15d8f3df8d16e98d9d1afeb9e6b6',
  '+15551234567'
);

console.log(`Customer added: ${participant.callSid}`);
```

**TwiML Application URL Format:**
```
app:APf6ae15d8f3df8d16e98d9d1afeb9e6b6?role=customer&persona=Lucy%20Macintosh&conferenceId=CFxxx
```

#### `addAgentToConference(twilioClient, conferenceSid, agent, twimlAppSid, agentPhoneNumber)`

Adds an AI-powered agent to a conference using TwiML Application.

**Parameters:**
- `twilioClient` (object): Initialized Twilio client
- `conferenceSid` (string): Conference SID
- `agent` (object): Agent persona object with `AgentName`
- `twimlAppSid` (string): TwiML Application SID
- `agentPhoneNumber` (string): Phone number to call agent from (E.164)

**Returns:** Promise resolving to participant object
```javascript
{
  participantSid: "CAyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy",
  callSid: "CAyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy",
  conferenceSid: "CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  participantType: "agent",
  agentName: "Sarah"
}
```

**TwiML Application Features:**
- OpenAI GPT-4o integration via serverless functions
- Dynamic persona loading from JSON files
- System prompt construction with agent characteristics
- Conversation history management
- Speech-to-text with enhanced models
- Neural voice synthesis

**Example:**

```javascript
const participant = await addAgentToConference(
  client,
  'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  { AgentName: 'Sarah' },
  'APf6ae15d8f3df8d16e98d9d1afeb9e6b6',
  '+15559998888'
);

console.log(`Agent added with OpenAI: ${participant.callSid}`);
```

**TwiML Application URL Format:**
```
app:APf6ae15d8f3df8d16e98d9d1afeb9e6b6?role=agent&persona=Sarah&conferenceId=CFxxx
```

---

## Segment Integration

### Profile Creator

**File:** `src/segment/profile-creator.js`

Creates Segment CDP profiles from customer personas.

#### `ProfileCreator.initialize(writeKey)`

Factory method to initialize ProfileCreator with Segment credentials.

**Parameters:**
- `writeKey` (string): Segment write key

**Returns:** ProfileCreator instance

**Example:**

```javascript
const ProfileCreator = require('./src/segment/profile-creator');

const creator = ProfileCreator.initialize(process.env.SEGMENT_WRITE_KEY);
```

#### `createProfile(customer)`

Creates a Segment profile for a single customer.

**Parameters:**
- `customer` (object): Customer persona object

**Returns:** Promise resolving on success

**Segment Event:**
- Type: `identify`
- User ID: `cust_{md5(phoneNumber)}`
- Traits: All customer fields in snake_case

**Example:**

```javascript
await creator.createProfile(customerData);
```

#### `createBatchProfiles(customers)`

Creates Segment profiles for multiple customers.

**Parameters:**
- `customers` (array): Array of customer objects

**Returns:** Promise resolving to object:
```javascript
{
  success: true,
  profilesCreated: 10,
  errors: []
}
```

**Example:**

```javascript
const result = await creator.createBatchProfiles(customers);
console.log(`Created ${result.profilesCreated} profiles`);
```

---

### Profile Updater

**File:** `src/segment/profile-updater.js`

Updates Segment profiles with call analytics and ML scores.

#### `ProfileUpdater.initialize(writeKey)`

Factory method to initialize ProfileUpdater.

**Parameters:**
- `writeKey` (string): Segment write key

**Returns:** ProfileUpdater instance

**Example:**

```javascript
const ProfileUpdater = require('./src/segment/profile-updater');

const updater = ProfileUpdater.initialize(process.env.SEGMENT_WRITE_KEY);
```

#### `updateFromCallAnalytics(userId, analytics)`

Updates a profile with call outcome analytics.

**Parameters:**
- `userId` (string): Segment user ID (`cust_*`)
- `analytics` (object): Call analytics data

**Analytics Object:**
```javascript
{
  sentiment: 'positive' | 'neutral' | 'negative',
  resolution: 'resolved' | 'unresolved' | 'escalated',
  escalation: boolean,
  wordCount: number
}
```

**Returns:** Promise resolving on success

**Segment Events:**
1. **Identify**: Updates profile traits
   - `churn_risk_score` (0-100)
   - `propensity_to_buy` (0-100)
   - `satisfaction_score` (0-100)
   - `total_calls` (incremented)
   - `last_call_sentiment`
   - `last_call_resolution`

2. **Track**: `call_completed` event
   - All analytics fields
   - Calculated ML scores
   - Timestamp

**ML Score Calculations:**

**Churn Risk Score:**
- Base: `baselineRisk` from persona (30-70)
- Sentiment impact: -15 (positive), +20 (negative)
- Resolution impact: -10 (resolved), +15 (unresolved)
- Escalation penalty: +25
- Call duration: -5 (long calls reduce risk)
- Capped at 0-100

**Propensity to Buy:**
- Base: `baselinePropensity` from persona (20-60)
- Sentiment impact: +20 (positive), -15 (negative)
- Resolution impact: +15 (resolved), -10 (unresolved)
- Escalation penalty: -20
- Capped at 0-100

**Satisfaction Score:**
- Positive + resolved: 85-95
- Neutral or mixed: 50-70
- Negative + unresolved: 20-40
- Random variance: ±10

**Example:**

```javascript
const analytics = {
  sentiment: 'positive',
  resolution: 'resolved',
  escalation: false,
  wordCount: 250
};

await updater.updateFromCallAnalytics('cust_abc123', analytics);
```

#### `updateFromTranscriptionWebhook(webhookData)`

Updates profile from Twilio transcription webhook.

**Parameters:**
- `webhookData` (object): Webhook POST body from Twilio

**Required Fields:**
- `TranscriptionText` (string)
- `CallSid` (string)
- `From` (string, customer phone)

**Returns:** Promise resolving on success

**Example:**

```javascript
// In webhook handler
app.post('/transcription-webhook', async (req, res) => {
  await updater.updateFromTranscriptionWebhook(req.body);
  res.send('OK');
});
```

---

## Serverless Functions

### Conference Status Webhook

**File:** `functions/conference-status-webhook.js`

Handles Twilio conference lifecycle events.

**Endpoint:** `POST /conference-status-webhook`

**Twilio Events:**
- `conference-start`
- `conference-end`
- `participant-join`
- `participant-leave`

**POST Parameters:**
- `StatusCallbackEvent` (string): Event type
- `ConferenceSid` (string): Conference SID
- `FriendlyName` (string): Conference friendly name
- `ParticipantLabel` (string): "customer" or "agent"
- `CallSid` (string): Participant call SID

**Response:** TwiML `<Response></Response>`

**Side Effects:**
- Logs all conference events
- Tracks participant join/leave times
- Monitors conference status

**Example Configuration:**

```javascript
const conference = await client.conferences.create({
  statusCallback: 'https://your-service.twil.io/conference-status-webhook',
  statusCallbackEvent: ['start', 'end', 'join', 'leave']
});
```

---

### Conference Timer

**File:** `functions/conference-timer.js`

Manages conference duration and automatic ending.

**Endpoint:** `GET /conference-timer`

**Query Parameters:**
- `conferenceSid` (string): Conference SID
- `duration` (number, optional): Minutes before ending. Default: 5

**Response:** JSON
```javascript
{
  message: "Conference will end in X minutes",
  conferenceSid: "CFxxxx",
  scheduledEnd: "2025-01-15T10:30:00.000Z"
}
```

**Features:**
- Schedules conference ending
- Configurable duration
- Graceful participant removal

**Example:**

```http
GET /conference-timer?conferenceSid=CFxxxx&duration=10
```

---

### Voice Handler (TwiML Application Entry Point)

**File:** `functions/voice-handler.js`

Entry point for TwiML Application voice calls. Redirects to transcribe function to start AI conversation loop.

**Endpoint:** `POST /voice-handler`

**Query Parameters:**
- `role` (string): Participant role ("agent" or "customer")
- `persona` (string): Persona name (e.g., "Sarah", "Lucy Macintosh")
- `conferenceId` (string): Conference SID

**Response:** TwiML with `<Redirect>` to transcribe endpoint

**Features:**
- Extracts role and persona from URL parameters
- Initializes conversation flow
- Logs incoming calls
- No conversation history on first call

**Example TwiML Response:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect method="POST">/transcribe?role=agent&persona=Sarah&conferenceId=CFxxx&conversationHistory=</Redirect>
</Response>
```

---

### Transcribe Function

**File:** `functions/transcribe.js`

Listens for speech input using Twilio's `<Gather>` verb and redirects to respond function.

**Endpoint:** `POST /transcribe`

**Query Parameters:**
- `role` (string): Participant role ("agent" or "customer")
- `persona` (string): Persona name
- `conferenceId` (string): Conference SID
- `conversationHistory` (string, optional): JSON-encoded conversation messages

**Response:** TwiML with `<Gather>` for speech input

**Speech Recognition Settings:**
- **Model:** `experimental_conversations` - Optimized for natural dialogue
- **Enhanced:** `true` - Higher accuracy
- **Timeout:** `auto` - Smart silence detection
- **Profanity Filter:** `false` - Captures authentic conversation
- **Action:** Redirects to `/respond` with speech result

**Agent Introduction:**
- Agents deliver scripted introduction on first message only
- Voice: Polly.Joanna-Neural
- Introduction loaded from `agents.json`

**Example TwiML Response:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech"
          action="/respond?role=agent&persona=Sarah&conferenceId=CFxxx&conversationHistory=%5B%5D"
          method="POST"
          speechTimeout="auto"
          speechModel="experimental_conversations"
          enhanced="true"
          profanityFilter="false">
    <Say voice="Polly.Joanna-Neural">Hello, this is Sarah. How can I help you today?</Say>
  </Gather>
  <Redirect method="POST">/transcribe?role=agent&persona=Sarah&conferenceId=CFxxx&conversationHistory=%5B%5D</Redirect>
</Response>
```

---

### Respond Function

**File:** `functions/respond.js`

Processes speech input via OpenAI GPT-4o and generates AI response.

**Endpoint:** `POST /respond`

**Query Parameters:**
- `role` (string): Participant role
- `persona` (string): Persona name
- `conferenceId` (string): Conference SID
- `conversationHistory` (string): JSON-encoded conversation
- `SpeechResult` (string): Transcribed speech from Gather

**OpenAI Integration:**
- **Model:** gpt-4o-mini
- **Temperature:** 0.7 (natural variation)
- **Max Tokens:** 150 (concise responses)
- **System Prompt:** Dynamically loaded from persona JSON files

**Conversation Flow:**
1. Load persona data (agent or customer)
2. Parse conversation history
3. Add system prompt (first message only)
4. Append user speech to conversation
5. Call OpenAI API
6. Add assistant response to history
7. Speak response using `<Say>`
8. Redirect back to `/transcribe` for next turn

**Error Handling:**
- Falls back to generic apology message
- Preserves conversation history on error
- Continues conversation loop

**Example TwiML Response:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Neural">I'd be happy to help you with that account issue. Let me look into it for you.</Say>
  <Redirect method="POST">/transcribe?role=agent&persona=Sarah&conferenceId=CFxxx&conversationHistory=%5B...%5D</Redirect>
</Response>
```

**Conversation History Format:**
```javascript
[
  {
    "role": "system",
    "content": "You are Sarah, a highly competent customer service agent..."
  },
  {
    "role": "user",
    "content": "I need help with my account"
  },
  {
    "role": "assistant",
    "content": "I'd be happy to help you with that account issue."
  }
]
```

---

### Persona Loader Utility

**File:** `functions/utils/persona-loader.js`

Utility function for loading agent and customer personas from JSON assets.

**Function:** `loadPersona(role, personaName)`

**Parameters:**
- `role` (string): "agent" or "customer"
- `personaName` (string): Name of persona to load

**Returns:** Persona object:
```javascript
{
  name: "Sarah",
  role: "agent",
  systemPrompt: "You are Sarah, a highly competent...",
  introduction: "Hello, this is Sarah. How can I help you today?",
  rawData: { /* original JSON data */ }
}
```

**Features:**
- Loads from `agents.json` or `customers.json` assets
- Handles wrapped data (AgentPrompts/CustomerPrompts)
- Constructs OpenAI system prompts
- Returns null for non-existent personas

**Example:**
```javascript
const { loadPersona } = require(Runtime.getFunctions()['utils/persona-loader'].path);

const agent = loadPersona('agent', 'Sarah');
const customer = loadPersona('customer', 'Lucy Macintosh');
```

---

### Transcription Webhook

**File:** `functions/transcription-webhook.js`

Processes call transcriptions and updates Segment profiles.

**Endpoint:** `POST /transcription-webhook`

**POST Parameters:**
- `TranscriptionText` (string): Full call transcription
- `CallSid` (string): Call SID
- `From` (string): Customer phone number
- `TranscriptionStatus` (string): "completed" or "failed"

**Response:** TwiML `<Response></Response>`

**Processing:**
1. Validates transcription data
2. Analyzes sentiment from text
3. Determines resolution status
4. Checks for escalation keywords
5. Counts words as call duration proxy
6. Updates Segment profile with analytics

**Sentiment Analysis:**
- Positive keywords: "thank", "great", "helpful", "resolved", "perfect"
- Negative keywords: "frustrated", "angry", "upset", "terrible", "disappointed"
- Default: "neutral"

**Resolution Detection:**
- Resolved: "resolved", "fixed", "solved", "working"
- Escalated: "escalate", "supervisor", "manager", "complaint"
- Default: "unresolved"

**Example:**

```javascript
// Configure recording with transcription
await client.calls(callSid).update({
  record: true,
  transcribe: true,
  transcribeCallback: 'https://your-service.twil.io/transcription-webhook'
});
```

---

### Error Handler (Debugger Webhook)

**File:** `functions/error-handler.js`

Receives real-time error and warning notifications from Twilio Debugger.

**Endpoint:** `POST /error-handler`

**POST Parameters (from Twilio Debugger):**
- `Sid` (string): Unique error event identifier
- `AccountSid` (string): Twilio Account SID
- `Level` (string): "ERROR" or "WARNING"
- `Timestamp` (string): ISO 8601 timestamp
- `Payload` (string/JSON): Error details including:
  - `error_code` (string): Twilio error code
  - `message` (string): Error description
  - `more_info` (string): Documentation URL
  - `resource_sid` (string): Affected resource SID
  - `request_url` (string): Failed request URL
  - `response_status_code` (number): HTTP status code

**Response:** JSON
```javascript
{
  success: true,
  errorSid: "NOxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  severity: "CRITICAL",
  remediation: {
    severity: "CRITICAL",
    actions: [
      "ALERT: Webhook endpoint may be down",
      "Check serverless function deployment status"
    ],
    automated: true
  },
  timestamp: "2025-10-09T00:15:23.456Z"
}
```

**Error Severity Classification:**

**CRITICAL** (requires immediate action):
- 11200: HTTP retrieval failure (webhook down)
- 20003: Authentication failed
- 20404: Resource not found
- 53205: Conference error

**HIGH** (needs attention):
- 11100: Invalid TwiML
- 12100: Document parse failure
- 21211: Invalid phone number
- 21217: Phone number not reachable

**MEDIUM** (non-blocking):
- 13224: Call leg already ended
- 13227: Call in wrong state

**LOW** (informational):
- All warnings

**Automated Remediation Actions:**

| Error Code | Action |
|------------|--------|
| 11200 | Alert webhook down, suggest redeployment |
| 11100 | Log invalid TwiML for review |
| 21211 | Flag invalid phone number |
| 53205 | Log conference failure, retry recommended |
| 60001 | Skip Voice Intelligence transcription |

**Security:**
- Validates `X-Twilio-Signature` header
- Rejects requests with invalid signatures
- Returns 403 for unauthorized requests

**Structured Error Logging:**

```json
{
  "errorType": "TwilioDebuggerError",
  "sid": "NOxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "level": "ERROR",
  "errorCode": "11200",
  "message": "HTTP retrieval failure",
  "resourceSid": "CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "requestUrl": "https://example.com/webhook",
  "responseStatusCode": "404",
  "timestamp": "2025-10-09T00:15:23.456Z"
}
```

**Configuration:**

1. Deploy error-handler function
2. Configure in Twilio Console:
   - Go to: https://console.twilio.com/us1/monitor/debugger
   - Click Settings (gear icon)
   - Enter webhook URL: `https://your-domain.twil.io/error-handler`
   - Save

**Helper Script:**
```bash
npm run configure-debugger
```

**Optional External Alerting:**

The function includes commented-out integrations for:
- Slack notifications
- SendGrid email alerts
- PagerDuty incidents
- GitHub issue creation

Uncomment and configure environment variables to enable.

**Example:**

```javascript
// In .env or Twilio Function environment
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

// Function will automatically send Slack notifications for CRITICAL errors
```

---

## Configuration

### Config Module

**File:** `src/config/index.js`

Centralized configuration management.

**Exports:**

```javascript
module.exports = {
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN
  },
  segment: {
    writeKey: process.env.SEGMENT_WRITE_KEY
  },
  agent: {
    phoneNumber: process.env.AGENT_PHONE_NUMBER
  }
};
```

**Usage:**

```javascript
const config = require('./src/config');

const client = twilio(config.twilio.accountSid, config.twilio.authToken);
const creator = ProfileCreator.initialize(config.segment.writeKey);
```

**Environment Variables:**

| Variable | Required | Description |
|----------|----------|-------------|
| `TWILIO_ACCOUNT_SID` | Yes | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | Yes | Twilio Auth Token |
| `SEGMENT_WRITE_KEY` | Yes | Segment Write Key |
| `AGENT_PHONE_NUMBER` | No | Default agent phone for testing |

---

## Data Models

### Customer Schema

```javascript
{
  "CustomerName": "string",           // Full name
  "PhoneNumber": "string",            // E.164 format (+15551234567)
  "ContactInformation": "string",     // Email address
  "TechnicalProficiency": "string",   // "Low" | "Medium" | "High"
  "PastInteractions": ["string"],     // Array of past interaction descriptions
  "PreferredContactMethod": "string", // "Phone" | "Email" | "Chat"
  "CurrentIssue": "string",           // Description of current issue
  "InitialSentiment": "string",       // "Frustrated" | "Neutral" | "Happy"
  "baselineRisk": number,             // 0-100, initial churn risk
  "baselinePropensity": number        // 0-100, initial propensity to buy
}
```

### Agent Schema

```javascript
{
  "AgentName": "string",              // First name only
  "PhoneNumber": "string",            // E.164 format
  "Competence": "string",             // "Low" | "Medium" | "High"
  "Communication": "string",          // "Poor" | "Average" | "Excellent"
  "Experience": "string",             // Years of experience
  "Specialization": "string"          // Area of expertise
}
```

### Call Analytics Schema

```javascript
{
  "sentiment": "string",              // "positive" | "neutral" | "negative"
  "resolution": "string",             // "resolved" | "unresolved" | "escalated"
  "escalation": boolean,              // true if escalated
  "wordCount": number                 // Proxy for call duration
}
```

### Segment Identify Event

```javascript
{
  "userId": "string",                 // "cust_{md5(phone)}"
  "traits": {
    "customer_name": "string",
    "phone_number": "string",
    "contact_information": "string",
    "technical_proficiency": "string",
    "preferred_contact_method": "string",
    "current_issue": "string",
    "initial_sentiment": "string",
    "churn_risk_score": number,       // 0-100
    "propensity_to_buy": number,      // 0-100
    "satisfaction_score": number,     // 0-100
    "total_calls": number,
    "last_call_sentiment": "string",
    "last_call_resolution": "string"
  },
  "timestamp": "ISO8601"
}
```

### Segment Track Event

```javascript
{
  "userId": "string",
  "event": "call_completed",
  "properties": {
    "sentiment": "string",
    "resolution": "string",
    "escalation": boolean,
    "word_count": number,
    "churn_risk_score": number,
    "propensity_to_buy": number,
    "satisfaction_score": number,
    "call_sid": "string",
    "conference_sid": "string"
  },
  "timestamp": "ISO8601"
}
```

---

## Error Handling

### Common Error Types

**Validation Errors:**
```javascript
throw new Error('CustomerName is required');
throw new Error('Invalid phone number format');
```

**Twilio API Errors:**
```javascript
{
  status: 400,
  message: 'Invalid To phone number',
  code: 21211
}
```

**Segment API Errors:**
```javascript
{
  message: 'Invalid write key',
  status: 401
}
```

### Retry Logic

Add-participant functions implement exponential backoff:

```javascript
const delays = [1000, 2000, 4000]; // ms

for (const delay of delays) {
  try {
    return await operation();
  } catch (err) {
    if (!isRetryable(err)) throw err;
    await sleep(delay);
  }
}
```

---

## Testing

### Unit Tests

```bash
npm test
```

### Coverage Report

```bash
npm run test:coverage
```

### E2E Tests

```bash
npm run test:e2e
```

### Smoke Test

```bash
npm run smoke-test
```

---

## Examples

### Complete Pipeline Example

```javascript
const twilio = require('twilio');
const config = require('./src/config');
const { loadCustomers } = require('./src/personas/customer-loader');
const { loadAgents } = require('./src/personas/agent-loader');
const { selectPair } = require('./src/pairing/pair-selector');
const ProfileCreator = require('./src/segment/profile-creator');
const ProfileUpdater = require('./src/segment/profile-updater');
const { createConference } = require('./src/orchestration/conference-orchestrator');

async function main() {
  // 1. Initialize clients
  const twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
  const profileCreator = ProfileCreator.initialize(config.segment.writeKey);
  const profileUpdater = ProfileUpdater.initialize(config.segment.writeKey);

  // 2. Load personas
  const customers = loadCustomers();
  const agents = loadAgents();

  // 3. Select pairing
  const { customer, agent } = selectPair(customers, agents);
  console.log(`Pairing: ${customer.CustomerName} → ${agent.AgentName}`);

  // 4. Create Segment profiles
  await profileCreator.createBatchProfiles(customers);

  // 5. Create conference
  const result = await createConference(
    twilioClient,
    agent.PhoneNumber,
    customer,
    agent
  );

  console.log(`Conference: ${result.conference.sid}`);

  // 6. Simulate call completion (in production, triggered by webhook)
  const analytics = {
    sentiment: 'positive',
    resolution: 'resolved',
    escalation: false,
    wordCount: 250
  };

  const userId = `cust_${crypto.createHash('md5')
    .update(customer.PhoneNumber)
    .digest('hex')}`;

  await profileUpdater.updateFromCallAnalytics(userId, analytics);

  console.log('Pipeline complete!');
}

main().catch(console.error);
```

---

## Rate Limits

### Twilio API

- **Conference creation**: 100/second
- **Participant addition**: 100/second
- **API calls**: 10,000/hour (adjustable)

### Segment API

- **Events**: 500 events/second
- **Batch size**: 100 events/batch
- **Max payload**: 32KB

---

## Support

- **Twilio Docs**: https://www.twilio.com/docs
- **Segment Docs**: https://segment.com/docs
- **GitHub Issues**: [Create an issue](https://github.com/your-repo/issues)

---

**API Version:** 1.0.0
**Last Updated:** 2025-01-15
