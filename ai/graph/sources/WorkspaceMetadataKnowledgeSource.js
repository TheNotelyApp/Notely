/**
 * WorkspaceMetadataKnowledgeSource - Extracts entities and relationships from workspace configuration (.notes-app/metadata.json)
 */

const KnowledgeSource = require('./KnowledgeSource');

class WorkspaceMetadataKnowledgeSource extends KnowledgeSource {
  constructor(workspaceInfo = {}) {
    super();
    this.workspaceInfo = workspaceInfo || {};
  }

  sourceType() {
    return 'workspace_metadata';
  }

  baseConfidence() {
    return 0.95;
  }

  discover() {
    return ['workspace_metadata'];
  }

  async extractEntities() {
    const info = this.workspaceInfo;
    const name = info.name || 'Workspace';
    const entities = [
      {
        id: 'ent-workspace-root',
        name,
        type: 'Workspace',
        properties: {
          description: info.description || '',
          projectType: info.projectType || 'General',
          primaryGoal: info.primaryGoal || ''
        }
      }
    ];

    if (Array.isArray(info.domainTags)) {
      for (const tag of info.domainTags) {
        if (tag && typeof tag === 'string') {
          entities.push({
            name: tag.trim(),
            type: 'Tag',
            properties: { isDomainTag: true }
          });
        }
      }
    }

    return entities;
  }

  async extractRelationships() {
    const info = this.workspaceInfo;
    const name = info.name || 'Workspace';
    const relationships = [];

    if (Array.isArray(info.domainTags)) {
      for (const tag of info.domainTags) {
        if (tag && typeof tag === 'string') {
          relationships.push({
            source_name: name,
            target_name: tag.trim(),
            source_type: 'Workspace',
            target_type: 'Tag',
            type: 'categorized_by',
            weight: 1.0,
            confidence: 0.95
          });
        }
      }
    }

    return relationships;
  }

  extractMetadata() {
    return this.workspaceInfo;
  }
}

module.exports = WorkspaceMetadataKnowledgeSource;
