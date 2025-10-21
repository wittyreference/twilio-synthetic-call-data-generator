// ABOUTME: Simple integration test for OpenAI API parameter validation
// ABOUTME: Validates we use correct parameters to prevent BadRequest errors

describe('OpenAI API Parameters - Regression Prevention', () => {
  test('respond.js should use max_completion_tokens (not deprecated max_tokens)', () => {
    const fs = require('fs');
    const path = require('path');

    const respondPath = path.join(__dirname, '../../functions/respond.js');
    const respondCode = fs.readFileSync(respondPath, 'utf-8');

    // Should NOT contain the deprecated parameter
    expect(respondCode).not.toMatch(/max_tokens\s*:/);

    // Should contain the new parameter
    expect(respondCode).toMatch(/max_completion_tokens\s*:/);
  });

  test('respond.js should NOT set custom temperature (uses model default)', () => {
    const fs = require('fs');
    const path = require('path');

    const respondPath = path.join(__dirname, '../../functions/respond.js');
    const respondCode = fs.readFileSync(respondPath, 'utf-8');

    // We use model default temperature
    // The code should not contain 'temperature:' in the OpenAI call
    const openaiCallMatch = respondCode.match(/chat\.completions\.create\s*\(\s*\{[\s\S]*?\}\s*\)/);

    if (openaiCallMatch) {
      const openaiCall = openaiCallMatch[0];
      // Should NOT contain temperature setting
      expect(openaiCall).not.toMatch(/temperature\s*:/);
    } else {
      throw new Error('Could not find OpenAI chat.completions.create call in respond.js');
    }
  });

  test('respond.js should use gpt-4o-mini model', () => {
    const fs = require('fs');
    const path = require('path');

    const respondPath = path.join(__dirname, '../../functions/respond.js');
    const respondCode = fs.readFileSync(respondPath, 'utf-8');

    // Should use gpt-4o-mini model (valid OpenAI model)
    expect(respondCode).toMatch(/model\s*:\s*['"]gpt-4o-mini['"]/);
  });

  test('respond.js should set max_completion_tokens to 150', () => {
    const fs = require('fs');
    const path = require('path');

    const respondPath = path.join(__dirname, '../../functions/respond.js');
    const respondCode = fs.readFileSync(respondPath, 'utf-8');

    // Should set max_completion_tokens to 150
    expect(respondCode).toMatch(/max_completion_tokens\s*:\s*150/);
  });

  test('respond.js should validate empty OpenAI responses with fallback', () => {
    const fs = require('fs');
    const path = require('path');

    const respondPath = path.join(__dirname, '../../functions/respond.js');
    const respondCode = fs.readFileSync(respondPath, 'utf-8');

    // Should validate that aiResponse is not empty/null
    expect(respondCode).toMatch(/if\s*\(\s*!aiResponse\s*\|\|\s*aiResponse\.trim\(\)\s*===\s*['"]['"]?\s*\)/);

    // Should have a fallback message for empty responses
    expect(respondCode).toMatch(/I apologize, I didn't catch that/);

    // Should log error when empty response detected
    expect(respondCode).toMatch(/OpenAI returned empty response/);
  });
});
