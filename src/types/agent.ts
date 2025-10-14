// ABOUTME: TypeScript type definitions for agent personas
// ABOUTME: Provides strong typing for agent data structures

/**
 * Competence level of an agent
 */
export type CompetenceLevel = 'Low' | 'Medium' | 'High';

/**
 * Agent persona interface
 */
export interface Agent {
  /** Name of the agent */
  AgentName: string;

  /** Scripted introduction the agent uses when greeting customers */
  ScriptedIntroduction: string;

  /** Agent's typical response style to customer issues */
  ResponseToIssue: string;

  /** Agent's level of competence */
  CompetenceLevel: CompetenceLevel;

  /** Agent's general attitude and demeanor */
  Attitude: string;

  /** Agent's knowledge of products and services */
  ProductKnowledge: string;

  /** Agent's farewell message */
  Farewell: string;

  /** Detailed characteristics and behavioral traits of the agent */
  Characteristics: string;
}

/**
 * Agent data file structure
 */
export interface AgentData {
  AgentPrompts: Agent[];
}

/**
 * Validation result for agent personas
 */
export interface ValidationResult {
  /** Whether all agents are valid */
  valid: boolean;

  /** Number of valid agents */
  validCount: number;

  /** Total number of agents */
  totalCount: number;

  /** Array of validation error messages */
  errors: string[];
}
