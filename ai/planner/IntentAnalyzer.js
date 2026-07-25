/**
 * IntentAnalyzer - Layer 1 of Decoupled Hybrid Planning Architecture
 * Responsibility: Intent Detection & Goal Deconstruction
 *
 * Dynamically queries ApplicationToolRegistry metadata to extract informationNeeds and sub-intents
 * without hardcoding query string keywords or tool function signatures.
 */

const { createLogger } = require('../core/logger');
const log = createLogger('IntentAnalyzer');

class IntentAnalyzer {
  /**
   * Fetch registered tools metadata dynamically from ApplicationToolRegistry
   * @returns {Array}
   */
  getRegisteredTools() {
    try {
      const { applicationToolRegistry } = require('../../electron/tools/ApplicationToolRegistry.cjs');
      return Array.from(applicationToolRegistry.tools.values()).map(t => ({
        name: t.sdkName || t.name,
        description: t.description || '',
        capability: t.capability || 'generic',
        informationNeeds: Array.isArray(t.informationNeeds) ? t.informationNeeds : []
      }));
    } catch (err) {
      log.warn('Failed to inspect ApplicationToolRegistry in IntentAnalyzer:', err.message);
      return [];
    }
  }

  /**
   * Analyze user query dynamically by matching query terms against registered tool catalog metadata
   * @param {string} query
   * @param {object} [_context={}]
   * @returns {{ goal: string, primaryDomain: string, informationNeeds: Array<string>, subIntents: Array<string>, requiresExternalData: boolean }}
   */
  analyze(query = '', _context = {}) {
    const q = String(query || '').toLowerCase().trim();
    const stopWords = new Set([
      'show', 'me', 'the', 'a', 'an', 'and', 'or', 'for', 'with', 'from',
      'that', 'this', 'are', 'can', 'how', 'what', 'get', 'all', 'any',
      'find', 'of', 'in', 'across', 'my', 'workspace', 'workspaces',
      'note', 'notes', 'file', 'files', 'about', 'list', 'read', 'open'
    ]);
    const queryTerms = q.split(/\s+/).filter(t => t.length > 2 && !stopWords.has(t));
    const registeredTools = this.getRegisteredTools();
    const informationNeeds = new Set();
    const subIntents = [];
    let requiresExternalData = false;

    // Direct Intent Pattern Detection
    const isTaskQuery = /\b(task|tasks|todo|todos|action item|action items|checklist|checklists)\b/i.test(q);
    const isTimelineQuery = /\b(recent|timeline|history|changelog|changes)\b/i.test(q);
    const isGraphQuery = /\b(graph|relation|relations|relationship|topology|connection|connections|architecture)\b/i.test(q);
    const isWebQuery = /\b(web|http|https|online|search web|fetch web)\b/i.test(q);

    if (isTaskQuery) {
      informationNeeds.add('action_items');
      subIntents.push('tasks:extract');
    }
    if (isTimelineQuery) {
      informationNeeds.add('recent_changes');
      subIntents.push('timeline:reconstruct');
    }
    if (isGraphQuery) {
      informationNeeds.add('entity_relationships');
      subIntents.push('graph:traverse');
    }
    if (isWebQuery) {
      informationNeeds.add('external_web_content');
      subIntents.push('web:search');
      requiresExternalData = true;
    }

    if (informationNeeds.size === 0) {
      // General search over workspace metadata if specific term matches tool keywords
      for (const tool of registeredTools) {
        const metadataText = `${tool.name} ${tool.description} ${tool.capability} ${tool.informationNeeds.join(' ')}`.toLowerCase();
        for (const term of queryTerms) {
          const stem = term.length >= 4 ? term.slice(0, 4) : term;
          if (metadataText.includes(term) || metadataText.includes(stem)) {
            tool.informationNeeds.forEach(need => informationNeeds.add(need));
            subIntents.push(tool.capability);
            if (tool.capability === 'web:search' || tool.capability === 'web:fetch') {
              requiresExternalData = true;
            }
          }
        }
      }
      informationNeeds.add('workspace_content_search');
    }

    // Dynamically derive overall goal label
    let goal = 'synthesize_workspace_notes';
    if (informationNeeds.has('action_items')) {
      goal = 'summarize_tasks_and_actions';
    } else if (informationNeeds.has('entity_relationships')) {
      goal = 'explore_knowledge_graph';
    } else if (informationNeeds.has('recent_changes')) {
      goal = 'reconstruct_project_timeline';
    } else if (requiresExternalData) {
      goal = 'fetch_external_web_data';
    }

    const manifest = {
      query,
      goal,
      primaryDomain: 'knowledge_base',
      informationNeeds: Array.from(informationNeeds),
      subIntents: Array.from(new Set(subIntents)),
      requiresExternalData,
      timestamp: new Date().toISOString()
    };

    log.debug('Query intent analyzed dynamically', { goal: manifest.goal, infoNeedsCount: manifest.informationNeeds.length });
    return manifest;
  }
}

module.exports = IntentAnalyzer;
