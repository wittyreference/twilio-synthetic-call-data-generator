# Post-Mortem: OpenAI API Regression & Infinite Error Loops

## Date: October 15, 2025
## Incident: Transcripts contained only error messages, conferences ran for 25 minutes instead of 5

---

## Executive Summary

**What happened**: After generating 10 synthetic conferences for validation, discovered that all transcripts contained only the error message "I apologize, but I am experiencing technical difficulties. Please try again." repeated infinitely between agent and customer. Additionally, conferences were running for 24-25 minutes instead of the expected 5-minute auto-termination.

**Impact**:
- Zero useful transcript data generated
- ~5x higher costs than expected ($16.50 vs $3.30 per 10 calls)
- Pipeline producing unusable data without detection
- Would have gone unnoticed without manual transcript inspection

**Root Causes**:
1. OpenAI API parameter incompatibility (gpt-5-nano model changes)
2. Conference auto-termination not implemented (placeholder code)

---

## Timeline of Events

### Initial Discovery
1. ✅ **10 conferences created successfully** - All API calls returned 200 OK
2. ✅ **Recordings created** - 20 recordings (2 per conference)
3. ✅ **Transcripts created** - 100+ transcripts with language operators
4. ❌ **Manual inspection reveals error loops** - Transcripts contain only error messages
5. ❌ **Call duration anomaly** - Conferences lasting 24-25 minutes, not 5

### Investigation Phase 1: Initial Hypothesis (WRONG)
- **Hypothesis**: Timing issue - customer joining before agent finishes introduction
- **Attempted Fix**: Added 10-second pause for customer's first call
- **Result**: User (MC) correctly identified this as a bandaid fix and redirected investigation

### Investigation Phase 2: Root Cause Discovery
- **Checked serverless logs**: Found critical OpenAI API errors
- **Error**: `BadRequestError: 400 Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.`
- **Secondary Error**: `BadRequestError: 400 Unsupported value: 'temperature' does not support 0.7 with this model. Only the default (1) value is supported.`

### Fix Implementation
1. ✅ **Fixed OpenAI parameters** in `functions/respond.js:152-158`
2. ✅ **Fixed auto-termination** in `functions/create-conference.js:149`
3. ✅ **Deployed fixes** to serverless
4. ✅ **Created regression tests** to prevent future occurrences

---

## Root Cause Analysis

### Problem #1: OpenAI API Parameter Incompatibility

**The Issue**:
```javascript
// BROKEN CODE (functions/respond.js:152-159)
const completion = await openai.chat.completions.create({
  model: 'gpt-5-nano',
  messages: messages,
  temperature: 0.7,        // ❌ NOT SUPPORTED by gpt-5-nano
  max_tokens: 150,         // ❌ DEPRECATED parameter
});
```

**Why This Failed**:
- OpenAI updated their API - `max_tokens` is now deprecated in favor of `max_completion_tokens`
- The `gpt-5-nano` model only supports default temperature (1), not custom values
- Every single OpenAI API call threw a 400 BadRequest error

**The Cascade**:
1. OpenAI API call fails → throws exception
2. Exception handler speaks error message: "I apologize, but I am experiencing technical difficulties..."
3. Error message is captured by TTS and spoken to other participant
4. Other participant's `<Gather>` captures the error message text
5. Sends error message to respond.js → OpenAI fails again → speaks error message
6. **Infinite loop** of both participants repeating error messages to each other

**Why Tests Didn't Catch This**:
- No integration tests validating actual OpenAI API parameters
- Mocked tests assumed API would accept any parameters
- No E2E tests checking transcript content quality

**The Fix**:
```javascript
// FIXED CODE (functions/respond.js:152-158)
const completion = await openai.chat.completions.create({
  model: 'gpt-5-nano',
  messages: messages,
  max_completion_tokens: 150,  // ✅ Correct parameter
  // temperature removed - uses default (1)
});
```

---

### Problem #2: Conference Auto-Termination Not Implemented

**The Issue**:
```javascript
// PLACEHOLDER CODE (functions/create-conference.js:162-184)
// Note: Conference auto-termination
// Conferences will run until natural completion (customer or agent hangs up)
// For manual termination after 5 minutes, call the conference-timer endpoint:
// POST https://DOMAIN/conference-timer with {"ConferenceSid": "CFXXXX"}
//
// To implement auto-termination, use an external scheduler service (AWS EventBridge,
// Zapier, etc.) to call the timer endpoint 5 minutes after conference creation
async function scheduleConferenceTermination(context, conferenceId, client) {
  return {
    scheduled: false,
    note: 'Auto-termination requires external scheduler service',
    // ...
  };
}
```

