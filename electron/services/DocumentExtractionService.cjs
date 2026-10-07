/**
 * DocumentExtractionService.cjs
 * Application service orchestrating document text extraction, hashing cache, background queue, and workspace file scanning.
 */

const fs = require('fs');
const path = require('path');
const { DocumentCacheStore } = require('../lib/documents/DocumentCacheStore.cjs');
const {
  isSupportedDocument,
  getDocumentMimeType,
  extractDocument,
} = require('../lib/extractors/DocumentExtractor.cjs');

const IGNORED_DIRS = new Set([
  '.git',
  '.notes-app',
  '.note-app',
  'node_modules',
  'dist',
  'docs-site-dist',
  '.vitepress',
  '.codegraph',
  'scratch',
]);

class DocumentExtractionService {
  constructor(workspaceRoot = '', onStatusChange = null) {
    this.workspaceRoot = workspaceRoot || '';
    this.onStatusChange = onStatusChange;
    this.store = new DocumentCacheStore(this.workspaceRoot);
    this.queue = [];
    this.processing = false;
    this.activeWorkers = 0;
    this.maxConcurrency = 2;
    this.debounceTimers = new Map();
  }

  setWorkspaceRoot(workspaceRoot) {
    if (this.workspaceRoot !== workspaceRoot) {
      this.workspaceRoot = workspaceRoot || '';
      this.queue = [];
      this.activeWorkers = 0;
      this.processing = false;
      this.store.setWorkspaceRoot(this.workspaceRoot);
      if (this.workspaceRoot) {
        this.scanWorkspace();
      }
    }
  }

  _notifyStatus(eventData) {
    if (typeof this.onStatusChange === 'function') {
      try {
        this.onStatusChange(eventData);
      } catch (err) {
        console.error('[DocumentExtractionService] Error in onStatusChange listener:', err);
      }
    }
  }

