// ABOUTME: Twilio Sync utility for serverless state management and rate limiting
// ABOUTME: Handles conversation history storage and daily call rate limiting using Sync Documents

const MAX_DAILY_CALLS = 1000; // Default limit - users should configure per their needs
const CONVERSATION_TTL = 3600; // 1 hour - conversations expire after this
const RATE_LIMIT_TTL = 86400; // 24 hours - rate limit resets daily

/**
 * Initialize Twilio Sync service
 * @param {object} context - Twilio Runtime context
 * @returns {object} Sync service instance
 */
function getSyncService(context) {
  if (!context.SYNC_SERVICE_SID) {
    throw new Error('SYNC_SERVICE_SID environment variable is required');
  }

  const client = context.getTwilioClient();
  return client.sync.v1.services(context.SYNC_SERVICE_SID);
}

/**
 * Store conversation history in Sync
 * @param {object} context - Twilio Runtime context
 * @param {string} conversationId - Unique conversation identifier (e.g., conference SID)
 * @param {array} messages - OpenAI message array
 * @returns {Promise<object>} Sync document
 */
async function storeConversationHistory(context, conversationId, messages) {
  try {
    const syncService = getSyncService(context);

    // Create or update the conversation document
    const documentUniqueName = `conversation_${conversationId}`;

    try {
      // Try to update existing document
      const document = await syncService.documents(documentUniqueName).update({
        data: {
          messages,
          lastUpdated: new Date().toISOString(),
        },
        ttl: CONVERSATION_TTL, // Auto-expire after 1 hour
      });

      console.log(
        `✅ Updated conversation ${conversationId} in Sync (${messages.length} messages)`
      );
      return document;
    } catch (updateError) {
      // Document doesn't exist, create it
      if (updateError.status === 404) {
        const document = await syncService.documents.create({
          uniqueName: documentUniqueName,
          data: {
            messages,
            lastUpdated: new Date().toISOString(),
          },
          ttl: CONVERSATION_TTL,
        });

        console.log(
          `✅ Created conversation ${conversationId} in Sync (${messages.length} messages)`
        );
        return document;
      }
      throw updateError;
    }
  } catch (error) {
    console.error(`❌ Failed to store conversation in Sync:`, error.message);
    throw error;
  }
}

/**
 * Retrieve conversation history from Sync
 * @param {object} context - Twilio Runtime context
 * @param {string} conversationId - Unique conversation identifier
 * @returns {Promise<array>} OpenAI message array (empty if not found)
 */
async function getConversationHistory(context, conversationId) {
  try {
    const syncService = getSyncService(context);
    const documentUniqueName = `conversation_${conversationId}`;

    const document = await syncService.documents(documentUniqueName).fetch();

    const messages = document.data.messages || [];
    console.log(
      `✅ Retrieved conversation ${conversationId} from Sync (${messages.length} messages)`
    );

    return messages;
  } catch (error) {
    if (error.status === 404) {
      // Document doesn't exist yet - new conversation
      console.log(`ℹ️  No existing conversation ${conversationId} in Sync`);
      return [];
    }

    console.error(
      `❌ Failed to retrieve conversation from Sync:`,
      error.message
    );
    throw error;
  }
}

/**
 * Delete conversation history from Sync
 * @param {object} context - Twilio Runtime context
 * @param {string} conversationId - Unique conversation identifier
 * @returns {Promise<boolean>} true if deleted, false if not found
 */
async function deleteConversationHistory(context, conversationId) {
  try {
    const syncService = getSyncService(context);
    const documentUniqueName = `conversation_${conversationId}`;

    await syncService.documents(documentUniqueName).remove();

    console.log(`✅ Deleted conversation ${conversationId} from Sync`);
    return true;
  } catch (error) {
    if (error.status === 404) {
      console.log(
        `ℹ️  Conversation ${conversationId} not found in Sync (already deleted or expired)`
      );
      return false;
    }

    console.error(
      `❌ Failed to delete conversation from Sync:`,
      error.message
    );
    throw error;
  }
}

