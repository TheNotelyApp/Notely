/**
 * KnowledgeApplicationService.cjs
 * Application service for Search and Knowledge capabilities.
 * Encapsulates Graph DB, Vector DB, and Search operations behind typed business interfaces.
 */

const fs = require('fs');
const path = require('path');
const { collectMarkdownFiles, assertPathInWorkspace } = require('./NoteApplicationService.cjs');

class KnowledgeApplicationService {
  constructor(agentInstance = null) {
    this.agentInstance = agentInstance;
  }

  setAgentInstance(agentInstance) {
    this.agentInstance = agentInstance;
  }

  /**
   * Search notes across workspace using full-text keyword matching & token scoring.
   */
  async searchNotes({ workspaceRoot, query, limit = 10 }) {
    if (!query || typeof query !== 'string' || !query.trim()) {
      return [];
    }
    const cleanQuery = query.trim().toLowerCase();
    let extractKeywords;
    try {
      extractKeywords = require('../../ai/utils/SearchQueryUtils.js').extractSearchKeywords;
    } catch {
      extractKeywords = (q) => q.toLowerCase().replace(/[^a-z0-9_\-\s]/g, ' ').split(/\s+/).filter(t => t.length >= 2);
    }
    const keywords = extractKeywords(query);

    const files = collectMarkdownFiles(workspaceRoot);
    const matches = [];

    for (const filePath of files) {
      try {
        const text = fs.readFileSync(filePath, 'utf8');
        const fileName = path.basename(filePath);
        const lowerFileName = fileName.toLowerCase();
        const lowerText = text.toLowerCase();

        let score = 0;
        let matchIdx = -1;
        let matchedKeyword = '';

        // 1. Exact phrase matching
        if (lowerFileName.includes(cleanQuery)) {
          score += 1.0;
          matchIdx = 0;
        } else if (lowerText.includes(cleanQuery)) {
          score += 0.85;
          matchIdx = lowerText.indexOf(cleanQuery);
          matchedKeyword = cleanQuery;
        }

        // 2. Multi-term token matching
        let matchedKeywordCount = 0;
        for (const kw of keywords) {
          if (lowerFileName.includes(kw)) {
            score += 0.4;
            matchedKeywordCount++;
            if (matchIdx === -1) {
              matchIdx = 0;
              matchedKeyword = kw;
            }
          }
          if (lowerText.includes(kw)) {
            score += 0.25;
            matchedKeywordCount++;
            if (matchIdx === -1) {
              matchIdx = lowerText.indexOf(kw);
              matchedKeyword = kw;
            }
          }
        }

        if (keywords.length > 1 && matchedKeywordCount >= keywords.length) {
          score += 0.2;
        }

        if (score > 0) {
          let snippet = '';
          if (matchedKeyword) {
            const idx = lowerText.indexOf(matchedKeyword);
            if (idx !== -1) {
              const start = Math.max(0, idx - 40);
              const end = Math.min(text.length, idx + matchedKeyword.length + 60);
              snippet = text.slice(start, end).replace(/\s+/g, ' ');
            } else {
              snippet = text.slice(0, 100).replace(/\s+/g, ' ');
            }
          } else {
            snippet = text.slice(0, 100).replace(/\s+/g, ' ');
          }

          matches.push({
            path: filePath,
            title: fileName,
            score,
            snippet: snippet ? `...${snippet}...` : ''
          });
        }
      } catch {
        // skip unreadable
      }
    }

    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, Math.min(limit, 50));
  }

  /**
   * Vector semantic search for similar notes.
   */
  async searchSimilar({ workspaceRoot, notePath, text, topK = 5 }) {
    if (this.agentInstance && this.agentInstance.embeddingService) {
      try {
        const targetText = text || (notePath ? fs.readFileSync(assertPathInWorkspace(notePath, workspaceRoot), 'utf8') : '');
        if (!targetText) return [];
        
        const results = await this.agentInstance.embeddingService.findSimilarDocuments(targetText, topK);
        return (results || []).map(item => ({
          path: item.path || item.documentPath,
          similarity: item.similarity || item.score || 0,
          snippet: item.snippet || ''
        }));
      } catch (err) {
        console.warn('[KnowledgeService] Embedding search error:', err.message);
      }
    }

    // Fallback search if vector service unavailable
    return this.searchNotes({ workspaceRoot, query: text || path.basename(notePath || ''), limit: topK });
  }

  /**
   * Hybrid search combining full-text search and graph/vector results.
   */
  async searchHybrid({ workspaceRoot, query, limit = 10 }) {
    const ftsResults = await this.searchNotes({ workspaceRoot, query, limit });
    const similarResults = await this.searchSimilar({ workspaceRoot, text: query, topK: limit });

    const combinedMap = new Map();

    for (const item of ftsResults) {
      combinedMap.set(item.path, {
        path: item.path,
        compositeScore: item.score * 0.6,
        snippet: item.snippet
      });
    }

    for (const item of similarResults) {
      const existing = combinedMap.get(item.path);
      if (existing) {
        existing.compositeScore += item.similarity * 0.4;
      } else {
        combinedMap.set(item.path, {
          path: item.path,
          compositeScore: item.similarity * 0.4,
          snippet: item.snippet
        });
      }
    }

    const sorted = Array.from(combinedMap.values()).sort((a, b) => b.compositeScore - a.compositeScore);
    return sorted.slice(0, Math.min(limit, 50));
  }

  /**
   * Get knowledge graph connections and related topics.
   */
  async getRelatedTopics({ workspaceRoot, topic, notePath, maxDepth = 2 }) {
    const target = topic || notePath;
    if (!target) return { sourcePath: '', nodes: [], edges: [] };

    // 1. Physical note path lookup if target is a file path ending with .md or existing on disk
    if (typeof notePath === 'string' && (notePath.endsWith('.md') || (workspaceRoot && fs.existsSync(path.join(workspaceRoot, notePath))))) {
      if (this.agentInstance && this.agentInstance.graphService) {
        try {
          const validPath = assertPathInWorkspace(notePath, workspaceRoot);
          const related = await this.agentInstance.graphService.getRelatedNotes(validPath, maxDepth);
          return {
            sourcePath: validPath,
            nodes: (related || []).map(r => ({ path: r.path || r, title: path.basename(r.path || r) })),
            edges: []
          };
        } catch (err) {
          console.warn('[KnowledgeService] Note path graph lookup error:', err.message);
        }
      }
    }

    // 2. Entity / Topic Graph Traversal via GraphDB or GraphRetriever
    if (this.agentInstance) {
      try {
        const gDb = this.agentInstance.graphDB || this.agentInstance.graphDb;
        let rows = [];
        if (gDb && typeof gDb.traversePathOrId === 'function') {
          rows = gDb.traversePathOrId(target, maxDepth);
        } else if (this.agentInstance.contextEngine?.graphRetriever) {
          rows = this.agentInstance.contextEngine.graphRetriever.traverse(target, maxDepth);
        }

        if (rows && rows.length > 0) {
          const triples = rows.map(r => `[${r.from_name || r.from_path}] --[${r.relation}]--> [${r.to_name || r.to_path}]`);
          return {
            sourceTopic: target,
            graph_triples: triples,
            content: triples.join('\n'),
            relationships: rows,
            nodes: rows.map(r => ({ name: r.to_name || r.to_path, type: r.to_type })),
            edges: rows.map(r => ({ from: r.from_name, to: r.to_name, label: r.relation }))
          };
        }
      } catch (err) {
        console.warn('[KnowledgeService] Topic graph traversal error:', err.message);
      }
    }

    return {
      sourcePath: target,
      content: `No knowledge graph connections found for: "${target}"`,
      nodes: [],
      edges: []
    };
  }

  /**
   * Find semantic topic clusters across workspace.
   */
  async findClusters({ workspaceRoot: _workspaceRoot, minSize = 2 }) {
    if (this.agentInstance && this.agentInstance.clusteringService) {
      try {
        const clusters = await this.agentInstance.clusteringService.getClusters(minSize);
        return clusters || [];
      } catch (err) {
        console.warn('[KnowledgeService] Clustering error:', err.message);
      }
    }
    return [];
  }

  /**
   * Get overall status of Knowledge indexing engines.
   */
  async getKnowledgeStatus({ workspaceRoot }) {
    const files = collectMarkdownFiles(workspaceRoot);
    const graphActive = Boolean(this.agentInstance && this.agentInstance.graphDb);
    const vectorActive = Boolean(this.agentInstance && this.agentInstance.embeddingService);

    return {
      totalNotes: files.length,
      graphActive,
      vectorActive,
      indexingComplete: true
    };
  }

  /**
   * Trigger reindex of Knowledge services.
   */
  async reindexKnowledge({ workspaceRoot, force: _force = false }) {
    if (this.agentInstance && this.agentInstance.graphBuilder) {
      try {
        await this.agentInstance.graphBuilder.rebuildGraph();
      } catch (err) {
        console.warn('[KnowledgeService] Reindex graph error:', err.message);
      }
    }
    return {
      workspaceRoot,
      reindexed: true,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  KnowledgeApplicationService
};
