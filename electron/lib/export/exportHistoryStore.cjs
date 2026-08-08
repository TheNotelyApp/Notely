const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");

const DB_DIR = ".notes-app";
const DB_FILE = "export-history.db";

const SCHEMA = `
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS export_history (
    id          TEXT PRIMARY KEY,
    filename    TEXT NOT NULL,
    file_path   TEXT NOT NULL,
    file_size   INTEGER DEFAULT 0,
    export_type TEXT NOT NULL,
    category    TEXT NOT NULL,
    timestamp   TEXT NOT NULL,
    source_note TEXT DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_export_timestamp ON export_history(timestamp);
  CREATE INDEX IF NOT EXISTS idx_export_file_path ON export_history(file_path);
`;

class ExportHistoryStore {
  constructor(appDataPath, getNotesRootFn = null) {
    this.appDataPath = appDataPath;
    this.getNotesRootFn = getNotesRootFn;
    this.db = null;
    this.currentDbPath = null;
  }

  _getDbDir() {
    let workspaceRoot = "";
    if (typeof this.getNotesRootFn === "function") {
      try { workspaceRoot = this.getNotesRootFn(); } catch { /* ignore */ }
    }
    if (workspaceRoot && fs.existsSync(workspaceRoot)) {
      const dir = path.join(workspaceRoot, DB_DIR);
      if (!fs.existsSync(dir)) {
        try { fs.mkdirSync(dir, { recursive: true }); } catch { /* ignore */ }
      }
      return dir;
    }
    return this.appDataPath;
  }

  _ensureConnection() {
    const targetDir = this._getDbDir();
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
      console.error("[ExportHistoryStore] Failed to open SQLite connection:", err);
      this.db = null;
    }
  }

  close() {
    if (this.db) {
      try { this.db.close(); } catch { /* ignore */ }
      this.db = null;
    }
  }

  async addRecord({ filename, filePath, fileSize = 0, exportType = "document", category = "document", sourceNote = "" }) {
    this._ensureConnection();
    if (!this.db) return null;

    const record = {
      id: "exp_" + Date.now() + "_" + crypto.randomBytes(4).toString("hex"),
      filename: filename || path.basename(filePath || "exported_file"),
      filePath: filePath || "",
      fileSize: Number(fileSize) || 0,
      exportType: exportType,
      category: category,
      timestamp: new Date().toISOString(),
      sourceNote: sourceNote || ""
    };

    try {
      // Remove previous entries with exact same file_path
      this.db.prepare("DELETE FROM export_history WHERE LOWER(file_path) = LOWER(?)").run(record.filePath);
    } catch {}

    const stmt = this.db.prepare(`
      INSERT INTO export_history (id, filename, file_path, file_size, export_type, category, timestamp, source_note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(record.id, record.filename, record.filePath, record.fileSize, record.exportType, record.category, record.timestamp, record.sourceNote);

    return record;
  }

  async getHistory() {
    this._ensureConnection();
    if (!this.db) return [];

    let rows = [];
    try {
      const rawRows = this.db.prepare("SELECT * FROM export_history ORDER BY timestamp DESC LIMIT 200").all();
      rows = rawRows.map(r => ({
        id: r.id,
        filename: r.filename,
        filePath: r.file_path,
        fileSize: r.file_size,
        exportType: r.export_type,
        category: r.category,
        timestamp: r.timestamp,
        sourceNote: r.source_note
      }));
    } catch (err) {
      console.warn("[ExportHistoryStore] DB query error:", err);
      rows = [];
    }

    return rows.map(rec => ({
      ...rec,
      exists: rec.filePath ? fs.existsSync(rec.filePath) : false
    }));
  }

  async removeRecord(id) {
    this._ensureConnection();
    if (!this.db) return false;

    try {
      this.db.prepare("DELETE FROM export_history WHERE id = ?").run(id);
    } catch {}
    return true;
  }

  async clearHistory() {
    this._ensureConnection();
    if (!this.db) return false;

    try {
      this.db.prepare("DELETE FROM export_history").run();
    } catch {}
    return true;
  }
}

module.exports = { ExportHistoryStore };
