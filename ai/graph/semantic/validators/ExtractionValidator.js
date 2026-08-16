/**
 * ExtractionValidator - Graph Quality & Extraction Validation Engine before persistence
 */

const { createLogger } = require('../../../core/logger');

const log = createLogger('ExtractionValidator');

class ExtractionValidator {
  constructor(options = {}) {
    this.minConfidence = options.minConfidence || 0.30;
    this.maxGraphExplosionLimit = options.maxGraphExplosionLimit || 500;
  }

  validate(extractionResult) {
    const decisions = {
      valid: true,
      duplicateNodesCount: 0,
      duplicateEdgesCount: 0,
      missingEvidenceCount: 0,
      invalidReferencesCount: 0,
      lowConfidenceRelationsCount: 0,
      orphanNodesCount: 0,
      graphExplosionDetected: false,
      warnings: [],
      telemetry: {}
    };

    if (!extractionResult) {
      decisions.valid = false;
      decisions.warnings.push('Null or empty extraction result.');
      return decisions;
    }

    const { entities = [], relations = [], evidence = [] } = extractionResult;

    // 1. Check Graph Explosion
    if (entities.length > this.maxGraphExplosionLimit || relations.length > this.maxGraphExplosionLimit) {
      decisions.graphExplosionDetected = true;
      decisions.warnings.push(`Graph explosion detected: ${entities.length} entities and ${relations.length} relations exceed limit of ${this.maxGraphExplosionLimit}.`);
    }

    const sanitizedEntities = [];
    const entityIdSet = new Set();

    for (const ent of entities) {
      if (!ent || (!ent.id && !ent.text)) {
        decisions.warnings.push(`Entity missing required fields: ${JSON.stringify(ent)}`);
        continue;
      }
      const entId = ent.id || ent.text;
      if (entityIdSet.has(entId)) {
        decisions.duplicateNodesCount++;
      } else {
        entityIdSet.add(entId);
        sanitizedEntities.push(ent);
      }
      if (!ent.sourceEvidence) {
        decisions.missingEvidenceCount++;
      }
    }

    // 3. Filter Duplicate Edges, Self-Loops, Invalid References & Low Confidence
    const sanitizedRelations = [];
    const edgeKeySet = new Set();
    const referencedEntityIds = new Set();

    for (const rel of relations) {
      if (!rel.sourceEntityId || !rel.targetEntityId || rel.sourceEntityId === rel.targetEntityId) {
        decisions.invalidReferencesCount++;
        decisions.warnings.push(`Relationship missing/invalid source or target ID (or self loop): ${JSON.stringify(rel)}`);
        continue;
      }

      referencedEntityIds.add(rel.sourceEntityId);
      referencedEntityIds.add(rel.targetEntityId);

      const edgeKey = `${rel.sourceEntityId}:${rel.relationType}:${rel.targetEntityId}`;
      if (edgeKeySet.has(edgeKey)) {
        decisions.duplicateEdgesCount++;
        continue;
      }

      if (rel.confidence < this.minConfidence) {
        decisions.lowConfidenceRelationsCount++;
        decisions.warnings.push(`Low confidence relationship '${rel.relationType}' (${rel.confidence} < ${this.minConfidence}).`);
        continue;
      }

      edgeKeySet.add(edgeKey);
      sanitizedRelations.push(rel);

      if (!rel.sourceEvidence) {
        decisions.missingEvidenceCount++;
      }
    }

    // 4. Orphan Nodes
    for (const ent of sanitizedEntities) {
      if (!referencedEntityIds.has(ent.id || ent.text)) {
        decisions.orphanNodesCount++;
      }
    }

    decisions.sanitizedEntities = sanitizedEntities;
    decisions.sanitizedRelations = sanitizedRelations;

    decisions.telemetry = {
      event: 'semantic_extraction_validated',
      entitiesCount: sanitizedEntities.length,
      relationsCount: sanitizedRelations.length,
      evidenceCount: evidence.length,
      duplicateNodes: decisions.duplicateNodesCount,
      duplicateEdges: decisions.duplicateEdgesCount,
      invalidReferences: decisions.invalidReferencesCount,
      lowConfidenceRelations: decisions.lowConfidenceRelationsCount,
      orphanNodes: decisions.orphanNodesCount,
      graphExplosion: decisions.graphExplosionDetected,
      warningsCount: decisions.warnings.length
    };

    log.debug('ExtractionValidator validation pass completed:', decisions.telemetry);
    return decisions;
  }
}

module.exports = ExtractionValidator;
