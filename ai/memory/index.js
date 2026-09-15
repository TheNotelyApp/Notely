/**
 * Memory Module Facade
 * Single entry point for MemoryDB, InteractionLog, MemoryOptimizer, and PatternAnalyzer.
 */

const { MemoryDB } = require('./MemoryDB');
const InteractionLog = require('./InteractionLog');
const MemoryOptimizer = require('./MemoryOptimizer');
const PatternAnalyzer = require('./PatternAnalyzer');

module.exports = {
  MemoryDB,
  InteractionLog,
  MemoryOptimizer,
  PatternAnalyzer,

  createMemoryDB: (workspaceRoot) => new MemoryDB(workspaceRoot)
};
