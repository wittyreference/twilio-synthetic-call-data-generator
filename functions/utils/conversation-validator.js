// ABOUTME: Validates conversation history to prevent prompt injection attacks
// ABOUTME: Sanitizes and validates OpenAI message structures for security

const MAX_MESSAGE_CONTENT_LENGTH = 5000;
const MAX_HISTORY_MESSAGES = 20; // System prompt + 19 messages
const ALLOWED_ROLES = ['user', 'assistant', 'system'];

/**
 * Validates and sanitizes conversation history from webhook parameters
 * Prevents prompt injection by filtering malicious system prompts and validating structure
 *
 * @param {string} historyString - JSON string of conversation history
 * @param {boolean} allowSystemPrompt - Whether to allow system role messages
 * @returns {object} { valid: boolean, messages: array|null, error: string|null }
 */
function validateConversationHistory(historyString, allowSystemPrompt = true) {
  if (!historyString || historyString === '') {
    return { valid: true, messages: [], error: null };
  }

  try {
    const messages = JSON.parse(historyString);

    // Validate it's an array
    if (!Array.isArray(messages)) {
      return {
        valid: false,
        messages: null,
        error: 'Conversation history must be an array',
      };
    }

    // Validate each message structure
    const validatedMessages = [];
    let systemPromptCount = 0;

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];

      // Validate message has required fields
      if (!msg || typeof msg !== 'object') {
        console.warn(`⚠️  Invalid message structure at index ${i}, skipping`);
        continue;
      }

      if (!msg.role || !msg.content) {
        console.warn(
          `⚠️  Missing role or content at index ${i}, skipping`
        );
        continue;
      }

      // Validate role
      if (!ALLOWED_ROLES.includes(msg.role)) {
        console.warn(`⚠️  Invalid role "${msg.role}" at index ${i}, skipping`);
        continue;
      }

      // SECURITY: Only allow ONE system prompt at the beginning
      if (msg.role === 'system') {
        systemPromptCount++;

        if (!allowSystemPrompt) {
          console.warn(
            '⚠️  System prompts not allowed in this context, skipping'
          );
          continue;
        }

        if (systemPromptCount > 1) {
          console.warn(
            `❌ SECURITY: Multiple system prompts detected (${systemPromptCount}), rejecting additional prompts`
          );
          continue; // Skip additional system prompts - potential injection
        }

        if (i !== 0) {
          console.warn(
            `❌ SECURITY: System prompt at index ${i} (not at start), rejecting`
          );
          continue; // System prompt must be first - potential injection
        }
      }

      // Sanitize content length
      let content = String(msg.content);
      if (content.length > MAX_MESSAGE_CONTENT_LENGTH) {
        console.warn(
          `⚠️  Message content at index ${i} exceeds ${MAX_MESSAGE_CONTENT_LENGTH} chars, trimming`
        );
        content = content.slice(0, MAX_MESSAGE_CONTENT_LENGTH);
      }

      validatedMessages.push({
        role: msg.role,
        content: content,
      });
    }

    // Trim history if too long
    let finalMessages = validatedMessages;
    if (finalMessages.length > MAX_HISTORY_MESSAGES) {
      console.log(
        `⚠️  Conversation history has ${finalMessages.length} messages, trimming to ${MAX_HISTORY_MESSAGES}`
      );

      // Keep system prompt if present
      const hasSystemPrompt =
        finalMessages.length > 0 && finalMessages[0].role === 'system';

      if (hasSystemPrompt) {
        const systemPrompt = finalMessages[0];
        const recentMessages = finalMessages.slice(
          -(MAX_HISTORY_MESSAGES - 1)
        );
        finalMessages = [systemPrompt, ...recentMessages];
      } else {
        finalMessages = finalMessages.slice(-MAX_HISTORY_MESSAGES);
      }
    }

    return {
      valid: true,
      messages: finalMessages,
      error: null,
    };
  } catch (error) {
    return {
      valid: false,
      messages: null,
      error: `Failed to parse conversation history: ${error.message}`,
    };
  }
}

/**
 * Validates that a message array is safe to send to OpenAI
 * Checks for injection attempts and malformed data
 *
 * @param {array} messages - Array of message objects
 * @returns {object} { valid: boolean, error: string|null }
 */
function validateMessagesForOpenAI(messages) {
  if (!Array.isArray(messages)) {
    return { valid: false, error: 'Messages must be an array' };
  }

  if (messages.length === 0) {
    return { valid: false, error: 'Messages array cannot be empty' };
  }

  // Check for multiple system prompts (injection attempt)
  const systemPrompts = messages.filter((msg) => msg.role === 'system');
  if (systemPrompts.length > 1) {
    return {
      valid: false,
      error: 'Multiple system prompts detected - potential injection',
    };
  }

  // System prompt must be first if present
  if (
    systemPrompts.length === 1 &&
    messages[0].role !== 'system'
  ) {
    return {
      valid: false,
      error: 'System prompt must be first message',
    };
  }

  // All messages must have role and content
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg.role || !msg.content) {
      return {
        valid: false,
        error: `Message at index ${i} missing role or content`,
      };
    }

    if (!ALLOWED_ROLES.includes(msg.role)) {
      return {
        valid: false,
        error: `Invalid role "${msg.role}" at index ${i}`,
      };
    }
  }

  return { valid: true, error: null };
}

/**
 * Sanitizes a user message to remove potentially harmful content
 * @param {string} content - User message content
 * @returns {string} Sanitized content
 */
function sanitizeUserMessage(content) {
  if (!content || typeof content !== 'string') {
    return '';
  }

  // Trim to max length
  let sanitized = content.slice(0, MAX_MESSAGE_CONTENT_LENGTH);

  // Remove null bytes (can cause parsing issues)
  sanitized = sanitized.replace(/\0/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
}

module.exports = {
  validateConversationHistory,
  validateMessagesForOpenAI,
  sanitizeUserMessage,
  MAX_MESSAGE_CONTENT_LENGTH,
  MAX_HISTORY_MESSAGES,
};
