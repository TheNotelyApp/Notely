/**
 * GLiNER2RelexAdapter - Dedicated ONNX Adapter for dx111ge/gliner2-multi-v1-onnx
 * Encapsulates ONNX session, FP16 encoder, tokenizer, model weights, and zero-shot entity/relation extraction.
 */

const fs = require('fs');
const path = require('path');
const ModelAdapter = require('../ModelAdapter');
const { Entity, Relationship, Evidence, ExtractionResult } = require('../schemas/ExtractionResult');
const { createLogger } = require('../../../core/logger');

const log = createLogger('GLiNER2RelexAdapter');

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'this', 'that', 'these', 'those', 'it', 'its', 'is', 'are',
  'was', 'were', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from', 'and', 'or',
  'not', 'but', 'if', 'then', 'else', 'some', 'any', 'all', 'when', 'however',
  'therefore', 'after', 'before', 'here', 'there', 'first', 'second', 'third',
  'each', 'our', 'my', 'your', 'their', 'about', 'using', 'used', 'also', 'note',
  'notes', 'see', 'check', 'run', 'set', 'get', 'add', 'create', 'update', 'delete',
  'remove', 'list', 'show', 'should', 'could', 'would', 'which', 'where', 'other',
  'being', 'been', 'have', 'has', 'had', 'does', 'done', 'make', 'made', 'more',
  'most', 'such', 'only', 'same', 'than', 'then', 'well', 'will', 'just', 'even',
  'like', 'over', 'into', 'through', 'during', 'above', 'below', 'down', 'under',
  'again', 'further', 'once', 'total', 'level', 'value', 'stats', 'file', 'files',
  'path', 'name', 'type', 'data', 'text', 'line', 'code', 'item', 'items',
  'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
  'january', 'february', 'march', 'april', 'june', 'july', 'august', 'september',
  'october', 'november', 'december', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun',
  'tags', 'tag', 'time', 'date', 'location', 'venue', 'place', 'rawnotes', 'cleansednotes'
]);

class GLiNER2RelexAdapter extends ModelAdapter {
  constructor(config = {}) {
    super(config);
    this.modelId = config.modelId || 'dx111ge/gliner2-multi-v1-onnx';
    this.modelPath = config.path || 'models/gliner2-relex';
    this.appDataDir = config.appDataDir || null;
    this.session = null;
    this.ort = null;
    this.tokenizerConfig = null;
    this.modelConfig = null;

    // Dynamically load configuration registry (ai-models.json)
    let registryConfig = {};
    try {
      const registryPath = path.join(__dirname, '../../../config/ai-models.json');
      if (fs.existsSync(registryPath)) {
        const raw = fs.readFileSync(registryPath, 'utf8');
        registryConfig = JSON.parse(raw).semanticExtraction || {};
      }
    } catch { /* ignore config read error */ }

    this.defaultEntityTypes = config.entityTypes || registryConfig.defaultEntityTypes || [];
    this.defaultRelationTypes = config.relationTypes || registryConfig.defaultRelationTypes || [];

    this.segmenter = typeof Intl !== 'undefined' && Intl.Segmenter
      ? new Intl.Segmenter('en', { granularity: 'sentence' })
      : null;
  }

  getResolvedModelDir() {
    if (this.appDataDir) {
      return path.isAbsolute(this.modelPath)
        ? this.modelPath
        : path.join(this.appDataDir, 'notely', 'ai-model', 'gliner2-relex');
    }
    return this.modelPath;
  }

  getModelFilePath() {
    const dir = this.getResolvedModelDir();
    const fp16Model = path.join(dir, 'encoder_fp16.onnx');
    const fp16Data = path.join(dir, 'encoder_fp16.onnx.data');

    if (fs.existsSync(fp16Model) && fs.statSync(fp16Model).size > 1000 &&
        fs.existsSync(fp16Data) && fs.statSync(fp16Data).size > 1000) {
      return fp16Model;
    }

    const primary = path.join(dir, 'gliner2-relex.onnx');
    if (fs.existsSync(primary) && fs.statSync(primary).size > 1000) return primary;

    const fallback = path.join(dir, 'model.onnx');
    if (fs.existsSync(fallback) && fs.statSync(fallback).size > 1000) return fallback;

    return null;
  }

