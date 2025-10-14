// ABOUTME: Agent persona data loader module
// ABOUTME: Loads, validates, and provides access to agent persona data

const fs = require('fs');
const path = require('path');

// Default path to agents.json
const DEFAULT_AGENTS_PATH = path.join(process.cwd(), 'agents.json');

// Valid values for competence level
const VALID_COMPETENCE_LEVELS = ['Low', 'Medium', 'High'];

// Store loaded agents
let agents = [];

/**
 * Validates a single agent object
 */
function validateAgent(agent) {
  // Required fields
  const requiredFields = [
    'AgentName',
    'ScriptedIntroduction',
    'ResponseToIssue',
    'CompetenceLevel',
    'Attitude',
    'ProductKnowledge',
    'Farewell',
    'Characteristics'
  ];

  // Check required fields exist
  for (const field of requiredFields) {
    if (agent[field] === undefined || agent[field] === null) {
      throw new Error(`${field} is required`);
    }

    if (typeof agent[field] === 'string' && agent[field].trim() === '') {
      throw new Error(`${field} cannot be empty`);
    }
  }

  // Validate competence level
  if (!VALID_COMPETENCE_LEVELS.includes(agent.CompetenceLevel)) {
    throw new Error('CompetenceLevel must be Low, Medium, or High');
  }

  return true;
}

/**
 * Loads agents from JSON file
 */
function loadAgents(filePath = DEFAULT_AGENTS_PATH) {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(fileContent);

  agents = data.AgentPrompts || [];
  return agents;
}

/**
 * Gets agent by name
 */
function getAgentByName(name) {
  const agent = agents.find(a => a.AgentName === name);
  return agent || null;
}

/**
 * Gets all loaded agents
 */
function getAllAgents() {
  return agents;
}

/**
 * Gets a random agent
 */
function getRandomAgent() {
  const randomIndex = Math.floor(Math.random() * agents.length);
  return agents[randomIndex];
}

/**
 * Gets agents by competence level
 */
function getAgentsByCompetence(competenceLevel) {
  return agents.filter(a => a.CompetenceLevel === competenceLevel);
}

/**
 * Validates all loaded agents
 */
function validateAllAgents() {
  const errors = [];
  let validCount = 0;

  for (const agent of agents) {
    try {
      validateAgent(agent);
      validCount++;
    } catch (error) {
      errors.push(`${agent.AgentName || 'Unknown'}: ${error.message}`);
    }
  }

  return {
    valid: errors.length === 0,
    validCount,
    totalCount: agents.length,
    errors
  };
}

module.exports = {
  loadAgents,
  validateAgent,
  getAgentByName,
  getAllAgents,
  getRandomAgent,
  getAgentsByCompetence,
  validateAllAgents
};
