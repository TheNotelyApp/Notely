/**
 * MarkdownKnowledgeSource - KnowledgeSource implementation for Markdown document parsing
 */

const fs = require('fs');
const path = require('path');
const KnowledgeSource = require('./KnowledgeSource');
const MarkdownASTParser = require('../MarkdownASTParser');

const DEFAULT_EXCLUDE_DIRS = new Set([
  '.notes-app', '.versions', 'node_modules', '.git', '.svn', '.hg',
  'dist', 'build', '.artifacts', '.cache', '__pycache__', 'removed'
]);

class MarkdownKnowledgeSource extends KnowledgeSource {
  constructor() {
    super();
    this.astParser = new MarkdownASTParser();
  }

  sourceType() {
    return 'markdown';
  }

  baseConfidence() {
    return 1.0;
  }

  discover(workspaceRoot) {
    if (!workspaceRoot || !fs.existsSync(workspaceRoot)) return [];
    const files = [];

    const scan = (dir) => {
      const base = path.basename(dir);
      if (base.startsWith('.') || DEFAULT_EXCLUDE_DIRS.has(base)) return;

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
      } catch {
        /* ignore directory read error */
      }
    };

    scan(workspaceRoot);
    return files;
  }

  async extractEntities(filePath, content = '') {
    const text = content || (fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '');
    const ast = this.astParser.parse(filePath, text);
    const entities = [ast.rootEntity];

    for (const link of ast.links) {
      entities.push({
        name: link.targetName,
        type: 'Note',
        properties: { name: link.targetName }
      });
    }

    for (const tag of ast.tags) {
      entities.push({
        name: tag.name,
        type: 'Tag',
        properties: { tagName: tag.tagName }
      });
    }

    for (const media of ast.media) {
      entities.push({
        name: media.name,
        type: 'Image',
        properties: { path: media.path, alt: media.alt }
      });
    }

    for (const sec of ast.sections) {
      entities.push({
        name: sec.title,
        type: 'Section',
        properties: { level: sec.level }
      });
    }

    for (const task of ast.tasks) {
      entities.push({
        name: task.taskText,
        type: 'Task',
        properties: { completed: task.completed }
      });
    }

    return entities;
  }

  async extractRelationships(filePath, content = '') {
    const text = content || (fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '');
    const ast = this.astParser.parse(filePath, text);
    const noteName = path.basename(filePath, '.md');
    const relationships = [];

    for (const link of ast.links) {
      relationships.push({
        source_name: noteName,
        target_name: link.targetName,
        source_type: 'Note',
        target_type: 'Note',
        type: 'links_to',
        weight: 1.2,
        confidence: 1.0
      });
    }

    for (const tag of ast.tags) {
      relationships.push({
        source_name: noteName,
        target_name: tag.name,
        source_type: 'Note',
        target_type: 'Tag',
        type: 'tagged',
        weight: 1.0,
        confidence: 1.0
      });
    }

    for (const media of ast.media) {
      relationships.push({
        source_name: noteName,
        target_name: media.name,
        source_type: 'Note',
        target_type: 'Image',
        type: 'contains_media',
        weight: 0.9,
        confidence: 1.0
      });
    }

    for (const task of ast.tasks) {
      relationships.push({
        source_name: noteName,
        target_name: task.taskText,
        source_type: 'Note',
        target_type: 'Task',
        type: task.completed ? 'has_completed_task' : 'has_open_task',
        weight: 0.95,
        confidence: 1.0
      });
    }

    return relationships;
  }
}

module.exports = MarkdownKnowledgeSource;