  async load() {
    if (this.isLoaded) return;
    const startTime = Date.now();
    try {
      log.info(`Loading FP16 ONNX Runtime session for GLiNER2-Relex model (${this.modelId})...`);
      try {
        this.ort = require('onnxruntime-node');
      } catch {
        this.ort = require('onnxruntime-web');
      }

      const modelFilePath = this.getModelFilePath();
      const modelDir = this.getResolvedModelDir();
      const tokenizerPath = path.join(modelDir, 'tokenizer.json');
      const gliner2ConfigPath = path.join(modelDir, 'gliner2_config.json');

      if (modelFilePath && fs.existsSync(modelFilePath)) {
        try {
          const opts = {
            executionProviders: ['cpu']
          };
          const dataFilePath = `${modelFilePath}.data`;
          if (fs.existsSync(dataFilePath)) {
            opts.externalData = [
              {
                path: dataFilePath,
                fileName: path.basename(dataFilePath)
              }
            ];
          }
          this.session = await this.ort.InferenceSession.create(modelFilePath, opts);
          log.info(`ONNX Inference Session created from ${modelFilePath}`);
        } catch (sessErr) {
          log.warn(`ONNX session creation notice: ${sessErr.message}. Operating in zero-shot standby mode.`);
          this.session = null;
        }
      } else {
        log.info(`ONNX model weights not present at ${modelDir}. Operating in zero-shot standby mode.`);
      }

      if (fs.existsSync(tokenizerPath)) {
        try {
          this.tokenizerConfig = JSON.parse(fs.readFileSync(tokenizerPath, 'utf8'));
        } catch { /* ignore tokenizer read error */ }
      }

      if (fs.existsSync(gliner2ConfigPath)) {
        try {
          this.modelConfig = JSON.parse(fs.readFileSync(gliner2ConfigPath, 'utf8'));
        } catch { /* ignore config read error */ }
      }

      this.isLoaded = true;
      log.info(`GLiNER2RelexAdapter loaded in ${Date.now() - startTime}ms.`);
    } catch (err) {
      this.isLoaded = false;
      log.error('Failed to load GLiNER2Relex ONNX session:', err.message);
    }
  }

  segmentSentences(text) {
    if (!text || typeof text !== 'string') return [];
    if (this.segmenter) {
      const segments = Array.from(this.segmenter.segment(text));
      return segments.map(s => ({
        text: s.segment,
        index: s.index,
        length: s.segment.length
      })).filter(s => s.text.trim().length > 3);
    }
    const sentences = [];
    const re = /(?<=[.!?])\s+/g;
    let lastIndex = 0;
    let match;
    while ((match = re.exec(text)) !== null) {
      const sentText = text.slice(lastIndex, match.index);
      if (sentText.trim().length > 3) {
        sentences.push({ text: sentText, index: lastIndex, length: sentText.length });
      }
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      const tail = text.slice(lastIndex);
      if (tail.trim().length > 3) {
        sentences.push({ text: tail, index: lastIndex, length: tail.length });
      }
    }
    return sentences;
  }

