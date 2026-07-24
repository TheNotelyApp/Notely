/**
 * PersonaManager - Registry and resolver for Notely AI built-in and user-created custom personas.
 */

const path = require('path');
const PromptLoader = require('../prompts/PromptLoader');
const { PersonaStandard } = require('./PersonaStandard');
const { createLogger } = require('../core/logger');

const log = createLogger('PersonaManager');

class PersonaManager {
  /**
   * @param {PromptLoader} promptLoader
   * @param {object} [personaDB=null]
   * @param {string} [appDataDir=null] - Specific user app data directory
   */
  constructor(promptLoader = null, personaDB = null, appDataDir = null) {
    this.loader = promptLoader || new PromptLoader();
    this.personaDB = personaDB;
    this.userPersonasDir = appDataDir ? path.join(appDataDir, 'personas') : (personaDB?.personasDir || null);
    this.registeredPersonas = new Map();
  }

  /**
   * Set dedicated user personas app directory
   * @param {string} appDataDir
   */
  setUserPersonasDir(appDataDir) {
    this.userPersonasDir = appDataDir ? path.join(appDataDir, 'personas') : null;
  }

  /**
   * Load and validate a persona by ID strictly from designated app locations
   * @param {string} personaId
   * @returns {object}
   */
  getPersona(personaId = 'general') {
    if (this.registeredPersonas.has(personaId)) {
      return this.registeredPersonas.get(personaId);
    }

    // 1. Try loading from PersonaDB if connected
    if (this.personaDB) {
      try {
        const dbRow = this.personaDB.get(personaId);
        if (dbRow) {
          const personaObj = PersonaStandard.normalize({
            id: dbRow.id,
            name: dbRow.name,
            description: dbRow.description,
            type: dbRow.type,
            version: dbRow.version,
            avatar: dbRow.avatar,
            systemInstructions: dbRow.prompt
          });
          this.registeredPersonas.set(personaId, personaObj);
          return personaObj;
        }
      } catch (err) {
        log.warn(`PersonaDB lookup for '${personaId}' failed:`, err.message);
      }
    }

    // 2. Load from PromptLoader (restricted strictly to user app personas directory and packaged built-ins)
    const userDir = this.userPersonasDir || this.personaDB?.personasDir || null;
    const loaded = this.loader.loadPersona(personaId, userDir);
    if (loaded) {
      const normalized = PersonaStandard.normalize({
        id: loaded.id,
        name: loaded.metadata.name || loaded.id,
        description: loaded.metadata.description || '',
        tone: loaded.metadata.tone || 'direct, clear, warm',
        verbosity: loaded.metadata.verbosity || 'balanced',
        responseStructure: loaded.metadata.responseStructure || '',
        systemInstructions: loaded.body,
        ...loaded.metadata
      });
      this.registeredPersonas.set(personaId, normalized);
      return normalized;
    }

    // 3. Fallback to default persona standard
    const defaults = PersonaStandard.getDefaultPersonas();
    const fallback = defaults.find(p => p.id === personaId) || defaults[0];
    return PersonaStandard.normalize(fallback);
  }

  /**
   * Create and register a custom persona using the standard deterministic template form
   * @param {object} personaData
   * @param {object} [targetPersonaDB]
   * @returns {object}
   */
  createCustomPersona(personaData, targetPersonaDB = null) {
    const db = targetPersonaDB || this.personaDB;
    const normalized = PersonaStandard.normalize(personaData);

    if (db) {
      db.save({
        id: normalized.id,
        name: normalized.name,
        description: normalized.description,
        type: 'custom',
        version: normalized.version,
        avatar: normalized.avatar || '👤',
        prompt: normalized.systemInstructions,
        tone: normalized.tone,
        verbosity: normalized.verbosity,
        responseStructure: normalized.responseStructure
      });
    }

    this.registeredPersonas.set(normalized.id, normalized);
    log.info(`Created custom persona '${normalized.id}' (${normalized.name})`);
    return normalized;
  }

  /**
   * Get list of all available persona IDs (built-in + DB custom)
   * @returns {string[]}
   */
  listAvailablePersonas() {
    const builtins = [
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

    if (this.personaDB) {
      try {
        const rows = this.personaDB.list();
        const customIds = rows.map(r => r.id);
        return Array.from(new Set([...builtins, ...customIds]));
      } catch {
        return builtins;
      }
    }

    return builtins;
  }
}

module.exports = PersonaManager;
