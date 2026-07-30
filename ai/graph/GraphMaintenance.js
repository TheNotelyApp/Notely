/**
 * GraphMaintenance - Background cleanup and graph optimization jobs
 * - Orphan entity purging
 * - Stale edge weight decay
 * - Entity alias cluster deduplication
 */

const { createLogger } = require('../core');

const log = createLogger('GraphMaintenance');

class GraphMaintenance {
  constructor(graphDb, entityResolver) {
    this.graphDb = graphDb;
    this.entityResolver = entityResolver;
  }

  /**
   * Run full maintenance routine
   */
  async runMaintenance() {
    if (!this.graphDb?.db) return { purgedOrphans: 0, decayedEdges: 0 };
    log.info('Starting background GraphMaintenance run...');

    const purgedOrphans = this.purgeOrphans();
    const decayedEdges = this.decayStaleEdges();
    const mergedAliases = this.deduplicateAliases();

    log.info(`GraphMaintenance finished: Purged ${purgedOrphans} orphans, decayed ${decayedEdges} edges, merged ${mergedAliases} aliases.`);
    return { purgedOrphans, decayedEdges, mergedAliases };
  }

  /**
   * Delete orphan entity nodes with zero connections and no associated source note
   */
  purgeOrphans() {
    if (!this.graphDb?.db) return 0;
    try {
      const db = this.graphDb.db;
      const stmt = db.prepare(`
        DELETE FROM entities
        WHERE type != 'Note'
          AND note_path IS NULL
          AND id NOT IN (SELECT source_id FROM relationships UNION SELECT target_id FROM relationships)
      `);
      const result = stmt.run();
      return result.changes || 0;
    } catch (err) {
      log.error('Failed to purge orphan entities:', err.message);
      return 0;
    }
  }

  /**
   * Decay edge weights for relationships created >30 days ago
   */
  decayStaleEdges() {
    if (!this.graphDb?.db) return 0;
    try {
      const db = this.graphDb.db;
      const stmt = db.prepare(`
        UPDATE relationships
        SET weight = MAX(0.1, weight * 0.95)
        WHERE datetime(created_at) < datetime('now', '-30 days')
      `);
      const result = stmt.run();
      return result.changes || 0;
    } catch (err) {
      log.error('Failed to decay stale edges:', err.message);
      return 0;
    }
  }

  /**
   * Find candidate duplicate entities using similarity metrics and perform active entity merge
   */
  deduplicateAliases() {
    if (!this.graphDb?.db || !this.entityResolver) return 0;
    let mergedCount = 0;
    try {
      const db = this.graphDb.db;
      const entities = db.prepare("SELECT id, name, canonical_name, type FROM entities WHERE type != 'Note' ORDER BY updated_at DESC LIMIT 500").all();

      for (let i = 0; i < entities.length; i++) {
        for (let j = i + 1; j < entities.length; j++) {
          const e1 = entities[i];
          const e2 = entities[j];
          if (!e1 || !e2 || e1.id === e2.id || e1.type !== e2.type) continue;

          const sim = this.entityResolver.calculateSimilarity(e1.name, e2.name);
          if (sim >= 0.88) {
            // Determine survivor (canonical) and deprecated entity based on degree count
            const deg1 = this._getEntityDegree(e1.id);
            const deg2 = this._getEntityDegree(e2.id);
            const survivor = deg1 >= deg2 ? e1 : e2;
            const deprecated = deg1 >= deg2 ? e2 : e1;

            db.exec('BEGIN');
            try {
              db.prepare('UPDATE relationships SET source_id = ? WHERE source_id = ?').run(survivor.id, deprecated.id);
              db.prepare('UPDATE relationships SET target_id = ? WHERE target_id = ?').run(survivor.id, deprecated.id);
              db.prepare('UPDATE entities SET merged_into = ? WHERE id = ?').run(survivor.id, deprecated.id);
              db.prepare('DELETE FROM entities WHERE id = ?').run(deprecated.id);
              db.exec('COMMIT');

              this.entityResolver.addAlias(survivor.id, deprecated.name, sim);
              mergedCount++;
            } catch (mergeErr) {
              try { db.exec('ROLLBACK'); } catch { /* ignore */ }
              log.debug(`Failed merging entity ${deprecated.id} into ${survivor.id}: ${mergeErr.message}`);
            }
          }
        }
      }
    } catch (err) {
      log.error('Failed alias deduplication pass:', err.message);
    }
    return mergedCount;
  }

  _getEntityDegree(entityId) {
    if (!this.graphDb?.db) return 0;
    try {
      const row = this.graphDb.db.prepare('SELECT COUNT(*) as count FROM relationships WHERE source_id = ? OR target_id = ?').get(entityId, entityId);
      return row?.count || 0;
    } catch {
      return 0;
    }
  }
}

module.exports = GraphMaintenance;
