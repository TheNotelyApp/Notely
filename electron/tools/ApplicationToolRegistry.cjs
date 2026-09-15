/**
 * ApplicationToolRegistry.cjs
 * Central Application Tool Registry for Notely.
 * Provides typed tool definitions, Zod validation, structured output envelopes,
 * telemetry/logging, Vercel AI SDK export, and enterprise MCP schema export.
 */

const { NoteApplicationService } = require('../services/NoteApplicationService.cjs');
const { KnowledgeApplicationService } = require('../services/KnowledgeApplicationService.cjs');
const { WorkspaceApplicationService } = require('../services/WorkspaceApplicationService.cjs');
const { WebToolService } = require('../services/WebToolService.cjs');
const { EnterpriseToolSuite } = require('./EnterpriseToolSuite.cjs');

class ApplicationToolRegistry {
  constructor() {
    this.noteService = new NoteApplicationService();
    this.knowledgeService = new KnowledgeApplicationService();
    this.workspaceService = new WorkspaceApplicationService();
    this.webService = new WebToolService();
    this.enterpriseSuite = new EnterpriseToolSuite(this);

    this.tools = new Map();
    this.aliasMap = new Map();

    this._registerDefaultTools();
  }

  /**
   * Set active agent instance for knowledge service (GraphDB/EmbeddingDB binding).
   */
  setAgentInstance(agentInstance) {
    this.knowledgeService.setAgentInstance(agentInstance);
  }

  /**
   * Register a capability tool in the central registry.
   */
  registerTool(def) {
    if (!def.name || !def.version || !def.execute) {
      throw new Error('Tool definition must specify name, version, and execute function.');
    }
    const fullName = `${def.name}@${def.version}`;
    this.tools.set(fullName, def);
    this.aliasMap.set(def.name, fullName);

    if (def.aliases && Array.isArray(def.aliases)) {
      for (const alias of def.aliases) {
        this.aliasMap.set(alias, fullName);
      }
    }
  }

  /**
   * Resolve a tool name or alias to its full versioned name.
   */
  resolveToolName(nameOrAlias) {
    if (this.tools.has(nameOrAlias)) return nameOrAlias;
    if (this.aliasMap.has(nameOrAlias)) return this.aliasMap.get(nameOrAlias);
    return null;
  }

  /**
   * Execute a tool by name/alias with typed validation and structured response envelope.
   */
  async executeTool(toolNameOrAlias, rawArgs = {}, context = {}) {
    const startTime = Date.now();
    const fullName = this.resolveToolName(toolNameOrAlias);

    const caller = context.caller || 'internal_ai';
    const workspaceRoot = context.workspaceRoot || rawArgs.workspaceRoot || null;

    if (!fullName || !this.tools.has(fullName)) {
      return this._buildResponse({
        success: false,
        data: null,
        toolName: toolNameOrAlias,
        version: 'unknown',
        startTime,
        caller,
        executionPath: 'ApplicationToolRegistry -> resolveToolName',
        error: {
          code: 'TOOL_NOT_FOUND',
          message: `Tool "${toolNameOrAlias}" is not registered in the Application Tool Registry.`
        }
      });
    }

    const toolDef = this.tools.get(fullName);

    // Security permission check: enforce write tools restriction if allowWriteTools is false
    if (toolDef.isWrite && context.allowWriteTools === false) {
      return this._buildResponse({
        success: false,
        data: null,
        toolName: toolDef.name,
        version: toolDef.version,
        startTime,
        caller,
        sessionId: context.sessionId || null,
        executionPath: `ApplicationToolRegistry -> SecurityCheck -> ${toolDef.name}`,
        error: {
          code: 'WRITE_DISABLED',
          message: `Tool "${toolDef.name}" is a write operation, but write tools are disabled in MCP Configuration.`
        }
      });
    }

    // Validate inputs if schema exists
    let validatedArgs = rawArgs || {};
    if (toolDef.schema && typeof toolDef.schema.parse === 'function') {
      try {
        validatedArgs = toolDef.schema.parse(rawArgs || {});
      } catch (err) {
        return this._buildResponse({
          success: false,
          data: null,
          toolName: toolDef.name,
          version: toolDef.version,
          startTime,
          caller,
          sessionId: context.sessionId || null,
          executionPath: `ApplicationToolRegistry -> SchemaValidation -> ${toolDef.name}`,
          error: {
            code: 'INVALID_INPUT',
            message: `Input validation failed for tool "${toolDef.name}": ${err.message}`
          }
        });
      }
    }

    // Merge context workspaceRoot into validatedArgs if needed
    const finalArgs = {
      ...validatedArgs,
      workspaceRoot: validatedArgs.workspaceRoot || workspaceRoot
    };

    try {
      const data = await toolDef.execute(finalArgs, context, this);
      return this._buildResponse({
        success: true,
        data,
        toolName: toolDef.name,
        version: toolDef.version,
        startTime,
        caller,
        sessionId: context.sessionId || null,
        executionPath: `ApplicationToolRegistry -> ${toolDef.serviceName || 'Service'} -> ${toolDef.name}`
      });
    } catch (err) {
      return this._buildResponse({
        success: false,
        data: null,
        toolName: toolDef.name,
        version: toolDef.version,
        startTime,
        caller,
        sessionId: context.sessionId || null,
        executionPath: `ApplicationToolRegistry -> ExecutionFailure -> ${toolDef.name}`,
        error: {
          code: 'EXECUTION_ERROR',
          message: err.message || 'An error occurred during tool execution.'
        }
      });
    }
  }

