// ABOUTME: Jest setup file that configures Twilio API mocks for testing
// ABOUTME: Provides mock implementations for Conference, Participant, Recording, and Transcription APIs

// Set up test environment variables
process.env.NODE_ENV = 'test';
process.env.ACCOUNT_SID = 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
process.env.AUTH_TOKEN = 'test_auth_token_32_characters_long_1234567890';
process.env.TWILIO_ACCOUNT_SID = 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
process.env.TWILIO_AUTH_TOKEN = 'test_auth_token_32_characters_long_1234567890';
process.env.AWS_KINESIS_STREAM_NAME = 'test-stream';
process.env.AWS_REGION = 'us-east-1';
process.env.SEGMENT_WORKSPACE_ID = 'test-workspace-id';
process.env.SEGMENT_WRITE_KEY = 'test-write-key';

// Mock Twilio SDK before any tests run
jest.mock('twilio', () => {
  // Mock Conference resource
  const mockConference = {
    update: jest.fn().mockResolvedValue({
      sid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      status: 'completed',
      dateUpdated: new Date(),
    }),
    fetch: jest.fn().mockResolvedValue({
      sid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      status: 'in-progress',
      friendlyName: 'synth-call-test',
      dateCreated: new Date(),
    }),
  };

  // Mock Participants resource
  const mockParticipants = {
    create: jest.fn().mockResolvedValue({
      callSid: 'CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      conferenceSid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      label: 'customer',
      status: 'queued',
      dateCreated: new Date(),
    }),
    list: jest.fn().mockResolvedValue([
      {
        callSid: 'CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        label: 'customer',
        status: 'connected',
      },
      {
        callSid: 'CAyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy',
        label: 'agent',
        status: 'connected',
      },
    ]),
  };

  // Mock Recordings resource
  const mockRecordings = {
    create: jest.fn().mockResolvedValue({
      sid: 'RExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      status: 'processing',
      uri: '/2010-04-01/Accounts/ACxxx/Recordings/RExxx.json',
    }),
    fetch: jest.fn().mockResolvedValue({
      sid: 'RExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      status: 'completed',
      duration: 300,
      uri: '/2010-04-01/Accounts/ACxxx/Recordings/RExxx.json',
    }),
  };

  // Mock Transcriptions resource
  const mockTranscriptions = {
    create: jest.fn().mockResolvedValue({
      sid: 'TRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      status: 'processing',
    }),
    fetch: jest.fn().mockResolvedValue({
      sid: 'TRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      status: 'completed',
      transcriptionText: 'Hello, this is a test transcription.',
    }),
  };

  // Mock Twilio client
  const mockTwilioClient = jest.fn().mockImplementation(() => ({
    conferences: jest.fn((conferenceSid) => ({
      ...mockConference,
      participants: mockParticipants,
      recordings: mockRecordings,
    })),
    recordings: mockRecordings,
    transcriptions: mockTranscriptions,
    messages: {
      create: jest.fn(),
      list: jest.fn(),
    },
    calls: {
      create: jest.fn(),
      list: jest.fn(),
    },
  }));

  return mockTwilioClient;
});

// Global test utilities
global.createMockTwilioContext = () => ({
  ACCOUNT_SID: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  AUTH_TOKEN: 'test_auth_token_32_characters_long_1234567890',
  TWILIO_ACCOUNT_SID: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  TWILIO_AUTH_TOKEN: 'test_auth_token_32_characters_long_1234567890',
  AWS_KINESIS_STREAM_NAME: 'test-stream',
  AWS_REGION: 'us-east-1',
  SEGMENT_WORKSPACE_ID: 'test-workspace-id',
  SEGMENT_WRITE_KEY: 'test-write-key',
});

global.createMockTwilioEvent = (params = {}) => ({
  StatusCallbackEvent: 'conference-end',
  ConferenceSid: 'CFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  CallSid: 'CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  Duration: 300,
  ...params,
});

global.mockTwilioContext = () => ({
  ACCOUNT_SID: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  AUTH_TOKEN: 'test_auth_token',
});

global.mockCallback = () => jest.fn((err, result) => {
  if (err) throw err;
  return result;
});

// Mock Runtime global for Twilio serverless functions
global.Runtime = {
  getFunctions: jest.fn(() => ({
    'utils/persona-loader': {
      path: require.resolve('./functions/utils/persona-loader.js'),
    },
    'utils/url-builder': {
      path: require.resolve('./functions/utils/url-builder.js'),
    },
    'utils/webhook-validator': {
      path: require.resolve('./functions/utils/webhook-validator.js'),
    },
    'utils/conversation-validator': {
      path: require.resolve('./functions/utils/conversation-validator.js'),
    },
    'utils/sync-manager': {
      path: require.resolve('./functions/utils/sync-manager.js'),
    },
    'utils/error-utils': {
      path: require.resolve('./functions/utils/error-utils.js'),
    },
  })),
  getAssets: jest.fn(() => ({
    'agents.json': {
      path: require.resolve('./assets/agents.json'),
    },
    'customers.json': {
      path: require.resolve('./assets/customers.json'),
    },
  })),
};

// Suppress console output during tests for pristine test output
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
};

// Mock console methods to suppress output
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};

// Reset all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});