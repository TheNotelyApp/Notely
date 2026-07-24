const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createLogger } = require('../core/logger');
const { PersonaStandard } = require('../personas/PersonaStandard');

const log = createLogger('PersonaDB');

// Default fields required in frontmatter for persona md files
const REQUIRED_FIELDS = ['name', 'description', 'version'];

class PersonaDB {
  constructor(appDataDir) {
    this.appDataDir = appDataDir;
    this.personasDir = path.join(appDataDir, 'personas');
    this.dbPath = path.join(appDataDir, 'personas.db');
    this.db = null;
  }

  initialize() {
    try {
      if (!fs.existsSync(this.appDataDir)) {
        fs.mkdirSync(this.appDataDir, { recursive: true });
      }
      if (!fs.existsSync(this.personasDir)) {
        fs.mkdirSync(this.personasDir, { recursive: true });
      }

      const { DatabaseSync } = require('node:sqlite');
      this.db = new DatabaseSync(this.dbPath);

      this.db.exec('PRAGMA journal_mode = WAL');
      this.db.exec('PRAGMA synchronous = NORMAL');

      this._createTables();
      this._seedBuiltins();
      log.info(`PersonaDB initialized at: ${this.dbPath}`);
      return true;
    } catch (err) {
      log.error('Failed to initialize PersonaDB', err);
      throw err;
    }
  }

  _createTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS personas (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        file_path TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'custom',
        version TEXT DEFAULT '1.0.0',
        avatar TEXT DEFAULT '👤',
        content_hash TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    
    // Migration: Add content_hash column if it does not exist (older databases)
    try {
      this.db.exec("ALTER TABLE personas ADD COLUMN content_hash TEXT");
    } catch {
      // Column already exists, ignore error
    }
  }

  static computeHash(content) {
    return crypto.createHash('sha256').update(content || '', 'utf8').digest('hex');
  }

  _seedBuiltins() {
    const now = new Date().toISOString();
    let templatesDir = path.join(__dirname, '..', '..', 'resources', 'prompts', 'personas');
    
    if (!fs.existsSync(templatesDir)) {
      templatesDir = path.join(__dirname, '..', 'personas');
    }
    
    if (!fs.existsSync(templatesDir)) {
      log.warn(`Packaged personas templates directory not found at: ${templatesDir}`);
      return;
    }

    const files = fs.readdirSync(templatesDir).filter(f => f.endsWith('.md'));
    const insert = this.db.prepare(
      `INSERT INTO personas (id, name, description, file_path, type, version, avatar, content_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name, description=excluded.description, file_path=excluded.file_path,
         type=excluded.type, version=excluded.version, avatar=excluded.avatar, content_hash=excluded.content_hash, updated_at=excluded.updated_at`
    );

    for (const file of files) {
      const srcPath = path.join(templatesDir, file);
      const id = file.slice(0, -3); // e.g. 'general', 'brainstorming'
      const destPath = path.join(this.personasDir, file);

      try {
        // ALWAYS copy/overwrite builtin template file to appDataDir/personas/
        fs.copyFileSync(srcPath, destPath);

        const rawContent = fs.readFileSync(destPath, 'utf8');
        const contentHash = PersonaDB.computeHash(rawContent);
        const { meta } = PersonaDB.parsePersonaFile(destPath);
        insert.run(
          id,
          meta.name || id,
          meta.description || '',
          destPath,
          'builtin',
          meta.version || '1.0.0',
          meta.avatar || '👤',
          contentHash,
          now,
          now
        );
      } catch (err) {
        log.error(`Failed to seed builtin persona from ${file}:`, err);
      }
    }
  }

  list() {
    const rows = this.db.prepare('SELECT * FROM personas ORDER BY type DESC, name ASC').all();
    return rows.map(r => this._hydratePersonaRow(r)).filter(Boolean);
  }

  get(id) {
    const row = this.db.prepare('SELECT * FROM personas WHERE id = ?').get(id);
    if (!row) return null;
    return this._hydratePersonaRow(row);
  }

  _hydratePersonaRow(row) {
    if (!row || !row.file_path || !fs.existsSync(row.file_path)) {
      return {
        ...row,
        prompt: '',
        meta: {}
      };
    }
    try {
      const rawContent = fs.readFileSync(row.file_path, 'utf8');
      const contentHash = PersonaDB.computeHash(rawContent);
      const { meta, prompt } = PersonaDB.parsePersonaFile(row.file_path);
      return {
        ...row,
        ...meta,
        id: row.id,
        name: meta.name || row.name,
        description: meta.description || row.description,
        avatar: meta.avatar || row.avatar || '👤',
        type: row.type,
        version: meta.version || row.version || '1.0.0',
        file_path: row.file_path,
        content_hash: contentHash,
        prompt,
        meta
      };
    } catch (err) {
      log.warn(`Failed to parse persona file ${row.file_path}:`, err.message);
      return {
        ...row,
        prompt: '',
        meta: {}
      };
    }
  }

