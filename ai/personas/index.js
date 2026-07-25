/**
 * Personas Module Facade
 * Single entry point for persona resolution, normalization, and persistence.
 */

const PersonaManager = require('./PersonaManager');
const { PersonaStandard, DEFAULT_PERSONAS } = require('./PersonaStandard');

module.exports = {
  PersonaManager,
  PersonaStandard,
  DEFAULT_PERSONAS,
  
  createPersonaManager: (promptLoader, personaDB, appDataDir) => {
    return new PersonaManager(promptLoader, personaDB, appDataDir);
  },
  
  normalizePersona: (input) => PersonaStandard.normalize(input),
  validatePersona: (persona) => PersonaStandard.validate(persona),
  formatPersonaMarkdown: (persona) => PersonaStandard.formatPersonaMarkdown(persona)
};
