/**
 * PromptTester - Automated linter, validator, and regression test runner for Notely AI prompts.
 */

const PromptLoader = require('../prompts/PromptLoader');
const PromptPipeline = require('../prompts/PromptPipeline');

class PromptTester {
  /**
   * @param {PromptLoader} loader
   */
  constructor(loader = null) {
    this.loader = loader || new PromptLoader();
    this.pipeline = new PromptPipeline(this.loader);
  }

  /**
   * Lint static system policy files
   * @returns {{ valid: boolean, errors: string[] }}
   */
  lintSystemPolicies() {
    const policyIds = [
      'base-system',
      'behavior-policy',
      'planning-policy',
      'permission-policy',
      'grounding-policy',
      'conversation-policy',
      'safety-policy',
      'formatting-policy',
      'response-policy'
    ];

    const errors = [];
    for (const id of policyIds) {
      const prompt = this.loader.loadSystemPrompt(id);
      if (!prompt || !prompt.body) {
        errors.push(`System policy '${id}' failed to load or is empty.`);
        continue;
      }

      const meta = prompt.metadata;
      if (!meta.id) errors.push(`System policy '${id}' missing frontmatter 'id'.`);
      if (!meta.version) errors.push(`System policy '${id}' missing frontmatter 'version'.`);
      if (!meta.schemaVersion) errors.push(`System policy '${id}' missing frontmatter 'schemaVersion'.`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Lint built-in personas
   * @returns {{ valid: boolean, errors: string[] }}
   */
  lintPersonas() {
    const personaIds = [
      'general',
      'software-engineer',
      'technical-architect',
      'documentation-writer',
      'research-assistant',
      'brainstorming',
      'tutor',
      'meeting-assistant',
      'knowledge-librarian'
    ];

    const errors = [];
    for (const id of personaIds) {
      const persona = this.loader.loadPersona(id);
      if (!persona || !persona.body) {
        errors.push(`Persona '${id}' failed to load or is empty.`);
        continue;
      }

      const meta = persona.metadata;
      if (!meta.name) errors.push(`Persona '${id}' missing frontmatter 'name'.`);
      if (!meta.tone) errors.push(`Persona '${id}' missing frontmatter 'tone'.`);
      if (!meta.verbosity) errors.push(`Persona '${id}' missing frontmatter 'verbosity'.`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate safety invariants across pipeline assembly output
   * @param {string} assembledPrompt
   * @returns {{ valid: boolean, errors: string[] }}
   */
  validateSafetyInvariants(assembledPrompt) {
    const errors = [];
    if (!assembledPrompt) {
      return { valid: false, errors: ['Assembled prompt is empty.'] };
    }

    // Invariant 1: Must contain strict read-only existing notes restriction
    if (!assembledPrompt.includes('READ-ONLY') && !assembledPrompt.includes('read-only')) {
      errors.push('Prompt is missing mandatory READ-ONLY existing notes safeguard invariant.');
    }

    // Invariant 2: Must contain zero fabrication / mandatory note links rule
    if (!assembledPrompt.includes('Zero Fabrication') && !assembledPrompt.includes('Ground all workspace claims')) {
      errors.push('Prompt is missing mandatory evidence grounding invariant.');
    }

    // Invariant 3: Must contain strict tool silence requirement
    if (!assembledPrompt.includes('Zero Tool Narration') && !assembledPrompt.includes('STRICT Tool Silence')) {
      errors.push('Prompt is missing mandatory zero tool narration invariant.');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Run full test suite
   * @returns {{ success: boolean, results: object }}
   */
  runFullAudit() {
    const policyLint = this.lintSystemPolicies();
    const personaLint = this.lintPersonas();

    const sampleAssembled = this.pipeline.assemble({
      persona: 'software-engineer',
      workspaceContext: { workspaceRoot: '/test/notes', documentCount: 5 },
      retrievedEvidence: 'Sample retrieved note content'
    });

    const invariantCheck = this.validateSafetyInvariants(sampleAssembled);

    const success = policyLint.valid && personaLint.valid && invariantCheck.valid;

    return {
      success,
      results: {
        policyLint,
        personaLint,
        invariantCheck
      }
    };
  }
}

module.exports = PromptTester;
