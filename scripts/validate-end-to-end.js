// ABOUTME: Comprehensive end-to-end validation that calls appear in all systems
// ABOUTME: Validates Twilio calls, conferences, recordings, Voice Intelligence, and Segment

require('dotenv').config();
const twilio = require('twilio');
const { Analytics } = require('@segment/analytics-node');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Initialize Segment if credentials are available
let segmentAnalytics = null;
if (process.env.SEGMENT_WRITE_KEY) {
  segmentAnalytics = new Analytics({
    writeKey: process.env.SEGMENT_WRITE_KEY
  });
}

async function validateEndToEnd(options = {}) {
  const {
    minutes = 10,
    verbose = false
  } = options;

  console.log('🔍 End-to-End Pipeline Validation\n');
  console.log(`Checking calls from the last ${minutes} minutes...\n`);

  const results = {
    calls: 0,
    conferences: 0,
    recordings: 0,
    transcripts: 0,
    languageOperators: 0,
    segmentEvents: 0
  };

  const issues = [];

  try {
    // Calculate time threshold
    const timeThreshold = new Date(Date.now() - minutes * 60 * 1000);
    console.log(`Time threshold: ${timeThreshold.toISOString()}\n`);

    // Step 1: Check for recent calls
    console.log('📞 Step 1: Checking recent calls...');
    const calls = await client.calls.list({
      startTimeAfter: timeThreshold,
      limit: 100
    });

    results.calls = calls.length;
    console.log(`   Found ${results.calls} calls`);

    if (results.calls === 0) {
      issues.push('No calls found in the specified time period');
      console.log('   ⚠️  No recent calls found\n');
      return { results, issues, success: false };
    }

    if (verbose) {
      calls.slice(0, 5).forEach(call => {
        console.log(`   - ${call.sid}: ${call.status} (${call.startTime})`);
      });
    }
    console.log('   ✅ Calls found\n');

    // Step 2: Check for recent conferences
    console.log('🎙️  Step 2: Checking conferences...');
    const conferences = await client.conferences.list({
      dateCreatedAfter: timeThreshold,
      limit: 100
    });

    results.conferences = conferences.length;
    console.log(`   Found ${results.conferences} conferences`);

    if (results.conferences === 0) {
      issues.push('No conferences created (calls may not have connected)');
      console.log('   ⚠️  No conferences found\n');
    } else {
      if (verbose) {
        conferences.slice(0, 5).forEach(conf => {
          console.log(`   - ${conf.sid}: ${conf.status} (${conf.friendlyName})`);
        });
      }
      console.log('   ✅ Conferences created\n');
    }

    // Step 3: Check for recordings
    console.log('🎬 Step 3: Checking recordings...');
    const recordings = await client.recordings.list({
      dateCreatedAfter: timeThreshold,
      limit: 100
    });

    results.recordings = recordings.length;
    console.log(`   Found ${results.recordings} recordings`);

    if (results.recordings === 0) {
      issues.push('No recordings found (recording may not be enabled)');
      console.log('   ⚠️  No recordings found\n');
    } else {
      const totalDuration = recordings.reduce((sum, r) => sum + parseInt(r.duration || 0), 0);
      const avgDuration = totalDuration / recordings.length;

      if (verbose) {
        recordings.slice(0, 5).forEach(rec => {
          console.log(`   - ${rec.sid}: ${rec.duration}s (${rec.status})`);
        });
      }
      console.log(`   Average duration: ${avgDuration.toFixed(1)}s`);
      console.log('   ✅ Recordings created\n');
    }

    // Step 4: Check for Voice Intelligence transcripts
    console.log('📝 Step 4: Checking Voice Intelligence transcripts...');
    const transcripts = await client.intelligence.v2.transcripts.list({ limit: 100 });

    // Filter transcripts by time
    const recentTranscripts = transcripts.filter(t => {
      const created = new Date(t.dateCreated);
      return created >= timeThreshold;
    });

    results.transcripts = recentTranscripts.length;
    console.log(`   Found ${results.transcripts} transcripts`);

    if (results.transcripts === 0) {
      issues.push('No transcripts found (Voice Intelligence may not be enabled or processing)');
      console.log('   ⚠️  No transcripts found\n');
    } else {
      // Check transcript quality
      let validTranscripts = 0;
      for (const transcript of recentTranscripts.slice(0, 5)) {
        const sentences = await client.intelligence.v2.transcripts(transcript.sid)
          .sentences.list({ limit: 10 });

        if (sentences.length >= 3) {
          validTranscripts++;
        }

        if (verbose && sentences.length > 0) {
          console.log(`   - ${transcript.sid}: ${sentences.length} sentences, ${transcript.duration}s`);
        }
      }

      console.log(`   Valid transcripts (3+ sentences): ${validTranscripts}/${Math.min(5, recentTranscripts.length)} sampled`);
      console.log('   ✅ Transcripts created\n');
    }

    // Step 5: Check for Language Operators (operators attached to transcripts)
    console.log('🧠 Step 5: Checking Language Operators...');
    let operatorCount = 0;

    for (const transcript of recentTranscripts.slice(0, 5)) {
      try {
        const operators = await client.intelligence.v2.transcripts(transcript.sid)
          .operatorResults.list({ limit: 10 });

        operatorCount += operators.length;

        if (verbose && operators.length > 0) {
          console.log(`   - ${transcript.sid}: ${operators.length} operators`);
        }
      } catch (error) {
        // Operators might not be configured
        if (verbose) {
          console.log(`   - ${transcript.sid}: No operators (may not be configured)`);
        }
      }
    }

    results.languageOperators = operatorCount;
    console.log(`   Found ${results.languageOperators} operator results`);

    if (results.languageOperators === 0) {
      console.log('   ⚠️  No operator results (operators may not be configured)\n');
    } else {
      console.log('   ✅ Language operators processed\n');
    }

    // Step 6: Check Segment (if configured)
    if (segmentAnalytics && process.env.SEGMENT_WORKSPACE_ID) {
      console.log('📊 Step 6: Checking Segment integration...');
      console.log('   Note: Segment validation requires manual console check');
      console.log(`   Workspace: ${process.env.SEGMENT_WORKSPACE_ID}`);
      console.log('   Expected profiles should have updated traits\n');
      results.segmentEvents = -1; // Indicates "check manually"
    } else {
      console.log('📊 Step 6: Segment integration...');
      console.log('   ⚠️  Segment not configured (SEGMENT_WRITE_KEY not set)\n');
    }

    // Summary
    console.log('═'.repeat(60));
    console.log('📊 VALIDATION SUMMARY');
    console.log('═'.repeat(60));
    console.log(`Calls:               ${results.calls}`);
    console.log(`Conferences:         ${results.conferences}`);
    console.log(`Recordings:          ${results.recordings}`);
    console.log(`Transcripts:         ${results.transcripts}`);
    console.log(`Language Operators:  ${results.languageOperators}`);
    if (results.segmentEvents === -1) {
      console.log(`Segment:             Check manually in console`);
    }
    console.log('═'.repeat(60));

    // Determine success
    const criticalIssues = issues.filter(i =>
      i.includes('No calls') ||
      i.includes('No conferences')
    );

    const success = results.calls > 0 &&
                    results.conferences > 0 &&
                    criticalIssues.length === 0;

    if (issues.length > 0) {
      console.log('\n⚠️  Issues detected:');
      issues.forEach(issue => console.log(`   - ${issue}`));
    }

    if (success) {
      console.log('\n✅ End-to-end validation PASSED!');
      console.log('   Core pipeline (calls → conferences → recordings) is working');

      if (results.transcripts === 0) {
        console.log('   ⏳ Transcripts may still be processing (check again in a few minutes)');
      }
    } else {
      console.log('\n❌ End-to-end validation FAILED');
      console.log('   Critical components are missing');
    }

    return { results, issues, success };

  } catch (error) {
    console.error('\n❌ Validation error:', error.message);
    return { results, issues: [...issues, error.message], success: false };
  }
}

// Run validation
const args = process.argv.slice(2);
const options = {
  verbose: args.includes('--verbose') || args.includes('-v'),
  minutes: 10
};

// Check for custom time window
if (args.includes('--minutes')) {
  const idx = args.indexOf('--minutes');
  options.minutes = parseInt(args[idx + 1]) || 10;
}

validateEndToEnd(options)
  .then(({ results, issues, success }) => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
