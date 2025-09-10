// ABOUTME: Jest setup file for global test configuration
// ABOUTME: Configures environment variables and global test utilities for Twilio Functions

// Set up test environment variables
process.env.NODE_ENV = 'test';
process.env.ACCOUNT_SID = 'test_account_sid';
process.env.AUTH_TOKEN = 'test_auth_token';

// Mock Twilio client for testing
jest.mock('twilio', () => {
  return jest.fn().mockImplementation(() => ({
    // Add mock Twilio client methods as needed
    messages: {
      create: jest.fn(),
      list: jest.fn()
    },
    calls: {
      create: jest.fn(),
      list: jest.fn()
    }
  }));
});

// Global test utilities
global.mockTwilioContext = () => ({
  ACCOUNT_SID: 'test_account_sid',
  AUTH_TOKEN: 'test_auth_token'
});

global.mockCallback = () => jest.fn((err, result) => {
  if (err) throw err;
  return result;
});