// ABOUTME: Validates that Voice Intelligence transcriptions exist and contain actual conversation data
// ABOUTME: Useful for verifying end-to-end pipeline functionality

require('dotenv').config();
const twilio = require('twilio');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function validateTranscriptions(options = {}) {
  const {
    limit = 5,
    minSentences = 3,
    minDuration = 10,
    verbose = false
  } = options;

  console.log('🔍 Validating Voice Intelligence Transcriptions\n');

  try {
    // Fetch recent transcripts
    const transcripts = await client.intelligence.v2.transcripts.list({ limit });

    if (transcripts.length === 0) {
      console.log('⚠️  No transcripts found');
      console.log('   This could mean:');
      console.log('   1. No calls have been made yet');
      console.log('   2. Voice Intelligence is not enabled');
      console.log('   3. Transcriptions are still processing\n');
      return false;
    }

    console.log(`Found ${transcripts.length} recent transcripts\n`);

    let validCount = 0;
    let invalidCount = 0;

    for (const transcript of transcripts) {
      const transcriptSid = transcript.sid;
      const status = transcript.status;
      const duration = transcript.duration;
      const mediaStartTime = transcript.mediaStartTime;

      if (verbose) {
        console.log(`\n📄 Transcript: ${transcriptSid}`);
        console.log(`   Status: ${status}`);
        console.log(`   Duration: ${duration}s`);
        console.log(`   Created: ${transcript.dateCreated}`);
      }

      // Check if transcript is complete
      if (status !== 'completed') {
        if (verbose) {
          console.log(`   ⏳ Status: ${status} (waiting for completion)`);
        }
        continue;
      }

      // Check duration
      if (duration < minDuration) {
        console.log(`   ⚠️  Short duration: ${duration}s (expected at least ${minDuration}s)`);
        invalidCount++;
        continue;
      }

      // Fetch sentences to validate actual content
      const sentences = await client.intelligence.v2.transcripts(transcriptSid)
        .sentences.list({ limit: 100 });

      const sentenceCount = sentences.length;

      if (verbose) {
        console.log(`   Sentences: ${sentenceCount}`);
      }

      // Validate sentence count
      if (sentenceCount < minSentences) {
        console.log(`   ❌ Insufficient sentences: ${sentenceCount} (expected at least ${minSentences})`);
        invalidCount++;
        continue;
      }

      // Check for actual conversation content
      const hasAgentChannel = sentences.some(s => s.mediaChannel === 1);
      const hasCustomerChannel = sentences.some(s => s.mediaChannel === 2);
      const hasTranscript = sentences.every(s => s.transcript && s.transcript.length > 0);

      if (!hasAgentChannel || !hasCustomerChannel) {
        console.log(`   ❌ Missing dual-channel audio (agent: ${hasAgentChannel}, customer: ${hasCustomerChannel})`);
        invalidCount++;
        continue;
      }

      if (!hasTranscript) {
        console.log(`   ❌ Empty transcript content`);
        invalidCount++;
        continue;
      }

      // Display sample conversation
      if (verbose) {
        console.log(`\n   Sample conversation:`);
        sentences.slice(0, 3).forEach((sentence, idx) => {
          const speaker = sentence.mediaChannel === 1 ? 'Agent' : 'Customer';
          const text = sentence.transcript.substring(0, 80) + (sentence.transcript.length > 80 ? '...' : '');
          console.log(`   ${idx + 1}. [${speaker}] ${text}`);
        });
      }

      validCount++;

      if (!verbose) {
        console.log(`✅ ${transcriptSid}: ${sentenceCount} sentences, ${duration}s duration`);
      } else {
        console.log(`   ✅ Valid transcript`);
      }
    }

    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Valid transcripts: ${validCount}`);
    if (invalidCount > 0) {
      console.log(`❌ Invalid transcripts: ${invalidCount}`);
    }

    const successRate = (validCount / transcripts.length * 100).toFixed(1);
    console.log(`📊 Success rate: ${successRate}%`);

    if (validCount === 0) {
      console.log(`\n⚠️  No valid transcripts found!`);
      console.log(`   Possible issues:`);
      console.log(`   1. Calls are too short (minimum ${minDuration}s)`);
      console.log(`   2. Voice Intelligence is not properly configured`);
      console.log(`   3. Transcriptions are still processing`);
      console.log(`   4. Recording is not enabled on conferences\n`);
      return false;
    }

    return validCount > 0;

  } catch (error) {
    console.error('❌ Error validating transcriptions:', error.message);
    return false;
  }
}

// Run validation based on command line arguments
const args = process.argv.slice(2);
const options = {};

if (args.includes('--verbose') || args.includes('-v')) {
  options.verbose = true;
}

if (args.includes('--limit')) {
  const limitIndex = args.indexOf('--limit');
  options.limit = parseInt(args[limitIndex + 1]) || 5;
}

validateTranscriptions(options)
  .then(success => {
    if (success) {
      console.log('✅ Transcription validation passed!\n');
      process.exit(0);
    } else {
      console.log('❌ Transcription validation failed!\n');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
