// ABOUTME: Configuration module that loads and validates environment variables
// ABOUTME: Provides typed, immutable configuration objects for Twilio, AWS, and Segment

// Only load dotenv in non-test environments
if (process.env.NODE_ENV !== 'test') {
  require('dotenv').config();
}

// Valid AWS regions (common ones)
const VALID_AWS_REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1',
  'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2',
  'ap-south-1', 'sa-east-1', 'ca-central-1',
];

/**
 * Validates that a required environment variable exists
 */
function requireEnv(name) {
  const value = process.env[name];

  if (value === undefined) {
    throw new Error(`${name} is required`);
  }

  // Trim whitespace
  const trimmedValue = value.trim();

  if (trimmedValue === '') {
    throw new Error(`${name} cannot be empty`);
  }

  return trimmedValue;
}

/**
 * Validates Twilio Account SID format
 */
function validateTwilioAccountSid(accountSid) {
  if (!accountSid.startsWith('AC') || accountSid.length !== 34) {
    throw new Error('TWILIO_ACCOUNT_SID must start with AC and be 34 characters long');
  }
  return accountSid;
}

/**
 * Validates Twilio Auth Token format
 */
function validateTwilioAuthToken(authToken) {
  if (authToken.length < 32) {
    throw new Error('TWILIO_AUTH_TOKEN must be at least 32 characters long');
  }
  return authToken;
}

/**
 * Validates AWS region format
 */
function validateAwsRegion(region) {
  if (!VALID_AWS_REGIONS.includes(region)) {
    throw new Error('AWS_REGION must be a valid AWS region');
  }
  return region;
}

/**
 * Creates configuration object with validation
 */
function createConfig() {
  // Load and validate all required environment variables
  const twilioAccountSid = validateTwilioAccountSid(requireEnv('TWILIO_ACCOUNT_SID'));
  const twilioAuthToken = validateTwilioAuthToken(requireEnv('TWILIO_AUTH_TOKEN'));
  const awsKinesisStreamName = requireEnv('AWS_KINESIS_STREAM_NAME');
  const awsRegion = validateAwsRegion(requireEnv('AWS_REGION'));
  const segmentWorkspaceId = requireEnv('SEGMENT_WORKSPACE_ID');
  const segmentWriteKey = requireEnv('SEGMENT_WRITE_KEY');

  // Create configuration object with property setters that throw in strict mode
  const config = {};

  Object.defineProperties(config, {
    twilio: {
      value: {},
      writable: false,
      configurable: false,
      enumerable: true,
    },
    aws: {
      value: {},
      writable: false,
      configurable: false,
      enumerable: true,
    },
    segment: {
      value: {},
      writable: false,
      configurable: false,
      enumerable: true,
    },
  });

  Object.defineProperties(config.twilio, {
    accountSid: {
      value: twilioAccountSid,
      writable: false,
      configurable: false,
      enumerable: true,
    },
    authToken: {
      value: twilioAuthToken,
      writable: false,
      configurable: false,
      enumerable: true,
    },
  });

  Object.defineProperties(config.aws, {
    kinesisStreamName: {
      value: awsKinesisStreamName,
      writable: false,
      configurable: false,
      enumerable: true,
    },
    region: {
      value: awsRegion,
      writable: false,
      configurable: false,
      enumerable: true,
    },
  });

  Object.defineProperties(config.segment, {
    workspaceId: {
      value: segmentWorkspaceId,
      writable: false,
      configurable: false,
      enumerable: true,
    },
    writeKey: {
      value: segmentWriteKey,
      writable: false,
      configurable: false,
      enumerable: true,
    },
  });

  return Object.freeze(config);
}

module.exports = createConfig();
