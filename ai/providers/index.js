/**
 * Providers Module Facade
 * Single entry point for LLM and embedding provider registration and resolution.
 */

const LLMRegistry = require('./LLMRegistry');
const { PROVIDER_REGISTRY, ALLOWED_PROVIDER_IDS, getProviderMeta, isProviderAvailable } = require('./ProviderRegistry');
const ProviderBase = require('./ProviderBase');
const GeminiProvider = require('./GeminiProvider');
const GroqProvider = require('./GroqProvider');
const OpenAICompatibleProvider = require('./OpenAICompatibleProvider');
const HuggingFaceEmbeddingProvider = require('./HuggingFaceEmbeddingProvider');
const LocalONNXProvider = require('./LocalONNXProvider');

module.exports = {
  LLMRegistry,
  PROVIDER_REGISTRY,
  ALLOWED_PROVIDER_IDS,
  getProviderMeta,
  isProviderAvailable,
  ProviderBase,
  GeminiProvider,
  GroqProvider,
  OpenAICompatibleProvider,
  HuggingFaceEmbeddingProvider,
  LocalONNXProvider,

  createLLMRegistry: () => new LLMRegistry()
};
