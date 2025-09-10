// ABOUTME: Example Twilio Function for handling voice menu selections
// ABOUTME: Demonstrates digit collection and conditional TwiML responses

exports.handler = function (context, event, callback) {
  // Create a new TwiML response object
  const twiml = new Twilio.twiml.VoiceResponse();

  // Get the digit pressed by the caller
  const { Digits, From } = event;

  console.log(`Caller ${From} pressed: ${Digits}`);

  // Handle menu selections
  switch (Digits) {
    case '1':
      twiml.say(
        {
          voice: 'alice',
          language: 'en-US',
        },
        'You selected information. This is a demo Twilio Voice application built with serverless functions. Visit twilio.com to learn more.'
      );
      break;

    case '2':
      twiml.say(
        {
          voice: 'alice',
          language: 'en-US',
        },
        'You selected support. For technical support, please visit our documentation or contact our support team.'
      );
      break;

    case '0':
      // Redirect back to main menu
      twiml.redirect('/hello');
      break;

    default:
      twiml.say(
        {
          voice: 'alice',
          language: 'en-US',
        },
        'Invalid selection. Please try again.'
      );
      twiml.redirect('/hello');
      break;
  }

  // End the call politely
  if (Digits === '1' || Digits === '2') {
    twiml.pause({ length: 1 });
    twiml.say('Thank you for calling. Goodbye!');
    twiml.hangup();
  }

  // Return the TwiML response
  callback(null, twiml);
};
