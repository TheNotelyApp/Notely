/**
 * MermaidKnowledgeSource - Parses Mermaid diagram markup into graph entities & relationships
 */

const fs = require('fs');
const path = require('path');
const KnowledgeSource = require('./KnowledgeSource');

class MermaidKnowledgeSource extends KnowledgeSource {
  sourceType() {
    return 'mermaid';
  }

  baseConfidence() {
    return 0.90;
  }

  supports(filePath) {
    return typeof filePath === 'string' && (filePath.endsWith('.mermaid') || filePath.endsWith('.mmd'));
  }

  discover(workspaceRoot) {
    if (!workspaceRoot || !fs.existsSync(workspaceRoot)) return [];
    const files = [];
    const scan = (dir) => {
      const base = path.basename(dir);
      if (base.startsWith('.')) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            scan(fullPath);
          } else if (entry.isFile() && (entry.name.endsWith('.mermaid') || entry.name.endsWith('.mmd'))) {
            files.push(fullPath);
          }
        }
      } catch { /* ignore scan error */ }
    };
    scan(workspaceRoot);
    return files;
  }

  async extractEntities(filePath, content) {
    const rawText = content || (filePath && fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '');
    const { entities } = this.parseMermaid(rawText);
    return entities;
  }

  async extractRelationships(filePath, content) {
    const rawText = content || (filePath && fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '');
    const { relationships } = this.parseMermaid(rawText);
    return relationships;
  }

  parseMermaid(mermaidText) {
    const entities = [];
    const relationships = [];
    if (!mermaidText || typeof mermaidText !== 'string') return { entities, relationships };

    const lines = mermaidText.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('%%') && !l.startsWith('style ') && !l.startsWith('classDef '));
    const seenEntities = new Set();

    for (const line of lines) {
      // Flowchart / Graph arrow: A --> B, A -- label --> B, A[Label A] --> B[Label B]
      const edgeMatch = line.match(/(?:([A-Za-z0-9_ -]+)(?:\[(.*?)\])?)\s*--(?:>(?:\|(.*?)\|)?|-(.*?)-+>)\s*(?:([A-Za-z0-9_ -]+)(?:\[(.*?)\])?)/);
      if (edgeMatch) {
        const srcRaw = edgeMatch[1]?.trim() || '';
        const srcLabel = edgeMatch[2]?.trim() || srcRaw;
        const relLabel = (edgeMatch[3] || edgeMatch[4] || 'flows_to').trim();
        const tgtRaw = edgeMatch[5]?.trim() || '';
        const tgtLabel = edgeMatch[6]?.trim() || tgtRaw;

        if (srcLabel && !seenEntities.has(srcLabel)) {
          seenEntities.add(srcLabel);
          entities.push({ name: srcLabel, type: 'Component' });
        }
        if (tgtLabel && !seenEntities.has(tgtLabel)) {
          seenEntities.add(tgtLabel);
          entities.push({ name: tgtLabel, type: 'Component' });
        }

        if (srcLabel && tgtLabel && srcLabel !== tgtLabel) {
          relationships.push({
            source_name: srcLabel,
            target_name: tgtLabel,
            source_type: 'Component',
            target_type: 'Component',
            type: relLabel.toLowerCase().replace(/[^a-z0-9_]+/g, '_') || 'flows_to',
            weight: 0.90,
            confidence: 0.90
          });
        }
      }
    }

    return { entities, relationships };
  }
}

module.exports = MermaidKnowledgeSource;
