/**
 * workerProcess.cjs - Background worker process for ONNX embeddings generation and Knowledge Graph indexing
 */

const path = require('path');
const fs = require('fs');

function scanMarkdownFiles(dir) {
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      if (file.startsWith('.') || file === 'node_modules') continue;
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(scanMarkdownFiles(fullPath));
      } else if (file.endsWith('.md')) {
        results.push(fullPath);
      }
    }
  } catch { /* ignore scan error */ }
  return results;
}

let embeddingDb = null;
let indexWorker = null;
let queue = null;

let graphDb = null;
let graphQueue = null;
let graphWorker = null;
let graphService = null;
if (process.parentPort) {
  process.parentPort.on('message', async (e) => {
    const { type, payload } = e.data || {};

    try {
      if (type === 'start') {
        const { workspaceRoot, appDataDir } = payload;

        const { EmbeddingDB, EmbeddingService, ONNXEmbedder } = require('../../ai/embeddings');
        const { IndexQueue, IndexWorker, GraphQueue, GraphWorker } = require('../../ai/queue');
        const { GraphDB, GraphService } = require('../../ai/graph');

        // 1. Initialize Embeddings Engine & Worker
        embeddingDb = new EmbeddingDB(workspaceRoot);
        embeddingDb.initialize();

        queue = new IndexQueue(embeddingDb);

        const localEmbedder = new ONNXEmbedder(appDataDir);
        await localEmbedder.load().catch(() => {});

        const activeModelName = localEmbedder.model || localEmbedder.name || 'local-bge-small';
        embeddingDb.verifyModelDimensions(activeModelName);

        const embeddingService = new EmbeddingService(null, localEmbedder);
        indexWorker = new IndexWorker(embeddingDb, queue, embeddingService);

        // 2. Initialize Knowledge Graph Engine & Worker
        graphDb = new GraphDB(workspaceRoot);
        graphDb.initialize();

        graphQueue = new GraphQueue(graphDb);
        const AIConfig = require('../../ai/core/AIConfig');
        const aiConfig = new AIConfig(appDataDir);
        const mockAgent = { appDataDir, workspaceRoot, config: aiConfig };
        graphService = new GraphService(mockAgent, graphDb);
        graphWorker = new GraphWorker(graphDb, graphQueue, graphService);

        // Load workspace metadata if present to seed graph
        const metaPath = path.join(workspaceRoot, '.notes-app', 'metadata.json');
        if (fs.existsSync(metaPath)) {
          try {
            const metaObj = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            const WorkspaceMetadataKnowledgeSource = require('../../ai/graph/sources/WorkspaceMetadataKnowledgeSource');
            const metaSource = new WorkspaceMetadataKnowledgeSource(metaObj.info || {});
            
            Promise.all([
              metaSource.extractEntities(),
              metaSource.extractRelationships()
            ]).then(([entities, relationships]) => {
              const entityIdMap = new Map();
              for (const ent of entities) {
                if (graphDb && typeof graphDb.upsertEntity === 'function') {
                  const entId = `ent-meta-${ent.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
                  graphDb.upsertEntity({
                    id: entId,
                    name: ent.name,
                    canonical_name: ent.name,
                    type: ent.type,
                    properties: ent.properties || {}
                  });
                  entityIdMap.set(ent.name.toLowerCase(), entId);
                }
              }
              for (const rel of relationships) {
                const srcId = entityIdMap.get(rel.source_name.toLowerCase());
                const tgtId = entityIdMap.get(rel.target_name.toLowerCase());
                if (srcId && tgtId && graphDb && typeof graphDb.upsertRelationship === 'function') {
                  graphDb.upsertRelationship({
                    source_id: srcId,
                    target_id: tgtId,
                    type: rel.type,
                    weight: rel.weight || 1.0,
                    confidence: rel.confidence || 0.95
                  });
                }
              }
            }).catch(() => {});
          } catch { /* ignore metadata parse error */ }
        }

        // Auto-enqueue workspace markdown notes on startup

        const workspaceNotes = scanMarkdownFiles(workspaceRoot);
        for (const notePath of workspaceNotes) {
          try {
            const stat = fs.statSync(notePath);
            if (graphDb && typeof graphDb.isNoteUpToDate === 'function' && graphDb.isNoteUpToDate(notePath, stat.mtimeMs)) {
              continue; // Skip unchanged notes already up-to-date in GraphDB
            }
          } catch { /* ignore stat error */ }
          graphQueue.enqueue(notePath);
        }

        const { LogDB } = require('../../ai/logs');
        const logDb = new LogDB(workspaceRoot);
        logDb.initialize();

        // Register worker message & log progress
        const originalIndexProcessJob = indexWorker.processNextJob.bind(indexWorker);
        indexWorker.processNextJob = async function() {
          process.parentPort.postMessage({ type: 'working', working: true });
          const res = await originalIndexProcessJob();
          if (res && res.filePath) {
            logDb.addLog('embeddings', `Processed embeddings for note: ${path.basename(res.filePath)}`, 'info');
          }
          process.parentPort.postMessage({ type: 'working', working: this.isWorking });
          return res;
        };

        indexWorker.registerProgressCallback(() => {
          process.parentPort.postMessage({ type: 'progress' });
        });

        graphWorker.registerProgressCallback((progressPayload) => {
          if (progressPayload && progressPayload.noteName) {
            try {
              logDb.addLog('graph', `Extracted graph entities from: ${progressPayload.noteName}`, 'info');
            } catch { /* ignore */ }
          }
          process.parentPort.postMessage({ type: 'graphProgress', payload: progressPayload });
        });

        indexWorker.start();
        graphWorker.start();

        // WAL checkpoint scheduler (every 30 mins)
        setInterval(() => {
          try {
            if (graphDb && graphDb.db) {
              graphDb.db.exec('PRAGMA wal_checkpoint(PASSIVE);');
            }
          } catch { /* ignore */ }
        }, 30 * 60 * 1000);

        process.parentPort.postMessage({ type: 'started' });

      } else if (type === 'enqueue') {
        const { filePath, priority } = payload;
        if (embeddingDb) {
          embeddingDb.enqueue(filePath, priority);
          if (indexWorker) indexWorker.triggerNext();
        }
        if (graphQueue) {
          graphQueue.enqueue(filePath, priority);
          if (graphWorker) graphWorker.triggerNext();
        }
      } else if (type === 'deleteNote') {
        const { filePath } = payload;
        if (embeddingDb) embeddingDb.deleteNoteData(filePath);
        if (graphDb) graphDb.deleteNoteData(filePath);
      } else if (type === 'renameNote') {
        const { oldPath, newPath } = payload;
        if (embeddingDb && embeddingDb.db) {
          const db = embeddingDb.db;
          try {
            db.exec('BEGIN');
            db.prepare('UPDATE chunks SET note_path = ? WHERE note_path = ?').run(newPath, oldPath);
            db.prepare('UPDATE note_hashes SET note_path = ? WHERE note_path = ?').run(newPath, oldPath);
            db.prepare('UPDATE indexing_queue SET note_path = ? WHERE note_path = ?').run(newPath, oldPath);
            db.prepare('UPDATE indexing_log SET note_path = ? WHERE note_path = ?').run(newPath, oldPath);
            db.exec('COMMIT');
          } catch {
            try { db.exec('ROLLBACK'); } catch { /* ignore rollback error */ }
          }
        }
        if (graphDb && graphDb.db) {
          try {
            graphDb.db.exec('BEGIN');
            graphDb.db.prepare('UPDATE entities SET note_path = ? WHERE note_path = ?').run(newPath, oldPath);
            graphDb.db.prepare('UPDATE evidence SET source_id = ? WHERE source_id = ?').run(newPath, oldPath);
            graphDb.db.exec('COMMIT');
          } catch {
            try { graphDb.db.exec('ROLLBACK'); } catch { /* ignore rollback error */ }
          }
        }
        if (graphQueue) {
          graphQueue.enqueue(newPath, 2);
        }
        if (graphWorker) {
          graphWorker.triggerNext();
        }
      } else if (type === 'rebuildGraph') {
        let { workspaceFiles } = payload;
        if (!Array.isArray(workspaceFiles) || workspaceFiles.length === 0) {
          if (graphDb && graphDb.workspaceRoot) {
            workspaceFiles = scanMarkdownFiles(graphDb.workspaceRoot);
          } else {
            workspaceFiles = [];
          }
        }
        if (graphDb) {
          graphDb.clear();
        }
        if (graphQueue) {
          graphQueue.clear();
          for (const file of workspaceFiles) {
            graphQueue.enqueue(file);
          }
        }
        if (graphWorker) {
          graphWorker.resume();
          graphWorker.triggerNext();
        }
      } else if (type === 'pauseGraphWorker') {
        if (graphWorker) graphWorker.pause();
      } else if (type === 'resumeGraphWorker') {
        if (graphWorker) graphWorker.resume();
      } else if (type === 'pause') {
        if (indexWorker) indexWorker.pause();
      } else if (type === 'resume') {
        if (indexWorker) indexWorker.resume();
      } else if (type === 'reloadGraphModel') {
        if (graphService && typeof graphService.getPipeline === 'function') {
          const pipeline = graphService.getPipeline();
          if (pipeline && typeof pipeline.load === 'function') {
            pipeline.isInitialized = false;
            await pipeline.load().catch(() => {});
          }
        }
      } else if (type === 'shutdown') {
        if (indexWorker) indexWorker.pause();
        if (graphWorker) graphWorker.pause();
        if (graphDb && graphDb.db) {
          try { graphDb.db.exec('PRAGMA wal_checkpoint(TRUNCATE);'); } catch { /* ignore */ }
          graphDb.close();
        }
        if (embeddingDb) embeddingDb.close();
        process.exit(0);
      }
    } catch (err) {
      console.error('[Worker Process] Error in child worker message handler:', err);
      process.parentPort.postMessage({ type: 'error', error: err.message });
    }
  });
}
