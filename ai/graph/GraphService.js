/**
 * GraphService - High-level orchestrator for Knowledge Graph ingestion & processing
 */

const path = require('path');
const { createLogger } = require('../core/logger');
const MarkdownASTParser = require('./MarkdownASTParser');
const EvidenceStore = require('./EvidenceStore');
const EntityResolver = require('./EntityResolver');
const EvidenceFusionEngine = require('./EvidenceFusionEngine');
const OntologyBuilder = require('./OntologyBuilder');
const DeterministicSemanticMiner = require('./DeterministicSemanticMiner');
const { SemanticExtractionEngine } = require('./semantic');

const log = createLogger('GraphService');

class GraphService {
  constructor(agentOrOptions, graphDb, ontologyBuilder = null) {
    if (agentOrOptions && !graphDb && agentOrOptions.graphDb) {
      graphDb = agentOrOptions.graphDb;
    }
    this.agent = (agentOrOptions && agentOrOptions.appDataDir) ? agentOrOptions : null;
    this.graphDb = graphDb;
    this.astParser = new MarkdownASTParser();
    this.evidenceStore = new EvidenceStore(graphDb);
    this.embeddingService = (agentOrOptions && agentOrOptions.embeddingService) || null;
    this.entityResolver = new EntityResolver(graphDb, this.embeddingService);
    this.fusionEngine = new EvidenceFusionEngine(graphDb, this.evidenceStore);
    this.ontologyBuilder = ontologyBuilder || new OntologyBuilder('general');
    this.semanticMiner = new DeterministicSemanticMiner();
    this.semanticEngine = null;
    this._processQueue = Promise.resolve(); // Gap 1: Ingestion Queue to prevent SQLite transaction collisions
  }

  getSemanticEngine() {
    if (!this.semanticEngine && this.agent?.appDataDir) {
      this.semanticEngine = new SemanticExtractionEngine(this.agent.appDataDir);
    }
    return this.semanticEngine;
  }

  /**
   * Process a markdown note and save entities, relationships, and evidence to GraphDB
   * Enqueued to serialize execution and prevent concurrent transaction collisions.
   */
  processNote(filePath, content) {
    this._processQueue = this._processQueue
      .then(() => this._processNoteInternal(filePath, content))
      .catch((err) => {
        log.error(`Queue error processing ${filePath}:`, err?.message || err);
      });
    return this._processQueue;
  }