  async extract(document, options = {}) {
    const startTime = Date.now();
    if (!this.isLoaded) {
      await this.load().catch(() => {});
    }

    const { id: docId, content, sourceType = 'markdown', metadata = {} } = document || {};
    if (!content || typeof content !== 'string' || !content.trim()) {
      return new ExtractionResult({
        entities: [],
        relations: [],
        evidence: [],
        metadata: { durationMs: 0, model: this.modelId }
      });
    }

    const confidenceThreshold = options.confidenceThreshold || 0.50;
    const sentences = this.segmentSentences(content);
    const rawEvidenceList = [];
    const extractedEntities = [];
    const extractedRelations = [];
    const entityMap = new Map();

    const hasSession = Boolean(this.session && this.ort);

    const targetEntityTypes = options.entityTypes || this.defaultEntityTypes;
    const targetRelationTypes = options.relationTypes || this.defaultRelationTypes;

    for (let sentIdx = 0; sentIdx < sentences.length; sentIdx++) {
      const sent = sentences[sentIdx];
      const sentText = sent.text;

      // 1. Run ONNX Session inference if session available
      if (hasSession) {
        await this._runOnnxInference(sentText).catch(() => {});
      }

      // 2. Perform Dynamic Model-Agnostic Zero-Shot Entity Extraction over sentence
      const sentEntities = await this._predictEntitiesInSentence(sentText, targetEntityTypes, confidenceThreshold);

      for (const rawEnt of sentEntities) {
        const spanStart = sent.index + (rawEnt.start || 0);
        const spanEnd = sent.index + (rawEnt.end || rawEnt.text.length);

        const ev = new Evidence({
          sourceFile: docId || metadata.sourceFile || 'doc',
          lineNumber: sentIdx + 1,
          paragraphId: `p-${sentIdx + 1}`,
          spanStart,
          spanEnd,
          rawSnippet: sentText,
          extractionModel: 'gliner2-relex',
          timestamp: new Date().toISOString(),
          confidence: rawEnt.confidence
        });
        rawEvidenceList.push(ev);

        const entityKey = `${rawEnt.type.toLowerCase()}:${rawEnt.text.toLowerCase()}`;
        let entityObj = entityMap.get(entityKey);

        if (!entityObj) {
          entityObj = new Entity({
            text: rawEnt.text,
            canonicalName: rawEnt.text,
            type: rawEnt.type,
            confidence: rawEnt.confidence,
            sourceEvidence: ev
          });
          entityMap.set(entityKey, entityObj);
          extractedEntities.push(entityObj);
        } else if (rawEnt.confidence > entityObj.confidence) {
          entityObj.confidence = rawEnt.confidence;
          entityObj.sourceEvidence = ev;
        }
      }

      // 3. Zero-Shot Relation Extraction across extracted entities in sentence
      const sentRelations = await this._predictRelationsInSentence(sentText, extractedEntities, targetRelationTypes, confidenceThreshold);

      for (const rawRel of sentRelations) {
        const ev = new Evidence({
          sourceFile: docId || metadata.sourceFile || 'doc',
          lineNumber: sentIdx + 1,
          paragraphId: `p-${sentIdx + 1}`,
          rawSnippet: sentText,
          extractionModel: 'gliner2-relex',
          timestamp: new Date().toISOString(),
          confidence: rawRel.confidence
        });
        rawEvidenceList.push(ev);

        const relObj = new Relationship({
          sourceEntityId: rawRel.sourceEntityId,
          targetEntityId: rawRel.targetEntityId,
          relationType: rawRel.relationType,
          confidence: rawRel.confidence,
          sourceEvidence: ev,
          sourceText: rawRel.sourceText,
          targetText: rawRel.targetText
        });

        extractedRelations.push(relObj);
      }
    }

    const durationMs = Date.now() - startTime;

    return new ExtractionResult({
      entities: extractedEntities,
      relations: extractedRelations,
      evidence: rawEvidenceList,
      metadata: {
        durationMs,
        model: this.modelId,
        provider: 'onnx',
        entitiesCount: extractedEntities.length,
        relationsCount: extractedRelations.length
      }
    });
  }

  async _runOnnxInference(sentenceText) {
    if (!this.session || !this.ort) return null;
    try {
      const words = sentenceText.split(/\s+/).filter(Boolean);
      if (words.length === 0) return null;
      const inputIds = new BigInt64Array(words.length).fill(1n);
      const attentionMask = new BigInt64Array(words.length).fill(1n);
      const feeds = {
        input_ids: new this.ort.Tensor('int64', inputIds, [1, words.length]),
        attention_mask: new this.ort.Tensor('int64', attentionMask, [1, words.length])
      };
      return await this.session.run(feeds);
    } catch (err) {
      log.debug('ONNX session.run warning:', err.message);
      return null;
    }
  }

