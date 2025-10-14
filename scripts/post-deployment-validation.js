// ABOUTME: Post-deployment validation script that verifies deployed serverless functions are working
// ABOUTME: Tests webhook endpoints, function execution, and end-to-end integration

const https = require('https');
const { execSync } = require('child_process');

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

function warning(text) {
  console.log(`${colors.yellow}⚠ ${text}${colors.reset}`);
}

function info(text) {
  console.log(`${colors.blue}ℹ ${text}${colors.reset}`);
}

const checks = {
  deployment: false,
  webhookEndpoints: false,
  functionExecution: false,
  endToEnd: false,
};

// Helper: Make HTTP request
function makeRequest(url, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on('error', err => {
      reject(err);
    });

    if (body) {
      req.write(body);
    }

    req.end();
  });
}

// Check 1: Get Deployed Service Info
async function checkDeployment() {
  header('Deployment Status Check');

  try {
    // Get list of deployed services
    const output = execSync(
      'twilio api:serverless:v1:services:list --no-header',
      {
        encoding: 'utf8',
        stdio: 'pipe',
      }
    );

    if (!output || output.trim().length === 0) {
      error('No serverless services deployed');
      info('  Deploy first: twilio serverless:deploy');
      return null;
    }

    // Parse service info
    const lines = output.trim().split('\n');
    const mostRecentService = lines[0].trim().split(/\s+/);
    const serviceSid = mostRecentService[0];

    success(`Found deployed service: ${serviceSid}`);

    // Get service details to find the domain
    const detailsOutput = execSync(
      `twilio api:serverless:v1:services:fetch --sid=${serviceSid} --no-header`,
      {
        encoding: 'utf8',
        stdio: 'pipe',
      }
    );

    // Extract domain name
    const domainMatch = detailsOutput.match(/Domain Name\s+(\S+)/);
    let domain;

    if (domainMatch) {
      domain = domainMatch[1];
    } else {
      // Try alternative method - get environments
      const envsOutput = execSync(
        `twilio api:serverless:v1:services:environments:list --service-sid=${serviceSid} --no-header`,
        {
          encoding: 'utf8',
          stdio: 'pipe',
        }
      );

      const envLines = envsOutput.trim().split('\n');
      if (envLines.length > 0) {
        const envParts = envLines[0].trim().split(/\s+/);
        const envSid = envParts[0];

        // Get domain from environment
        const envDetails = execSync(
          `twilio api:serverless:v1:services:environments:fetch --service-sid=${serviceSid} --sid=${envSid} --no-header`,
          {
            encoding: 'utf8',
            stdio: 'pipe',
          }
        );

        const envDomainMatch = envDetails.match(/Domain Name\s+(\S+)/);
        if (envDomainMatch) {
          domain = envDomainMatch[1];
        }
      }
    }

    if (!domain) {
      error('Could not determine service domain');
      info('  Run: twilio serverless:list');
      return null;
    }

    success(`Service domain: ${domain}`);

    checks.deployment = true;
    return { serviceSid, domain };
  } catch (err) {
    error(`Deployment check failed: ${err.message}`);
    info('  Ensure you have deployed: twilio serverless:deploy');
    info('  Ensure you are logged in: twilio login');
    return null;
  }
}

// Check 2: Webhook Endpoints
async function checkWebhookEndpoints(domain) {
  header('Webhook Endpoints Check');

  if (!domain) {
    error('No domain provided - skipping webhook check');
    return false;
  }

  const endpoints = [
    '/conference-status-webhook',
    '/conference-timer',
    '/transcription-webhook',
  ];

  let allAccessible = true;

  for (const endpoint of endpoints) {
    const url = `https://${domain}${endpoint}`;

    try {
      const response = await makeRequest(url);

      if (response.statusCode === 200 || response.statusCode === 400) {
        // 200 or 400 are both OK - function is accessible
        success(`${endpoint} is accessible (HTTP ${response.statusCode})`);
      } else if (response.statusCode === 404) {
        error(`${endpoint} not found (HTTP 404)`);
        allAccessible = false;
      } else {
        warning(`${endpoint} returned HTTP ${response.statusCode}`);
      }
    } catch (err) {
      error(`${endpoint} failed: ${err.message}`);
      allAccessible = false;
    }
  }

  checks.webhookEndpoints = allAccessible;
  return allAccessible;
}

