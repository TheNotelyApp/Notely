const assert = require('assert');
const LLMRegistry = require('../../ai/providers/LLMRegistry');

describe('LLMProvider & Registry Tests', () => {
  it('should list all registered providers', () => {
    const registry = new LLMRegistry();
    const providers = registry.listProviders();
    
    assert.ok(providers.length >= 2);
    assert.ok(providers.includes('gemini'));
    assert.ok(providers.includes('groq'));
  });

  it('should activate provider with configs', async () => {
    const registry = new LLMRegistry();
    
    // Attempt activation with dummy key
    const success = await registry.activateProvider('groq', { apiKey: 'dummy-key', model: 'llama-3.3-70b-specdec' });
    assert.ok(success);
    
    const active = registry.getActiveProvider();
    assert.strictEqual(active.name.toLowerCase(), 'groq');
    assert.strictEqual(active.model, 'llama-3.3-70b-specdec');
  });

  it('should extract entities and relations with LLMGraphAdapter', async () => {
    const LLMGraphAdapter = require('../../ai/graph/semantic/adapters/LLMGraphAdapter');
    const mockLLM = {
      generateText: async () => JSON.stringify({
        entities: [
          { name: 'GraphQL', type: 'Technology', confidence: 0.95 },
          { name: 'Node.js', type: 'Technology', confidence: 0.9 }
        ],
        relations: [
          { source: 'Node.js', target: 'GraphQL', type: 'USES', confidence: 0.9, sentence: 'Node.js uses GraphQL for APIs' }
        ]
      })
    };

    const adapter = new LLMGraphAdapter({ providerInstance: mockLLM });
    const result = await adapter.extract({ content: 'We build Node.js APIs using GraphQL.' });

    assert.strictEqual(result.entities.length, 2);
    assert.strictEqual(result.entities[0].canonicalName, 'GraphQL');
    assert.strictEqual(result.relations.length, 1);
    assert.strictEqual(result.relations[0].relationType, 'USES');
  });
});

