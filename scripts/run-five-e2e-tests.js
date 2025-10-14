#!/usr/bin/env node
// ABOUTME: Runs 5 end-to-end tests and validates recordings, transcripts, and operator results
// ABOUTME: Wrapper script that runs live-conversation-test.js multiple times with validation

require('dotenv').config();
const { spawn } = require('child_process');
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

function header(message) {
  log(`\n${'═'.repeat(70)}`, 'cyan');
  log(`  ${message}`, 'cyan');
  log(`${'═'.repeat(70)}`, 'cyan');
}

async function runSingleTest(testNumber) {
  return new Promise((resolve, reject) => {
    header(`Test ${testNumber}/5: Running 1-minute conversation test`);

    const testProcess = spawn('node', [
      '/Users/mcarpenter/workspaces/twilio-synthetic-call-data-generator/scripts/test-one-minute-call.js'
    ]);

    let output = '';
    let conferenceSid = null;
    let transcriptSid = null;

    testProcess.stdout.on('data', (data) => {
      const text = data.toString();
      process.stdout.write(text);
      output += text;

      // Extract conference SID
      const confMatch = text.match(/Conference ended: (CF[a-f0-9]+)/);
      if (confMatch) {
        conferenceSid = confMatch[1];
      }

      // Extract transcript SID
      const transMatch = text.match(/Transcript SID: (GT[a-f0-9]+)/);
      if (transMatch) {
        transcriptSid = transMatch[1];
      }
    });

    testProcess.stderr.on('data', (data) => {
      process.stderr.write(data);
    });

    testProcess.on('close', (code) => {
      if (code === 0) {
        resolve({ conferenceSid, transcriptSid, output });
      } else {
        reject(new Error(`Test exited with code ${code}`));
      }
    });
  });
}

async function validateRecording(conferenceSid) {
  try {
    const recordings = await client.recordings.list({
      conferenceSid: conferenceSid,
      limit: 5
    });

    if (recordings.length > 0) {
      success(`Recording found for conference ${conferenceSid}`);
      info(`  Recording SID: ${recordings[0].sid}`);
      info(`  Duration: ${recordings[0].duration}s`);
      return recordings[0];
    } else {
      error(`No recording found for conference ${conferenceSid}`);
      return null;
    }
  } catch (err) {
    error(`Error checking recording: ${err.message}`);
    return null;
  }
}

async function validateTranscript(transcriptSid) {
  if (!transcriptSid) {
    error('No transcript SID provided');
    return null;
  }

  try {
    // Fetch transcript
    const response = await fetch(
      `https://intelligence.twilio.com/v2/Transcripts/${transcriptSid}`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
        },
      }
    );

    if (!response.ok) {
      error(`Failed to fetch transcript: ${response.status}`);
      return null;
    }

    const transcript = await response.json();
    success(`Transcript validated: ${transcriptSid}`);
    info(`  Status: ${transcript.status}`);
    info(`  Duration: ${transcript.duration}s`);

    // Fetch sentences
    const sentencesResponse = await fetch(
      `https://intelligence.twilio.com/v2/Transcripts/${transcriptSid}/Sentences?PageSize=50`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
        },
      }
    );

    const sentencesData = await sentencesResponse.json();
    const sentences = sentencesData.sentences || [];

    success(`Found ${sentences.length} sentence(s) in transcript`);

    // Check for two-way conversation
    const speakers = new Set(sentences.map(s => s.mediaChannel));
    if (speakers.size >= 2) {
      success(`✓ Two-way conversation detected (${speakers.size} speakers)`);
    } else {
      error(`⚠ Only ${speakers.size} speaker(s) detected`);
    }

    return { transcript, sentences };
  } catch (err) {
    error(`Error validating transcript: ${err.message}`);
    return null;
  }
}

async function validateOperatorResults(transcriptSid) {
  if (!transcriptSid) {
    return null;
  }

  try {
    const response = await fetch(
      `https://intelligence.twilio.com/v2/Transcripts/${transcriptSid}/OperatorResults?PageSize=50`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
        },
      }
    );

    const data = await response.json();
    const operators = data.operator_results || [];

    if (operators.length > 0) {
      success(`Found ${operators.length} operator result(s)`);
      operators.forEach(op => {
        info(`  - ${op.operator_type}: ${op.predicted_label || op.extract_match || 'N/A'}`);
      });
    } else {
      info(`No operator results (operators may not be configured)`);
    }

    return operators;
  } catch (err) {
    error(`Error fetching operator results: ${err.message}`);
    return null;
  }
}

async function main() {
  header('5 Real-World End-to-End Tests');
  info('Each test will run a 1-minute conversation with recording and transcription');
  console.log('');

  const results = [];

  // Run 5 tests
  for (let i = 1; i <= 5; i++) {
    try {
      const result = await runSingleTest(i);
      results.push({
        testNumber: i,
        success: true,
        conferenceSid: result.conferenceSid,
        transcriptSid: result.transcriptSid,
      });

      // Small delay between tests
      if (i < 5) {
        info(`\nWaiting 5 seconds before next test...\n`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (err) {
      error(`Test ${i} failed: ${err.message}`);
      results.push({
        testNumber: i,
        success: false,
        error: err.message,
      });
    }
  }

  // Summary and validation
  header('Test Summary and Validation');

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  info(`\nCompleted ${successful.length}/5 tests successfully`);
  if (failed.length > 0) {
    error(`${failed.length} test(s) failed`);
  }
  console.log('');

  // Validate each successful test
  for (const result of successful) {
    header(`Validating Test ${result.testNumber}`);

    // Validate recording
    if (result.conferenceSid) {
      await validateRecording(result.conferenceSid);
    }

    // Validate transcript
    if (result.transcriptSid) {
      await validateTranscript(result.transcriptSid);
      await validateOperatorResults(result.transcriptSid);
    }

    console.log('');
  }

  // Final summary
  header('Final Results');
  success(`${successful.length}/5 tests completed`);
  info('All validations complete!');
  console.log('');
}

main().catch(err => {
  error(`Fatal error: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
