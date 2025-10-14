// ABOUTME: Utility for building function URLs with query parameters
// ABOUTME: Eliminates code duplication and ensures consistent URL encoding

/**
 * Builds a function URL with encoded query parameters
 * @param {string} endpoint - Function endpoint name (e.g., 'transcribe', 'respond')
 * @param {Object} params - Query parameters as key-value pairs
 * @returns {string} Formatted URL with encoded parameters
 */
function buildFunctionUrl(endpoint, params) {
  const queryParams = Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&');

  return `/${endpoint}?${queryParams}`;
}

/**
 * Extracts standard conversation parameters from event
 * @param {Object} event - Twilio function event object
 * @returns {Object} Standardized conversation parameters
 */
function extractConversationParams(event) {
  return {
    role: event.role || 'unknown',
    persona: event.persona || 'AI',
    conferenceId: event.conferenceId || 'unknown',
    conversationHistory: event.conversationHistory || '',
  };
}

/**
 * Validates required conversation parameters
 * @param {Object} params - Parameters to validate
 * @returns {Object} { valid: boolean, missing: string[] }
 */
function validateConversationParams(params) {
  const required = ['role', 'persona', 'conferenceId'];
  const missing = required.filter(
    (key) => !params[key] || params[key] === 'unknown'
  );

  return {
    valid: missing.length === 0,
    missing,
  };
}

module.exports = {
  buildFunctionUrl,
  extractConversationParams,
  validateConversationParams,
};
