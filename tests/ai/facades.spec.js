describe('12 Domain Module Facades Integrity & Exports Tests', () => {
  it('should export planner facade with single entry point API', () => {
    const plannerModule = require('../../ai/planner');
    expect(plannerModule.Planner).toBeDefined();
    expect(plannerModule.ContextOrchestrator).toBeDefined();
    expect(plannerModule.IntentAnalyzer).toBeDefined();
    expect(plannerModule.CapabilityResolver).toBeDefined();
    expect(typeof plannerModule.createPlanner).toBe('function');
    expect(typeof plannerModule.createContextOrchestrator).toBe('function');
  });

  it('should export core facade with single entry point API', () => {
    const coreModule = require('../../ai/core');
    expect(coreModule.Agent).toBeDefined();
    expect(coreModule.AIFlow).toBeDefined();
    expect(coreModule.AIConfig).toBeDefined();
    expect(coreModule.AIService).toBeDefined();
    expect(typeof coreModule.createLogger).toBe('function');
  });

  it('should export personas facade with single entry point API', () => {
    const personaModule = require('../../ai/personas');
    expect(personaModule.PersonaManager).toBeDefined();
    expect(personaModule.PersonaStandard).toBeDefined();
    expect(personaModule.DEFAULT_PERSONAS).toBeDefined();
    expect(typeof personaModule.normalizePersona).toBe('function');
    expect(typeof personaModule.validatePersona).toBe('function');

    const norm = personaModule.normalizePersona({ name: 'Test Persona', prompt: 'Be helpful' });
    expect(norm.name).toBe('Test Persona');
    expect(norm.id).toBe('test-persona');
  });

  it('should export prompts facade with single entry point API', () => {
    const promptModule = require('../../ai/prompts');
    expect(promptModule.PromptLoader).toBeDefined();
    expect(promptModule.PromptPipeline).toBeDefined();
    expect(promptModule.TemplateEngine).toBeDefined();
    expect(typeof promptModule.createPromptPipeline).toBe('function');
  });

  it('should export context facade with single entry point API', () => {
    const contextModule = require('../../ai/context');
    expect(contextModule.ContextEngine).toBeDefined();
    expect(contextModule.ContextManager).toBeDefined();
    expect(contextModule.SemanticRetriever).toBeDefined();
    expect(contextModule.GraphRetriever).toBeDefined();
    expect(contextModule.HybridRetriever).toBeDefined();
  });

  it('should export graph facade with single entry point API', () => {
    const graphModule = require('../../ai/graph');
    expect(graphModule.GraphDB).toBeDefined();
    expect(graphModule.GraphService).toBeDefined();
    expect(graphModule.GraphBuilder).toBeDefined();
    expect(graphModule.MarkdownASTParser).toBeDefined();
  });

  it('should export embeddings facade with single entry point API', () => {
    const embModule = require('../../ai/embeddings');
    expect(embModule.EmbeddingDB).toBeDefined();
    expect(embModule.EmbeddingService).toBeDefined();
    expect(embModule.ONNXEmbedder).toBeDefined();
  });

  it('should export memory facade with single entry point API', () => {
    const memoryModule = require('../../ai/memory');
    expect(memoryModule.MemoryDB).toBeDefined();
    expect(memoryModule.PersonaDB).toBeDefined();
    expect(memoryModule.ConversationStore).toBeDefined();
    expect(memoryModule.InteractionLog).toBeDefined();
  });

  it('should export executor facade with single entry point API', () => {
    const execModule = require('../../ai/executor');
    expect(execModule.QueryExecutor).toBeDefined();
    expect(execModule.SelfCorrectionEngine).toBeDefined();
    expect(typeof execModule.createQueryExecutor).toBe('function');
  });

  it('should export tools facade with single entry point API', () => {
    const toolsModule = require('../../ai/tools');
    expect(typeof toolsModule.getTools).toBe('function');
    expect(toolsModule.SemanticTools).toBeDefined();
    expect(toolsModule.DocumentReader).toBeDefined();
  });

  it('should export grounding facade with single entry point API', () => {
    const groundingModule = require('../../ai/grounding');
    expect(groundingModule.GroundingEngine).toBeDefined();
    expect(typeof groundingModule.verifyCitations).toBe('function');
    expect(typeof groundingModule.verifyNoteTitleClaims).toBe('function');
    expect(typeof groundingModule.formatLineNumberLinks).toBe('function');
  });

  it('should export formatter facade with single entry point API', () => {
    const formatterModule = require('../../ai/formatter');
    expect(typeof formatterModule.formatResponse).toBe('function');
    expect(typeof formatterModule.formatLineNumberLinks).toBe('function');
    expect(typeof formatterModule.formatToolOutput).toBe('function');

    const formatted = formatterModule.formatToolOutput({ title: 'Note A', snippet: 'Content A' });
    expect(formatted).toContain('- **Note A**: Content A');
  });

  it('should export testing facade with single entry point API', () => {
    const testingModule = require('../../ai/testing');
    expect(testingModule.PromptTester).toBeDefined();
    expect(typeof testingModule.runFullAudit).toBe('function');

    const audit = testingModule.runFullAudit();
    expect(audit).toBeDefined();
    expect(typeof audit.success).toBe('boolean');
  });

  it('should export compaction facade with single entry point API', () => {
    const compactionModule = require('../../ai/compaction');
    expect(compactionModule.CompactionEngine).toBeDefined();
    expect(typeof compactionModule.compactHistory).toBe('function');
    expect(typeof compactionModule.extractTurnSummary).toBe('function');
  });

  it('should export database facade with single entry point API', () => {
    const databaseModule = require('../../ai/database');
    expect(databaseModule.DatabaseManager).toBeDefined();
  });

  it('should export diagnostics facade with single entry point API', () => {
    const diagnosticsModule = require('../../ai/diagnostics');
    expect(diagnosticsModule.AgentHarness).toBeDefined();
    expect(typeof diagnosticsModule.getSubsystemHealth).toBe('function');
  });
});
