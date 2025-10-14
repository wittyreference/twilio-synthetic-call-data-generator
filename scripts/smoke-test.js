#!/usr/bin/env node
// ABOUTME: Smoke test script to validate real API integrations
// ABOUTME: Tests actual Twilio API calls and Segment CDP integration

require('dotenv').config();
const twilio = require('twilio');
const { loadCustomers } = require('../src/personas/customer-loader');
const { loadAgents } = require('../src/personas/agent-loader');
const PairSelector = require('../src/pairing/pair-selector');
const ProfileCreator = require('../src/segment/profile-creator');
const ProfileUpdater = require('../src/segment/profile-updater');

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function success(message) {
  log(`✓ ${message}`, 'green');
}

function error(message) {
  log(`✗ ${message}`, 'red');
}

function warning(message) {
  log(`⚠ ${message}`, 'yellow');
}

function info(message) {
  log(`ℹ ${message}`, 'blue');
}

function header(message) {
  log(`\n${'═'.repeat(60)}`, 'magenta');
  log(`  ${message}`, 'magenta');
  log(`${'═'.repeat(60)}`, 'magenta');
}

async function validateEnvironment() {
  header('Environment Validation');

  const required = {
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  };

  const optional = {
    SEGMENT_WRITE_KEY: process.env.SEGMENT_WRITE_KEY,
    AGENT_PHONE_NUMBER: process.env.AGENT_PHONE_NUMBER,
  };

  let allValid = true;

  // Check required
  for (const [key, value] of Object.entries(required)) {
    if (value) {
      success(`${key} is set`);
    } else {
      error(`${key} is missing (REQUIRED)`);
      allValid = false;
    }
  }

  // Check optional
  for (const [key, value] of Object.entries(optional)) {
    if (value) {
      success(`${key} is set`);
    } else {
      warning(`${key} is missing (optional - some tests will be skipped)`);
    }
  }

  return allValid;
}

async function testDataLoading() {
  header('Data Loading Test');

  try {
    const customers = loadCustomers();
    success(`Loaded ${customers.length} customer personas`);

    const agents = loadAgents();
    success(`Loaded ${agents.length} agent personas`);

    // Validate data structure
    const customer = customers[0];
    if (
      customer.CustomerName &&
      customer.PhoneNumber &&
      customer.ContactInformation
    ) {
      success('Customer data structure is valid');
    } else {
      error('Customer data structure is invalid');
      return false;
    }

    const agent = agents[0];
    if (agent.AgentName && agent.CompetenceLevel && agent.Characteristics) {
      success('Agent data structure is valid');
    } else {
      error('Agent data structure is invalid');
      return false;
    }

    return true;
  } catch (err) {
    error(`Data loading failed: ${err.message}`);
    return false;
  }
}

async function testPairing() {
  header('Pairing Logic Test');

  try {
    const pairSelector = new PairSelector();
    const pair = pairSelector.selectRandomPair();

    success(
      `Generated pair: ${pair.customer.CustomerName} <-> ${pair.agent.AgentName}`
    );

    if (pair.conferenceId.match(/^CF[a-f0-9]{32}$/)) {
      success(`Conference ID format valid: ${pair.conferenceId}`);
    } else {
      error(`Conference ID format invalid: ${pair.conferenceId}`);
      return false;
    }

    // Test strategy-based pairing
    const frustratedPair = pairSelector.selectPairWithStrategy('frustrated');
    if (frustratedPair.agent.CompetenceLevel === 'High') {
      success('Frustrated customer paired with High competence agent');
    } else {
      warning(
        `Frustrated customer got ${frustratedPair.agent.CompetenceLevel} competence agent`
      );
    }

    return true;
  } catch (err) {
    error(`Pairing failed: ${err.message}`);
    return false;
  }
}

async function testTwilioConnection() {
  header('Twilio API Connection Test');

  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    warning('Twilio credentials not set - skipping');
    return true;
  }

  try {
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    // Test API connection by fetching account info
    const account = await client.api
      .accounts(process.env.TWILIO_ACCOUNT_SID)
      .fetch();
    success(`Connected to Twilio account: ${account.friendlyName}`);
    success(`Account status: ${account.status}`);

    return true;
  } catch (err) {
    error(`Twilio connection failed: ${err.message}`);
    return false;
  }
}

