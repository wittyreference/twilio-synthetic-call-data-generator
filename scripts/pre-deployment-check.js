// ABOUTME: Pre-deployment validation script that checks all requirements before deploying
// ABOUTME: Validates environment, credentials, data files, tests, and dependencies

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Load environment variables from .env file
require('dotenv').config();

// Color formatting for terminal output
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

function warning(text) {
  console.log(`${colors.yellow}⚠ ${text}${colors.reset}`);
}

function info(text) {
  console.log(`${colors.blue}ℹ ${text}${colors.reset}`);
}

const checks = {
  environment: false,
  dependencies: false,
  dataFiles: false,
  tests: false,
  twilioAuth: false,
  segmentAuth: false,
  serverlessFunctions: false,
};

// Check 1: Environment Variables
async function checkEnvironment() {
  header('Environment Variables Check');

  const required = [
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'SEGMENT_WRITE_KEY',
  ];
  const optional = ['AGENT_PHONE_NUMBER'];

  let allRequired = true;

  // Check .env file exists
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    success('.env file exists');
  } else {
    error('.env file not found');
    info('  Run: cp .env.example .env');
    allRequired = false;
  }

  // Check required variables
  for (const varName of required) {
    if (process.env[varName]) {
      success(`${varName} is set`);
    } else {
      error(`${varName} is missing`);
      allRequired = false;
    }
  }

  // Check optional variables
  for (const varName of optional) {
    if (process.env[varName]) {
      success(`${varName} is set (optional)`);
    } else {
      warning(`${varName} is not set (optional)`);
    }
  }

  checks.environment = allRequired;
  return allRequired;
}

// Check 2: Dependencies
async function checkDependencies() {
  header('Dependencies Check');

  try {
    // Check package.json exists
    const packagePath = path.join(process.cwd(), 'package.json');
    if (!fs.existsSync(packagePath)) {
      error('package.json not found');
      return false;
    }
    success('package.json exists');

    // Check node_modules exists
    const nodeModulesPath = path.join(process.cwd(), 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
      error('node_modules not found');
      info('  Run: npm install');
      return false;
    }
    success('node_modules exists');

    // Check critical dependencies
    const criticalDeps = [
      'twilio',
      '@segment/analytics-node',
      'jest',
      'newman',
    ];

    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    let allPresent = true;
    for (const dep of criticalDeps) {
      if (allDeps[dep]) {
        success(`${dep} is installed`);
      } else {
        error(`${dep} is missing`);
        allPresent = false;
      }
    }

    checks.dependencies = allPresent;
    return allPresent;
  } catch (err) {
    error(`Dependency check failed: ${err.message}`);
    return false;
  }
}

// Check 3: Data Files
async function checkDataFiles() {
  header('Data Files Check');

  try {
    const dataFiles = [
      { path: 'customers.json', required: true },
      { path: 'agents.json', required: true },
    ];

    let allValid = true;

    for (const file of dataFiles) {
      const filePath = path.join(process.cwd(), file.path);

      if (!fs.existsSync(filePath)) {
        error(`${file.path} not found`);
        allValid = false;
        continue;
      }
      success(`${file.path} exists`);

      // Validate JSON structure
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        let records;
        if (file.path === 'customers.json') {
          if (!data.CustomerPrompts || !Array.isArray(data.CustomerPrompts)) {
            error(`${file.path} missing CustomerPrompts array`);
            allValid = false;
            continue;
          }
          records = data.CustomerPrompts;
        } else if (file.path === 'agents.json') {
          if (!data.AgentPrompts || !Array.isArray(data.AgentPrompts)) {
            error(`${file.path} missing AgentPrompts array`);
            allValid = false;
            continue;
          }
          records = data.AgentPrompts;
        } else {
          records = data;
        }

        success(`${file.path} contains ${records.length} records`);

        if (records.length === 0) {
          warning(`${file.path} is empty`);
        }
      } catch (parseErr) {
        error(`${file.path} contains invalid JSON: ${parseErr.message}`);
        allValid = false;
      }
    }

    checks.dataFiles = allValid;
    return allValid;
  } catch (err) {
    error(`Data files check failed: ${err.message}`);
    return false;
  }
}

