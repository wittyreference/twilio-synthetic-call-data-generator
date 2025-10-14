// ABOUTME: Unit tests for error handling utilities (retry logic, circuit breaker, error context)
// ABOUTME: Tests exponential backoff, circuit breaker state transitions, and structured error logging

const {
  retryWithBackoff,
  CircuitBreaker,
  createErrorContext,
  logStructuredError,
  sleep,
} = require('../../functions/utils/error-utils');

describe('Error Utilities', () => {
  describe('retryWithBackoff', () => {
    it('should succeed on first attempt if function succeeds', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');

      const result = await retryWithBackoff(mockFn, {
        maxAttempts: 3,
        baseDelay: 100,
        operationName: 'test operation',
      });

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValueOnce('success');

      const result = await retryWithBackoff(mockFn, {
        maxAttempts: 3,
        baseDelay: 100,
        operationName: 'test operation',
      });

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should throw error after max attempts', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValue(new Error('persistent failure'));

      await expect(
        retryWithBackoff(mockFn, {
          maxAttempts: 3,
          baseDelay: 100,
          operationName: 'test operation',
        })
      ).rejects.toThrow('persistent failure');

      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should use exponential backoff delays', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValueOnce('success');

      const startTime = Date.now();

      await retryWithBackoff(mockFn, {
        maxAttempts: 3,
        baseDelay: 100,
        operationName: 'test operation',
      });

      const elapsedTime = Date.now() - startTime;

      // Should have delays of ~100ms and ~200ms = ~300ms total minimum
      expect(elapsedTime).toBeGreaterThanOrEqual(250);
    });
  });

  describe('CircuitBreaker', () => {
    it('should start in CLOSED state', () => {
      const breaker = new CircuitBreaker('test-service', {
        failureThreshold: 3,
        resetTimeout: 1000,
      });

      const state = breaker.getState();
      expect(state.state).toBe('CLOSED');
      expect(state.failures).toBe(0);
    });

    it('should execute function successfully when CLOSED', async () => {
      const breaker = new CircuitBreaker('test-service', {
        failureThreshold: 3,
        resetTimeout: 1000,
      });

      const result = await breaker.execute(async () => 'success');

      expect(result).toBe('success');
      expect(breaker.getState().state).toBe('CLOSED');
    });

    it('should open circuit after failure threshold', async () => {
      const breaker = new CircuitBreaker('test-service', {
        failureThreshold: 3,
        resetTimeout: 1000,
      });

      const mockFn = jest.fn().mockRejectedValue(new Error('service down'));

      // Execute until circuit opens
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(mockFn);
        } catch (e) {
          // Expected to fail
        }
      }

      expect(breaker.getState().state).toBe('OPEN');
      expect(breaker.getState().failures).toBe(3);
    });

    it('should use fallback when circuit is OPEN', async () => {
      const breaker = new CircuitBreaker('test-service', {
        failureThreshold: 2,
        resetTimeout: 1000,
      });

      const mockFn = jest.fn().mockRejectedValue(new Error('service down'));
      const fallback = jest.fn().mockReturnValue('fallback result');

      // Trigger failures to open circuit
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(mockFn);
        } catch (e) {
          // Expected
        }
      }

      // Circuit should be OPEN now
      const result = await breaker.execute(mockFn, fallback);

      expect(result).toBe('fallback result');
      expect(fallback).toHaveBeenCalled();
    });

    it('should transition to HALF_OPEN after reset timeout', async () => {
      const breaker = new CircuitBreaker('test-service', {
        failureThreshold: 2,
        resetTimeout: 100, // Short timeout for testing
      });

      const mockFn = jest.fn().mockRejectedValue(new Error('service down'));

      // Open the circuit
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(mockFn);
        } catch (e) {
          // Expected
        }
      }

      expect(breaker.getState().state).toBe('OPEN');

      // Wait for reset timeout
      await sleep(150);

      // Next execution should transition to HALF_OPEN
      mockFn.mockResolvedValueOnce('service recovered');
      const result = await breaker.execute(mockFn);

      expect(result).toBe('service recovered');
      expect(breaker.getState().state).toBe('CLOSED');
      expect(breaker.getState().failures).toBe(0);
    });
  });

  describe('createErrorContext', () => {
    it('should create error context with all fields', () => {
      const context = createErrorContext({
        customerId: 'cust123',
        agentId: 'agent456',
        conferenceSid: 'CF789',
        callSid: 'CA012',
        recordingSid: 'RE345',
        transcriptionSid: 'TR678',
        functionName: 'test-function',
        operation: 'test-operation',
        additionalContext: { foo: 'bar' },
      });

      expect(context).toMatchObject({
        customerId: 'cust123',
        agentId: 'agent456',
        conferenceSid: 'CF789',
        callSid: 'CA012',
        recordingSid: 'RE345',
        transcriptionSid: 'TR678',
        functionName: 'test-function',
        operation: 'test-operation',
        additionalContext: { foo: 'bar' },
      });
      expect(context.timestamp).toBeDefined();
    });

    it('should use null for missing fields', () => {
      const context = createErrorContext({
        functionName: 'test-function',
      });

      expect(context.customerId).toBeNull();
      expect(context.agentId).toBeNull();
      expect(context.functionName).toBe('test-function');
    });
  });

  describe('logStructuredError', () => {
    let consoleErrorSpy;

    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('should log structured error with context', () => {
      const error = new Error('Test error');
      error.code = 'TEST_CODE';
      error.status = 500;

      const context = createErrorContext({
        functionName: 'test-function',
        operation: 'test-operation',
      });

      logStructuredError(error, context);

      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Structured Error Log');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Test error')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('test-function')
      );
    });
  });

  describe('sleep', () => {
    it('should sleep for specified milliseconds', async () => {
      const startTime = Date.now();
      await sleep(100);
      const elapsedTime = Date.now() - startTime;

      expect(elapsedTime).toBeGreaterThanOrEqual(90); // Allow 10ms tolerance
    });
  });
});
