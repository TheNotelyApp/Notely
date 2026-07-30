/**
 * EvidenceFusionEngine - Probabilistic confidence union & multi-evidence aggregation for relationships
 */

const { createLogger } = require('../core');

const log = createLogger('EvidenceFusionEngine');

class EvidenceFusionEngine {
  constructor(graphDb, evidenceStore) {
    this.graphDb = graphDb;
    this.evidenceStore = evidenceStore;
  }

  fuseTriple({ source_id, target_id, type, weight = 1.0, confidence = 1.0, evidenceId = null, metadata = {} }) {
    if (!this.graphDb?.db) return null;
    const db = this.graphDb.db;

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
          metadata,
          evidence_id: evidenceId
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
          SET confidence = ?, weight = ?, metadata = ?
          WHERE id = ?
        `).run(mergedConfidence, mergedWeight, metadataJson, existing.id);

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
    } catch { /* ignore junction link error */ }
  }
}

module.exports = EvidenceFusionEngine;
