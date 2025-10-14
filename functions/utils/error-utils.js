// ABOUTME: Shared error handling utilities for retry logic, circuit breakers, and error context
// ABOUTME: Provides exponential backoff, circuit breaker pattern, and structured error logging

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxAttempts - Maximum number of retry attempts (default: 3)
 * @param {number} options.baseDelay - Base delay in ms (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in ms (default: 10000)
 * @param {string} options.operationName - Name of operation for logging
 * @returns {Promise} Result of the function or throws last error
 */
async function retryWithBackoff(fn, options = {}) {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    operationName = 'operation',
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(
        `🔄 Attempting ${operationName} (attempt ${attempt}/${maxAttempts})`
      );
      const result = await fn();

      if (attempt > 1) {
        console.log(`✅ ${operationName} succeeded on attempt ${attempt}`);
      }

      return result;
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts) {
        console.error(
          `❌ ${operationName} failed after ${maxAttempts} attempts`
        );
        console.error(
          JSON.stringify(
            {
              errorType: 'RetryExhausted',
              operationName,
              attempts: maxAttempts,
              errorMessage: error.message,
              errorCode: error.code,
              errorStatus: error.status,
              timestamp: new Date().toISOString(),
            },
            null,
            2
          )
        );
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);

      console.warn(
        `⚠️  ${operationName} failed on attempt ${attempt}, retrying in ${delay}ms...`
      );
      console.warn(
        JSON.stringify(
          {
            errorType: 'RetryableError',
            operationName,
            attempt,
            maxAttempts,
            nextRetryDelay: delay,
            errorMessage: error.message,
            errorCode: error.code,
            timestamp: new Date().toISOString(),
          },
          null,
          2
        )
      );

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Circuit breaker to prevent cascading failures
 */
class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.failures = 0;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = Date.now();
  }

  async execute(fn, fallback = null) {
    // Check if circuit is OPEN
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        console.warn(
          `🔴 Circuit breaker OPEN for ${this.name} - using fallback`
        );

        if (fallback) {
          return fallback();
        }

        throw new Error(`Circuit breaker is OPEN for ${this.name}`);
      } else {
        // Transition to HALF_OPEN to test the service
        this.state = 'HALF_OPEN';
        console.log(
          `🟡 Circuit breaker HALF_OPEN for ${this.name} - testing service`
        );
      }
    }

    try {
      const result = await fn();

      // Success - reset circuit breaker
      if (this.state === 'HALF_OPEN') {
        console.log(
          `✅ Circuit breaker closing for ${this.name} - service recovered`
        );
      }

      this.failures = 0;
      this.state = 'CLOSED';
      return result;
    } catch (error) {
      this.failures++;

      console.error(
        `❌ Circuit breaker failure ${this.failures}/${this.failureThreshold} for ${this.name}`
      );

      // Open the circuit if threshold is reached
      if (this.failures >= this.failureThreshold) {
        this.state = 'OPEN';
        this.nextAttempt = Date.now() + this.resetTimeout;

        console.error(
          `🔴 Circuit breaker OPEN for ${this.name} - will retry at ${new Date(this.nextAttempt).toISOString()}`
        );
        console.error(
          JSON.stringify(
            {
              errorType: 'CircuitBreakerOpen',
              serviceName: this.name,
              failures: this.failures,
              resetTimeout: this.resetTimeout,
              nextAttempt: new Date(this.nextAttempt).toISOString(),
              timestamp: new Date().toISOString(),
            },
            null,
            2
          )
        );
      }

      if (fallback && this.state === 'OPEN') {
        console.log(`🔄 Using fallback for ${this.name}`);
        return fallback();
      }

      throw error;
    }
  }

  getState() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      failureThreshold: this.failureThreshold,
      nextAttempt:
        this.state === 'OPEN' ? new Date(this.nextAttempt).toISOString() : null,
    };
  }
}

/**
 * Create error context object with full details
 * @param {Object} params - Context parameters
 * @returns {Object} Error context object
 */
function createErrorContext(params = {}) {
  return {
    timestamp: new Date().toISOString(),
    customerId: params.customerId || null,
    agentId: params.agentId || null,
    conferenceSid: params.conferenceSid || null,
    callSid: params.callSid || null,
    recordingSid: params.recordingSid || null,
    transcriptionSid: params.transcriptionSid || null,
    functionName: params.functionName || null,
    operation: params.operation || null,
    additionalContext: params.additionalContext || {},
  };
}

/**
 * Log structured error with context
 * @param {Error} error - The error object
 * @param {Object} context - Error context from createErrorContext
 */
function logStructuredError(error, context = {}) {
  console.error('❌ Structured Error Log');
  console.error(
    JSON.stringify(
      {
        errorType: error.name || 'Error',
        errorMessage: error.message,
        errorCode: error.code,
        errorStatus: error.status,
        errorStack: error.stack,
        context: context,
        timestamp: new Date().toISOString(),
      },
      null,
      2
    )
  );
}

/**
 * Sleep utility for delays
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  retryWithBackoff,
  CircuitBreaker,
  createErrorContext,
  logStructuredError,
  sleep,
};
