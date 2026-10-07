/**
 * DocumentCacheStore.cjs
 * Manages document extraction records and cache lookup table in SQLite (.notes-app/document-cache.sqlite).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const DB_DIR = '.notes-app';
const DB_FILE = 'document-cache.sqlite';
const CACHE_EXTRACTED_SUBDIR = path.join('.notes-app', 'cache', 'extracted');

const SCHEMA = `
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS document_extractions (
    relative_path TEXT PRIMARY KEY,
    content_hash TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mtime INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    extracted_rel_path TEXT NOT NULL,
    page_count INTEGER DEFAULT 1,
    word_count INTEGER DEFAULT 0,
    status TEXT NOT NULL,
    error_message TEXT,
    last_extracted_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_doc_hash ON document_extractions(content_hash);
  CREATE INDEX IF NOT EXISTS idx_doc_status ON document_extractions(status);
`;

class DocumentCacheStore {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot || '';
    this.db = null;
    this.currentDbPath = null;
    this._memoryFallback = new Map();
    if (this.workspaceRoot) {
      this._ensureConnection();
    }
  }

  setWorkspaceRoot(workspaceRoot) {
    if (this.workspaceRoot !== workspaceRoot) {
      this.close();
      this.workspaceRoot = workspaceRoot || '';
      this._memoryFallback.clear();
      if (this.workspaceRoot) {
        this._ensureConnection();
      }
    }
  }

  _getDbDir() {
    if (!this.workspaceRoot) return '';
    const dir = path.join(this.workspaceRoot, DB_DIR);
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {
        // ignore
      }
    }
    return dir;
  }

  getExtractedCacheDir() {
    if (!this.workspaceRoot) return '';
    const dir = path.join(this.workspaceRoot, CACHE_EXTRACTED_SUBDIR);
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {
        // ignore
      }
    }
    return dir;
  }

  _ensureConnection() {
    if (!this.workspaceRoot) return;
    const targetDir = this._getDbDir();
    if (!targetDir) return;

    const targetDbPath = path.join(targetDir, DB_FILE);
    if (this.currentDbPath === targetDbPath && this.db) {
      return;
    }

    this.close();
    this.currentDbPath = targetDbPath;

    try {
      this.db = new DatabaseSync(targetDbPath);
      this.db.exec(SCHEMA);
    } catch (err) {
      console.error('[DocumentCacheStore] SQLite connection failed, using memory fallback:', err);
      this.db = null;
    }
  }

  computeFileHash(fullPath) {
    return new Promise((resolve, reject) => {
      try {
        if (!fs.existsSync(fullPath)) {
          return resolve('');
        }
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(fullPath);
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', (err) => reject(err));
      } catch (err) {
        reject(err);
      }
    });
  }

  _formatRecord(row) {
    if (!row) return null;
    return {
      ...row,
      relativePath: row.relative_path,
      contentHash: row.content_hash,
      fileSize: row.file_size,
      mimeType: row.mime_type,
      extractedRelPath: row.extracted_rel_path,
      pageCount: row.page_count,
      wordCount: row.word_count,
      errorMessage: row.error_message,
      lastExtractedAt: row.last_extracted_at,
    };
  }

  normalizeRelativePath(inputPath) {
    if (!inputPath) return '';
    let p = String(inputPath).replace(/\\/g, '/').trim();
    p = p.replace(/^file:\/\/\/?/i, '');
    if (this.workspaceRoot) {
      const normWs = this.workspaceRoot.replace(/\\/g, '/').replace(/\/+$/, '');
      if (p.toLowerCase().startsWith(normWs.toLowerCase())) {
        p = p.slice(normWs.length).replace(/^\/+/, '');
      }
    }
    p = p.replace(/^(\.\/|\/)+/, '');
    return p;
  }

  getRecord(relativePath) {
    if (!relativePath) return null;
    const rawNorm = String(relativePath).replace(/\\/g, '/').trim();
    const relNorm = this.normalizeRelativePath(relativePath);
    const basename = path.basename(relNorm || rawNorm);

    if (this.db) {
      try {
        // 1. Try exact match on rawNorm or relNorm
        let stmt = this.db.prepare('SELECT * FROM document_extractions WHERE relative_path = ? OR relative_path = ?');
        let row = stmt.get(rawNorm, relNorm);
        if (row) return this._formatRecord(row);

        // 2. Try case-insensitive exact match
        stmt = this.db.prepare('SELECT * FROM document_extractions WHERE LOWER(relative_path) = LOWER(?) OR LOWER(relative_path) = LOWER(?)');
        row = stmt.get(rawNorm, relNorm);
        if (row) return this._formatRecord(row);

        // 3. Try matching by basename (e.g. "my-doc.pdf")
        if (basename) {
          stmt = this.db.prepare("SELECT * FROM document_extractions WHERE relative_path LIKE '%/' || ? OR relative_path = ? LIMIT 1");
          row = stmt.get(basename, basename);
          if (row) return this._formatRecord(row);
        }
      } catch (err) {
        console.error('[DocumentCacheStore] getRecord error:', err);
      }
    }

    const mem = this._memoryFallback.get(rawNorm) || this._memoryFallback.get(relNorm);
    if (mem) return this._formatRecord(mem);

    if (basename) {
      for (const [k, v] of this._memoryFallback.entries()) {
        if (k.endsWith('/' + basename) || k === basename) {
          return this._formatRecord(v);
        }
      }
    }

    return null;
  }

  getAllRecords() {
    if (this.db) {
      try {
        const stmt = this.db.prepare('SELECT * FROM document_extractions ORDER BY last_extracted_at DESC');
        const rows = stmt.all();
        return (rows || []).map((r) => this._formatRecord(r));
      } catch (err) {
        console.error('[DocumentCacheStore] getAllRecords error:', err);
      }
    }
    return Array.from(this._memoryFallback.values()).map((r) => this._formatRecord(r));
  }

  upsertRecord({
    relativePath,
    contentHash,
    fileSize,
    mtime,
    mimeType = 'application/octet-stream',
    extractedRelPath = '',
    pageCount = 1,
    wordCount = 0,
    status = 'ready',
    errorMessage = null,
  }) {
    const normPath = String(relativePath || '').replace(/\\/g, '/');
    const normExtractedPath = String(extractedRelPath || '').replace(/\\/g, '/');
    const now = Date.now();

    const record = {
      relative_path: normPath,
      content_hash: contentHash,
      file_size: fileSize,
      mtime,
      mime_type: mimeType,
      extracted_rel_path: normExtractedPath,
      page_count: pageCount,
      word_count: wordCount,
      status,
      error_message: errorMessage || null,
      last_extracted_at: now,
    };

    if (this.db) {
      try {
        const stmt = this.db.prepare(`
          INSERT INTO document_extractions (
            relative_path, content_hash, file_size, mtime, mime_type,
            extracted_rel_path, page_count, word_count, status, error_message, last_extracted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(relative_path) DO UPDATE SET
            content_hash = excluded.content_hash,
            file_size = excluded.file_size,
            mtime = excluded.mtime,
            mime_type = excluded.mime_type,
            extracted_rel_path = excluded.extracted_rel_path,
            page_count = excluded.page_count,
            word_count = excluded.word_count,
            status = excluded.status,
            error_message = excluded.error_message,
            last_extracted_at = excluded.last_extracted_at
        `);
        stmt.run(
          normPath,
          contentHash,
          fileSize,
          mtime,
          mimeType,
          normExtractedPath,
          pageCount,
          wordCount,
          status,
          errorMessage || null,
          now
        );
        return record;
      } catch (err) {
        console.error('[DocumentCacheStore] upsertRecord error:', err);
      }
    }

    this._memoryFallback.set(normPath, record);
    return record;
  }

  updateStatus(relativePath, status, errorMessage = null) {
    const normPath = String(relativePath || '').replace(/\\/g, '/');
    const now = Date.now();
    if (this.db) {
      try {
        const stmt = this.db.prepare(`
          UPDATE document_extractions 
          SET status = ?, error_message = ?, last_extracted_at = ?
          WHERE relative_path = ?
        `);
        stmt.run(status, errorMessage, now, normPath);
      } catch (err) {
        console.error('[DocumentCacheStore] updateStatus error:', err);
      }
    }
    const existing = this._memoryFallback.get(normPath);
    if (existing) {
      existing.status = status;
      existing.error_message = errorMessage;
      existing.last_extracted_at = now;
    }
  }

  deleteRecord(relativePath) {
    const normPath = String(relativePath || '').replace(/\\/g, '/');
    const existing = this.getRecord(normPath);
    if (this.db) {
      try {
        const stmt = this.db.prepare('DELETE FROM document_extractions WHERE relative_path = ?');
        stmt.run(normPath);
      } catch (err) {
        console.error('[DocumentCacheStore] deleteRecord error:', err);
      }
    }
    this._memoryFallback.delete(normPath);

    // Clean extracted markdown file if no other record uses the same hash
    if (existing && existing.extracted_rel_path && this.workspaceRoot) {
      this._cleanupOrphanExtractedFile(existing.content_hash, existing.extracted_rel_path);
    }
    return true;
  }

  _cleanupOrphanExtractedFile(contentHash, extractedRelPath) {
    if (!contentHash || !extractedRelPath || !this.workspaceRoot) return;
    if (this.db) {
      try {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM document_extractions WHERE content_hash = ?');
        const res = stmt.get(contentHash);
        if (res && res.count > 0) {
          return; // Still in use by another document
        }
      } catch {
        // ignore
      }
    }

    const fullExtractedPath = path.join(this.workspaceRoot, extractedRelPath);
    if (fs.existsSync(fullExtractedPath)) {
      try {
        fs.unlinkSync(fullExtractedPath);
      } catch {
        // ignore
      }
    }
  }

  cleanupMissingFiles(validRelativePaths) {
    const validSet = new Set(
      (validRelativePaths || []).map((p) => String(p).replace(/\\/g, '/'))
    );
    const all = this.getAllRecords();
    const removed = [];

    for (const rec of all) {
      if (!validSet.has(rec.relative_path)) {
        this.deleteRecord(rec.relative_path);
        removed.push(rec.relative_path);
      }
    }
    return removed;
  }

  saveExtractedMarkdown(contentHash, markdownContent) {
    const cacheDir = this.getExtractedCacheDir();
    if (!cacheDir) return '';

    const fileName = `${contentHash}.md`;
    const fullPath = path.join(cacheDir, fileName);
    fs.writeFileSync(fullPath, markdownContent || '', 'utf8');

    return path.join(CACHE_EXTRACTED_SUBDIR, fileName).replace(/\\/g, '/');
  }

  readExtractedMarkdown(extractedRelPath) {
    if (!extractedRelPath || !this.workspaceRoot) return '';
    const fullPath = path.isAbsolute(extractedRelPath)
      ? extractedRelPath
      : path.join(this.workspaceRoot, extractedRelPath);

    if (!fs.existsSync(fullPath)) return '';
    try {
      return fs.readFileSync(fullPath, 'utf8');
    } catch {
      return '';
    }
  }

  close() {
    if (this.db) {
      try {
        this.db.close();
      } catch {
        // ignore
      }
      this.db = null;
    }
    this.currentDbPath = null;
  }
}

module.exports = {
  DocumentCacheStore,
  DB_DIR,
  DB_FILE,
  CACHE_EXTRACTED_SUBDIR,
};
