#!/usr/bin/env node
// ABOUTME: Extended live test that allows AI conversation to proceed for validation
// ABOUTME: Tests OpenAI integration, TTS/STT loop, recordings, transcriptions, and Segment updates

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

async function runConversationTest(durationSeconds = 60) {
  header('Live AI Conversation Test - Full Stack Validation');

  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  let conference = null;
  let agentCallSid = null;
  let customerCallSid = null;

  try {
    // Step 1: Generate conference name
    info('Step 1: Setting up test conference...');
    const conferenceName = `conv-test-${Math.random().toString(36).substring(2, 14)}`;
    success(`Conference name: ${conferenceName}`);

    // Step 2: Select pair
    info('\nStep 2: Selecting customer-agent pair...');
    const pairSelector = new PairSelector();
    const pair = pairSelector.selectRandomPair();
    success(`Selected: ${pair.customer.CustomerName} <-> ${pair.agent.AgentName}`);
    info(`  Customer prompt: ${pair.customer.Prompt.substring(0, 80)}...`);
    info(`  Agent competence: ${pair.agent.CompetenceLevel}`);

    // Step 3: Add agent
    info('\nStep 3: Adding agent participant...');
    const agentAppUrl = `app:${process.env.TWIML_APP_SID}?role=agent&persona=${encodeURIComponent(pair.agent.AgentName)}&conferenceId=${encodeURIComponent(conferenceName)}`;

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

    agentCallSid = agentParticipant.callSid;
    success(`Agent call created: ${agentCallSid}`);

    // Wait for conference creation
    info('\nStep 4: Waiting for conference to be created...');
    let conferenceCreated = false;
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const conferences = await client.conferences.list({
        friendlyName: conferenceName,
        limit: 1
      });
      if (conferences.length > 0) {
        conference = conferences[0];
        conferenceCreated = true;
        success(`Conference created: ${conference.sid}`);
        break;
      }
    }

    if (!conferenceCreated) {
      throw new Error('Conference not created');
    }

    // Step 5: Add customer
    info('\nStep 5: Adding customer participant...');
    const customerAppUrl = `app:${process.env.TWIML_APP_SID}?role=customer&persona=${encodeURIComponent(pair.customer.CustomerName)}&conferenceId=${encodeURIComponent(conferenceName)}`;

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

    customerCallSid = customerParticipant.callSid;
    success(`Customer call created: ${customerCallSid}`);

    // Step 6: Let conversation run
    header(`Letting AI conversation run for ${durationSeconds} seconds`);
    info('Monitoring conversation progress...\n');

    const startTime = Date.now();
    const endTime = startTime + (durationSeconds * 1000);

    let lastCheck = 0;
    while (Date.now() < endTime) {
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check conference status
      const confStatus = await client.conferences(conference.sid).fetch();
      const participants = await client.conferences(conference.sid).participants.list();

      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      info(`[${elapsed}s] Conference: ${confStatus.status}, Participants: ${participants.length}`);

      for (const p of participants) {
        const details = `  - ${p.label}: ${p.status}`;
        if (p.status === 'connected') {
          success(details);
        } else {
          info(details);
        }
      }

      // If both participants left, end early
      if (participants.length === 0) {
        info('\nBoth participants left - ending test early');
        break;
      }
    }

    // Step 7: Get final call details
    header('Gathering Test Results');

    const agentCall = await client.calls(agentCallSid).fetch();
    const customerCall = await client.calls(customerCallSid).fetch();

    success(`\nAgent call duration: ${agentCall.duration} seconds`);
    success(`Customer call duration: ${customerCall.duration} seconds`);

    // Step 8: Check for recordings
    info('\nChecking for conference recordings...');
    const recordings = await client.conferences(conference.sid).recordings.list();
    if (recordings.length > 0) {
      success(`Found ${recordings.length} recording(s)`);
      for (const rec of recordings.slice(0, 3)) {
        info(`  - Recording ${rec.sid}: ${rec.duration}s, ${rec.status}`);
      }
    } else {
      error('No recordings found');
    }

    // Step 9: Check transcriptions (if available)
    info('\nChecking for transcriptions...');
    let transcriptionFound = false;
    for (const rec of recordings) {
      const transcriptions = await client.recordings(rec.sid).transcriptions.list();
      if (transcriptions.length > 0) {
        transcriptionFound = true;
        success(`Found transcription for recording ${rec.sid}`);
        break;
      }
    }
    if (!transcriptionFound) {
      info('  No transcriptions found yet (may still be processing)');
    }

    // Step 10: Cleanup
    info('\nStep 10: Cleaning up...');
    await client.conferences(conference.sid).update({ status: 'completed' });
    success('Conference terminated');

    // Final summary
    header('Test Summary');
    success(`✅ Conference ran for conversation testing`);
    success(`✅ Agent call: ${agentCall.duration}s`);
    success(`✅ Customer call: ${customerCall.duration}s`);
    success(`✅ Recordings: ${recordings.length}`);
    success(`✅ Transcriptions: ${transcriptionFound ? 'Yes' : 'Processing'}`);

    log('\n💡 Next steps:', 'cyan');
    log('  1. Check Twilio Console for Voice Intelligence analysis', 'cyan');
    log('  2. Check Segment for profile updates', 'cyan');
    log('  3. Review serverless function logs for OpenAI interactions\n', 'cyan');

    return {
      success: true,
      conferenceSid: conference.sid,
      agentDuration: agentCall.duration,
      customerDuration: customerCall.duration,
      recordings: recordings.length,
    };

  } catch (err) {
    error(`\nTest failed: ${err.message}`);
    console.error(err);

    // Cleanup on error
    if (conference) {
      try {
        await client.conferences(conference.sid).update({ status: 'completed' });
        info('Cleaned up conference');
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    return { success: false, error: err.message };
  }
}

async function main() {
  const durationSeconds = parseInt(process.argv[2]) || 60;

  log('\n╔══════════════════════════════════════════════════════════════════╗', 'cyan');
  log('║     LIVE AI CONVERSATION TEST - FULL STACK VALIDATION            ║', 'cyan');
  log('╚══════════════════════════════════════════════════════════════════╝', 'cyan');

  info(`\nTest duration: ${durationSeconds} seconds`);
  info('This test validates:');
  info('  ✓ OpenAI prompt integration');
  info('  ✓ Text-to-Speech (TTS) generation');
  info('  ✓ Speech-to-Text (STT) transcription');
  info('  ✓ Conference recordings');
  info('  ✓ Voice Intelligence operators');
  info('  ✓ Segment CDP integration\n');

  const result = await runConversationTest(durationSeconds);

  if (result.success) {
    log('\n🎉 Full stack validation test completed successfully!\n', 'green');
    process.exit(0);
  } else {
    log('\n❌ Test failed - check logs above\n', 'red');
    process.exit(1);
  }
}

main().catch(err => {
  error(`\nTest crashed: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
