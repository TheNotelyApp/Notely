/**
 * SemanticExtractionEngine - Core Model-Agnostic Semantic Extraction Service
 * Accepts normalized evidence, invokes configured model adapter, validates outputs, adds provenance, emits telemetry.
 */

const fs = require('fs');
const path = require('path');
const { createLogger } = require('../../core/logger');
const GLiNER2RelexAdapter = require('./adapters/GLiNER2RelexAdapter');
const ExtractionValidator = require('./validators/ExtractionValidator');
const { ExtractionResult } = require('./schemas/ExtractionResult');

const log = createLogger('SemanticExtractionEngine');

class SemanticExtractionEngine {
  constructor(appDataDir, config = null) {
    this.appDataDir = appDataDir;
    this.config = config || this._loadConfig();
    this.adapter = null;
    this.validator = new ExtractionValidator();
    this.telemetryEvents = [];
  }

  _loadConfig() {
    try {
      const configPath = path.join(__dirname, '..', '..', 'config', 'ai-models.json');
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, 'utf8');
        const parsed = JSON.parse(raw);
        return parsed?.semanticExtraction || {};
      }
    } catch (err) {
      log.warn('Could not read ai-models.json, using defaults:', err.message);
    }
    return {
      provider: 'onnx',
      model: 'gliner2-relex',
      version: '1.0',
      modelId: 'dx111ge/gliner2-multi-v1-onnx',
      path: 'models/gliner2-relex'
    };
  }

  getAdapter() {
    if (!this.adapter) {
      const provider = (this.config.provider || 'onnx').toLowerCase();
      const modelName = (this.config.model || 'gliner2-relex').toLowerCase();

      if (provider === 'onnx' && (modelName === 'gliner2-relex' || modelName === 'gliner2')) {
        this.adapter = new GLiNER2RelexAdapter({
          modelId: this.config.modelId || 'dx111ge/gliner2-multi-v1-onnx',
          path: this.config.path || 'models/gliner2-relex',
          appDataDir: this.appDataDir
        });
      } else {
        // Extensible for future adapters (e.g. rebel, glirel, local-llm, cloud-model)
        this.adapter = new GLiNER2RelexAdapter({
          modelId: this.config.modelId || 'dx111ge/gliner2-multi-v1-onnx',
          path: this.config.path || 'models/gliner2-relex',
          appDataDir: this.appDataDir
        });
      }
    }
    return this.adapter;
  }

  async load() {
    const adapter = this.getAdapter();
    const startTime = Date.now();
    await adapter.load();
    this.emitTelemetry({
      event: 'model_loaded',
      model: adapter.modelId || 'gliner2-relex',
      provider: adapter.config?.provider || 'onnx',
      durationMs: Date.now() - startTime
    });
  }

  /**
   * Primary Semantic Extraction Entry Point
   * @param {Object} document { id, content, sourceType, metadata }
   * @param {Object} options
   * @returns {Promise<ExtractionResult>} { entities: [], relations: [], evidence: [], metadata: {} }
   */
  async extract(document, options = {}) {
    const startTime = Date.now();
    const docId = document?.id || document?.sourceFile || 'doc';

    this.emitTelemetry({
      event: 'semantic_extraction_started',
      docId,
      sourceType: document?.sourceType || 'markdown',
      contentLength: document?.content ? document.content.length : 0,
      model: this.config.model || 'gliner2-relex'
    });

    const adapter = this.getAdapter();
    if (!adapter.isLoaded) {
      await this.load().catch(() => {});
    }

    // Execute neural inference via model adapter
    const rawResult = await adapter.extract(document, options);

    // Validate result before persistence
    const validation = this.validator.validate(rawResult);

    const durationMs = Date.now() - startTime;

    // Calculate confidence distribution
    const confidences = rawResult.entities.concat(rawResult.relations).map(item => item.confidence);
    const avgConfidence = confidences.length > 0
      ? parseFloat((confidences.reduce((a, b) => a + b, 0) / confidences.length).toFixed(3))
      : 0.0;

    const finalResult = new ExtractionResult({
      entities: rawResult.entities,
      relations: rawResult.relations,
      evidence: rawResult.evidence,
      metadata: {
        event: 'semantic_extraction_completed',
        docId,
        model: adapter.modelId || this.config.model,
        entities: rawResult.entities.length,
        relations: rawResult.relations.length,
        evidenceCount: rawResult.evidence.length,
        durationMs,
        avgConfidence,
        validation
      }
    });

    this.emitTelemetry(finalResult.metadata);
    log.info(`SemanticExtractionEngine finished for '${docId}': ${finalResult.entities.length} entities, ${finalResult.relations.length} relations in ${durationMs}ms`);

    return finalResult;
  }

  emitTelemetry(eventPayload) {
    const telemetryObj = {
      timestamp: new Date().toISOString(),
      ...eventPayload
    };
    this.telemetryEvents.push(telemetryObj);
    if (this.telemetryEvents.length > 100) {
      this.telemetryEvents.shift();
    }
    log.info('[Telemetry]', JSON.stringify(telemetryObj));
  }

  getRecentTelemetry() {
    return this.telemetryEvents;
  }
}

module.exports = SemanticExtractionEngine;
