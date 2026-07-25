/**
 * Context Module Facade
 * Single entry point for context assembly, workspace context management, and hybrid retrieval.
 */

const { ContextEngine } = require('./ContextEngine');
const ContextManager = require('./ContextManager');
const { SemanticRetriever } = require('./SemanticRetriever');
const { GraphRetriever } = require('./GraphRetriever');
const { HybridRetriever } = require('./HybridRetriever');

module.exports = {
  ContextEngine,
  ContextManager,
  SemanticRetriever,
  GraphRetriever,
  HybridRetriever,

  createContextEngine: (store, semanticRetriever, graphRetriever, hybridRetriever) => {
    return new ContextEngine(store, semanticRetriever, graphRetriever, hybridRetriever);
  },
  createContextManager: (db, documentService) => {
    return new ContextManager(db, documentService);
  }
};
