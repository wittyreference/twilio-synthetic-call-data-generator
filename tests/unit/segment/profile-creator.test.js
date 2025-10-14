// ABOUTME: Tests for Segment CDP profile creation from customer personas
// ABOUTME: Validates batch profile creation with initial trait values

const ProfileCreator = require('../../../src/segment/profile-creator');
const { loadCustomers } = require('../../../src/personas/customer-loader');

// Mock Segment Analytics
const mockIdentify = jest.fn();
const mockTrack = jest.fn();
const mockFlush = jest.fn();

jest.mock('@segment/analytics-node', () => {
  const MockAnalytics = jest.fn().mockImplementation(() => ({
    identify: mockIdentify,
    track: mockTrack,
    flush: mockFlush,
  }));
  return {
    Analytics: MockAnalytics,
  };
});

describe('Segment Profile Creator', () => {
  let profileCreator;
  let mockAnalytics;

  beforeEach(() => {
    // Reset mocks
    mockIdentify.mockClear();
    mockTrack.mockClear();
    mockFlush.mockClear();

    // Default implementations
    mockIdentify.mockImplementation((params, callback) => {
      if (callback) callback(null);
    });
    mockFlush.mockImplementation(callback => {
      if (callback) callback(null);
    });

    const { Analytics } = require('@segment/analytics-node');
    mockAnalytics = new Analytics();
    profileCreator = new ProfileCreator(mockAnalytics);
  });

  describe('Profile creation from customer data', () => {
    it('should create profile with customer traits', async () => {
      const customer = {
        CustomerName: 'Lucy Macintosh',
        ContactInformation: 'lucy.macintosh@example.com',
        PhoneNumber: '+15129358764',
        Issue: 'Account locked',
        TechnicalProficiency: 'Medium',
        Demeanor: 'Calm but firm',
      };

      await profileCreator.createProfile(customer);

      // Check first argument (params object)
      const callArgs = mockIdentify.mock.calls[0][0];
      expect(callArgs.userId).toMatch(/^cust_[a-f0-9]{32}$/);
      expect(callArgs.traits).toMatchObject({
        name: 'Lucy Macintosh',
        email: 'lucy.macintosh@example.com',
        phone: '+15129358764',
        technical_proficiency: 'Medium',
        demeanor: 'Calm but firm',
      });
    });

    it('should generate consistent user ID for same customer', async () => {
      const customer = {
        CustomerName: 'Lucy Macintosh',
        ContactInformation: 'lucy.macintosh@example.com',
        PhoneNumber: '+15129358764',
        Issue: 'Account locked',
        TechnicalProficiency: 'Medium',
        Demeanor: 'Calm',
      };

      await profileCreator.createProfile(customer);
      const firstCallUserId = mockIdentify.mock.calls[0][0].userId;

      mockIdentify.mockClear();

      await profileCreator.createProfile(customer);
      const secondCallUserId = mockIdentify.mock.calls[0][0].userId;

      expect(firstCallUserId).toBe(secondCallUserId);
    });

    it('should set initial trait values for new profiles', async () => {
      const customer = {
        CustomerName: 'Lucy Macintosh',
        ContactInformation: 'lucy.macintosh@example.com',
        PhoneNumber: '+15129358764',
        Issue: 'Account locked',
        TechnicalProficiency: 'Medium',
        Demeanor: 'Calm',
      };

      await profileCreator.createProfile(customer);

      const callArgs = mockIdentify.mock.calls[0][0];
      expect(callArgs.traits).toMatchObject({
        total_calls: 0,
        churn_risk: 0,
        propensity_to_buy: 0,
        satisfaction_score: 0,
      });
    });

    it('should include timestamp in profile', async () => {
      const customer = {
        CustomerName: 'Lucy Macintosh',
        ContactInformation: 'lucy.macintosh@example.com',
        PhoneNumber: '+15129358764',
        Issue: 'Account locked',
        TechnicalProficiency: 'Medium',
        Demeanor: 'Calm',
      };

      await profileCreator.createProfile(customer);

      const callArgs = mockIdentify.mock.calls[0][0];
      expect(callArgs.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Batch profile creation', () => {
    it('should create profiles for all 10 customers', async () => {
      const customers = loadCustomers();

      await profileCreator.createBatchProfiles(customers);

      expect(mockIdentify).toHaveBeenCalledTimes(10);
      expect(mockFlush).toHaveBeenCalled();
    });

    it('should return summary of created profiles', async () => {
      const customers = loadCustomers();

      const result = await profileCreator.createBatchProfiles(customers);

      expect(result).toEqual({
        success: true,
        profilesCreated: 10,
        errors: [],
        timestamp: expect.any(String),
      });
    });

    it('should handle partial failures gracefully', async () => {
      const customers = loadCustomers();

      // Mock failure on 3rd call
      let callCount = 0;
      mockIdentify.mockImplementation((params, callback) => {
        callCount++;
        if (callCount === 3) {
          if (callback) callback(new Error('Segment API error'));
        } else {
          if (callback) callback(null);
        }
      });

      const result = await profileCreator.createBatchProfiles(customers);

      expect(result.success).toBe(false);
      expect(result.profilesCreated).toBe(9);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Segment API error');
    });

    it('should flush analytics after batch', async () => {
      const customers = loadCustomers();

      await profileCreator.createBatchProfiles(customers);

      expect(mockFlush).toHaveBeenCalled();
    });
  });

  describe('User ID generation', () => {
    it('should generate user ID with cust_ prefix', async () => {
      const customer = {
        CustomerName: 'Lucy Macintosh',
        ContactInformation: 'lucy.macintosh@example.com',
        PhoneNumber: '+15129358764',
        Issue: 'Test',
        TechnicalProficiency: 'Medium',
        Demeanor: 'Calm',
      };

      await profileCreator.createProfile(customer);

      const userId = mockIdentify.mock.calls[0][0].userId;
      expect(userId).toMatch(/^cust_[a-f0-9]{32}$/);
    });

    it('should generate deterministic user ID from phone number', async () => {
      const customer1 = {
        CustomerName: 'Lucy Macintosh',
        ContactInformation: 'lucy@example.com',
        PhoneNumber: '+15129358764',
        Issue: 'Test',
        TechnicalProficiency: 'Medium',
        Demeanor: 'Calm',
      };

      const customer2 = {
        CustomerName: 'Lucy M.',
        ContactInformation: 'lucy.m@example.com',
        PhoneNumber: '+15129358764', // Same phone number
        Issue: 'Different issue',
        TechnicalProficiency: 'High',
        Demeanor: 'Different',
      };

      await profileCreator.createProfile(customer1);
      const userId1 = mockIdentify.mock.calls[0][0].userId;

      mockIdentify.mockClear();

      await profileCreator.createProfile(customer2);
      const userId2 = mockIdentify.mock.calls[0][0].userId;

      expect(userId1).toBe(userId2);
    });
  });

  describe('Trait mapping', () => {
    it('should map customer fields to Segment traits', async () => {
      const customer = {
        CustomerName: 'Bob Johnson',
        ContactInformation: 'bob@example.com',
        PhoneNumber: '+15551234567',
        Issue: 'Billing question',
        DesiredResolution: 'Refund',
        Demeanor: 'Frustrated',
        TechnicalProficiency: 'Low',
        EscalationTrigger: 'Long wait times',
        ConversationLengthPreference: 'Quick resolution',
      };

      await profileCreator.createProfile(customer);

      const callArgs = mockIdentify.mock.calls[0][0];
      expect(callArgs.traits).toMatchObject({
        name: 'Bob Johnson',
        email: 'bob@example.com',
        phone: '+15551234567',
        current_issue: 'Billing question',
        desired_resolution: 'Refund',
        demeanor: 'Frustrated',
        technical_proficiency: 'Low',
        escalation_trigger: 'Long wait times',
        conversation_preference: 'Quick resolution',
      });
    });

    it('should normalize trait names to snake_case', async () => {
      const customer = {
        CustomerName: 'Test User',
        ContactInformation: 'test@example.com',
        PhoneNumber: '+15551234567',
        Issue: 'Test',
        TechnicalProficiency: 'Medium',
        Demeanor: 'Calm',
      };

      await profileCreator.createProfile(customer);

      const traits = mockIdentify.mock.calls[0][0].traits;
      expect(traits).toHaveProperty('technical_proficiency');
      expect(traits).not.toHaveProperty('TechnicalProficiency');
    });
  });

  describe('Error handling', () => {
    it('should throw error for missing required fields', async () => {
      const invalidCustomer = {
        CustomerName: 'Test',
        // Missing ContactInformation and PhoneNumber
      };

      await expect(
        profileCreator.createProfile(invalidCustomer)
      ).rejects.toThrow('required');
    });

    it('should handle Segment API errors', async () => {
      const customer = {
        CustomerName: 'Lucy Macintosh',
        ContactInformation: 'lucy@example.com',
        PhoneNumber: '+15129358764',
        Issue: 'Test',
        TechnicalProficiency: 'Medium',
        Demeanor: 'Calm',
      };

      mockIdentify.mockImplementation((params, callback) => {
        if (callback) callback(new Error('Network error'));
      });

      await expect(profileCreator.createProfile(customer)).rejects.toThrow(
        'Network error'
      );
    });

    it('should handle flush errors gracefully', async () => {
      const customers = loadCustomers();

      mockFlush.mockImplementation(callback => {
        if (callback) callback(new Error('Flush failed'));
      });

      // Should still complete, just log warning
      const result = await profileCreator.createBatchProfiles(customers);

      expect(result.profilesCreated).toBe(10);
    });
  });

  describe('Segment initialization', () => {
    it('should initialize with write key', () => {
      const { Analytics } = require('@segment/analytics-node');
      const writeKey = 'test_write_key_12345';

      const creator = ProfileCreator.initialize(writeKey);

      expect(creator).toBeInstanceOf(ProfileCreator);
      expect(Analytics).toHaveBeenCalledWith({ writeKey: writeKey });
    });

    it('should throw error for missing write key', () => {
      expect(() => ProfileCreator.initialize()).toThrow(
        'Segment write key is required'
      );
    });
  });
});
