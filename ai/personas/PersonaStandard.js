/**
 * PersonaStandard - Schema specification, validator, and deterministic Markdown formatter for Notely AI personas.
 */

const DEFAULT_PERSONAS = [
  {
    id: 'general',
    name: 'General Assistant',
    description: 'Balanced, thoughtful knowledge teammate.',
    tone: 'direct, clear, warm',
    verbosity: 'balanced',
    responseStructure: 'Clear introduction -> Structured evidence summary -> Actionable conclusions',
    systemInstructions: 'Act as a thoughtful pair programmer and knowledge partner for the workspace notes.'
  },
  {
    id: 'software-engineer',
    name: 'Software Engineer',
    description: 'Focused on code analysis, refactoring, implementation patterns, and debugging.',
    tone: 'analytical, precise, practical',
    verbosity: 'concise',
    responseStructure: 'Problem Statement -> Code Solution -> Edge Cases -> Verification',
    systemInstructions: 'Act as a senior pair programmer evaluating workspace notes with an emphasis on code quality.'
  },
  {
    id: 'technical-architect',
    name: 'Technical Architect',
    description: 'Focuses on system design, APIs, data flow, and architecture trade-offs.',
    tone: 'analytical, structured, strategic',
    verbosity: 'detailed',
    responseStructure: 'Overview -> Key Components -> Tradeoffs -> Recommendations',
    systemInstructions: 'Analyze notes with an emphasis on technical architecture, scalability, and code structure.'
  },
  {
    id: 'research-assistant',
    name: 'Research Assistant',
    description: 'Synthesizes notes, identifies research gaps, and connects concepts.',
    tone: 'curious, analytical, thorough',
    verbosity: 'thorough',
    responseStructure: 'Key Insights -> Connected Notes -> Knowledge Gaps -> Suggested Next Steps',
    systemInstructions: 'Synthesize concepts across notes to highlight hidden relationships and open questions.'
  }
];

class PersonaStandard {
  /**
   * Validate persona object against standard schema
   * @param {object} personaObj
   * @returns {boolean}
   */
  static validate(personaObj) {
    if (!personaObj || typeof personaObj !== 'object') return false;
    const hasInstructions = Boolean(
      personaObj.systemInstructions || personaObj.prompt || personaObj.body
    );
    return Boolean(
      personaObj.id &&
      personaObj.name &&
      personaObj.tone &&
      hasInstructions
    );
  }

  /**
   * Normalize input persona object fields
   * @param {object} input
   * @returns {object}
   */
  static normalize(input = {}) {
    const id = (input.id || input.name || 'custom-persona')
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    const expertise = Array.isArray(input.expertise)
      ? input.expertise
      : (typeof input.expertise === 'string' ? input.expertise.split(',').map(s => s.trim()) : ['Workspace Knowledge']);

    return {
      id,
      name: input.name || id,
      version: input.version || '1.0.0',
      description: input.description || 'Custom user defined persona',
      purpose: input.purpose || input.description || 'Assist user with workspace notes',
      expertise,
      tone: input.tone || 'direct, clear, helpful',
      verbosity: input.verbosity || 'balanced',
      responseStructure: input.responseStructure || 'Summary -> Detailed Evidence -> Recommendations',
      clarificationStrategy: input.clarificationStrategy || 'Ask direct questions when intent is ambiguous.',
      preferredExamples: input.preferredExamples || 'Relevant note snippets and examples.',
      fallbackBehaviour: input.fallbackBehaviour || 'Summarize available evidence.',
      owner: input.owner || 'User',
      schemaVersion: input.schemaVersion || '1.0.0',
      systemInstructions: input.systemInstructions || input.prompt || input.body || 'Act as a helpful knowledge partner.'
    };
  }

  /**
   * Format any persona object into deterministic, standardized Markdown with frontmatter
   * @param {object} personaData
   * @returns {string}
   */
  static formatPersonaMarkdown(personaData) {
    const p = this.normalize(personaData);
    const expertiseStr = `[${p.expertise.join(', ')}]`;

    const frontmatter = [
      '---',
      `id: ${p.id}`,
      `name: "${p.name}"`,
      `version: ${p.version}`,
      `description: "${p.description}"`,
      `purpose: "${p.purpose}"`,
      `expertise: ${expertiseStr}`,
      `tone: "${p.tone}"`,
      `verbosity: ${p.verbosity}`,
      `responseStructure: "${p.responseStructure}"`,
      `clarificationStrategy: "${p.clarificationStrategy}"`,
      `preferredExamples: "${p.preferredExamples}"`,
      `fallbackBehaviour: "${p.fallbackBehaviour}"`,
      `owner: "${p.owner}"`,
      `schemaVersion: ${p.schemaVersion}`,
      '---'
    ].join('\n');

    const body = [
      `# Persona: ${p.name}`,
      '',
      '## Role Definition & Mindset',
      p.systemInstructions,
      '',
      '## Communication Style & Tone',
      `- Tone: ${p.tone}`,
      `- Verbosity: ${p.verbosity}`,
      `- Preferred Structure: ${p.responseStructure}`
    ].join('\n');

    return `${frontmatter}\n\n${body}\n`;
  }

  static getDefaultPersonas() {
    return DEFAULT_PERSONAS;
  }
}

module.exports = {
  PersonaStandard,
  DEFAULT_PERSONAS
};
