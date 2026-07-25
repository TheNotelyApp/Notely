/**
 * Graph Module Facade
 * Single entry point for Knowledge Graph DB, graph service, and AST entity processing.
 */

const GraphDB = require('./GraphDB');
const GraphService = require('./GraphService');
const GraphBuilder = require('./GraphBuilder');
const MarkdownASTParser = require('./MarkdownASTParser');
const EntityResolver = require('./EntityResolver');
const EvidenceStore = require('./EvidenceStore');

module.exports = {
  GraphDB,
  GraphService,
  GraphBuilder,
  MarkdownASTParser,
  EntityResolver,
  EvidenceStore,

  createGraphDB: (workspaceRoot) => new GraphDB(workspaceRoot),
  createGraphService: (agent, graphDb) => new GraphService(agent, graphDb),
  createGraphBuilder: (agent, graphDb, graphService) => new GraphBuilder(agent, graphDb, graphService)
};
