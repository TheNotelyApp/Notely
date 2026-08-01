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
const { SemanticExtractionEngine } = require('./semantic');

const log = createLogger('GraphService');

class GraphService {
  constructor(agent, graphDb, ontologyBuilder = null) {
    this.agent = agent;
    this.graphDb = graphDb;
    this.astParser = new MarkdownASTParser();
    this.evidenceStore = new EvidenceStore(graphDb);
    this.entityResolver = new EntityResolver(graphDb);
    this.fusionEngine = new EvidenceFusionEngine(graphDb, this.evidenceStore);
    this.ontologyBuilder = ontologyBuilder || new OntologyBuilder('general');
    this.semanticEngine = null;
  }

  getSemanticEngine() {
    if (!this.semanticEngine && this.agent?.appDataDir) {
      this.semanticEngine = new SemanticExtractionEngine(this.agent.appDataDir);
    }
    return this.semanticEngine;
  }

  getPipeline() {
    return this.getSemanticEngine();
  }

  getExtractor() {
    return this.getSemanticEngine();
  }

  /**
   * Process a markdown note and save entities, relationships, and evidence to GraphDB
   */
  async processNote(filePath, content) {
    try {
      if (!this.graphDb.isInitialized) {
        this.graphDb.initialize();
      }

      const noteName = path.basename(filePath, '.md');
      const rootEntityId = this.entityResolver.generateEntityId(filePath, 'Note');

      // 1. Structural Markdown AST Parsing
      const ast = this.astParser.parse(filePath, content);

      // Root Note Entity
      this.graphDb.upsertEntity({
        id: rootEntityId,
        name: noteName,
        canonical_name: noteName,
        type: 'Note',
        note_path: filePath,
        properties: ast.rootEntity.properties
      });

      // Clear old evidence for note re-ingestion
      this.evidenceStore.deleteForSource(filePath);

      // 1a. Wikilinks [[Target]]
      for (const link of ast.links) {
        const targetId = this.entityResolver.generateEntityId(link.targetName, 'Note');
        this.graphDb.upsertEntity({
          id: targetId,
          name: link.targetName,
          canonical_name: link.targetName,
          type: 'Note',
          properties: { name: link.targetName }
        });

        const evId = this.evidenceStore.addEvidence({
          sourceId: filePath,
          extractor: 'ast_parser',
          subjectText: noteName,
          predicateText: 'links_to',
          objectText: link.targetName,
          rawSentence: `[[${link.targetName}]]`,
          confidence: 1.0
        });

        this.graphDb.upsertRelationship({
          source_id: rootEntityId,
          target_id: targetId,
          type: 'links_to',
          weight: 1.2,
          confidence: 1.0,
          evidence_id: evId
        });
      }

      // 1b. Tags #tag
      for (const tag of ast.tags) {
        const tagId = this.entityResolver.generateEntityId(tag.tagName, 'Tag');
        this.graphDb.upsertEntity({
          id: tagId,
          name: tag.tagName,
          canonical_name: tag.name,
          type: 'Tag'
        });

        this.graphDb.upsertRelationship({
          source_id: rootEntityId,
          target_id: tagId,
          type: 'tagged',
          weight: 1.0,
          confidence: 1.0
        });
      }

      // 1c. Embedded Media & Image Annotations
      for (const media of ast.media) {
        const mediaId = this.entityResolver.generateEntityId(media.name, 'Image');
        this.graphDb.upsertEntity({
          id: mediaId,
          name: media.name,
          canonical_name: media.name,
          type: 'Image',
          properties: { path: media.path, alt: media.alt }
        });

        this.graphDb.upsertRelationship({
          source_id: rootEntityId,
          target_id: mediaId,
          type: 'contains_media',
          weight: 0.9,
          confidence: 1.0
        });

        // Extract semantic knowledge from Image Annotations (media.alt)
        if (media.alt && media.alt.length > 3 && media.alt.toLowerCase() !== 'image') {
          const altId = this.entityResolver.generateEntityId(`${media.name}:${media.alt}`, 'Annotation');
          this.graphDb.upsertEntity({
            id: altId,
            name: media.alt,
            canonical_name: media.alt,
            type: 'Annotation',
            properties: { imagePath: media.path }
          });
          this.graphDb.upsertRelationship({
            source_id: mediaId,
            target_id: altId,
            type: 'annotated_with',
            weight: 0.95,
            confidence: 1.0
          });
        }
      }

      // 1d. Attachments & URLs
      for (const url of ast.urls) {
        const urlId = this.entityResolver.generateEntityId(url.url, 'ExternalURL');
        this.graphDb.upsertEntity({
          id: urlId,
          name: url.label,
          canonical_name: url.url,
          type: 'ExternalURL',
          properties: { url: url.url }
        });

        this.graphDb.upsertRelationship({
          source_id: rootEntityId,
          target_id: urlId,
          type: 'references_url',
          weight: 0.8,
          confidence: 1.0
        });
      }

      for (const att of ast.attachments) {
        const attId = this.entityResolver.generateEntityId(att.name, 'Document');
        this.graphDb.upsertEntity({
          id: attId,
          name: att.name,
          canonical_name: att.name,
          type: 'Document',
          properties: { path: att.path, label: att.label }
        });

        this.graphDb.upsertRelationship({
          source_id: rootEntityId,
          target_id: attId,
          type: 'attaches_file',
          weight: 0.9,
          confidence: 1.0
        });
      }

      // 1e. Code Blocks
      for (const cb of ast.codeBlocks) {
        const langId = this.entityResolver.generateEntityId(cb.language, 'CodeBlock');
        this.graphDb.upsertEntity({
          id: langId,
          name: cb.language.toUpperCase(),
          canonical_name: cb.language,
          type: 'CodeBlock',
          properties: { language: cb.language }
        });

        this.graphDb.upsertRelationship({
          source_id: rootEntityId,
          target_id: langId,
          type: 'contains_code',
          weight: 0.8,
          confidence: 1.0
        });
      }

      // 1f. Sections (Structural Headings) - filter system design sections
      const SYSTEM_SECTIONS = new Set(['rawnotes', 'raw notes', 'raw', 'cleansed', 'cleansed notes', 'cleansed note']);
      for (const sec of ast.sections) {
        const normTitle = String(sec.title || '').trim().toLowerCase();
        if (SYSTEM_SECTIONS.has(normTitle)) {
          continue;
        }

        const secId = this.entityResolver.generateEntityId(`${filePath}:${sec.title}`, 'Section');
        this.graphDb.upsertEntity({
          id: secId,
          name: sec.title,
          canonical_name: sec.title,
          type: 'Section',
          properties: { level: sec.level, wordCount: sec.wordCount }
        });

        const hierarchyWeight = parseFloat(Math.max(0.5, 1.4 - ((sec.level || 1) * 0.1)).toFixed(2));
        this.graphDb.upsertRelationship({
          source_id: rootEntityId,
          target_id: secId,
          type: 'contains_section',
          weight: hierarchyWeight,
          confidence: 1.0
        });
      }

      // 1g. Note Metadata Entities (Person, Location from Frontmatter/AST)
      for (const metaEnt of (ast.metadataEntities || [])) {
        const metaId = this.entityResolver.generateEntityId(metaEnt.name, metaEnt.type || 'Concept');
        this.graphDb.upsertEntity({
          id: metaId,
          name: metaEnt.name,
          canonical_name: metaEnt.name,
          type: metaEnt.type || 'Concept'
        });

        this.graphDb.upsertRelationship({
          source_id: rootEntityId,
          target_id: metaId,
          type: metaEnt.relation || 'relates_to',
          weight: 0.9,
          confidence: 1.0
        });
      }

      for (const mf of (ast.mathFormulas || [])) {
        const mfId = this.entityResolver.generateEntityId(mf.formula, 'Formula');
        this.graphDb.upsertEntity({
          id: mfId,
          name: mf.formula.length > 30 ? mf.formula.slice(0, 30) + '...' : mf.formula,
          canonical_name: mf.formula,
          type: 'Formula',
          properties: { rawFormula: mf.formula }
        });

        this.graphDb.upsertRelationship({
          source_id: rootEntityId,
          target_id: mfId,
          type: 'contains_formula',
          weight: 0.9,
          confidence: 1.0
        });
      }

      // 1j. Tasks (- [ ] task, - [x] task)
      for (const t of (ast.tasks || [])) {
        const taskId = this.entityResolver.generateEntityId(`${filePath}:${t.taskText}`, 'Task');
        this.graphDb.upsertEntity({
          id: taskId,
          name: t.taskText,
          canonical_name: t.taskText,
          type: 'Task',
          properties: { completed: t.completed }
        });

        this.graphDb.upsertRelationship({
          source_id: rootEntityId,
          target_id: taskId,
          type: t.completed ? 'has_completed_task' : 'has_open_task',
          weight: 0.95,
          confidence: 1.0
        });
      }



      // 2. Cross-Note Plain Text Mention Mining via Inverted Index
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
              if (re.test(content)) {
                this.fusionEngine.fuseTriple({
                  source_id: rootEntityId,
                  target_id: otherId,
                  type: 'mentions_note',
                  weight: 0.85,
                  confidence: 0.85
                });
              }
            }
          });
        } catch { /* ignore mention index errors */ }
      }

      // 3. Neural AI Pipeline via Model-Agnostic SemanticExtractionEngine
      const semanticEngine = this.getSemanticEngine();
      if (semanticEngine) {
        const prefs = this.agent?.config ? this.agent.config.loadPreferences() : {};
        const confidenceThreshold = typeof prefs.graphConfidence === 'number' ? prefs.graphConfidence : 0.60;
        const cleansedContent = this.astParser.cleanse(content);

        const extractionResult = await semanticEngine.extract({
          id: filePath,
          content: cleansedContent || content,
          sourceType: 'markdown',
          metadata: { sourceFile: filePath }
        }, { confidenceThreshold });

        const createdEntities = new Map();

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
      }

      log.debug(`Graph processed: ${path.basename(filePath)}`);

    } catch (err) {
      log.error(`Failed to process note graph for ${filePath}:`, err);
      throw err;
    }
  }
}

module.exports = GraphService;
