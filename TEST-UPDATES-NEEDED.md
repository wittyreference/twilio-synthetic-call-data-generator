# Test Updates Needed After Today's Changes

## Summary of Changes Made

1. **Sync-based architecture**: Conference creation now stores persona data in Sync
2. **Recording enabled**: Added `record: true` to participant creation
3. **Timer documentation**: Changed from "scheduled: true" to "scheduled: false" with note
4. **SID-tracked validation**: New validation script that traces Conference → Recordings → Transcripts → Operators

## Tests That Need Updates

### 1. ❌ CRITICAL: Newman/Postman Tests (CURRENTLY BROKEN)

**File**: `postman/collection.json`
**Issue**: Tests check HTTP 201 response but DON'T validate actual call creation

**Current Test** (Lines 57-82):
```javascript
pm.test('Status code is 201 Created', function () {
    pm.response.to.have.status(201);
});

pm.test('Response has conference SID', function () {
    const jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('conferenceSid');
});

pm.test('Timer is scheduled', function () {
    const jsonData = pm.response.json();
    pm.expect(jsonData.timerScheduled).to.be.true;  // ← THIS WILL FAIL NOW
});
```

**Problems**:
1. ❌ Checks `timerScheduled: true` but we now return `scheduled: false`
2. ❌ Doesn't validate conference was actually created in Twilio
3. ❌ Returns friendly name as `conferenceId` not actual Conference SID
4. ❌ Doesn't check if recordings are being generated

**Fix Needed**:
```javascript
pm.test('Conference creation response', function () {
    const jsonData = pm.response.json();
    pm.expect(jsonData.success).to.be.true;
    pm.expect(jsonData).to.have.property('conferenceId');
    pm.expect(jsonData).to.have.property('customer');
    pm.expect(jsonData).to.have.property('agent');

    // Store for subsequent tests
    pm.environment.set('conferenceId', jsonData.conferenceId);
    pm.environment.set('customerCallSid', jsonData.customer.callSid);
    pm.environment.set('agentCallSid', jsonData.agent.callSid);
});

// NEW TEST: Validate actual conference exists
pm.test('Conference actually created in Twilio', function () {
    const conferenceId = pm.environment.get('conferenceId');

    // Query Twilio API to confirm conference exists
    pm.sendRequest({
        url: `https://api.twilio.com/2010-04-01/Accounts/{{TWILIO_ACCOUNT_SID}}/Conferences.json?FriendlyName=${conferenceId}`,
        method: 'GET',
        header: {
            'Authorization': 'Basic ' + btoa('{{TWILIO_ACCOUNT_SID}}:{{TWILIO_AUTH_TOKEN}}')
        }
    }, function (err, response) {
        pm.expect(err).to.be.null;
        pm.expect(response.json().conferences.length).to.be.greaterThan(0);

        // Store actual Conference SID
        const actualConferenceSid = response.json().conferences[0].sid;
        pm.environment.set('actualConferenceSid', actualConferenceSid);
    });
});

// NEW TEST: Validate recordings are being generated
pm.test('Recordings are being generated', function () {
    const customerCallSid = pm.environment.get('customerCallSid');
    const agentCallSid = pm.environment.get('agentCallSid');

    // Check customer call has recording
    pm.sendRequest({
        url: `https://api.twilio.com/2010-04-01/Accounts/{{TWILIO_ACCOUNT_SID}}/Recordings.json?CallSid=${customerCallSid}`,
        method: 'GET',
        header: {
            'Authorization': 'Basic ' + btoa('{{TWILIO_ACCOUNT_SID}}:{{TWILIO_AUTH_TOKEN}}')
        }
    }, function (err, response) {
        pm.expect(err).to.be.null;
        // Recording might still be processing, but should exist
        pm.expect(response.json().recordings.length).to.equal(1);
    });
});

