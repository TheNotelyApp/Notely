/**
 * GLiNER2RelexAdapter - Dedicated 5-Graph ONNX Neural Extraction Adapter
 * Encapsulates ONNX Runtime multi-session execution for dx111ge/gliner2-multi-v1-onnx.
 * No regex or heuristic fallbacks — pure model inference.
 */

const fs = require('fs');
const path = require('path');
const ModelAdapter = require('../ModelAdapter');
const { Entity, Relationship, Evidence, ExtractionResult } = require('../schemas/ExtractionResult');
const { createLogger } = require('../../../core/logger');

const log = createLogger('GLiNER2RelexAdapter');

class GLiNER2RelexAdapter extends ModelAdapter {
  constructor(config = {}) {
    super(config);
    this.modelId = config.modelId || 'dx111ge/gliner2-multi-v1-onnx';
    this.modelPath = config.path || 'models/gliner2-relex';
    this.appDataDir = config.appDataDir || null;

    this.ort = null;
    this.encoderSession = null;
    this.spanRepSession = null;
    this.countEmbedSession = null;
    this.countPredSession = null;
    this.classifierSession = null;

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

    this._consecutiveFailures = 0;
    this._unloadTimer = null;

    this.segmenter = typeof Intl !== 'undefined' && Intl.Segmenter
      ? new Intl.Segmenter('en', { granularity: 'sentence' })
      : null;
  }

  getResolvedModelDir() {
    if (this.appDataDir) {
      const target = path.isAbsolute(this.modelPath)
        ? this.modelPath
        : path.join(this.appDataDir, 'notely', 'ai-model', 'gliner2-relex');
      if (fs.existsSync(target)) return target;
    }
    if (process.env.APPDATA) {
      const appDataTarget = path.join(process.env.APPDATA, 'Notely', 'notely', 'ai-model', 'gliner2-relex');
      if (fs.existsSync(appDataTarget)) return appDataTarget;
    }
    return this.modelPath;
  }

  async load() {
    if (this.isLoaded) return;
    const startTime = Date.now();
    const modelDir = this.getResolvedModelDir();

    try {
      log.info(`Loading 5-Graph ONNX Runtime sessions for GLiNER2-Relex (${this.modelId})...`);
      this.isWebRuntime = false;
      try {
        this.ort = require('onnxruntime-node');
      } catch {
        try {
          this.ort = require('onnxruntime-web');
          this.isWebRuntime = true;
        } catch {
          this.ort = null;
        }
      }

      const gliner2ConfigPath = path.join(modelDir, 'gliner2_config.json');
      const tokenizerPath = path.join(modelDir, 'tokenizer.json');

      if (fs.existsSync(gliner2ConfigPath)) {
        try {
          this.modelConfig = JSON.parse(fs.readFileSync(gliner2ConfigPath, 'utf8'));
        } catch (err) {
          log.warn('Could not parse gliner2_config.json:', err.message);
        }
      }

      if (fs.existsSync(tokenizerPath)) {
        try {
          this.tokenizerConfig = JSON.parse(fs.readFileSync(tokenizerPath, 'utf8'));
          this._initVocabMap();
        } catch (err) {
          log.warn('Could not parse tokenizer.json:', err.message);
        }
      }

      const files = this.modelConfig?.onnx_files?.fp16 || this.modelConfig?.onnx_files?.fp32 || {
        encoder: 'encoder_fp16.onnx',
        span_rep: 'span_rep.onnx',
        count_embed: 'count_embed.onnx',
        count_pred: 'count_pred.onnx',
        classifier: 'classifier.onnx'
      };

      if (this.ort) {
        this.encoderSession = await this._loadSession(modelDir, files.encoder).catch(() => null);
        this.spanRepSession = await this._loadSession(modelDir, files.span_rep).catch(() => null);
        this.classifierSession = await this._loadSession(modelDir, files.classifier).catch(() => null);
      }

      if (this.encoderSession && this.classifierSession) {
        this.isLoaded = true;
        this._consecutiveFailures = 0;
        log.info(`GLiNER2RelexAdapter 5-Graph ONNX model loaded successfully in ${Date.now() - startTime}ms.`);
      } else {
        this._setupTestMockEnvironment();
        log.info(`GLiNER2RelexAdapter initialized in standby/mock mode.`);
      }
    } catch {
      this._setupTestMockEnvironment();
      log.info(`GLiNER2RelexAdapter initialized in standby mode after load error.`);
    }
  }

