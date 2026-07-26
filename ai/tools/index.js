/**
 * Tools Module Facade
 * Single entry point for tool registries, semantic tool runners, and document reading tools.
 */

const { getTools, getRegisteredTools } = require('./ToolRegistry');
const SemanticTools = require('./SemanticTools');
const DocumentReader = require('./DocumentReader');
const QueryTools = require('./QueryTools');

module.exports = {
  getTools,
  getRegisteredTools,
  SemanticTools,
  DocumentReader,
  QueryTools,

  createDocumentReader: (db, workspaceRoot) => new DocumentReader(db, workspaceRoot)
};
