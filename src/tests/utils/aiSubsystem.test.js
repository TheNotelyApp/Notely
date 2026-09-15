import { describe, it, expect, vi, beforeEach } from 'vitest';
import OpenAICompatibleProvider from '../../../ai/providers/OpenAICompatibleProvider';

// Mock dependencies
vi.mock('ai', () => ({
  generateText: vi.fn().mockResolvedValue({
    text: 'Vercel AI response text',
    usage: { totalTokens: 42 }
  }),
  wrapLanguageModel: vi.fn((opts) => opts.model)
}));

// Inject mock directly into Node's require cache to intercept the CommonJS require('groq-sdk')
const groqPath = require.resolve('groq-sdk');
const mockGroqInstance = {
  chat: {
    completions: {
      create: async () => ({
        choices: [{
          message: {
            content: 'Groq native response text'
          }
        }],
        usage: { total_tokens: 100 }
      })
    }
  }
};

require.cache[groqPath] = {
  id: groqPath,
  filename: groqPath,
  loaded: true,
  exports: {
    Groq: class {
      constructor() {
        return mockGroqInstance;
      }
    }
  }
};

vi.mock('../../../ai/tools/ToolRegistry', () => ({
  getTools: vi.fn().mockResolvedValue({})
}));

describe('AI Subsystem Tests', () => {
  let mockAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAgent = {
      workspaceRoot: '/mock/workspace',
      db: {
        getWorkspaceFiles: vi.fn().mockReturnValue([])
      },
      llmRegistry: {
        getActiveProvider: vi.fn()
      }
    };
  });

  describe('OpenAICompatibleProvider', () => {
    it('should dynamically import and create Groq client when baseUrl points to api.groq.com', async () => {
      const provider = new OpenAICompatibleProvider('gsk_mock', {
        baseUrl: 'https://api.groq.com/openai/v1',
        model: 'llama-3.3-70b-versatile'
      });

      const modelInstance = await provider.getModelInstance();
      expect(modelInstance).toBeDefined();
    });
  });
});
