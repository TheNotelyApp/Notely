/**
 * ExtractionResult - Stable Internal Schemas for Semantic Extraction
 */

class Evidence {
  constructor({
    sourceFile = 'unknown',
    lineNumber = null,
    paragraphId = null,
    spanStart = null,
    spanEnd = null,
    rawSnippet = '',
    extractionModel = 'gliner2-relex',
    timestamp = new Date().toISOString(),
    confidence = 1.0
  } = {}) {
    this.sourceFile = sourceFile;
    this.lineNumber = lineNumber;
    this.paragraphId = paragraphId;
    this.spanStart = spanStart;
    this.spanEnd = spanEnd;
    this.rawSnippet = rawSnippet;
    this.extractionModel = extractionModel;
    this.timestamp = timestamp;
    this.confidence = parseFloat(confidence);
  }
}

class Entity {
  constructor({
    id = null,
    text,
    canonicalName = null,
    type = 'Concept',
    confidence = 1.0,
    sourceEvidence = null
  }) {
    if (!text || typeof text !== 'string') {
      throw new Error('Entity text must be a non-empty string.');
    }
    this.text = text.trim();
    this.canonicalName = canonicalName ? canonicalName.trim() : this.text;
    this.type = type ? String(type).trim() : 'Concept';
    this.confidence = parseFloat(confidence);
    this.sourceEvidence = sourceEvidence instanceof Evidence ? sourceEvidence : new Evidence(sourceEvidence || {});
    this.id = id || `ent-${Buffer.from(`${this.type.toLowerCase()}:${this.canonicalName.toLowerCase()}`).toString('hex').slice(0, 16)}`;
  }
}

class Relationship {
  constructor({
    id = null,
    sourceEntityId,
    targetEntityId,
    relationType = 'RELATED_TO',
    confidence = 1.0,
    sourceEvidence = null,
    sourceText = '',
    targetText = ''
  }) {
    if (!sourceEntityId || !targetEntityId) {
      throw new Error('Relationship requires valid sourceEntityId and targetEntityId.');
    }
    this.sourceEntityId = sourceEntityId;
    this.targetEntityId = targetEntityId;
    this.relationType = String(relationType || 'RELATED_TO').toUpperCase().replace(/\s+/g, '_');
    this.confidence = parseFloat(confidence);
    this.sourceEvidence = sourceEvidence instanceof Evidence ? sourceEvidence : new Evidence(sourceEvidence || {});
    this.sourceText = sourceText;
    this.targetText = targetText;
    this.id = id || `rel-${Buffer.from(`${this.sourceEntityId}:${this.relationType}:${this.targetEntityId}`).toString('hex').slice(0, 16)}`;
  }
}

class ExtractionResult {
  constructor({ entities = [], relations = [], evidence = [], metadata = {} } = {}) {
    this.entities = entities;
    this.relations = relations;
    this.evidence = evidence;
    this.metadata = metadata;
  }
}

module.exports = {
  Evidence,
  Entity,
  Relationship,
  ExtractionResult
};
