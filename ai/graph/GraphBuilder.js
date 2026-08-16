/**
 * GraphBuilder - Rebuild the entire workspace Knowledge Graph database
 */

const fs = require('fs');
const path = require('path');
const { createLogger } = require('../core/logger');

const log = createLogger('GraphBuilder');

class GraphBuilder {
  constructor(agent, graphDb, graphService) {
    this.agent = agent;
    this.graphDb = graphDb;
    this.graphService = graphService;
    this.isRebuilding = false;
    this._lastBuildReport = null;
  }

  getPipelineReport() {
    return this._lastBuildReport;
  }

  /**
   * Scan notes and rebuild the Knowledge Graph
   */
  async rebuild(onProgress = null) {
    if (this.isRebuilding) {
      log.warn('Rebuild already in progress');
      return { success: false, error: 'Rebuild already in progress' };
    }

    try {
      this.isRebuilding = true;
      this._rebuildStartTime = Date.now();
      this._buildReport = {
        startedAt: new Date().toISOString(),
        completedAt: null,
        totalDurationMs: 0,
        stages: {
          discovery: { durationMs: 0, itemCount: 0 },
          nonMarkdownExtraction: { durationMs: 0, entityCount: 0, relationCount: 0 },
          markdownProcessing: { durationMs: 0, processedCount: 0, failedCount: 0 }
        },
        finalStats: null
      };
      log.info('Starting complete Knowledge Graph rebuild...');

      if (!this.graphDb.isInitialized) {
        this.graphDb.initialize();
      }

      const LogDB = require('../logs/LogDB');
      this._logDb = new LogDB(this.agent.workspaceRoot);
      this._logDb.initialize();
      this._logDb.addLog('graph', 'Starting complete Knowledge Graph rebuild...', 'info');

      // Clear existing graph tables
      this.graphDb.clear();

      const KnowledgeSourceRegistry = require('./KnowledgeSourceRegistry');
      const WorkspaceMetadataKnowledgeSource = require('./sources/WorkspaceMetadataKnowledgeSource');
      const FolderHierarchyKnowledgeSource = require('./sources/FolderHierarchyKnowledgeSource');
      const ImageAnnotationKnowledgeSource = require('./sources/ImageAnnotationKnowledgeSource');
      const ExcalidrawKnowledgeSource = require('./sources/ExcalidrawKnowledgeSource');
      const DrawioKnowledgeSource = require('./sources/DrawioKnowledgeSource');
      const MermaidKnowledgeSource = require('./sources/MermaidKnowledgeSource');

      const registry = new KnowledgeSourceRegistry();

      // 1. Read metadata.json for workspace info and image annotations
      const workspaceRoot = this.agent?.workspaceRoot || this.graphDb?.workspaceRoot;
      let workspaceInfo = {};
      const annotationMap = new Map();

      if (workspaceRoot) {
        const metaPath = path.join(workspaceRoot, '.notes-app', 'metadata.json');
        if (fs.existsSync(metaPath)) {
          try {
            const metaObj = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            workspaceInfo = metaObj.info || {};
            const items = metaObj.items || {};
            for (const [relPath, itemMeta] of Object.entries(items)) {
              if (itemMeta && itemMeta.annotation) {
                const absPath = path.resolve(workspaceRoot, relPath);
                annotationMap.set(absPath, { text: typeof itemMeta.annotation === 'string' ? itemMeta.annotation : itemMeta.annotation.text || '' });
              }
            }
          } catch { /* ignore metadata read error */ }
        }
      }

      registry.register(new WorkspaceMetadataKnowledgeSource(workspaceInfo));
      registry.register(new FolderHierarchyKnowledgeSource());
      registry.register(new ImageAnnotationKnowledgeSource(annotationMap));
      registry.register(new ExcalidrawKnowledgeSource());
      registry.register(new DrawioKnowledgeSource());
      registry.register(new MermaidKnowledgeSource());

      // 2. Discover non-markdown and markdown items
      const discoveredItems = registry.discoverAll(workspaceRoot);
      log.info(`Discovered ${discoveredItems.length} knowledge items across sources`);

      const EvidenceStore = require('./EvidenceStore');
      const evidenceStore = new EvidenceStore(this.graphDb);

      // Extract metadata, folder hierarchy, and image annotation sources first
      for (const item of discoveredItems) {
        if (item.source.sourceType() !== 'markdown') {
          try {
            const { entities, relationships, evidence } = await registry.extract(item.source, item.path);
            for (const ent of entities) {
              const id = this.graphService?.entityResolver
                ? this.graphService.entityResolver.generateEntityId(ent.name, ent.type || 'Entity')
                : `ent-${item.source.sourceType()}-${String(ent.name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
              this.graphDb.upsertEntity({ id, name: ent.name, canonical_name: ent.name, type: ent.type || 'Entity', properties: ent.properties || {} });
            }
            for (const rel of relationships) {
              const srcId = this.graphService?.entityResolver
                ? this.graphService.entityResolver.generateEntityId(rel.source_name, rel.source_type || 'Entity')
                : `ent-${item.source.sourceType()}-${String(rel.source_name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
              const tgtId = this.graphService?.entityResolver
                ? this.graphService.entityResolver.generateEntityId(rel.target_name, rel.target_type || 'Entity')
                : `ent-${item.source.sourceType()}-${String(rel.target_name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
              if (srcId !== tgtId) {
                this.graphDb.upsertEntity({ id: srcId, name: rel.source_name, canonical_name: rel.source_name, type: rel.source_type || 'Entity' });
                this.graphDb.upsertEntity({ id: tgtId, name: rel.target_name, canonical_name: rel.target_name, type: rel.target_type || 'Entity' });
                this.graphDb.upsertRelationship({ source_id: srcId, target_id: tgtId, type: rel.type, weight: rel.weight, confidence: rel.confidence });
              }
            }
            if (Array.isArray(evidence)) {
              for (const ev of evidence) {
                evidenceStore.addEvidence({
                  sourceId: item.path,
                  extractor: item.source.sourceType(),
                  subjectText: ev.subjectText || ev.subject_text || item.path,
                  predicateText: ev.predicateText || ev.predicate_text || 'related_to',
                  objectText: ev.objectText || ev.object_text || '',
                  rawSentence: ev.rawSentence || ev.raw_sentence || ev.subjectText || item.path,
                  confidence: ev.confidence || item.source.baseConfidence() || 1.0
                });
              }
            }
          } catch (nonMdErr) {
            log.warn(`Non-markdown source error (${item.source.sourceType()}):`, nonMdErr.message);
          }
        }
      }

      // 3. Process markdown files
      const workspaceFiles = this._getWorkspaceMarkdownFiles();
      const total = workspaceFiles.length;
      log.info(`Found ${total} markdown notes to index for graph`);
      this._logDb?.addLog('graph', `Found ${total} markdown notes to index for graph`, 'info');

      let processedCount = 0;
      let failedCount = 0;

      const BATCH_SIZE = 4;
      for (let i = 0; i < total; i += BATCH_SIZE) {
        await new Promise(resolve => setTimeout(resolve, 30));
        const batch = workspaceFiles.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async (filePath) => {
          if (typeof onProgress === 'function') {
            onProgress({ current: Math.min(i + BATCH_SIZE, total), total, noteName: path.basename(filePath) });
          }
          try {
            if (!fs.existsSync(filePath)) {
              failedCount++;
              return;
            }
            const content = fs.readFileSync(filePath, 'utf8');
            await this.graphService.processNote(filePath, content);
            processedCount++;
            this._logDb?.addLog('graph', `Extracted graph entities from note: ${path.basename(filePath)}`, 'info');
          } catch (fileErr) {
            log.error(`Error processing note ${filePath}:`, fileErr.message);
            this._logDb?.addLog('graph', `Failed extracting entities from note ${path.basename(filePath)}: ${fileErr.message}`, 'error');
            failedCount++;
          }
        }));
      }

      // Seed workspace root entity
      this.graphDb.upsertWorkspaceEntity(workspaceInfo);

      // Run community detection
      const CommunityDetector = require('./CommunityDetector');
      const communityDetector = new CommunityDetector();
      communityDetector.detect(this.graphDb, this._logDb);

      // Run validation engine
      const GraphValidationEngine = require('./GraphValidationEngine');
      const validator = new GraphValidationEngine(this.graphDb, this._logDb);
      await validator.validate();

      // Optimize SQLite query planner
      if (this.graphDb?.db) {
        try { this.graphDb.db.exec('PRAGMA ANALYZE;'); } catch { /* ignore */ }
      }

      log.info(`Knowledge Graph rebuild complete. Processed: ${processedCount}, Failed: ${failedCount}`);
      this._logDb?.addLog('graph', `Knowledge Graph rebuild complete. Processed: ${processedCount}, Failed: ${failedCount}`, 'info', {
        processedCount,
        failedCount,
        durationMs: Date.now() - (this._rebuildStartTime || Date.now())
      });

      if (this._buildReport) {
        this._buildReport.completedAt = new Date().toISOString();
        this._buildReport.totalDurationMs = Date.now() - (this._rebuildStartTime || Date.now());
        this._buildReport.stages.markdownProcessing = { durationMs: this._buildReport.totalDurationMs, processedCount, failedCount };
        this._buildReport.finalStats = this.graphDb.getStatus();
        this._lastBuildReport = this._buildReport;
      }

      return {
        success: true,
        processedCount,
        failedCount,
        stats: this.graphDb.getStatus(),
        report: this._lastBuildReport
      };
    } catch (err) {
      log.error('Failed to rebuild graph:', err);
      return { success: false, error: err.message };
    } finally {
      this.isRebuilding = false;
      try { if (this._logDb) { this._logDb.close(); this._logDb = null; } } catch { /* ignore */ }
    }
  }

  /**
   * Helper to scan all markdown files recursively in the workspace root
   */
  _getWorkspaceMarkdownFiles() {
    const rootPath = this.agent.workspaceRoot;
    if (!rootPath || !fs.existsSync(rootPath)) {
      // Fallback: check db file list
      if (this.agent.db && typeof this.agent.db.getWorkspaceFiles === 'function') {
        return this.agent.db.getWorkspaceFiles().map(f => f.file_path);
      }
      return [];
    }

    const files = [];
    const scan = (dir) => {
      // Ignore hidden folders (like .notes-app, .git)
      const base = path.basename(dir);
      if (base.startsWith('.')) return;

      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            scan(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('.md')) {
            files.push(fullPath);
          }
        }
      } catch (err) {
        log.error(`Failed to scan directory ${dir}:`, err.message);
      }
    };

    scan(rootPath);
    return files;
  }
}

module.exports = GraphBuilder;
