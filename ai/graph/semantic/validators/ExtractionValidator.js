/**
 * ExtractionValidator - Graph Quality & Extraction Validation Engine before persistence
 */

const { createLogger } = require('../../../core');

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

    // 2. Duplicate Nodes & Invalid Entity Ids
    const entityIdSet = new Set();
    for (const ent of entities) {
      if (!ent.id || !ent.text) {
        decisions.warnings.push(`Entity missing required fields: ${JSON.stringify(ent)}`);
      }
      if (entityIdSet.has(ent.id)) {
        decisions.duplicateNodesCount++;
      } else {
        entityIdSet.add(ent.id);
      }
      if (!ent.sourceEvidence) {
        decisions.missingEvidenceCount++;
      }
    }

    // 3. Duplicate Edges, Invalid References & Low Confidence
    const edgeKeySet = new Set();
    const referencedEntityIds = new Set();

    for (const rel of relations) {
      if (!rel.sourceEntityId || !rel.targetEntityId) {
        decisions.invalidReferencesCount++;
        decisions.warnings.push(`Relationship missing source/target ID: ${JSON.stringify(rel)}`);
        continue;
      }

      referencedEntityIds.add(rel.sourceEntityId);
      referencedEntityIds.add(rel.targetEntityId);

      if (!entityIdSet.has(rel.sourceEntityId) && !rel.sourceEntityId.startsWith('ent-')) {
        decisions.invalidReferencesCount++;
        decisions.warnings.push(`Relationship source ID '${rel.sourceEntityId}' not found in entity set.`);
      }
      if (!entityIdSet.has(rel.targetEntityId) && !rel.targetEntityId.startsWith('ent-')) {
        decisions.invalidReferencesCount++;
        decisions.warnings.push(`Relationship target ID '${rel.targetEntityId}' not found in entity set.`);
      }

      const edgeKey = `${rel.sourceEntityId}:${rel.relationType}:${rel.targetEntityId}`;
      if (edgeKeySet.has(edgeKey)) {
        decisions.duplicateEdgesCount++;
      } else {
        edgeKeySet.add(edgeKey);
      }

      if (rel.confidence < this.minConfidence) {
        decisions.lowConfidenceRelationsCount++;
        decisions.warnings.push(`Low confidence relationship '${rel.relationType}' (${rel.confidence} < ${this.minConfidence}).`);
      }

      if (!rel.sourceEvidence) {
        decisions.missingEvidenceCount++;
      }
    }

    // 4. Orphan Nodes (entities with no relations in this pass)
    for (const ent of entities) {
      if (!referencedEntityIds.has(ent.id)) {
        decisions.orphanNodesCount++;
      }
    }

    decisions.telemetry = {
      event: 'semantic_extraction_validated',
      entitiesCount: entities.length,
      relationsCount: relations.length,
      evidenceCount: evidence.length,
      duplicateNodes: decisions.duplicateNodesCount,
      duplicateEdges: decisions.duplicateEdgesCount,
      invalidReferences: decisions.invalidReferencesCount,
      lowConfidenceRelations: decisions.lowConfidenceRelationsCount,
      orphanNodes: decisions.orphanNodesCount,
      graphExplosion: decisions.graphExplosionDetected,
      warningsCount: decisions.warnings.length
    };

    log.info('ExtractionValidator validation pass completed:', decisions.telemetry);
    return decisions;
  }
}

module.exports = ExtractionValidator;