// UPDATE: Timer test reflects new behavior
pm.test('Timer metadata provided', function () {
    const jsonData = pm.response.json();
    pm.expect(jsonData.timer).to.have.property('scheduled');
    pm.expect(jsonData.timer).to.have.property('timerUrl');
    pm.expect(jsonData.timer).to.have.property('suggestedTerminateAt');
    // Note: scheduled will be false (requires external scheduler)
});
```

### 2. ⚠️  Unit Tests: voice-handler.test.js

**File**: `tests/unit/functions/voice-handler.test.js`
**Issue**: Doesn't test new Sync retrieval path

**New Test Needed**:
```javascript
describe('Sync-based participant data', () => {
  it('should fetch participant data from Sync when syncKey provided', async () => {
    const mockSyncDoc = {
      data: {
        role: 'agent',
        name: 'Sarah',
        systemPrompt: 'You are a helpful agent...',
        introduction: 'Hi, my name is Sarah...',
      },
    };

    mockContext.getTwilioClient = jest.fn().mockReturnValue({
      sync: {
        v1: {
          services: jest.fn().mockReturnValue({
            documents: jest.fn().mockReturnValue({
              fetch: jest.fn().mockResolvedValue(mockSyncDoc),
            }),
          }),
        },
      },
    });

    mockEvent.syncKey = 'synth-call-123_agent';

    await voiceHandler.handler(mockContext, mockEvent, mockCallback);

    expect(mockContext.getTwilioClient).toHaveBeenCalled();
    expect(mockResponse.body).toContain('transcribe');
    expect(mockResponse.body).toContain('role=agent');
    expect(mockResponse.body).toContain('persona=Sarah');
  });

  it('should fall back to legacy URL parameters when no syncKey', async () => {
    mockEvent.role = 'customer';
    mockEvent.persona = 'Lucy';
    mockEvent.conferenceId = 'test-123';

    await voiceHandler.handler(mockContext, mockEvent, mockCallback);

    expect(mockResponse.body).toContain('transcribe');
    expect(mockResponse.body).toContain('role=customer');
    expect(mockResponse.body).toContain('persona=Lucy');
  });
});
```

### 3. ✅ NEW: Unit Tests for create-conference.js

**File**: `tests/unit/functions/create-conference.test.js` (DOESN'T EXIST)
**Status**: MISSING

**Tests Needed**:
```javascript
describe('Create Conference Function', () => {
  describe('Sync storage', () => {
    it('should store participant data in Sync before creating participant', async () => {
      // Test that Sync document is created with persona data
    });

    it('should pass only syncKey in participant URL (not full persona)', async () => {
      // Test that URL is < 100 chars instead of 800+
    });
  });

  describe('Recording configuration', () => {
    it('should enable recording on participant creation', async () => {
      // Test that record: true is set
    });

    it('should configure recording status callback', async () => {
      // Test recordingStatusCallback is set
    });
  });

  describe('Timer scheduling', () => {
    it('should return scheduled: false with note about external scheduler', async () => {
      // Test new timer metadata
    });
  });
});
```

### 4. ⚠️  Integration Tests

**File**: `tests/integration/local-execution.test.js`
**Issue**: Doesn't test Sync usage or recording generation

**New Tests Needed**:
```javascript
describe('Sync Integration', () => {
  it('should store and retrieve persona data from Sync', async () => {
    // Create conference
    // Verify Sync documents were created
    // Verify data can be retrieved
  });
});

describe('Recording Generation', () => {
  it('should generate recordings for each participant', async () => {
    // Create conference
    // Wait for calls to start
    // Query Twilio for recordings by call SID
    // Verify 2 recordings exist (1 per participant)
  });
});
```

### 5. ✅ NEW: E2E Tests with SID Tracking

**File**: `tests/e2e/complete-pipeline.test.js` (DOESN'T EXIST)
**Status**: MISSING

**Tests Needed**:
```javascript
describe('Complete Pipeline E2E', () => {
  it('should track Conference → Participants → Recordings → Transcripts → Operators', async () => {
    // Use validate-specific-conferences.js logic
    // Create conference
    // Wait for completion
    // Validate entire chain with actual SIDs
  });
});
```

### 6. ❌ CRITICAL: Smoke Tests

**File**: `scripts/smoke-test.js`
**Issue**: Unknown if it validates actual call creation or just HTTP responses

**Check Needed**: Review smoke test to ensure it's using SID-tracking validation

## Priority Order

1. **CRITICAL**: Fix Newman/Postman tests (breaks CI/CD)
   - Update timer assertion
   - Add actual conference validation
   - Add recording validation

2. **HIGH**: Add missing create-conference.js unit tests
   - Test Sync storage
   - Test recording configuration
   - Test new timer behavior

3. **MEDIUM**: Update voice-handler.test.js
   - Test Sync retrieval path
   - Test backward compatibility

4. **MEDIUM**: Add integration tests
   - Test Sync round-trip
   - Test recording generation

5. **LOW**: Add E2E tests
   - Full pipeline validation with SID tracking

## Test Coverage Impact

**Before**:
- 634 unit tests (all mocked)
- Newman tests (HTTP responses only)
- No integration tests
- No E2E tests with actual validation

**After** (when complete):
- ~650 unit tests (including new Sync/recording tests)
- Newman tests (validates actual Twilio resources)
- ~10 integration tests (real execution)
- ~5 E2E tests (complete pipeline)

## Commands to Run

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# Newman/API tests (will FAIL until fixed)
npm run test:api

# Smoke tests
npm run smoke-test

# All tests
npm test
```

## Acceptance Criteria

Tests pass when:
- ✅ Newman tests validate actual conference creation (not just HTTP 200)
- ✅ Newman tests don't expect `timerScheduled: true`
- ✅ Unit tests cover Sync storage/retrieval
- ✅ Unit tests cover recording configuration
- ✅ Integration tests validate recordings are generated
- ✅ No false positives (claiming success without proof)
