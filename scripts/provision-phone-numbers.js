// ABOUTME: Provisions Twilio phone numbers for customer personas and agent
// ABOUTME: Searches for available numbers, purchases them, and updates configuration

require('dotenv').config();
const twilio = require('twilio');
const fs = require('fs');
const path = require('path');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

if (!accountSid || !authToken) {
  console.error(
    '❌ Error: TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set in .env'
  );
  process.exit(1);
}

const client = twilio(accountSid, authToken);

// Configuration
const NUMBERS_NEEDED = {
  customers: 10, // One for each customer persona
  agent: 1, // One shared number for all agent calls
};

const SEARCH_CONFIG = {
  areaCode: process.env.PHONE_NUMBER_AREA_CODE || '888', // Toll-free default
  country: process.env.PHONE_NUMBER_COUNTRY || 'US',
  capabilities: {
    voice: true,
    sms: false,
    mms: false,
  },
};

async function searchAvailableNumbers(count) {
  console.log(`🔍 Searching for ${count} available phone numbers...`);
  console.log(`   Area Code: ${SEARCH_CONFIG.areaCode}`);
  console.log(`   Country: ${SEARCH_CONFIG.country}\n`);

  try {
    const availableNumbers = await client
      .availablePhoneNumbers(SEARCH_CONFIG.country)
      .tollFree.list({
        limit: count,
      });

    if (availableNumbers.length < count) {
      console.error(
        `❌ Only found ${availableNumbers.length} available numbers, need ${count}`
      );
      console.log(
        '\n💡 Try changing area code with: PHONE_NUMBER_AREA_CODE=555 node scripts/provision-phone-numbers.js'
      );
      return [];
    }

    console.log(`✅ Found ${availableNumbers.length} available numbers\n`);
    return availableNumbers.map(num => num.phoneNumber);
  } catch (error) {
    console.error('❌ Error searching for numbers:', error.message);
    return [];
  }
}

async function purchasePhoneNumber(phoneNumber, friendlyName) {
  try {
    const purchasedNumber = await client.incomingPhoneNumbers.create({
      phoneNumber: phoneNumber,
      friendlyName: friendlyName,
      voiceUrl: '', // Will be configured later
      voiceMethod: 'POST',
    });

    console.log(`  ✅ ${phoneNumber} → ${friendlyName}`);
    return purchasedNumber;
  } catch (error) {
    console.error(`  ❌ Failed to purchase ${phoneNumber}: ${error.message}`);
    return null;
  }
}

async function updateCustomersJson(phoneNumberMappings) {
  const customersPath = path.join(__dirname, '..', 'customers.json');
  const customersData = JSON.parse(fs.readFileSync(customersPath, 'utf8'));

  const customers = customersData.CustomerPrompts || customersData;

  // Assign phone numbers to customers
  customers.forEach((customer, index) => {
    if (phoneNumberMappings[index]) {
      customer.PhoneNumber = phoneNumberMappings[index].phoneNumber;
      customer.CustomerPhoneNumber = phoneNumberMappings[index].phoneNumber;
    }
  });

  // Write back
  const updatedData = customersData.CustomerPrompts
    ? { CustomerPrompts: customers }
    : customers;

  fs.writeFileSync(customersPath, JSON.stringify(updatedData, null, 2));
  console.log('\n✅ Updated customers.json with phone numbers');
}

async function updateEnvFile(agentPhoneNumber) {
  const envPath = path.join(__dirname, '..', '.env');
  let envContent = fs.readFileSync(envPath, 'utf8');

  // Update AGENT_PHONE_NUMBER
  if (envContent.includes('AGENT_PHONE_NUMBER=')) {
    envContent = envContent.replace(
      /AGENT_PHONE_NUMBER=.*/,
      `AGENT_PHONE_NUMBER=${agentPhoneNumber}`
    );
  } else {
    envContent += `\nAGENT_PHONE_NUMBER=${agentPhoneNumber}\n`;
  }

  fs.writeFileSync(envPath, envContent);
  console.log('✅ Updated .env with AGENT_PHONE_NUMBER');
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  📞 TWILIO PHONE NUMBER PROVISIONING                      ║');
  console.log(
    '╚════════════════════════════════════════════════════════════╝\n'
  );

  const totalNeeded = NUMBERS_NEEDED.customers + NUMBERS_NEEDED.agent;
  console.log(`📋 Numbers needed:`);
  console.log(`   Customers: ${NUMBERS_NEEDED.customers}`);
  console.log(`   Agent: ${NUMBERS_NEEDED.agent}`);
  console.log(`   Total: ${totalNeeded}\n`);

  // Estimate cost
  const estimatedCost = totalNeeded * 1.0; // $1/month per number typically
  console.log(`💰 Estimated monthly cost: $${estimatedCost.toFixed(2)}`);
  console.log(`   (Plus per-minute usage charges)\n`);

  // Confirm with user
  console.log(
    '⚠️  This will purchase phone numbers and charge your Twilio account.'
  );
  console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Search for available numbers
  const availableNumbers = await searchAvailableNumbers(totalNeeded);
  if (availableNumbers.length === 0) {
    process.exit(1);
  }

  // Purchase numbers
  console.log(`💳 Purchasing ${totalNeeded} phone numbers...\n`);

  const phoneNumberMappings = [];

  // Purchase customer numbers
  console.log('👥 Customer Numbers:');
  for (let i = 0; i < NUMBERS_NEEDED.customers; i++) {
    const phoneNumber = availableNumbers[i];
    const friendlyName = `Synthetic Customer ${i + 1}`;

    const purchased = await purchasePhoneNumber(phoneNumber, friendlyName);
    if (purchased) {
      phoneNumberMappings.push({
        index: i,
        phoneNumber: purchased.phoneNumber,
        sid: purchased.sid,
        friendlyName: friendlyName,
      });
    }
  }

  // Purchase agent number
  console.log('\n👨‍💼 Agent Number:');
  const agentPhoneNumber = availableNumbers[NUMBERS_NEEDED.customers];
  const agentPurchased = await purchasePhoneNumber(
    agentPhoneNumber,
    'Synthetic Agent'
  );

  if (!agentPurchased) {
    console.error('\n❌ Failed to purchase agent phone number');
    process.exit(1);
  }

  // Update configuration files
  console.log('\n📝 Updating configuration files...');
  await updateCustomersJson(phoneNumberMappings);
  await updateEnvFile(agentPurchased.phoneNumber);

  // Summary
  console.log(
    '\n╔════════════════════════════════════════════════════════════╗'
  );
  console.log('║  ✅ PROVISIONING COMPLETE                                 ║');
  console.log(
    '╚════════════════════════════════════════════════════════════╝\n'
  );

  console.log('📞 Provisioned Numbers:');
  phoneNumberMappings.forEach(mapping => {
    console.log(`   ${mapping.phoneNumber} → ${mapping.friendlyName}`);
  });
  console.log(`   ${agentPurchased.phoneNumber} → Synthetic Agent\n`);

  console.log('📋 Next Steps:');
  console.log('   1. Run: node scripts/configure-phone-numbers.js');
  console.log('   2. Deploy functions: npm run deploy');
  console.log('   3. Test: npm run create-call\n');

  console.log('💡 Tip: You can view/manage your numbers at:');
  console.log(
    `   https://console.twilio.com/us1/develop/phone-numbers/manage/incoming\n`
  );
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
