/**
 * Graph utility constants, color palettes, and data normalization functions
 */

export const TYPE_COLORS = {
  Note: { background: 'rgba(99, 102, 241, 0.18)', border: '#6366f1', text: '#6366f1' },
  Person: { background: 'rgba(236, 72, 153, 0.18)', border: '#ec4899', text: '#ec4899' },
  Project: { background: 'rgba(59, 130, 246, 0.18)', border: '#3b82f6', text: '#3b82f6' },
  Technology: { background: 'rgba(6, 182, 212, 0.18)', border: '#06b6d4', text: '#06b6d4' },
  Company: { background: 'rgba(245, 158, 11, 0.18)', border: '#f59e0b', text: '#f59e0b' },
  Organization: { background: 'rgba(249, 115, 22, 0.18)', border: '#f97316', text: '#f97316' },
  Concept: { background: 'rgba(139, 92, 246, 0.18)', border: '#8b5cf6', text: '#8b5cf6' },
  Task: { background: 'rgba(239, 68, 68, 0.18)', border: '#ef4444', text: '#ef4444' },
  Image: { background: 'rgba(16, 185, 129, 0.18)', border: '#10b981', text: '#10b981' },
  Document: { background: 'rgba(234, 179, 8, 0.18)', border: '#eab308', text: '#eab308' },
  ExternalURL: { background: 'rgba(14, 165, 233, 0.18)', border: '#0ea5e9', text: '#0ea5e9' },
  CodeBlock: { background: 'rgba(168, 85, 247, 0.18)', border: '#a855f7', text: '#a855f7' },
  Diagram: { background: 'rgba(20, 184, 166, 0.18)', border: '#14b8a6', text: '#14b8a6' },
  Section: { background: 'rgba(168, 85, 247, 0.18)', border: '#a855f7', text: '#a855f7' },
  Tag: { background: 'rgba(244, 63, 94, 0.18)', border: '#f43f5e', text: '#f43f5e' },
  KeyTerm: { background: 'rgba(16, 185, 129, 0.18)', border: '#10b981', text: '#10b981' },
  Formula: { background: 'rgba(217, 70, 239, 0.18)', border: '#d946ef', text: '#d946ef' },
  Callout: { background: 'rgba(245, 158, 11, 0.18)', border: '#f59e0b', text: '#f59e0b' },

  // Code & AST Graph Entities
  Repo: { background: 'rgba(139, 92, 246, 0.18)', border: '#8b5cf6', text: '#8b5cf6' },
  CodeModule: { background: 'rgba(99, 102, 241, 0.18)', border: '#6366f1', text: '#6366f1' },
  CodeClass: { background: 'rgba(168, 85, 247, 0.18)', border: '#a855f7', text: '#a855f7' },
  CodeInterface: { background: 'rgba(192, 132, 252, 0.18)', border: '#c084fc', text: '#c084fc' },
  CodeFunction: { background: 'rgba(56, 189, 248, 0.18)', border: '#38bdf8', text: '#38bdf8' },
  APIEndpoint: { background: 'rgba(245, 158, 11, 0.18)', border: '#f59e0b', text: '#f59e0b' },
  DBModel: { background: 'rgba(16, 185, 129, 0.18)', border: '#10b981', text: '#10b981' }
};

export const DEFAULT_COLOR = {
  background: 'rgba(47, 93, 98, 0.18)',
  border: '#2f5d62',
  text: '#2f5d62'
};

export const RELATIONSHIP_COLORS = {
  // Semantic / LLM Relationships
  DEPENDS_ON: '#f59e0b',       // Amber
  USES: '#06b6d4',             // Cyan
  REFERENCES: '#6366f1',       // Indigo
  CONTAINS: '#10b981',         // Emerald
  HAS: '#10b981',              // Emerald
  MENTIONS: '#8b5cf6',         // Purple
  CREATED_BY: '#f43f5e',       // Rose
  OWNED_BY: '#f43f5e',         // Rose
  DOCUMENTS: '#a855f7',        // Purple (Doc -> Code)
  IMPORTS: '#6366f1',          // Indigo (Code -> Code)
  CALLS: '#f59e0b',            // Amber (Func -> API)
  EXPORTS: '#38bdf8',          // Sky (Module -> Symbol)

  // Structural Note Graph Relationships
  LINKS_TO: '#6366f1',         // Indigo
  TAGGED: '#ec4899',           // Pink
  CONTAINS_MEDIA: '#10b981',   // Emerald
  REFERENCES_URL: '#3b82f6',   // Blue
  ATTACHES_FILE: '#eab308',    // Yellow
  CONTAINS_CODE: '#06b6d4',    // Cyan
  CONTAINS_SECTION: '#14b8a6', // Teal
  EMPHASIZES: '#f97316',       // Orange
  REFERENCES_CODE: '#0284c7',  // Sky Blue
  HAS_CALLOUT: '#a855f7',      // Violet
  CONTAINS_FORMULA: '#d946ef', // Fuchsia
  HAS_OPEN_TASK: '#ef4444',    // Red
  HAS_COMPLETED_TASK: '#22c55e',// Green
  MENTIONS_NOTE: '#8b5cf6',    // Purple
  RELATED_TO: '#8b5cf6',       // Purple
  DEFAULT: '#06b6d4'           // Cyan fallback
};

export const CANONICAL_TYPE_MAP = {
  note: 'Note',
  person: 'Person',
  project: 'Project',
  technology: 'Technology',
  company: 'Company',
  organization: 'Organization',
  concept: 'Concept',
  task: 'Task',
  decision: 'Decision',
  idea: 'Idea',
  tag: 'Tag',
  image: 'Image',
  document: 'Document',
  folder: 'Folder',
  workspace: 'Workspace',
  section: 'Section',
  event: 'Event',
  location: 'Location',
  externalurl: 'ExternalURL',
  external_url: 'ExternalURL',
  codeblock: 'CodeBlock',
  diagram: 'Diagram',
  keyterm: 'KeyTerm',
  formula: 'Formula',
  callout: 'Callout',
  repo: 'Repo',
  codemodule: 'CodeModule',
  codeclass: 'CodeClass',
  codeinterface: 'CodeInterface',
  codefunction: 'CodeFunction',
  apiendpoint: 'APIEndpoint',
  dbmodel: 'DBModel'
};

export const normalizeType = (rawType) => {
  if (!rawType) return 'Concept';
  const clean = String(rawType).trim();
  const key = clean.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (CANONICAL_TYPE_MAP[key]) return CANONICAL_TYPE_MAP[key];
  return clean.charAt(0).toUpperCase() + clean.slice(1);
};

export const getTypeColor = (type) => {
  if (!type || typeof type !== 'string') return DEFAULT_COLOR;
  if (TYPE_COLORS[type]) return TYPE_COLORS[type];
  let hash = 0;
  for (let i = 0; i < type.length; i++) {
    hash = (type.charCodeAt(i) + ((hash << 5) - hash)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return {
    background: `hsl(${hue}, 75%, 95%)`,
    border: `hsl(${hue}, 70%, 45%)`,
    text: `hsl(${hue}, 70%, 45%)`
  };
};
