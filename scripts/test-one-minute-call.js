#!/usr/bin/env node
// ABOUTME: One minute end-to-end test with transcript verification
// ABOUTME: Validates two-way conversation capture between agent and customer

require('dotenv').config();
const twilio = require('twilio');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

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

function highlight(message) {
  log(`➤ ${message}`, 'cyan');
}

// Sleep utility
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createOneMinuteCall() {
  console.log('');
  log('═══════════════════════════════════════════════════════', 'blue');
  log('  1-Minute End-to-End Call Test with Transcript Check', 'blue');
  log('═══════════════════════════════════════════════════════', 'blue');
  console.log('');

  // Select a customer/agent pair
  const customerPair = {
    customer: {
      name: 'Lucy Macintosh',
      persona: 'Lucy Macintosh',
      phone: '+15129358764',
      issue: 'Billing error. Double charged for last month\'s order.',
    },
    agent: {
      name: 'Sarah',
      persona: 'Sarah',
      competence: 'High',
      attitude: 'Positive and helpful',
    },
  };

  info(`Customer: ${customerPair.customer.name} (${customerPair.customer.phone})`);
  info(`Issue: ${customerPair.customer.issue}`);
  info(`Agent: ${customerPair.agent.name} (${customerPair.agent.competence} competence)`);
  console.log('');

  // Generate unique conference name
  const conferenceName = `test-1min-${Math.random().toString(36).substring(2, 14)}`;
  info(`Conference: ${conferenceName}`);
  console.log('');

  try {
    // Step 1: Create agent participant
    highlight('Step 1: Creating agent participant...');
    const agentAppUrl = `app:${process.env.TWIML_APP_SID}?role=agent&persona=${encodeURIComponent(customerPair.agent.persona)}&conferenceId=${encodeURIComponent(conferenceName)}`;

    const agentParticipant = await client.conferences(conferenceName).participants.create({
      from: process.env.AGENT_PHONE_NUMBER,
      to: agentAppUrl,
      earlyMedia: true,
      endConferenceOnExit: false,
      beep: false,
      label: 'agent',
      conferenceRecord: 'record-from-start', // Enable conference recording
      conferenceRecordingStatusCallback: `https://${process.env.DOMAIN_NAME}/conference-status-webhook`,
      conferenceRecordingStatusCallbackEvent: ['completed'],
      statusCallback: `https://${process.env.DOMAIN_NAME}/conference-status-webhook`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    });

    success(`Agent participant created: ${agentParticipant.callSid}`);
    console.log('');

    // Wait for agent to join
    info('Waiting 3 seconds for agent to join...');
    await sleep(3000);

    // Step 2: Create customer participant
    highlight('Step 2: Creating customer participant...');
    const customerAppUrl = `app:${process.env.TWIML_APP_SID}?role=customer&persona=${encodeURIComponent(customerPair.customer.persona)}&conferenceId=${encodeURIComponent(conferenceName)}`;

    const customerParticipant = await client.conferences(conferenceName).participants.create({
      from: customerPair.customer.phone, // Customer's phone number is their Segment user ID
      to: customerAppUrl,
      earlyMedia: true,
      endConferenceOnExit: true,
      beep: false,
      label: 'customer',
      statusCallback: `https://${process.env.DOMAIN_NAME}/conference-status-webhook`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    });

    success(`Customer participant created: ${customerParticipant.callSid}`);
    info('Conference recording enabled from start');
    console.log('');

    // Step 3: Monitor the conference for 1 minute
    highlight('Step 3: Monitoring conference for 60 seconds...');
    const startTime = Date.now();
    const monitorInterval = 5000; // Check every 5 seconds
    const totalDuration = 60000; // 60 seconds

    let conferenceData = null;

    while (Date.now() - startTime < totalDuration) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      info(`Time elapsed: ${elapsed}s / 60s`);

      // Check conference status
      try {
        const conferences = await client.conferences.list({
          friendlyName: conferenceName,
          status: 'in-progress',
          limit: 1,
        });

        if (conferences.length > 0) {
          conferenceData = conferences[0];
          const participants = await client
            .conferences(conferenceData.sid)
            .participants.list();

          info(`  Active participants: ${participants.length}`);
          participants.forEach((p) => {
            info(`    - ${p.label || 'unknown'}: ${p.callSid} (${p.status})`);
          });
        } else {
          info('  Conference not active yet or already ended');
        }
      } catch (err) {
        error(`  Error checking conference: ${err.message}`);
      }

      console.log('');
      await sleep(monitorInterval);
    }

    success('60 second monitoring period complete');
    console.log('');

    // Step 4: End the conference
    highlight('Step 4: Ending conference...');
    if (conferenceData) {
      await client.conferences(conferenceData.sid).update({ status: 'completed' });
      success(`Conference ended: ${conferenceData.sid}`);
    }
    console.log('');

    // Step 5: Wait for recordings and transcripts to be created
    highlight('Step 5: Waiting 90 seconds for recording + Voice Intelligence transcript...');
    info('  - Recording must complete first (~30-60s)');
    info('  - Then Voice Intelligence processes it (~30-60s)');
    await sleep(90000); // 90 seconds should be sufficient
    console.log('');

    // Step 6: Fetch and analyze the transcript
    highlight('Step 6: Fetching Voice Intelligence transcript...');

    if (!process.env.VOICE_INTELLIGENCE_SID) {
      error('VOICE_INTELLIGENCE_SID not configured');
      return;
    }

    info(`Voice Intelligence SID: ${process.env.VOICE_INTELLIGENCE_SID}`);

    // List transcripts for the conference using REST API directly
    let transcripts;
    try {
      const response = await fetch(
        `https://intelligence.twilio.com/v2/Services/${process.env.VOICE_INTELLIGENCE_SID}/Transcripts?PageSize=20`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
          },
        }
      );
      const data = await response.json();
      transcripts = data.transcripts || [];
    } catch (err) {
      error(`Failed to fetch transcripts: ${err.message}`);
      console.error(err.stack);
      return;
    }

    // Find the most recent transcript (should be ours)
    if (transcripts.length === 0) {
      error('No transcripts found!');
      return;
    }

    const latestTranscript = transcripts[0];
    success(`Found transcript: ${latestTranscript.sid}`);
    info(`Status: ${latestTranscript.status}`);
    console.log('');

    highlight('Step 7: Analyzing transcript for two-way conversation...');
    console.log('');

    // Fetch sentences using REST API
    let sentences;
    try {
      const response = await fetch(
        `https://intelligence.twilio.com/v2/Services/${process.env.VOICE_INTELLIGENCE_SID}/Transcripts/${latestTranscript.sid}/Sentences?PageSize=100`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
          },
        }
      );
      const data = await response.json();
      sentences = data.sentences || [];
    } catch (err) {
      error(`Failed to fetch sentences: ${err.message}`);
      console.error(err.stack);
      return;
    }

    if (sentences.length === 0) {
      error('No sentences found in transcript!');
      return;
    }

    success(`Found ${sentences.length} sentence(s) in transcript`);
    console.log('');

    // Analyze speaker distribution
    const speakerCounts = {};
    sentences.forEach((sentence) => {
      const speaker = sentence.speakerLabel || 'unknown';
      speakerCounts[speaker] = (speakerCounts[speaker] || 0) + 1;
    });

    log('Speaker Distribution:', 'cyan');
    Object.entries(speakerCounts).forEach(([speaker, count]) => {
      info(`  ${speaker}: ${count} sentences`);
    });
    console.log('');

    // Check for two-way conversation
    const uniqueSpeakers = Object.keys(speakerCounts).length;
    if (uniqueSpeakers < 2) {
      error('⚠️  WARNING: Only one speaker detected in transcript!');
      error('This suggests the conversation is NOT two-way.');
      console.log('');
    } else {
      success(`✓ Two-way conversation detected (${uniqueSpeakers} speakers)`);
      console.log('');
    }

    // Display conversation excerpt
    log('Conversation Excerpt (first 10 sentences):', 'cyan');
    sentences.slice(0, 10).forEach((sentence, idx) => {
      const speaker = sentence.speakerLabel || 'unknown';
      const text = sentence.transcript || '';
      const confidence = sentence.confidence
        ? (sentence.confidence * 100).toFixed(1)
        : 'N/A';
      console.log(`  [${speaker}] (${confidence}% conf): ${text}`);
    });
    console.log('');

    // Summary
    log('═══════════════════════════════════════════════════════', 'blue');
    log('Test Summary:', 'cyan');
    info(`Conference SID: ${conferenceData?.sid || 'N/A'}`);
    info(`Agent Call SID: ${agentParticipant.callSid}`);
    info(`Customer Call SID: ${customerParticipant.callSid}`);
    info(`Transcript SID: ${latestTranscript.sid}`);
    info(`Total Sentences: ${sentences.length}`);
    info(`Unique Speakers: ${uniqueSpeakers}`);

    if (uniqueSpeakers >= 2) {
      success('✓ Two-way conversation VERIFIED');
    } else {
      error('✗ Two-way conversation NOT detected - needs troubleshooting');
    }

    log('═══════════════════════════════════════════════════════', 'blue');
    console.log('');

    process.exit(0);
  } catch (err) {
    error(`Test failed: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  }
}

createOneMinuteCall();
