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

  getCapabilities() {
    return {
      supportsEmbeddings: false,
      supportsChatCompletion: true,
      supportsCaching: false,

      // GROQ WORKAROUND: Groq's streaming path is less reliable for multi-step
      // tool calls — routing through generateText() (execute) is more stable.
      // The root format issue (double-encoded args) is fixed via the
      // wrapLanguageModel middleware in OpenAICompatibleProvider.getModelInstance().
      supportsStreaming: false,

      // llama-3.3-70b-versatile has a 128k context window on Groq.
      maxTokens: 128000,
    };
  }
}

module.exports = { GroqProvider, GROQ_MODELS };
