// ABOUTME: Unit tests for customer persona data loader
// ABOUTME: Validates loading, parsing, and validation of customer persona data

const path = require('path');

// Mock fs with manual mock factory
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  existsSync: jest.fn(),
}));

const fs = require('fs');
const CustomerLoader = require('../../../src/personas/customer-loader');

describe('CustomerLoader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loadCustomers', () => {
    it('should load customers from customers.json file', () => {
      const mockCustomerData = {
        CustomerPrompts: [
          {
            CustomerName: 'Test Customer',
            ContactInformation: 'test@example.com',
            PhoneNumber: '+15551234567',
            Issue: 'Test issue',
            DesiredResolution: 'Test resolution',
            Demeanor: 'Test demeanor',
            TechnicalProficiency: 'High',
            EscalationTrigger: 'Test trigger',
            ConversationLengthPreference: 'Short',
            Prompt: 'Test prompt',
          },
        ],
      };

      fs.readFileSync.mockReturnValueOnce(JSON.stringify(mockCustomerData));

      const customers = CustomerLoader.loadCustomers();

      expect(customers).toHaveLength(1);
      expect(customers[0].CustomerName).toBe('Test Customer');
    });

    it('should throw error if customers.json does not exist', () => {
      fs.readFileSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      expect(() => {
        CustomerLoader.loadCustomers();
      }).toThrow('ENOENT: no such file or directory');
    });

    it('should throw error if customers.json is invalid JSON', () => {
      fs.readFileSync.mockReturnValue('invalid json {]');

      expect(() => {
        CustomerLoader.loadCustomers();
      }).toThrow();
    });

    it('should load customers from custom file path', () => {
      const mockData = { CustomerPrompts: [] };
      fs.readFileSync.mockReturnValue(JSON.stringify(mockData));

      const customers = CustomerLoader.loadCustomers(
        '/custom/path/customers.json'
      );

      expect(fs.readFileSync).toHaveBeenCalledWith(
        '/custom/path/customers.json',
        'utf8'
      );
    });
  });

  describe('validateCustomer', () => {
    beforeEach(() => {
      // Mock must be set up before requiring the module
    });

    it('should validate customer with all required fields', () => {
      const validCustomer = {
        CustomerName: 'Test Customer',
        ContactInformation: 'test@example.com',
        PhoneNumber: '+15551234567',
        Issue: 'Test issue',
        DesiredResolution: 'Test resolution',
        Demeanor: 'Calm',
        TechnicalProficiency: 'Medium',
        EscalationTrigger: 'Test trigger',
        ConversationLengthPreference: 'Moderate',
        Prompt: 'Test prompt',
      };

      expect(() => {
        CustomerLoader.validateCustomer(validCustomer);
      }).not.toThrow();
    });

    it('should throw error for missing CustomerName', () => {
      const invalidCustomer = {
        ContactInformation: 'test@example.com',
        PhoneNumber: '+15551234567',
      };

      expect(() => {
        CustomerLoader.validateCustomer(invalidCustomer);
      }).toThrow('CustomerName is required');
    });

    it('should throw error for missing PhoneNumber', () => {
      const invalidCustomer = {
        CustomerName: 'Test',
        ContactInformation: 'test@example.com',
      };

      expect(() => {
        CustomerLoader.validateCustomer(invalidCustomer);
      }).toThrow('PhoneNumber is required');
    });

    it('should throw error for invalid phone number format', () => {
      const invalidCustomer = {
        CustomerName: 'Test',
        ContactInformation: 'test@example.com',
        PhoneNumber: '5551234567', // Missing + and country code
        Issue: 'Test',
        DesiredResolution: 'Test',
        Demeanor: 'Test',
        TechnicalProficiency: 'Medium',
        EscalationTrigger: 'Test',
        ConversationLengthPreference: 'Short',
        Prompt: 'Test',
      };

      expect(() => {
        CustomerLoader.validateCustomer(invalidCustomer);
      }).toThrow('PhoneNumber must be in E.164 format');
    });

    it('should throw error for invalid email format', () => {
      const invalidCustomer = {
        CustomerName: 'Test',
        ContactInformation: 'invalid-email',
        PhoneNumber: '+15551234567',
        Issue: 'Test',
        DesiredResolution: 'Test',
        Demeanor: 'Test',
        TechnicalProficiency: 'Medium',
        EscalationTrigger: 'Test',
        ConversationLengthPreference: 'Short',
        Prompt: 'Test',
      };

      expect(() => {
        CustomerLoader.validateCustomer(invalidCustomer);
      }).toThrow('ContactInformation must be a valid email');
    });

    it('should throw error for invalid TechnicalProficiency', () => {
      const invalidCustomer = {
        CustomerName: 'Test',
        ContactInformation: 'test@example.com',
        PhoneNumber: '+15551234567',
        Issue: 'Test',
        DesiredResolution: 'Test',
        Demeanor: 'Test',
        TechnicalProficiency: 'Expert', // Should be Low, Medium, or High
        EscalationTrigger: 'Test',
        ConversationLengthPreference: 'Short',
        Prompt: 'Test',
      };

      expect(() => {
        CustomerLoader.validateCustomer(invalidCustomer);
      }).toThrow('TechnicalProficiency must be Low, Medium, or High');
    });

    it('should accept valid TechnicalProficiency values', () => {
      const validProficiencies = ['Low', 'Medium', 'High'];

      validProficiencies.forEach(proficiency => {
        const customer = {
          CustomerName: 'Test',
          ContactInformation: 'test@example.com',
          PhoneNumber: '+15551234567',
          Issue: 'Test',
          DesiredResolution: 'Test',
          Demeanor: 'Test',
          TechnicalProficiency: proficiency,
          EscalationTrigger: 'Test',
          ConversationLengthPreference: 'Short',
          Prompt: 'Test',
        };

        expect(() => {
          CustomerLoader.validateCustomer(customer);
        }).not.toThrow();
      });
    });

    it('should throw error for empty required strings', () => {
      const invalidCustomer = {
        CustomerName: '',
        ContactInformation: 'test@example.com',
        PhoneNumber: '+15551234567',
      };

      expect(() => {
        CustomerLoader.validateCustomer(invalidCustomer);
      }).toThrow('CustomerName cannot be empty');
    });
  });

  describe('getCustomerByName', () => {
    beforeEach(() => {
      const mockData = {
        CustomerPrompts: [
          {
            CustomerName: 'Lucy Macintosh',
            ContactInformation: 'lucy@example.com',
            PhoneNumber: '+15129358764',
            Issue: 'Billing error',
            DesiredResolution: 'Refund',
            Demeanor: 'Calm',
            TechnicalProficiency: 'Medium',
            EscalationTrigger: 'Agent refuses refund',
            ConversationLengthPreference: 'Moderate',
            Prompt: 'Test prompt',
          },
          {
            CustomerName: 'George Pattinson',
            ContactInformation: 'george@example.com',
            PhoneNumber: '+12135404129',
            Issue: 'Damaged package',
            DesiredResolution: 'Replacement',
            Demeanor: 'Frustrated',
            TechnicalProficiency: 'Low',
            EscalationTrigger: 'Any delay',
            ConversationLengthPreference: 'Short',
            Prompt: 'Test prompt',
          },
        ],
      };
      fs.readFileSync.mockReturnValue(JSON.stringify(mockData));

      CustomerLoader.loadCustomers();
    });

    it('should find customer by exact name', () => {
      const customer = CustomerLoader.getCustomerByName('Lucy Macintosh');

      expect(customer).toBeDefined();
      expect(customer.CustomerName).toBe('Lucy Macintosh');
      expect(customer.PhoneNumber).toBe('+15129358764');
    });

    it('should return null for non-existent customer', () => {
      const customer = CustomerLoader.getCustomerByName('NonExistent Person');

      expect(customer).toBeNull();
    });

    it('should be case-sensitive', () => {
      const customer = CustomerLoader.getCustomerByName('lucy macintosh');

      expect(customer).toBeNull();
    });
  });

  describe('getCustomerByPhone', () => {
    beforeEach(() => {
      const mockData = {
        CustomerPrompts: [
          {
            CustomerName: 'Lucy Macintosh',
            ContactInformation: 'lucy@example.com',
            PhoneNumber: '+15129358764',
            Issue: 'Test',
            DesiredResolution: 'Test',
            Demeanor: 'Test',
            TechnicalProficiency: 'Medium',
            EscalationTrigger: 'Test',
            ConversationLengthPreference: 'Moderate',
            Prompt: 'Test',
          },
        ],
      };
      fs.readFileSync.mockReturnValue(JSON.stringify(mockData));

      CustomerLoader.loadCustomers();
    });

    it('should find customer by phone number', () => {
      const customer = CustomerLoader.getCustomerByPhone('+15129358764');

      expect(customer).toBeDefined();
      expect(customer.CustomerName).toBe('Lucy Macintosh');
    });

    it('should return null for non-existent phone number', () => {
      const customer = CustomerLoader.getCustomerByPhone('+15551234567');

      expect(customer).toBeNull();
    });
  });

  describe('getAllCustomers', () => {
    it('should return all loaded customers', () => {
      const mockData = {
        CustomerPrompts: [
          {
            CustomerName: 'Customer 1',
            PhoneNumber: '+15551111111',
            ContactInformation: 'c1@test.com',
            Issue: 'Test',
            DesiredResolution: 'Test',
            Demeanor: 'Test',
            TechnicalProficiency: 'Low',
            EscalationTrigger: 'Test',
            ConversationLengthPreference: 'Short',
            Prompt: 'Test',
          },
          {
            CustomerName: 'Customer 2',
            PhoneNumber: '+15552222222',
            ContactInformation: 'c2@test.com',
            Issue: 'Test',
            DesiredResolution: 'Test',
            Demeanor: 'Test',
            TechnicalProficiency: 'High',
            EscalationTrigger: 'Test',
            ConversationLengthPreference: 'Long',
            Prompt: 'Test',
          },
        ],
      };
      fs.readFileSync.mockReturnValue(JSON.stringify(mockData));

      CustomerLoader.loadCustomers();

      const customers = CustomerLoader.getAllCustomers();

      expect(customers).toHaveLength(2);
      expect(customers[0].CustomerName).toBe('Customer 1');
      expect(customers[1].CustomerName).toBe('Customer 2');
    });
  });

  describe('getRandomCustomer', () => {
    beforeEach(() => {
      const mockData = {
        CustomerPrompts: [
          {
            CustomerName: 'Customer 1',
            PhoneNumber: '+15551111111',
            ContactInformation: 'c1@test.com',
            Issue: 'Test',
            DesiredResolution: 'Test',
            Demeanor: 'Test',
            TechnicalProficiency: 'Low',
            EscalationTrigger: 'Test',
            ConversationLengthPreference: 'Short',
            Prompt: 'Test',
          },
          {
            CustomerName: 'Customer 2',
            PhoneNumber: '+15552222222',
            ContactInformation: 'c2@test.com',
            Issue: 'Test',
            DesiredResolution: 'Test',
            Demeanor: 'Test',
            TechnicalProficiency: 'High',
            EscalationTrigger: 'Test',
            ConversationLengthPreference: 'Long',
            Prompt: 'Test',
          },
        ],
      };
      fs.readFileSync.mockReturnValue(JSON.stringify(mockData));

      CustomerLoader.loadCustomers();
    });

    it('should return a random customer', () => {
      const customer = CustomerLoader.getRandomCustomer();

      expect(customer).toBeDefined();
      expect(['Customer 1', 'Customer 2']).toContain(customer.CustomerName);
    });

    it('should return different customers over multiple calls', () => {
      const customers = new Set();

      // Call 100 times to ensure we get some variety
      for (let i = 0; i < 100; i++) {
        customers.add(CustomerLoader.getRandomCustomer().CustomerName);
      }

      // With 100 calls and 2 customers, we should get both
      expect(customers.size).toBeGreaterThan(1);
    });
  });

  describe('validateAllCustomers', () => {
    it('should validate all customers successfully', () => {
      const mockData = {
        CustomerPrompts: [
          {
            CustomerName: 'Valid Customer 1',
            ContactInformation: 'valid1@example.com',
            PhoneNumber: '+15551111111',
            Issue: 'Test',
            DesiredResolution: 'Test',
            Demeanor: 'Test',
            TechnicalProficiency: 'Low',
            EscalationTrigger: 'Test',
            ConversationLengthPreference: 'Short',
            Prompt: 'Test',
          },
          {
            CustomerName: 'Valid Customer 2',
            ContactInformation: 'valid2@example.com',
            PhoneNumber: '+15552222222',
            Issue: 'Test',
            DesiredResolution: 'Test',
            Demeanor: 'Test',
            TechnicalProficiency: 'High',
            EscalationTrigger: 'Test',
            ConversationLengthPreference: 'Long',
            Prompt: 'Test',
          },
        ],
      };
      fs.readFileSync.mockReturnValue(JSON.stringify(mockData));

      CustomerLoader.loadCustomers();

      const result = CustomerLoader.validateAllCustomers();

      expect(result.valid).toBe(true);
      expect(result.validCount).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should report validation errors for invalid customers', () => {
      const mockData = {
        CustomerPrompts: [
          {
            CustomerName: 'Valid Customer',
            ContactInformation: 'valid@example.com',
            PhoneNumber: '+15551111111',
            Issue: 'Test',
            DesiredResolution: 'Test',
            Demeanor: 'Test',
            TechnicalProficiency: 'Low',
            EscalationTrigger: 'Test',
            ConversationLengthPreference: 'Short',
            Prompt: 'Test',
          },
          {
            CustomerName: 'Invalid Customer',
            ContactInformation: 'invalid-email',
            PhoneNumber: '5552222222',
          },
        ],
      };
      fs.readFileSync.mockReturnValue(JSON.stringify(mockData));

      CustomerLoader.loadCustomers();

      const result = CustomerLoader.validateAllCustomers();

      expect(result.valid).toBe(false);
      expect(result.validCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Invalid Customer');
    });
  });
});
