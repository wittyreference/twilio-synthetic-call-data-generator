// ABOUTME: Script to configure Twilio Debugger webhook for error monitoring
// ABOUTME: Sets up the error-handler function as the webhook endpoint for all Twilio errors/warnings

require('dotenv').config();
const twilio = require('twilio');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

async function configureDebuggerWebhook() {
  console.log(
    `${colors.magenta}╔════════════════════════════════════════════════════════════╗${colors.reset}`
  );
  console.log(
    `${colors.magenta}║     🔧 CONFIGURING TWILIO DEBUGGER WEBHOOK               ║${colors.reset}`
  );
  console.log(
    `${colors.magenta}╚════════════════════════════════════════════════════════════╝${colors.reset}\n`
  );

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const serverlessDomain =
    process.env.SERVERLESS_DOMAIN || 'vibe-clauding-8464-dev.twil.io';

  if (!accountSid || !authToken) {
    console.error(
      `${colors.red}✗ Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN${colors.reset}`
    );
    process.exit(1);
  }

  const webhookUrl = `https://${serverlessDomain}/error-handler`;

  console.log(`${colors.blue}ℹ Webhook URL: ${webhookUrl}${colors.reset}\n`);

  try {
    const client = twilio(accountSid, authToken);

    // Verify account connection
    const account = await client.api.accounts(accountSid).fetch();

    console.log(
      `${colors.green}✓ Account verified: ${account.friendlyName}${colors.reset}`
    );

    console.log(
      `${colors.yellow}⚠  Note: Debugger webhook must be configured manually in Twilio Console${colors.reset}`
    );
    console.log(`${colors.blue}ℹ Steps to configure:${colors.reset}`);
    console.log(`  1. Go to: https://console.twilio.com/us1/monitor/debugger`);
    console.log(`  2. Click "Settings" (gear icon in top right)`);
    console.log(
      `  3. Under "Webhook", enter: ${colors.magenta}${webhookUrl}${colors.reset}`
    );
    console.log(`  4. Click "Save"`);
    console.log('');
    console.log(
      `${colors.green}✓ Configuration instructions displayed${colors.reset}\n`
    );
  } catch (error) {
    console.error(`${colors.red}✗ Error: ${error.message}${colors.reset}\n`);
    process.exit(1);
  }
}

configureDebuggerWebhook();
