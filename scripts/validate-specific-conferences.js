// ABOUTME: Validates recordings, transcripts, and operators for specific conference SIDs
// ABOUTME: Tracks the complete critical path: Conference → Participants → Recordings → Transcripts → Operators

require('dotenv').config();
const twilio = require('twilio');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function getTranscriptForRecording(recordingSid) {
  // Voice Intelligence links transcripts via media properties
  // We need to search for transcripts and match by timing/media URL
  try {
    const transcripts = await client.intelligence.v2.transcripts.list({ limit: 100 });

    // Try to find transcript by checking if recording SID appears in transcript metadata
    for (const transcript of transcripts) {
      // Check if this transcript's media URL contains our recording SID
      if (transcript.mediaUrl && transcript.mediaUrl.includes(recordingSid)) {
        return transcript;
      }
    }

    return null;
  } catch (error) {
    console.error(`    Error finding transcript: ${error.message}`);
    return null;
  }
}

async function getOperatorsForTranscript(transcriptSid) {
  try {
    const operators = await client.intelligence.v2
      .transcripts(transcriptSid)
      .operatorResults.list({ limit: 20 });

    return operators;
  } catch (error) {
    console.error(`      Error fetching operators: ${error.message}`);
    return [];
  }
}

async function validateSpecificConferences(conferenceSids, options = {}) {
  const { verbose = false } = options;

  console.log('🔍 Complete Critical Path Validation\n');
  console.log(`Tracking ${conferenceSids.length} conference(s) through entire pipeline:\n`);
  console.log('Conference → Participants → Recordings → Transcripts → Operators\n');

  const results = {
    conferences: [],
    totalParticipants: 0,
    totalRecordings: 0,
    totalTranscripts: 0,
    totalOperators: 0,
    recordingsWithTranscripts: 0,
    transcriptsWithOperators: 0,
  };

  for (const conferenceSid of conferenceSids) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Conference: ${conferenceSid}`);
    console.log('='.repeat(70));

    try {
      // Step 1: Get conference details
      const conference = await client.conferences(conferenceSid).fetch();
      console.log(`Status: ${conference.status}`);
      console.log(`Friendly Name: ${conference.friendlyName}`);
      console.log(`Created: ${conference.dateCreated}`);

      const confResult = {
        sid: conferenceSid,
        status: conference.status,
        friendlyName: conference.friendlyName,
        dateCreated: conference.dateCreated,
        participants: [],
        recordings: [],
        transcripts: [],
        operators: [],
      };

      // Step 2: Get participants
      const participants = await client.conferences(conferenceSid).participants.list();
      console.log(`\n📞 Participants: ${participants.length}`);
      results.totalParticipants += participants.length;

      for (const participant of participants) {
        const partInfo = {
          callSid: participant.callSid,
          label: participant.label,
          recordings: [],
        };

        console.log(`\n  ${participant.label} (${participant.callSid}):`);

        // Step 3: Get recordings for this participant
        const recordings = await client.recordings.list({
          callSid: participant.callSid,
          limit: 10,
        });

        console.log(`    📼 Recordings: ${recordings.length}`);
        results.totalRecordings += recordings.length;

        if (recordings.length === 0) {
          console.log(`      ⚠️  No recordings found for this participant!`);
        }

        for (const recording of recordings) {
          console.log(`\n      Recording: ${recording.sid}`);
          console.log(`        Status: ${recording.status}`);
          console.log(`        Duration: ${recording.duration}s`);

          const recInfo = {
            sid: recording.sid,
            status: recording.status,
            duration: recording.duration,
            transcript: null,
            operators: [],
          };

          // Step 4: Find transcript for this recording
          if (recording.status === 'completed') {
            console.log(`        📝 Searching for transcript...`);
            const transcript = await getTranscriptForRecording(recording.sid);

            if (transcript) {
              results.totalTranscripts++;
              results.recordingsWithTranscripts++;
              recInfo.transcript = {
                sid: transcript.sid,
                status: transcript.status,
                duration: transcript.duration,
              };

              console.log(`        ✅ Transcript: ${transcript.sid} (${transcript.status}, ${transcript.duration}s)`);
              confResult.transcripts.push(transcript.sid);

              // Step 5: Get operators for this transcript
              if (transcript.status === 'completed') {
                console.log(`        🧠 Fetching Language Operators...`);
                const operators = await getOperatorsForTranscript(transcript.sid);

                if (operators.length > 0) {
                  results.totalOperators += operators.length;
                  results.transcriptsWithOperators++;
                  console.log(`        ✅ Operators: ${operators.length} found`);

                  if (verbose) {
                    operators.forEach(op => {
                      console.log(`           - ${op.operatorType}: ${op.name}`);
                    });
                  }

                  recInfo.operators = operators.map(op => ({
                    sid: op.sid,
                    type: op.operatorType,
                    name: op.name,
                  }));

                  confResult.operators.push(...operators.map(o => o.sid));
                } else {
                  console.log(`        ⚠️  No operators found (may not be configured)`);
                }
              } else {
                console.log(`        ⏳ Transcript still processing...`);
              }
            } else {
              console.log(`        ⚠️  No transcript found for this recording`);
            }
          } else {
            console.log(`        ⏳ Recording still processing (${recording.status})`);
          }

          partInfo.recordings.push(recInfo);
          confResult.recordings.push(recording.sid);
        }

        confResult.participants.push(partInfo);
      }

      results.conferences.push(confResult);

    } catch (error) {
      console.error(`❌ Error processing conference ${conferenceSid}: ${error.message}`);
    }
  }

  // Summary
  console.log(`\n${'='.repeat(70)}`);
  console.log('📊 COMPLETE PIPELINE VALIDATION SUMMARY');
  console.log('='.repeat(70));
  console.log(`Conferences Tracked:         ${results.conferences.length}`);
  console.log(`Total Participants:          ${results.totalParticipants}`);
  console.log(`Total Recordings:            ${results.totalRecordings}`);
  console.log(`Total Transcripts:           ${results.totalTranscripts}`);
  console.log(`Total Language Operators:    ${results.totalOperators}`);
  console.log(''.repeat(70));
  console.log(`Recordings → Transcripts:    ${results.recordingsWithTranscripts}/${results.totalRecordings} (${Math.round(results.recordingsWithTranscripts / results.totalRecordings * 100) || 0}%)`);
  console.log(`Transcripts → Operators:     ${results.transcriptsWithOperators}/${results.totalTranscripts} (${Math.round(results.transcriptsWithOperators / results.totalTranscripts * 100) || 0}%)`);
  console.log('='.repeat(70));

  // Validation checks
  const expectedRecordings = results.totalParticipants;
  const recordingMatch = results.totalRecordings >= expectedRecordings * 0.8;

  console.log('\n✅ Critical Path Validation:');
  console.log(`  Conferences Created:        ${results.conferences.length > 0 ? '✅' : '❌'}`);
  console.log(`  Participants Present:       ${results.totalParticipants > 0 ? '✅' : '❌'}`);
  console.log(`  Recordings Generated:       ${recordingMatch ? '✅' : '❌'} (${results.totalRecordings}/${expectedRecordings} expected)`);
  console.log(`  Transcripts Generated:      ${results.totalTranscripts > 0 ? '✅' : '⏳'} (${results.totalTranscripts} found)`);
  console.log(`  Language Operators:         ${results.totalOperators > 0 ? '✅' : '⚠️'}  (${results.totalOperators} found)`);

  // Detailed warnings
  if (results.totalRecordings === 0) {
    console.log('\n❌ CRITICAL: No recordings found!');
    console.log('   Recording is NOT working. Check participant record: true parameter.');
  }

  if (results.totalRecordings > 0 && results.totalTranscripts === 0) {
    console.log('\n⏳ Recordings found but no transcripts yet.');
    console.log('   Transcripts may still be processing. Check again in a few minutes.');
  }

  if (results.totalTranscripts > 0 && results.totalOperators === 0) {
    console.log('\n⚠️  Transcripts found but no Language Operators.');
    console.log('   Operators may not be configured for Voice Intelligence service.');
  }

  const pipelineComplete = results.totalRecordings > 0 &&
                          results.totalTranscripts > 0 &&
                          results.totalOperators > 0;

  if (pipelineComplete) {
    console.log('\n🎉 COMPLETE PIPELINE VALIDATED!');
    console.log('   Conference → Participants → Recordings → Transcripts → Operators ✅');
  }

  return results;
}

// Run validation
const args = process.argv.slice(2);
const verbose = args.includes('--verbose') || args.includes('-v');
const conferenceSids = args.filter(arg => !arg.startsWith('-'));

if (conferenceSids.length === 0) {
  console.error('Usage: node validate-specific-conferences.js <ConferenceSid1> [ConferenceSid2] ... [--verbose]');
  console.error('Example: node validate-specific-conferences.js CFxxxxxxxxx CFyyyyyyyyy --verbose');
  process.exit(1);
}

validateSpecificConferences(conferenceSids, { verbose })
  .then(results => {
    const success = results.totalRecordings > 0;
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
