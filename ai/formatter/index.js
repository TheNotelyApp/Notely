/**
 * Formatter Module Facade
 * Single entry point for response formatting, markdown clean-up, evidence context formatting, and citation links.
 */

const { formatResponse } = require('../utils/aiUtils');
const { GroundingEngine } = require('../grounding');

const { TaskSummaryFormatter, formatFileUriLink } = require('./TaskSummaryFormatter');

module.exports = {
  formatResponse,
  TaskSummaryFormatter,
  formatFileUriLink,
  formatLineNumberLinks: (text, workspaceFiles) => GroundingEngine.formatLineNumberLinks(text, workspaceFiles),
  verifyCitations: (text) => GroundingEngine.verifyCitations(text),
  
  formatToolOutput: (val) => {
    if (typeof val === 'string') return val.trim();
    if (Array.isArray(val)) {
      return val.map(item => {
        if (typeof item === 'string') return `- ${item}`;
        if (item.title || item.note || item.file || item.path) {
          const label = item.title || item.note || item.file || item.path;
          const detail = item.snippet || item.text || item.content || '';
          return `- **${label}**: ${detail}`;
        }
        return `- ${JSON.stringify(item)}`;
      }).join('\n');
    }
    if (typeof val === 'object' && val !== null) {
      const label = val.title || val.note || val.file || val.path || 'Details';
      const detail = val.snippet || val.text || val.content || JSON.stringify(val);
      return `- **${label}**: ${detail}`;
    }
    return String(val || '');
  }
};
