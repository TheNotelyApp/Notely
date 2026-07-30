const fs = require('fs');
const { createLogger } = require('../core');
const { HashManager, MarkdownChunker } = require('../embeddings');

const log = createLogger('IndexWorker');

class IndexWorker {
  constructor(db, queue, embedderService) {
    this.db = db;
    this.queue = queue;
    this.embedderService = embedderService;
    this.isPaused = false;
    this.isWorking = false;
    this.workerTimeout = null;
    this.onProgressCallback = null;
  }

  start() {
    this.isPaused = false;
    log.info('IndexWorker started');
    this.triggerNext();
  }

  pause() {
    this.isPaused = true;
    if (this.workerTimeout) {
      clearTimeout(this.workerTimeout);
      this.workerTimeout = null;
    }
    log.info('IndexWorker paused');
  }

  resume() {
    this.isPaused = false;
    log.info('IndexWorker resumed');
    this.triggerNext();
  }

  registerProgressCallback(cb) {
    this.onProgressCallback = cb;
  }

  triggerNext() {
    if (this.isPaused || this.isWorking) return;

    if (this.workerTimeout) {
      clearTimeout(this.workerTimeout);
    }

    this.workerTimeout = setTimeout(() => {
      this.processNextJob();
    }, 200); // slight debounce delay to yield CPU
  }

  async processNextJob() {
    if (this.isPaused || this.isWorking) return;

    const job = this.queue.dequeue();
    if (!job) {
      return; // Queue empty
    }

    this.isWorking = true;
    log.info(`Processing index job for: ${job.note_path}`);

    try {
      if (!fs.existsSync(job.note_path)) {
        this.db.deleteNoteData(job.note_path);
        this.queue.updateStatus(job.id, 'done');
        this.db.logEvent(job.note_path, 'delete', 'Note deleted from disk, removed from embeddings index');
        this.notifyProgress();
        this.isWorking = false;
        this.triggerNext();
        return;
      }

      const content = fs.readFileSync(job.note_path, 'utf8');
      const contentHash = HashManager.calculateHash(content);

      // Verify if hash already matches to avoid duplicate vectorization
      const savedHash = this.db.getNoteHash(job.note_path);
      if (savedHash === contentHash) {
        this.queue.updateStatus(job.id, 'done');
        this.isWorking = false;
        this.triggerNext();
        return;
      }

      // Generate Chunks
      const chunks = MarkdownChunker.chunk(content, job.note_path);

      if (chunks.length === 0) {
        this.db.deleteNoteData(job.note_path);
        this.db.upsertNoteHash(job.note_path, contentHash, 0);
        this.queue.updateStatus(job.id, 'done');
        this.db.logEvent(job.note_path, 'index', 'Empty note indexed');
        this.notifyProgress();
        this.isWorking = false;
        this.triggerNext();
        return;
      }

      // Vectorize Chunks
      log.info(`Vectorizing ${chunks.length} chunks for ${job.note_path}`);
      
      // Ensure embedding engine is ready
      if (!this.embedderService || !this.embedderService.isAvailable()) {
        throw new Error('No active embedding provider configured');
      }

      const vectorizedChunks = [];
      for (let i = 0; i < chunks.length; i++) {
        // Yield execution between steps to avoid freezing event loop
        await new Promise(resolve => setImmediate(resolve));
        
        if (this.isPaused) {
          // If paused midway, re-enqueue and abort
          this.queue.enqueue(job.note_path, job.priority);
          this.queue.updateStatus(job.id, 'pending');
          this.isWorking = false;
          return;
        }

        const chunk = chunks[i];
        chunk.content_hash = HashManager.calculateHash(chunk.content);
        
        // Generate Vector
        const vector = await this.embedderService.generateVector(chunk.content);
        chunk.embedding = vector;
        chunk.embedding_model = this.embedderService.getActiveModelName();

        vectorizedChunks.push(chunk);
      }

      // Execute DB deletion, upserts, and note hash update after vectorization completes
      this.db.deleteNoteData(job.note_path);
      if (this.db?.db) {
        this.db.db.exec('BEGIN');
        try {
          for (const vChunk of vectorizedChunks) {
            this.db.upsertChunk(vChunk);
          }
          this.db.upsertNoteHash(job.note_path, contentHash, vectorizedChunks.length);
          this.db.db.exec('COMMIT');
        } catch (txnErr) {
          try { this.db.db.exec('ROLLBACK'); } catch { /* ignore */ }
          throw txnErr;
        }
      } else {
        for (const vChunk of vectorizedChunks) {
          this.db.upsertChunk(vChunk);
        }
        this.db.upsertNoteHash(job.note_path, contentHash, vectorizedChunks.length);
      }

      this.queue.updateStatus(job.id, 'done');
      this.db.logEvent(job.note_path, 'index', `Successfully indexed ${vectorizedChunks.length} chunks`);
      
    } catch (err) {
      log.error(`Failed to process index job for: ${job.note_path}`, err);
      const isRetryable = job.retries < 3;
      const nextStatus = isRetryable ? 'pending' : 'failed';
      this.queue.updateStatus(job.id, nextStatus, err.message);
      this.db.logEvent(job.note_path, 'error', `Failed indexing note: ${err.message}. Status: ${nextStatus}`);
    }

    this.notifyProgress();
    this.isWorking = false;
    this.triggerNext();
  }

  notifyProgress() {
    if (this.onProgressCallback) {
      try {
        this.onProgressCallback();
      } catch (err) {
        log.error('Error invoking progress callback', err);
      }
    }
  }
}

module.exports = IndexWorker;