/**
 * Check rate limit and increment counter
 * @param {object} context - Twilio Runtime context
 * @param {number} maxCalls - Maximum calls allowed per day (default: 1000)
 * @returns {Promise<object>} { allowed: boolean, currentCount: number, limit: number, resetsAt: string }
 */
async function checkRateLimit(context, maxCalls = MAX_DAILY_CALLS) {
  try {
    const syncService = getSyncService(context);

    // Use date-based document name for daily reset
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const documentUniqueName = `rate_limit_${today}`;

    let currentCount = 0;
    let document;

    try {
      // Try to fetch existing document
      document = await syncService.documents(documentUniqueName).fetch();
      currentCount = document.data.count || 0;

      // Check if limit exceeded
      if (currentCount >= maxCalls) {
        console.warn(
          `⚠️  RATE LIMIT EXCEEDED: ${currentCount}/${maxCalls} calls today`
        );
        return {
          allowed: false,
          currentCount,
          limit: maxCalls,
          resetsAt: getNextMidnightUTC(),
        };
      }

      // Increment counter
      document = await syncService.documents(documentUniqueName).update({
        data: {
          count: currentCount + 1,
          lastUpdated: new Date().toISOString(),
        },
      });

      console.log(
        `✅ Rate limit OK: ${currentCount + 1}/${maxCalls} calls today`
      );
      return {
        allowed: true,
        currentCount: currentCount + 1,
        limit: maxCalls,
        resetsAt: getNextMidnightUTC(),
      };
    } catch (fetchError) {
      // Document doesn't exist - create it with count = 1
      if (fetchError.status === 404) {
        document = await syncService.documents.create({
          uniqueName: documentUniqueName,
          data: {
            count: 1,
            lastUpdated: new Date().toISOString(),
          },
          ttl: RATE_LIMIT_TTL, // Auto-delete after 24 hours
        });

        console.log(`✅ Rate limit initialized: 1/${maxCalls} calls today`);
        return {
          allowed: true,
          currentCount: 1,
          limit: maxCalls,
          resetsAt: getNextMidnightUTC(),
        };
      }
      throw fetchError;
    }
  } catch (error) {
    console.error(`❌ Rate limit check failed:`, error.message);
    // FAIL OPEN - allow the request if rate limiting fails
    // Alternative: FAIL CLOSED - return { allowed: false, ... }
    console.warn(
      '⚠️  Rate limiting unavailable, allowing request (fail-open mode)'
    );
    return {
      allowed: true,
      currentCount: 0,
      limit: maxCalls,
      resetsAt: getNextMidnightUTC(),
      error: error.message,
    };
  }
}

/**
 * Get current rate limit status without incrementing
 * @param {object} context - Twilio Runtime context
 * @param {number} maxCalls - Maximum calls allowed per day
 * @returns {Promise<object>} { currentCount: number, limit: number, remaining: number, resetsAt: string }
 */
async function getRateLimitStatus(context, maxCalls = MAX_DAILY_CALLS) {
  try {
    const syncService = getSyncService(context);
    const today = new Date().toISOString().split('T')[0];
    const documentUniqueName = `rate_limit_${today}`;

    try {
      const document = await syncService.documents(documentUniqueName).fetch();
      const currentCount = document.data.count || 0;

      return {
        currentCount,
        limit: maxCalls,
        remaining: Math.max(0, maxCalls - currentCount),
        resetsAt: getNextMidnightUTC(),
      };
    } catch (error) {
      if (error.status === 404) {
        // No calls today yet
        return {
          currentCount: 0,
          limit: maxCalls,
          remaining: maxCalls,
          resetsAt: getNextMidnightUTC(),
        };
      }
      throw error;
    }
  } catch (error) {
    console.error(`❌ Failed to get rate limit status:`, error.message);
    throw error;
  }
}

/**
 * Helper: Calculate next midnight UTC
 * @returns {string} ISO timestamp of next midnight UTC
 */
function getNextMidnightUTC() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return tomorrow.toISOString();
}

module.exports = {
  storeConversationHistory,
  getConversationHistory,
  deleteConversationHistory,
  checkRateLimit,
  getRateLimitStatus,
  MAX_DAILY_CALLS,
  CONVERSATION_TTL,
};
