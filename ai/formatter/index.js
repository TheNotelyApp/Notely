/**
 * Formatter Module Facade
 * Single entry point for response formatting, markdown clean-up, evidence context formatting, and citation links.
 */

const { formatResponse } = require('../utils');
const { GroundingEngine } = require('../grounding');

const { TaskSummaryFormatter, formatFileUriLink } = require('./TaskSummaryFormatter');

async function checkTaskSummaryOptimization(agent, userQuery, orchRes, flowId, onChunk = null) {
  const intent = orchRes?.intent || orchRes?.plannerDecision?.intent;
  const isTaskIntent = ['workspace_task_summary', 'tasks:extract', 'checklist_summary'].includes(intent);
  const isTargetedQuestion = /\b(do we have|is there|are there|which|who|where|when|why|how|about|on|for|related|first|next|priority|specific)\b/i.test(String(userQuery).toLowerCase());
  const isTaskSummaryIntent = isTaskIntent && !isTargetedQuestion;

  if (!isTaskSummaryIntent) return null;

  let tasksData = orchRes?.rawTaskResults;
  if ((!tasksData || !Array.isArray(tasksData) || tasksData.length === 0) && agent) {
    try {
      const { QueryTools } = require('../tools');
      const tasksJson = await QueryTools.runTool(agent, 'get_tasks', { status: 'open' });
      if (typeof tasksJson === 'string' && tasksJson.startsWith('[')) {
        tasksData = JSON.parse(tasksJson);
      }
    } catch { /* ignore */ }
  }

  if (Array.isArray(tasksData) && tasksData.length > 0) {
    const formattedResponse = TaskSummaryFormatter(tasksData);
    if (onChunk) {
      onChunk({ type: 'replace', content: formattedResponse });
    }
    return {
      type: 'query',
      result: formattedResponse,
      tokensUsed: 0,
      tokensDetail: { inputTokens: 0, outputTokens: 0, toolTokens: 0, totalTokens: 0 },
      trace: (orchRes?.trace || []).map(t => ({
        ...t,
        toolType: 'planned-execution',
        callerType: 'executor',
        selectedBy: 'planner',
        intent
      })),
      strategy: 'TaskSummaryFormatter',
      llmInvoked: false
    };
  }

  return null;
}

module.exports = {
  formatResponse,
  TaskSummaryFormatter,
  formatFileUriLink,
  checkTaskSummaryOptimization,
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
