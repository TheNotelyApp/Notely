/**
 * EntityResolver - Handles entity identification, canonical naming, aliasing, and deduplication
 */

const crypto = require('crypto');
const { createLogger } = require('../core/logger');

const log = createLogger('EntityResolver');

class EntityResolver {
  constructor(graphDb) {
    this.graphDb = graphDb;
  }

  /**
   * Deterministic entity ID generation via SHA-256 (supports international non-ASCII characters)
   */
  generateEntityId(name, type = 'Entity') {
    const normName = String(name || '').trim().toLowerCase();
    const hash = crypto.createHash('sha256').update(`${type.toLowerCase()}:${normName}`).digest('hex').slice(0, 16);
    return `ent-${hash}`;
  }

  /**
   * Resolve an entity mention to its canonical ID and name
   */
  resolveMention(mentionName, type = 'Entity') {
    if (!mentionName || typeof mentionName !== 'string') return null;
    const clean = mentionName.trim();
    if (clean.length === 0) return null;

    const aliasMatch = this.findAlias(clean);
    if (aliasMatch) {
      return {
        id: aliasMatch.entity_id,
        name: clean,
        canonical_name: aliasMatch.canonical_name || clean,
        type: aliasMatch.type || type,
        isAlias: true
      };
    }

    const defaultId = this.generateEntityId(clean, type);
    return {
      id: defaultId,
      name: clean,
      canonical_name: clean,
      type,
      isAlias: false
    };
  }

  /**
   * Find an existing alias mapping
   */
  findAlias(alias) {
    if (!this.graphDb?.db) return null;
    try {
      const stmt = this.graphDb.db.prepare(`
        SELECT a.alias, a.entity_id, a.confidence, e.name as canonical_name, e.type
        FROM entity_aliases a
        JOIN entities e ON a.entity_id = e.id
        WHERE LOWER(a.alias) = LOWER(?)
      `);
      return stmt.get(alias) || null;
    } catch {
      return null;
    }
  }

  /**
   * Add alias for an entity
   */
  addAlias(entityId, alias, confidence = 1.0) {
    if (!this.graphDb?.db || !alias) return;
    try {
      const stmt = this.graphDb.db.prepare(`
        INSERT INTO entity_aliases (alias, entity_id, confidence)
        VALUES (?, ?, ?)
        ON CONFLICT(alias) DO UPDATE SET confidence = excluded.confidence
      `);
      stmt.run(alias.trim(), entityId, confidence);
    } catch (err) {
      log.debug(`Failed to add alias '${alias}': ${err.message}`);
    }
  }

  /**
   * Calculate hybrid string similarity (Levenshtein + Token Jaccard) (0.0 to 1.0)
   */
  calculateSimilarity(str1, str2) {
    const s1 = String(str1 || '').toLowerCase().trim();
    const s2 = String(str2 || '').toLowerCase().trim();
    if (s1 === s2) return 1.0;
    if (!s1 || !s2) return 0.0;

    // Levenshtein distance
    const len1 = s1.length;
    const len2 = s2.length;
    const matrix = Array.from({ length: len1 + 1 }, () => new Array(len2 + 1).fill(0));

    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    const dist = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);
    const levSim = 1.0 - dist / maxLen;

    // Token Jaccard similarity for multi-word terms
    const tokens1 = new Set(s1.split(/\s+/).filter(t => t.length > 1));
    const tokens2 = new Set(s2.split(/\s+/).filter(t => t.length > 1));

    if (tokens1.size > 1 || tokens2.size > 1) {
      const intersection = new Set([...tokens1].filter(t => tokens2.has(t)));
      const union = new Set([...tokens1, ...tokens2]);
      const jaccardSim = union.size > 0 ? intersection.size / union.size : 0;
      return Math.max(levSim, jaccardSim);
    }

    return levSim;
  }
}

module.exports = EntityResolver;
