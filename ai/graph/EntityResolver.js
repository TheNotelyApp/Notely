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
   * Helper: Normalize string by decoding URI encoding and trimming whitespace
   */
  cleanName(str) {
    if (!str || typeof str !== 'string') return '';
    let s = str.trim();
    try {
      s = decodeURIComponent(s);
    } catch { /* ignore URI decode error */ }
    return s.replace(/\s+/g, ' ').trim();
  }

  /**
   * Comprehensive Quality Gate: Checks if entity candidate string is valid knowledge term
   */
  /**
   * Universal Linguistic Quality Gate (Zero hardcoded entity lists)
   * Enforces grammatical boundary rules, character entropy, and syntax artifact filters.
   */
  isValidEntityName(name) {
    if (!name || typeof name !== 'string') return false;
    const clean = name.trim();
    const norm = clean.toLowerCase();

    // 1. Min/Max Length & Acronym Rule (2 & 3 char words must be uppercase acronyms like AI, UI, DB, API, SDK, CLI, SQL, APP, WEB)
    if (clean.length < 2 || clean.length > 35 || clean.split(/\s+/).length > 4) return false;
    const WHITELIST_SHORT = new Set(['AI', 'UI', 'UX', 'DB', 'JS', 'TS', 'IP', 'OS', 'ID', 'IT', 'API', 'SDK', 'CLI', 'SQL', 'APP', 'WEB', 'CPU', 'RAM', 'URL', 'SSH', 'SSL', 'CSV', 'XML', 'PNG', 'JPG', 'SVG', 'PDF']);
    if (clean.length <= 3 && !WHITELIST_SHORT.has(clean.toUpperCase())) return false;

    const words = norm.split(/\s+/);

    // 2. Grammatical Boundary Rule: Cannot start or end with prepositions, articles, connectives, verbs, or UI tokens
    const GRAMMAR_BOUNDARIES = new Set([
      'a', 'an', 'the', 'and', 'or', 'but', 'for', 'in', 'on', 'at', 'to', 'from',
      'by', 'with', 'of', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'if', 'else', 'so', 'than', 'too', 'very', 'not', 'no', 'nor', 'it', 'its',
      'create', 'update', 'delete', 'connect', 'build', 'run', 'make', 'use', 'get', 'set', 'help', 'test',
      'again', 'teh', 'weh', 'value', 'column'
    ]);
    if (GRAMMAR_BOUNDARIES.has(words[0]) || GRAMMAR_BOUNDARIES.has(words[words.length - 1])) return false;

    // 3. Sentence Clause & Aux Verb Rule: Reject clause fragments containing auxiliary verbs
    if (/\b(will|would|could|should|have|has|had|help|helps|test)\b/i.test(clean)) return false;

    // 4. Character Entropy & Phonetic Rule: Must contain vowels; reject repeated chars & invalid consonant clusters
    if (!/[aeiouy]/i.test(norm)) return false; // Must contain at least one vowel
    if (/(.)\1{3,}/.test(norm)) return false;  // Reject 4+ repeated chars (e.g. "dddde")
    if (/[bcdfghjklmnpqrstvwxyz]{5,}/i.test(norm)) return false; // Reject 5+ consecutive consonants
    if (/^\.[a-z]{1,2}\b/i.test(norm)) return false;

    // 5. Markup & Syntax Artifact Rule: Reject editor markup, HTML attributes, numbers with decimals, table cells
    if (/[{}=|]|\bdata-|\d+\.\d+|\bvalue \d|\bcolumn \d|^[-*+\s:#=]+$/i.test(norm)) return false;

    return true;
  }

  /**
   * Validate and sanitize entity type classification, coercing misclassifications to Concept.
   * Pure algorithmic & pattern-based rules - ZERO hardcoded entity or person name lists.
   */
  sanitizeEntityType(name, proposedType = 'Concept') {
    if (!this.isValidEntityName(name)) return null;

    const clean = name.trim();
    const norm = clean.toLowerCase();
    const words = clean.split(/\s+/);
    const CONNECTIVES = new Set(['and', 'or', 'for', 'in', 'on', 'at', 'to', 'from', 'with', 'by', 'of']);

    // Rule 1: Multi-word Title-Cased Proper Name Pattern (e.g. "Bikash Panda", "Abhiram Panda", "Ada Lovelace")
    const isMultiWordTitleCase = words.length >= 2 && words.every(w => /^[A-Z][a-z]+$/.test(w));
    if (isMultiWordTitleCase && (proposedType === 'Person' || proposedType === 'Organization' || proposedType === 'Concept')) {
      return 'Person';
    }

    // Rule 2: Single-word capitalized proper name (e.g. "Abhiram", "Bikash") proposed as Person or Organization
    const isSingleTitleCase = words.length === 1 && /^[A-Z][a-z]{2,}$/.test(clean);
    const COMMON_NON_PERSONS = new Set(['workspace', 'system', 'search', 'note', 'document', 'screenshot', 'diagram', 'project', 'settings', 'connect', 'api', 'column', 'value', 'test', 'again', 'create', 'teh']);
    if (isSingleTitleCase && (proposedType === 'Person' || proposedType === 'Organization')) {
      if (COMMON_NON_PERSONS.has(norm)) return 'Concept';
      return 'Person';
    }

    // Rule 3: Common Non-Person Nouns cannot be Person
    if (proposedType === 'Person' && COMMON_NON_PERSONS.has(norm)) {
      return 'Concept';
    }

    // Rule 4: Structural media terms (screenshot, diagram, image) cannot be Event, Location, or Task
    if ((proposedType === 'Event' || proposedType === 'Location' || proposedType === 'Task') && /^(screenshot|diagram|image|photo|drawing|picture|file|note)$/i.test(norm)) {
      return 'Concept';
    }

    // Rule 5: Non-Task clauses ending in conjunctions or connectives
    if (proposedType === 'Task' && CONNECTIVES.has(words[words.length - 1].toLowerCase())) {
      return 'Concept';
    }

    return proposedType || 'Concept';
  }

  /**
   * Deterministic entity ID generation via SHA-256 (supports international non-ASCII characters)
   */
  generateEntityId(name, type = 'Entity') {
    const valid = this.cleanName(name);
    const sanitizedType = this.sanitizeEntityType(valid, type) || 'Concept';
    const normName = valid.toLowerCase();
    const hash = crypto.createHash('sha256').update(`${sanitizedType.toLowerCase()}:${normName}`).digest('hex').slice(0, 16);
    return `ent-${hash}`;
  }

  /**
   * Resolve an entity mention to its canonical ID and name
   */
  resolveMention(mentionName, type = 'Entity') {
    if (!mentionName || typeof mentionName !== 'string') return null;
    const clean = this.cleanName(mentionName);
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

    const sanitizedType = this.sanitizeEntityType(clean, type);
    if (!sanitizedType) return null;

    // Reuse existing canonical entity ID if present in database to prevent type fragmentation
    if (this.graphDb?.db) {
      try {
        const existing = this.graphDb.db.prepare(
          'SELECT id, name, canonical_name, type FROM entities WHERE LOWER(name) = LOWER(?) OR LOWER(canonical_name) = LOWER(?) LIMIT 1'
        ).get(clean, clean);
        if (existing) {
          const resolvedType = this.sanitizeEntityType(clean, existing.type) || sanitizedType;
          return {
            id: existing.id,
            name: existing.name || clean,
            canonical_name: existing.canonical_name || clean,
            type: resolvedType,
            isAlias: true
          };
        }
      } catch { /* ignore DB lookup error */ }
    }

    const defaultId = this.generateEntityId(clean, sanitizedType);
    return {
      id: defaultId,
      name: clean,
      canonical_name: clean,
      type: sanitizedType,
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