  async _processNoteInternal(filePath, content) {
    try {
      if (this.graphDb && !this.graphDb.db) {
        this.graphDb.initialize();
      }

      const noteName = this.entityResolver.cleanName(path.basename(filePath, '.md'));
      const resolvedRoot = this.entityResolver.resolveMention(noteName, 'Note');
      const rootEntityId = resolvedRoot ? resolvedRoot.id : this.entityResolver.generateEntityId(noteName, 'Note');

      // 1. Structural Markdown AST Parsing
      const ast = this.astParser.parse(filePath, content);

      // Wrap synchronous AST structural persistence inside a single SQLite transaction
      if (this.graphDb?.runTransaction) {
        this.graphDb.runTransaction(() => {
          // Root Note Entity
          this.graphDb.upsertEntity({
            id: rootEntityId,
            name: noteName,
            canonical_name: noteName,
            type: 'Note',
            note_path: filePath,
            properties: ast.rootEntity.properties
          });

          // Remove stale outgoing relationships before deleting evidence to preserve FK integrity
          if (this.graphDb?.db) {
            this.graphDb.db.prepare('DELETE FROM relationships WHERE source_id = ?').run(rootEntityId);
          }
          this.evidenceStore.deleteForSource(filePath);

          // 1a. Wikilinks [[Target]]
          for (const link of ast.links) {
            const targetName = this.entityResolver.cleanName(link.targetName);
            if (!targetName) continue;
            const resolvedTarget = this.entityResolver.resolveMention(targetName, 'Note');
            const targetId = resolvedTarget ? resolvedTarget.id : this.entityResolver.generateEntityId(targetName, 'Note');
            this.graphDb.upsertEntity({
              id: targetId,
              name: targetName,
              canonical_name: targetName,
              type: 'Note',
              properties: { name: targetName }
            });

            const evId = this.evidenceStore.addEvidence({
              sourceId: filePath,
              extractor: 'ast_parser',
              subjectText: noteName,
              predicateText: 'links_to',
              objectText: targetName,
              rawSentence: `[[${targetName}]]`,
              confidence: 1.0
            });

            this.graphDb.upsertRelationship({
              source_id: rootEntityId,
              target_id: targetId,
              type: 'links_to',
              weight: 1.2,
              confidence: 1.0,
              extractor: 'ast_parser',
              evidence_id: evId
            });
          }

          // 1b. Tags #tag
          for (const tag of ast.tags) {
            const cleanTagName = this.entityResolver.cleanName(tag.tagName);
            if (!cleanTagName) continue;
            const tagResolved = this.entityResolver.resolveMention(cleanTagName, 'Tag');
            const tagId = tagResolved ? tagResolved.id : this.entityResolver.generateEntityId(cleanTagName, 'Tag');
            this.graphDb.upsertEntity({
              id: tagId,
              name: cleanTagName,
              canonical_name: this.entityResolver.cleanName((tag.name || cleanTagName).replace(/^#+/, '')),
              type: 'Tag'
            });

        const evId = this.evidenceStore.addEvidence({
          sourceId: filePath,
          extractor: 'ast_parser',
          subjectText: noteName,
          predicateText: 'tagged',
          objectText: cleanTagName,
          rawSentence: `#${cleanTagName}`,
          confidence: 1.0
        });

        this.graphDb.upsertRelationship({
          source_id: rootEntityId,
          target_id: tagId,
          type: 'tagged',
          weight: 1.0,
          confidence: 1.0,
          extractor: 'ast_parser',
          evidence_id: evId
        });
      }

      // 1c. Embedded Media & Diagrams (Unified Media entity, no duplicate Annotation nodes)
      for (const media of ast.media) {
        const cleanMediaName = this.entityResolver.cleanName(media.name);
        if (!cleanMediaName) continue;
        const mediaResolved = this.entityResolver.resolveMention(cleanMediaName, 'Image');
        const mediaId = mediaResolved ? mediaResolved.id : this.entityResolver.generateEntityId(cleanMediaName, 'Image');
        this.graphDb.upsertEntity({
          id: mediaId,
          name: cleanMediaName,
          canonical_name: cleanMediaName,
          type: 'Image',
          properties: { path: media.path, alt: media.alt || '', caption: media.alt || '' }
        });

        const evId = this.evidenceStore.addEvidence({
          sourceId: filePath,
          extractor: 'ast_parser',
          subjectText: noteName,
          predicateText: 'contains_media',
          objectText: cleanMediaName,
          rawSentence: `![${media.alt || ''}](${media.path})`,
          confidence: 1.0
        });

        this.graphDb.upsertRelationship({
          source_id: rootEntityId,
          target_id: mediaId,
          type: 'contains_media',
          weight: 0.9,
          confidence: 1.0,
          extractor: 'ast_parser',
          evidence_id: evId
        });
      }

      // 1d. Attachments & URLs
      for (const url of ast.urls) {
        const cleanUrl = this.entityResolver.cleanName(url.url);
        const cleanLabel = this.entityResolver.cleanName(url.label || url.url);
        if (!cleanUrl) continue;
        const urlResolved = this.entityResolver.resolveMention(cleanUrl, 'ExternalURL');
        const urlId = urlResolved ? urlResolved.id : this.entityResolver.generateEntityId(cleanUrl, 'ExternalURL');
        this.graphDb.upsertEntity({
          id: urlId,
          name: cleanLabel,
          canonical_name: cleanUrl,
          type: 'ExternalURL',
          properties: { url: cleanUrl }
        });

        const evId = this.evidenceStore.addEvidence({
          sourceId: filePath,
          extractor: 'ast_parser',
          subjectText: noteName,
          predicateText: 'references_url',
          objectText: cleanUrl,
          rawSentence: `[${cleanLabel}](${cleanUrl})`,
          confidence: 1.0
        });

        this.graphDb.upsertRelationship({
          source_id: rootEntityId,
          target_id: urlId,
          type: 'references_url',
          weight: 0.8,
          confidence: 1.0,
          extractor: 'ast_parser',
          evidence_id: evId
        });
      }

      for (const att of ast.attachments) {
        const cleanAttName = this.entityResolver.cleanName(att.name);
        if (!cleanAttName) continue;
        const attResolved = this.entityResolver.resolveMention(cleanAttName, 'Document');
        const attId = attResolved ? attResolved.id : this.entityResolver.generateEntityId(cleanAttName, 'Document');
        this.graphDb.upsertEntity({
          id: attId,
          name: cleanAttName,
          canonical_name: cleanAttName,
          type: 'Document',
          properties: { path: att.path, label: att.label }
        });

        const evId = this.evidenceStore.addEvidence({
          sourceId: filePath,
          extractor: 'ast_parser',
          subjectText: noteName,
          predicateText: 'attaches_file',
          objectText: cleanAttName,
          rawSentence: `[${att.label || cleanAttName}](${att.path})`,
          confidence: 1.0
        });

        this.graphDb.upsertRelationship({
          source_id: rootEntityId,
          target_id: attId,
          type: 'attaches_file',
          weight: 0.9,
          confidence: 1.0,
          extractor: 'ast_parser',
          evidence_id: evId
        });
      }

      // 1e. Code Blocks - Stored as properties on Note entity instead of standalone nodes
      const codeLangs = ast.codeBlocks.map(cb => this.entityResolver.cleanName(cb.language)).filter(Boolean);
      if (codeLangs.length > 0) {
        this.graphDb.upsertEntity({
          id: rootEntityId,
          name: noteName,
          canonical_name: noteName,
          type: 'Note',
          note_path: filePath,
          properties: { codeLanguages: [...new Set(codeLangs)] }
        });
      }

      // 1f. Sections (Structural Headings) - Hierarchical scoping & qualified names
      const SYSTEM_SECTIONS = new Set(['rawnotes', 'raw notes', 'raw', 'cleansed', 'cleansed notes', 'cleansed note']);
      for (const sec of ast.sections) {
        const cleanSecTitle = this.entityResolver.cleanName(sec.title);
        const normTitle = cleanSecTitle.toLowerCase();
        if (SYSTEM_SECTIONS.has(normTitle)) {
          continue;
        }

        const level = sec.level || 1;
        const secId = this.entityResolver.generateEntityId(`${rootEntityId}:h${level}:${cleanSecTitle}`, 'Section');
        const qualifiedName = `${noteName} > ${cleanSecTitle}`;

        this.graphDb.upsertEntity({
          id: secId,
          name: qualifiedName,
          canonical_name: qualifiedName,
          type: 'Section',
          properties: { level, wordCount: sec.wordCount, noteName, sectionTitle: cleanSecTitle }
        });

        const evId = this.evidenceStore.addEvidence({
          sourceId: filePath,
          extractor: 'ast_parser',
          subjectText: noteName,
          predicateText: 'contains_section',
          objectText: cleanSecTitle,
          rawSentence: cleanSecTitle,
          confidence: 1.0
        });

        const hierarchyWeight = parseFloat(Math.max(0.5, 1.4 - (level * 0.1)).toFixed(2));
        this.graphDb.upsertRelationship({
          source_id: rootEntityId,
          target_id: secId,
          type: 'contains_section',
          weight: hierarchyWeight,
          confidence: 1.0,
          extractor: 'ast_parser',
          evidence_id: evId
        });
      }

      // 1g. Note Metadata Entities (Person, Location from Frontmatter/AST)
      for (const metaEnt of (ast.metadataEntities || [])) {
        const cleanMetaName = this.entityResolver.cleanName(metaEnt.name);
        if (!cleanMetaName) continue;
        const metaType = metaEnt.type || 'Concept';
        const metaResolved = this.entityResolver.resolveMention(cleanMetaName, metaType);
        const metaId = metaResolved ? metaResolved.id : this.entityResolver.generateEntityId(cleanMetaName, metaType);
        this.graphDb.upsertEntity({
          id: metaId,
          name: cleanMetaName,
          canonical_name: cleanMetaName,
          type: metaType
        });

        const evId = this.evidenceStore.addEvidence({
          sourceId: filePath,
          extractor: 'ast_parser',
          subjectText: noteName,
          predicateText: metaEnt.relation || 'relates_to',
          objectText: cleanMetaName,
          rawSentence: `${metaType}: ${cleanMetaName}`,
          confidence: 1.0
        });

        this.graphDb.upsertRelationship({
          source_id: rootEntityId,
          target_id: metaId,
          type: metaEnt.relation || 'relates_to',
          weight: 0.9,
          confidence: 1.0,
          extractor: 'ast_parser',
          evidence_id: evId
        });
      }

      for (const mf of (ast.mathFormulas || [])) {
        const cleanFormula = this.entityResolver.cleanName(mf.formula);
        if (!cleanFormula) continue;
        const mfId = this.entityResolver.generateEntityId(cleanFormula, 'Formula');
        this.graphDb.upsertEntity({
          id: mfId,
          name: cleanFormula.length > 30 ? cleanFormula.slice(0, 30) + '...' : cleanFormula,
          canonical_name: cleanFormula,
          type: 'Formula',
          properties: { rawFormula: cleanFormula }
        });

        const evId = this.evidenceStore.addEvidence({
          sourceId: filePath,
          extractor: 'ast_parser',
          subjectText: noteName,
          predicateText: 'contains_formula',
          objectText: cleanFormula,
          rawSentence: cleanFormula,
          confidence: 1.0
        });

        this.graphDb.upsertRelationship({
          source_id: rootEntityId,
          target_id: mfId,
          type: 'contains_formula',
          weight: 0.9,
          confidence: 1.0,
          extractor: 'ast_parser',
          evidence_id: evId
        });
      }

      // 1j. Tasks (- [ ] task, - [x] task)
      for (const t of (ast.tasks || [])) {
        const cleanTask = this.entityResolver.cleanName(t.taskText);
        if (!cleanTask) continue;
        const taskId = this.entityResolver.generateEntityId(`${rootEntityId}:${cleanTask}`, 'Task');
        this.graphDb.upsertEntity({
          id: taskId,
          name: cleanTask,
          canonical_name: cleanTask,
          type: 'Task',
          properties: { completed: t.completed }
        });

        const relType = t.completed ? 'has_completed_task' : 'has_open_task';
        const evId = this.evidenceStore.addEvidence({
          sourceId: filePath,
          extractor: 'ast_parser',
          subjectText: noteName,
          predicateText: relType,
          objectText: cleanTask,
          rawSentence: `- [${t.completed ? 'x' : ' '}] ${cleanTask}`,
          confidence: 1.0
        });

        this.graphDb.upsertRelationship({
          source_id: rootEntityId,
          target_id: taskId,
          type: relType,
          weight: 0.95,
          confidence: 1.0,
          extractor: 'ast_parser',
          evidence_id: evId
        });
      }
        });
      }

      const cleansedContent = this.astParser.cleanse(content);

      // 2. Cross-Note Plain Text Mention Mining with Mandatory Evidence
      if (this.graphDb?.db) {
        try {
          if (!this._mentionIndex || Date.now() - (this._mentionIndexTime || 0) > 30000) {
            const allNotes = this.graphDb.db.prepare("SELECT id, name FROM entities WHERE type = 'Note'").all();
            this._mentionIndex = new Map();
            for (const n of allNotes) {
              if (n.name && n.name.length >= 5) {
                this._mentionIndex.set(n.name.toLowerCase(), n.id);
              }
            }
            this._mentionIndexTime = Date.now();
          }

          this._mentionIndex.forEach((otherId, otherName) => {
            if (otherId !== rootEntityId && otherName.length >= 5) {
              const esc = otherName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const re = new RegExp(`\\b${esc}\\b`, 'i');
              if (re.test(cleansedContent)) {
                const evId = this.evidenceStore.addEvidence({
                  sourceId: filePath,
                  extractor: 'ast_parser',
                  subjectText: noteName,
                  predicateText: 'mentions_note',
                  objectText: otherName,
                  rawSentence: `Mentioned ${otherName} in ${noteName}.`,
                  confidence: 0.85
                });
                this.fusionEngine.fuseTriple({
                  source_id: rootEntityId,
                  target_id: otherId,
                  type: 'mentions_note',
                  weight: 0.85,
                  confidence: 0.85,
                  extractor: 'ast_parser',
                  evidenceId: evId
                });
              }
            }
          });
        } catch { /* ignore mention index errors */ }
      }

      // 2b. Rule-Based Deterministic Semantic Relationship Mining
      if (this.semanticMiner) {
        const minedRelations = this.semanticMiner.mine(cleansedContent || content);
        for (const mined of minedRelations) {
          const srcResolved = this.entityResolver.resolveMention(mined.sourceText, 'Concept');
          const tgtResolved = this.entityResolver.resolveMention(mined.targetText, 'Concept');
          if (!srcResolved || !tgtResolved) continue;

          const srcId = srcResolved.id;
          const tgtId = tgtResolved.id;

          this.graphDb.upsertEntity({ id: srcId, name: srcResolved.name, canonical_name: srcResolved.canonical_name, type: srcResolved.type });
          this.graphDb.upsertEntity({ id: tgtId, name: tgtResolved.name, canonical_name: tgtResolved.canonical_name, type: tgtResolved.type });

          const evId = this.evidenceStore.addEvidence({
            sourceId: filePath,
            extractor: 'deterministic_miner',
            subjectText: mined.sourceText,
            predicateText: mined.type,
            objectText: mined.targetText,
            rawSentence: mined.rawSentence,
            confidence: mined.confidence
          });

          this.fusionEngine.fuseTriple({
            source_id: srcId,
            target_id: tgtId,
            type: mined.type,
            weight: mined.confidence,
            confidence: mined.confidence,
            extractor: 'deterministic_miner',
            evidenceId: evId
          });

          // Connect root note entity to mined concepts
          this.fusionEngine.fuseTriple({
            source_id: rootEntityId,
            target_id: srcId,
            type: 'mentions',
            weight: mined.confidence,
            confidence: mined.confidence,
            extractor: 'deterministic_miner',
            evidenceId: evId
          });
        }
      }

      // 3. Neural AI Pipeline via Model-Agnostic SemanticExtractionEngine
      const semanticEngine = this.getSemanticEngine();
      if (semanticEngine) {
        const prefs = this.agent?.config ? this.agent.config.loadPreferences() : {};
        let confidenceThreshold = typeof prefs.graphConfidence === 'number' ? prefs.graphConfidence : null;
        if (confidenceThreshold === null && semanticEngine?.adapter?.getSavedConfidenceThreshold) {
          confidenceThreshold = semanticEngine.adapter.getSavedConfidenceThreshold();
        }
        if (confidenceThreshold === null || isNaN(confidenceThreshold)) {
          confidenceThreshold = 0.45;
        }
        const ontologyLabels = this.ontologyBuilder ? this.ontologyBuilder.getGLiNERLabels() : [];

        const extractionResult = await semanticEngine.extract({
          id: filePath,
          content: cleansedContent || content,
          sourceType: 'markdown',
          metadata: { sourceFile: filePath }
        }, {
          confidenceThreshold,
          entityTypes: ontologyLabels.length > 0 ? ontologyLabels : undefined
        });

        const createdEntities = new Map();

        // Gap 4: Wrap neural entity and relationship writes in a single transaction
        const saveNeuralResults = () => {
          // Clear old semantic edges for this note before re-inserting
          if (this.graphDb?.db) {
            try {
              this.graphDb.db.prepare(
                "DELETE FROM relationships WHERE source_id = ? AND extractor = 'gliner2-relex'"
              ).run(rootEntityId);
            } catch { /* ignore */ }
          }

          // Save AI extracted entities
          for (const ent of extractionResult.entities) {
            if ((ent.confidence || 0) < confidenceThreshold) continue;
            const resolved = this.entityResolver.resolveMention(ent.text || ent.canonicalName, ent.type || 'Entity');
            if (resolved) {
              this.graphDb.upsertEntity({
                id: resolved.id,
                name: resolved.name,
                canonical_name: resolved.canonical_name,
                type: resolved.type,
                properties: { confidence: ent.confidence }
              });
              createdEntities.set(ent.text, resolved.id);
              if (ent.id) createdEntities.set(ent.id, resolved.id);

              let evidenceId = null;
              if (ent.sourceEvidence && this.evidenceStore) {
                evidenceId = this.evidenceStore.addEvidence({
                  sourceId: filePath,
                  extractor: ent.sourceEvidence.extractionModel || 'gliner2-relex',
                  subjectText: resolved.name,
                  rawSentence: ent.sourceEvidence.rawSnippet || content,
                  confidence: ent.confidence
                });
              }

              // Connect root note to extracted entity
              this.graphDb.upsertRelationship({
                source_id: rootEntityId,
                target_id: resolved.id,
                type: 'mentions',
                weight: ent.confidence || 0.8,
                confidence: ent.confidence || 0.8,
                extractor: 'gliner2-relex',
                evidence_id: evidenceId
              });
            }
          }

          // Save AI extracted relationships
          for (const rel of extractionResult.relations) {
            if ((rel.confidence || 0) < confidenceThreshold) continue;
            const srcId = createdEntities.get(rel.sourceEntityId) || createdEntities.get(rel.sourceText) || this.entityResolver.generateEntityId(rel.sourceText, 'Entity');
            const tgtId = createdEntities.get(rel.targetEntityId) || createdEntities.get(rel.targetText) || this.entityResolver.generateEntityId(rel.targetText, 'Entity');

            if (srcId && tgtId && srcId !== tgtId) {
              let evidenceId = null;
              if (rel.sourceEvidence && this.evidenceStore) {
                evidenceId = this.evidenceStore.addEvidence({
                  sourceId: filePath,
                  extractor: rel.sourceEvidence.extractionModel || 'gliner2-relex',
                  subjectText: rel.sourceText,
                  predicateText: rel.relationType,
                  objectText: rel.targetText,
                  rawSentence: rel.sourceEvidence.rawSnippet || content,
                  confidence: rel.confidence
                });
              }

              this.fusionEngine.fuseTriple({
                source_id: srcId,
                target_id: tgtId,
                type: rel.relationType || 'RELATED_TO',
                weight: rel.confidence || 0.85,
                confidence: rel.confidence || 0.85,
                extractor: 'gliner2-relex',
                evidenceId
              });
            }
          }
        };

        if (this.graphDb?.runTransaction) {
          this.graphDb.runTransaction(saveNeuralResults);
        } else {
          saveNeuralResults();
        }
      }

      log.info(`Successfully processed note graph for: ${filePath}`);
    } catch (err) {
      log.error(`Failed to process note graph for ${filePath}:`, err);
      throw err;
    }
  }
}

module.exports = GraphService;
