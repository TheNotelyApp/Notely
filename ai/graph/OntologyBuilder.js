/**
 * OntologyBuilder - Defines domain schemas (software, research, finance, general) and normalizes entity/relationship types
 */

const ONTOLOGY_SCHEMAS = {
  software: {
    entityTypes: ['Module', 'API', 'Service', 'Database', 'Library', 'Framework', 'Repository', 'Component', 'Endpoint', 'Interface', 'Feature'],
    relationTypes: ['depends_on', 'uses', 'implements', 'extends', 'exposes', 'contains', 'calls', 'creates', 'is_a'],
    glinerLabels: ['software module', 'API endpoint', 'database', 'library', 'framework', 'service', 'component', 'interface']
  },
  research: {
    entityTypes: ['Concept', 'Algorithm', 'Dataset', 'Paper', 'Hypothesis', 'Finding', 'Method', 'Metric', 'Model', 'Theory'],
    relationTypes: ['proposes', 'validates', 'references', 'builds_on', 'evaluates', 'is_a', 'uses'],
    glinerLabels: ['concept', 'algorithm', 'dataset', 'research paper', 'hypothesis', 'method', 'model']
  },
  finance: {
    entityTypes: ['Account', 'Transaction', 'Investment', 'Asset', 'Liability', 'Portfolio', 'Metric', 'Organization', 'Report'],
    relationTypes: ['holds', 'transfers_to', 'evaluates', 'includes', 'issued_by', 'manages'],
    glinerLabels: ['account', 'investment', 'asset', 'portfolio', 'financial metric', 'report']
  },
  general: {
    entityTypes: ['Person', 'Organization', 'Location', 'Event', 'Concept', 'Project', 'Task', 'Decision', 'Idea', 'Tag', 'Image', 'Document', 'Folder', 'Workspace'],
    relationTypes: ['mentions', 'links_to', 'tagged', 'related_to', 'contains', 'is_a', 'created_by', 'depends_on', 'in_folder', 'categorized_by'],
    glinerLabels: ['person', 'organization', 'location', 'event', 'project', 'task', 'concept']
  }
};

class OntologyBuilder {
  constructor(workspaceType = 'general') {
    const key = String(workspaceType || 'general').toLowerCase();
    this.workspaceType = ONTOLOGY_SCHEMAS[key] ? key : 'general';
    this.schema = ONTOLOGY_SCHEMAS[this.workspaceType];
  }

  getEntityTypes() {
    return this.schema.entityTypes;
  }

  getRelationTypes() {
    return this.schema.relationTypes;
  }

  getGLiNERLabels() {
    return this.schema.glinerLabels;
  }

  normalizeEntityType(rawType) {
    const clean = String(rawType || '').trim();
    if (!clean) return 'Concept';
    const match = this.schema.entityTypes.find(t => t.toLowerCase() === clean.toLowerCase());
    if (match) return match;
    return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
  }
}

module.exports = OntologyBuilder;
