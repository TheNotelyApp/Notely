/**
 * Memory Module Facade
 * Single entry point for ConversationStore, MemoryDB, PersonaDB, and InteractionLog.
 */

const { MemoryDB } = require('./MemoryDB');
const { PersonaDB } = require('./PersonaDB');
const { ConversationStore } = require('./ConversationStore');
const InteractionLog = require('./InteractionLog');
const MemoryOptimizer = require('./MemoryOptimizer');
const PatternAnalyzer = require('./PatternAnalyzer');

module.exports = {
  MemoryDB,
  PersonaDB,
  ConversationStore,
  InteractionLog,
  MemoryOptimizer,
  PatternAnalyzer,

  createMemoryDB: (workspaceRoot) => new MemoryDB(workspaceRoot),
  createPersonaDB: (appDataDir) => new PersonaDB(appDataDir),
  createConversationStore: (memoryDB, personaDB) => new ConversationStore(memoryDB, personaDB)
};