**Why This Failed**:
- Code comment suggested "external scheduler service" was needed
- No actual scheduling implemented
- Conferences ran until participants hung up or hit other limits (24-25 minutes observed)

**Why Tests Didn't Catch This**:
- No tests validating conference duration
- Test conferences were manually terminated
- Cost impact only visible at scale

**The Fix**:
```javascript
// FIXED CODE (functions/create-conference.js:143-158)
const participantObj = await client
  .conferences(conferenceId)
  .participants.create({
    from: twilioPhoneNumber,
    to: `app:${twimlAppSid}?syncKey=${encodeURIComponent(syncKey)}`,
    earlyMedia: true,
    endConferenceOnExit: false,
    beep: false,
    timeLimit: 300,  // ✅ Auto-terminate after 5 minutes (built-in Twilio feature)
    record: true,
    // ...
  });
```

**No External Scheduler Needed**: Twilio's built-in `timeLimit` parameter automatically hangs up participants after specified seconds.

---

## Impact Analysis

### Financial Impact

**Before Fix** (25-minute calls):
- 10 calls × 25 minutes × 2 participants = 500 minutes
- Twilio Voice: 500 min × $0.013 = $6.50
- Voice Intelligence: 500 min × $0.02 = $10.00
- **Total: $16.50 per 10 calls**

**After Fix** (5-minute calls):
- 10 calls × 5 minutes × 2 participants = 100 minutes
- Twilio Voice: 100 min × $0.013 = $1.30
- Voice Intelligence: 100 min × $0.02 = $2.00
- **Total: $3.30 per 10 calls**

**Savings**: 80% cost reduction ($13.20 per 10 calls)

**At Scale** (1000 calls/day default):
- Before: $1,650/day
- After: $330/day
- **Annual savings: $481,800**

### Data Quality Impact

**Before Fix**:
- 0% usable transcripts (all error messages)
- No meaningful language operator analysis
- No customer sentiment data
- No actionable insights

**After Fix**:
- 100% real AI conversations expected
- Meaningful language operator analysis
- Accurate customer sentiment
- Actionable business insights

---

## Prevention Measures Implemented

### 1. OpenAI API Compatibility Test
**File**: `tests/integration/openai-api-parameters.test.js`

**What It Does**:
- Static code analysis (< 1 second)
- Validates `max_completion_tokens` is used (not deprecated `max_tokens`)
- Validates no unsupported `temperature` parameter
- Validates gpt-5-nano model is specified

**How It Prevents Regression**:
```bash
$ npm test tests/integration/openai-api-parameters.test.js

✓ respond.js should use max_completion_tokens (not deprecated max_tokens)
✓ respond.js should NOT set custom temperature for gpt-5-nano
✓ respond.js should use gpt-5-nano model
✓ respond.js should set max_completion_tokens to 150

Test Suites: 1 passed, 1 total
Tests:       4 passed, 4 total
```

If someone accidentally reverts to `max_tokens` or adds `temperature` back, tests fail immediately.

### 2. Transcript Content Validation Test
**File**: `tests/e2e/transcript-content-validation.test.js`

**What It Does**:
- Creates real conference via API
- Waits for conversation and transcription
- Validates transcript content quality:
  - ❌ NO error message loops
  - ✅ Multi-speaker conversation
  - ✅ Agent introduction present
  - ✅ Contextual customer responses

**How It Prevents Regression**:
- Runs full E2E pipeline (~6-7 minutes)
- Catches any issue that breaks conversations
- Validates actual transcript content (not just existence)

**Example Failure Detection**:
```javascript
const errorMessages = transcript.sentences.filter(s =>
  s.text.toLowerCase().includes('experiencing technical difficulties')
);

expect(errorMessages.length).toBe(0);  // Would fail if regression occurs
```

### 3. Documentation Updates
- Added **Cost Controls Built-in** section to README
- Created **Regression Prevention Tests** documentation
- Created this post-mortem for future reference
- Created CHANGELOG.md to track all changes

---

## Lessons Learned

### What Went Well ✅
1. **User caught the issue** - MC manually inspected transcripts and found the problem
2. **Comprehensive logging** - Serverless logs contained exact error messages
3. **Quick root cause identification** - Found exact line number and parameter causing failure
4. **Simple fix** - Two parameter changes resolved both issues
5. **Test-first response** - Created tests to prevent future regressions

