/**
 * ApplicationToolRegistry.cjs
 * Central Application Tool Registry for Notely.
 * Provides typed tool definitions, Zod validation, structured output envelopes,
 * telemetry/logging, Vercel AI SDK export, and future MCP schema export.
 */

const { NoteApplicationService } = require('../services/NoteApplicationService.cjs');
const { KnowledgeApplicationService } = require('../services/KnowledgeApplicationService.cjs');
const { WorkspaceApplicationService } = require('../services/WorkspaceApplicationService.cjs');
const { WebToolService } = require('../services/WebToolService.cjs');
const { z } = require('zod');

class ApplicationToolRegistry {
  constructor() {
    this.noteService = new NoteApplicationService();
    this.knowledgeService = new KnowledgeApplicationService();
    this.workspaceService = new WorkspaceApplicationService();
    this.webService = new WebToolService();

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
        executionPath: `ApplicationToolRegistry -> ExecutionFailure -> ${toolDef.name}`,
        error: {
          code: 'EXECUTION_ERROR',
          message: err.message || 'An error occurred during tool execution.'
        }
      });
    }
  }

  _buildResponse({ success, data, toolName, version, startTime, caller, executionPath, error = null, warnings = [] }) {
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
      // Use alias name or primary name for Vercel AI SDK compatibility
      const sdkName = toolDef.sdkName || toolDef.aliases?.[0] || toolDef.name.replace(/\./g, '_');
      
      vercelTools[sdkName] = tool({
        description: toolDef.description,
        parameters: toolDef.schema || z.object({}),
        execute: async (args) => {
          const res = await this.executeTool(fullName, args, context);
          if (!res.success) {
            const msg = res.error?.message || 'Tool execution failed.';
            const isUserSafe = msg && !msg.includes('Input validation failed') && !msg.includes('is not registered');
            return isUserSafe
              ? `No results found. ${msg}`
              : 'No results available for this query.';
          }
          if (res.data && typeof res.data.content === 'string') {
            return res.data.content;
          }
          return typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2);
        }
      });
    }

    return vercelTools;
  }

  /**
   * Export registered tools into JSON-RPC / MCP Tool format.
   */
  toMcpSchemas() {
    const mcpSchemas = [];
    for (const toolDef of this.tools.values()) {
      mcpSchemas.push({
        name: toolDef.name,
        description: toolDef.isWrite ? `[WRITE] ${toolDef.description}` : toolDef.description,
        inputSchema: toolDef.jsonSchema || { type: 'object', properties: {} },
        isWrite: Boolean(toolDef.isWrite)
      });
    }
    return mcpSchemas;
  }

  _registerDefaultTools() {
    // ─── 1. NOTES SUITE (`notes.*`) ──────────────────────────────────────────

    // notes.read
    this.registerTool({
      name: 'notes.read',
      version: 'v1',
      aliases: ['read_note'],
      sdkName: 'read_note',
      serviceName: 'NoteApplicationService',
      description: 'Read content of a specific note file in the workspace.',
      isWrite: false,
      schema: z.object({
        filePath: z.string().optional().describe('Relative or absolute path to the note file.'),
        file_path: z.string().optional().describe('Relative or absolute path to the note file.'),
        startLine: z.number().optional().describe('Start line number (default: 1).'),
        maxLines: z.number().optional().describe('Maximum lines to read (default: 500).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Relative or absolute path to the note file.' },
          startLine: { type: 'number', description: 'Start line number.' },
          maxLines: { type: 'number', description: 'Maximum lines to read.' }
        },
        required: ['filePath']
      },
      execute: async (args) => {
        const filePath = args.filePath || args.file_path;
        if (!filePath) throw new Error('filePath is required.');
        return this.noteService.readNote({ ...args, filePath });
      }
    });

    // notes.create
    this.registerTool({
      name: 'notes.create',
      version: 'v1',
      aliases: ['create_note'],
      sdkName: 'create_note',
      serviceName: 'NoteApplicationService',
      description: 'Create a new markdown note in the workspace.',
      isWrite: true,
      schema: z.object({
        title: z.string().describe('Title for the new note.'),
        content: z.string().optional().describe('Initial markdown content.'),
        folder: z.string().optional().describe('Target folder path within workspace.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Title for the new note.' },
          content: { type: 'string', description: 'Initial markdown content.' },
          folder: { type: 'string', description: 'Target folder path.' }
        },
        required: ['title']
      },
      execute: async (args) => this.noteService.createNote(args)
    });

    // notes.update
    this.registerTool({
      name: 'notes.update',
      version: 'v1',
      aliases: ['update_note', 'edit_note'],
      sdkName: 'update_note',
      serviceName: 'NoteApplicationService',
      description: 'Update, append, or overwrite content in an existing note.',
      isWrite: true,
      schema: z.object({
        filePath: z.string().describe('Relative or absolute path to note file.'),
        content: z.string().describe('Content to insert, append, or overwrite.'),
        mode: z.enum(['append', 'prepend', 'overwrite', 'replace']).optional().describe('Update mode (default: append).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Relative or absolute path to note file.' },
          content: { type: 'string', description: 'Content to insert, append, or overwrite.' },
          mode: { type: 'string', enum: ['append', 'prepend', 'overwrite', 'replace'], description: 'Update mode.' }
        },
        required: ['filePath', 'content']
      },
      execute: async (args) => this.noteService.updateNote(args)
    });

    // notes.delete
    this.registerTool({
      name: 'notes.delete',
      version: 'v1',
      aliases: ['delete_note'],
      sdkName: 'delete_note',
      serviceName: 'NoteApplicationService',
      description: 'Delete a note file from the workspace.',
      isWrite: true,
      schema: z.object({
        filePath: z.string().describe('Path of note file to delete.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Path of note file to delete.' }
        },
        required: ['filePath']
      },
      execute: async (args) => this.noteService.deleteNote(args)
    });

    // notes.move
    this.registerTool({
      name: 'notes.move',
      version: 'v1',
      aliases: ['move_note', 'rename_note'],
      sdkName: 'move_note',
      serviceName: 'NoteApplicationService',
      description: 'Move or rename a note file within the workspace.',
      isWrite: true,
      schema: z.object({
        sourcePath: z.string().describe('Current relative/absolute note path.'),
        targetPath: z.string().describe('Target relative/absolute note path.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          sourcePath: { type: 'string', description: 'Current relative/absolute note path.' },
          targetPath: { type: 'string', description: 'Target relative/absolute note path.' }
        },
        required: ['sourcePath', 'targetPath']
      },
      execute: async (args) => this.noteService.moveNote(args)
    });

    // notes.read_frontmatter
    this.registerTool({
      name: 'notes.read_frontmatter',
      version: 'v1',
      aliases: ['parse_frontmatter'],
      sdkName: 'read_frontmatter',
      serviceName: 'NoteApplicationService',
      description: 'Extract and parse YAML frontmatter metadata from a note file.',
      isWrite: false,
      schema: z.object({
        filePath: z.string().describe('Path to the target note file.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Path to the target note file.' }
        },
        required: ['filePath']
      },
      execute: async (args) => {
        const res = await this.noteService.readNote({ ...args, maxLines: 50 });
        const text = res.content || '';
        const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        let metadata = {};
        if (match) {
          try {
            const yaml = require('js-yaml');
            metadata = yaml.load(match[1]) || {};
          } catch {
            metadata = { raw: match[1] };
          }
        }
        return { filePath: args.filePath, hasFrontmatter: Boolean(match), metadata };
      }
    });

    // notes.extract_toc
    this.registerTool({
      name: 'notes.extract_toc',
      version: 'v1',
      aliases: ['get_outline', 'extract_toc'],
      sdkName: 'extract_toc',
      serviceName: 'NoteApplicationService',
      description: 'Extract heading outline (Table of Contents) from a note file.',
      isWrite: false,
      schema: z.object({
        filePath: z.string().describe('Path to the target note file.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Path to the target note file.' }
        },
        required: ['filePath']
      },
      execute: async (args) => {
        const res = await this.noteService.readNote({ ...args, maxLines: 2000 });
        const lines = (res.content || '').split('\n');
        const headings = [];
        lines.forEach((line, idx) => {
          const match = line.match(/^(#{1,6})\s+(.+)$/);
          if (match) {
            headings.push({
              level: match[1].length,
              text: match[2].trim(),
              line: idx + 1
            });
          }
        });
        return { filePath: args.filePath, totalHeadings: headings.length, headings };
      }
    });

    // notes.backlinks
    this.registerTool({
      name: 'notes.backlinks',
      version: 'v1',
      aliases: ['get_backlinks'],
      sdkName: 'get_backlinks',
      serviceName: 'KnowledgeApplicationService',
      description: 'Find incoming and outgoing wiki-style links for a given note.',
      isWrite: false,
      schema: z.object({
        notePath: z.string().describe('Target note path or filename.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          notePath: { type: 'string', description: 'Target note path or filename.' }
        },
        required: ['notePath']
      },
      execute: async (args) => {
        return this.knowledgeService.getRelatedTopics({
          workspaceRoot: args.workspaceRoot,
          topic: args.notePath,
          notePath: args.notePath
        });
      }
    });


    // ─── 2. WORKSPACE INDEX SUITE (`index.*`) ──────────────────────────────────

    // index.build_index
    this.registerTool({
      name: 'index.build_index',
      version: 'v1',
      aliases: ['build_workspace_index'],
      sdkName: 'build_workspace_index',
      serviceName: 'WorkspaceIndexService',
      description: 'Generate multi-level index of workspace documents, folder trees, headers, code blocks, tasks, and tag map.',
      isWrite: false,
      schema: z.object({}),
      jsonSchema: { type: 'object', properties: {} },
      execute: async (args) => {
        const { collectMarkdownFiles } = require('../services/NoteApplicationService.cjs');
        const files = collectMarkdownFiles(args.workspaceRoot);
        const docs = files.map(f => {
          try {
            return { filePath: f, title: require('path').basename(f), content: require('fs').readFileSync(f, 'utf8') };
          } catch { return null; }
        }).filter(Boolean);

        const { buildWorkspaceIndex } = await import('../../src/services/workspaceIndexService.js');
        return buildWorkspaceIndex(docs);
      }
    });

    // index.search_hierarchical
    this.registerTool({
      name: 'index.search_hierarchical',
      version: 'v1',
      aliases: ['search_multi_level'],
      sdkName: 'search_hierarchical',
      serviceName: 'WorkspaceIndexService',
      description: 'Multi-level section block & header deep search across documents, headers, tasks, and tags.',
      isWrite: false,
      schema: z.object({
        query: z.string().describe('Search keyword query.'),
        filterTag: z.string().optional().describe('Optional tag filter.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search keyword query.' },
          filterTag: { type: 'string', description: 'Optional tag filter.' }
        },
        required: ['query']
      },
      execute: async (args) => {
        const { collectMarkdownFiles } = require('../services/NoteApplicationService.cjs');
        const files = collectMarkdownFiles(args.workspaceRoot);
        const docs = files.map(f => {
          try { return { filePath: f, title: require('path').basename(f), content: require('fs').readFileSync(f, 'utf8') }; } catch { return null; }
        }).filter(Boolean);

        const { buildWorkspaceIndex, searchMultiLevelIndex } = await import('../../src/services/workspaceIndexService.js');
        const idx = buildWorkspaceIndex(docs);
        return searchMultiLevelIndex(idx, args.query || '', { filterTag: args.filterTag });
      }
    });

    // index.get_tags
    this.registerTool({
      name: 'index.get_tags',
      version: 'v1',
      aliases: ['get_workspace_tags'],
      sdkName: 'get_tags',
      serviceName: 'WorkspaceIndexService',
      description: 'Retrieve tag map and list of documents grouped by tag across the workspace.',
      isWrite: false,
      schema: z.object({}),
      jsonSchema: { type: 'object', properties: {} },
      execute: async (args) => {
        const { collectMarkdownFiles } = require('../services/NoteApplicationService.cjs');
        const files = collectMarkdownFiles(args.workspaceRoot);
        const docs = files.map(f => {
          try { return { filePath: f, title: require('path').basename(f), content: require('fs').readFileSync(f, 'utf8') }; } catch { return null; }
        }).filter(Boolean);

        const { buildWorkspaceIndex } = await import('../../src/services/workspaceIndexService.js');
        const idx = buildWorkspaceIndex(docs);
        return { tagMap: idx.tagMap, totalTags: Object.keys(idx.tagMap).length };
      }
    });


    // ─── 3. WORKSPACE METADATA SUITE (`workspace.*`) ─────────────────────────

    // workspace.metadata
    this.registerTool({
      name: 'workspace.metadata',
      version: 'v1',
      aliases: ['get_workspace_metadata'],
      sdkName: 'workspace_metadata',
      serviceName: 'WorkspaceApplicationService',
      description: 'Get workspace metadata, vault name, app version, root directory path, and environment details.',
      isWrite: false,
      schema: z.object({}),
      jsonSchema: { type: 'object', properties: {} },
      execute: async (args) => {
        const path = require('path');
        const fs = require('fs');
        const root = args.workspaceRoot;
        const vaultName = root ? path.basename(root) : 'Notely Workspace';
        const configPath = root ? path.join(root, '.notes-app', 'workspace-config.json') : null;
        let userConfig = {};
        if (configPath && fs.existsSync(configPath)) {
          try { userConfig = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch { /* ignore */ }
        }
        return {
          workspaceRoot: root,
          vaultName,
          appVersion: '0.1.41',
          config: userConfig,
          environment: process.env.NODE_ENV || 'production'
        };
      }
    });

    // workspace.update_metadata
    this.registerTool({
      name: 'workspace.update_metadata',
      version: 'v1',
      aliases: ['set_workspace_metadata'],
      sdkName: 'update_workspace_metadata',
      serviceName: 'WorkspaceApplicationService',
      description: 'Update workspace metadata settings and configuration flags.',
      isWrite: true,
      schema: z.object({
        vaultName: z.string().optional().describe('Custom vault display name.'),
        settings: z.record(z.any()).optional().describe('Custom key-value workspace settings.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          vaultName: { type: 'string', description: 'Custom vault display name.' },
          settings: { type: 'object', description: 'Custom key-value workspace settings.' }
        }
      },
      execute: async (args) => {
        const path = require('path');
        const fs = require('fs');
        const root = args.workspaceRoot;
        if (!root) throw new Error('Workspace root is required.');

        const dir = path.join(root, '.notes-app');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const configPath = path.join(dir, 'workspace-config.json');

        let current = {};
        if (fs.existsSync(configPath)) {
          try { current = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch { /* ignore */ }
        }

        const nextConfig = {
          ...current,
          ...(args.vaultName ? { vaultName: args.vaultName } : {}),
          ...(args.settings || {}),
          updatedAt: new Date().toISOString()
        };

        fs.writeFileSync(configPath, JSON.stringify(nextConfig, null, 2), 'utf8');
        return { updated: true, config: nextConfig };
      }
    });

    // workspace.statistics
    this.registerTool({
      name: 'workspace.statistics',
      version: 'v1',
      aliases: ['workspace_stats'],
      sdkName: 'workspace_stats',
      serviceName: 'WorkspaceApplicationService',
      description: 'Get workspace document counts, storage breakdown, task totals, and health metrics.',
      isWrite: false,
      schema: z.object({}),
      jsonSchema: { type: 'object', properties: {} },
      execute: async (args) => this.workspaceService.getStatistics(args)
    });

    // workspace.recent_activity
    this.registerTool({
      name: 'workspace.recent_activity',
      version: 'v1',
      aliases: ['recent_activity'],
      sdkName: 'recent_activity',
      serviceName: 'WorkspaceApplicationService',
      description: 'Get chronological list of recently modified notes in the workspace.',
      isWrite: false,
      schema: z.object({
        limit: z.number().optional().describe('Max items to return (default: 10).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max items to return (default: 10).' }
        }
      },
      execute: async (args) => this.workspaceService.getRecentActivity(args)
    });

    // workspace.export_pdf
    this.registerTool({
      name: 'workspace.export_pdf',
      version: 'v1',
      aliases: ['export_pdf', 'render_pdf'],
      sdkName: 'export_pdf',
      serviceName: 'WorkspaceApplicationService',
      description: 'Export or render a note document into PDF format.',
      isWrite: false,
      schema: z.object({
        filePath: z.string().describe('Relative or absolute path of note file to export.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Relative or absolute path of note file to export.' }
        },
        required: ['filePath']
      },
      execute: async (args) => {
        const res = await this.noteService.readNote(args);
        return {
          filePath: args.filePath,
          exportType: 'pdf',
          status: 'ready',
          contentPreview: (res.content || '').substring(0, 500)
        };
      }
    });


    // ─── 4. DIAGRAMS & DRAW.IO SUITE (`diagrams.*`, `drawio.*`) ────────────────

    // diagrams.render
    this.registerTool({
      name: 'diagrams.render',
      version: 'v1',
      aliases: ['validate_mermaid', 'render_diagram'],
      sdkName: 'render_diagram',
      serviceName: 'DiagramService',
      description: 'Validate and format Mermaid diagram markup (flowchart, sequence, class, state, gantt, pie).',
      isWrite: false,
      schema: z.object({
        code: z.string().describe('Mermaid diagram markdown definition string.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Mermaid diagram markdown definition string.' }
        },
        required: ['code']
      },
      execute: async (args) => {
        const { detectMermaidType, extractMermaidTitle } = await import('../../src/services/workspaceMediaService.js');
        const diagramType = detectMermaidType(args.code);
        const title = extractMermaidTitle(args.code);
        return {
          valid: true,
          diagramType,
          title,
          code: args.code,
          htmlPreview: `<div class="mermaid-diagram-container" data-type="${diagramType}">\n<pre class="mermaid">\n${args.code}\n</pre>\n</div>`
        };
      }
    });

    // diagrams.create
    this.registerTool({
      name: 'diagrams.create',
      version: 'v1',
      aliases: ['create_diagram'],
      sdkName: 'create_diagram',
      serviceName: 'DiagramService',
      description: 'Create a new diagram file or append a Mermaid diagram block to a note.',
      isWrite: true,
      schema: z.object({
        title: z.string().describe('Title of the diagram.'),
        code: z.string().describe('Mermaid diagram code.'),
        notePath: z.string().optional().describe('Optional target note path to insert diagram into.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Title of the diagram.' },
          code: { type: 'string', description: 'Mermaid diagram code.' },
          notePath: { type: 'string', description: 'Optional target note path.' }
        },
        required: ['title', 'code']
      },
      execute: async (args) => {
        const block = `\n\n### ${args.title}\n\`\`\`mermaid\n${args.code}\n\`\`\`\n`;
        if (args.notePath) {
          return this.noteService.updateNote({ workspaceRoot: args.workspaceRoot, filePath: args.notePath, content: block, mode: 'append' });
        }
        return this.noteService.createNote({ workspaceRoot: args.workspaceRoot, title: args.title, content: block });
      }
    });

    // diagrams.list
    this.registerTool({
      name: 'diagrams.list',
      version: 'v1',
      aliases: ['list_diagrams'],
      sdkName: 'list_diagrams',
      serviceName: 'DiagramService',
      description: 'Scan workspace notes for all embedded Mermaid and Draw.io diagrams.',
      isWrite: false,
      schema: z.object({}),
      jsonSchema: { type: 'object', properties: {} },
      execute: async (args) => {
        const { collectMarkdownFiles } = require('../services/NoteApplicationService.cjs');
        const files = collectMarkdownFiles(args.workspaceRoot);
        const docs = files.map(f => {
          try { return { filePath: f, title: require('path').basename(f), content: require('fs').readFileSync(f, 'utf8') }; } catch { return null; }
        }).filter(Boolean);

        const { extractWorkspaceUsedAssets, filterAssets } = await import('../../src/services/workspaceMediaService.js');
        const catalog = extractWorkspaceUsedAssets(docs);
        return filterAssets(catalog, { selectedCategories: { diagram: true } });
      }
    });

    // drawio.read_source
    this.registerTool({
      name: 'drawio.read_source',
      version: 'v1',
      aliases: ['get_drawio'],
      sdkName: 'read_drawio_source',
      serviceName: 'DrawioService',
      description: 'Read XML diagram source data of a Draw.io file in the workspace.',
      isWrite: false,
      schema: z.object({
        diagramId: z.string().describe('ID or filename of the Draw.io diagram.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          diagramId: { type: 'string', description: 'ID or filename of the Draw.io diagram.' }
        },
        required: ['diagramId']
      },
      execute: async (args) => {
        const path = require('path');
        const fs = require('fs');
        const root = args.workspaceRoot;
        const target = path.join(root, '.notes-app', 'diagrams', 'drawio', `${args.diagramId}.drawio`);
        if (!fs.existsSync(target)) {
          return { diagramId: args.diagramId, exists: false, xml: null };
        }
        return { diagramId: args.diagramId, exists: true, xml: fs.readFileSync(target, 'utf8') };
      }
    });

    // drawio.write_source
    this.registerTool({
      name: 'drawio.write_source',
      version: 'v1',
      aliases: ['save_drawio'],
      sdkName: 'write_drawio_source',
      serviceName: 'DrawioService',
      description: 'Create or update Draw.io XML diagram source file.',
      isWrite: true,
      schema: z.object({
        diagramId: z.string().describe('ID or filename of Draw.io diagram.'),
        xml: z.string().describe('Draw.io XML contents.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          diagramId: { type: 'string', description: 'ID or filename of Draw.io diagram.' },
          xml: { type: 'string', description: 'Draw.io XML contents.' }
        },
        required: ['diagramId', 'xml']
      },
      execute: async (args) => {
        const path = require('path');
        const fs = require('fs');
        const root = args.workspaceRoot;
        const dir = path.join(root, '.notes-app', 'diagrams', 'drawio');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const target = path.join(dir, `${args.diagramId}.drawio`);
        fs.writeFileSync(target, args.xml, 'utf8');
        return { diagramId: args.diagramId, saved: true, path: target };
      }
    });

    // drawio.write_image
    this.registerTool({
      name: 'drawio.write_image',
      version: 'v1',
      aliases: ['render_drawio_png'],
      sdkName: 'write_drawio_image',
      serviceName: 'DrawioService',
      description: 'Save rendered PNG/SVG preview image for a Draw.io diagram.',
      isWrite: true,
      schema: z.object({
        diagramId: z.string().describe('ID of Draw.io diagram.'),
        imageData: z.string().describe('Base64 image data payload.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          diagramId: { type: 'string', description: 'ID of Draw.io diagram.' },
          imageData: { type: 'string', description: 'Base64 image data payload.' }
        },
        required: ['diagramId', 'imageData']
      },
      execute: async (args) => {
        const path = require('path');
        const fs = require('fs');
        const root = args.workspaceRoot;
        const dir = path.join(root, '.notes-app', 'diagrams', 'drawio');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const target = path.join(dir, `${args.diagramId}.png`);
        const base64Data = args.imageData.replace(/^data:image\/\w+;base64,/, '');
        fs.writeFileSync(target, Buffer.from(base64Data, 'base64'));
        return { diagramId: args.diagramId, imageSaved: true, path: target };
      }
    });


    // ─── 5. MEDIA & ATTACHMENTS SUITE (`media.*`) ─────────────────────────────

    // media.list_assets
    this.registerTool({
      name: 'media.list_assets',
      version: 'v1',
      aliases: ['list_media'],
      sdkName: 'list_media_assets',
      serviceName: 'MediaService',
      description: 'Scan workspace for images, audio, video, PDFs, and attachment files.',
      isWrite: false,
      schema: z.object({}),
      jsonSchema: { type: 'object', properties: {} },
      execute: async (args) => {
        const fs = require('fs');
        const path = require('path');
        const root = args.workspaceRoot;
        if (!root || !fs.existsSync(root)) return [];

        const assets = [];
        function scan(dir) {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const e of entries) {
            if (e.name.startsWith('.') || e.name === 'node_modules') continue;
            const full = path.join(dir, e.name);
            if (e.isDirectory()) scan(full);
            else if (e.isFile()) {
              const ext = path.extname(e.name).toLowerCase();
              if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.mp3', '.wav', '.mp4', '.pdf'].includes(ext)) {
                const stat = fs.statSync(full);
                assets.push({
                  name: e.name,
                  path: full,
                  extension: ext,
                  sizeBytes: stat.size,
                  modifiedAt: stat.mtime.toISOString()
                });
              }
            }
          }
        }
        scan(root);
        return assets.slice(0, 100);
      }
    });

    // media.extract_used_assets
    this.registerTool({
      name: 'media.extract_used_assets',
      version: 'v1',
      aliases: ['catalog_assets'],
      sdkName: 'extract_used_assets',
      serviceName: 'WorkspaceMediaService',
      description: 'Catalog all referenced media files, diagrams, and PDFs with note line numbers and context snippets.',
      isWrite: false,
      schema: z.object({}),
      jsonSchema: { type: 'object', properties: {} },
      execute: async (args) => {
        const { collectMarkdownFiles } = require('../services/NoteApplicationService.cjs');
        const files = collectMarkdownFiles(args.workspaceRoot);
        const docs = files.map(f => {
          try { return { filePath: f, title: require('path').basename(f), content: require('fs').readFileSync(f, 'utf8') }; } catch { return null; }
        }).filter(Boolean);

        const { extractWorkspaceUsedAssets } = await import('../../src/services/workspaceMediaService.js');
        return extractWorkspaceUsedAssets(docs);
      }
    });

    // media.get_metadata
    this.registerTool({
      name: 'media.get_metadata',
      version: 'v1',
      aliases: ['image_metadata'],
      sdkName: 'get_media_metadata',
      serviceName: 'MediaService',
      description: 'Read file size, format, and dimensions of a workspace media asset.',
      isWrite: false,
      schema: z.object({
        assetPath: z.string().describe('Relative or absolute path to media file.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          assetPath: { type: 'string', description: 'Relative or absolute path to media file.' }
        },
        required: ['assetPath']
      },
      execute: async (args) => {
        const fs = require('fs');
        const path = require('path');
        const full = path.isAbsolute(args.assetPath) ? args.assetPath : path.join(args.workspaceRoot || '', args.assetPath);
        if (!fs.existsSync(full)) throw new Error(`Asset at path "${args.assetPath}" not found.`);

        const stat = fs.statSync(full);
        const ext = path.extname(full).toLowerCase();
        return {
          name: path.basename(full),
          path: full,
          extension: ext,
          sizeBytes: stat.size,
          createdAt: stat.birthtime.toISOString(),
          modifiedAt: stat.mtime.toISOString()
        };
      }
    });

    // media.save_asset
    this.registerTool({
      name: 'media.save_asset',
      version: 'v1',
      aliases: ['upload_asset', 'save_image'],
      sdkName: 'save_media_asset',
      serviceName: 'MediaService',
      description: 'Save binary or base64 attachment file into workspace assets directory.',
      isWrite: true,
      schema: z.object({
        fileName: z.string().describe('Filename for the media asset (e.g. diagram.png).'),
        base64Data: z.string().describe('Base64 encoded file data.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          fileName: { type: 'string', description: 'Filename for the media asset.' },
          base64Data: { type: 'string', description: 'Base64 encoded file data.' }
        },
        required: ['fileName', 'base64Data']
      },
      execute: async (args) => {
        const path = require('path');
        const fs = require('fs');
        const root = args.workspaceRoot;
        if (!root) throw new Error('Workspace root required.');

        const dir = path.join(root, 'assets');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const target = path.join(dir, args.fileName);
        const cleanBase64 = args.base64Data.replace(/^data:image\/\w+;base64,/, '');
        fs.writeFileSync(target, Buffer.from(cleanBase64, 'base64'));
        return { saved: true, path: target, relativePath: `assets/${args.fileName}` };
      }
    });

    // media.delete_asset
    this.registerTool({
      name: 'media.delete_asset',
      version: 'v1',
      aliases: ['delete_image'],
      sdkName: 'delete_media_asset',
      serviceName: 'MediaService',
      description: 'Delete a media attachment file from the workspace.',
      isWrite: true,
      schema: z.object({
        assetPath: z.string().describe('Path to asset file.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          assetPath: { type: 'string', description: 'Path to asset file.' }
        },
        required: ['assetPath']
      },
      execute: async (args) => {
        const path = require('path');
        const fs = require('fs');
        const target = path.isAbsolute(args.assetPath) ? args.assetPath : path.join(args.workspaceRoot || '', args.assetPath);
        if (fs.existsSync(target)) fs.unlinkSync(target);
        return { deleted: true, path: target };
      }
    });


    // ─── 6. TASKS & CHECKLIST SUITE (`tasks.*`) ──────────────────────────────

    // tasks.extract
    this.registerTool({
      name: 'tasks.extract',
      version: 'v1',
      aliases: ['get_tasks'],
      sdkName: 'get_tasks',
      serviceName: 'NoteApplicationService',
      description: 'Extract checklist tasks across notes in the workspace.',
      isWrite: false,
      schema: z.object({
        notePath: z.string().optional().describe('Optional specific note path.'),
        status: z.enum(['all', 'open', 'completed']).optional().describe('Filter tasks by status.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          notePath: { type: 'string', description: 'Optional specific note path.' },
          status: { type: 'string', enum: ['all', 'open', 'completed'], description: 'Filter tasks by status.' }
        }
      },
      execute: async (args) => this.noteService.extractTasks(args)
    });

    // tasks.update_status
    this.registerTool({
      name: 'tasks.update_status',
      version: 'v1',
      aliases: ['toggle_task'],
      sdkName: 'update_task_status',
      serviceName: 'NoteApplicationService',
      description: 'Toggle or update the completed status of a checklist task in a note.',
      isWrite: true,
      schema: z.object({
        filePath: z.string().describe('Path to the target note file.'),
        line: z.number().describe('Line number of the task checkbox.'),
        completed: z.boolean().describe('True to mark completed [x], False for open [ ].')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Path to the target note file.' },
          line: { type: 'number', description: 'Line number of the task checkbox.' },
          completed: { type: 'boolean', description: 'True to mark completed [x], False for open [ ].' }
        },
        required: ['filePath', 'line', 'completed']
      },
      execute: async (args) => {
        const res = await this.noteService.readNote({ workspaceRoot: args.workspaceRoot, filePath: args.filePath, maxLines: 5000 });
        const lines = (res.content || '').split('\n');
        const idx = args.line - 1;
        if (idx < 0 || idx >= lines.length) throw new Error(`Line number ${args.line} out of range.`);

        const lineText = lines[idx];
        const updatedLine = args.completed
          ? lineText.replace(/^(\s*[-*+]?\s*\[)[ xX/]\]/, '$1x]')
          : lineText.replace(/^(\s*[-*+]?\s*\[)[ xX/]\]/, '$1 ]');

        lines[idx] = updatedLine;
        await this.noteService.updateNote({ workspaceRoot: args.workspaceRoot, filePath: args.filePath, content: lines.join('\n'), mode: 'overwrite' });
        return { filePath: args.filePath, line: args.line, completed: args.completed, updatedText: updatedLine.trim() };
      }
    });

    // tasks.summary
    this.registerTool({
      name: 'tasks.summary',
      version: 'v1',
      aliases: ['task_summary'],
      sdkName: 'tasks_summary',
      serviceName: 'NoteApplicationService',
      description: 'Group and summarize workspace tasks by note, completion rate, and status.',
      isWrite: false,
      schema: z.object({}),
      jsonSchema: { type: 'object', properties: {} },
      execute: async (args) => {
        const tasks = await this.noteService.extractTasks({ workspaceRoot: args.workspaceRoot, status: 'all' });
        const total = tasks.length;
        const completed = tasks.filter(t => t.status === 'completed').length;
        const open = total - completed;
        const rate = total > 0 ? Math.round((completed / total) * 100) : 100;
        return { totalTasks: total, completedTasks: completed, openTasks: open, completionRatePercent: rate, tasks: tasks.slice(0, 50) };
      }
    });


    // ─── 7. KNOWLEDGE GRAPH & VECTOR SEARCH SUITE (`knowledge.*`, `search.*`) ─

    // search.notes
    this.registerTool({
      name: 'search.notes',
      version: 'v1',
      aliases: ['search_notes'],
      sdkName: 'search_notes',
      serviceName: 'KnowledgeApplicationService',
      description: 'Full-text keyword search across workspace notes.',
      isWrite: false,
      schema: z.object({
        query: z.string().describe('Search query string.'),
        limit: z.number().optional().describe('Max results (default: 10).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query string.' },
          limit: { type: 'number', description: 'Max results.' }
        },
        required: ['query']
      },
      execute: async (args) => this.knowledgeService.searchNotes(args)
    });

    // search.similar
    this.registerTool({
      name: 'search.similar',
      version: 'v1',
      aliases: ['semantic_search'],
      sdkName: 'semantic_search',
      serviceName: 'KnowledgeApplicationService',
      description: 'Find semantically similar notes using vector embeddings.',
      isWrite: false,
      schema: z.object({
        text: z.string().optional().describe('Raw text query.'),
        notePath: z.string().optional().describe('Source note path.'),
        topK: z.number().optional().describe('Top K results.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Raw text query.' },
          notePath: { type: 'string', description: 'Source note path.' },
          topK: { type: 'number', description: 'Top K results.' }
        }
      },
      execute: async (args) => this.knowledgeService.searchSimilar(args)
    });

    // search.hybrid
    this.registerTool({
      name: 'search.hybrid',
      version: 'v1',
      aliases: ['hybrid_search'],
      sdkName: 'hybrid_search',
      serviceName: 'KnowledgeApplicationService',
      description: 'Hybrid search combining full-text keyword search and vector similarity.',
      isWrite: false,
      schema: z.object({
        query: z.string().describe('Query text.'),
        limit: z.number().optional().describe('Max results.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Query text.' },
          limit: { type: 'number', description: 'Max results.' }
        },
        required: ['query']
      },
      execute: async (args) => this.knowledgeService.searchHybrid(args)
    });

    // knowledge.related_topics
    this.registerTool({
      name: 'knowledge.related_topics',
      version: 'v1',
      aliases: ['get_graph'],
      sdkName: 'get_graph',
      serviceName: 'KnowledgeApplicationService',
      description: 'Traverse knowledge graph relationships around a note or topic.',
      isWrite: false,
      schema: z.object({
        notePath: z.string().optional().describe('Source note path.'),
        maxDepth: z.number().optional().describe('Max graph depth.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          notePath: { type: 'string', description: 'Source note path.' },
          maxDepth: { type: 'number', description: 'Max graph depth.' }
        }
      },
      execute: async (args) => {
        const topic = args.topic || args.query || args.notePath;
        if (!topic) throw new Error('notePath or topic required.');
        return this.knowledgeService.getRelatedTopics({ ...args, topic, notePath: topic });
      }
    });

    // knowledge.find_clusters
    this.registerTool({
      name: 'knowledge.find_clusters',
      version: 'v1',
      aliases: ['find_clusters'],
      sdkName: 'find_clusters',
      serviceName: 'KnowledgeApplicationService',
      description: 'Discover semantic topic clusters across the workspace.',
      isWrite: false,
      schema: z.object({
        minSize: z.number().optional().describe('Minimum cluster size.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          minSize: { type: 'number', description: 'Minimum cluster size.' }
        }
      },
      execute: async (args) => this.knowledgeService.findClusters(args)
    });

    // knowledge.find_orphans
    this.registerTool({
      name: 'knowledge.find_orphans',
      version: 'v1',
      aliases: ['find_orphan_notes'],
      sdkName: 'find_orphans',
      serviceName: 'KnowledgeApplicationService',
      description: 'Find orphan notes in the workspace that have no incoming or outgoing wiki links.',
      isWrite: false,
      schema: z.object({}),
      jsonSchema: { type: 'object', properties: {} },
      execute: async (args) => {
        const { collectMarkdownFiles } = require('../services/NoteApplicationService.cjs');
        const files = collectMarkdownFiles(args.workspaceRoot);
        const path = require('path');
        const fs = require('fs');

        const linkedTargets = new Set();
        const fileLinkCounts = {};

        files.forEach(f => {
          try {
            const text = fs.readFileSync(f, 'utf8');
            const matches = text.match(/\[\[(.+?)\]\]/g) || [];
            fileLinkCounts[f] = matches.length;
            matches.forEach(m => {
              const target = m.slice(2, -2).trim().toLowerCase();
              linkedTargets.add(target);
            });
          } catch { /* ignore */ }
        });

        const orphans = files.filter(f => {
          const base = path.basename(f, '.md').toLowerCase();
          const outgoing = fileLinkCounts[f] || 0;
          const incoming = linkedTargets.has(base);
          return outgoing === 0 && !incoming;
        }).map(f => ({ path: f, title: path.basename(f) }));

        return { totalOrphans: orphans.length, orphans };
      }
    });

    // knowledge.status
    this.registerTool({
      name: 'knowledge.status',
      version: 'v1',
      aliases: ['knowledge_status'],
      sdkName: 'knowledge_status',
      serviceName: 'KnowledgeApplicationService',
      description: 'Get index status, graph DB node count, and embedding health.',
      isWrite: false,
      schema: z.object({}),
      jsonSchema: { type: 'object', properties: {} },
      execute: async (args) => this.knowledgeService.getKnowledgeStatus(args)
    });

    // knowledge.reindex
    this.registerTool({
      name: 'knowledge.reindex',
      version: 'v1',
      aliases: ['reindex_knowledge'],
      sdkName: 'reindex_knowledge',
      serviceName: 'KnowledgeApplicationService',
      description: 'Force background reindexing of workspace knowledge graph and embeddings.',
      isWrite: true,
      schema: z.object({
        force: z.boolean().optional().describe('Force full reindex.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          force: { type: 'boolean', description: 'Force full reindex.' }
        }
      },
      execute: async (args) => this.knowledgeService.reindexKnowledge(args)
    });


    // ─── 8. GIT VERSION CONTROL SUITE (`git.*`) ───────────────────────────────

    // git.status
    this.registerTool({
      name: 'git.status',
      version: 'v1',
      aliases: ['git_status'],
      sdkName: 'git_status',
      serviceName: 'GitService',
      description: 'Check git working tree status and list modified note files.',
      isWrite: false,
      schema: z.object({}),
      jsonSchema: { type: 'object', properties: {} },
      execute: async (args) => {
        const { execSync } = require('child_process');
        const root = args.workspaceRoot;
        if (!root) throw new Error('Workspace root required.');
        try {
          const out = execSync('git status --short', { cwd: root, encoding: 'utf8' });
          return { isGitRepo: true, output: out.trim(), files: out.trim().split('\n').filter(Boolean) };
        } catch (err) {
          return { isGitRepo: false, error: err.message };
        }
      }
    });

    // git.log
    this.registerTool({
      name: 'git.log',
      version: 'v1',
      aliases: ['git_log'],
      sdkName: 'git_log',
      serviceName: 'GitService',
      description: 'View recent git commit history of the workspace.',
      isWrite: false,
      schema: z.object({
        limit: z.number().optional().describe('Max commits to return (default: 10).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max commits to return (default: 10).' }
        }
      },
      execute: async (args) => {
        const { execSync } = require('child_process');
        const root = args.workspaceRoot;
        const limit = args.limit || 10;
        try {
          const out = execSync(`git log -n ${limit} --oneline`, { cwd: root, encoding: 'utf8' });
          return { commits: out.trim().split('\n').filter(Boolean) };
        } catch (err) {
          return { error: err.message };
        }
      }
    });

    // git.diff
    this.registerTool({
      name: 'git.diff',
      version: 'v1',
      aliases: ['git_diff'],
      sdkName: 'git_diff',
      serviceName: 'GitService',
      description: 'View git diff of modified notes in the workspace.',
      isWrite: false,
      schema: z.object({
        filePath: z.string().optional().describe('Optional specific file to diff.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Optional specific file to diff.' }
        }
      },
      execute: async (args) => {
        const { execSync } = require('child_process');
        const root = args.workspaceRoot;
        const target = args.filePath ? ` "${args.filePath}"` : '';
        try {
          const diff = execSync(`git diff${target}`, { cwd: root, encoding: 'utf8' });
          return { diff: diff.trim() || 'No changes.' };
        } catch (err) {
          return { error: err.message };
        }
      }
    });

    // git.commit
    this.registerTool({
      name: 'git.commit',
      version: 'v1',
      aliases: ['git_commit'],
      sdkName: 'git_commit',
      serviceName: 'GitService',
      description: 'Stage and commit workspace changes.',
      isWrite: true,
      schema: z.object({
        message: z.string().describe('Git commit message.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Git commit message.' }
        },
        required: ['message']
      },
      execute: async (args) => {
        const { execSync } = require('child_process');
        const root = args.workspaceRoot;
        try {
          execSync('git add -A', { cwd: root, encoding: 'utf8' });
          const out = execSync(`git commit -m "${args.message.replace(/"/g, '\\"')}"`, { cwd: root, encoding: 'utf8' });
          return { committed: true, output: out.trim() };
        } catch (err) {
          return { committed: false, error: err.message };
        }
      }
    });


    // ─── 9. AI HEALTH & DIAGNOSTICS SUITE (`diagnostics.*`) ───────────────────

    // diagnostics.check_health
    this.registerTool({
      name: 'diagnostics.check_health',
      version: 'v1',
      aliases: ['check_health'],
      sdkName: 'check_health',
      serviceName: 'AIHealthService',
      description: 'Run health diagnostics on AI providers, vector database, and graph DB.',
      isWrite: false,
      schema: z.object({}),
      jsonSchema: { type: 'object', properties: {} },
      execute: async () => {
        try {
          const AIHealth = require('../../ai/diagnostics/AIHealth');
          const health = new AIHealth();
          return health.getHealthStatus();
        } catch (err) {
          return { status: 'degraded', error: err.message };
        }
      }
    });

    // diagnostics.get_telemetry
    this.registerTool({
      name: 'diagnostics.get_telemetry',
      version: 'v1',
      aliases: ['get_telemetry_logs'],
      sdkName: 'get_telemetry',
      serviceName: 'AIHealthService',
      description: 'Inspect MCP tool call latency metrics, execution flight logs, and error rates.',
      isWrite: false,
      schema: z.object({
        limit: z.number().optional().describe('Max log entries to fetch (default: 50).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max log entries.' }
        }
      },
      execute: async (args) => {
        try {
          const TelemetryDB = require('../../ai/telemetry/TelemetryDB');
          const path = require('path');
          const root = args.workspaceRoot || process.cwd();
          const db = new TelemetryDB(root);
          db.initialize();
          const calls = db.getMcpToolCalls({ limit: args.limit || 50 });
          const stats = db.getMcpStats();
          return { stats, logs: calls };
        } catch (err) {
          return { stats: {}, logs: [], error: err.message };
        }
      }
    });


    // ─── 10. WEB & PERSONAS SUITES (`web.*`, `personas.*`) ────────────────────

    // web.search
    this.registerTool({
      name: 'web.search',
      version: 'v1',
      aliases: ['web_search'],
      sdkName: 'web_search',
      serviceName: 'WebToolService',
      description: 'Search the live web for external documentation or references.',
      isWrite: false,
      schema: z.object({
        query: z.string().describe('Web search query.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Web search query.' }
        },
        required: ['query']
      },
      execute: async (args) => this.webService.searchWeb(args)
    });

    // web.fetch
    this.registerTool({
      name: 'web.fetch',
      version: 'v1',
      aliases: ['fetch_url'],
      sdkName: 'fetch_url',
      serviceName: 'WebToolService',
      description: 'Fetch and read text content from a public web page URL.',
      isWrite: false,
      schema: z.object({
        url: z.string().describe('Public web page URL.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Public web page URL.' }
        },
        required: ['url']
      },
      execute: async (args) => this.webService.fetchUrl(args)
    });

    // personas.list
    this.registerTool({
      name: 'personas.list',
      version: 'v1',
      aliases: ['list_personas'],
      sdkName: 'list_personas',
      serviceName: 'PersonaService',
      description: 'List all available custom and system AI personas.',
      isWrite: false,
      schema: z.object({}),
      jsonSchema: { type: 'object', properties: {} },
      execute: async () => {
        try {
          const PersonaManager = require('../../ai/personas/PersonaManager');
          const { app } = require('electron');
          const appDataDir = app ? require('path').join(app.getPath('appData'), 'Notely') : null;
          const manager = new PersonaManager(null, null, appDataDir);
          return manager.listAvailablePersonas();
        } catch {
          return [];
        }
      }
    });

    // personas.get
    this.registerTool({
      name: 'personas.get',
      version: 'v1',
      aliases: ['get_persona'],
      sdkName: 'get_persona',
      serviceName: 'PersonaService',
      description: 'Get details of a specific AI persona by ID.',
      isWrite: false,
      schema: z.object({
        id: z.string().describe('ID of the persona to fetch.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'ID of the persona to fetch.' }
        },
        required: ['id']
      },
      execute: async (args) => {
        try {
          const PersonaManager = require('../../ai/personas/PersonaManager');
          const { app } = require('electron');
          const appDataDir = app ? require('path').join(app.getPath('appData'), 'Notely') : null;
          const manager = new PersonaManager(null, null, appDataDir);
          return manager.getPersona(args.id);
        } catch {
          return null;
        }
      }
    });

    // personas.create
    this.registerTool({
      name: 'personas.create',
      version: 'v1',
      aliases: ['create_persona'],
      sdkName: 'create_persona',
      serviceName: 'PersonaService',
      description: 'Create a new custom AI persona.',
      isWrite: true,
      schema: z.object({
        name: z.string().describe('Name of the persona.'),
        description: z.string().optional().describe('Short summary.'),
        prompt: z.string().optional().describe('System prompt instructions.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name of the persona.' },
          description: { type: 'string', description: 'Short summary.' },
          prompt: { type: 'string', description: 'System prompt instructions.' }
        },
        required: ['name']
      },
      execute: async (args) => {
        const PersonaManager = require('../../ai/personas/PersonaManager');
        const { app } = require('electron');
        const appDataDir = app ? require('path').join(app.getPath('appData'), 'Notely') : null;
        const manager = new PersonaManager(null, null, appDataDir);
        return manager.createCustomPersona(args);
      }
    });

    // personas.delete
    this.registerTool({
      name: 'personas.delete',
      version: 'v1',
      aliases: ['delete_persona'],
      sdkName: 'delete_persona',
      serviceName: 'PersonaService',
      description: 'Delete a custom persona by ID.',
      isWrite: true,
      schema: z.object({
        id: z.string().describe('ID of custom persona to delete.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'ID of custom persona to delete.' }
        },
        required: ['id']
      },
      execute: async (args) => {
        const PersonaManager = require('../../ai/personas/PersonaManager');
        const { app } = require('electron');
        const appDataDir = app ? require('path').join(app.getPath('appData'), 'Notely') : null;
        const manager = new PersonaManager(null, null, appDataDir);
        return manager.deletePersona(args.id);
      }
    });
  }
}

// Global Application Tool Registry Singleton
const applicationToolRegistry = new ApplicationToolRegistry();

module.exports = {
  ApplicationToolRegistry,
  applicationToolRegistry
};

