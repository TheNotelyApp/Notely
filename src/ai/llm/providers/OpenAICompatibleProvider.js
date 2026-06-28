/**
 * OpenAICompatibleProvider - Reusable base for any provider that speaks the
 * OpenAI REST API format (chat completions endpoint).
 *
 * Subclasses only need to set:
 *   this.name, this.baseUrl, this.model (in their constructor)
 *
 * Groq, OpenRouter, LM Studio, Ollama, and a future OpenAI provider all use
 * this same wire format, so they get retry, backoff, and chat-completion
 * formatting for free.
 *
 * Note: embeddings are NOT part of this base because providers differ widely
 * in whether/how they expose them. Subclasses that support embeddings should
 * override generateEmbeddings().
 */

const LLMProvider = require('../LLMProvider');
const HttpClient = require('../HttpClient');
const { createLogger } = require('../../utils/logger');

class OpenAICompatibleProvider extends LLMProvider {
  /**
   * @param {string} apiKey
   * @param {Object} config
   * @param {string} config.baseUrl      - e.g. 'https://api.groq.com/openai/v1'
   * @param {string} config.model        - default chat model id
   * @param {number} [config.requestTimeoutMs]
   * @param {number} [config.maxRetries]
   */
  constructor(apiKey, config = {}) {
    super(config);
    if (!config.baseUrl) throw new Error('OpenAICompatibleProvider requires config.baseUrl');
    if (!config.model)   throw new Error('OpenAICompatibleProvider requires config.model');

    this.apiKey  = apiKey;
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.model   = config.model;
    this.http    = new HttpClient(config);
    this.log     = createLogger(this.name || 'OpenAICompatibleProvider');

    this.usageStats = { tokensUsedTotal: 0, requestsTotal: 0 };
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async initialize() {
    this.validate();
    await this._testConnection();
    this.isInitialized = true;
    this.log.info('Initialized successfully');
    return true;
  }

  validate() {
    if (!this.apiKey || typeof this.apiKey !== 'string' || !this.apiKey.trim()) {
      throw new Error(`${this.name}: API key is required`);
    }
    return true;
  }

  // ── Core API calls ─────────────────────────────────────────────────────────

  /**
   * Generate text from a single prompt (maps to a one-shot chat completion).
   */
  async generateText(prompt, options = {}) {
    if (!this.isInitialized) throw new Error(`${this.name}: provider not initialized`);
    const { temperature = 0.7, maxTokens = 1024, systemPrompt = '' } = options;

    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    return this._chatCompletion(messages, { temperature, maxTokens });
  }

  /**
   * Generate a chat completion from a message history.
   */
  async generateChatCompletion(messages, options = {}) {
    if (!this.isInitialized) throw new Error(`${this.name}: provider not initialized`);
    const { temperature = 0.7, maxTokens = 2048, systemPrompt = '' } = options;

    const fullMessages = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;

    return this._chatCompletion(fullMessages, { temperature, maxTokens });
  }

  /**
   * Embeddings are not universally supported by OpenAI-compatible providers.
   * Subclasses that do support them should override this method.
   */
  async generateEmbeddings(_texts) {
    throw new Error(`${this.name} does not support embeddings. Use Gemini or another embeddings-capable provider.`);
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  /**
   * Shared chat completion implementation.
   * @private
   */
  async _chatCompletion(messages, { temperature, maxTokens }) {
    try {
      const response = await this.http.fetchWithRetry(
        `${this.baseUrl}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            messages,
            temperature,
            max_tokens: maxTokens,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(`${this.name} API error ${response.status}: ${err?.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content ?? '';
      const tokensUsed = data.usage?.total_tokens ?? 0;

      this.usageStats.tokensUsedTotal += tokensUsed;
      this.usageStats.requestsTotal += 1;

      return { text, tokensUsed, model: data.model || this.model, finishReason: data.choices?.[0]?.finish_reason };
    } catch (error) {
      this.log.error('_chatCompletion error', error);
      throw error;
    }
  }

  /**
   * Connectivity check — sends a minimal single-token request.
   * @private
   */
  async _testConnection() {
    const response = await this.http.fetchWithRetry(
      `${this.baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 1,
        }),
      },
      { timeoutMs: 15000, retries: 1 }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Connection test failed (${response.status}): ${err?.error?.message || response.statusText}`);
    }
  }

  // ── Provider info ──────────────────────────────────────────────────────────

  getCapabilities() {
    return {
      supportsEmbeddings: false,
      supportsChatCompletion: true,
      supportsCaching: false,
      supportsStreaming: false,
      maxTokens: 32768,
    };
  }

  getUsageStats() {
    return { ...this.usageStats };
  }

  async isAvailable() {
    return this.isInitialized;
  }
}

module.exports = OpenAICompatibleProvider;
