#!/usr/bin/env node
// ABOUTME: Validates Twilio Event Streams and AWS EventBridge configuration
// ABOUTME: Checks IAM roles, event bus, subscriptions, and rules

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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

function warning(message) {
  log(`⚠ ${message}`, 'yellow');
}

function info(message) {
  log(`ℹ ${message}`, 'blue');
}

async function validateAwsEventBridge() {
  info('Validating AWS EventBridge configuration...');

  try {
    // Check if AWS CLI is installed
    try {
      execSync('aws --version', { stdio: 'pipe' });
      success('AWS CLI is installed');
    } catch (err) {
      error('AWS CLI is not installed');
      return false;
    }

    // Check for event bus
    try {
      const result = execSync(
        'aws events describe-event-bus --name twilio-call-events',
        {
          encoding: 'utf8',
          stdio: 'pipe',
        }
      );
      const eventBus = JSON.parse(result);
      success(`Event bus found: ${eventBus.Arn}`);
    } catch (err) {
      error('Event bus "twilio-call-events" not found');
      warning('Run: aws events create-event-bus --name twilio-call-events');
      return false;
    }

    // Check for IAM role
    try {
      const result = execSync(
        'aws iam get-role --role-name TwilioEventStreamRole',
        {
          encoding: 'utf8',
          stdio: 'pipe',
        }
      );
      const role = JSON.parse(result);
      success(`IAM role found: ${role.Role.Arn}`);
    } catch (err) {
      error('IAM role "TwilioEventStreamRole" not found');
      warning('Follow setup guide in docs/event-streams-setup.md');
      return false;
    }

    // Check for IAM policy
    try {
      execSync(
        'aws iam get-policy --policy-arn $(aws iam list-policies --query "Policies[?PolicyName==\'TwilioEventStreamPolicy\'].Arn" --output text)',
        {
          stdio: 'pipe',
        }
      );
      success('IAM policy "TwilioEventStreamPolicy" found');
    } catch (err) {
      warning('IAM policy "TwilioEventStreamPolicy" not found');
      warning('Create policy from docs/aws-iam-policy.json');
    }

    // List EventBridge rules
    try {
      const result = execSync(
        'aws events list-rules --event-bus-name twilio-call-events',
        {
          encoding: 'utf8',
          stdio: 'pipe',
        }
      );
      const rules = JSON.parse(result);
      if (rules.Rules && rules.Rules.length > 0) {
        success(`Found ${rules.Rules.length} EventBridge rule(s):`);
        rules.Rules.forEach(rule => {
          info(`  - ${rule.Name} (${rule.State})`);
        });
      } else {
        warning('No EventBridge rules configured');
        warning('Create rules to route events to Lambda/SQS');
      }
    } catch (err) {
      warning('Could not list EventBridge rules');
    }

    return true;
  } catch (err) {
    error(`AWS validation error: ${err.message}`);
    return false;
  }
}

async function validateTwilioEventStreams() {
  info('Validating Twilio Event Streams configuration...');

  try {
    // Check if Twilio CLI is installed
    try {
      execSync('twilio --version', { stdio: 'pipe' });
      success('Twilio CLI is installed');
    } catch (err) {
      error('Twilio CLI is not installed');
      warning('Install: npm install -g twilio-cli');
      return false;
    }

    // Check Twilio CLI profile
    try {
      execSync('twilio profiles:list', { stdio: 'pipe' });
      success('Twilio CLI is configured');
    } catch (err) {
      error('Twilio CLI is not configured');
      warning('Run: twilio login');
      return false;
    }

    // List Event Streams sinks
    try {
      const result = execSync('twilio api:events:v1:sinks:list --output json', {
        encoding: 'utf8',
        stdio: 'pipe',
      });
      const sinks = JSON.parse(result);
      if (sinks && sinks.length > 0) {
        success(`Found ${sinks.length} Event Streams sink(s):`);
        sinks.forEach(sink => {
          info(`  - ${sink.description || sink.sid} (${sink.sinkType})`);
        });
      } else {
        warning('No Event Streams sinks configured');
        warning('Create sink using twilio api:events:v1:sinks:create');
      }
    } catch (err) {
      warning('Could not list Event Streams sinks');
      warning('Ensure Event Streams is enabled on your Twilio account');
    }

    // List Event Streams subscriptions
    try {
      const result = execSync(
        'twilio api:events:v1:subscriptions:list --output json',
        {
          encoding: 'utf8',
          stdio: 'pipe',
        }
      );
      const subscriptions = JSON.parse(result);
      if (subscriptions && subscriptions.length > 0) {
        success(`Found ${subscriptions.length} Event Streams subscription(s):`);
        subscriptions.forEach(sub => {
          info(`  - ${sub.description || sub.sid}`);
        });
      } else {
        warning('No Event Streams subscriptions configured');
        warning('Create subscription to start receiving events');
      }
    } catch (err) {
      warning('Could not list Event Streams subscriptions');
    }

    return true;
  } catch (err) {
    error(`Twilio validation error: ${err.message}`);
    return false;
  }
}

async function validateDocumentation() {
  info('Validating documentation...');

  const setupGuide = path.join(__dirname, '../docs/event-streams-setup.md');
  const iamPolicy = path.join(__dirname, '../docs/aws-iam-policy.json');

  if (fs.existsSync(setupGuide)) {
    success('Setup guide exists: docs/event-streams-setup.md');
  } else {
    error('Setup guide not found: docs/event-streams-setup.md');
    return false;
  }

  if (fs.existsSync(iamPolicy)) {
    success('IAM policy exists: docs/aws-iam-policy.json');

    // Validate JSON
    try {
      const policyContent = fs.readFileSync(iamPolicy, 'utf8');
      JSON.parse(policyContent);
      success('IAM policy is valid JSON');
    } catch (err) {
      error('IAM policy is not valid JSON');
      return false;
    }
  } else {
    error('IAM policy not found: docs/aws-iam-policy.json');
    return false;
  }

  return true;
}

async function main() {
  console.log('');
  log('═══════════════════════════════════════════════════════', 'blue');
  log('  Twilio Event Streams Configuration Validator', 'blue');
  log('═══════════════════════════════════════════════════════', 'blue');
  console.log('');

  let allValid = true;

  // Validate documentation
  const docsValid = await validateDocumentation();
  allValid = allValid && docsValid;
  console.log('');

  // Validate AWS
  const awsValid = await validateAwsEventBridge();
  allValid = allValid && awsValid;
  console.log('');

  // Validate Twilio
  const twilioValid = await validateTwilioEventStreams();
  allValid = allValid && twilioValid;
  console.log('');

  // Summary
  log('═══════════════════════════════════════════════════════', 'blue');
  if (allValid) {
    success('All validations passed! Event Streams is configured.');
  } else {
    warning('Some validations failed. Review the output above.');
    info('See docs/event-streams-setup.md for setup instructions.');
  }
  log('═══════════════════════════════════════════════════════', 'blue');
  console.log('');

  process.exit(allValid ? 0 : 1);
}

main().catch(err => {
  error(`Validation failed: ${err.message}`);
  process.exit(1);
});
