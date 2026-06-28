/**
 * SemanticGraphCache - Manages persistent storage of semantic clustering results
 * in `.notes-app/semantic-graph.json` with TTL and invalidation
 */

const fs = require('fs');
const path = require('path');

class SemanticGraphCache {
  constructor(appDataDir) {
    this.appDataDir = appDataDir;
    this.cacheFile = path.join(appDataDir, 'semantic-graph.json');
    this.maxAgeMs = 7 * 24 * 60 * 60 * 1000; // 7 days
  }

  /**
   * Load cache if valid
   */
  load() {
    try {
      if (!fs.existsSync(this.cacheFile)) return null;
      const data = JSON.parse(fs.readFileSync(this.cacheFile, 'utf8'));
      const age = Date.now() - (data.timestamp || 0);
      if (age > this.maxAgeMs) {
        console.log('[SemanticGraphCache] Cache expired, invalidating');
        this.invalidate();
        return null;
      }
      console.log(`[SemanticGraphCache] Loaded cache (${(age / 1000 / 60).toFixed(1)} min old)`);
      return data;
    } catch (err) {
      console.warn('[SemanticGraphCache] Failed to load cache:', err.message);
      return null;
    }
  }

  /**
   * Save cache with timestamp
   */
  save(data) {
    try {
      fs.mkdirSync(this.appDataDir, { recursive: true });
      fs.writeFileSync(this.cacheFile, JSON.stringify({
        ...data,
        timestamp: Date.now(),
      }, null, 2), 'utf8');
      console.log('[SemanticGraphCache] Cache saved');
    } catch (err) {
      console.error('[SemanticGraphCache] Failed to save cache:', err.message);
    }
  }

  /**
   * Invalidate cache
   */
  invalidate() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        fs.unlinkSync(this.cacheFile);
        console.log('[SemanticGraphCache] Cache invalidated');
      }
    } catch (err) {
      console.error('[SemanticGraphCache] Failed to invalidate cache:', err.message);
    }
  }

  /**
   * Check if a specific workspace's cache exists and is fresh
   */
  isFresh(workspaceRoot) {
    const data = this.load();
    return data && data.workspaceRoot === workspaceRoot;
  }
}

module.exports = SemanticGraphCache;
