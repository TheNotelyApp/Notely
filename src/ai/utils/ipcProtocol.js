/**
 * ipcProtocol.js - IPC channel events and request/response protocol wrappers for Notely AI
 */

const IPC_EVENTS = {
  AI_INIT: 'ai:init',
  AI_QUERY: 'ai:query',
  AI_QUERY_STREAM: 'ai:query:stream',
  AI_QUERY_ABORT: 'ai:query:abort',
  AI_STATUS: 'ai:status',
  AI_GENERATE_EMBEDDINGS: 'ai:embeddings:generate',
  AI_BUILD_GRAPH: 'ai:graph:build',
  AI_GRAPH_GET: 'ai:graph:get',
  AI_GRAPH_STATUS: 'ai:graph:status',
  AI_GRAPH_PAUSE: 'ai:graph:pause',
  AI_GRAPH_RESUME: 'ai:graph:resume',
  AI_EMBEDDINGS_REBUILD: 'ai:embeddings:rebuild',
  AI_EMBEDDINGS_CLEAR: 'ai:embeddings:clear-data',
  AI_EMBEDDINGS_STATUS: 'ai:embeddings:status',
  AI_GRAPH_CLEAR: 'ai:graph:clear-data',
  AI_WORKER_PAUSE: 'ai:worker:pause',
  AI_WORKER_RESUME: 'ai:worker:resume',
  AI_MODEL_DOWNLOAD: 'ai:model:download',
  AI_MODEL_DELETE: 'ai:model:delete',
  AI_MODEL_STATUS: 'ai:model:status',
  AI_GRAPH_MODEL_DOWNLOAD: 'ai:graph-model:download',
  AI_GRAPH_MODEL_DELETE: 'ai:graph-model:delete',
  AI_GRAPH_MODEL_STATUS: 'ai:graph-model:status',
  AI_DETECT_PATTERNS: 'ai:patterns:detect',
  AI_LOGS_GET: 'ai:logs:get',
  AI_LOGS_CLEAR: 'ai:logs:clear',
  AI_NOTE_STATS: 'ai:note:stats',
  AI_SET_API_KEY: 'ai:config:set-api-key',
  AI_GET_API_KEY: 'ai:config:get-api-key',
  AI_GET_PREFERENCES: 'ai:config:get-preferences',
  AI_SET_PREFERENCES: 'ai:config:set-preferences',
  AI_GET_PROVIDER_MODEL: 'ai:config:get-provider-model',
  AI_SET_PROVIDER_MODEL: 'ai:config:set-provider-model',
  AI_TEST_CONNECTION: 'ai:config:test-connection',
  AI_CLEAR_DATA: 'ai:config:clear-data',
  AI_GET_PROVIDER_LIST: 'ai:config:get-provider-list',
  AI_ENABLE: 'ai:enable',
  AI_DISABLE: 'ai:disable',
  AI_HEALTH_GET: 'ai:health:get',
  AI_CONVERSATION_LIST: 'ai:conversation:list',
  AI_CONVERSATION_GET: 'ai:conversation:get',
  AI_CONVERSATION_CREATE: 'ai:conversation:create',
  AI_CONVERSATION_DELETE: 'ai:conversation:delete',
  AI_CONVERSATION_CLEAR: 'ai:conversation:clear',
  AI_CONVERSATION_SET_PERSONA: 'ai:conversation:set-persona',
  AI_CONVERSATION_GET_MESSAGES: 'ai:conversation:get-messages',
  AI_CONVERSATION_ADD_MESSAGE: 'ai:conversation:add-message',
  AI_PERSONA_LIST: 'ai:persona:list',
  AI_PERSONA_GET: 'ai:persona:get',
  AI_PERSONA_SAVE: 'ai:persona:save',
  AI_PERSONA_DELETE: 'ai:persona:delete',
  AI_PERSONA_IMPORT: 'ai:persona:import',
  AI_PERSONA_EXPORT: 'ai:persona:export',
  AI_KNOWLEDGE_LIST_PENDING: 'ai:knowledge:list-pending',
  AI_KNOWLEDGE_APPROVE: 'ai:knowledge:approve',
  AI_KNOWLEDGE_REJECT: 'ai:knowledge:reject',
  AI_SHUTDOWN: 'ai:shutdown',
  TOOL_EXECUTE: 'tool:execute',
  TOOL_LIST: 'tool:list'
};

class AIQueryRequest {
  constructor(query, context = {}) {
    this.query = query;
    this.context = context;
    this.timestamp = new Date().toISOString();
  }
}

class AIQueryResponse {
  constructor(success, data = {}, error = null) {
    this.success = success;
    this.data = data;
    this.error = error;
    this.timestamp = new Date().toISOString();
  }
}

module.exports = {
  IPC_EVENTS,
  AIQueryRequest,
  AIQueryResponse
};
