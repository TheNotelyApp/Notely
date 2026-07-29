/**
 * KnowledgeSourceRegistry - Orchestrates discovery and extraction across all registered KnowledgeSource instances
 */

class KnowledgeSourceRegistry {
  constructor() {
    this.sources = [];
  }

  register(source) {
    if (source && typeof source.sourceType === 'function') {
      this.sources.push(source);
    }
    return this;
  }

  discoverAll(workspaceRoot) {
    const items = [];
    for (const source of this.sources) {
      try {
        const discovered = source.discover(workspaceRoot) || [];
        for (const itemPath of discovered) {
          items.push({ source, path: itemPath });
        }
      } catch (err) {
        console.error(`Failed discovery for source ${source.sourceType()}:`, err.message);
      }
    }
    return items;
  }

  async extract(source, itemPath, content = '') {
    try {
      const [entities, relationships, evidence] = await Promise.all([
        source.extractEntities(itemPath, content).catch(() => []),
        source.extractRelationships(itemPath, content).catch(() => []),
        source.extractEvidence(itemPath, content).catch(() => [])
      ]);
      const metadata = source.extractMetadata(itemPath, content) || {};

      return { entities, relationships, evidence, metadata };
    } catch (err) {
      console.error(`Failed extraction for source ${source.sourceType()} on ${itemPath}:`, err.message);
      return { entities: [], relationships: [], evidence: [], metadata: {} };
    }
  }
}

module.exports = KnowledgeSourceRegistry;