  _buildResponse({ success, data, toolName, version, startTime, caller, sessionId = null, executionPath, error = null, warnings = [] }) {
    const durationMs = Date.now() - startTime;
    return {
      success,
      data,
      metadata: {
        toolName,
        version,
        durationMs,
        timestamp: new Date().toISOString()
      },
      diagnostics: {
        caller,
        sessionId,
        executionPath
      },
      warnings,
      error
    };
  }

  /**
   * Export registered tools to Vercel AI SDK compatible tool definitions.
   */
  async toVercelTools(context = {}) {
    const { tool } = await import('ai');
    const { z } = await import('zod');

    const vercelTools = {};

    for (const [fullName, toolDef] of this.tools.entries()) {
      const toolInstance = tool({
        description: toolDef.description,
        parameters: toolDef.schema || z.object({}),
        execute: async (args) => {
          const res = await this.executeTool(fullName, args, context);
          if (!res.success) {
            return 'No results available for this query.';
          }
          if (res.data && typeof res.data.content === 'string') {
            return res.data.content;
          }
          if (res.data && res.data.content && typeof res.data.content.raw === 'string') {
            return res.data.content.raw;
          }
          return typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2);
        }
      });

      // Export primary name
      vercelTools[toolDef.name] = toolInstance;

      // Export aliases for internal AI planner / RAG compatibility
      if (toolDef.sdkName) {
        vercelTools[toolDef.sdkName] = toolInstance;
      }
      if (Array.isArray(toolDef.aliases)) {
        for (const alias of toolDef.aliases) {
          vercelTools[alias] = toolInstance;
        }
      }
    }

    return vercelTools;
  }

  /**
   * Export registered tools into JSON-RPC / MCP Tool format.
   * @param {object|string} [_options] - Optional configuration
   */
  toMcpSchemas(_options = {}) {
    return Array.from(this.tools.values()).map(toolDef => ({
      name: toolDef.name,
      description: toolDef.isWrite ? `[WRITE] ${toolDef.description}` : toolDef.description,
      inputSchema: toolDef.jsonSchema || { type: 'object', properties: {} },
      isWrite: Boolean(toolDef.isWrite),
      annotations: toolDef.annotations || {}
    }));
  }

  _registerDefaultTools() {
    // Register the 7 unified enterprise capability tools
    for (const def of this.enterpriseSuite.getToolDefinitions()) {
      this.registerTool(def);
    }
  }
}

const applicationToolRegistry = new ApplicationToolRegistry();

module.exports = {
  ApplicationToolRegistry,
  applicationToolRegistry
};