### What Went Wrong ❌
1. **No parameter validation tests** - Assumed OpenAI API calls would work
2. **No transcript content validation** - Only checked that transcripts existed, not their content
3. **No cost monitoring alerts** - 25-minute calls should have triggered alerts
4. **Incomplete implementation** - Auto-termination was placeholder code
5. **API compatibility assumptions** - Didn't validate parameters against model documentation

### What We'll Do Differently 🎯

#### Immediate Actions (Completed)
- ✅ Fix OpenAI API parameters
- ✅ Implement conference auto-termination
- ✅ Create regression tests
- ✅ Update documentation

#### Short-Term Actions (Next Sprint)
- [ ] Add cost monitoring alerts (warn if call > 6 minutes)
- [ ] Add OpenAI API health check in smoke tests
- [ ] Add transcript content sampling to post-deployment validation
- [ ] Create runbook for "transcripts contain errors" scenario

#### Long-Term Actions (Next Quarter)
- [ ] Implement contract testing for OpenAI API
- [ ] Add synthetic monitoring for transcript quality
- [ ] Create cost dashboard showing per-call and daily spend
- [ ] Implement automated canary deployments with transcript validation

---

## Detection & Response Improvements

### How We Detected This
- ❌ **Manual inspection** - User reviewed transcripts and found error messages
- ✅ **Good logging** - Serverless logs showed exact API errors

### How We SHOULD Have Detected This
- Automated transcript content sampling
- OpenAI API error rate monitoring
- Cost anomaly detection (25-minute calls vs expected 5-minute)
- Post-deployment smoke test checking actual transcript content

### Future Detection Mechanisms

#### 1. Transcript Quality Sampling
```javascript
// Run after each deployment
async function sampleTranscriptQuality() {
  const recentTranscripts = await getRecentTranscripts(5);

  for (const transcript of recentTranscripts) {
    const errorRate = calculateErrorMessageRate(transcript);

    if (errorRate > 0.1) {  // More than 10% error messages
      alert('Transcript quality degradation detected');
      rollback();
    }
  }
}
```

#### 2. Cost Anomaly Detection
```javascript
// Monitor average call duration
async function monitorCallDuration() {
  const avgDuration = await getAverageCallDuration(last: 10);

  if (avgDuration > 360) {  // More than 6 minutes
    alert('Call duration exceeds expected 5-minute limit');
    investigateAutoTermination();
  }
}
```

#### 3. OpenAI API Health Check
```javascript
// Add to smoke tests
test('OpenAI API responds successfully', async () => {
  const response = await openai.chat.completions.create({
    model: 'gpt-5-nano',
    messages: [{ role: 'user', content: 'test' }],
    max_completion_tokens: 10,
  });

  expect(response.choices[0].message.content).toBeDefined();
  expect(response.choices[0].message.content.length).toBeGreaterThan(0);
});
```

---

## Action Items

### Completed ✅
- [x] Fix OpenAI API parameters (max_completion_tokens, remove temperature)
- [x] Implement conference auto-termination (timeLimit: 300)
- [x] Create OpenAI parameter regression test
- [x] Create transcript content validation E2E test
- [x] Update README with cost controls and regression test docs
- [x] Create CHANGELOG.md
- [x] Write this post-mortem
- [x] Deploy fixes to production
- [x] Commit and push all changes

### Pending 📋
- [ ] Add cost monitoring alerts to production
- [ ] Implement transcript quality sampling in post-deployment validation
- [ ] Add OpenAI health check to smoke tests
- [ ] Create operational runbook for transcript quality issues
- [ ] Set up automated canary deployments

---

## References

- **Commit**: `a3c26db` - Fix OpenAI API parameter compatibility for gpt-5-nano model
- **Commit**: `25a0b69` - Add conference auto-termination and comprehensive regression tests
- **Related Files**:
  - `functions/respond.js` - OpenAI API call
  - `functions/create-conference.js` - Conference creation with auto-termination
  - `tests/integration/openai-api-parameters.test.js` - Regression prevention
  - `tests/e2e/transcript-content-validation.test.js` - Quality validation

---

## Approvals

- **Incident Commander**: Claude Code (AI Assistant)
- **Reviewed By**: Michael Carpenter (@wittyreference)
- **Date**: October 15, 2025

---

**Key Takeaway**: The whole point of this exercise was to generate real AI conversations for transcripts. Without manual inspection, we would have deployed a system that appeared to work (200 OK, transcripts created, operators applied) but produced zero usable data. This reinforces the importance of E2E validation that checks **output quality**, not just **output existence**.
