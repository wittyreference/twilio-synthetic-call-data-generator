#!/usr/bin/env node
// ABOUTME: Live end-to-end test for conference creation with app: prefix participants
// ABOUTME: Creates a real conference using Twilio API and validates the full flow

require('dotenv').config();
const twilio = require('twilio');
const { loadCustomers } = require('../src/personas/customer-loader');
const { loadAgents } = require('../src/personas/agent-loader');
const PairSelector = require('../src/pairing/pair-selector');

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function success(message) {
  log(`✓ ${message}`, 'green');
}

function error(message) {
  log(`✗ ${message}`, 'red');
}

function info(message) {
  log(`ℹ ${message}`, 'blue');
}

function header(message) {
  log(`\n${'═'.repeat(70)}`, 'cyan');
  log(`  ${message}`, 'cyan');
  log(`${'═'.repeat(70)}`, 'cyan');
}

async function validateEnvironment() {
  const required = [
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'AGENT_PHONE_NUMBER',
    'TWIML_APP_SID',
  ];

  for (const key of required) {
    if (!process.env[key]) {
      error(`Missing required environment variable: ${key}`);
      return false;
    }
  }

  return true;
}

async function testConferenceCreation() {
  header('Live Conference Creation Test with app: Prefix');

  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  try {
    // Step 1: Generate simple conference name (12 char alphanumeric)
    info('Step 1: Generating conference name...');
    const conferenceName = `test-${Math.random().toString(36).substring(2, 14)}`;
    success(`Conference name: ${conferenceName}`);

    // Step 2: Select a pair
    info('\nStep 2: Selecting customer-agent pair...');
    const pairSelector = new PairSelector();
    const pair = pairSelector.selectRandomPair();
    success(`Selected: ${pair.customer.CustomerName} <-> ${pair.agent.AgentName}`);

    // Step 3: Add agent participant using app: prefix (conference will be created automatically)
    info('\nStep 3: Adding agent participant with app: prefix...');
    info('  (Conference will be created when agent joins)');

    const agentAppUrl = `app:${process.env.TWIML_APP_SID}?role=agent&persona=${encodeURIComponent(pair.agent.AgentName)}&conferenceId=${encodeURIComponent(conferenceName)}`;

    info(`  Agent app URL: ${agentAppUrl.substring(0, 60)}...`);

    const agentParticipant = await client.conferences(conferenceName)
      .participants
      .create({
        from: process.env.AGENT_PHONE_NUMBER,
        to: agentAppUrl,
        earlyMedia: true,
        endConferenceOnExit: false,
        beep: false,
        label: 'agent',
      });

    success(`Agent participant added: ${agentParticipant.sid}`);
    info(`  Call SID: ${agentParticipant.callSid}`);
    info(`  Status: ${agentParticipant.status}`);

    // Wait for agent to connect and conference to be created
    info('\nStep 4: Waiting for agent to join conference...');
    let conferenceCreated = false;
    let attempts = 0;
    let conference = null;

    while (!conferenceCreated && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;

      const conferences = await client.conferences.list({
        friendlyName: conferenceName,
        limit: 1
      });

      if (conferences.length > 0) {
        conference = conferences[0];
        conferenceCreated = true;
        success(`Conference created: ${conference.sid}`);
        info(`  Status: ${conference.status}`);
      } else {
        info(`  Attempt ${attempts}/10: Conference not yet created...`);
      }
    }

    if (!conferenceCreated) {
      error('Conference was not created after agent was added!');
      return { success: false, error: 'Conference not created' };
    }

    // Step 5: Add customer participant using app: prefix
    info('\nStep 5: Adding customer participant with app: prefix...');
    const customerAppUrl = `app:${process.env.TWIML_APP_SID}?role=customer&persona=${encodeURIComponent(pair.customer.CustomerName)}&conferenceId=${encodeURIComponent(conferenceName)}`;

    info(`  Customer app URL: ${customerAppUrl.substring(0, 60)}...`);

    const customerParticipant = await client.conferences(conferenceName)
      .participants
      .create({
        from: process.env.AGENT_PHONE_NUMBER,
        to: customerAppUrl,
        earlyMedia: true,
        endConferenceOnExit: false,
        beep: false,
        label: 'customer',
      });

    success(`Customer participant added: ${customerParticipant.sid}`);
    info(`  Call SID: ${customerParticipant.callSid}`);
    info(`  Status: ${customerParticipant.status}`);

    // Step 6: Wait for both participants to join
    info('\nStep 6: Waiting for both participants to join conference...');
    let bothJoined = false;
    let joinAttempts = 0;
    let participants = [];

    while (!bothJoined && joinAttempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      joinAttempts++;

      participants = await client.conferences(conference.sid)
        .participants
        .list();

      info(`  Attempt ${joinAttempts}/10: ${participants.length} participant(s) in conference`);

      if (participants.length === 2) {
        bothJoined = true;
        success('Both participants joined!');
      }
    }

    // Show participant details
    success(`Total participants: ${participants.length}`);
    for (const p of participants) {
      info(`  - ${p.label || 'unlabeled'}: ${p.callSid} (${p.status})`);
    }

    if (!bothJoined) {
      error(`Only ${participants.length} participant(s) joined (expected 2)`);
      // Don't fail - continue with cleanup
    }

    // Step 7: Terminate conference
    info('\nStep 7: Terminating test conference...');
    await client.conferences(conference.sid).update({
      status: 'completed'
    });

    success('Conference terminated successfully');

    // Step 8: Clean up - end all participant calls
    info('\nStep 8: Cleaning up participant calls...');
    for (const p of participants) {
      try {
        await client.calls(p.callSid).update({ status: 'completed' });
        info(`  Ended call: ${p.callSid}`);
      } catch (err) {
        // Call may already be ended
        info(`  Call already ended: ${p.callSid}`);
      }
    }

    return {
      success: bothJoined,
      conferenceId: conferenceName,
      conferenceSid: conference.sid,
      participants: participants.length,
    };

  } catch (err) {
    error(`Test failed: ${err.message}`);
    if (err.code) {
      error(`  Error code: ${err.code}`);
    }
    if (err.moreInfo) {
      error(`  More info: ${err.moreInfo}`);
    }
    console.error('\nFull error:', err);
    return {
      success: false,
      error: err.message,
    };
  }
}

