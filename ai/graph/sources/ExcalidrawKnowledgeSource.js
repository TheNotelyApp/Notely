/**
 * ExcalidrawKnowledgeSource - Parses .excalidraw JSON files into graph entities & relationships
 */

const fs = require('fs');
const path = require('path');
const KnowledgeSource = require('./KnowledgeSource');

const DEFAULT_EXCLUDE_DIRS = new Set([
  '.notes-app', '.versions', 'node_modules', '.git', '.svn', '.hg',
  'dist', 'build', '.artifacts', '.cache', '__pycache__', 'removed'
]);

class ExcalidrawKnowledgeSource extends KnowledgeSource {
  sourceType() {
    return 'excalidraw';
  }

  baseConfidence() {
    return 0.90;
  }

  supports(filePath) {
    return typeof filePath === 'string' && filePath.endsWith('.excalidraw');
  }

  discover(workspaceRoot) {
    if (!workspaceRoot || !fs.existsSync(workspaceRoot)) return [];
    const files = [];

    // 1. Check .notes-app/excali-diagrams
    const excaliAppDir = path.join(workspaceRoot, '.notes-app', 'excali-diagrams');
    if (fs.existsSync(excaliAppDir)) {
      try {
        const subdirs = fs.readdirSync(excaliAppDir, { withFileTypes: true });
        for (const sub of subdirs) {
          if (sub.isDirectory()) {
            const diagFile = path.join(excaliAppDir, sub.name, 'diagram.excalidraw');
            if (fs.existsSync(diagFile)) files.push(diagFile);
          }
        }
      } catch { /* ignore */ }
    }

    const scan = (dir) => {
      const base = path.basename(dir);
      if (base.startsWith('.') || DEFAULT_EXCLUDE_DIRS.has(base)) return;

      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            scan(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('.excalidraw')) {
            files.push(fullPath);
          }
        }
      } catch { /* ignore */ }
    };

    scan(workspaceRoot);
    return Array.from(new Set(files));
  }

  async extractEntities(filePath) {
    if (!fs.existsSync(filePath)) return [];
    const diagramName = path.basename(filePath, '.excalidraw');
    const entities = [{ name: diagramName, type: 'Diagram', properties: { path: filePath, format: 'excalidraw' } }];

    try {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const elements = Array.isArray(content.elements) ? content.elements : [];

      for (const el of elements) {
        if (!el.isDeleted && el.text && typeof el.text === 'string') {
          const cleanText = el.text.trim();
          if (cleanText.length >= 2 && cleanText.length <= 80) {
            entities.push({
              name: cleanText,
              type: 'Component',
              properties: { elementId: el.id, shapeType: el.type }
            });
          }
        }
      }
    } catch { /* ignore parse error */ }

    return entities;
  }

  async extractRelationships(filePath) {
    if (!fs.existsSync(filePath)) return [];
    const diagramName = path.basename(filePath, '.excalidraw');
    const relationships = [];

    try {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const elements = Array.isArray(content.elements) ? content.elements : [];

      const elementTextMap = new Map();
      elements.forEach(el => {
        if (!el.isDeleted && el.text) {
          elementTextMap.set(el.id, el.text.trim());
        }
      });

      elements.forEach(el => {
        if (!el.isDeleted && el.type === 'arrow') {
          const startId = el.startBinding?.elementId;
          const endId = el.endBinding?.elementId;
          const startText = elementTextMap.get(startId);
          const endText = elementTextMap.get(endId);

          if (startText && endText && startText !== endText) {
            relationships.push({
              source_name: startText,
              target_name: endText,
              source_type: 'Component',
              target_type: 'Component',
              type: 'connects_to',
              weight: 0.90,
              confidence: 0.90
            });
          }
        }
      });

      elementTextMap.forEach(text => {
        relationships.push({
          source_name: diagramName,
          target_name: text,
          source_type: 'Diagram',
          target_type: 'Component',
          type: 'contains_element',
          weight: 1.0,
          confidence: 0.90
        });
      });
    } catch { /* ignore */ }

    return relationships;
  }
}

module.exports = ExcalidrawKnowledgeSource;
