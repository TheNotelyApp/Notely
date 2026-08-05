/**
 * GraphDB - SQLite handler for workspace-scoped Knowledge Graph database
 */

const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const { createLogger } = require('../core/logger');
const {
  CREATE_ENTITIES_TABLE,
  CREATE_ENTITY_ALIASES_TABLE,
  CREATE_EVIDENCE_TABLE,
  CREATE_RELATIONSHIPS_TABLE,
  CREATE_GRAPH_QUEUE_TABLE,
  CREATE_INDEXES,
  ALTER_ENTITIES_ADD_COLUMNS,
  CREATE_RELATIONSHIP_EVIDENCE_TABLE,
  CREATE_COMMUNITIES_TABLE,
  CREATE_GRAPH_VERSIONS_TABLE,
  CREATE_WORKSPACE_ENTITY_TABLE,
  CREATE_ENTITY_FTS
} = require('./GraphSchema');

const log = createLogger('GraphDB');

class GraphDB {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.dbDir = path.join(workspaceRoot, '.notes-app');
    this.dbPath = path.join(this.dbDir, 'ai-graph.db');
    this.db = null;
    this.isInitialized = false;
  }

  /**
   * Initialize Graph database and tables
   */
  initialize() {
    try {
      if (!this.workspaceRoot) {
        throw new Error('workspaceRoot is required to initialize GraphDB');
      }

      if (!fs.existsSync(this.dbDir)) {
        fs.mkdirSync(this.dbDir, { recursive: true });
      }

      log.info(`Initializing graph database at: ${this.dbPath}`);
      this.db = new DatabaseSync(this.dbPath);

      // Optimizations
      this.db.exec('PRAGMA foreign_keys = ON;');
      this.db.exec('PRAGMA journal_mode = WAL;');
      this.db.exec('PRAGMA synchronous = NORMAL;');

      // Create base tables
      this.db.exec(CREATE_ENTITIES_TABLE);
      this.db.exec(CREATE_ENTITY_ALIASES_TABLE);
      this.db.exec(CREATE_EVIDENCE_TABLE);
      this.db.exec(CREATE_RELATIONSHIPS_TABLE);
      this.db.exec(CREATE_GRAPH_QUEUE_TABLE);

      // Create M3/M4 tables
      this.db.exec(CREATE_RELATIONSHIP_EVIDENCE_TABLE);
      this.db.exec(CREATE_COMMUNITIES_TABLE);
      this.db.exec(CREATE_GRAPH_VERSIONS_TABLE);
      this.db.exec(CREATE_WORKSPACE_ENTITY_TABLE);
      try {
        this.db.exec(CREATE_ENTITY_FTS);
      } catch { /* ignore FTS initialization warning */ }

      // Safe column alters
      if (Array.isArray(ALTER_ENTITIES_ADD_COLUMNS)) {
        for (const alterQuery of ALTER_ENTITIES_ADD_COLUMNS) {
          try {
            this.db.exec(alterQuery);
          } catch { /* ignore column already exists error */ }
        }
      }

      // Create indexes
      for (const idxQuery of CREATE_INDEXES) {
        this.db.exec(idxQuery);
      }

      // Versioned database schema migrations (Gap 3)
      const TARGET_SCHEMA_VERSION = 4;
      let currentVersion = 0;
      try {
        const vRow = this.db.prepare('PRAGMA user_version').get();
        currentVersion = vRow ? (vRow.user_version || 0) : 0;
      } catch { /* default 0 */ }

      if (currentVersion < TARGET_SCHEMA_VERSION) {
        this._runSchemaMigrations(currentVersion, TARGET_SCHEMA_VERSION);
        try {
          this.db.exec(`PRAGMA user_version = ${TARGET_SCHEMA_VERSION}`);
        } catch { /* ignore pragma write error */ }
      }

      this.isInitialized = true;
      log.info('GraphDB initialized successfully');
      return true;
    } catch (err) {
      log.error('Failed to initialize GraphDB:', err);
      throw err;
    }
  }

  _runSchemaMigrations(fromVersion, toVersion) {
    log.info(`Migrating GraphDB schema from v${fromVersion} to v${toVersion}`);
    if (fromVersion < 1) {
      // Version 1: Add new entity metadata columns if missing
      const cols = [
        'confidence REAL DEFAULT 1.0',
        'community_id INTEGER',
        'ontology_class TEXT',
        'source_count INTEGER DEFAULT 1',
        "first_seen_at TEXT DEFAULT (datetime('now'))",
        'is_retired INTEGER DEFAULT 0',
        'merged_into TEXT'
      ];
      for (const col of cols) {
        try { this.db.exec(`ALTER TABLE entities ADD COLUMN ${col};`); } catch { /* ignore */ }
      }
    }
    if (fromVersion < 2) {
      // Version 2: Ensure relationship_evidence and communities tables exist
      try {
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS relationship_evidence (
            relationship_id INTEGER NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
            evidence_id TEXT NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
            PRIMARY KEY (relationship_id, evidence_id)
          );
        `);
      } catch { /* ignore */ }
    }
    if (fromVersion < 3) {
      // Version 3: Clean up structural relationship extractor tags
      try {
        this.db.exec(`
          UPDATE relationships SET extractor = 'ast_parser'
          WHERE extractor = 'glirel' AND type IN (
            'links_to','tagged','contains_section','contains_media',
            'contains_code','attaches_file','references_url','annotated_with',
            'contains_formula','has_open_task','has_completed_task',
            'relates_to','mentions_note'
          );
        `);
      } catch { /* ignore */ }
    }
    if (fromVersion < 4) {
      // Version 4: Ensure entity_embeddings table exists
      try {
        const { CREATE_ENTITY_EMBEDDINGS_TABLE } = require('./GraphSchema');
        this.db.exec(CREATE_ENTITY_EMBEDDINGS_TABLE);
      } catch { /* ignore */ }
    }
  }

  upsertEntityVector(entityId, vectorArray) {
    if (!this.db || !entityId || !vectorArray) return;
    try {
      const float32 = new Float32Array(vectorArray);
      const buffer = Buffer.from(float32.buffer);
      const stmt = this.db.prepare(`
        INSERT INTO entity_embeddings (entity_id, vector, dimension, updated_at)
        VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT(entity_id) DO UPDATE SET
          vector = excluded.vector,
          dimension = excluded.dimension,
          updated_at = datetime('now');
      `);
      stmt.run(entityId, buffer, float32.length);
    } catch (err) {
      log.error('Failed to upsert entity vector:', err.message);
    }
  }

  getAllEntityVectors() {
    if (!this.db) return [];
    try {
      const rows = this.db.prepare('SELECT entity_id, vector, dimension FROM entity_embeddings').all();
      return rows.map(r => {
        const buf = r.vector;
        const float32 = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
        return { entityId: r.entity_id, vector: float32, dimension: r.dimension };
      });
    } catch {
      return [];
    }
  }

  close() {
    if (this.db) {
      try {
        this.db.close();
        this.db = null;
        this.isInitialized = false;
        log.info('GraphDB closed');
      } catch (err) {
        log.error('Error closing GraphDB:', err);
      }
    }
  }

  clear() {
    if (!this.db) throw new Error('Database not initialized');
    this.db.exec('DELETE FROM relationships;');
    this.db.exec('DELETE FROM evidence;');
    this.db.exec('DELETE FROM entity_aliases;');
    this.db.exec('DELETE FROM entities;');
    try { this.db.exec('DELETE FROM communities;'); } catch { /* ignore */ }
    try { this.db.exec('DELETE FROM graph_versions;'); } catch { /* ignore */ }
    try { this.db.exec('DELETE FROM entity_fts;'); } catch { /* ignore */ }
    log.info('GraphDB cleared');
  }

  /**
   * Execute callback inside a single SQLite transaction
   */
  runTransaction(fn) {
    if (!this.db) throw new Error('Database not initialized');
    this.db.exec('BEGIN;');
    try {
      const result = fn();
      this.db.exec('COMMIT;');
      return result;
    } catch (err) {
      try { this.db.exec('ROLLBACK;'); } catch { /* ignore rollback errors */ }
      throw err;
    }
  }

  /**
   * Upsert an entity into property graph
   */
  upsertEntity({ id, type = 'Entity', name, canonical_name = null, note_path = null, properties = {}, confidence = 1.0 }) {
    if (!this.db) throw new Error('Database not initialized');

    const canonical = canonical_name || name;
    const propertiesJson = typeof properties === 'string' ? properties : JSON.stringify(properties);

    try {
      const query = `
        INSERT INTO entities (id, name, canonical_name, type, note_path, properties, confidence, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          canonical_name = excluded.canonical_name,
          type = excluded.type,
          note_path = excluded.note_path,
          properties = excluded.properties,
          confidence = excluded.confidence,
          source_count = COALESCE(entities.source_count, 1) + 1,
          updated_at = datetime('now');
      `;
      this.db.prepare(query).run(id, name, canonical, type, note_path, propertiesJson, confidence);
    } catch {
      const fallbackQuery = `
        INSERT INTO entities (id, name, canonical_name, type, note_path, properties, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          canonical_name = excluded.canonical_name,
          type = excluded.type,
          note_path = excluded.note_path,
          properties = excluded.properties,
          source_count = COALESCE(entities.source_count, 1) + 1,
          updated_at = datetime('now');
      `;
      this.db.prepare(fallbackQuery).run(id, name, canonical, type, note_path, propertiesJson);
    }

    try {
      this.db.prepare('DELETE FROM entity_fts WHERE entity_id = ?').run(id);
      this.db.prepare('INSERT INTO entity_fts (entity_id, name, canonical_name, type) VALUES (?, ?, ?, ?)').run(id, name, canonical, type);
    } catch { /* ignore FTS sync error */ }
  }

  deleteEntity(id) {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare('DELETE FROM entities WHERE id = ?');
    stmt.run(id);
    try { this.db.prepare('DELETE FROM entity_fts WHERE entity_id = ?').run(id); } catch { /* ignore FTS sync error */ }
  }

  /**
   * Delete note entity, associated evidence, and incoming/outgoing relationships
   */
  deleteNoteEntityAndRelationships(notePath) {
    if (!this.db || !notePath) return;
    try {
      const EntityResolver = require('./EntityResolver');
      const er = new EntityResolver(this);
      const noteName = er.cleanName(path.basename(notePath, '.md'));
      const entityId = er.generateEntityId(noteName, 'Note');

      this.db.exec('BEGIN');
      try {
        this.db.prepare('DELETE FROM relationships WHERE source_id = ? OR target_id = ?').run(entityId, entityId);
        this.db.prepare('DELETE FROM evidence WHERE source_id = ?').run(notePath);
        this.db.prepare('DELETE FROM entities WHERE id = ? OR note_path = ?').run(entityId, notePath);
        try { this.db.prepare('DELETE FROM entity_fts WHERE entity_id = ?').run(entityId); } catch { /* ignore */ }
        this.db.exec('COMMIT');
        log.info(`Deleted note graph data for entity: ${entityId}`);
      } catch (txnErr) {
        this.db.exec('ROLLBACK');
        throw txnErr;
      }
    } catch (err) {
      log.error(`Failed to delete note graph data for ${notePath}:`, err.message);
    }
  }

  /**
   * Check if a note's graph representation is up to date based on file modification timestamp
   */
  isNoteUpToDate(notePath, mtimeMs) {
    if (!this.db || !notePath) return false;
    try {
      const normPath = String(notePath || '').trim();
      const row = this.db.prepare('SELECT updated_at FROM entities WHERE note_path = ? OR LOWER(note_path) = LOWER(?) LIMIT 1').get(normPath, normPath);
      if (!row || !row.updated_at) return false;

      // SQLite datetime('now') stores UTC string 'YYYY-MM-DD HH:MM:SS'
      const utcString = row.updated_at.includes('T') ? row.updated_at : row.updated_at.replace(' ', 'T') + 'Z';
      const dbTime = new Date(utcString).getTime();
      if (isNaN(dbTime)) return false;

      return dbTime >= (mtimeMs - 1000); // 1-second tolerance
    } catch {
      return false;
    }
  }

  /**
   * Alias for deleteNoteEntityAndRelationships (used by background worker)
   */
  deleteNoteData(notePath) {
    this.deleteNoteEntityAndRelationships(notePath);
  }

  /**
   * Upsert a relationship with confidence, extractor tag, and optional evidence linkage
   */
  upsertRelationship({ source_id, target_id, type, weight = 1.0, confidence = 1.0, metadata = {}, evidence_id = null, extractor = 'ast_parser' }) {
    if (!this.db) throw new Error('Database not initialized');
    if (!source_id || !target_id || source_id === target_id) return;

    const clampedConfidence = Math.max(0.0, Math.min(1.0, typeof confidence === 'number' ? confidence : parseFloat(confidence) || 1.0));

    const query = `
      INSERT INTO relationships (source_id, target_id, type, weight, confidence, extractor, metadata, evidence_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source_id, target_id, type) DO UPDATE SET
        weight = excluded.weight,
        confidence = excluded.confidence,
        extractor = excluded.extractor,
        metadata = excluded.metadata,
        evidence_id = COALESCE(excluded.evidence_id, relationships.evidence_id);
    `;

    const metadataJson = typeof metadata === 'string' ? metadata : JSON.stringify(metadata);
    const stmt = this.db.prepare(query);
    try {
      stmt.run(source_id, target_id, type, weight, clampedConfidence, extractor, metadataJson, evidence_id);
      if (evidence_id) {
        try {
          const relRow = this.db.prepare('SELECT id FROM relationships WHERE source_id = ? AND target_id = ? AND type = ?').get(source_id, target_id, type);
          if (relRow?.id) {
            this.db.prepare('INSERT OR IGNORE INTO relationship_evidence (relationship_id, evidence_id) VALUES (?, ?)').run(relRow.id, evidence_id);
          }
        } catch { /* ignore junction insert error */ }
      }
    } catch (err) {
      if (err.message?.includes('FOREIGN KEY') && evidence_id) {
        stmt.run(source_id, target_id, type, weight, clampedConfidence, extractor, metadataJson, null);
      } else {
        throw err;
      }
    }
  }

  getStatus(minConfidence = 0.0) {
    if (!this.db) return { nodeCount: 0, edgeCount: 0, sizeBytes: 0 };

    const nodeCount = this.getNodeCount(minConfidence);
    const edgeCount = this.getEdgeCount(minConfidence);

    let sizeBytes = 0;
    try {
      sizeBytes = fs.statSync(this.dbPath).size;
    } catch (err) {
      log.debug('Failed to get database file stats:', err.message);
    }

    return { nodeCount, edgeCount, sizeBytes };
  }

  getNodeCount(minConfidence = 0.0) {
    if (!this.db) return 0;
    try {
      return this.db.prepare('SELECT COUNT(*) as count FROM entities WHERE confidence >= ?').get(minConfidence)?.count || 0;
    } catch {
      try { return this.db.prepare('SELECT COUNT(*) as count FROM entities').get()?.count || 0; } catch { return 0; }
    }
  }

  getEdgeCount(minConfidence = 0.0) {
    if (!this.db) return 0;
    try {
      return this.db.prepare('SELECT COUNT(*) as count FROM relationships WHERE confidence >= ?').get(minConfidence)?.count || 0;
    } catch {
      try { return this.db.prepare('SELECT COUNT(*) as count FROM relationships').get()?.count || 0; } catch { return 0; }
    }
  }

  clearAllData() {
    if (!this.db) return;
    try {
      this.db.exec('BEGIN; DELETE FROM relationships; DELETE FROM evidence; DELETE FROM entity_aliases; DELETE FROM entities; COMMIT;');
      try { this.db.exec('DELETE FROM entity_fts;'); } catch { /* ignore */ }
    } catch (err) {
      try { this.db.exec('ROLLBACK'); } catch { /* ignore */ }
      log.error('Failed to clear graph database:', err.message);
    }
  }

  getAll(minConfidence = 0.0) {
    if (!this.db) throw new Error('Database not initialized');

    let rawEntities = [];
    try {
      rawEntities = this.db.prepare('SELECT * FROM entities WHERE confidence >= ?').all(minConfidence);
    } catch {
      rawEntities = this.db.prepare('SELECT * FROM entities').all();
    }

    const entities = rawEntities
      .map(e => {
        const props = typeof e.properties === 'string' ? JSON.parse(e.properties || '{}') : (e.properties || {});
        const conf = typeof e.confidence === 'number' ? e.confidence : (typeof props.confidence === 'number' ? props.confidence : 1.0);
        return { ...e, confidence: conf, properties: props };
      })
      .filter(e => e.confidence >= minConfidence);

    const validEntityIds = new Set(entities.map(e => e.id));

    let rawRelationships = [];
    try {
      rawRelationships = this.db.prepare('SELECT * FROM relationships WHERE confidence >= ?').all(minConfidence);
    } catch {
      rawRelationships = this.db.prepare('SELECT * FROM relationships').all();
    }

    const relationships = rawRelationships
      .filter(r => (r.confidence ?? 1.0) >= minConfidence && validEntityIds.has(r.source_id) && validEntityIds.has(r.target_id))
      .map(r => ({
        ...r,
        confidence: r.confidence ?? 1.0,
        metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata || '{}') : (r.metadata || {})
      }));

    return { entities, relationships };
  }

  /**
   * Find entity by note path
   */
  getEntityByPath(notePath) {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare('SELECT * FROM entities WHERE note_path = ? OR LOWER(note_path) = LOWER(?) LIMIT 1');
      const row = stmt.get(notePath, notePath);
      if (!row) return null;
      return { ...row, properties: JSON.parse(row.properties || '{}') };
    } catch {
      return null;
    }
  }

  /**
   * Recursive CTE neighbor search up to depth N (default 3)
   */
  getNeighbors(entityId, maxDepth = 3) {
    if (!this.db) throw new Error('Database not initialized');

    const cteQuery = `
      WITH RECURSIVE connected(id, depth) AS (
        SELECT ? as id, 0 as depth
        UNION
        SELECT r.target_id, c.depth + 1
        FROM relationships r JOIN connected c ON r.source_id = c.id
        WHERE c.depth < ?
        UNION
        SELECT r.source_id, c.depth + 1
        FROM relationships r JOIN connected c ON r.target_id = c.id
        WHERE c.depth < ?
      )
      SELECT DISTINCT e.*, c.depth 
      FROM entities e 
      JOIN connected c ON e.id = c.id;
    `;

    const stmt = this.db.prepare(cteQuery);
    const nodes = stmt.all(entityId, maxDepth, maxDepth).map(e => ({
      ...e,
      properties: JSON.parse(e.properties || '{}')
    }));

    if (nodes.length === 0) return { nodes: [], edges: [] };

    const nodeIds = nodes.map(n => n.id);
    const placeholders = nodeIds.map(() => '?').join(',');
    const relsQuery = `
      SELECT * FROM relationships 
      WHERE source_id IN (${placeholders}) AND target_id IN (${placeholders});
    `;

    const relsStmt = this.db.prepare(relsQuery);
    const edges = relsStmt.all(...nodeIds, ...nodeIds).map(r => ({
      ...r,
      metadata: JSON.parse(r.metadata || '{}')
    }));

    return { nodes, edges };
  }

  /**
   * Traversal by note path or entity ID/name with evidence context
   */
  traversePathOrId(identifier, maxDepth = 2) {
    if (!this.db || !identifier) return [];
    const rawTarget = String(identifier).trim();
    const cleanTarget = rawTarget
      .replace(/^(who|what|where|how|why)\s+(is|was|are|were|about)\s+/i, '')
      .replace(/\?$/g, '')
      .trim();

    const targets = Array.from(new Set([cleanTarget, rawTarget])).filter(Boolean);
    const startEntities = [];
    const seenEntityIds = new Set();

    for (const target of targets) {
      const eByPath = this.getEntityByPath(target);
      if (eByPath && !seenEntityIds.has(eByPath.id)) {
        seenEntityIds.add(eByPath.id);
        startEntities.push(eByPath);
      }
      try {
        const stmt = this.db.prepare('SELECT * FROM entities WHERE LOWER(name) = LOWER(?) OR id = ?');
        const rows = stmt.all(target, target);
        for (const r of rows) {
          if (!seenEntityIds.has(r.id)) {
            seenEntityIds.add(r.id);
            startEntities.push(r);
          }
        }
      } catch { /* ignore lookup error */ }
      try {
        const stmt = this.db.prepare('SELECT * FROM entities WHERE LOWER(name) LIKE LOWER(?)');
        const rows = stmt.all(`%${target}%`);
        for (const r of rows) {
          if (!seenEntityIds.has(r.id)) {
            seenEntityIds.add(r.id);
            startEntities.push(r);
          }
        }
      } catch { /* ignore lookup error */ }
    }

    // Fallback: If full phrase doesn't yield entities, match individual word tokens (e.g. "Bikash", "Panda")
    if (startEntities.length === 0 && cleanTarget.includes(' ')) {
      const words = cleanTarget.split(/\s+/).filter(w => w.length > 2 && !/^(who|what|where|how|why|is|was|are|were|about|the|and)$/i.test(w));
      for (const word of words) {
        try {
          const stmt = this.db.prepare('SELECT * FROM entities WHERE LOWER(name) = LOWER(?) OR LOWER(name) LIKE LOWER(?)');
          const rows = stmt.all(word, `%${word}%`);
          for (const r of rows) {
            if (!seenEntityIds.has(r.id)) {
              seenEntityIds.add(r.id);
              startEntities.push(r);
            }
          }
        } catch { /* ignore token lookup error */ }
      }
    }

    if (startEntities.length === 0) return [];

    const allEdges = [];
    const allNodes = [];
    const seenEdgeIds = new Set();

    for (const startEntity of startEntities) {
      const { nodes, edges } = this.getNeighbors(startEntity.id, maxDepth);
      for (const n of nodes) allNodes.push(n);
      for (const e of edges) {
        const edgeKey = `${e.source_id}->${e.target_id}:${e.type}`;
        if (!seenEdgeIds.has(edgeKey)) {
          seenEdgeIds.add(edgeKey);
          allEdges.push(e);
        }
      }
    }

    const nodeMap = new Map(allNodes.map(n => [n.id, n]));

    return allEdges.map(e => {
      const srcNode = nodeMap.get(e.source_id);
      const tgtNode = nodeMap.get(e.target_id);
      let evidenceText = null;
      if (e.evidence_id) {
        try {
          const ev = this.db.prepare('SELECT raw_sentence FROM evidence WHERE id = ?').get(e.evidence_id);
          evidenceText = ev?.raw_sentence || null;
        } catch {
          /* ignore evidence lookup error */
        }
      }
      return {
        from_id: e.source_id,
        from_name: srcNode?.name || e.source_id,
        from_type: srcNode?.type || 'Entity',
        from_path: srcNode?.note_path || srcNode?.name || e.source_id,
        relation: e.type,
        to_id: e.target_id,
        to_name: tgtNode?.name || e.target_id,
        to_type: tgtNode?.type || 'Entity',
        to_path: tgtNode?.note_path || tgtNode?.name || e.target_id,
        weight: e.weight || 1.0,
        confidence: e.confidence || 1.0,
        evidence: evidenceText
      };
    });
  }

  findPath(sourceId, targetId, maxDepth = 5) {
    if (!this.db) throw new Error('Database not initialized');

    const cteQuery = `
      WITH RECURSIVE paths(id, path_str, depth) AS (
        SELECT ? as id, CAST(? AS TEXT) as path_str, 0 as depth
        UNION
        SELECT r.target_id, p.path_str || ',' || r.target_id, p.depth + 1
        FROM relationships r JOIN paths p ON r.source_id = p.id
        WHERE p.depth < ? AND p.path_str NOT LIKE '%' || r.target_id || '%'
      )
      SELECT path_str FROM paths WHERE id = ? ORDER BY depth ASC LIMIT 1;
    `;

    const stmt = this.db.prepare(cteQuery);
    const result = stmt.get(sourceId, sourceId, maxDepth, targetId);

    if (!result) return null;
    return result.path_str.split(',');
  }

  getNoteRelationshipCount(notePath) {
    if (!this.db) return 0;
    try {
      let entityId = notePath;
      const row = this.db.prepare('SELECT id FROM entities WHERE note_path = ? OR LOWER(note_path) = LOWER(?) OR id = ? LIMIT 1').get(notePath, notePath, notePath);
      if (row && row.id) {
        entityId = row.id;
      } else {
        const EntityResolver = require('./EntityResolver');
        const er = new EntityResolver(this);
        const noteName = er.cleanName(path.basename(notePath, '.md'));
        entityId = er.generateEntityId(noteName, 'Note');
      }
      
      const relCountRow = this.db.prepare('SELECT COUNT(*) as count FROM relationships WHERE source_id = ? OR target_id = ?').get(entityId, entityId);
      return relCountRow?.count || 0;
    } catch (err) {
      log.error('Failed to get relationship count for note:', err.message);
      return 0;
    }
  }

  /**
   * Calculate degree centrality, node colors, and rich visualization payload for UI graph view
   */
  getRichGraphVisualization(limit = 150, minConfidence = 0.0) {
    if (!this.db) return { nodes: [], edges: [], stats: { totalNodes: 0, totalEdges: 0, networkDensity: 0 } };

    try {
      const rawEntities = this.db.prepare('SELECT * FROM entities WHERE confidence >= ? LIMIT ?').all(minConfidence, limit);
      const rawRelationships = this.db.prepare('SELECT * FROM relationships WHERE confidence >= ? LIMIT ?').all(minConfidence, limit * 3);

      // Compute degree centrality (incoming + outgoing connections per node)
      const degreeMap = new Map();
      rawRelationships.forEach(r => {
        degreeMap.set(r.source_id, (degreeMap.get(r.source_id) || 0) + 1);
        degreeMap.set(r.target_id, (degreeMap.get(r.target_id) || 0) + 1);
      });

      // Dynamic color generation via string hashing (zero hardcoded entity types)
      const getTypeColor = (typeStr) => {
        const str = String(typeStr || 'Entity').trim();
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          hash = (str.charCodeAt(i) + ((hash << 5) - hash)) | 0;
        }
        const hue = Math.abs(hash) % 360;
        return `hsl(${hue}, 70%, 50%)`;
      };

      const validNodeIds = new Set(rawEntities.map(e => e.id));

      const nodes = rawEntities.map(e => {
        const degree = degreeMap.get(e.id) || 0;
        const color = getTypeColor(e.type);
        return {
          id: e.id,
          label: e.name || e.canonical_name || e.id,
          type: e.type || 'Entity',
          note_path: e.note_path,
          degree,
          size: Math.min(36, 10 + degree * 3),
          color,
          properties: JSON.parse(e.properties || '{}')
        };
      });

      const edges = [];
      const seenEdgeKeys = new Set();

      rawRelationships.forEach(r => {
        if (validNodeIds.has(r.source_id) && validNodeIds.has(r.target_id)) {
          const key = `${r.source_id}:${r.target_id}:${r.type}`;
          if (!seenEdgeKeys.has(key)) {
            seenEdgeKeys.add(key);
            edges.push({
              id: r.id,
              source: r.source_id,
              target: r.target_id,
              type: r.type,
              weight: r.weight || 1.0,
              confidence: r.confidence || 1.0
            });
          }
        }
      });

      const totalNodes = nodes.length;
      const totalEdges = edges.length;
      const networkDensity = totalNodes > 1 ? (2 * totalEdges) / (totalNodes * (totalNodes - 1)) : 0;

      const hubs = [...nodes].sort((a, b) => b.degree - a.degree).slice(0, 5).map(n => ({ id: n.id, label: n.label, degree: n.degree }));

      return {
        nodes,
        edges,
        stats: {
          totalNodes,
          totalEdges,
          networkDensity: parseFloat(networkDensity.toFixed(4)),
          hubNodes: hubs
        }
      };
    } catch (err) {
      log.error('Failed to generate rich graph visualization:', err.message);
      return { nodes: [], edges: [], stats: { totalNodes: 0, totalEdges: 0, networkDensity: 0 } };
    }
  }

  upsertWorkspaceEntity({ name = 'Workspace', description = '', projectType = 'General', primaryGoal = '', domainTags = [] }) {
    if (!this.db) return;
    try {
      const tagsJson = Array.isArray(domainTags) ? JSON.stringify(domainTags) : String(domainTags || '[]');
      this.db.exec('DELETE FROM workspace_entity;');
      const stmt = this.db.prepare(`
        INSERT INTO workspace_entity (name, description, project_type, primary_goal, domain_tags, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `);
      stmt.run(name, description, projectType, primaryGoal, tagsJson);
    } catch (err) {
      log.error('Failed to upsert workspace entity:', err.message);
    }
  }

  getWorkspaceEntity() {
    if (!this.db) return null;
    try {
      const row = this.db.prepare('SELECT * FROM workspace_entity ORDER BY id DESC LIMIT 1').get();
      if (!row) return null;
      return { ...row, domain_tags: JSON.parse(row.domain_tags || '[]') };
    } catch {
      return null;
    }
  }

  snapshotVersion(versionName = 'v1.0') {
    if (!this.db) return null;
    try {
      const entityCount = this.getNodeCount();
      const edgeCount = this.getEdgeCount();
      const stmt = this.db.prepare('INSERT INTO graph_versions (version, entity_count, edge_count) VALUES (?, ?, ?)');
      stmt.run(versionName, entityCount, edgeCount);
      return true;
    } catch (err) {
      log.error('Failed to snapshot graph version:', err.message);
      return false;
    }
  }

  searchEntities(queryStr, limit = 20) {
    if (!this.db || !queryStr) return [];
    try {
      const clean = String(queryStr).trim();
      if (!clean) return [];
      try {
        const stmt = this.db.prepare('SELECT entity_id, name, canonical_name, type FROM entity_fts WHERE entity_fts MATCH ? LIMIT ?');
        return stmt.all(`${clean}*`, limit);
      } catch {
        const stmt = this.db.prepare('SELECT id as entity_id, name, canonical_name, type FROM entities WHERE LOWER(name) LIKE LOWER(?) LIMIT ?');
        return stmt.all(`%${clean}%`, limit);
      }
    } catch (err) {
      log.error('Failed searchEntities:', err.message);
      return [];
    }
  }

  exportAsJSON(_options = {}) {
    if (!this.db) {
      return {
        metadata: { exportedAt: new Date().toISOString(), error: 'Database not initialized' },
        statistics: { entityCount: 0, relationshipCount: 0, evidenceCount: 0, communityCount: 0, evidenceCoverageRatio: 0 },
        entities: [],
        relationships: [],
        evidence: [],
        validation: null
      };
    }

    try {
      const entities = this.db.prepare('SELECT * FROM entities').all().map(e => ({
        ...e,
        properties: typeof e.properties === 'string' ? JSON.parse(e.properties || '{}') : (e.properties || {})
      }));

      const relationships = this.db.prepare('SELECT * FROM relationships').all().map(r => ({
        ...r,
        metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata || '{}') : (r.metadata || {})
      }));

      let evidence = [];
      try {
        evidence = this.db.prepare('SELECT * FROM evidence').all();
      } catch { /* ignore */ }

      let lastVersion = null;
      try {
        lastVersion = this.db.prepare('SELECT * FROM graph_versions ORDER BY id DESC LIMIT 1').get()?.version || 'v1.0';
      } catch { /* ignore */ }

      const workspaceEnt = this.getWorkspaceEntity();

      const confidenceDistribution = {
        '0.9-1.0': 0,
        '0.8-0.9': 0,
        '0.7-0.8': 0,
        '0.6-0.7': 0,
        'below-0.6': 0
      };
      relationships.forEach(r => {
        const c = r.confidence ?? 1.0;
        if (c >= 0.9) confidenceDistribution['0.9-1.0']++;
        else if (c >= 0.8) confidenceDistribution['0.8-0.9']++;
        else if (c >= 0.7) confidenceDistribution['0.7-0.8']++;
        else if (c >= 0.6) confidenceDistribution['0.6-0.7']++;
        else confidenceDistribution['below-0.6']++;
      });

      const typeDistribution = {};
      entities.forEach(e => {
        const t = e.type || 'Entity';
        typeDistribution[t] = (typeDistribution[t] || 0) + 1;
      });

      const totalRels = relationships.length;
      const relsWithEv = relationships.filter(r => r.evidence_id).length;
      const evidenceCoverageRatio = totalRels > 0 ? parseFloat((relsWithEv / totalRels).toFixed(4)) : 1.0;

      const degreeMap = new Map();
      relationships.forEach(r => {
        degreeMap.set(r.source_id, (degreeMap.get(r.source_id) || 0) + 1);
        degreeMap.set(r.target_id, (degreeMap.get(r.target_id) || 0) + 1);
      });
      const topHubs = [...entities]
        .map(e => ({ id: e.id, name: e.name, type: e.type, degree: degreeMap.get(e.id) || 0 }))
        .sort((a, b) => b.degree - a.degree)
        .slice(0, 5);

      let communityCount = 0;
      try {
        communityCount = this.db.prepare('SELECT COUNT(*) as count FROM communities').get()?.count || 0;
        if (communityCount === 0 && entities.length > 0) {
          const CommunityDetector = require('./CommunityDetector');
          const detector = new CommunityDetector();
          const res = detector.detect(this);
          communityCount = res.communityCount || 0;
        }
      } catch { /* ignore */ }

      let validation = null;
      try {
        const GraphValidationEngine = require('./GraphValidationEngine');
        const validator = new GraphValidationEngine(this);
        validation = validator.validateSync();
      } catch { /* ignore */ }

      return {
        metadata: {
          exportedAt: new Date().toISOString(),
          graphVersion: lastVersion || 'v1.0',
          schemaVersion: '1.0',
          pipelineVersion: '1.0',
          extractionModel: 'gliner2-relex',
          embeddingModel: null,
          workspaceName: workspaceEnt?.name || 'Workspace',
          workspaceHash: null,
          buildDurationMs: null
        },
        statistics: {
          entityCount: entities.length,
          relationshipCount: relationships.length,
          evidenceCount: evidence.length,
          communityCount,
          evidenceCoverageRatio,
          avgConfidence: totalRels > 0 ? parseFloat((relationships.reduce((s, r) => s + (r.confidence ?? 1.0), 0) / totalRels).toFixed(4)) : 1.0,
          confidenceDistribution,
          typeDistribution,
          topHubs
        },
        entities,
        relationships,
        evidence,
        validation
      };
    } catch (err) {
      log.error('Failed exportAsJSON:', err.message);
      return {
        metadata: { exportedAt: new Date().toISOString(), error: err.message },
        statistics: { entityCount: 0, relationshipCount: 0, evidenceCount: 0, communityCount: 0, evidenceCoverageRatio: 0 },
        entities: [],
        relationships: [],
        evidence: [],
        validation: null
      };
    }
  }

  exportAsMarkdown(options = {}) {
    const json = this.exportAsJSON(options);
    const { metadata, statistics, entities, relationships, validation } = json;

    const lines = [];
    lines.push('# Knowledge Graph Export');
    lines.push(`Generated: ${metadata.exportedAt}`);
    lines.push(`Graph Version: ${metadata.graphVersion}`);
    lines.push('');

    lines.push('## Metadata');
    lines.push(`- Workspace: ${metadata.workspaceName}`);
    lines.push(`- Schema Version: ${metadata.schemaVersion}`);
    lines.push(`- Extraction Model: ${metadata.extractionModel}`);
    lines.push('');

    lines.push('## Statistics');
    lines.push(`- Entities: ${statistics.entityCount}`);
    lines.push(`- Relationships: ${statistics.relationshipCount}`);
    lines.push(`- Evidence Records: ${statistics.evidenceCount}`);
    lines.push(`- Communities: ${statistics.communityCount}`);
    lines.push(`- Evidence Coverage: ${(statistics.evidenceCoverageRatio * 100).toFixed(1)}%`);
    lines.push(`- Avg Confidence: ${statistics.avgConfidence}`);
    lines.push('');

    if (statistics.topHubs?.length > 0) {
      lines.push('## Top Hub Entities');
      statistics.topHubs.forEach(h => {
        lines.push(`- **${h.name}** (${h.type}, degree: ${h.degree})`);
      });
      lines.push('');
    }

    if (validation) {
      lines.push('## Validation Summary');
      lines.push(`- Orphan Entities: ${validation.orphans || 0}`);
      lines.push(`- Self Loops: ${validation.selfLoops || 0}`);
      lines.push(`- Duplicate Edges: ${validation.duplicateEdges || 0}`);
      lines.push(`- Evidenceless AI Edges: ${validation.evidencelessEdges || 0}`);
      lines.push(`- Evidence Coverage Ratio: ${((validation.evidenceCoverageRatio || 0) * 100).toFixed(1)}%`);
      lines.push('');
    }

    lines.push('## Entities');
    const byType = {};
    entities.forEach(e => {
      const t = e.type || 'Entity';
      if (!byType[t]) byType[t] = [];
      byType[t].push(e);
    });

    Object.keys(byType).sort().forEach(type => {
      lines.push(`### ${type}`);
      byType[type].forEach(e => {
        const pathInfo = e.note_path ? ` [${e.note_path}]` : '';
        lines.push(`- **${e.name}** (confidence: ${e.confidence ?? 1.0})${pathInfo}`);
      });
      lines.push('');
    });

    lines.push('## Relationships');
    const entityNameMap = new Map(entities.map(e => [e.id, e.name]));
    relationships.forEach(r => {
      const srcName = entityNameMap.get(r.source_id) || r.source_id;
      const tgtName = entityNameMap.get(r.target_id) || r.target_id;
      lines.push(`- [${srcName}] --[${r.type}]--> [${tgtName}] (confidence: ${r.confidence ?? 1.0})`);
    });
    lines.push('');

    return lines.join('\n');
  }
}

module.exports = GraphDB;