  collectDocumentFiles(dirPath, fileList = []) {
    if (!dirPath || !fs.existsSync(dirPath)) return fileList;

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const name = entry.name;
        if (IGNORED_DIRS.has(name) || name.startsWith('.')) continue;

        const fullPath = path.join(dirPath, name);
        if (entry.isDirectory()) {
          this.collectDocumentFiles(fullPath, fileList);
        } else if (entry.isFile() && isSupportedDocument(fullPath)) {
          fileList.push(fullPath);
        }
      }
    } catch (err) {
      console.error(`[DocumentExtractionService] Error reading dir ${dirPath}:`, err);
    }

    return fileList;
  }

  async scanWorkspace() {
    if (!this.workspaceRoot || !fs.existsSync(this.workspaceRoot)) return [];

    const files = this.collectDocumentFiles(this.workspaceRoot);
    const validRelativePaths = [];

    for (const fullPath of files) {
      const relPath = path.relative(this.workspaceRoot, fullPath).replace(/\\/g, '/');
      validRelativePaths.push(relPath);
      await this.queueFileIfOutdated(fullPath, relPath);
    }

    // Cleanup files that were removed from workspace
    this.store.cleanupMissingFiles(validRelativePaths);
    this._processQueue();

    return this.store.getAllRecords();
  }

  async queueFileIfOutdated(fullPath, relPath, force = false) {
    if (!fs.existsSync(fullPath)) return;

    try {
      const stats = fs.statSync(fullPath);
      const existing = this.store.getRecord(relPath);

      // Fast Tier 1 check: mtime + size
      if (!force && existing && existing.mtime === stats.mtimeMs && existing.file_size === stats.size && existing.status === 'ready') {
        return;
      }

      // Check if already in queue
      if (this.queue.some((item) => item.relPath === relPath)) {
        return;
      }

      this.queue.push({
        fullPath,
        relPath,
        stats,
        force,
      });

      this._notifyStatus({
        type: 'queued',
        relPath,
        status: 'pending',
      });
    } catch (err) {
      console.error(`[DocumentExtractionService] Error checking file ${relPath}:`, err);
    }
  }

  handleFileChanged(fullPath) {
    if (!this.workspaceRoot || !isSupportedDocument(fullPath)) return;
    const relPath = path.relative(this.workspaceRoot, fullPath).replace(/\\/g, '/');

    // Debounce file writes (e.g. multi-part copy or saves)
    if (this.debounceTimers.has(relPath)) {
      clearTimeout(this.debounceTimers.get(relPath));
    }

    const timer = setTimeout(async () => {
      this.debounceTimers.delete(relPath);
      if (fs.existsSync(fullPath)) {
        await this.queueFileIfOutdated(fullPath, relPath, true);
        this._processQueue();
      } else {
        this.store.deleteRecord(relPath);
        this._notifyStatus({
          type: 'deleted',
          relPath,
        });
      }
    }, 600);

    this.debounceTimers.set(relPath, timer);
  }

  handleFileDeleted(fullPath) {
    if (!this.workspaceRoot) return;
    const relPath = path.relative(this.workspaceRoot, fullPath).replace(/\\/g, '/');
    this.store.deleteRecord(relPath);
    this._notifyStatus({
      type: 'deleted',
      relPath,
    });
  }

  async _processQueue() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0 && this.activeWorkers < this.maxConcurrency) {
      const item = this.queue.shift();
      this.activeWorkers++;
      this._extractItem(item).finally(() => {
        this.activeWorkers--;
        this._processQueue();
      });
    }

    this.processing = false;
  }

  async _extractItem(item) {
    const { fullPath, relPath, stats } = item;

    if (!fs.existsSync(fullPath)) {
      this.store.deleteRecord(relPath);
      return;
    }

    try {
      this._notifyStatus({
        type: 'processing',
        relPath,
        status: 'processing',
      });

      // Tier 2: Calculate SHA-256 hash
      const contentHash = await this.store.computeFileHash(fullPath);
      const mimeType = getDocumentMimeType(fullPath);

      // Perform extraction
      const result = await extractDocument(fullPath);

      let extractedRelPath = '';
      if (result.markdown) {
        extractedRelPath = this.store.saveExtractedMarkdown(contentHash, result.markdown);
      }

      const record = this.store.upsertRecord({
        relativePath: relPath,
        contentHash,
        fileSize: stats.size,
        mtime: stats.mtimeMs,
        mimeType,
        extractedRelPath,
        pageCount: result.pageCount || 1,
        wordCount: result.wordCount || 0,
        status: result.status,
        errorMessage: result.error,
      });

      this._notifyStatus({
        type: 'completed',
        relPath,
        record,
      });
    } catch (err) {
      console.error(`[DocumentExtractionService] Extraction error for ${relPath}:`, err);
      this.store.updateStatus(relPath, 'failed', err.message);
      this._notifyStatus({
        type: 'failed',
        relPath,
        status: 'failed',
        error: err.message,
      });
    }
  }

  findFileInWorkspace(queryPath) {
    if (!queryPath || !this.workspaceRoot) return null;
    let clean = String(queryPath).replace(/\\/g, '/').trim().replace(/^file:\/\/\/?/i, '');
    if (path.isAbsolute(clean) && fs.existsSync(clean)) {
      return clean;
    }

    const candidate1 = path.join(this.workspaceRoot, clean);
    if (fs.existsSync(candidate1)) return candidate1;

    // Check by basename in workspace documents
    const basename = path.basename(clean);
    if (basename) {
      const allFiles = this.collectDocumentFiles(this.workspaceRoot);
      const found = allFiles.find((f) => path.basename(f).toLowerCase() === basename.toLowerCase());
      if (found) return found;
    }

    return null;
  }

  getRecord(relPath) {
    return this.store.getRecord(relPath);
  }

  getAllRecords() {
    return this.store.getAllRecords();
  }

  async getExtractedContent(relPath) {
    const record = this.store.getRecord(relPath);
    if (record && record.extracted_rel_path) {
      const text = this.store.readExtractedMarkdown(record.extracted_rel_path);
      if (text) return text;
    }

    // On-demand extraction if file exists on disk
    const fullPath = this.findFileInWorkspace(relPath);
    if (fullPath && fs.existsSync(fullPath) && isSupportedDocument(fullPath)) {
      try {
        const stats = fs.statSync(fullPath);
        const resolvedRelPath = path.relative(this.workspaceRoot, fullPath).replace(/\\/g, '/');
        const contentHash = await this.store.computeFileHash(fullPath);
        const mimeType = getDocumentMimeType(fullPath);
        const result = await extractDocument(fullPath);

        let extractedRelPath = '';
        if (result.markdown) {
          extractedRelPath = this.store.saveExtractedMarkdown(contentHash, result.markdown);
        }

        this.store.upsertRecord({
          relativePath: resolvedRelPath,
          contentHash,
          fileSize: stats.size,
          mtime: stats.mtimeMs,
          mimeType,
          extractedRelPath,
          pageCount: result.pageCount || 1,
          wordCount: result.wordCount || 0,
          status: result.status,
          errorMessage: result.error,
        });

        return result.markdown || '';
      } catch (err) {
        console.error(`[DocumentExtractionService] On-demand extraction failed for ${relPath}:`, err);
      }
    }

    return '';
  }

  async forceReextract(relPath) {
    if (!this.workspaceRoot) return null;
    const fullPath = this.findFileInWorkspace(relPath) || (path.isAbsolute(relPath) ? relPath : path.join(this.workspaceRoot, relPath));
    if (!fs.existsSync(fullPath)) return null;

    const resolvedRelPath = path.relative(this.workspaceRoot, fullPath).replace(/\\/g, '/');
    await this.queueFileIfOutdated(fullPath, resolvedRelPath, true);
    await this._processQueue();
    return this.getRecord(resolvedRelPath);
  }

  close() {
    this.queue = [];
    this.debounceTimers.forEach((t) => clearTimeout(t));
    this.debounceTimers.clear();
    this.store.close();
  }
}

module.exports = {
  DocumentExtractionService,
};
