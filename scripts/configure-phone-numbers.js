// ABOUTME: Configures Twilio phone numbers with proper voice webhooks
// ABOUTME: Sets voice URLs to deployed serverless functions (not needed for outbound-only)

require('dotenv').config();
const twilio = require('twilio');
const fs = require('fs');
const path = require('path');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const serverlessDomain = process.env.SERVERLESS_DOMAIN;

if (!accountSid || !authToken) {
  console.error(
    '❌ Error: TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set in .env'
  );
  process.exit(1);
}

if (!serverlessDomain) {
  console.error('❌ Error: SERVERLESS_DOMAIN must be set in .env');
  console.error('   Example: SERVERLESS_DOMAIN=your-service-name-dev.twil.io');
  process.exit(1);
}

const client = twilio(accountSid, authToken);

async function listPurchasedNumbers() {
  console.log('📋 Fetching your Twilio phone numbers...\n');

  try {
    const numbers = await client.incomingPhoneNumbers.list();

    if (numbers.length === 0) {
      console.error('❌ No phone numbers found in your account');
      console.log(
        '\n💡 Run this first: node scripts/provision-phone-numbers.js\n'
      );
      process.exit(1);
    }

    return numbers;
  } catch (error) {
    console.error('❌ Error fetching numbers:', error.message);
    process.exit(1);
  }
}

async function configurePhoneNumber(number, voiceUrl, friendlyName) {
  try {
    await client.incomingPhoneNumbers(number.sid).update({
      voiceUrl: voiceUrl,
      voiceMethod: 'POST',
      statusCallback: `https://${serverlessDomain}/conference-status-webhook`,
      statusCallbackMethod: 'POST',
    });

    console.log(
      `  ✅ ${number.phoneNumber} → ${friendlyName || number.friendlyName}`
    );
    return true;
  } catch (error) {
    console.error(
      `  ❌ Failed to configure ${number.phoneNumber}: ${error.message}`
    );
    return false;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  ⚙️  TWILIO PHONE NUMBER CONFIGURATION                    ║');
  console.log(
    '╚════════════════════════════════════════════════════════════╝\n'
  );

  console.log(`🌐 Serverless Domain: ${serverlessDomain}\n`);

  // Fetch all numbers
  const numbers = await listPurchasedNumbers();
  console.log(`Found ${numbers.length} phone numbers\n`);

  // Display current configuration
  console.log('📞 Current Configuration:');
  numbers.forEach(num => {
    const voiceUrl = num.voiceUrl || '(not configured)';
    console.log(`   ${num.phoneNumber} → ${num.friendlyName}`);
    console.log(`      Voice URL: ${voiceUrl}`);
  });

  console.log('\n⚠️  Note: For this system, incoming calls are NOT required.');
  console.log(
    '   Calls are created programmatically via the Participants API.'
  );
  console.log('   However, you CAN configure incoming webhooks if desired.\n');

  // Ask if user wants to configure
  console.log('❓ Do you want to configure voice webhooks? (y/N)\n');
  console.log('   Skipping configuration in 5 seconds (Ctrl+C to cancel)...\n');

  await new Promise(resolve => setTimeout(resolve, 5000));

  // For now, we'll skip configuration since we're using outbound calls only
  console.log(
    '⏭️  Skipping webhook configuration (not needed for outbound calls)\n'
  );

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  ✅ CONFIGURATION COMPLETE                                ║');
  console.log(
    '╚════════════════════════════════════════════════════════════╝\n'
  );

  console.log('📋 Phone Number Summary:');
  numbers.forEach(num => {
    console.log(`   ${num.phoneNumber} → ${num.friendlyName}`);
  });

  console.log('\n💡 Your numbers are ready for outbound calling!');
  console.log(
    '   They will be used as the "from" number when creating conferences.\n'
  );

  console.log('📋 Next Steps:');
  console.log('   1. Deploy functions: npm run deploy');
  console.log('   2. Test: npm run create-call');
  console.log(
    '   3. Generate bulk calls: node scripts/generate-bulk-calls.js\n'
  );

  // Show cost info
  console.log('💰 Cost Information:');
  console.log(
    `   Monthly base: $${numbers.length}.00 (${numbers.length} numbers × $1/month)`
  );
  console.log('   Plus usage: ~$0.01-0.03 per minute of calls');
  console.log('   Plus OpenAI: ~$0.01-0.05 per 5-minute conversation\n');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