async function testSegmentConnection() {
  header('Segment API Connection Test');

  if (!process.env.SEGMENT_WRITE_KEY) {
    warning('SEGMENT_WRITE_KEY not set - skipping');
    return true;
  }

  try {
    // Use the Analytics constructor from the package
    const { Analytics } = require('@segment/analytics-node');
    const analytics = new Analytics({
      writeKey: process.env.SEGMENT_WRITE_KEY,
    });

    // Send a test identify call
    await new Promise((resolve, reject) => {
      analytics.identify(
        {
          userId: 'smoke_test_user',
          traits: {
            test: true,
            timestamp: new Date().toISOString(),
          },
        },
        err => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    success('Segment identify() call succeeded');

    // Flush and close the client
    await analytics.closeAndFlush();

    success('Segment flush() succeeded');

    return true;
  } catch (err) {
    error(`Segment connection failed: ${err.message}`);
    return false;
  }
}

async function testSegmentProfileCreation() {
  header('Segment Profile Creation Test');

  if (!process.env.SEGMENT_WRITE_KEY) {
    warning('SEGMENT_WRITE_KEY not set - skipping');
    return true;
  }

  try {
    const profileCreator = ProfileCreator.initialize(
      process.env.SEGMENT_WRITE_KEY
    );
    const customers = loadCustomers();

    // Create profile for first customer
    const customer = customers[0];
    await profileCreator.createProfile(customer);

    success(`Created Segment profile for: ${customer.CustomerName}`);
    info(`  Email: ${customer.ContactInformation}`);
    info(`  Phone: ${customer.PhoneNumber}`);

    return true;
  } catch (err) {
    error(`Profile creation failed: ${err.message}`);
    return false;
  }
}

async function testSegmentProfileUpdate() {
  header('Segment Profile Update Test');

  if (!process.env.SEGMENT_WRITE_KEY) {
    warning('SEGMENT_WRITE_KEY not set - skipping');
    return true;
  }

  try {
    const profileUpdater = ProfileUpdater.initialize(
      process.env.SEGMENT_WRITE_KEY
    );

    const analytics = {
      sentiment: 'positive',
      resolution: 'resolved',
      escalation: false,
      wordCount: 150,
    };

    await profileUpdater.updateFromCallAnalytics('smoke_test_user', analytics);

    success('Updated Segment profile with call analytics');
    info('  Sentiment: positive');
    info('  Resolution: resolved');
    info('  Escalation: false');

    return true;
  } catch (err) {
    error(`Profile update failed: ${err.message}`);
    return false;
  }
}

async function testConferenceIDGeneration() {
  header('Conference ID Generation Test');

  try {
    const pairSelector = new PairSelector();
    const ids = new Set();

    // Generate 100 IDs
    for (let i = 0; i < 100; i++) {
      const id = pairSelector.generateConferenceId();
      ids.add(id);
    }

    if (ids.size === 100) {
      success('Generated 100 unique conference IDs');
    } else {
      error(
        `Generated ${ids.size}/100 unique IDs (${100 - ids.size} duplicates)`
      );
      return false;
    }

    // Validate format
    for (const id of ids) {
      if (!id.match(/^CF[a-f0-9]{32}$/)) {
        error(`Invalid conference ID format: ${id}`);
        return false;
      }
    }
    success('All conference IDs match expected format');

    return true;
  } catch (err) {
    error(`Conference ID generation failed: ${err.message}`);
    return false;
  }
}

async function testTwilioSync() {
  header('Twilio Sync Test');

  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    warning('Twilio credentials not set - skipping');
    return true;
  }

  try {
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    // Try to fetch or create a Sync service
    let syncService;
    try {
      // Check if we have TWILIO_SYNC_SERVICE_SID
      if (process.env.TWILIO_SYNC_SERVICE_SID) {
        syncService = await client.sync.v1
          .services(process.env.TWILIO_SYNC_SERVICE_SID)
          .fetch();
        success(`Found Sync Service: ${syncService.friendlyName || syncService.sid}`);
      } else {
        warning('TWILIO_SYNC_SERVICE_SID not set - checking default service');
        // List services to see if one exists
        const services = await client.sync.v1.services.list({ limit: 1 });
        if (services.length > 0) {
          syncService = services[0];
          success(`Found default Sync Service: ${syncService.friendlyName || syncService.sid}`);
          info(`  Add TWILIO_SYNC_SERVICE_SID=${syncService.sid} to .env`);
        } else {
          warning('No Sync services found - conversation history will use default service');
          return true;
        }
      }

      // Test creating and fetching a document
      const testDocId = `smoke_test_${Date.now()}`;
      const document = await client.sync.v1
        .services(syncService.sid)
        .documents.create({
          uniqueName: testDocId,
          data: {
            test: true,
            messages: [
              { role: 'user', content: 'Test message' },
              { role: 'assistant', content: 'Test response' }
            ]
          }
        });

      success('Created Sync document for conversation history test');
      info(`  Document SID: ${document.sid}`);

      // Fetch it back
      const fetched = await client.sync.v1
        .services(syncService.sid)
        .documents(document.sid)
        .fetch();

      if (fetched.data.messages && fetched.data.messages.length === 2) {
        success('Retrieved conversation history from Sync document');
      } else {
        error('Sync document data structure invalid');
        return false;
      }

      // Clean up
      await client.sync.v1
        .services(syncService.sid)
        .documents(document.sid)
        .remove();
      success('Cleaned up test Sync document');

      return true;
    } catch (err) {
      if (err.code === 20404) {
        warning('Sync service not found - conversation history will use in-memory fallback');
        return true;
      }
      throw err;
    }
  } catch (err) {
    error(`Twilio Sync test failed: ${err.message}`);
    return false;
  }
}

async function testTwiMLApplication() {
  header('TwiML Application Test');

  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    warning('Twilio credentials not set - skipping');
    return true;
  }

  if (!process.env.TWIML_APP_SID) {
    warning('TWIML_APP_SID not set - skipping');
    info('  Set TWIML_APP_SID in .env to test TwiML Application integration');
    return true;
  }

  try {
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    // Fetch the TwiML Application
    const app = await client.applications(process.env.TWIML_APP_SID).fetch();

    success(`Found TwiML Application: ${app.friendlyName}`);
    info(`  SID: ${app.sid}`);

    if (app.voiceUrl) {
      success(`Voice URL configured: ${app.voiceUrl}`);
    } else {
      warning('Voice URL not configured for TwiML Application');
    }

    if (app.statusCallback) {
      success(`Status Callback configured: ${app.statusCallback}`);
    } else {
      info('Status Callback not configured (optional)');
    }

    // Validate app: URL format
    const testAppUrl = `app:${process.env.TWIML_APP_SID}?role=agent&persona=Test`;
    if (testAppUrl.startsWith('app:AP')) {
      success('TwiML Application URL format valid for Participants API');
      info(`  Example: ${testAppUrl}`);
    } else {
      error('TwiML Application SID format invalid');
      return false;
    }

    return true;
  } catch (err) {
    error(`TwiML Application test failed: ${err.message}`);
    return false;
  }
}

async function testServerlessFunctions() {
  header('Serverless Functions Test');

  if (!process.env.DOMAIN_NAME) {
    warning('DOMAIN_NAME not set - skipping');
    info('  Set DOMAIN_NAME in .env to test deployed functions (e.g., your-service.twil.io)');
    return true;
  }

  try {
    const https = require('https');
    const baseUrl = `https://${process.env.DOMAIN_NAME}`;

    // Test health endpoint
    const healthUrl = `${baseUrl}/health`;
    info(`Testing health endpoint: ${healthUrl}`);

    const healthResponse = await new Promise((resolve, reject) => {
      https.get(healthUrl, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          resolve({ statusCode: res.statusCode, data });
        });
      }).on('error', reject);
    });

    if (healthResponse.statusCode === 200) {
      success('Health endpoint responding');
      try {
        const health = JSON.parse(healthResponse.data);
        info(`  Status: ${health.status}`);
        if (health.dependencies) {
          for (const [dep, status] of Object.entries(health.dependencies)) {
            if (status === 'healthy') {
              success(`  ${dep}: ${status}`);
            } else {
              warning(`  ${dep}: ${status}`);
            }
          }
        }
      } catch (e) {
        info('  Response received (non-JSON)');
      }
    } else {
      warning(`Health endpoint returned ${healthResponse.statusCode}`);
    }

    return true;
  } catch (err) {
    error(`Serverless functions test failed: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('');
  log(
    '╔════════════════════════════════════════════════════════════╗',
    'magenta'
  );
  log(
    '║  🔥 TWILIO SYNTHETIC CALL DATA GENERATOR - SMOKE TEST 🔥  ║',
    'magenta'
  );
  log(
    '╚════════════════════════════════════════════════════════════╝',
    'magenta'
  );
  console.log('');

  const results = {
    environment: false,
    dataLoading: false,
    pairing: false,
    twilioConnection: false,
    twilioSync: false,
    twimlApplication: false,
    serverlessFunctions: false,
    segmentConnection: false,
    segmentProfileCreation: false,
    segmentProfileUpdate: false,
    conferenceIDGeneration: false,
  };

  // Run all tests
  results.environment = await validateEnvironment();

  if (!results.environment) {
    error(
      '\nEnvironment validation failed. Please set required environment variables.'
    );
    info('Copy .env.example to .env and fill in your credentials.');
    process.exit(1);
  }

  results.dataLoading = await testDataLoading();
  results.pairing = await testPairing();
  results.conferenceIDGeneration = await testConferenceIDGeneration();
  results.twilioConnection = await testTwilioConnection();
  results.twilioSync = await testTwilioSync();
  results.twimlApplication = await testTwiMLApplication();
  results.serverlessFunctions = await testServerlessFunctions();
  results.segmentConnection = await testSegmentConnection();
  results.segmentProfileCreation = await testSegmentProfileCreation();
  results.segmentProfileUpdate = await testSegmentProfileUpdate();

  // Summary
  header('Smoke Test Results');

  const passed = Object.values(results).filter(r => r === true).length;
  const total = Object.keys(results).length;

  console.log('');
  for (const [test, result] of Object.entries(results)) {
    if (result) {
      success(test);
    } else {
      error(test);
    }
  }

  console.log('');
  log('─'.repeat(60), 'blue');

  if (passed === total) {
    success(`ALL TESTS PASSED! (${passed}/${total})`);
    log('─'.repeat(60), 'blue');
    log('🎉 Your synthetic call data generator is ready!', 'green');
    log('─'.repeat(60), 'blue');
    process.exit(0);
  } else {
    warning(`${passed}/${total} tests passed`);
    log('─'.repeat(60), 'blue');
    log('⚠️  Some tests failed. Review the output above.', 'yellow');
    log('─'.repeat(60), 'blue');
    process.exit(1);
  }
}

// Run smoke test
main().catch(err => {
  error(`\nSmoke test crashed: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
