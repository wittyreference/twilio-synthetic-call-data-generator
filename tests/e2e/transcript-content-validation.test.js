// ABOUTME: End-to-end test for transcript content validation
// ABOUTME: Creates real conference, validates transcripts contain conversations (not error loops)

require('dotenv').config();
const axios = require('axios');
const { execSync } = require('child_process');

// This is a slow E2E test - extend timeout
jest.setTimeout(600000); // 10 minutes

describe('Transcript Content Validation - E2E', () => {
  const DOMAIN = process.env.DOMAIN_NAME || 'vibe-clauding-8464-dev.twil.io';
  const VOICE_INTELLIGENCE_SID = process.env.VOICE_INTELLIGENCE_SID;
  const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
  const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

  beforeAll(() => {
    // Verify required environment variables
    if (!DOMAIN || !VOICE_INTELLIGENCE_SID || !TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      throw new Error(
        'Missing required environment variables: DOMAIN_NAME, VOICE_INTELLIGENCE_SID, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN'
      );
    }
  });

  test('should create conference with real AI conversations (not error message loops)', async () => {
    // Step 1: Create a test conference
    console.log('📞 Creating test conference...');
    const conferenceResponse = await axios.post(
      `https://${DOMAIN}/create-conference`,
      {},
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    expect(conferenceResponse.status).toBe(201);
    expect(conferenceResponse.data.success).toBe(true);

    const { conferenceId, customer, agent } = conferenceResponse.data;
    console.log(`✅ Conference created: ${conferenceId}`);
    console.log(`   Agent: ${agent.name} (${agent.callSid})`);
    console.log(`   Customer: ${customer.name} (${customer.callSid})`);

    // Step 2: Let the conference run for 2 minutes (enough for conversation)
    console.log('⏳ Waiting 2 minutes for conversation to develop...');
    await new Promise(resolve => setTimeout(resolve, 120000)); // 2 minutes

    // Step 3: Terminate the conference
    console.log('⏹️  Terminating conference...');
    try {
      // First, get the actual Conference SID (not the friendly name)
      const listCmd = `twilio api:core:conferences:list --friendly-name "${conferenceId}" --output json`;
      const conferencesJSON = execSync(listCmd, { encoding: 'utf-8' });
      const conferences = JSON.parse(conferencesJSON);

      if (conferences.length > 0) {
        const conferenceSid = conferences[0].sid;
        await axios.post(
          `https://${DOMAIN}/conference-timer`,
          { ConferenceSid: conferenceSid },
          { headers: { 'Content-Type': 'application/json' } }
        );
        console.log(`✅ Conference ${conferenceSid} terminated`);
      }
    } catch (error) {
      console.warn(`⚠️  Could not terminate conference: ${error.message}`);
      // Continue - conference may have auto-terminated via timeLimit
    }

    // Step 4: Wait for Voice Intelligence to process recordings into transcripts
    console.log('⏳ Waiting 3 minutes for Voice Intelligence transcription processing...');
    await new Promise(resolve => setTimeout(resolve, 180000)); // 3 minutes

    // Step 5: Fetch recordings for this conference
    console.log('🔍 Fetching recordings...');
    const recordingsCmd = `twilio api:core:recordings:list --call-sid "${customer.callSid}" --output json`;
    const recordingsJSON = execSync(recordingsCmd, { encoding: 'utf-8' });
    const recordings = JSON.parse(recordingsJSON);

    expect(recordings.length).toBeGreaterThan(0);
    console.log(`✅ Found ${recordings.length} recording(s)`);

    // Step 6: Get the most recent transcript
    console.log('🔍 Fetching transcripts...');
    const transcriptsCmd = `twilio api:intelligence:v2:transcripts:list --service-sid "${VOICE_INTELLIGENCE_SID}" --page-size 20 --output json`;
    const transcriptsJSON = execSync(transcriptsCmd, { encoding: 'utf-8' });
    const transcripts = JSON.parse(transcriptsJSON);

    // Find transcript matching our conference (by timing - created recently)
    const recentTranscripts = transcripts.filter(t => {
      const createdAt = new Date(t.dateCreated);
      const now = new Date();
      const ageMinutes = (now - createdAt) / (1000 * 60);
      return ageMinutes < 10; // Created in last 10 minutes
    });

    expect(recentTranscripts.length).toBeGreaterThan(0);
    console.log(`✅ Found ${recentTranscripts.length} recent transcript(s)`);

    const transcriptSid = recentTranscripts[0].sid;

    // Step 7: Fetch transcript sentences
    console.log(`🔍 Fetching transcript sentences for ${transcriptSid}...`);
    const transcriptCmd = `twilio api:intelligence:v2:transcripts:fetch --service-sid "${VOICE_INTELLIGENCE_SID}" --sid "${transcriptSid}" --output json`;
    const transcriptJSON = execSync(transcriptCmd, { encoding: 'utf-8' });
    const transcript = JSON.parse(transcriptJSON);

    expect(transcript).toBeDefined();
    expect(transcript.sentences).toBeDefined();
    expect(transcript.sentences.length).toBeGreaterThan(0);

    console.log(`✅ Transcript has ${transcript.sentences.length} sentences`);

    // Step 8: CRITICAL VALIDATION - Check for error message loops
    const errorMessages = transcript.sentences.filter(s =>
      s.text.toLowerCase().includes('experiencing technical difficulties')
    );

    if (errorMessages.length > 0) {
      console.error('❌ REGRESSION DETECTED: Error messages found in transcript!');
      console.error('First 10 sentences:');
      transcript.sentences.slice(0, 10).forEach((s, i) => {
        console.error(`  ${i + 1}. [Ch${s.channelParticipant}] ${s.text}`);
      });
    }

    // Should NOT contain error message loops
    expect(errorMessages.length).toBe(0);

    // Step 9: Validate transcript has multi-speaker conversation
    const speakers = new Set(transcript.sentences.map(s => s.channelParticipant));
    expect(speakers.size).toBeGreaterThanOrEqual(2);
    console.log(`✅ Transcript has ${speakers.size} speaker(s)`);

    // Step 10: Validate agent introduction exists
    const firstFewSentences = transcript.sentences
      .slice(0, 5)
      .map(s => s.text.toLowerCase())
      .join(' ');

    const hasIntroduction =
      firstFewSentences.includes('thank you for calling') ||
      firstFewSentences.includes('how can i help') ||
      firstFewSentences.includes('how may i help') ||
      firstFewSentences.includes('warehouse') ||
      firstFewSentences.includes('speaking');

    expect(hasIntroduction).toBe(true);
    console.log('✅ Agent introduction detected in transcript');

    // Step 11: Validate customer responses are contextual (not generic errors)
    const customerSentences = transcript.sentences.filter(
      s => s.channelParticipant === 2 || s.channelParticipant === '2'
    );

    const hasContextualResponse = customerSentences.some(
      s =>
        s.text.length > 10 && // More than just "hello"
        !s.text.toLowerCase().includes('experiencing technical difficulties')
    );

    expect(hasContextualResponse).toBe(true);
    console.log('✅ Customer has contextual responses (not error messages)');

    console.log('\n✅ ✅ ✅ TRANSCRIPT VALIDATION PASSED ✅ ✅ ✅');
    console.log('Transcripts contain real AI conversations, not error loops!');
  });
});
