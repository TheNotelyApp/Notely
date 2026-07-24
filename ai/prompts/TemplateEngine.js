/**
 * TemplateEngine - Safely renders dynamic runtime prompt templates
 */

class TemplateEngine {
  /**
   * Replace {{variableName}} placeholders with corresponding values
   * @param {string} templateStr
   * @param {object} variables
   * @returns {string}
   */
  static render(templateStr, variables = {}) {
    if (!templateStr) return '';
    return templateStr.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
      const val = variables[key];
      if (val === undefined || val === null) {
        return 'none';
      }
      if (typeof val === 'object') {
        return JSON.stringify(val, null, 2);
      }
      return String(val);
    });
  }

  /**
   * Render workspace context block
   * @param {string} rawTemplate
   * @param {object} ctx
   * @returns {string}
   */
  static renderWorkspaceContext(rawTemplate, ctx = {}) {
    if (typeof ctx === 'string') {
      return `CURATED WORKSPACE CONTEXT:\n${ctx}`;
    }
    if (ctx && ctx.raw) {
      return `CURATED WORKSPACE CONTEXT:\n${ctx.raw}`;
    }
    const variables = {
      workspaceRoot: ctx.workspaceRoot || 'none',
      activeNotePath: ctx.activeNotePath || ctx.currentFile || 'none',
      activeNoteContent: ctx.activeNoteContent ? ctx.activeNoteContent.trim() : 'none',
      documentCount: ctx.documentCount !== undefined ? ctx.documentCount : 0
    };
    return this.render(rawTemplate, variables);
  }

  /**
   * Render retrieved evidence block
   * @param {string} rawTemplate
   * @param {string|Array} evidence
   * @returns {string}
   */
  static renderRetrievedContext(rawTemplate, evidence) {
    let evidenceText = 'none';
    if (typeof evidence === 'string' && evidence.trim()) {
      evidenceText = evidence.trim();
    } else if (Array.isArray(evidence) && evidence.length > 0) {
      evidenceText = evidence
        .map(item => (typeof item === 'string' ? item : item.content || JSON.stringify(item)))
        .join('\n\n');
    }
    return this.render(rawTemplate, { retrievedEvidence: evidenceText });
  }

  /**
   * Render conversation memory block
   * @param {string} rawTemplate
   * @param {Array|string} memory
   * @returns {string}
   */
  static renderConversationMemory(rawTemplate, memory) {
    let memoryText = 'none';
    if (typeof memory === 'string' && memory.trim()) {
      memoryText = memory.trim();
    } else if (Array.isArray(memory) && memory.length > 0) {
      memoryText = memory
        .map(m => `[${m.role.toUpperCase()}]: ${m.content}`)
        .join('\n');
    }
    return this.render(rawTemplate, { conversationMemory: memoryText });
  }

  /**
   * Render UI context block
   * @param {string} rawTemplate
   * @param {object} uiState
   * @returns {string}
   */
  static renderUIContext(rawTemplate, uiState = {}) {
    const variables = {
      activeTab: uiState.activeTab || 'editor',
      selectedText: uiState.selectedText || 'none',
      uiViewMode: uiState.uiViewMode || 'markdown'
    };
    return this.render(rawTemplate, variables);
  }
}

module.exports = TemplateEngine;
