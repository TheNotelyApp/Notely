/**
 * CommunityDetector - Pure JS Label Propagation algorithm for Graph Community Detection
 */

const { createLogger } = require('../core/logger');

const log = createLogger('CommunityDetector');

class CommunityDetector {
  /**
   * Run label propagation over graph DB and update community assignments
   */
  detect(graphDb, logDb = null) {
    if (!graphDb?.db) return { communityCount: 0, totalNodes: 0 };
    const db = graphDb.db;

    try {
      const entities = db.prepare("SELECT id FROM entities WHERE is_retired IS NULL OR is_retired = 0").all();
      if (!entities.length) return { communityCount: 0, totalNodes: 0 };

      const relationships = db.prepare("SELECT source_id, target_id FROM relationships").all();

      // Build adjacency list
      const adj = new Map();
      entities.forEach(e => adj.set(e.id, []));

      relationships.forEach(r => {
        if (adj.has(r.source_id) && adj.has(r.target_id)) {
          adj.get(r.source_id).push(r.target_id);
          adj.get(r.target_id).push(r.source_id);
        }
      });

      // Initialize label per node = numeric index
      const labels = new Map();
      entities.forEach((e, idx) => labels.set(e.id, idx + 1));

      const nodeIds = entities.map(e => e.id);
      const maxRounds = 30;

      for (let round = 0; round < maxRounds; round++) {
        let changed = 0;

        // Shuffle node order for unbiased propagation
        for (let i = nodeIds.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [nodeIds[i], nodeIds[j]] = [nodeIds[j], nodeIds[i]];
        }

        for (const nodeId of nodeIds) {
          const neighbors = adj.get(nodeId) || [];
          if (neighbors.length === 0) continue;

          // Count neighbor label frequencies
          const freq = new Map();
          for (const n of neighbors) {
            const l = labels.get(n);
            freq.set(l, (freq.get(l) || 0) + 1);
          }

          // Pick max frequent label
          let bestLabel = labels.get(nodeId);
          let maxCount = -1;

          for (const [l, count] of freq.entries()) {
            if (count > maxCount) {
              maxCount = count;
              bestLabel = l;
            }
          }

          if (bestLabel !== labels.get(nodeId)) {
            labels.set(nodeId, bestLabel);
            changed++;
          }
        }

        if (changed === 0) break;
      }

      // Group entities by community label
      const communitiesMap = new Map();
      labels.forEach((communityId, entityId) => {
        if (!communitiesMap.has(communityId)) communitiesMap.set(communityId, []);
        communitiesMap.get(communityId).push(entityId);
      });

      // Update database tables inside a transaction
      db.exec('BEGIN');
      try {
        db.exec('DELETE FROM communities;');
        const insertCommStmt = db.prepare("INSERT INTO communities (id, label, node_count, updated_at) VALUES (?, ?, ?, datetime('now'))");
        const updateEntStmt = db.prepare('UPDATE entities SET community_id = ? WHERE id = ?');

        let cIndex = 1;
        communitiesMap.forEach((members) => {
          const commLabel = `Community ${cIndex}`;
          insertCommStmt.run(cIndex, commLabel, members.length);
          for (const entId of members) {
            updateEntStmt.run(cIndex, entId);
          }
          cIndex++;
        });

        db.exec('COMMIT');
      } catch (err) {
        try { db.exec('ROLLBACK'); } catch { /* ignore */ }
        throw err;
      }

      const communityCount = communitiesMap.size;
      log.info(`CommunityDetector finished: identified ${communityCount} communities across ${entities.length} nodes.`);
      if (logDb) {
        logDb.addLog('graph', `Community detection pass complete (${communityCount} communities)`, 'info', { communityCount, totalNodes: entities.length });
      }

      return { communityCount, totalNodes: entities.length };
    } catch (err) {
      log.error('Failed community detection pass:', err.message);
      return { communityCount: 0, totalNodes: 0 };
    }
  }
}

module.exports = CommunityDetector;
