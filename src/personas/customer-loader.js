// ABOUTME: Customer persona data loader module
// ABOUTME: Loads, validates, and provides access to customer persona data

const fs = require('fs');
const path = require('path');

// Default path to customers.json
const DEFAULT_CUSTOMERS_PATH = path.join(process.cwd(), 'assets', 'customers.json');

// Valid values for technical proficiency
const VALID_TECH_PROFICIENCY = ['Low', 'Medium', 'High'];

// Store loaded customers
let customers = [];

/**
 * Validates email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates E.164 phone number format
 */
function isValidE164Phone(phone) {
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
}

/**
 * Validates a single customer object
 */
function validateCustomer(customer) {
  // Required fields
  const requiredFields = [
    'CustomerName',
    'ContactInformation',
    'PhoneNumber',
    'Issue',
    'DesiredResolution',
    'Demeanor',
    'TechnicalProficiency',
    'EscalationTrigger',
    'ConversationLengthPreference',
    'Prompt'
  ];

  // Check required fields exist
  for (const field of requiredFields) {
    if (customer[field] === undefined || customer[field] === null) {
      throw new Error(`${field} is required`);
    }

    if (typeof customer[field] === 'string' && customer[field].trim() === '') {
      throw new Error(`${field} cannot be empty`);
    }
  }

  // Validate email format
  if (!isValidEmail(customer.ContactInformation)) {
    throw new Error('ContactInformation must be a valid email');
  }

  // Validate phone number format
  if (!isValidE164Phone(customer.PhoneNumber)) {
    throw new Error('PhoneNumber must be in E.164 format');
  }

  // Validate technical proficiency
  if (!VALID_TECH_PROFICIENCY.includes(customer.TechnicalProficiency)) {
    throw new Error('TechnicalProficiency must be Low, Medium, or High');
  }

  return true;
}

/**
 * Loads customers from JSON file
 */
function loadCustomers(filePath = DEFAULT_CUSTOMERS_PATH) {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(fileContent);

  customers = data.CustomerPrompts || [];
  return customers;
}

/**
 * Gets customer by name
 */
function getCustomerByName(name) {
  const customer = customers.find(c => c.CustomerName === name);
  return customer || null;
}

/**
 * Gets customer by phone number
 */
function getCustomerByPhone(phone) {
  const customer = customers.find(c => c.PhoneNumber === phone);
  return customer || null;
}

/**
 * Gets all loaded customers
 */
function getAllCustomers() {
  return customers;
}

/**
 * Gets a random customer
 */
function getRandomCustomer() {
  const randomIndex = Math.floor(Math.random() * customers.length);
  return customers[randomIndex];
}

/**
 * Validates all loaded customers
 */
function validateAllCustomers() {
  const errors = [];
  let validCount = 0;

  for (const customer of customers) {
    try {
      validateCustomer(customer);
      validCount++;
    } catch (error) {
      errors.push(`${customer.CustomerName || 'Unknown'}: ${error.message}`);
    }
  }

  return {
    valid: errors.length === 0,
    validCount,
    totalCount: customers.length,
    errors
  };
}

module.exports = {
  loadCustomers,
  validateCustomer,
  getCustomerByName,
  getCustomerByPhone,
  getAllCustomers,
  getRandomCustomer,
  validateAllCustomers
};