// Check 4: Test Suite
async function checkTests() {
  header('Test Suite Check');

  try {
    info('Running test suite (this may take a moment)...');

    // Run tests with coverage
    const output = execSync('npm test -- --passWithNoTests 2>&1', {
      encoding: 'utf8',
      stdio: 'pipe',
    });

    // Parse test results - try multiple patterns
    const testSuiteMatch =
      output.match(/Test Suites:.*?(\d+) passed.*?(\d+) total/) ||
      output.match(/Test Suites:\s+(\d+) passed/);
    const testsMatch =
      output.match(/Tests:.*?(\d+) passed.*?(\d+) total/) ||
      output.match(/Tests:\s+(\d+) passed/);

    if (testSuiteMatch && testsMatch) {
      const suitesPassed = parseInt(testSuiteMatch[1], 10);
      const testsPassed = parseInt(testsMatch[1], 10);

      success(`All test suites passed (${suitesPassed} suites)`);
      success(`All tests passed (${testsPassed} tests)`);

      // Check if all tests passed
      const failedMatch = output.match(/(\d+) failed/);
      if (failedMatch) {
        error(`${failedMatch[1]} tests failed`);
        checks.tests = false;
        return false;
      }

      checks.tests = true;
      return true;
    } else {
      error('Could not parse test results');
      // Show last 200 chars for debugging
      const snippet = output.slice(-200).replace(/\n/g, ' ');
      info(`  Last output: ${snippet}`);
      return false;
    }
  } catch (err) {
    error('Test suite failed');
    if (err.stderr) {
      info('  Error:', err.stderr.toString().slice(-500));
    }
    return false;
  }
}

// Check 5: Twilio Authentication
async function checkTwilioAuth() {
  header('Twilio Authentication Check');

  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      error('Twilio credentials not set');
      return false;
    }

    const twilio = require('twilio');
    const client = twilio(accountSid, authToken);

    // Attempt to fetch account info
    const account = await client.api.accounts(accountSid).fetch();

    success(`Connected to Twilio account: ${account.friendlyName}`);
    success(`Account status: ${account.status}`);
    info(`  Account SID: ${accountSid}`);

    if (account.status !== 'active') {
      warning('Account is not active');
      return false;
    }

    checks.twilioAuth = true;
    return true;
  } catch (err) {
    error(`Twilio authentication failed: ${err.message}`);
    info('  Verify your TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN');
    return false;
  }
}

