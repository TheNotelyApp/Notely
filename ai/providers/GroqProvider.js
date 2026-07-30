/**
 * GroqProvider - Groq cloud inference (free tier).
 *
 * Groq uses the OpenAI API format, so this is a thin configuration layer
 * on top of OpenAICompatibleProvider. The only things that differ from
 * another OpenAI-compatible provider are the base URL and the default model.
 *
 * Groq does NOT offer an embeddings endpoint; embedding-dependent features
 * (semantic search, relationship discovery) will gracefully degrade when
 * Groq is the active provider.
 *
 * Free-tier limits (as of 2025): generous daily request quota, no credit card.
 * API key obtained at: https://console.groq.com
 */

const OpenAICompatibleProvider = require('./OpenAICompatibleProvider');

// Groq-hosted models available on the free tier.
const GROQ_MODELS = {
  // Default — fast, capable, large context.
  default: 'llama-3.3-70b-versatile',
  // Lighter option for lower latency / higher throughput.
  fast: 'llama-3.1-8b-instant',
  // Open model via Groq.
  gemma: 'llama-3.3-70b-versatile',
};

class GroqProvider extends OpenAICompatibleProvider {
  /**
   * @param {string} apiKey  - Groq API key (gsk_…)
   * @param {Object} [config]
   * @param {string} [config.model]           - Override default model
   * @param {number} [config.requestTimeoutMs]
   * @param {number} [config.maxRetries]
   */
  constructor(apiKey, config = {}) {
    let selectedModel = config.model || GROQ_MODELS.default;
    // Auto-fallback decommissioned models (gemma2-9b-it, gemma-7b-it, etc.)
    if (typeof selectedModel === 'string' && (selectedModel.includes('gemma') || selectedModel.includes('llama2') || selectedModel.includes('mixtral-8x7b'))) {
      selectedModel = GROQ_MODELS.default;
    }

    super(apiKey, {
      ...config,
      baseUrl: 'https://api.groq.com/openai/v1',
      model: selectedModel,
    });
    this.name = 'Groq';
  }

  async getModelInstance() {
    const { createGroq } = await import('@ai-sdk/groq');
    const { wrapLanguageModel } = await import('ai');
    const client = createGroq({ apiKey: this.apiKey });
    const baseModel = client(this.model);

    const groqMiddleware = {
      transformParams: async ({ params }) => {
        const llamaToolInstruction =
          '\n\n[TOOL CALLING RULES - FOLLOW STRICTLY]\n' +
          '- Before calling any tool, extract ALL required parameters from the user message.\n' +
          '- For search_notes: derive the `query` value from the user\'s question topic. Never call search_notes with empty args {}.\n' +
          '- If you cannot determine a required argument, answer from your knowledge instead of calling the tool.\n' +
          '- Never emit <function=...> text syntax. Use the structured tool call format only.';

        return {
          ...params,
          prompt: params.prompt?.map(msg => {
            if (msg.role === 'system') {
              return {
                ...msg,
                content: typeof msg.content === 'string'
                  ? msg.content + llamaToolInstruction
                  : msg.content
              };
            }
            return msg;
          }) ?? params.prompt
        };
      },

      wrapGenerate: async ({ doGenerate, params }) => {
        const result = await doGenerate(params);
        if (result.toolCalls && result.toolCalls.length > 0) {
          result.toolCalls = result.toolCalls.map(tc => {
            if (typeof tc.args === 'string') {
              try { tc.args = JSON.parse(tc.args); } catch { /* leave as-is */ }
            }
            return tc;
          });
        }
        return result;
      }
    };

    return wrapLanguageModel({ model: baseModel, middleware: groqMiddleware });
  }

  getCapabilities() {
    return {
      supportsEmbeddings: false,
      supportsChatCompletion: true,
      supportsCaching: false,
      supportsStreaming: false,
      maxTokens: 128000,
    };
  }
}

module.exports = { GroqProvider, GROQ_MODELS };
