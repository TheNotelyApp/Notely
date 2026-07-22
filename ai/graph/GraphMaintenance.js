/**
 * GraphMaintenance - Background cleanup and graph optimization jobs
 * - Orphan entity purging
 * - Stale edge weight decay
 * - Entity alias cluster deduplication
 */

const { createLogger } = require('../core/logger');

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
   * Find candidate duplicate entities using Levenshtein distance and merge aliases
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
          if (e1.id === e2.id || e1.type !== e2.type) continue;

          const sim = this.entityResolver.calculateSimilarity(e1.name, e2.name);
          if (sim >= 0.88) {
            // Register alias pointing e2's name to e1.id
            this.entityResolver.addAlias(e1.id, e2.name, sim);
            mergedCount++;
          }
        }
      }
    } catch (err) {
      log.error('Failed alias deduplication pass:', err.message);
    }
    return mergedCount;
  }
}

module.exports = GraphMaintenance;
