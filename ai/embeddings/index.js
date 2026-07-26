/**
 * Embeddings Module Facade
 * Single entry point for SQLite Vector Embedding DB, local ONNX models, and HuggingFace embedding services.
 */

const EmbeddingDB = require('./EmbeddingDB');
const EmbeddingService = require('./EmbeddingService');
const ONNXEmbedder = require('./ONNXEmbedder');

module.exports = {
  EmbeddingDB,
  EmbeddingService,
  ONNXEmbedder,

  createEmbeddingDB: (workspaceRoot) => new EmbeddingDB(workspaceRoot),
  createEmbeddingService: (db, provider) => new EmbeddingService(db, provider)
};
