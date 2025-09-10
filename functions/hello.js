// ABOUTME: Example Twilio Function for handling voice calls with text-to-speech
// ABOUTME: Demonstrates basic Voice TwiML response patterns for serverless functions

exports.handler = function (context, event, callback) {
  // Create a new TwiML response object for Voice
  const twiml = new Twilio.twiml.VoiceResponse();

  // Extract call details
  const { From, To, CallSid } = event;

  console.log(`Received call from ${From} to ${To}, CallSid: ${CallSid}`);

  // Add a greeting with text-to-speech
  twiml.say(
    {
      voice: 'alice',
      language: 'en-US',
    },
    'Hello! Thank you for calling. This is a demonstration of Twilio Voice functions.'
  );

  // Add a pause
  twiml.pause({ length: 1 });

  // Provide menu options
  twiml.gather(
    {
      numDigits: 1,
      action: '/voice-menu',
      method: 'POST',
    },
    function () {
      this.say(
        'Press 1 for information, Press 2 for support, or Press 0 to repeat this menu.'
      );
    }
  );

  // Fallback if no input
  twiml.say("We didn't receive your selection. Goodbye!");
  twiml.hangup();

  // Return the TwiML response
  callback(null, twiml);
};
