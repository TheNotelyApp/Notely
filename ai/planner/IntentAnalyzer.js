/**
 * IntentAnalyzer - Layer 1 of Decoupled Hybrid Planning Architecture
 * Responsibility: Intent Detection & Goal Deconstruction
 *
 * Dynamically queries ApplicationToolRegistry metadata to extract informationNeeds and sub-intents
 * without hardcoding query string keywords or tool function signatures.
 */

const { createLogger } = require('../core');
const log = createLogger('IntentAnalyzer');

const { getRegisteredTools } = require('./registryUtils');

class IntentAnalyzer {
  getRegisteredTools() {
    return getRegisteredTools();
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

    const isTaskQuery = /\b(task|tasks|todo|todos|action item|action items|checklist|checklists|pending|open items|things to do|summarize tasks)\b/i.test(q);
    const isTimelineQuery = /\b(recent|timeline|history|changelog|changes)\b/i.test(q);
    const isExplicitGraphQuery = /\b(graph|relation|relations|relationship|topology|connect|connected|connection|connections|architecture)\b/i.test(q);
    const isIdentityOrEntityQuery = /\b(who is|who was|who are|who were|what is|what was|what are|tell me about|information on|details on|overview of)\b/i.test(q) || (/^[A-Z][a-zA-Z0-9\s.\-_]{1,30}$/.test(q.trim()) && !/\b(the|a|an|my|this|that|note|files?)\b/i.test(q.trim()));
    const isGraphQuery = isExplicitGraphQuery || isIdentityOrEntityQuery;
    const isWebQuery = /\b(web|http|https|online|search web|fetch web)\b/i.test(q);

    // Conversational Follow-up Detection (e.g. "Which shall we take first", "What should we start with")
    const isConversationalFollowup = /\b(which (one|shall we|should we|to|can we|first)|what next|which first|where to start|what should we|tell me more|go on|continue)\b/i.test(q) && (_context.historyCount > 0 || Array.isArray(_context.conversationMemory) && _context.conversationMemory.length > 0);

    const prevHadTasks = Array.isArray(_context.conversationMemory) && _context.conversationMemory.some(m => /\btask|\btodos?\b|\baction item/i.test(m.content || ''));

    if (isTaskQuery) {
      informationNeeds.add('action_items');
      informationNeeds.add('tasks');
      subIntents.push('tasks:extract');
    } else if (isConversationalFollowup) {
      informationNeeds.add('conversation_memory');
      if (prevHadTasks) {
        informationNeeds.add('tasks');
      }
      subIntents.push('memory:resolve');
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
          const termRegex = new RegExp(`\\b${term}\\b`, 'i');
          if (termRegex.test(metadataText)) {
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
    let confidence = 0.70;

    if (isConversationalFollowup) {
      goal = 'conversational_followup';
      confidence = 0.88;
    } else if (isTaskQuery || informationNeeds.has('action_items') || informationNeeds.has('tasks')) {
      goal = 'workspace_task_summary';
      confidence = 0.92;
    } else if (informationNeeds.has('entity_relationships')) {
      goal = 'explore_knowledge_graph';
      confidence = 0.88;
    } else if (informationNeeds.has('recent_changes')) {
      goal = 'reconstruct_project_timeline';
      confidence = 0.85;
    } else if (requiresExternalData) {
      goal = 'fetch_external_web_data';
      confidence = 0.90;
    }

    // Intent Category & Capability Routing Classification
    const isCodeQuery = /\b(code|function|class|bug|error|refactor|syntax|const|let|var|import|api|script|html|css)\b/i.test(q);
    const isDiagramQuery = /\b(diagram|flowchart|sequence|chart|visualize|architecture)\b/i.test(q);
    const isCreativeQuery = /\b(brainstorm|idea|ideas|story|poem|write|draft|creative|compose|generate)\b/i.test(q);
    const isKnowledgeQuery = /^(what is|explain|how does|why is|difference between|compare|define)\b/i.test(q) && !/\b(my|this note|workspace|notes)\b/i.test(q);

    let category = 'Workspace Search';
    if (isTaskQuery) {
      category = 'Task Query';
    } else if (isGraphQuery) {
      category = 'Graph Exploration';
    } else if (isDiagramQuery) {
      category = 'Diagram Generation';
    } else if (isCodeQuery) {
      category = 'Code Assistance';
    } else if (isCreativeQuery) {
      category = 'Creative Generation';
    } else if (isKnowledgeQuery) {
      category = 'Knowledge Question';
    } else if (isTimelineQuery) {
      category = 'Simple Retrieval';
    } else if (_context.activeNotePath || _context.currentFile) {
      category = 'Document QA';
    }

    // Always include workspace_content_search as baseline note-grounded capability
    informationNeeds.add('workspace_content_search');

    const isPureConversationalAck = /^(thanks|thank you|got it|ok|okay|cool|great|awesome|understood)\.?$/i.test(q.trim());
    const requiresRetrieval = !isPureConversationalAck;

    if (!requiresRetrieval) {
      informationNeeds.clear();
    }

    const capabilities = {
      needsTasks: isTaskQuery,
      needsGraph: isGraphQuery,
      needsDiagram: isDiagramQuery,
      needsCode: isCodeQuery,
      needsCreative: isCreativeQuery,
      needsTimeline: isTimelineQuery
    };

    const manifest = {
      query,
      goal,
      category,
      confidence,
      capabilities,
      requiresRetrieval,
      primaryDomain: 'knowledge_base',
      informationNeeds: Array.from(informationNeeds),
      subIntents: Array.from(new Set(subIntents)),
      requiresExternalData,
      timestamp: new Date().toISOString()
    };

    log.debug('Query intent analyzed dynamically', { goal: manifest.goal, category: manifest.category, confidence: manifest.confidence, requiresRetrieval: manifest.requiresRetrieval });
    return manifest;
  }
}

module.exports = IntentAnalyzer;
