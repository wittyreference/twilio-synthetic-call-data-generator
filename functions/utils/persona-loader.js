// ABOUTME: Utility to load persona data from customers.json and agents.json files
// ABOUTME: Used by TwiML functions to retrieve full persona configuration based on name and role

// Cache for persona data to avoid repeated HTTP requests
let cachedAgents = null;
let cachedCustomers = null;

// Helper function to clear cache (useful for testing)
function clearCache() {
  cachedAgents = null;
  cachedCustomers = null;
}

// Load persona data from JSON assets
async function loadPersona(role, personaName, context) {
  try {
    const isAgent = role === 'agent';
    const fileName = isAgent ? 'agents.json' : 'customers.json';

    // Check cache first
    if (isAgent && cachedAgents) {
      return findPersona(cachedAgents, personaName, isAgent);
    }
    if (!isAgent && cachedCustomers) {
      return findPersona(cachedCustomers, personaName, isAgent);
    }

    // Load from asset URL using fetch (built-in to Node 18+)
    const assetUrl = `https://${context.DOMAIN_NAME}/${fileName}`;
    console.log(`📥 Loading persona data from: ${assetUrl}`);

    const response = await fetch(assetUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();

    // Cache the data
    if (isAgent) {
      cachedAgents = data;
    } else {
      cachedCustomers = data;
    }

    return findPersona(data, personaName, isAgent);
  } catch (error) {
    console.error('❌ Error loading persona:', error.message);
    return null;
  }
}

// Helper function to find and format persona from data
function findPersona(data, personaName, isAgent) {
  const personas = isAgent
    ? data.AgentPrompts || data
    : data.CustomerPrompts || data;

  // Find persona by name
  const nameField = isAgent ? 'AgentName' : 'CustomerName';
  const persona = personas.find(p => p[nameField] === personaName);

  if (!persona) {
    console.error(`❌ Persona not found: ${isAgent ? 'agent' : 'customer'}/${personaName}`);
    return null;
  }

  // Build system prompt for OpenAI
  const systemPrompt = isAgent
    ? `${persona.ScriptedIntroduction}\n\nCharacteristics:\n- Response: ${persona.ResponseToIssue}\n- Competence: ${persona.CompetenceLevel}\n- Attitude: ${persona.Attitude}\n- Product knowledge: ${persona.ProductKnowledge}\n\n${persona.Characteristics}`
    : persona.Prompt;

  return {
    name: personaName,
    role: isAgent ? 'agent' : 'customer',
    systemPrompt,
    introduction: isAgent ? persona.ScriptedIntroduction : '',
    rawData: persona,
  };
}

module.exports = { loadPersona, clearCache };
