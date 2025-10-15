// ABOUTME: Validates that .env.example contains all required environment variables
// ABOUTME: Prevents environment variable mismatches between documentation and code

const fs = require('fs');
const path = require('path');

// Define all environment variables required by the application
const REQUIRED_ENV_VARS = {
  // Core Twilio Configuration
  TWILIO_ACCOUNT_SID: {
    description: 'Twilio Account SID',
    format: /^AC[a-f0-9]{32}$/,
    required: true
  },
  TWILIO_AUTH_TOKEN: {
    description: 'Twilio Auth Token',
    format: /^.{32,}$/,
    required: true
  },

  // AI & State Management
  OPENAI_API_KEY: {
    description: 'OpenAI API Key',
    format: /^sk-[A-Za-z0-9\-_]+$/,
    required: true
  },
  SYNC_SERVICE_SID: {
    description: 'Twilio Sync Service SID',
    format: /^IS[a-f0-9]{32}$/,
    required: true
  },
  TWIML_APP_SID: {
    description: 'TwiML Application SID',
    format: /^AP[a-f0-9]{32}$/,
    required: true
  },

  // Phone Numbers
  AGENT_PHONE_NUMBER: {
    description: 'Agent phone number',
    format: /^\+1\d{10}$/,
    required: true
  },

  // Deployment Configuration
  SERVERLESS_DOMAIN: {
    description: 'Twilio Serverless domain',
    format: /^[a-z0-9\-]+\.twil\.io$/,
    required: true
  },

  // Optional Features
  SEGMENT_WORKSPACE_ID: {
    description: 'Segment Workspace ID',
    format: /.+/,
    required: false
  },
  SEGMENT_WRITE_KEY: {
    description: 'Segment Write Key',
    format: /.+/,
    required: false
  },
  VOICE_INTELLIGENCE_SID: {
    description: 'Voice Intelligence Service SID',
    format: /^GA[a-f0-9]{32}$/,
    required: false
  },

  // Configuration
  MAX_DAILY_CALLS: {
    description: 'Maximum daily OpenAI calls',
    format: /^\d+$/,
    required: false,
    default: '1000'
  },
  NODE_ENV: {
    description: 'Node environment',
    format: /^(development|production|test)$/,
    required: false,
    default: 'development'
  }
};

function parseEnvFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const vars = {};

  content.split('\n').forEach(line => {
    // Skip comments and empty lines
    if (line.startsWith('#') || line.trim() === '') return;

    const match = line.match(/^([A-Z_]+)=/);
    if (match) {
      vars[match[1]] = true;
    }
  });

  return vars;
}

function validateEnvExample() {
  console.log('🔍 Validating .env.example...\n');

  const envExamplePath = path.join(__dirname, '..', '.env.example');

  // Check if .env.example exists
  if (!fs.existsSync(envExamplePath)) {
    console.error('❌ .env.example file not found!');
    process.exit(1);
  }

  // Parse .env.example
  const envExampleVars = parseEnvFile(envExamplePath);

  // Check for missing required variables
  const missing = [];
  const extra = [];

  Object.keys(REQUIRED_ENV_VARS).forEach(varName => {
    const varConfig = REQUIRED_ENV_VARS[varName];

    if (varConfig.required && !envExampleVars[varName]) {
      missing.push(`  - ${varName}: ${varConfig.description}`);
    }
  });

  // Check for documented variables that aren't in our requirements
  Object.keys(envExampleVars).forEach(varName => {
    if (!REQUIRED_ENV_VARS[varName]) {
      extra.push(`  - ${varName}`);
    }
  });

  // Report results
  if (missing.length > 0) {
    console.error('❌ Missing required variables in .env.example:\n');
    console.error(missing.join('\n'));
    console.error('\n');
  }

  if (extra.length > 0) {
    console.warn('⚠️  Variables in .env.example not recognized:\n');
    console.warn(extra.join('\n'));
    console.warn('\n(These may be deprecated or incorrectly named)\n');
  }

  if (missing.length === 0 && extra.length === 0) {
    console.log('✅ .env.example is valid!');
    console.log(`   Found ${Object.keys(envExampleVars).length} environment variables\n`);

    // Show required vs optional breakdown
    const required = Object.keys(REQUIRED_ENV_VARS).filter(k => REQUIRED_ENV_VARS[k].required);
    const optional = Object.keys(REQUIRED_ENV_VARS).filter(k => !REQUIRED_ENV_VARS[k].required);

    console.log(`   Required: ${required.length}`);
    console.log(`   Optional: ${optional.length}`);

    return true;
  }

  process.exit(1);
}

function validateCurrentEnv() {
  console.log('\n🔍 Validating current environment...\n');

  const missing = [];
  const invalid = [];

  Object.keys(REQUIRED_ENV_VARS).forEach(varName => {
    const varConfig = REQUIRED_ENV_VARS[varName];
    const value = process.env[varName];

    // Check if required variable is missing
    if (varConfig.required && !value) {
      missing.push(`  - ${varName}: ${varConfig.description}`);
      return;
    }

    // If variable is set, validate format
    if (value && varConfig.format && !varConfig.format.test(value)) {
      invalid.push(`  - ${varName}: Invalid format (expected: ${varConfig.format})`);
    }
  });

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:\n');
    console.error(missing.join('\n'));
    console.error('\nPlease copy .env.example to .env and fill in the values.\n');
  }

  if (invalid.length > 0) {
    console.error('❌ Invalid environment variable formats:\n');
    console.error(invalid.join('\n'));
    console.error('\n');
  }

  if (missing.length === 0 && invalid.length === 0) {
    console.log('✅ Current environment is valid!\n');
    return true;
  }

  process.exit(1);
}

// Run validation based on command line argument
const args = process.argv.slice(2);

if (args.includes('--env')) {
  // Validate current environment
  validateCurrentEnv();
} else if (args.includes('--example')) {
  // Validate .env.example only
  validateEnvExample();
} else {
  // Validate both by default
  const exampleValid = validateEnvExample();
  if (exampleValid) {
    validateCurrentEnv();
  }
}
