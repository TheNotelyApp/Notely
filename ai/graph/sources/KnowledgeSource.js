/* eslint-disable no-unused-vars */
/**
 * KnowledgeSource - Abstract base class for workspace knowledge sources
 */

class KnowledgeSource {
  sourceType() {
    throw new Error('sourceType() must be implemented by subclass');
  }

  discover(workspaceRoot) {
    return [];
  }

  supports(filePath) {
    return false;
  }

  async extractEntities(filePath, content) {
    return [];
  }

  async extractRelationships(filePath, content) {
    return [];
  }

  async extractEvidence(filePath, content) {
    return [];
  }

  extractMetadata(filePath, content) {
    return {};
  }

  baseConfidence() {
    return 0.8;
  }
}

module.exports = KnowledgeSource;
