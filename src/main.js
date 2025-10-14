// ABOUTME: Main entry point for local conference creation and testing
// ABOUTME: Uses conference orchestrator with TwiML Application for AI-powered conversations

require('dotenv').config();
const twilio = require('twilio');
const { createConference } = require('./orchestration/conference-orchestrator');

// Load environment variables
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twimlAppSid = process.env.TWIML_APP_SID;
const agentPhoneNumber = process.env.AGENT_PHONE_NUMBER;
const customerPhoneNumber = process.env.CUSTOMER_PHONE_NUMBER;

// Validate required environment variables
if (!accountSid || !authToken) {
  console.error('❌ Error: TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set in .env');
  process.exit(1);
}

if (!twimlAppSid) {
  console.error('❌ Error: TWIML_APP_SID must be set in .env');
  process.exit(1);
}

if (!agentPhoneNumber) {
  console.error('❌ Error: AGENT_PHONE_NUMBER must be set in .env');
  process.exit(1);
}

if (!customerPhoneNumber) {
  console.error('❌ Error: CUSTOMER_PHONE_NUMBER must be set in .env');
  process.exit(1);
}

const client = twilio(accountSid, authToken);

// Main conference creation function
async function createSyntheticConference(strategy = 'random') {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  🎬 SYNTHETIC CONFERENCE CREATION                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    console.log(`📋 Configuration:`);
    console.log(`   TwiML App SID: ${twimlAppSid}`);
    console.log(`   Agent Phone: ${agentPhoneNumber}`);
    console.log(`   Customer Phone: ${customerPhoneNumber}`);
    console.log(`   Pairing Strategy: ${strategy}\n`);

    console.log('🎲 Creating conference with AI-powered participants...\n');

    // Use conference orchestrator to create conference
    const result = await createConference(
      client,
      twimlAppSid,
      agentPhoneNumber,
      customerPhoneNumber,
      { strategy }
    );

    console.log('\n════════════════════════════════════════════════════════════');
    console.log('  ✅ Conference Created Successfully!');
    console.log('════════════════════════════════════════════════════════════\n');

    console.log('📊 Conference Details:');
    console.log(`   Conference SID: ${result.conferenceSid}`);
    console.log(`   Conference ID: ${result.conferenceId}`);
    console.log(`   Customer: ${result.customer.customerName} (${result.customer.participantSid})`);
    console.log(`   Agent: ${result.agent.agentName} (${result.agent.participantSid})`);
    console.log(`   Timer: ${result.timerScheduled ? `${result.timerDuration}s` : 'Not scheduled'}`);
    console.log(`   Created: ${result.timestamp}\n`);

    console.log('🔊 Conversation Flow:');
    console.log('   1. Voice Handler → Entry point for TwiML Application');
    console.log('   2. Transcribe → Listens for speech with <Gather>');
    console.log('   3. Respond → Processes with OpenAI GPT-4o');
    console.log('   4. Loop back to Transcribe → Continuous conversation\n');

    console.log('📞 Monitor in Twilio Console:');
    console.log(`   Conferences: https://console.twilio.com/us1/monitor/logs/conferences`);
    console.log(`   Calls: https://console.twilio.com/us1/monitor/logs/calls\n`);

    console.log('⏰ Conference will auto-terminate in 5 minutes');
    console.log('   You can also manually terminate with:');
    console.log(`   twilio api:core:conferences:update --sid ${result.conferenceSid} --status completed\n`);

    return result;

  } catch (error) {
    console.error('\n❌ Error creating conference:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check that all environment variables are set in .env');
    console.error('   2. Verify TWIML_APP_SID points to voice-handler.js');
    console.error('   3. Ensure phone numbers are in E.164 format (+1234567890)');
    console.error('   4. Check Twilio account has sufficient balance');
    console.error('   5. Verify agents.json and customers.json exist\n');
    console.error('Full error:', error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  const strategy = process.argv[2] || 'random'; // Allow strategy as CLI argument

  createSyntheticConference(strategy)
    .then((result) => {
      console.log('✅ Conference created successfully!');
      console.log('   Script will exit now. Conference will continue in Twilio.');
      console.log(`   Monitor: https://console.twilio.com/us1/monitor/logs/conferences/${result.conferenceSid}\n`);
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { createSyntheticConference };