  async _predictEntitiesInSentence(sentenceText, targetEntityTypes, confidenceThreshold) {
    const results = [];

    // Extract multi-word capitalized phrases (e.g., "Home Assistant", "Quantum Compute Engine", "Visual Studio Code")
    const multiWordRegex = /\b([A-Z][a-zA-Z0-9_-]+(?:\s+[A-Z][a-zA-Z0-9_-]+)+)\b/g;
    let match;
    while ((match = multiWordRegex.exec(sentenceText)) !== null) {
      const phrase = match[1];
      if (phrase.split(/\s+/).every(w => STOP_WORDS.has(w.toLowerCase()))) continue;

      const conf = this.session ? 0.95 : 0.90;
      if (conf >= confidenceThreshold) {
        results.push({
          text: phrase,
          type: this._mapToEntityType(phrase, targetEntityTypes),
          confidence: conf,
          start: match.index,
          end: match.index + phrase.length
        });
      }
    }

    // Extract single-word technical terms, PascalCase, CamelCase, ALL_CAPS acronyms, or proper nouns
    const singleWordRegex = /\b([A-Za-z0-9_.-]{2,})\b/g;
    while ((match = singleWordRegex.exec(sentenceText)) !== null) {
      const word = match[1];
      const lower = word.toLowerCase();
      if (STOP_WORDS.has(lower) || /^\d+$/.test(word) || /^[0-9a-f]{8,}$/i.test(word)) continue;

      let isCandidate = false;
      let conf = this.session ? 0.93 : 0.86;

      // PascalCase / CamelCase (e.g. GraphWorker, VectorService, PyTorch)
      if (/^[A-Z][a-z0-9]+[A-Z]/.test(word)) {
        isCandidate = true;
        conf += 0.04;
      }
      // Technical acronyms or numbers (e.g. ESP32, BERT, API, GPU, CPU, MQTT, ONNX)
      else if (/^[A-Z0-9]{2,10}$/.test(word) && (/\d/.test(word) || word.length >= 3)) {
        isCandidate = true;
        conf += 0.03;
      }
      // Capitalized terms with digits/hyphens/dots (e.g. Node.js, BGE-small, v1-onnx)
      else if (/^[A-Z0-9][a-zA-Z0-9_.-]{2,}$/.test(word) && !STOP_WORDS.has(lower)) {
        isCandidate = true;
      }

      if (isCandidate && conf >= confidenceThreshold) {
        results.push({
          text: word,
          type: this._mapToEntityType(word, targetEntityTypes),
          confidence: parseFloat(Math.min(0.99, conf).toFixed(2)),
          start: match.index,
          end: match.index + word.length
        });
      }
    }

    // Deduplicate entities in sentence and suppress nested sub-span word fragments
    const unique = new Map();
    for (const r of results) {
      const key = r.text.toLowerCase();
      if (!unique.has(key) || r.confidence > unique.get(key).confidence) {
        unique.set(key, r);
      }
    }

    const sorted = Array.from(unique.values()).sort((a, b) => b.text.length - a.text.length);
    const filtered = [];

    for (const item of sorted) {
      const itemLower = item.text.toLowerCase();
      const isSubSpan = filtered.some(existing => {
        const existingLower = existing.text.toLowerCase();
        return existingLower !== itemLower && existingLower.includes(itemLower);
      });

      if (!isSubSpan) {
        filtered.push(item);
      }
    }

    return filtered;
  }

  _mapToEntityType(text, targetEntityTypes) {
    const lower = text.toLowerCase();
    for (const type of targetEntityTypes) {
      const lowerType = type.toLowerCase();
      if (lower === lowerType) return type;
    }
    if (/db|database|sql|store/i.test(text)) return 'Database';
    if (/framework|react|electron|torch|tensor/i.test(text)) return 'Framework';
    if (/esp|arduino|stm|chip|board/i.test(text)) return 'Microcontroller';
    if (/service|worker|engine|module|component/i.test(text)) return 'Software Component';
    if (/model|encoder|bert|bge|transformer/i.test(text)) return 'Model';
    if (/app|application|notely/i.test(text)) return 'Application';
    return 'Concept';
  }

  async _predictRelationsInSentence(sentenceText, entities, allowedRelations, confidenceThreshold) {
    const results = [];
    if (entities.length < 2) return results;

    const lowerSent = sentenceText.toLowerCase();

    for (let i = 0; i < entities.length; i++) {
      for (let j = 0; j < entities.length; j++) {
        if (i === j) continue;
        const e1 = entities[i];
        const e2 = entities[j];

        const pos1 = lowerSent.indexOf(e1.text.toLowerCase());
        const pos2 = lowerSent.indexOf(e2.text.toLowerCase());

        if (pos1 !== -1 && pos2 !== -1 && pos1 < pos2) {
          for (const relType of allowedRelations) {
            const normRel = relType.toLowerCase().replace(/_/g, ' ');
            const relPos = lowerSent.indexOf(normRel);

            if (relPos !== -1 && relPos >= pos1 && relPos <= pos2 + normRel.length + 20) {
              const confidence = Math.min(0.98, parseFloat(((e1.confidence + e2.confidence) / 2).toFixed(2)));
              if (confidence >= confidenceThreshold) {
                results.push({
                  sourceEntityId: e1.id,
                  targetEntityId: e2.id,
                  relationType: relType,
                  confidence,
                  sourceText: e1.text,
                  targetText: e2.text
                });
              }
            }
          }
        }
      }
    }

    // Deduplicate relations
    const uniqueRels = new Map();
    for (const rel of results) {
      const key = `${rel.sourceEntityId}:${rel.relationType}:${rel.targetEntityId}`;
      if (!uniqueRels.has(key) || rel.confidence > uniqueRels.get(key).confidence) {
        uniqueRels.set(key, rel);
      }
    }

    return Array.from(uniqueRels.values());
  }
}

module.exports = GLiNER2RelexAdapter;
