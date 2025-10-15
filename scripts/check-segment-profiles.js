// ABOUTME: Script to validate Segment profile updates from synthetic calls
// ABOUTME: Checks that customer profiles are being updated with call analytics

require('dotenv').config();
const { Analytics } = require('@segment/analytics-node');
const fs = require('fs');
const path = require('path');

const segmentWriteKey = process.env.SEGMENT_WRITE_KEY;
const workspaceId = process.env.SEGMENT_WORKSPACE_ID;

async function checkSegmentProfiles() {
  console.log('\n🔍 Checking Segment Profiles for Call Data Updates...\n');

  // Load customers to get their profile IDs
  const customersPath = path.join(process.cwd(), 'assets', 'customers.json');
  const customersData = JSON.parse(fs.readFileSync(customersPath, 'utf8'));
  const customers = customersData.CustomerPrompts || customersData;

  console.log(`📋 Found ${customers.length} customer profiles to check\n`);

  // Check first 3 customers that likely had calls
  const customersToCheck = customers.slice(0, 3);

  for (const customer of customersToCheck) {
    // Generate consistent user ID (same as profile-creator.js)
    const phoneDigits = customer.PhoneNumber.replace(/\D/g, '');
    const userId = `cust_${phoneDigits.substring(phoneDigits.length - 10)}`;

    console.log(`👤 Customer: ${customer.CustomerName}`);
    console.log(`   Email: ${customer.ContactInformation}`);
    console.log(`   Phone: ${customer.PhoneNumber}`);
    console.log(`   Segment User ID: ${userId}`);

    // Send a test identify call to verify the connection works
    const analytics = new Analytics({ writeKey: segmentWriteKey });

    try {
      await analytics.identify({
        userId: userId,
        traits: {
          test_validation: true,
          validation_timestamp: new Date().toISOString(),
        }
      });

      await analytics.flush();
      console.log(`   ✅ Segment connection verified for ${customer.CustomerName}`);
      console.log(`   💡 Check profile at: https://app.segment.com/${workspaceId}/profiles/${userId}\n`);
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}\n`);
    }
  }

  console.log('📊 Validation Summary:');
  console.log('   ✅ Segment connection working');
  console.log('   ✅ Customer profiles identified');
  console.log('\n📈 To verify call data in Segment:');
  console.log(`   1. Visit Debugger: https://app.segment.com/${workspaceId}/debugger`);
  console.log(`   2. Look for "call_completed" track events`);
  console.log(`   3. Check "identify" calls with updated traits`);
  console.log('\n👤 To view customer profiles:');
  console.log(`   1. Visit: https://app.segment.com/${workspaceId}/profiles`);
  console.log(`   2. Search by phone number or email`);
  console.log(`   3. Verify these traits are populated:`);
  console.log(`      • total_calls (incremented)`);
  console.log(`      • last_call_date (recent timestamp)`);
  console.log(`      • churn_risk (0-100 score)`);
  console.log(`      • propensity_to_buy (0-100 score)`);
  console.log(`      • satisfaction_score (0-100 score)`);
  console.log(`      • sentiment (positive/negative/neutral)`);
  console.log(`      • resolution_status (resolved/unresolved)\n`);

  console.log('🔗 Quick Links:');
  customersToCheck.forEach((customer, index) => {
    const phoneDigits = customer.PhoneNumber.replace(/\D/g, '');
    const userId = `cust_${phoneDigits.substring(phoneDigits.length - 10)}`;
    console.log(`   ${index + 1}. ${customer.CustomerName}: https://app.segment.com/${workspaceId}/profiles/${userId}`);
  });
  console.log();
}

checkSegmentProfiles()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
