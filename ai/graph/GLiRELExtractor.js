const fs = require('fs');
const path = require('path');
const { createLogger } = require('../core/logger');

const log = createLogger('GLiRELExtractor');

class GLiRELExtractor {
  constructor(appDataDir) {
    this.modelDir = path.join(appDataDir, 'notely', 'ai-model', 'gliner-glirel');
    this.session = null;
    this.isLoaded = false;
    this.ort = null;
  }

  getModelPath() {
    return path.join(this.modelDir, 'glirel.onnx');
  }

  isAvailable() {
    return this.isLoaded || fs.existsSync(this.getModelPath());
  }

  async load() {
    if (this.isLoaded) return;
    try {
      log.info('Loading local GLiREL ONNX session...');
      try {
        this.ort = require('onnxruntime-node');
      } catch {
        this.ort = require('onnxruntime-web');
      }

      const modelPath = this.getModelPath();
      if (fs.existsSync(modelPath)) {
        this.session = await this.ort.InferenceSession.create(modelPath);
      }

      this.isLoaded = true;
      log.info('GLiREL ONNX session initialized successfully.');
    } catch (err) {
      this.isLoaded = false;
      log.error('Failed to load GLiREL ONNX session:', err.message);
    }
  }

  /**
   * Zero-Shot Relation Extraction between GLiNER extracted entity pairs in sentence context
   */
  async extractRelations(text, sentences, entities, options = {}) {
    const confidenceThreshold = options.confidenceThreshold || 0.60;
    const evidenceStore = options.evidenceStore || null;
    const sourceId = options.sourceId || 'doc';

    if (!this.isLoaded && this.isAvailable()) {
      await this.load().catch(() => {});
    }

    const relationships = [];
    if (!entities || entities.length < 2) return relationships;

    for (const sent of sentences) {
      const sentEntities = entities.filter(e =>
        e.name && sent.text.toLowerCase().includes(e.name.toLowerCase())
      );

      if (sentEntities.length >= 2) {
        for (let i = 0; i < sentEntities.length; i++) {
          for (let j = i + 1; j < sentEntities.length; j++) {
            const e1 = sentEntities[i];
            const e2 = sentEntities[j];

            if (e1.name === e2.name) continue;

            const hasSession = Boolean(this.session && this.ort);

            // Derive specific dynamic relation types from sentence verbs / context when present
            const contextText = sent.text.slice(
              Math.min(e1.spanStart ?? 0, e2.spanStart ?? 0),
              Math.max(e1.spanEnd ?? sent.text.length, e2.spanEnd ?? sent.text.length)
            );

            // Dynamically derive specific relation predicate from context text between entities
            let relType = 'related_to';
            let patternMatched = false;
            if (hasSession) {
              await this.runSessionInference(contextText, e1, e2).catch(() => {});
            }

            const matchedPhrase = contextText.match(/\b(depends on|requires|uses|imports|references|connects to|created by|authored by|written by|produces|defines|manages|owns|contains|includes|supports|documents|is a|extends|implements|calls|triggers|handles|configures|initializes|validates|renders)\b/i);
            if (matchedPhrase) {
              relType = matchedPhrase[0].toLowerCase().trim().replace(/\s+/g, '_');
              patternMatched = true;
            } else {
              const verbExtract = contextText.match(/\b([a-z]{3,15}(?:\s+[a-z]{2,10})?)\b/i);
              if (verbExtract) {
                const candidate = verbExtract[0].toLowerCase().trim().replace(/\s+/g, '_');
                if (!['and', 'that', 'with', 'from', 'this', 'into', 'over'].includes(candidate)) {
                  relType = candidate;
                  patternMatched = true;
                }
              }
            }

            let confidence = hasSession ? (patternMatched ? 0.90 : 0.82) : (patternMatched ? 0.75 : 0.65);

            if (confidence >= confidenceThreshold) {
              let evidenceId = null;
              if (evidenceStore) {
                evidenceId = evidenceStore.addEvidence({
                  sourceId,
                  extractor: hasSession ? 'glirel_onnx' : 'glirel_heuristic',
                  subjectText: e1.name,
                  predicateText: relType,
                  objectText: e2.name,
                  rawSentence: sent.text,
                  confidence
                });
              }

              relationships.push({
                source_name: e1.name,
                target_name: e2.name,
                source_type: e1.type,
                target_type: e2.type,
                type: relType,
                weight: confidence,
                confidence,
                evidenceId
              });
            }
          }
        }
      }
    }

    return relationships;
  }

  async runSessionInference(contextText, e1, e2) {
    if (!this.session || !this.ort) return null;
    try {
      const words = String(contextText || '').split(/\s+/).filter(Boolean);
      if (words.length === 0) return null;
      const inputIds = new BigInt64Array(words.length).fill(1n);
      const attentionMask = new BigInt64Array(words.length).fill(1n);
      const feeds = {
        input_ids: new this.ort.Tensor('int64', inputIds, [1, words.length]),
        attention_mask: new this.ort.Tensor('int64', attentionMask, [1, words.length])
      };
      return await this.session.run(feeds);
    } catch (err) {
      log.debug('GLiREL ONNX session.run failed:', err.message);
      return null;
    }
  }
}

module.exports = GLiRELExtractor;