  save(persona) {
    const now = new Date().toISOString();
    const existing = this.get(persona.id);
    if (existing && existing.type === 'builtin') {
      throw new Error('Cannot modify system default personas.');
    }

    let filePath = persona.file_path || existing?.file_path;
    if (!filePath) {
      filePath = path.join(this.personasDir, `${persona.id}.md`);
    }

    // Write full stitched markdown to disk first
    const markdownContent = PersonaStandard.formatPersonaMarkdown(persona);
    fs.writeFileSync(filePath, markdownContent, 'utf8');

    const contentHash = PersonaDB.computeHash(markdownContent);
    // Parse back to confirm validity
    const { meta } = PersonaDB.parsePersonaFile(filePath);

    // Upsert into SQLite DB registry
    this.db.prepare(
      `INSERT INTO personas (id, name, description, file_path, type, version, avatar, content_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name, description=excluded.description, file_path=excluded.file_path,
         type=excluded.type, version=excluded.version, avatar=excluded.avatar, content_hash=excluded.content_hash, updated_at=excluded.updated_at`
    ).run(
      persona.id, meta.name || persona.name, meta.description || persona.description || '', filePath,
      persona.type ?? 'custom', meta.version || persona.version || '1.0.0', meta.avatar || persona.avatar || '👤', contentHash, now, now
    );

    return this.get(persona.id);
  }

  delete(id) {
    const row = this.get(id);
    if (row && row.type === 'builtin') throw new Error('Cannot delete built-in personas.');
    this.db.prepare('DELETE FROM personas WHERE id = ?').run(id);
    if (row && row.file_path && fs.existsSync(row.file_path)) {
      fs.unlinkSync(row.file_path);
    }
  }

  static parsePersonaFile(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.startsWith('---')) {
      throw new Error('Invalid persona file: must begin with YAML frontmatter (---).');
    }

    const endFM = raw.indexOf('\n---', 3);
    if (endFM === -1) {
      throw new Error('Invalid persona file: frontmatter closing (---) not found.');
    }

    const fmText = raw.slice(3, endFM).trim();
    const prompt = raw.slice(endFM + 4).trim();

    if (!prompt) {
      throw new Error('Invalid persona file: system prompt body is empty after frontmatter.');
    }

    const meta = {};
    for (const line of fmText.split('\n')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
      meta[key] = val;
    }

    for (const field of REQUIRED_FIELDS) {
      if (!meta[field]) {
        throw new Error(`Invalid persona file: missing required frontmatter field "${field}".`);
      }
    }

    return { meta, prompt };
  }

  importFromFile(srcPath) {
    try {
      const { meta, prompt } = PersonaDB.parsePersonaFile(srcPath);

      const id = meta.id || meta.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const existing = this.get(id);
      if (existing) {
        throw new Error(`A persona with ID or name "${id}" already exists. Rename or change ID to import.`);
      }

      const destPath = path.join(this.personasDir, `${id}.md`);
      if (srcPath !== destPath) {
        fs.copyFileSync(srcPath, destPath);
      }

      this.save({
        id,
        name: meta.name,
        description: meta.description,
        file_path: destPath,
        type: 'custom',
        version: meta.version || '1.0.0',
        avatar: meta.avatar || '👤',
        tone: meta.tone,
        verbosity: meta.verbosity,
        responseStructure: meta.responseStructure,
        clarificationStrategy: meta.clarificationStrategy,
        preferredExamples: meta.preferredExamples,
        fallbackBehaviour: meta.fallbackBehaviour,
        owner: meta.owner,
        systemInstructions: prompt
      });

      return { id, name: meta.name };
    } catch (err) {
      log.error(`Failed to import persona from file: ${srcPath}`, err);
      throw err;
    }
  }

  exportToFile(id, destPath) {
    const row = this.get(id);
    if (!row) throw new Error(`Persona "${id}" not found.`);

    const content = PersonaStandard.formatPersonaMarkdown({
      id: row.id,
      name: row.name,
      description: row.description,
      version: row.version,
      avatar: row.avatar,
      tone: row.tone,
      verbosity: row.verbosity,
      responseStructure: row.responseStructure,
      clarificationStrategy: row.clarificationStrategy,
      preferredExamples: row.preferredExamples,
      fallbackBehaviour: row.fallbackBehaviour,
      owner: row.owner,
      systemInstructions: row.prompt
    });

    fs.writeFileSync(destPath, content, 'utf8');
    return destPath;
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

module.exports = { PersonaDB };
