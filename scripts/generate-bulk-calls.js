// ABOUTME: Bulk call generation script using Newman to automate conference creation at scale
// ABOUTME: Supports rate limiting, progress tracking, and error handling for thousands of calls per day

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

// Load environment variables
require('dotenv').config();

// Color formatting
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

function header(text) {
  console.log(`\n${colors.magenta}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.magenta}  ${text}${colors.reset}`);
  console.log(`${colors.magenta}${'='.repeat(60)}${colors.reset}\n`);
}

function success(text) {
  console.log(`${colors.green}✓ ${text}${colors.reset}`);
}

function error(text) {
  console.log(`${colors.red}✗ ${text}${colors.reset}`);
}

function info(text) {
  console.log(`${colors.blue}ℹ ${text}${colors.reset}`);
}

function progress(current, total, text) {
  const percentage = ((current / total) * 100).toFixed(1);
  const bar = '█'.repeat(Math.floor((current / total) * 40));
  const empty = '░'.repeat(40 - bar.length);
  console.log(
    `${colors.blue}[${bar}${empty}] ${percentage}%${colors.reset} ${text}`
  );
}

/**
 * Calculate delay based on calls per second (CPS) rate
 */
function calculateDelay(cps) {
  return Math.ceil(1000 / cps); // milliseconds
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a single call using Newman
 */
async function generateSingleCall(collectionPath, environmentPath, iteration) {
  try {
    const cmd = `newman run "${collectionPath}" -e "${environmentPath}" --reporters cli --suppress-exit-code`;

    const { stdout, stderr } = await execAsync(cmd);

    // Parse Newman output for success/failure
    if (stdout.includes('✓') || stdout.includes('passed')) {
      return { success: true, iteration, output: stdout };
    } else {
      return { success: false, iteration, error: stderr || stdout };
    }
  } catch (err) {
    return { success: false, iteration, error: err.message };
  }
}

/**
 * Generate multiple calls in bulk
 */
async function generateBulkCalls(options = {}) {
  const {
    count = 10,
    cps = 1,
    collectionPath = path.join(process.cwd(), 'postman', 'collection.json'),
    environmentPath = path.join(process.cwd(), 'postman', 'environment.json'),
    stopOnError = false,
  } = options;

  header(`Bulk Call Generation - ${count} calls at ${cps} CPS`);

  // Validate files exist
  try {
    await fs.access(collectionPath);
    await fs.access(environmentPath);
    success('Postman collection and environment found');
  } catch (err) {
    error(`Missing Postman files: ${err.message}`);
    return {
      success: false,
      error: 'Collection or environment file not found',
    };
  }

  const delay = calculateDelay(cps);
  const stats = {
    total: count,
    successful: 0,
    failed: 0,
    errors: [],
  };

  const startTime = Date.now();

  info(`Delay between calls: ${delay}ms (${cps} CPS)`);
  info(
    `Estimated completion time: ${Math.ceil((count * delay) / 1000 / 60)} minutes`
  );
  console.log('');

  // Generate calls
  for (let i = 1; i <= count; i++) {
    progress(i, count, `Generating call ${i}/${count}...`);

    const result = await generateSingleCall(collectionPath, environmentPath, i);

    if (result.success) {
      stats.successful++;
    } else {
      stats.failed++;
      stats.errors.push({
        iteration: i,
        error: result.error,
      });

      if (stopOnError) {
        error(`Call ${i} failed - stopping due to stopOnError flag`);
        break;
      }
    }

    // Wait before next call (unless it's the last one)
    if (i < count) {
      await sleep(delay);
    }
  }

  const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

  // Summary
  header('Bulk Generation Summary');

  console.log(`${colors.bright}Results:${colors.reset}`);
  success(`Successful calls: ${stats.successful}/${stats.total}`);

  if (stats.failed > 0) {
    error(`Failed calls: ${stats.failed}/${stats.total}`);
  }

  console.log(`\n${colors.bright}Performance:${colors.reset}`);
  info(`Total time: ${elapsedTime}s`);
  info(`Average time per call: ${(elapsedTime / count).toFixed(2)}s`);
  info(`Actual CPS: ${(count / elapsedTime).toFixed(2)}`);

  if (stats.errors.length > 0 && stats.errors.length <= 5) {
    console.log(`\n${colors.yellow}Errors:${colors.reset}`);
    stats.errors.forEach(err => {
      console.log(`  Call ${err.iteration}: ${err.error.slice(0, 100)}...`);
    });
  } else if (stats.errors.length > 5) {
    console.log(
      `\n${colors.yellow}Errors: ${stats.errors.length} errors occurred (showing first 3)${colors.reset}`
    );
    stats.errors.slice(0, 3).forEach(err => {
      console.log(`  Call ${err.iteration}: ${err.error.slice(0, 100)}...`);
    });
  }

  console.log('');

  return {
    success: stats.failed === 0,
    stats,
    elapsedTime,
  };
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    count: 10,
    cps: 1,
    stopOnError: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--count' || arg === '-c') {
      options.count = parseInt(args[++i], 10);
    } else if (arg === '--cps' || arg === '-r') {
      options.cps = parseFloat(args[++i]);
    } else if (arg === '--stop-on-error') {
      options.stopOnError = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
${colors.bright}Bulk Call Generation Script${colors.reset}

Generates multiple synthetic calls using Newman/Postman collections.

${colors.bright}Usage:${colors.reset}
  node scripts/generate-bulk-calls.js [options]

${colors.bright}Options:${colors.reset}
  -c, --count <number>     Number of calls to generate (default: 10)
  -r, --cps <number>       Calls per second rate (default: 1)
  --stop-on-error          Stop generation if a call fails
  -h, --help               Show this help message

${colors.bright}Examples:${colors.reset}
  # Generate 100 calls at 1 CPS
  node scripts/generate-bulk-calls.js --count 100

  # Generate 50 calls at 2 CPS
  node scripts/generate-bulk-calls.js --count 50 --cps 2

  # Generate 1000 calls at 5 CPS (max self-serve rate)
  node scripts/generate-bulk-calls.js --count 1000 --cps 5

  # Stop on first error
  node scripts/generate-bulk-calls.js --count 100 --stop-on-error

${colors.bright}CPS Limits:${colors.reset}
  - Default: 1 CPS
  - Self-serve max: 5 CPS
  - Higher rates require Twilio support approval

${colors.bright}Estimated Generation Times:${colors.reset}
  - 100 calls @ 1 CPS: ~2 minutes
  - 1000 calls @ 1 CPS: ~17 minutes
  - 1000 calls @ 5 CPS: ~3.5 minutes
  - 10000 calls @ 5 CPS: ~34 minutes
      `);
      process.exit(0);
    }
  }

  return options;
}

/**
 * Validate options
 */
function validateOptions(options) {
  if (options.count < 1 || options.count > 100000) {
    throw new Error('Count must be between 1 and 100,000');
  }

  if (options.cps < 0.1 || options.cps > 10) {
    throw new Error('CPS must be between 0.1 and 10');
  }

  if (options.cps > 5) {
    console.log(
      `${colors.yellow}⚠️  Warning: CPS > 5 requires Twilio support approval${colors.reset}\n`
    );
  }

  return true;
}

/**
 * Main execution
 */
async function main() {
  console.log(
    `${colors.bright}${colors.magenta}╔════════════════════════════════════════════════════════════╗${colors.reset}`
  );
  console.log(
    `${colors.bright}${colors.magenta}║    🚀 BULK SYNTHETIC CALL GENERATION - TWILIO + NEWMAN   ║${colors.reset}`
  );
  console.log(
    `${colors.bright}${colors.magenta}╚════════════════════════════════════════════════════════════╝${colors.reset}`
  );

  try {
    const options = parseArgs();
    validateOptions(options);

    info(`Configuration:`);
    info(`  Calls to generate: ${options.count}`);
    info(`  Rate: ${options.cps} CPS`);
    info(`  Stop on error: ${options.stopOnError ? 'Yes' : 'No'}`);

    const result = await generateBulkCalls(options);

    if (result.success) {
      console.log(
        `${colors.green}✅ All calls generated successfully!${colors.reset}\n`
      );
      process.exit(0);
    } else {
      console.log(
        `${colors.yellow}⚠️  Generation completed with ${result.stats.failed} failures${colors.reset}\n`
      );
      process.exit(1);
    }
  } catch (err) {
    console.error(
      `${colors.red}❌ Fatal error: ${err.message}${colors.reset}\n`
    );
    process.exit(1);
  }
}

// Handle errors
process.on('unhandledRejection', err => {
  console.error(`\n${colors.red}Unhandled error:${colors.reset}`, err);
  process.exit(1);
});

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { generateBulkCalls, generateSingleCall };