// Check 3: Function Execution
async function checkFunctionExecution(domain) {
  header('Function Execution Check');

  if (!domain) {
    error('No domain provided - skipping function execution check');
    return false;
  }

  let allWorking = true;

  // Test conference-timer with query parameters
  try {
    const testConferenceSid = 'CFtest123456789';
    const url = `https://${domain}/conference-timer?conferenceSid=${testConferenceSid}&duration=5`;

    const response = await makeRequest(url);

    if (response.statusCode === 200) {
      success('conference-timer responds correctly');

      // Try to parse JSON response
      try {
        const json = JSON.parse(response.body);
        if (json.message && json.conferenceSid) {
          success('conference-timer returns valid JSON');
          info(`  Message: ${json.message.slice(0, 50)}...`);
        }
      } catch (parseErr) {
        warning('conference-timer response is not JSON');
      }
    } else {
      error(`conference-timer returned HTTP ${response.statusCode}`);
      allWorking = false;
    }
  } catch (err) {
    error(`conference-timer test failed: ${err.message}`);
    allWorking = false;
  }

  // Test conference-status-webhook with POST
  try {
    const url = `https://${domain}/conference-status-webhook`;
    const testData = new URLSearchParams({
      StatusCallbackEvent: 'conference-start',
      ConferenceSid: 'CFtest123',
      FriendlyName: 'test-conference',
    }).toString();

    const response = await makeRequest(url, 'POST', testData);

    if (response.statusCode === 200) {
      success('conference-status-webhook accepts POST requests');

      // Check for TwiML response
      if (response.body.includes('<Response>')) {
        success('conference-status-webhook returns TwiML');
      }
    } else {
      warning(`conference-status-webhook returned HTTP ${response.statusCode}`);
    }
  } catch (err) {
    error(`conference-status-webhook test failed: ${err.message}`);
    allWorking = false;
  }

  // Test transcription-webhook with POST
  try {
    const url = `https://${domain}/transcription-webhook`;
    const testData = new URLSearchParams({
      TranscriptionText:
        'Thank you for your help, this was resolved perfectly!',
      CallSid: 'CAtest123',
      From: '+15551234567',
      TranscriptionStatus: 'completed',
    }).toString();

    const response = await makeRequest(url, 'POST', testData);

    if (response.statusCode === 200) {
      success('transcription-webhook accepts POST requests');

      if (response.body.includes('<Response>')) {
        success('transcription-webhook returns TwiML');
      }
    } else {
      warning(`transcription-webhook returned HTTP ${response.statusCode}`);
    }
  } catch (err) {
    error(`transcription-webhook test failed: ${err.message}`);
    allWorking = false;
  }

  checks.functionExecution = allWorking;
  return allWorking;
}

// Check 4: End-to-End Integration
async function checkEndToEndIntegration() {
  header('End-to-End Integration Check');

  try {
    info('Running smoke test for E2E validation...');

    const output = execSync('npm run smoke-test 2>&1', {
      encoding: 'utf8',
      stdio: 'pipe',
    });

    // Check if all tests passed
    if (output.includes('ALL TESTS PASSED')) {
      success('Smoke test passed - E2E integration working');

      // Parse test count
      const match = output.match(/(\d+)\/(\d+)/);
      if (match) {
        info(`  ${match[1]} of ${match[2]} tests passed`);
      }

      checks.endToEnd = true;
      return true;
    } else {
      error('Smoke test failed');
      info('  Run manually: npm run smoke-test');
      return false;
    }
  } catch (err) {
    error('Smoke test execution failed');
    if (err.stdout) {
      const snippet = err.stdout.toString().slice(-300);
      info(`  Output: ${snippet}`);
    }
    return false;
  }
}

// Main execution
async function main() {
  console.log(
    `${colors.bright}${colors.magenta}╔════════════════════════════════════════════════════════════╗${colors.reset}`
  );
  console.log(
    `${colors.bright}${colors.magenta}║   🚀 POST-DEPLOYMENT VALIDATION - TWILIO CALL GENERATOR   ║${colors.reset}`
  );
  console.log(
    `${colors.bright}${colors.magenta}╚════════════════════════════════════════════════════════════╝${colors.reset}`
  );

  const startTime = Date.now();

  // Check 1: Get deployment info
  const deploymentInfo = await checkDeployment();

  if (!deploymentInfo) {
    console.log(
      `\n${colors.red}Cannot proceed without deployment info${colors.reset}\n`
    );
    process.exit(1);
  }

  // Check 2: Webhook endpoints
  await checkWebhookEndpoints(deploymentInfo.domain);

  // Check 3: Function execution
  await checkFunctionExecution(deploymentInfo.domain);

  // Check 4: End-to-end integration
  await checkEndToEndIntegration();

  // Summary
  header('Post-Deployment Validation Summary');

  const results = [
    { name: 'Deployment Status', passed: checks.deployment },
    { name: 'Webhook Endpoints', passed: checks.webhookEndpoints },
    { name: 'Function Execution', passed: checks.functionExecution },
    { name: 'End-to-End Integration', passed: checks.endToEnd },
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
      `${colors.green}✓ ALL VALIDATIONS PASSED (${passedCount}/${totalCount})${colors.reset}`
    );
    console.log(`${colors.blue}${'─'.repeat(60)}${colors.reset}`);
    console.log(
      `${colors.green}🎉 Deployment is healthy and operational!${colors.reset}`
    );
    console.log(`${colors.blue}${'─'.repeat(60)}${colors.reset}`);
    console.log(`\n${colors.bright}Deployed Functions:${colors.reset}`);
    console.log(
      `  • Conference Status Webhook: ${colors.blue}https://${deploymentInfo.domain}/conference-status-webhook${colors.reset}`
    );
    console.log(
      `  • Conference Timer: ${colors.blue}https://${deploymentInfo.domain}/conference-timer${colors.reset}`
    );
    console.log(
      `  • Transcription Webhook: ${colors.blue}https://${deploymentInfo.domain}/transcription-webhook${colors.reset}`
    );
    console.log(`\n${colors.bright}Next steps:${colors.reset}`);
    console.log(
      `  1. Generate synthetic calls: ${colors.blue}node src/main.js${colors.reset}`
    );
    console.log(
      `  2. Monitor in Twilio Console: ${colors.blue}https://console.twilio.com${colors.reset}`
    );
    console.log(
      `  3. View data in Segment: ${colors.blue}https://app.segment.com${colors.reset}`
    );
  } else {
    console.log(
      `${colors.yellow}⚠ ${passedCount}/${totalCount} validations passed${colors.reset}`
    );
    console.log(`${colors.blue}${'─'.repeat(60)}${colors.reset}`);
    console.log(
      `${colors.red}⚠️  Deployment has issues. Review the output above.${colors.reset}`
    );
    console.log(`${colors.blue}${'─'.repeat(60)}${colors.reset}`);
  }

  const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n${colors.blue}Completed in ${elapsedTime}s${colors.reset}\n`);

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
