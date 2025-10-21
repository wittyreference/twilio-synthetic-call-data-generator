// ABOUTME: Timer function for terminating Twilio conferences after specified duration
// ABOUTME: Updates conference status to 'completed' via Twilio API

// ⚠️ LOCKED FILE - DO NOT MODIFY WITHOUT MC'S EXPLICIT AUTHORIZATION ⚠️
// This file controls conference termination logic which is WORKING correctly.
// See docs/CALL-INFRASTRUCTURE-LOCKDOWN.md for details.
// Any modifications require MC to say: "I AUTHORIZE YOU TO MODIFY conference-timer.js"

exports.handler = async function (context, event, callback) {
  try {
    // Validate required ConferenceSid
    if (!event || !event.ConferenceSid) {
      console.error('Missing required ConferenceSid');
      return callback(null, {
        success: false,
        error: 'Missing required field: ConferenceSid',
        timestamp: new Date().toISOString(),
      });
    }

    const conferenceSid = event.ConferenceSid.trim();

    // Validate empty SID
    if (conferenceSid === '') {
      console.error('ConferenceSid cannot be empty');
      return callback(null, {
        success: false,
        error: 'ConferenceSid cannot be empty',
        timestamp: new Date().toISOString(),
      });
    }

    // Validate SID format (CF prefix + 32 characters)
    if (!conferenceSid.startsWith('CF') || conferenceSid.length !== 34) {
      console.error('Invalid ConferenceSid format:', conferenceSid);
      return callback(null, {
        success: false,
        error:
          'ConferenceSid must be a valid Conference SID (CF + 32 characters)',
        timestamp: new Date().toISOString(),
      });
    }

    const client = context.getTwilioClient();

    // Fetch current conference status
    console.log(`Checking conference ${conferenceSid}...`);
    let conference;
    try {
      conference = await client.conferences(conferenceSid).fetch();
    } catch (fetchError) {
      if (fetchError.status === 404) {
        console.error(`Conference ${conferenceSid} not found`);
        return callback(null, {
          success: false,
          error: `Conference ${conferenceSid} not found`,
          timestamp: new Date().toISOString(),
        });
      }
      throw fetchError;
    }

    const currentStatus = conference.status;
    console.log(`Conference ${conferenceSid} current status: ${currentStatus}`);

    // Check if already completed
    if (currentStatus === 'completed') {
      console.log(`Conference ${conferenceSid} is already completed`);
      return callback(null, {
        success: true,
        conferenceSid: conferenceSid,
        action: 'already_completed',
        message: `Conference ${conferenceSid} is already completed`,
        previousStatus: currentStatus,
        timestamp: new Date().toISOString(),
      });
    }

    // Terminate the conference
    console.log(`Terminating conference ${conferenceSid}...`);
    const updatedConference = await client.conferences(conferenceSid).update({
      status: 'completed',
    });

    console.log(`Conference ${conferenceSid} terminated successfully`);

    return callback(null, {
      success: true,
      conferenceSid: conferenceSid,
      action: 'terminated',
      previousStatus: currentStatus,
      newStatus: updatedConference.status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in conference timer:', error.message);

    // Handle specific error types
    let errorMessage = error.message;
    if (error.message.includes('timeout')) {
      errorMessage = `Network timeout while processing conference: ${error.message}`;
    } else if (error.message.includes('API')) {
      errorMessage = `Twilio API error: ${error.message}`;
    }

    return callback(null, {
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }
};
