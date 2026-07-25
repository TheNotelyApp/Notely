const AIFlow = require('../../ai/core/AIFlow');

class MockAgent {
  constructor() {
    this.workspaceRoot = '/mock/workspace';
    this.documentService = {
      getAllDocuments: () => [{ path: '/mock/workspace/note1.md', filePath: '/mock/workspace/note1.md' }]
    };
    this.conversationStore = {
      getConversation: (id) => ({ id, title: 'Test Chat', persona: 'software-engineer' }),
      getMessages: (_id) => [
        { role: 'user', content: 'What is the architecture?' },
        { role: 'assistant', content: 'It uses modular facades.' }
      ],
      addMessage: (_id, _role, _content, _meta) => ({ id: 'msg-123' })
    };
    this.personaDB = {
      get: (id) => ({ id, name: 'Software Engineer', prompt: 'Act as a senior software engineer.' })
    };
    this.contextOrchestrator = {
      orchestrate: async (_query, _ctx) => ({
        aggregatedContext: '[EVIDENCE] Note 1 contains architecture overview.',
        trace: [{ name: 'explore_notes', type: 'programmatic', args: { query: 'arch' } }],
        confidence: 0.85
      })
    };
    this.promptPipeline = {
      assemble: ({ persona }) => `SYSTEM PROMPT for persona: ${typeof persona === 'object' ? persona.name : persona}`
    };
    this.queryExecutor = {
      execute: async (_query, _ctx) => ({
        result: 'Here is the architecture overview based on [note1.md](file:////mock/workspace/note1.md).',
        tokensUsed: 150,
        trace: [{ name: 'search_notes', args: {}, type: 'llm', output: 'result' }]
      }),
      stream: async (_query, _ctx, onChunk) => {
        if (onChunk) onChunk({ type: 'text', content: 'Streamed response' });
        return {
          result: 'Streamed response for architecture.',
          tokensUsed: 80,
          trace: []
        };
      }
    };
    this.logDb = {
      isInitialized: true,
      addLog: (_sub, _msg, _level, payload) => {
        this.lastLoggedTelemetry = payload;
      }
    };
  }
}

describe('AIFlow Master Pipeline & Telemetry Tests', () => {
  let agent;
  let flow;

  beforeEach(() => {
    agent = new MockAgent();
    flow = new AIFlow(agent);
  });

  it('should execute 5-stage pipeline and produce structured telemetry', async () => {
    const res = await flow.execute('Explain system architecture', { conversationId: 'conv-1' });

    expect(res).toBeDefined();
    expect(res.result).toContain('architecture overview');
    expect(res.telemetry).toBeDefined();
    expect(res.telemetry.stages).toHaveLength(5);

    const stages = res.telemetry.stages;
    expect(stages[0].stage).toBe(1); // Context & Persona
    expect(stages[0].personaId).toBe('software-engineer');
    expect(stages[1].stage).toBe(2); // Intent & Retrieval
    expect(stages[1].confidenceScore).toBe(0.85);
    expect(stages[2].stage).toBe(3); // Prompt Assembly
    expect(stages[3].stage).toBe(4); // Execution Strategy & Grounding
    expect(stages[3].tokensUsed).toBe(150);
    expect(stages[4].stage).toBe(5); // Memory Persistence
    expect(stages[4].saved).toBe(true);

    expect(agent.lastLoggedTelemetry).toBeDefined();
    expect(agent.lastLoggedTelemetry.query).toBe('Explain system architecture');
  });

  it('should execute streaming 5-stage pipeline cleanly', async () => {
    const chunks = [];
    const res = await flow.stream(
      'Stream architecture details',
      { conversationId: 'conv-1' },
      (chunk) => chunks.push(chunk)
    );

    expect(res).toBeDefined();
    expect(res.result).toBe('Streamed response for architecture.');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe('Streamed response');

    expect(res.telemetry).toBeDefined();
    expect(res.telemetry.stages).toHaveLength(5);
    expect(res.telemetry.stages[3].strategy).toBe('StreamingStrategy');
  });

  it('should handle context orchestrator fallback gracefully', async () => {
    agent.contextOrchestrator.orchestrate = async () => {
      throw new Error('Orchestrator error');
    };

    const res = await flow.execute('Fallback test query', { conversationId: 'conv-1' });

    expect(res).toBeDefined();
    expect(res.result).toBeDefined();
    expect(res.telemetry.stages[1].confidenceScore).toBe(0.0);
  });
});
