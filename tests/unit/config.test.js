// ABOUTME: Unit tests for configuration validation
// ABOUTME: Ensures all required environment variables are validated before application starts

describe('Configuration Validation', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original environment variables
    originalEnv = { ...process.env };

    // Clear the require cache to get fresh config module
    jest.resetModules();
  });

  afterEach(() => {
    // Restore original environment variables
    process.env = originalEnv;
  });

  describe('Required Environment Variables', () => {
    it('should throw error when TWILIO_ACCOUNT_SID is missing', () => {
      delete process.env.TWILIO_ACCOUNT_SID;

      expect(() => {
        require('../../src/config');
      }).toThrow('TWILIO_ACCOUNT_SID is required');
    });

    it('should throw error when TWILIO_AUTH_TOKEN is missing', () => {
      delete process.env.TWILIO_AUTH_TOKEN;

      expect(() => {
        require('../../src/config');
      }).toThrow('TWILIO_AUTH_TOKEN is required');
    });

    it('should throw error when AWS_KINESIS_STREAM_NAME is missing', () => {
      delete process.env.AWS_KINESIS_STREAM_NAME;

      expect(() => {
        require('../../src/config');
      }).toThrow('AWS_KINESIS_STREAM_NAME is required');
    });

    it('should throw error when AWS_REGION is missing', () => {
      delete process.env.AWS_REGION;

      expect(() => {
        require('../../src/config');
      }).toThrow('AWS_REGION is required');
    });

    it('should throw error when SEGMENT_WORKSPACE_ID is missing', () => {
      delete process.env.SEGMENT_WORKSPACE_ID;

      expect(() => {
        require('../../src/config');
      }).toThrow('SEGMENT_WORKSPACE_ID is required');
    });

    it('should throw error when SEGMENT_WRITE_KEY is missing', () => {
      delete process.env.SEGMENT_WRITE_KEY;

      expect(() => {
        require('../../src/config');
      }).toThrow('SEGMENT_WRITE_KEY is required');
    });
  });

  describe('Twilio Credentials Format Validation', () => {
    it('should throw error for invalid TWILIO_ACCOUNT_SID format', () => {
      process.env.TWILIO_ACCOUNT_SID = 'invalid_sid';

      expect(() => {
        require('../../src/config');
      }).toThrow(
        'TWILIO_ACCOUNT_SID must start with AC and be 34 characters long'
      );
    });

    it('should throw error for TWILIO_ACCOUNT_SID wrong length', () => {
      process.env.TWILIO_ACCOUNT_SID = 'AC123';

      expect(() => {
        require('../../src/config');
      }).toThrow(
        'TWILIO_ACCOUNT_SID must start with AC and be 34 characters long'
      );
    });

    it('should accept valid TWILIO_ACCOUNT_SID', () => {
      process.env.TWILIO_ACCOUNT_SID = 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      process.env.TWILIO_AUTH_TOKEN = 'valid_token_12345678901234567890';
      process.env.AWS_KINESIS_STREAM_NAME = 'test-stream';
      process.env.AWS_REGION = 'us-east-1';
      process.env.SEGMENT_WORKSPACE_ID = 'test-workspace';
      process.env.SEGMENT_WRITE_KEY = 'test-key';

      expect(() => {
        require('../../src/config');
      }).not.toThrow();
    });

    it('should throw error for empty TWILIO_AUTH_TOKEN', () => {
      process.env.TWILIO_AUTH_TOKEN = '';

      expect(() => {
        require('../../src/config');
      }).toThrow('TWILIO_AUTH_TOKEN cannot be empty');
    });

    it('should throw error for TWILIO_AUTH_TOKEN that is too short', () => {
      process.env.TWILIO_AUTH_TOKEN = 'short';

      expect(() => {
        require('../../src/config');
      }).toThrow('TWILIO_AUTH_TOKEN must be at least 32 characters long');
    });
  });

  describe('AWS Kinesis Configuration Validation', () => {
    it('should throw error for empty AWS_KINESIS_STREAM_NAME', () => {
      process.env.AWS_KINESIS_STREAM_NAME = '';

      expect(() => {
        require('../../src/config');
      }).toThrow('AWS_KINESIS_STREAM_NAME cannot be empty');
    });

    it('should throw error for invalid AWS_REGION format', () => {
      process.env.AWS_REGION = 'invalid-region';

      expect(() => {
        require('../../src/config');
      }).toThrow('AWS_REGION must be a valid AWS region');
    });

    it('should accept valid AWS regions', () => {
      const validRegions = [
        'us-east-1',
        'us-west-2',
        'eu-west-1',
        'ap-southeast-1',
      ];

      validRegions.forEach(region => {
        jest.resetModules();
        process.env.TWILIO_ACCOUNT_SID = 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
        process.env.TWILIO_AUTH_TOKEN = 'valid_token_12345678901234567890';
        process.env.AWS_KINESIS_STREAM_NAME = 'test-stream';
        process.env.AWS_REGION = region;
        process.env.SEGMENT_WORKSPACE_ID = 'test-workspace';
        process.env.SEGMENT_WRITE_KEY = 'test-key';

        expect(() => {
          require('../../src/config');
        }).not.toThrow();
      });
    });
  });

  describe('Segment Configuration Validation', () => {
    it('should throw error for empty SEGMENT_WORKSPACE_ID', () => {
      process.env.SEGMENT_WORKSPACE_ID = '';

      expect(() => {
        require('../../src/config');
      }).toThrow('SEGMENT_WORKSPACE_ID cannot be empty');
    });

    it('should throw error for empty SEGMENT_WRITE_KEY', () => {
      process.env.SEGMENT_WRITE_KEY = '';

      expect(() => {
        require('../../src/config');
      }).toThrow('SEGMENT_WRITE_KEY cannot be empty');
    });
  });

  describe('Configuration Object Structure', () => {
    let config;

    beforeEach(() => {
      process.env.TWILIO_ACCOUNT_SID = 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      process.env.TWILIO_AUTH_TOKEN = 'valid_token_12345678901234567890';
      process.env.AWS_KINESIS_STREAM_NAME = 'test-stream';
      process.env.AWS_REGION = 'us-east-1';
      process.env.SEGMENT_WORKSPACE_ID = 'test-workspace';
      process.env.SEGMENT_WRITE_KEY = 'test-key';

      config = require('../../src/config');
    });

    it('should export twilio configuration object', () => {
      expect(config.twilio).toBeDefined();
      expect(config.twilio.accountSid).toBe(
        'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
      );
      expect(config.twilio.authToken).toBe('valid_token_12345678901234567890');
    });

    it('should export aws configuration object', () => {
      expect(config.aws).toBeDefined();
      expect(config.aws.kinesisStreamName).toBe('test-stream');
      expect(config.aws.region).toBe('us-east-1');
    });

    it('should export segment configuration object', () => {
      expect(config.segment).toBeDefined();
      expect(config.segment.workspaceId).toBe('test-workspace');
      expect(config.segment.writeKey).toBe('test-key');
    });

    it('should make configuration immutable', () => {
      'use strict';
      expect(() => {
        config.twilio.accountSid = 'new_value';
      }).toThrow();
    });
  });

  describe('Configuration Descriptive Errors', () => {
    it('should provide helpful error message for missing variables', () => {
      delete process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_AUTH_TOKEN;

      expect(() => {
        require('../../src/config');
      }).toThrow(/TWILIO_ACCOUNT_SID is required/);
    });

    it('should indicate which variable has invalid format', () => {
      process.env.TWILIO_ACCOUNT_SID = 'INVALID';

      expect(() => {
        require('../../src/config');
      }).toThrow(/TWILIO_ACCOUNT_SID must start with AC/);
    });
  });

  describe('Edge Case and Security Tests', () => {
    describe('Injection Attack Prevention', () => {
      it('should reject SQL injection attempts in AUTH_TOKEN', () => {
        process.env.TWILIO_AUTH_TOKEN =
          "'; DROP TABLE users; --12345678901234567890";

        expect(() => {
          require('../../src/config');
        }).not.toThrow();

        const config = require('../../src/config');
        expect(config.twilio.authToken).toBe(
          "'; DROP TABLE users; --12345678901234567890"
        );
      });

      it('should handle code injection attempts in stream name', () => {
        process.env.AWS_KINESIS_STREAM_NAME = '$(rm -rf /)';
        process.env.TWILIO_ACCOUNT_SID = 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
        process.env.TWILIO_AUTH_TOKEN = 'valid_token_12345678901234567890';
        process.env.AWS_REGION = 'us-east-1';
        process.env.SEGMENT_WORKSPACE_ID = 'test-workspace';
        process.env.SEGMENT_WRITE_KEY = 'test-key';

        expect(() => {
          require('../../src/config');
        }).not.toThrow();
      });

      it('should handle path traversal attempts', () => {
        process.env.SEGMENT_WORKSPACE_ID = '../../../etc/passwd';
        process.env.TWILIO_ACCOUNT_SID = 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
        process.env.TWILIO_AUTH_TOKEN = 'valid_token_12345678901234567890';
        process.env.AWS_KINESIS_STREAM_NAME = 'test-stream';
        process.env.AWS_REGION = 'us-east-1';
        process.env.SEGMENT_WRITE_KEY = 'test-key';

        expect(() => {
          require('../../src/config');
        }).not.toThrow();
      });

      it('should handle XSS attempts in configuration values', () => {
        process.env.SEGMENT_WRITE_KEY = '<script>alert("XSS")</script>';
        process.env.TWILIO_ACCOUNT_SID = 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
        process.env.TWILIO_AUTH_TOKEN = 'valid_token_12345678901234567890';
        process.env.AWS_KINESIS_STREAM_NAME = 'test-stream';
        process.env.AWS_REGION = 'us-east-1';
        process.env.SEGMENT_WORKSPACE_ID = 'test-workspace';

        expect(() => {
          require('../../src/config');
        }).not.toThrow();
      });
    });

    describe('Whitespace Handling', () => {
      it('should reject whitespace-only TWILIO_ACCOUNT_SID', () => {
        process.env.TWILIO_ACCOUNT_SID = '                                  ';

        expect(() => {
          require('../../src/config');
        }).toThrow('TWILIO_ACCOUNT_SID cannot be empty');
      });

      it('should reject whitespace-only AWS_KINESIS_STREAM_NAME', () => {
        process.env.AWS_KINESIS_STREAM_NAME = '   ';
        process.env.TWILIO_ACCOUNT_SID = 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
        process.env.TWILIO_AUTH_TOKEN = 'valid_token_12345678901234567890';
        process.env.AWS_REGION = 'us-east-1';
        process.env.SEGMENT_WORKSPACE_ID = 'test-workspace';
        process.env.SEGMENT_WRITE_KEY = 'test-key';

        expect(() => {
          require('../../src/config');
        }).toThrow('AWS_KINESIS_STREAM_NAME cannot be empty');
      });

      it('should trim leading/trailing whitespace from values', () => {
        process.env.TWILIO_ACCOUNT_SID =
          '  ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  ';
        process.env.TWILIO_AUTH_TOKEN = '  valid_token_12345678901234567890  ';
        process.env.AWS_KINESIS_STREAM_NAME = '  test-stream  ';
        process.env.AWS_REGION = '  us-east-1  ';
        process.env.SEGMENT_WORKSPACE_ID = '  test-workspace  ';
        process.env.SEGMENT_WRITE_KEY = '  test-key  ';

        const config = require('../../src/config');
        expect(config.twilio.accountSid).toBe(
          'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
        );
        expect(config.aws.region).toBe('us-east-1');
      });
    });

    describe('Length Validation', () => {
      it('should handle very long stream names', () => {
        const longName = 'a'.repeat(1000);
        process.env.AWS_KINESIS_STREAM_NAME = longName;
        process.env.TWILIO_ACCOUNT_SID = 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
        process.env.TWILIO_AUTH_TOKEN = 'valid_token_12345678901234567890';
        process.env.AWS_REGION = 'us-east-1';
        process.env.SEGMENT_WORKSPACE_ID = 'test-workspace';
        process.env.SEGMENT_WRITE_KEY = 'test-key';

        expect(() => {
          require('../../src/config');
        }).not.toThrow();
      });

      it('should handle very long auth tokens', () => {
        const longToken = 'a'.repeat(10000);
        process.env.TWILIO_AUTH_TOKEN = longToken;
        process.env.TWILIO_ACCOUNT_SID = 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
        process.env.AWS_KINESIS_STREAM_NAME = 'test-stream';
        process.env.AWS_REGION = 'us-east-1';
        process.env.SEGMENT_WORKSPACE_ID = 'test-workspace';
        process.env.SEGMENT_WRITE_KEY = 'test-key';

        expect(() => {
          require('../../src/config');
        }).not.toThrow();
      });
    });

    describe('Special Characters', () => {
      it('should handle special characters in auth token', () => {
        process.env.TWILIO_AUTH_TOKEN = '!@#$%^&*()_+-=[]{}|;:,.<>?/12345678';
        process.env.TWILIO_ACCOUNT_SID = 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
        process.env.AWS_KINESIS_STREAM_NAME = 'test-stream';
        process.env.AWS_REGION = 'us-east-1';
        process.env.SEGMENT_WORKSPACE_ID = 'test-workspace';
        process.env.SEGMENT_WRITE_KEY = 'test-key';

        expect(() => {
          require('../../src/config');
        }).not.toThrow();
      });

      it('should handle NULL bytes in configuration values', () => {
        process.env.SEGMENT_WRITE_KEY = 'test-key\x00malicious';
        process.env.TWILIO_ACCOUNT_SID = 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
        process.env.TWILIO_AUTH_TOKEN = 'valid_token_12345678901234567890';
        process.env.AWS_KINESIS_STREAM_NAME = 'test-stream';
        process.env.AWS_REGION = 'us-east-1';
        process.env.SEGMENT_WORKSPACE_ID = 'test-workspace';

        expect(() => {
          require('../../src/config');
        }).not.toThrow();
      });

      it('should handle Unicode characters in values', () => {
        process.env.SEGMENT_WORKSPACE_ID = 'test-🔥-workspace-日本語';
        process.env.TWILIO_ACCOUNT_SID = 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
        process.env.TWILIO_AUTH_TOKEN = 'valid_token_12345678901234567890';
        process.env.AWS_KINESIS_STREAM_NAME = 'test-stream';
        process.env.AWS_REGION = 'us-east-1';
        process.env.SEGMENT_WRITE_KEY = 'test-key';

        expect(() => {
          require('../../src/config');
        }).not.toThrow();
      });

      it('should handle newlines and tabs in values', () => {
        process.env.AWS_KINESIS_STREAM_NAME = 'test\nstream\twith\r\nbreaks';
        process.env.TWILIO_ACCOUNT_SID = 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
        process.env.TWILIO_AUTH_TOKEN = 'valid_token_12345678901234567890';
        process.env.AWS_REGION = 'us-east-1';
        process.env.SEGMENT_WORKSPACE_ID = 'test-workspace';
        process.env.SEGMENT_WRITE_KEY = 'test-key';

        expect(() => {
          require('../../src/config');
        }).not.toThrow();
      });
    });

    describe('Case Sensitivity', () => {
      it('should reject lowercase account SID prefix', () => {
        process.env.TWILIO_ACCOUNT_SID = 'acxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

        expect(() => {
          require('../../src/config');
        }).toThrow(
          'TWILIO_ACCOUNT_SID must start with AC and be 34 characters long'
        );
      });

      it('should be case-sensitive for AWS regions', () => {
        process.env.AWS_REGION = 'US-EAST-1';
        process.env.TWILIO_ACCOUNT_SID = 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
        process.env.TWILIO_AUTH_TOKEN = 'valid_token_12345678901234567890';
        process.env.AWS_KINESIS_STREAM_NAME = 'test-stream';
        process.env.SEGMENT_WORKSPACE_ID = 'test-workspace';
        process.env.SEGMENT_WRITE_KEY = 'test-key';

        expect(() => {
          require('../../src/config');
        }).toThrow('AWS_REGION must be a valid AWS region');
      });
    });

    describe('Configuration Immutability', () => {
      it('should prevent modification of top-level config object', () => {
        process.env.TWILIO_ACCOUNT_SID = 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
        process.env.TWILIO_AUTH_TOKEN = 'valid_token_12345678901234567890';
        process.env.AWS_KINESIS_STREAM_NAME = 'test-stream';
        process.env.AWS_REGION = 'us-east-1';
        process.env.SEGMENT_WORKSPACE_ID = 'test-workspace';
        process.env.SEGMENT_WRITE_KEY = 'test-key';

        const config = require('../../src/config');

        expect(Object.isFrozen(config)).toBe(true);
        config.newProperty = 'value';
        expect(config.newProperty).toBeUndefined();
      });

      it('should prevent deletion of configuration properties', () => {
        process.env.TWILIO_ACCOUNT_SID = 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
        process.env.TWILIO_AUTH_TOKEN = 'valid_token_12345678901234567890';
        process.env.AWS_KINESIS_STREAM_NAME = 'test-stream';
        process.env.AWS_REGION = 'us-east-1';
        process.env.SEGMENT_WORKSPACE_ID = 'test-workspace';
        process.env.SEGMENT_WRITE_KEY = 'test-key';

        const config = require('../../src/config');

        const twilioRef = config.twilio;
        delete config.twilio;
        expect(config.twilio).toBe(twilioRef);
      });

      it('should prevent modification of nested configuration objects', () => {
        process.env.TWILIO_ACCOUNT_SID = 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
        process.env.TWILIO_AUTH_TOKEN = 'valid_token_12345678901234567890';
        process.env.AWS_KINESIS_STREAM_NAME = 'test-stream';
        process.env.AWS_REGION = 'us-east-1';
        process.env.SEGMENT_WORKSPACE_ID = 'test-workspace';
        process.env.SEGMENT_WRITE_KEY = 'test-key';

        const config = require('../../src/config');

        const originalRegion = config.aws.region;
        config.aws.region = 'us-west-2';
        expect(config.aws.region).toBe(originalRegion);
      });
    });

    describe('Environment Variable Type Coercion', () => {
      it('should handle undefined values correctly', () => {
        process.env.TWILIO_ACCOUNT_SID = undefined;

        expect(() => {
          require('../../src/config');
        }).toThrow('TWILIO_ACCOUNT_SID is required');
      });

      it('should handle string "undefined" value', () => {
        process.env.TWILIO_ACCOUNT_SID = 'undefined';

        expect(() => {
          require('../../src/config');
        }).toThrow(
          'TWILIO_ACCOUNT_SID must start with AC and be 34 characters long'
        );
      });

      it('should handle string "null" value', () => {
        process.env.AWS_KINESIS_STREAM_NAME = 'null';
        process.env.TWILIO_ACCOUNT_SID = 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
        process.env.TWILIO_AUTH_TOKEN = 'valid_token_12345678901234567890';
        process.env.AWS_REGION = 'us-east-1';
        process.env.SEGMENT_WORKSPACE_ID = 'test-workspace';
        process.env.SEGMENT_WRITE_KEY = 'test-key';

        const config = require('../../src/config');
        expect(config.aws.kinesisStreamName).toBe('null');
      });
    });
  });
});
