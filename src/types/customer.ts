// ABOUTME: TypeScript type definitions for customer personas
// ABOUTME: Provides strong typing for customer data structures

/**
 * Technical proficiency level of a customer
 */
export type TechnicalProficiency = 'Low' | 'Medium' | 'High';

/**
 * Conversation length preference for a customer
 */
export type ConversationLength = 'Short' | 'Moderate' | 'Long' | 'Flexible' | 'Very short';

/**
 * Customer persona interface
 */
export interface Customer {
  /** Full name of the customer */
  CustomerName: string;

  /** Email address of the customer */
  ContactInformation: string;

  /** Phone number in E.164 format (e.g., +15551234567) */
  PhoneNumber: string;

  /** Description of the customer's issue or reason for calling */
  Issue: string;

  /** What the customer wants as a resolution */
  DesiredResolution: string;

  /** Customer's demeanor or emotional state */
  Demeanor: string;

  /** Customer's level of technical proficiency */
  TechnicalProficiency: TechnicalProficiency;

  /** What will cause the customer to escalate */
  EscalationTrigger: string;

  /** Customer's preferred conversation length */
  ConversationLengthPreference: string;

  /** Full prompt for the AI agent to use */
  Prompt: string;
}

/**
 * Customer data file structure
 */
export interface CustomerData {
  CustomerPrompts: Customer[];
}

/**
 * Validation result for customer personas
 */
export interface ValidationResult {
  /** Whether all customers are valid */
  valid: boolean;

  /** Number of valid customers */
  validCount: number;

  /** Total number of customers */
  totalCount: number;

  /** Array of validation error messages */
  errors: string[];
}
