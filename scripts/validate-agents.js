// ABOUTME: Script to validate all agent personas in agents.json
// ABOUTME: Ensures all agent data is valid before using in production

const {
  loadAgents,
  validateAllAgents,
} = require('../src/personas/agent-loader');

console.log('🔍 Validating agent personas...\n');

try {
  // Load agents from the actual agents.json file
  const agents = loadAgents();
  console.log(`📋 Loaded ${agents.length} agent personas\n`);

  // Validate all agents
  const result = validateAllAgents();

  if (result.valid) {
    console.log(`✅ All ${result.validCount} agents are valid!\n`);
    console.log('Agent personas:');
    agents.forEach((agent, index) => {
      console.log(
        `  ${index + 1}. ${agent.AgentName} (${agent.CompetenceLevel} competence)`
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
