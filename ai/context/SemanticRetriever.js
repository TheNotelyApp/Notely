const { createLogger } = require('../core/logger');

const log = createLogger('SemanticRetriever');

/**
 * SemanticRetriever — cosine similarity vector search over ai-embeddings.db
 * Exposed as an LLM tool via ContextEngine.
 */
class SemanticRetriever {
  /**
   * @param {import('../embeddings/EmbeddingDB').EmbeddingDB} embeddingDB
   * @param {import('../embeddings/EmbeddingService').EmbeddingService} embeddingService
   */
  constructor(embeddingDB, embeddingService) {
    this.embeddingDB = embeddingDB;
    this.embeddingService = embeddingService;
  }

  /**
   * Search for top-K note chunks semantically similar to the query.
   * @param {string} query
   * @param {number} topK
   * @returns {Promise<Array<{note_path: string, content: string, score: number}>>}
   */
  async search(query, topK = 5) {
    if (!this.embeddingService.isAvailable()) {
      log.warn('Embedding service not available — semantic search skipped.');
      return [];
    }

    let queryVec;
    try {
      queryVec = await this.embeddingService.generateVector(query);
    } catch (err) {
      log.error('Failed to generate query vector', err);
      return [];
    }

    // Load all indexed chunks that have an embedding
    const rows = this.embeddingDB.db.prepare(
      'SELECT id, note_path, content, embedding FROM chunks WHERE embedding IS NOT NULL'
    ).all();

    if (!rows.length) return [];

    const scored = rows.map(row => {
      const chunkVec = this._deserialize(row.embedding);
      return {
        note_path: row.note_path,
        content: row.content,
        score: this._cosine(queryVec, chunkVec)
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  /**
   * Vercel AI SDK tool definition for this retriever.
   */
  toTool() {
    return {
      description: 'Search workspace notes by semantic meaning. Use when the user asks about topics, facts, or ideas that may be in their notes.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search phrase or question to find relevant note content for.' },
          topK: { type: 'number', description: 'Number of results to return (default 5).', default: 5 }
        },
        required: ['query']
      },
      execute: async ({ query, topK = 5 }) => {
        const results = await this.search(query, topK);
        if (!results.length) return 'No relevant note content found.';
        return results.map((r, i) =>
          `[${i + 1}] ${r.note_path} (score: ${r.score.toFixed(3)})\n${r.content}`
        ).join('\n\n');
      }
    };
  }

  // --- Helpers -------------------------------------------------

  _cosine(a, b) {
    if (a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  _deserialize(blob) {
    if (!blob) return [];
    const buf = blob instanceof Buffer ? blob : Buffer.from(blob);
    const arr = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
    return Array.from(arr);
  }
}

module.exports = { SemanticRetriever };