async function main() {
  log('\n╔══════════════════════════════════════════════════════════════════╗', 'cyan');
  log('║        LIVE END-TO-END CONFERENCE CREATION TEST                  ║', 'cyan');
  log('║        Testing app: prefix with Participants API                 ║', 'cyan');
  log('╚══════════════════════════════════════════════════════════════════╝', 'cyan');

  // Validate environment
  if (!await validateEnvironment()) {
    error('\nEnvironment validation failed. Please check your .env file.');
    process.exit(1);
  }

  success('Environment validated\n');

  // Run the test
  const result = await testConferenceCreation();

  // Summary
  header('Test Summary');

  if (result.success) {
    success('✅ LIVE E2E TEST PASSED!');
    log('─'.repeat(70), 'cyan');
    success(`Conference ID: ${result.conferenceId}`);
    success(`Conference SID: ${result.conferenceSid}`);
    success(`Participants added: ${result.participants}`);
    log('─'.repeat(70), 'cyan');
    log('\n🎉 The app: prefix works with Participants API!', 'green');
    log('🎉 Conference creation flow is fully operational!\n', 'green');
    process.exit(0);
  } else {
    error('❌ LIVE E2E TEST FAILED');
    log('─'.repeat(70), 'cyan');
    error(`Error: ${result.error}`);
    log('─'.repeat(70), 'cyan');
    log('\n⚠️  Check the error details above.\n', 'yellow');
    process.exit(1);
  }
}

main().catch(err => {
  error(`\nTest crashed: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