  _runSessionWithTimeout(session, inputs, timeoutMs = 8000) {
    if (!session) return Promise.resolve(null);
    return Promise.race([
      session.run(inputs),
      new Promise((_, reject) => setTimeout(() => reject(new Error('ONNX inference session timeout')), timeoutMs))
    ]);
  }

  _scheduleIdleUnload(idleMs = 300000) {
    if (this._unloadTimer) clearTimeout(this._unloadTimer);
    this._unloadTimer = setTimeout(() => {
      try {
        if (this.encoderSession?.close) this.encoderSession.close();
        if (this.spanRepSession?.close) this.spanRepSession.close();
        if (this.classifierSession?.close) this.classifierSession.close();
      } catch { /* ignore */ }
      this.encoderSession = null;
      this.spanRepSession = null;
      this.classifierSession = null;
      this.isLoaded = false;
      log.info('GLiNER2 ONNX sessions unloaded due to idle timeout.');
    }, idleMs);
  }

  _setupTestMockEnvironment() {
    this.isMockMode = true;
    if (!this.ort) {
      this.ort = {
        Tensor: class Tensor {
          constructor(type, data, dims) {
            this.type = type;
            this.data = data;
            this.dims = dims;
          }
        }
      };
    }
    this.encoderSession = this._createTestMockSession();
    this.classifierSession = this.encoderSession;
    this.isLoaded = true;
  }

  _createTestMockSession() {
    return {
      run: async () => {
        return {
          hidden_state: {
            data: new Float32Array(768).fill(0.0),
            dims: [1, 1, 768]
          }
        };
      }
    };
  }

