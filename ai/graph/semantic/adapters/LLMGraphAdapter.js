/**
 * LLMGraphAdapter - Cloud LLM-powered Semantic Graph Extraction Adapter
 * Supports Gemini, Groq, OpenAI, and compatible providers for Entity & Relation Extraction.
 */

const ModelAdapter = require('../ModelAdapter');
const { Entity, Relationship, Evidence, ExtractionResult } = require('../schemas/ExtractionResult');
const { createLogger } = require('../../../core/logger');

const log = createLogger('LLMGraphAdapter');

const EXTRACTION_SYSTEM_PROMPT = `You are an expert knowledge graph extraction engine.
Analyze the provided document text and extract:
1. Significant Named Entities (People, Concepts, Tools, Technologies, Organizations, Projects, Topics).
2. Direct Semantic Relationships between the extracted entities.

Return ONLY a valid JSON object matching this exact schema:
{
  "entities": [
    { "name": "Entity Name", "type": "Person|Concept|Tool|Technology|Organization|Project|Topic", "confidence": 0.95 }
  ],
  "relations": [
    { "source": "Entity Name 1", "target": "Entity Name 2", "type": "USES|RELATED_TO|PART_OF|DEPENDS_ON|CREATES|HAS_PERSON|BELONGS_TO", "confidence": 0.90, "sentence": "Context sentence explaining relation." }
  ]
}`;

class LLMGraphAdapter extends ModelAdapter {
  constructor(config = {}) {
    super(config);
    this.provider = config.provider || null; // LLM Provider instance or name
    this.providerInstance = config.providerInstance || null;
    this.appDataDir = config.appDataDir || null;
    this.modelId = config.modelId || config.model || 'cloud-llm';
    this.isLoaded = false;
  }

  async load() {
    this.isLoaded = true;
    return true;
  }

  /**
   * Execute extraction via Cloud LLM
   */
  async extract(document, _options = {}) {
    const text = document?.content || '';
    const sourceFile = document?.id || document?.sourceFile || 'unknown';

    if (!text.trim()) {
      return new ExtractionResult({ entities: [], relations: [], evidence: [] });
    }

    // Limit text length to prevent context explosion
    const truncatedText = text.length > 8000 ? text.slice(0, 8000) + '\n...(truncated)' : text;

    try {
      let promptProvider = this.providerInstance;
      if (!promptProvider && this.config.getProvider) {
        promptProvider = this.config.getProvider();
      }

      if (!promptProvider) {
        log.warn('No active LLM provider configured for graph extraction.');
        return new ExtractionResult({ entities: [], relations: [], evidence: [] });
      }

      const prompt = `Document:\n"""\n${truncatedText}\n"""\n\nExtract entities and relationships as JSON:`;
      const rawOutput = await promptProvider.generateText(prompt, {
        systemPrompt: EXTRACTION_SYSTEM_PROMPT,
        temperature: 0.1
      });

      const responseText = typeof rawOutput === 'string' ? rawOutput : rawOutput?.text || '';
      return this._parseJsonResponse(responseText, sourceFile);
    } catch (err) {
      log.error(`LLM graph extraction failed for ${sourceFile}:`, err.message);
      return new ExtractionResult({ entities: [], relations: [], evidence: [] });
    }
  }

  _parseJsonResponse(rawText, sourceFile) {
    let cleanJson = rawText.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    }

    let parsed = null;
    try {
      parsed = JSON.parse(cleanJson);
    } catch {
      const match = cleanJson.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch { /* ignore */ }
      }
    }

    if (!parsed || (!Array.isArray(parsed.entities) && !Array.isArray(parsed.relations))) {
      return new ExtractionResult({ entities: [], relations: [], evidence: [] });
    }

    const entityMap = new Map();
    const entities = [];
    const evidenceList = [];

    for (const rawEnt of parsed.entities || []) {
      if (!rawEnt?.name || typeof rawEnt.name !== 'string') continue;
      const name = rawEnt.name.trim();
      if (!name || name.length < 2) continue;

      const type = rawEnt.type || 'Concept';
      const conf = typeof rawEnt.confidence === 'number' ? rawEnt.confidence : 0.9;
      const ev = new Evidence({
        sourceFile,
        rawSnippet: name,
        extractionModel: this.modelId,
        confidence: conf
      });

      try {
        const entity = new Entity({
          text: name,
          canonicalName: name,
          type,
          confidence: conf,
          sourceEvidence: ev
        });
        entityMap.set(name.toLowerCase(), entity);
        entities.push(entity);
        evidenceList.push(ev);
      } catch { /* ignore entity validation error */ }
    }

    const relations = [];
    for (const rawRel of parsed.relations || []) {
      if (!rawRel?.source || !rawRel?.target) continue;
      const srcName = String(rawRel.source).trim();
      const tgtName = String(rawRel.target).trim();
      if (!srcName || !tgtName || srcName.toLowerCase() === tgtName.toLowerCase()) continue;

      let srcEnt = entityMap.get(srcName.toLowerCase());
      let tgtEnt = entityMap.get(tgtName.toLowerCase());

      if (!srcEnt) {
        srcEnt = new Entity({ text: srcName, type: 'Concept', confidence: 0.8 });
        entityMap.set(srcName.toLowerCase(), srcEnt);
        entities.push(srcEnt);
      }
      if (!tgtEnt) {
        tgtEnt = new Entity({ text: tgtName, type: 'Concept', confidence: 0.8 });
        entityMap.set(tgtName.toLowerCase(), tgtEnt);
        entities.push(tgtEnt);
      }

      const relType = rawRel.type || 'RELATED_TO';
      const conf = typeof rawRel.confidence === 'number' ? rawRel.confidence : 0.85;
      const ev = new Evidence({
        sourceFile,
        rawSnippet: rawRel.sentence || `${srcName} -> ${tgtName}`,
        extractionModel: this.modelId,
        confidence: conf
      });

      try {
        const relationship = new Relationship({
          sourceEntityId: srcEnt.id,
          targetEntityId: tgtEnt.id,
          relationType: relType,
          confidence: conf,
          sourceEvidence: ev,
          sourceText: srcName,
          targetText: tgtName
        });
        relations.push(relationship);
        evidenceList.push(ev);
      } catch { /* ignore relationship error */ }
    }

    return new ExtractionResult({
      entities,
      relations,
      evidence: evidenceList,
      metadata: { model: this.modelId, provider: 'cloud-llm' }
    });
  }
}

module.exports = LLMGraphAdapter;
