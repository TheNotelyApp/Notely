/**
 * GraphValidationEngine - Automated validation engine for checking knowledge graph consistency & quality (15 rules)
 */

const fs = require('fs');
const { createLogger } = require('../core/logger');

const log = createLogger('GraphValidationEngine');

class GraphValidationEngine {
  constructor(graphDb, logDb = null) {
    this.graphDb = graphDb;
    this.logDb = logDb;
  }

  validateSync() {
    const results = {
      orphans: 0,
      confidenceAnomalies: 0,
      evidencelessEdges: 0,
      selfLoops: 0,
      duplicateEdges: 0,
      duplicateEntities: 0,
      typeOverloading: false,
      starTopology: false,
      missingWorkspace: false,
      emptyGraph: false,
      lowDensity: false,
      staleEntities: 0,
      fts5SyncDiscrepancy: 0,
      unassignedCommunities: 0,
      danglingAliases: 0,
      evidenceCoverageRatio: 1.0,
      timestamp: new Date().toISOString()
    };

    if (!this.graphDb?.db) return results;
    const db = this.graphDb.db;

    try {
      // Rule 1: Orphan non-structural entities
      const orphans = db.prepare(`
        SELECT id, name, type FROM entities
        WHERE type NOT IN ('Note', 'Folder', 'Workspace')
          AND id NOT IN (SELECT source_id FROM relationships UNION SELECT target_id FROM relationships)
      `).all();
      results.orphans = orphans.length;

      // Rule 2: Confidence values out of bounds [0.0, 1.0]
      const anomalies = db.prepare(`
        SELECT id FROM relationships WHERE confidence < 0.0 OR confidence > 1.0
      `).all();
      results.confidenceAnomalies = anomalies.length;

      // Rule 3: Evidenceless edges for neural extractors
      const evidenceless = db.prepare(`
        SELECT r.id FROM relationships r
        LEFT JOIN relationship_evidence re ON r.id = re.relationship_id
        WHERE re.relationship_id IS NULL AND r.extractor IN ('gliner2-relex', 'glirel', 'glirel_onnx')
      `).all();
      results.evidencelessEdges = evidenceless.length;

      // Rule 4: Self loops (source_id == target_id)
      const selfLoops = db.prepare(`SELECT id FROM relationships WHERE source_id = target_id`).all();
      results.selfLoops = selfLoops.length;

      // Rule 5: Duplicate edges (same source, target, type)
      const dupes = db.prepare(`
        SELECT source_id, target_id, type, COUNT(*) as c
        FROM relationships GROUP BY source_id, target_id, type HAVING c > 1
      `).all();
      results.duplicateEdges = dupes.reduce((sum, d) => sum + (d.c - 1), 0);

      // Rule 6: Type overloading (>20% default 'Concept' type)
      const totalEnts = db.prepare(`SELECT COUNT(*) as c FROM entities`).get()?.c || 0;
      const conceptEnts = db.prepare(`SELECT COUNT(*) as c FROM entities WHERE type = 'Concept'`).get()?.c || 0;
      results.typeOverloading = totalEnts > 10 && (conceptEnts / totalEnts) > 0.20;

      // Rule 7: Star topology check
      if (totalEnts > 5) {
        const maxDeg = db.prepare(`
          SELECT MAX(deg) as max_d FROM (
            SELECT source_id, COUNT(*) as deg FROM relationships GROUP BY source_id
          )
        `).get()?.max_d || 0;
        const totalEdges = db.prepare(`SELECT COUNT(*) as c FROM relationships`).get()?.c || 0;
        const avgDeg = totalEdges / Math.max(totalEnts, 1);
        results.starTopology = maxDeg > 15 && maxDeg > avgDeg * 5;
      }

      // Rule 8: Missing workspace node
      const wsCount = db.prepare(`SELECT COUNT(*) as c FROM entities WHERE type = 'Workspace'`).get()?.c || 0;
      results.missingWorkspace = wsCount === 0;

      // Rule 9: Empty graph
      results.emptyGraph = totalEnts === 0;

      // Rule 10: Low density
      const totalEdges = db.prepare(`SELECT COUNT(*) as c FROM relationships`).get()?.c || 0;
      results.lowDensity = totalEnts > 10 && (totalEdges / totalEnts) < 0.1;

      // Rule 11: Stale entities (note_path missing on disk)
      const noteEnts = db.prepare(`SELECT id, note_path FROM entities WHERE note_path IS NOT NULL`).all();
      let staleCount = 0;
      for (const ne of noteEnts) {
        if (!ne.note_path) continue;
        try { fs.statSync(ne.note_path); } catch { staleCount++; }
      }
      results.staleEntities = staleCount;

      // Rule 12: FTS5 sync discrepancy
      let ftsCount = 0;
      try {
        ftsCount = db.prepare(`SELECT COUNT(*) as c FROM entity_fts`).get()?.c || 0;
      } catch { ftsCount = 0; }
      results.fts5SyncDiscrepancy = Math.abs(totalEnts - ftsCount);

      // Rule 13: Unassigned communities
      const unassignedComms = db.prepare(`SELECT COUNT(*) as c FROM entities WHERE community_id IS NULL`).get()?.c || 0;
      results.unassignedCommunities = unassignedComms;

      // Rule 14: Dangling aliases
      const danglingAliases = db.prepare(`
        SELECT COUNT(*) as c FROM entity_aliases WHERE entity_id NOT IN (SELECT id FROM entities)
      `).get()?.c || 0;
      results.danglingAliases = danglingAliases;

      // Rule 15: Evidence coverage ratio
      const edgesWithEvidence = db.prepare(`SELECT COUNT(DISTINCT relationship_id) as c FROM relationship_evidence`).get()?.c || 0;
      results.evidenceCoverageRatio = totalEdges > 0 ? parseFloat((edgesWithEvidence / totalEdges).toFixed(2)) : 1.0;

      // Rule 16: Duplicate entities sharing canonical name
      const dupEnts = db.prepare(`
        SELECT LOWER(canonical_name) as cname, COUNT(*) as c
        FROM entities
        GROUP BY LOWER(canonical_name)
        HAVING c > 1
      `).all();
      results.duplicateEntities = dupEnts.length;

      if (this.logDb) {
        this.logDb.addLog('graph', 'Graph validation pass executed across 16 rules', 'info', results);
      }
      log.info('GraphValidationEngine pass completed successfully across 16 rules:', results);
    } catch (err) {
      log.error('Failed graph validation pass:', err.message);
    }

    return results;
  }

  async validate() {
    return this.validateSync();
  }
}

module.exports = GraphValidationEngine;
