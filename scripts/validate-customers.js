// ABOUTME: Script to validate all customer personas in customers.json
// ABOUTME: Ensures all customer data is valid before using in production

const {
  loadCustomers,
  validateAllCustomers,
} = require('../src/personas/customer-loader');

console.log('🔍 Validating customer personas...\n');

try {
  // Load customers from the actual customers.json file
  const customers = loadCustomers();
  console.log(`📋 Loaded ${customers.length} customer personas\n`);

  // Validate all customers
  const result = validateAllCustomers();

  if (result.valid) {
    console.log(`✅ All ${result.validCount} customers are valid!\n`);
    console.log('Customer personas:');
    customers.forEach((customer, index) => {
      console.log(
        `  ${index + 1}. ${customer.CustomerName} (${customer.PhoneNumber})`
      );
    });
    console.log('\n✨ Validation complete!');
    process.exit(0);
  } else {
    console.error(
      `❌ Validation failed! ${result.errors.length} error(s) found:\n`
    );
    result.errors.forEach((error, index) => {
      console.error(`  ${index + 1}. ${error}`);
    });
    console.error(`\n✅ Valid: ${result.validCount}/${result.totalCount}`);
    console.error('❌ Invalid: ' + (result.totalCount - result.validCount));
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Fatal error during validation:');
  console.error(error.message);
  process.exit(1);
}