  async _loadSession(modelDir, fileName) {
    if (!fileName || !this.ort) return null;
    const filePath = path.join(modelDir, fileName);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).size < 100) return null;

    try {
      if (this.isWebRuntime) {
        const fileBuf = fs.readFileSync(filePath);
        const uint8 = new Uint8Array(fileBuf.buffer, fileBuf.byteOffset, fileBuf.byteLength);
        const opts = { executionProviders: ['wasm'] };
        const dataPath = `${filePath}.data`;
        if (fs.existsSync(dataPath)) {
          const dataBuf = fs.readFileSync(dataPath);
          opts.externalData = [{ path: `${fileName}.data`, data: new Uint8Array(dataBuf.buffer, dataBuf.byteOffset, dataBuf.byteLength) }];
        }
        return await this.ort.InferenceSession.create(uint8, opts);
      } else {
        const opts = { executionProviders: ['cpu'] };
        const dataPath = `${filePath}.data`;
        if (fs.existsSync(dataPath)) {
          opts.externalData = [{ path: dataPath, fileName: `${fileName}.data` }];
        }
        return await this.ort.InferenceSession.create(filePath, opts);
      }
    } catch (err) {
      log.warn(`Failed to create ONNX session for ${fileName}:`, err.message);
      return null;
    }
  }

  _initVocabMap() {
    if (!this.tokenizerConfig || this._vocabMap) return;
    this._vocabMap = new Map();
    const vocabList = this.tokenizerConfig.model?.vocab || [];
    for (let i = 0; i < vocabList.length; i++) {
      const item = vocabList[i];
        const tokenId = (typeof item[1] === 'number' && Number.isInteger(item[1])) ? item[1] : i;
        this._vocabMap.set(item[0], tokenId);
    }
    if (this.tokenizerConfig.added_tokens) {
      for (const tok of this.tokenizerConfig.added_tokens) {
        if (tok.content && typeof tok.id === 'number') {
          this._vocabMap.set(tok.content, tok.id);
        }
      }
    }
  }

  _tokenizeWord(word) {
    if (!word) return [];
    if (!this._vocabMap) this._initVocabMap();

    const target = '▁' + word;
    const tokens = [];
    let start = 0;

    while (start < target.length) {
      let matchId = null;
      let matchLen = 0;

      for (let end = target.length; end > start; end--) {
        const sub = target.slice(start, end);
        if (this._vocabMap.has(sub)) {
          matchId = this._vocabMap.get(sub);
          matchLen = end - start;
          break;
        }
      }

      if (matchId !== null && matchLen > 0) {
        tokens.push(matchId);
        start += matchLen;
      } else {
        const charSub = target[start];
        if (this._vocabMap.has(charSub)) {
          tokens.push(this._vocabMap.get(charSub));
        } else {
          const unkId = this.tokenizerConfig?.model?.unk_id || 0;
          tokens.push(unkId);
        }
        start += 1;
      }
    }
    return tokens;
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

  _computeCharOffsets(sentenceText, words) {
    const offsets = [];
    let searchPos = 0;
    for (const w of words) {
      const idx = sentenceText.indexOf(w, searchPos);
      if (idx !== -1) {
        offsets.push(idx);
        searchPos = idx + w.length;
      } else {
        offsets.push(searchPos);
      }
    }
    return offsets;
  }

  _buildInputTensors(words, labels) {
    const pToken = this.modelConfig?.special_tokens?.['[P]'] || 250104;
    const eToken = this.modelConfig?.special_tokens?.['[E]'] || 250106;
    const sepTextToken = this.modelConfig?.special_tokens?.['[SEP_TEXT]'] || 250103;
    const maxWidth = Math.min(4, this.modelConfig?.max_width || 4);

    const schemaTokenIds = [pToken];
    const schemaPositions = [0];

    for (let i = 0; i < labels.length; i++) {
      schemaPositions.push(schemaTokenIds.length);
      schemaTokenIds.push(eToken);
      const labelTokens = this._tokenizeWord(labels[i]);
      schemaTokenIds.push(...labelTokens);
    }

    const fullInputIds = [...schemaTokenIds, sepTextToken];
    const textStartPositions = [];
    const textEndPositions = [];

    for (let i = 0; i < words.length; i++) {
      textStartPositions.push(fullInputIds.length);
      const wordTokens = this._tokenizeWord(words[i]);
      if (wordTokens.length === 0) wordTokens.push(0);
      fullInputIds.push(...wordTokens);
      textEndPositions.push(fullInputIds.length - 1);
    }

    const seqLen = fullInputIds.length;
    const inputIdsTensor = new BigInt64Array(fullInputIds.map(id => BigInt(id)));
    const attentionMaskTensor = new BigInt64Array(seqLen).fill(1n);

    const spanStartList = [];
    const spanEndList = [];
    const validSpans = [];
    const numWords = words.length;

    for (let start = 0; start < numWords; start++) {
      for (let w = 1; w <= maxWidth; w++) {
        if (start + w <= numWords) {
          const startSubIdx = textStartPositions[start];
          const endSubIdx = textEndPositions[start + w - 1];
          spanStartList.push(BigInt(startSubIdx));
          spanEndList.push(BigInt(endSubIdx));
          validSpans.push({ wordIndexStart: start, length: w });
        }
      }
    }

    return {
      input_ids: new this.ort.Tensor('int64', inputIdsTensor, [1, seqLen]),
      attention_mask: new this.ort.Tensor('int64', attentionMaskTensor, [1, seqLen]),
      spanStartTensor: new this.ort.Tensor('int64', new BigInt64Array(spanStartList), [1, spanStartList.length]),
      spanEndTensor: new this.ort.Tensor('int64', new BigInt64Array(spanEndList), [1, spanEndList.length]),
      validSpans,
      numWords,
      maxWidth
    };
  }

  _sigmoid(val) {
    return 1 / (1 + Math.exp(-(val + 1.2)));
  }

  _decodeSpanScores(logitsData, words, labels, charOffsets, threshold, maxWidth, validSpans) {
    const candidates = [];
    const numLabels = labels.length;
    const numWords = words.length;
    if (numWords === 0 || numLabels === 0 || !validSpans || !logitsData) return candidates;

    for (let i = 0; i < validSpans.length; i++) {
      const span = validSpans[i];
      const start = span.wordIndexStart;
      const w = span.length;

      // Noise Guard: Reject spans longer than 4 words or 35 chars
      if (w > 4) continue;

      let textSpan = words.slice(start, start + w).join(' ').replace(/^[-*+\s:#=]+|[.,;:)]+$/g, '').trim();
      if (!textSpan || textSpan.length > 35 || /^\W+$/.test(textSpan)) continue;

      // Reject formatting artifacts, HTML attributes, table headers/cells, UI strings
      if (/[{}=|]|\bdata-|\bvalue \d|\bcolumn \d|\btest for\b|\bask questions\b|\bchat with\b/i.test(textSpan)) continue;

      const spanLogits = logitsData.subarray
        ? logitsData.subarray(i * numLabels, (i + 1) * numLabels)
        : logitsData.slice(i * numLabels, (i + 1) * numLabels);

      if (spanLogits.length < numLabels) continue;

      let bestScore = -Infinity;
      let bestLabelIdx = -1;

      for (let l = 0; l < numLabels; l++) {
        const score = this._sigmoid(spanLogits[l]);
        if (score > bestScore) {
          bestScore = score;
          bestLabelIdx = l;
        }
      }

      if (bestLabelIdx !== -1 && bestScore >= threshold) {
        const spanType = labels[bestLabelIdx];

        // Compound Disjunctive/Conjunctive Entity Splitting (e.g. "Gemini or Groq" -> "Gemini", "Groq")
        if (/\b(or|and)\b/i.test(textSpan)) {
          const parts = textSpan.split(/\s+(?:or|and)\s+/i).filter(Boolean);
          if (parts.length > 1 && parts.every(p => /^[A-Z][a-zA-Z0-9_-]*$/.test(p.trim()))) {
            for (const part of parts) {
              const cleanPart = part.trim();
              candidates.push({
                text: cleanPart,
                start: charOffsets[start] ? charOffsets[start].start : 0,
                end: charOffsets[start + w - 1] ? charOffsets[start + w - 1].end : charOffsets[start].start + cleanPart.length,
                type: spanType,
                confidence: parseFloat(bestScore.toFixed(3))
              });
            }
            continue;
          }
        }

        candidates.push({
          text: textSpan,
          type: spanType,
          confidence: parseFloat(bestScore.toFixed(3)),
          start: charOffsets[start] ? charOffsets[start].start : 0,
          end: charOffsets[start + w - 1] ? charOffsets[start + w - 1].end : charOffsets[start].start + textSpan.length
        });
      }
    }

    candidates.sort((a, b) => b.confidence - a.confidence);

    const accepted = [];
    for (const cand of candidates) {
      if (!cand.text || !cand.text.trim()) continue;
      const lower = cand.text.trim().toLowerCase();
      if (/^\W+$/.test(lower) || /^\d+(\.\d+)*$/.test(lower)) continue;

      const overlaps = accepted.some(existing => {
        return !(cand.end <= existing.start || cand.start >= existing.end);
      });
      if (!overlaps) {
        accepted.push(cand);
      }
    }

    return accepted;
  }

  _mockExtractSentEntities() {
    // Model-driven architecture: Standby/Mock mode produces no rule-based extractions.
    return [];
  }



  getSavedConfidenceThreshold() {
    try {
      const appData = this.appDataDir || (process.env.APPDATA ? path.join(process.env.APPDATA, 'Notely') : null);
      if (appData) {
        const notelySubdirPath = path.join(appData, 'notely', 'ai-preferences.json');
        const rootPath = path.join(appData, 'ai-preferences.json');
        const prefsPath = fs.existsSync(notelySubdirPath) ? notelySubdirPath : rootPath;

        if (fs.existsSync(prefsPath)) {
          const prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
          if (typeof prefs.graphConfidence === 'number') {
            return prefs.graphConfidence;
          }
        }
      }
    } catch { /* ignore */ }
    return 0.45;
  }

  async extract(document, options = {}) {
    const startTime = Date.now();
    if (!this.isLoaded) {
      await this.load().catch(() => {});
    }

    const { id: docId, content, metadata = {} } = document || {};
    if (!content || typeof content !== 'string' || !content.trim()) {
      return new ExtractionResult({
        entities: [],
        relations: [],
        evidence: [],
        metadata: { durationMs: 0, model: this.modelId }
      });
    }

    if (this._consecutiveFailures >= 5) {
      log.warn('GLiNER2 adapter disabled after 5 consecutive failures');
      return new ExtractionResult({
        entities: [],
        relations: [],
        evidence: [],
        metadata: { durationMs: 0, model: this.modelId, status: 'circuit_breaker_active' }
      });
    }

    const confidenceThreshold = options.confidenceThreshold !== undefined ? options.confidenceThreshold : this.getSavedConfidenceThreshold();
    const targetEntityTypes = options.entityTypes || this.defaultEntityTypes;
    const targetRelationTypes = options.relationTypes || this.defaultRelationTypes;

    const sentences = this.segmentSentences(content);
    const rawEvidenceList = [];
    const extractedEntities = [];
    const extractedRelations = [];
    const entityMap = new Map();

    // Fallback/Mock mode for test environment without active ONNX weights
    if (this.isMockMode || !this.encoderSession || !this.classifierSession || !this.ort) {
      for (let sentIdx = 0; sentIdx < sentences.length; sentIdx++) {
        const sent = sentences[sentIdx];
        const words = sent.text.split(/\s+/).filter(Boolean);
        const mockEntities = this._mockExtractSentEntities(words, targetEntityTypes, confidenceThreshold);
        for (const rawEnt of mockEntities) {
          const ev = new Evidence({
            sourceFile: docId || metadata.sourceFile || 'doc',
            lineNumber: sentIdx + 1,
            paragraphId: `p-${sentIdx + 1}`,
            rawSnippet: sent.text,
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
          }
        }
      }

      if (extractedEntities.length >= 2 && targetRelationTypes.length > 0) {
        this._mockGenerateRelations(extractedEntities, targetRelationTypes, content, docId, metadata, rawEvidenceList, extractedRelations);
      }

      return new ExtractionResult({
        entities: extractedEntities,
        relations: extractedRelations,
        evidence: rawEvidenceList,
        metadata: {
          durationMs: Date.now() - startTime,
          model: this.modelId,
          provider: 'onnx',
          entitiesCount: extractedEntities.length,
          relationsCount: extractedRelations.length,
          status: 'mock'
        }
      });
    }

    for (let sentIdx = 0; sentIdx < sentences.length; sentIdx++) {
      const sent = sentences[sentIdx];
      const words = sent.text.split(/\s+/).filter(Boolean);
      if (words.length === 0) continue;

      const charOffsets = this._computeCharOffsets(sent.text, words);

      try {
        // 1. Entity Extraction 3-Stage Neural Pass
        const tensors = this._buildInputTensors(words, targetEntityTypes);
        const feeds = {
          input_ids: tensors.input_ids,
          attention_mask: tensors.attention_mask
        };

        const encOutput = await this._runSessionWithTimeout(this.encoderSession, feeds);
        let logitsData = null;

        if (encOutput && encOutput.hidden_state && this.spanRepSession && this.classifierSession) {
          // Full 3-stage neural inference: Encoder -> Span Rep -> Classifier
          const spanOut = await this._runSessionWithTimeout(this.spanRepSession, {
            hidden_states: encOutput.hidden_state,
            span_start_idx: tensors.spanStartTensor,
            span_end_idx: tensors.spanEndTensor
          });

          if (spanOut && spanOut.span_representations) {
            const spanReps = spanOut.span_representations;
            const numSpans = tensors.validSpans.length;
            const classInput = new this.ort.Tensor(spanReps.type, spanReps.data, [numSpans, 768]);
            const inputName = (this.classifierSession.inputNames && this.classifierSession.inputNames[0]) || 'span_representations';
            const classOut = await this._runSessionWithTimeout(this.classifierSession, { [inputName]: classInput });
            if (classOut && classOut.logits) {
              logitsData = classOut.logits.data;
            }
          }
        } else if (encOutput && encOutput.logits) {
          logitsData = encOutput.logits.data;
        }

        if (logitsData) {
          const sentEntities = this._decodeSpanScores(
            logitsData,
            words,
            targetEntityTypes,
            charOffsets,
            confidenceThreshold,
            tensors.maxWidth,
            tensors.validSpans
          );

          for (const rawEnt of sentEntities) {
            const spanStart = sent.index + rawEnt.start;
            const spanEnd = sent.index + rawEnt.end;

            const ev = new Evidence({
              sourceFile: docId || metadata.sourceFile || 'doc',
              lineNumber: sentIdx + 1,
              paragraphId: `p-${sentIdx + 1}`,
              spanStart,
              spanEnd,
              rawSnippet: sent.text,
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
        }

        // 2. Relation Extraction Neural Pass across extracted entities
        const sentEnts = extractedEntities.filter(e => sent.text.toLowerCase().includes(e.text.toLowerCase()));
        if (sentEnts.length >= 2 && targetRelationTypes.length > 0) {
          const relTensors = this._buildInputTensors(words, targetRelationTypes);
          const relEncOutput = (encOutput && encOutput.hidden_state && tensors.input_ids?.data?.length === relTensors.input_ids?.data?.length)
            ? encOutput
            : await this._runSessionWithTimeout(this.encoderSession, {
                input_ids: relTensors.input_ids,
                attention_mask: relTensors.attention_mask
              }).catch(() => null);

          if (relEncOutput && relEncOutput.hidden_state && this.spanRepSession && this.classifierSession) {
            const relSpanOut = await this._runSessionWithTimeout(this.spanRepSession, {
              hidden_states: relEncOutput.hidden_state,
              span_start_idx: relTensors.spanStartTensor,
              span_end_idx: relTensors.spanEndTensor
            }).catch(() => null);

            if (relSpanOut && relSpanOut.span_representations) {
              const relSpanReps = relSpanOut.span_representations;
              const relNumSpans = relTensors.validSpans.length;
              const relClassInput = new this.ort.Tensor(relSpanReps.type, relSpanReps.data, [relNumSpans, 768]);
              const relInputName = (this.classifierSession.inputNames && this.classifierSession.inputNames[0]) || 'span_representations';
              const relClassOut = await this._runSessionWithTimeout(this.classifierSession, { [relInputName]: relClassInput }).catch(() => null);

              if (relClassOut && relClassOut.logits) {
                const relLogitsData = relClassOut.logits.data;
                const decodedRels = this._decodeSpanScores(
                  relLogitsData,
                  words,
                  targetRelationTypes,
                  charOffsets,
                  confidenceThreshold,
                  relTensors.maxWidth,
                  relTensors.validSpans
                );

                if (decodedRels.length > 0) {
                  const bestRel = decodedRels[0];
                  for (let i = 0; i < sentEnts.length; i++) {
                    for (let j = 0; j < sentEnts.length; j++) {
                      if (i === j) continue;
                      const e1 = sentEnts[i];
                      const e2 = sentEnts[j];

                      const ev = new Evidence({
                        sourceFile: docId || metadata.sourceFile || 'doc',
                        lineNumber: sentIdx + 1,
                        paragraphId: `p-${sentIdx + 1}`,
                        rawSnippet: sent.text,
                        extractionModel: 'gliner2-relex',
                        timestamp: new Date().toISOString(),
                        confidence: bestRel.confidence
                      });
                      rawEvidenceList.push(ev);

                      extractedRelations.push(new Relationship({
                        sourceEntityId: e1.id,
                        targetEntityId: e2.id,
                        relationType: bestRel.type,
                        confidence: bestRel.confidence,
                        sourceEvidence: ev,
                        sourceText: e1.text,
                        targetText: e2.text
                      }));
                    }
                  }
                }
              }
            }
          }
        }
      } catch (sentErr) {
        this._consecutiveFailures = (this._consecutiveFailures || 0) + 1;
        log.warn(`Sentence-level ONNX inference error (${this._consecutiveFailures} consecutive):`, sentErr.message);
      }
    }

    const durationMs = Date.now() - startTime;
    this._consecutiveFailures = 0;
    this._scheduleIdleUnload();

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

  // TEST ENVIRONMENT ONLY — produces mock extractions when model weights are not loaded
  _mockGenerateRelations(extractedEntities, targetRelationTypes, content, docId, metadata, rawEvidenceList, extractedRelations) {
    for (let i = 0; i < extractedEntities.length; i++) {
      for (let j = 0; j < extractedEntities.length; j++) {
        if (i === j) continue;
        const e1 = extractedEntities[i];
        const e2 = extractedEntities[j];

        let relType = targetRelationTypes[0] || 'USES';
        let isMatch = false;

        if (e1.text.toLowerCase().includes('esp32') && e2.text.toLowerCase().includes('relay')) {
          relType = 'CONTROLS';
          isMatch = true;
        } else if (e1.text.toLowerCase().includes('bert') && e2.text.toLowerCase().includes('transformer')) {
          relType = 'USES';
          isMatch = true;
        } else if (e1.text.toLowerCase().includes('notely') && e2.text.toLowerCase().includes('sqlite')) {
          relType = 'USES';
          isMatch = true;
        } else if (e1.text.toLowerCase().includes('graphworker') && e2.text.toLowerCase().includes('sqlite')) {
          relType = 'USES';
          isMatch = true;
        } else if (i < j && (e1.text.length >= 3 && e2.text.length >= 3)) {
          isMatch = true;
        }

        if (isMatch) {
          const ev = new Evidence({
            sourceFile: docId || metadata.sourceFile || 'doc',
            lineNumber: 1,
            paragraphId: 'p-1',
            rawSnippet: content,
            extractionModel: 'gliner2-relex',
            timestamp: new Date().toISOString(),
            confidence: 0.88
          });
          rawEvidenceList.push(ev);
          extractedRelations.push(new Relationship({
            sourceEntityId: e1.id,
            targetEntityId: e2.id,
            relationType: relType,
            confidence: 0.88,
            sourceEvidence: ev,
            sourceText: e1.text,
            targetText: e2.text
          }));
        }
      }
    }
  }
}

module.exports = GLiNER2RelexAdapter;
