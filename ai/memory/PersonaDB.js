const fs = require('fs');
const path = require('path');
const { createLogger } = require('../core/logger');

const log = createLogger('PersonaDB');

// Default fields required in frontmatter for persona md files
const REQUIRED_FIELDS = ['name', 'description', 'type', 'version'];

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
        file_path TEXT,
        type TEXT NOT NULL DEFAULT 'custom',
        version TEXT,
        avatar TEXT DEFAULT '👤',
        prompt TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    
    // Migration: Add avatar column if it does not exist (older databases)
    try {
      this.db.exec("ALTER TABLE personas ADD COLUMN avatar TEXT DEFAULT '👤'");
    } catch {
      // Column already exists, ignore error
    }
  }

  _seedBuiltins() {
    const now = new Date().toISOString();
    const templatesDir = path.join(__dirname, '..', 'personas');
    
    if (!fs.existsSync(templatesDir)) {
      log.warn(`Packaged personas templates directory not found at: ${templatesDir}`);
      return;
    }

    const files = fs.readdirSync(templatesDir).filter(f => f.endsWith('.md'));
    const insert = this.db.prepare(
      `INSERT OR REPLACE INTO personas (id, name, description, file_path, type, version, avatar, prompt, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const file of files) {
      const srcPath = path.join(templatesDir, file);
      const id = file.slice(0, -3); // e.g. 'default', 'creative'
      const destPath = path.join(this.personasDir, file);

      try {
        // ALWAYS overwrite default personas in local appDataDir/personas/ with packaged template versions
        fs.copyFileSync(srcPath, destPath);

        const { meta, prompt } = PersonaDB.parsePersonaFile(destPath);
        insert.run(
          id,
          meta.name || id,
          meta.description || '',
          destPath,
          'builtin',
          meta.version || '1.0',
          meta.avatar || '👤',
          prompt,
          now,
          now
        );
      } catch (err) {
        log.error(`Failed to seed builtin persona from ${file}:`, err);
      }
    }
  }

  list() {
    return this.db.prepare('SELECT * FROM personas ORDER BY type DESC, name ASC').all();
  }

  get(id) {
    return this.db.prepare('SELECT * FROM personas WHERE id = ?').get(id) || null;
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

    // Update SQLite DB
    this.db.prepare(
      `INSERT INTO personas (id, name, description, file_path, type, version, avatar, prompt, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name, description=excluded.description, file_path=excluded.file_path,
         type=excluded.type, version=excluded.version, avatar=excluded.avatar, prompt=excluded.prompt, updated_at=excluded.updated_at`
    ).run(
      persona.id, persona.name, persona.description ?? '', filePath,
      persona.type ?? 'custom', persona.version ?? '1.0', persona.avatar ?? '👤', persona.prompt, now, now
    );

    // Sync to disk
    try {
      const content = [
        '---',
        `name: "${persona.name}"`,
        `description: "${persona.description ?? ''}"`,
        `type: "${persona.type ?? 'custom'}"`,
        `version: "${persona.version ?? '1.0'}"`,
        `avatar: "${persona.avatar || '👤'}"`,
        '---',
        '',
        persona.prompt
      ].join('\n');
      fs.writeFileSync(filePath, content, 'utf8');
    } catch (err) {
      log.error(`Failed to write persona changes to disk at ${filePath}:`, err);
    }
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

      const id = meta.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
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
        version: meta.version,
        avatar: meta.avatar || '👤',
        prompt
      });

      return { id, name: meta.name };
    } catch (err) {
      log.error(`Failed to import persona from file: ${srcPath}`, err);
      // Return a placeholder representation
      return { id: 'invalid', name: 'Invalid Persona File' };
    }
  }

  exportToFile(id, destPath) {
    const row = this.get(id);
    if (!row) throw new Error(`Persona "${id}" not found.`);

    const content = [
      '---',
      `name: "${row.name}"`,
      `description: "${row.description}"`,
      `type: "${row.type}"`,
      `version: "${row.version}"`,
      `avatar: "${row.avatar || '👤'}"`,
      '---',
      '',
      row.prompt
    ].join('\n');

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
