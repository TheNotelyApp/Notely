/**
 * DrawioKnowledgeSource - Parses Draw.io XML files into graph entities & relationships
 */

const fs = require('fs');
const path = require('path');
const KnowledgeSource = require('./KnowledgeSource');

const DEFAULT_EXCLUDE_DIRS = new Set([
  '.notes-app', '.versions', 'node_modules', '.git', '.svn', '.hg',
  'dist', 'build', '.artifacts', '.cache', '__pycache__', 'removed'
]);

class DrawioKnowledgeSource extends KnowledgeSource {
  sourceType() {
    return 'drawio';
  }

  baseConfidence() {
    return 0.90;
  }

  supports(filePath) {
    return typeof filePath === 'string' && (filePath.endsWith('.drawio') || filePath.endsWith('.drawio.xml'));
  }

  discover(workspaceRoot) {
    if (!workspaceRoot || !fs.existsSync(workspaceRoot)) return [];
    const files = [];

    // 1. Check .notes-app/drawio-diagrams
    const drawioAppDir = path.join(workspaceRoot, '.notes-app', 'drawio-diagrams');
    if (fs.existsSync(drawioAppDir)) {
      try {
        const entries = fs.readdirSync(drawioAppDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile() && (entry.name.endsWith('.drawio') || entry.name.endsWith('.drawio.xml'))) {
            files.push(path.join(drawioAppDir, entry.name));
          }
        }
      } catch { /* ignore */ }
    }

    // 2. Check media/draw.io (legacy)
    const mediaDrawioDir = path.join(workspaceRoot, 'media', 'draw.io');
    if (fs.existsSync(mediaDrawioDir)) {
      try {
        const entries = fs.readdirSync(mediaDrawioDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile() && (entry.name.endsWith('.drawio') || entry.name.endsWith('.drawio.xml'))) {
            files.push(path.join(mediaDrawioDir, entry.name));
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
          } else if (entry.isFile() && (entry.name.endsWith('.drawio') || entry.name.endsWith('.drawio.xml'))) {
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
    const diagramName = path.basename(filePath).replace(/\.(drawio|drawio\.xml)$/i, '');
    const entities = [{ name: diagramName, type: 'Diagram', properties: { path: filePath, format: 'drawio' } }];

    try {
      const xml = fs.readFileSync(filePath, 'utf8');
      const cellRegex = /<mxCell[^>]+vertex="1"[^>]*>/gi;
      const valueRegex = /value="([^"]+)"/i;
      let match;

      while ((match = cellRegex.exec(xml)) !== null) {
        const tag = match[0];
        const valMatch = tag.match(valueRegex);
        if (valMatch && valMatch[1]) {
          const cleanValue = valMatch[1].replace(/<[^>]+>/g, '').trim();
          if (cleanValue.length >= 2 && cleanValue.length <= 80) {
            entities.push({
              name: cleanValue,
              type: 'Component',
              properties: { sourceFile: filePath }
            });
          }
        }
      }
    } catch { /* ignore parse error */ }

    return entities;
  }

  async extractRelationships(filePath) {
    if (!fs.existsSync(filePath)) return [];
    const diagramName = path.basename(filePath).replace(/\.(drawio|drawio\.xml)$/i, '');
    const relationships = [];

    try {
      const xml = fs.readFileSync(filePath, 'utf8');
      const vertexMap = new Map();
      const vertexRegex = /<mxCell[^>]+id="([^"]+)"[^>]+vertex="1"[^>]*>/gi;
      const valRegex = /value="([^"]+)"/i;
      let match;

      while ((match = vertexRegex.exec(xml)) !== null) {
        const id = match[1];
        const valMatch = match[0].match(valRegex);
        if (id && valMatch && valMatch[1]) {
          const clean = valMatch[1].replace(/<[^>]+>/g, '').trim();
          if (clean) vertexMap.set(id, clean);
        }
      }

      const edgeRegex = /<mxCell[^>]+edge="1"[^>]+source="([^"]+)"[^>]+target="([^"]+)"[^>]*>/gi;
      while ((match = edgeRegex.exec(xml)) !== null) {
        const srcId = match[1];
        const tgtId = match[2];
        const srcName = vertexMap.get(srcId);
        const tgtName = vertexMap.get(tgtId);

        if (srcName && tgtName && srcName !== tgtName) {
          relationships.push({
            source_name: srcName,
            target_name: tgtName,
            source_type: 'Component',
            target_type: 'Component',
            type: 'connects_to',
            weight: 0.90,
            confidence: 0.90
          });
        }
      }

      vertexMap.forEach(name => {
        relationships.push({
          source_name: diagramName,
          target_name: name,
          source_type: 'Diagram',
          target_type: 'Component',
          type: 'contains_element',
          weight: 1.0,
          confidence: 0.90
        });
      });
    } catch { /* ignore parse error */ }

    return relationships;
  }
}

module.exports = DrawioKnowledgeSource;
