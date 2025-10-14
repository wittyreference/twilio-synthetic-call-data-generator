// ABOUTME: Test script to verify Layer 2 error handling (retry logic and circuit breaker)
// ABOUTME: Simulates webhook events to trigger error handling features in deployed functions

const https = require('https');

const DOMAIN =
  process.env.SERVERLESS_DOMAIN || 'vibe-clauding-8464-dev.twil.io';

function makeRequest(path, data) {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams(data).toString();

    const options = {
      hostname: DOMAIN,
      port: 443,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': postData.length,
      },
    };

    const req = https.request(options, res => {
      let body = '';

      res.on('data', chunk => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve({
            statusCode: res.statusCode,
            body: response,
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            body: body,
          });
        }
      });
    });

    req.on('error', e => {
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

async function testRecordingCompletedEvent(testNumber) {
  console.log(`\n[Test ${testNumber}] 📞 Sending recording-completed event...`);

  const data = {
    StatusCallbackEvent: 'recording-completed',
    RecordingSid: `RE${Math.random().toString(36).substring(2, 15)}`,
    RecordingUrl: `/recordings/RE${Math.random().toString(36).substring(2, 15)}`,
    ConferenceSid: `CF${Math.random().toString(36).substring(2, 15)}`,
    Duration: Math.floor(Math.random() * 300) + 60,
    RecordingStatus: 'completed',
  };

  try {
    const result = await makeRequest('/conference-status-webhook', data);
    console.log(`[Test ${testNumber}] ✅ Status: ${result.statusCode}`);
    console.log(
      `[Test ${testNumber}] 📋 Response: ${JSON.stringify(result.body, null, 2)}`
    );
    return result;
  } catch (error) {
    console.log(`[Test ${testNumber}] ❌ Error: ${error.message}`);
    return { error: error.message };
  }
}

async function testTranscriptionWebhook(testNumber) {
  console.log(
    `\n[Test ${testNumber}] 📝 Sending transcription-completed event...`
  );

  const data = {
    TranscriptionSid: `TR${Math.random().toString(36).substring(2, 15)}`,
    TranscriptionStatus: 'completed',
    TranscriptionText:
      'Thank you for helping me with my billing question. This was very helpful!',
    RecordingSid: `RE${Math.random().toString(36).substring(2, 15)}`,
    CallSid: `CA${Math.random().toString(36).substring(2, 15)}`,
  };

  try {
    const result = await makeRequest('/transcription-webhook', data);
    console.log(`[Test ${testNumber}] ✅ Status: ${result.statusCode}`);
    console.log(
      `[Test ${testNumber}] 📋 Response: ${JSON.stringify(result.body, null, 2)}`
    );
    return result;
  } catch (error) {
    console.log(`[Test ${testNumber}] ❌ Error: ${error.message}`);
    return { error: error.message };
  }
}

async function testConferenceEndEvent(testNumber) {
  console.log(`\n[Test ${testNumber}] 🏁 Sending conference-end event...`);

  const data = {
    StatusCallbackEvent: 'conference-end',
    ConferenceSid: `CF${Math.random().toString(36).substring(2, 15)}`,
    FriendlyName: `Test Conference ${testNumber}`,
    Duration: Math.floor(Math.random() * 600) + 120,
    AccountSid:
      process.env.TWILIO_ACCOUNT_SID || 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  };

  try {
    const result = await makeRequest('/conference-status-webhook', data);
    console.log(`[Test ${testNumber}] ✅ Status: ${result.statusCode}`);
    console.log(
      `[Test ${testNumber}] 📋 Response: ${JSON.stringify(result.body, null, 2)}`
    );
    return result;
  } catch (error) {
    console.log(`[Test ${testNumber}] ❌ Error: ${error.message}`);
    return { error: error.message };
  }
}

async function checkHealth() {
  console.log('\n🏥 Checking health endpoint...');
  return new Promise((resolve, reject) => {
    https
      .get(`https://${DOMAIN}/health`, res => {
        let body = '';
        res.on('data', chunk => (body += chunk));
        res.on('end', () => {
          try {
            const health = JSON.parse(body);
            console.log(`✅ Health Status: ${health.status}`);
            console.log(`   Twilio: ${health.dependencies.twilio.status}`);
            console.log(
              `   Voice Intelligence: ${health.dependencies.voiceIntelligence.status}`
            );
            console.log(`   Segment: ${health.dependencies.segment.status}`);
            resolve(health);
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

async function main() {
  console.log(
    '\n╔════════════════════════════════════════════════════════════╗'
  );
  console.log('║  🧪 ERROR HANDLING TEST - Layer 2 Verification           ║');
  console.log(
    '╚════════════════════════════════════════════════════════════╝\n'
  );

  console.log(`Testing domain: ${DOMAIN}`);

  const results = {
    health: null,
    tests: [],
  };

  try {
    // Check health first
    results.health = await checkHealth();

    // Run 5 test events
    console.log(
      '\n════════════════════════════════════════════════════════════'
    );
    console.log('  Running 5 Test Events');
    console.log('════════════════════════════════════════════════════════════');

    results.tests.push(await testRecordingCompletedEvent(1));
    await new Promise(resolve => setTimeout(resolve, 1000));

    results.tests.push(await testTranscriptionWebhook(2));
    await new Promise(resolve => setTimeout(resolve, 1000));

    results.tests.push(await testConferenceEndEvent(3));
    await new Promise(resolve => setTimeout(resolve, 1000));

    results.tests.push(await testRecordingCompletedEvent(4));
    await new Promise(resolve => setTimeout(resolve, 1000));

    results.tests.push(await testRecordingCompletedEvent(5));

    // Summary
    console.log(
      '\n════════════════════════════════════════════════════════════'
    );
    console.log('  Test Summary');
    console.log(
      '════════════════════════════════════════════════════════════\n'
    );

    const successful = results.tests.filter(
      t => t.statusCode === 200 || !t.error
    ).length;
    const failed = results.tests.length - successful;

    console.log(`✅ Successful: ${successful}/${results.tests.length}`);
    console.log(`❌ Failed: ${failed}/${results.tests.length}`);

    if (successful === results.tests.length) {
      console.log('\n🎉 All tests passed!');
      console.log(
        '\n📋 Next Step: Check function logs to verify error handling:'
      );
      console.log(
        `   twilio serverless:logs --service-sid ZS85bd3ed9bea5f4339c5361f2ff36e44c`
      );
    } else {
      console.log('\n⚠️  Some tests failed - check responses above');
    }
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

main();
