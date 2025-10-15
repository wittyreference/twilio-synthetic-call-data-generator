// ABOUTME: Monitor script to track conference pipeline progress (conferences → transcripts → operators)
// ABOUTME: Polls Twilio APIs until transcripts and operators are available

const { execSync } = require('child_process');

const conferenceSids = process.argv.slice(2);

if (conferenceSids.length === 0) {
  console.error('Usage: node monitor-pipeline.js <conference-sid-1> <conference-sid-2> ...');
  process.exit(1);
}

let iteration = 0;
const maxIterations = 60; // 60 iterations = ~30 minutes with 30s sleep
const sleepSeconds = 30;

console.log(`\n🔍 Monitoring ${conferenceSids.length} conferences for pipeline completion\n`);
console.log(`Conferences being tracked:`);
conferenceSids.forEach((sid, i) => console.log(`  ${i + 1}. ${sid}`));
console.log(`\nWill check every ${sleepSeconds}s for up to ${maxIterations} iterations (~${maxIterations * sleepSeconds / 60} minutes)\n`);

function runValidation() {
  iteration++;
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Iteration ${iteration}/${maxIterations} - ${new Date().toLocaleTimeString()}`);
  console.log('='.repeat(70));

  try {
    const output = execSync(
      `node scripts/validate-specific-conferences.js ${conferenceSids.join(' ')}`,
      { encoding: 'utf8', timeout: 60000 }
    );

    console.log(output);

    // Parse the output to check if we have transcripts and operators
    const transcriptMatch = output.match(/Total Transcripts:\s+(\d+)/);
    const operatorMatch = output.match(/Total Language Operators:\s+(\d+)/);

    const transcripts = transcriptMatch ? parseInt(transcriptMatch[1]) : 0;
    const operators = operatorMatch ? parseInt(operatorMatch[1]) : 0;

    if (transcripts > 0 && operators > 0) {
      console.log(`\n✅ COMPLETE! Found ${transcripts} transcripts and ${operators} operators`);
      return true;
    } else if (transcripts > 0) {
      console.log(`\n⏳ Progress: ${transcripts} transcripts found, waiting for operators...`);
    } else {
      console.log(`\n⏳ Waiting for recordings to complete and transcripts to be generated...`);
    }
  } catch (error) {
    console.error(`Error running validation: ${error.message}`);
  }

  return false;
}

function sleep(seconds) {
  execSync(`sleep ${seconds}`);
}

// Main monitoring loop
let complete = false;
while (!complete && iteration < maxIterations) {
  complete = runValidation();

  if (!complete) {
    console.log(`\nSleeping ${sleepSeconds}s before next check...`);
    sleep(sleepSeconds);
  }
}

if (complete) {
  console.log(`\n🎉 Pipeline validation complete!`);
  process.exit(0);
} else {
  console.log(`\n⚠️  Reached maximum iterations (${maxIterations}). Pipeline may still be processing.`);
  console.log(`Run validation manually: node scripts/validate-specific-conferences.js ${conferenceSids.join(' ')}`);
  process.exit(1);
}
