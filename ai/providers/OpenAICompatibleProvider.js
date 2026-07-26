/**
 * OpenAICompatibleProvider - Reusable base for OpenAI-compatible APIs using Vercel AI SDK
 */

const LLMProvider = require('./ProviderBase');
const { createLogger } = require('../core/logger');

class OpenAICompatibleProvider extends LLMProvider {
  constructor(apiKey, config = {}) {
    super(config);
    if (!config.baseUrl) throw new Error('OpenAICompatibleProvider requires config.baseUrl');
    if (!config.model)   throw new Error('OpenAICompatibleProvider requires config.model');

    this.apiKey  = apiKey;
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.model   = config.model;
    this.log     = createLogger(this.name || 'OpenAICompatibleProvider');

    this.usageStats = { tokensUsedTotal: 0, requestsTotal: 0 };
  }

  async initialize() {
    this.validate();
    this.isInitialized = true;
    this.log.info('Initialized successfully');
    return true;
  }

  async getModelInstance() {
    if (this.baseUrl.includes('api.groq.com')) {
      const { createGroq } = await import('@ai-sdk/groq');
      const { wrapLanguageModel } = await import('ai');
      const client = createGroq({ apiKey: this.apiKey });
      const baseModel = client(this.model);

      /**
       * GROQ / LLAMA TOOL-CALLING FIX
       *
       * Root cause: Llama 3.x models on Groq intermittently generate malformed
       * tool calls with empty or missing required arguments, e.g.:
       *
       *   <function=search_notes{}>   ← no `query` arg, Groq rejects with HTTP 400
       *
       * This is a prompt-discipline failure: Llama calls the tool before
       * determining what the required parameters should be. The fix has two parts:
       *
       * 1. transformParams (ROOT CAUSE FIX):
       *    Inject a Llama-specific instruction into the system prompt that forces
       *    the model to derive all required tool arguments from user intent before
       *    invoking any function. This prevents the malformed call from being
       *    generated in the first place.
       *
       * 2. wrapGenerate (SECONDARY DEFENCE):
       *    If a tool call arg arrives as a double-encoded JSON string (another
       *    Llama format quirk), JSON.parse it to an object before the Vercel AI
       *    SDK's schema validator runs. Without this, valid JSON args encoded as
       *    strings would throw AI_InvalidToolInputError.
       *
       * QueryExecutor has no Groq-specific logic — all quirks are isolated here.
       */
      const groqMiddleware = {
        // ROOT CAUSE FIX: inject tool-calling discipline into the system prompt.
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

        // SECONDARY DEFENCE: normalize double-encoded string args → object.
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
    const { createOpenAI } = await import('@ai-sdk/openai');
    const client = createOpenAI({ apiKey: this.apiKey, baseURL: this.baseUrl });
    return client(this.model);
  }

  validate() {
    if (!this.apiKey || typeof this.apiKey !== 'string' || !this.apiKey.trim()) {
      throw new Error(`${this.name}: API key is required`);
    }
    return true;
  }

  async isAvailable() {
    try {
      this.validate();
      const { generateText } = await import('ai');
      const modelInstance = await this.getModelInstance();
      await generateText({
        model: modelInstance,
        prompt: 'test',
        maxTokens: 5,
      });
      return { available: true };
    } catch (err) {
      this.log.error('isAvailable test failed:', err);
      return { available: false, error: err.message };
    }
  }

  async generateText(prompt, options = {}) {
    if (!this.isInitialized) throw new Error(`${this.name}: provider not initialized`);
    const { temperature = 0.7, maxTokens = 1024, systemPrompt = '' } = options;

    try {
      const { generateText } = await import('ai');
      const modelInstance = await this.getModelInstance();

      const result = await generateText({
        model: modelInstance,
        prompt,
        temperature,
        maxTokens,
        system: systemPrompt || undefined,
      });

      const tokensUsed = result.usage?.totalTokens || 0;
      this.usageStats.tokensUsedTotal += tokensUsed;
      this.usageStats.requestsTotal += 1;

      return {
        text: result.text,
        tokensUsed,
        model: this.model,
        finishReason: result.finishReason
      };
    } catch (error) {
      this.log.error('generateText error', error);
      throw error;
    }
  }

  async generateChatCompletion(messages, options = {}) {
    if (!this.isInitialized) throw new Error(`${this.name}: provider not initialized`);
    const { temperature = 0.7, maxTokens = 2048, systemPrompt = '' } = options;

    try {
      const { generateText } = await import('ai');
      const modelInstance = await this.getModelInstance();

      const coreMessages = messages.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      }));

      const result = await generateText({
        model: modelInstance,
        messages: coreMessages,
        temperature,
        maxTokens,
        system: systemPrompt || undefined,
      });

      const tokensUsed = result.usage?.totalTokens || 0;
      this.usageStats.tokensUsedTotal += tokensUsed;
      this.usageStats.requestsTotal += 1;

      return {
        text: result.text,
        tokensUsed,
        model: this.model,
        finishReason: result.finishReason
      };
    } catch (error) {
      this.log.error('generateChatCompletion error', error);
      throw error;
    }
  }

  async generateEmbeddings(_texts) {
    throw new Error(`${this.name} does not support embeddings. Use Gemini or another embeddings-capable provider.`);
  }

  getCapabilities() {
    return {
      supportsEmbeddings: false,
      supportsChatCompletion: true,
      supportsCaching: false,
      supportsStreaming: true,
      maxTokens: 4096
    };
  }

  getUsageStats() {
    return { ...this.usageStats };
  }
}

module.exports = OpenAICompatibleProvider;
