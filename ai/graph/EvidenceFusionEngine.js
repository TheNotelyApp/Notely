/**
 * EvidenceFusionEngine - Probabilistic confidence union & multi-evidence aggregation for relationships
 */

const { createLogger } = require('../core/logger');

const log = createLogger('EvidenceFusionEngine');

class EvidenceFusionEngine {
  constructor(graphDb, evidenceStore) {
    this.graphDb = graphDb;
    this.evidenceStore = evidenceStore;
  }

  fuseTriple({ source_id, target_id, type, weight = 1.0, confidence = 1.0, evidenceId = null, extractor = 'gliner2-relex', metadata = {} }) {
    if (!this.graphDb?.db) return null;
    if (!source_id || !target_id || source_id === target_id) return null;
    const db = this.graphDb.db;

    // Foreign Key & Entity Type Pre-Check
    const sourceEnt = db.prepare('SELECT id, type, name FROM entities WHERE id = ?').get(source_id);
    const targetEnt = db.prepare('SELECT id, type, name FROM entities WHERE id = ?').get(target_id);
    if (!sourceEnt || !targetEnt) return null;

    const STRUCTURAL_TYPES = new Set(['Note', 'Section', 'Tag', 'Media', 'CodeBlock', 'Task']);
    const STRUCTURAL_RELATIONS = new Set(['contains_section', 'contains_media', 'contains_code', 'tagged', 'links_to', 'attaches_file', 'references_url', 'mentions']);

    // Plausibility Rule 1: Structural nodes (Note, Tag, Section) cannot engage in semantic domain relations
    if ((STRUCTURAL_TYPES.has(sourceEnt.type) || STRUCTURAL_TYPES.has(targetEnt.type)) && !STRUCTURAL_RELATIONS.has(type)) {
      return null;
    }

    // Plausibility Rule 2: COMMUNICATES_WITH requires communicating entities (Person, Service, System, Technology)
    if (type === 'COMMUNICATES_WITH') {
      const COMM_TYPES = new Set(['Person', 'Service', 'System', 'Technology']);
      if (!COMM_TYPES.has(sourceEnt.type) || !COMM_TYPES.has(targetEnt.type)) return null;
    }

    // Plausibility Rule 3: IMPLEMENTS requires Technical Source -> Feature/Concept Target
    if (type === 'IMPLEMENTS') {
      if (sourceEnt.type === 'Note' || sourceEnt.type === 'Tag' || targetEnt.name.toLowerCase() === 'interactive') return null;
    }

    // Plausibility Rule 4: GENERATES requires Tool/System Source -> Artifact/Concept Target
    if (type === 'GENERATES') {
      if (sourceEnt.name.startsWith('#') || targetEnt.name.toLowerCase() === 'integration') return null;
    }

    let validEvidenceId = null;
    if (evidenceId) {
      const evExists = db.prepare('SELECT id FROM evidence WHERE id = ?').get(evidenceId);
      if (evExists) validEvidenceId = evidenceId;
    }

    // Plausibility Guard: Reject inverse circular relationships (e.g. A CONTROLS B AND B CONTROLS A)
    const inverseRelation = db.prepare(
      'SELECT id FROM relationships WHERE source_id = ? AND target_id = ? AND type = ?'
    ).get(target_id, source_id, type);
    if (inverseRelation) return null;

    try {
      // 1. Check if relationship already exists
      const existing = db.prepare(
        'SELECT id, weight, confidence FROM relationships WHERE source_id = ? AND target_id = ? AND type = ?'
      ).get(source_id, target_id, type);

      if (!existing) {
        // Insert new edge
        this.graphDb.upsertRelationship({
          source_id,
          target_id,
          type,
          weight,
          confidence,
          extractor,
          metadata,
          evidence_id: validEvidenceId
        });

        const newEdge = db.prepare(
          'SELECT id FROM relationships WHERE source_id = ? AND target_id = ? AND type = ?'
        ).get(source_id, target_id, type);

        if (newEdge && evidenceId) {
          this._linkEvidence(newEdge.id, evidenceId);
        }
        return newEdge?.id || null;
      } else {
        // Merge existing: probabilistic confidence union P(A U B) = 1 - (1 - P(A))*(1 - P(B))
        const mergedConfidence = Math.min(1.0, parseFloat((1 - (1 - existing.confidence) * (1 - confidence)).toFixed(3)));
        const mergedWeight = Math.max(existing.weight, weight);

        const metadataJson = typeof metadata === 'string' ? metadata : JSON.stringify(metadata || {});

        db.prepare(`
          UPDATE relationships
          SET confidence = ?, weight = ?, extractor = ?, metadata = ?
          WHERE id = ?
        `).run(mergedConfidence, mergedWeight, extractor, metadataJson, existing.id);

        if (evidenceId) {
          this._linkEvidence(existing.id, evidenceId);
        }

        // Increment source_count on involved entities
        try {
          db.prepare('UPDATE entities SET source_count = COALESCE(source_count, 1) + 1 WHERE id IN (?, ?)').run(source_id, target_id);
        } catch { /* ignore */ }

        return existing.id;
      }
    } catch (err) {
      log.error('Failed to fuse triple:', err.message);
      return null;
    }
  }

  _linkEvidence(relationshipId, evidenceId) {
    if (!this.graphDb?.db || !relationshipId || !evidenceId) return;
    try {
      this.graphDb.db.prepare(
        'INSERT OR IGNORE INTO relationship_evidence (relationship_id, evidence_id) VALUES (?, ?)'
      ).run(relationshipId, evidenceId);
      this.graphDb.db.prepare(
        'UPDATE relationships SET evidence_id = COALESCE(evidence_id, ?) WHERE id = ?'
      ).run(evidenceId, relationshipId);
    } catch { /* ignore junction link error */ }
  }
}

module.exports = EvidenceFusionEngine;
