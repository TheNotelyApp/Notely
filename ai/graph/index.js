/**
 * Graph Module Facade
 * Single entry point for Knowledge Graph DB, graph service, AST entity processing, and Semantic Extraction Engine.
 */

const GraphDB = require('./GraphDB');
const GraphService = require('./GraphService');
const GraphBuilder = require('./GraphBuilder');
const MarkdownASTParser = require('./MarkdownASTParser');
const EntityResolver = require('./EntityResolver');
const EvidenceStore = require('./EvidenceStore');
const EvidenceFusionEngine = require('./EvidenceFusionEngine');
const KnowledgeSourceRegistry = require('./KnowledgeSourceRegistry');
const { SemanticExtractionEngine } = require('./semantic');

module.exports = {
  GraphDB,
  GraphService,
  GraphBuilder,
  MarkdownASTParser,
  EntityResolver,
  EvidenceStore,
  EvidenceFusionEngine,
  KnowledgeSourceRegistry,
  SemanticExtractionEngine,

  createGraphDB: (workspaceRoot) => new GraphDB(workspaceRoot),
  createGraphService: (agent, graphDb) => new GraphService(agent, graphDb),
  createGraphBuilder: (agent, graphDb, graphService) => new GraphBuilder(agent, graphDb, graphService)
};