// Check 6: Segment Authentication
async function checkSegmentAuth() {
  header('Segment Authentication Check');

  try {
    const writeKey = process.env.SEGMENT_WRITE_KEY;

    if (!writeKey) {
      error('Segment write key not set');
      return false;
    }

    const { Analytics } = require('@segment/analytics-node');
    const analytics = new Analytics({ writeKey: writeKey });

    // Send a test identify call
    await new Promise((resolve, reject) => {
      analytics.identify(
        {
          userId: 'pre_deployment_check',
          traits: {
            test: true,
            timestamp: new Date().toISOString(),
            source: 'pre-deployment-check',
          },
        },
        err => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    success('Segment identify() call succeeded');

    // Flush events
    await analytics.closeAndFlush();

    success('Segment authentication verified');
    info('  Check your Segment Debugger for the test event');

    checks.segmentAuth = true;
    return true;
  } catch (err) {
    error(`Segment authentication failed: ${err.message}`);
    info('  Verify your SEGMENT_WRITE_KEY');
    return false;
  }
}

// Check 7: Serverless Functions
async function checkServerlessFunctions() {
  header('Serverless Functions Check');

  try {
    const functionsDir = path.join(process.cwd(), 'functions');

    if (!fs.existsSync(functionsDir)) {
      error('functions/ directory not found');
      return false;
    }
    success('functions/ directory exists');

    const requiredFunctions = [
      'conference-status-webhook.js',
      'conference-timer.js',
      'transcription-webhook.js',
    ];

    let allPresent = true;

    for (const func of requiredFunctions) {
      const funcPath = path.join(functionsDir, func);

      if (!fs.existsSync(funcPath)) {
        error(`${func} not found`);
        allPresent = false;
        continue;
      }
      success(`${func} exists`);

      // Basic syntax check - require the file
      try {
        require(funcPath);
        success(`${func} syntax is valid`);
      } catch (syntaxErr) {
        error(`${func} has syntax errors: ${syntaxErr.message}`);
        allPresent = false;
      }
    }

    // Check for Twilio CLI
    try {
      const twilioVersion = execSync('twilio --version', {
        encoding: 'utf8',
        stdio: 'pipe',
      }).trim();
      success(`Twilio CLI installed: ${twilioVersion}`);
    } catch (err) {
      warning('Twilio CLI not found');
      info('  Install: npm install -g twilio-cli');
      info('  Required for serverless deployment');
    }

    // Check for serverless plugin
    try {
      const plugins = execSync('twilio plugins', {
        encoding: 'utf8',
        stdio: 'pipe',
      });

      if (plugins.includes('@twilio-labs/plugin-serverless')) {
        success('Twilio Serverless plugin installed');
      } else {
        warning('Twilio Serverless plugin not found');
        info(
          '  Install: twilio plugins:install @twilio-labs/plugin-serverless'
        );
      }
    } catch (err) {
      warning('Could not check Twilio plugins');
    }

    checks.serverlessFunctions = allPresent;
    return allPresent;
  } catch (err) {
    error(`Serverless functions check failed: ${err.message}`);
    return false;
  }
}

// Main execution
async function main() {
  console.log(
    `${colors.bright}${colors.magenta}╔════════════════════════════════════════════════════════════╗${colors.reset}`
  );
  console.log(
    `${colors.bright}${colors.magenta}║     🚀 PRE-DEPLOYMENT CHECK - TWILIO CALL GENERATOR 🚀    ║${colors.reset}`
  );
  console.log(
    `${colors.bright}${colors.magenta}╚════════════════════════════════════════════════════════════╝${colors.reset}`
  );

  const startTime = Date.now();

  // Run all checks
  await checkEnvironment();
  await checkDependencies();
  await checkDataFiles();
  await checkTests();
  await checkTwilioAuth();
  await checkSegmentAuth();
  await checkServerlessFunctions();

  // Summary
  header('Pre-Deployment Check Summary');

  const results = [
    { name: 'Environment Variables', passed: checks.environment },
    { name: 'Dependencies', passed: checks.dependencies },
    { name: 'Data Files', passed: checks.dataFiles },
    { name: 'Test Suite', passed: checks.tests },
    { name: 'Twilio Authentication', passed: checks.twilioAuth },
    { name: 'Segment Authentication', passed: checks.segmentAuth },
    { name: 'Serverless Functions', passed: checks.serverlessFunctions },
  ];

  for (const result of results) {
    if (result.passed) {
      success(result.name);
    } else {
      error(result.name);
    }
  }

  const allPassed = Object.values(checks).every(check => check === true);
  const passedCount = Object.values(checks).filter(
    check => check === true
  ).length;
  const totalCount = Object.keys(checks).length;

  console.log(`\n${colors.blue}${'─'.repeat(60)}${colors.reset}`);

  if (allPassed) {
    console.log(
      `${colors.green}✓ ALL CHECKS PASSED (${passedCount}/${totalCount})${colors.reset}`
    );
    console.log(`${colors.blue}${'─'.repeat(60)}${colors.reset}`);
    console.log(`${colors.green}🎉 Ready for deployment!${colors.reset}`);
    console.log(`${colors.blue}${'─'.repeat(60)}${colors.reset}`);
    console.log(`\n${colors.bright}Next steps:${colors.reset}`);
    console.log(
      `  1. Deploy serverless functions: ${colors.blue}twilio serverless:deploy${colors.reset}`
    );
    console.log(
      `  2. Run smoke test: ${colors.blue}npm run smoke-test${colors.reset}`
    );
    console.log(
      `  3. Generate calls: ${colors.blue}node src/main.js${colors.reset}`
    );
  } else {
    console.log(
      `${colors.yellow}⚠ ${passedCount}/${totalCount} checks passed${colors.reset}`
    );
    console.log(`${colors.blue}${'─'.repeat(60)}${colors.reset}`);
    console.log(
      `${colors.red}⚠️  Not ready for deployment. Fix the issues above.${colors.reset}`
    );
    console.log(`${colors.blue}${'─'.repeat(60)}${colors.reset}`);
  }

  const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n${colors.blue}Completed in ${elapsedTime}s${colors.reset}\n`);

  // Exit with appropriate code
  process.exit(allPassed ? 0 : 1);
}

// Handle errors
process.on('unhandledRejection', err => {
  console.error(`\n${colors.red}Unhandled error:${colors.reset}`, err);
  process.exit(1);
});

// Run
main().catch(err => {
  console.error(`\n${colors.red}Fatal error:${colors.reset}`, err);
  process.exit(1);
});
