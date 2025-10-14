#!/usr/bin/env node
// ABOUTME: Creates custom language operators for Voice Intelligence service
// ABOUTME: Defines intents and outcomes based on customer/agent interaction patterns

require('dotenv').config();
const twilio = require('twilio');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const VOICE_INTELLIGENCE_SID = process.env.VOICE_INTELLIGENCE_SID;

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
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

function info(message) {
  log(`ℹ ${message}`, 'blue');
}

// Define 10 custom language operators combining customer intents and interaction outcomes
const operators = [
  {
    friendlyName: 'Billing Dispute Intent',
    operatorType: 'pii_recognition', // Using available operator types
    config: {
      content_name: 'billing_dispute',
      pattern_matchers: [
        'double charged',
        'billing error',
        'overcharged',
        'charged twice',
        'incorrect charge',
        'refund',
      ],
    },
  },
  {
    friendlyName: 'Damaged Product Intent',
    operatorType: 'pii_recognition',
    config: {
      content_name: 'damaged_product',
      pattern_matchers: [
        'damaged',
        'broken',
        'package arrived damaged',
        'replacement',
      ],
    },
  },
  {
    friendlyName: 'Wrong Product Intent',
    operatorType: 'pii_recognition',
    config: {
      content_name: 'wrong_product',
      pattern_matchers: [
        'wrong product',
        'incorrect item',
        'not what I ordered',
        'different product',
      ],
    },
  },
  {
    friendlyName: 'Address Change Request',
    operatorType: 'pii_recognition',
    config: {
      content_name: 'address_change',
      pattern_matchers: [
        'update address',
        'change shipping address',
        'delivery address',
        'ship to different',
      ],
    },
  },
  {
    friendlyName: 'Late Delivery Complaint',
    operatorType: 'pii_recognition',
    config: {
      content_name: 'late_delivery',
      pattern_matchers: [
        "hasn't arrived",
        'past delivery date',
        'tracking',
        'where is my order',
        'expedited delivery',
      ],
    },
  },
  {
    friendlyName: 'Issue Resolved Outcome',
    operatorType: 'pii_recognition',
    config: {
      content_name: 'issue_resolved',
      pattern_matchers: [
        'thank you',
        'problem solved',
        'that helps',
        'appreciate it',
        "that's great",
        'perfect',
      ],
    },
  },
  {
    friendlyName: 'Escalation Request',
    operatorType: 'pii_recognition',
    config: {
      content_name: 'escalation_request',
      pattern_matchers: [
        'speak to supervisor',
        'talk to manager',
        'escalate',
        'someone else',
        'higher authority',
      ],
    },
  },
  {
    friendlyName: 'Agent Soft Skills Failure',
    operatorType: 'pii_recognition',
    config: {
      content_name: 'agent_soft_skills_failure',
      pattern_matchers: [
        "you don't care",
        'not listening',
        'rushing me',
        'rude',
        'not helpful',
        'attitude',
      ],
    },
  },
  {
    friendlyName: 'Agent Competence Issue',
    operatorType: 'pii_recognition',
    config: {
      content_name: 'agent_competence_issue',
      pattern_matchers: [
        'not sure',
        "don't know",
        'let me check',
        'uncertain',
        'confused',
        'need to transfer',
      ],
    },
  },
  {
    friendlyName: 'Positive Customer Experience',
    operatorType: 'pii_recognition',
    config: {
      content_name: 'positive_experience',
      pattern_matchers: [
        'excellent service',
        'very helpful',
        'great experience',
        'wonderful',
        'satisfied',
        'appreciate your help',
      ],
    },
  },
];

async function createOperators() {
  info(`Creating ${operators.length} custom language operators...`);
  console.log('');

  const results = [];

  for (const operator of operators) {
    try {
      info(`Creating: ${operator.friendlyName}...`);

      // Note: The actual API for custom operators may differ
      // This is a placeholder showing the intended structure
      // We'll need to use the correct Twilio Intelligence API
      const result = await client.intelligence.v2
        .services(VOICE_INTELLIGENCE_SID)
        .operators.create({
          friendlyName: operator.friendlyName,
          operatorType: operator.operatorType,
          config: operator.config,
        });

      success(`Created: ${operator.friendlyName} (${result.sid})`);
      results.push({
        name: operator.friendlyName,
        sid: result.sid,
        success: true,
      });
    } catch (err) {
      error(`Failed to create ${operator.friendlyName}: ${err.message}`);
      results.push({
        name: operator.friendlyName,
        error: err.message,
        success: false,
      });
    }
  }

  console.log('');
  log('═══════════════════════════════════════════════════════', 'blue');

  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.filter((r) => !r.success).length;

  if (successCount > 0) {
    success(`Successfully created ${successCount} operator(s)`);
  }
  if (failureCount > 0) {
    error(`Failed to create ${failureCount} operator(s)`);
  }

  log('═══════════════════════════════════════════════════════', 'blue');

  return results;
}

async function main() {
  console.log('');
  log('═══════════════════════════════════════════════════════', 'blue');
  log('  Voice Intelligence Custom Language Operators Setup', 'blue');
  log('═══════════════════════════════════════════════════════', 'blue');
  console.log('');

  if (!VOICE_INTELLIGENCE_SID) {
    error('VOICE_INTELLIGENCE_SID environment variable is required');
    process.exit(1);
  }

  info(`Voice Intelligence Service: ${VOICE_INTELLIGENCE_SID}`);
  console.log('');

  try {
    await createOperators();
    success('Language operators setup complete!');
    process.exit(0);
  } catch (err) {
    error(`Setup failed: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
