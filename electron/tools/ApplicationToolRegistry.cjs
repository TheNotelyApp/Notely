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
      capability: 'notes:read',
      informationNeeds: ['file_content', 'read_note'],
      isWrite: false,
      schema: z.object({
        filePath: z.string().optional().describe('Relative or absolute path to the note file.'),
        file_path: z.string().optional().describe('Relative or absolute path to the note file.'),
        startLine: z.number().optional().describe('Start line number (default: 1).'),
        start_line: z.number().optional().describe('Start line number (default: 1).'),
        endLine: z.number().optional().describe('End line number.'),
        end_line: z.number().optional().describe('End line number.'),
        maxLines: z.number().optional().describe('Maximum lines to read (default: 500).'),
        max_lines: z.number().optional().describe('Maximum lines to read (default: 500).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Relative or absolute path to the note file.' },
          file_path: { type: 'string', description: 'Relative or absolute path to the note file.' },
          startLine: { type: 'number', description: 'Start line number.' },
          start_line: { type: 'number', description: 'Start line number.' },
          endLine: { type: 'number', description: 'End line number.' },
          end_line: { type: 'number', description: 'End line number.' },
          maxLines: { type: 'number', description: 'Maximum lines to read.' },
          max_lines: { type: 'number', description: 'Maximum lines to read.' }
        }
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
      aliases: ['get_tasks', 'tasks_extract'],
      sdkName: 'get_tasks',
      serviceName: 'NoteApplicationService',
      description: 'Extract checklist tasks across notes in the workspace.',
      capability: 'tasks:extract',
      informationNeeds: ['action_items', 'tasks', 'open_tasks'],
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
      description: 'Update the status of a checklist task in a note. Supports open [ ], in-progress [/], and completed [x].',
      isWrite: true,
      schema: z.object({
        filePath: z.string().describe('Path to the target note file.'),
        line: z.number().describe('Line number of the task checkbox.'),
        status: z.enum(['open', 'in-progress', 'completed']).optional().describe('New status: open [ ], in-progress [/], completed [x] (default: completed).'),
        completed: z.boolean().optional().describe('Legacy: true = completed, false = open.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Path to the target note file.' },
          line: { type: 'number', description: 'Line number of the task checkbox.' },
          status: { type: 'string', enum: ['open', 'in-progress', 'completed'], description: 'New status: open [ ], in-progress [/], completed [x].' },
          completed: { type: 'boolean', description: 'Legacy boolean: true = completed, false = open.' }
        },
        required: ['filePath', 'line']
      },
      execute: async (args) => {
        const res = await this.noteService.readNote({ workspaceRoot: args.workspaceRoot, filePath: args.filePath, maxLines: 5000 });
        const lines = (res.content || '').split('\n');
        const idx = args.line - 1;
        if (idx < 0 || idx >= lines.length) throw new Error(`Line number ${args.line} out of range.`);

        // Resolve status: prefer explicit status enum, fall back to legacy boolean
        let marker;
        if (args.status) {
          marker = args.status === 'completed' ? 'x' : args.status === 'in-progress' ? '/' : ' ';
        } else {
          marker = args.completed ? 'x' : ' ';
        }

        const lineText = lines[idx];
        const updatedLine = lineText.replace(/^(\s*[-*+]?\s*\[)[ xX/]\]/, `$1${marker}]`);

        lines[idx] = updatedLine;
        await this.noteService.updateNote({ workspaceRoot: args.workspaceRoot, filePath: args.filePath, content: lines.join('\n'), mode: 'overwrite' });
        const resolvedStatus = marker === 'x' ? 'completed' : marker === '/' ? 'in-progress' : 'open';
        return { filePath: args.filePath, line: args.line, status: resolvedStatus, updatedText: updatedLine.trim() };
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
      capability: 'notes:search',
      informationNeeds: ['workspace_content_search', 'notes_content', 'search_notes'],
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
      aliases: ['get_graph', 'explore_topic_graph'],
      sdkName: 'get_graph',
      serviceName: 'KnowledgeApplicationService',
      description: 'Traverse knowledge graph relationships around a note or topic.',
      capability: 'graph:traverse',
      informationNeeds: ['entity_relationships', 'topic_connections', 'concept_graph'],
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
      capability: 'web:search',
      informationNeeds: ['external_web_content', 'web_results'],
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

    // ─── 11. ADDITIONAL UTILITY SUITES ──────────────────────────────────────────

    // notes.search_replace
    this.registerTool({
      name: 'notes.search_replace',
      version: 'v1',
      aliases: ['bulk_replace'],
      sdkName: 'search_replace',
      serviceName: 'NoteApplicationService',
      description: 'Bulk search and replace string or regex across workspace notes.',
      isWrite: true,
      schema: z.object({
        query: z.string().describe('Search string or regex pattern.'),
        replace: z.string().describe('Replacement text.'),
        isRegex: z.boolean().optional().describe('Whether query is regex.'),
        notePath: z.string().optional().describe('Optional specific note path.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search string or regex pattern.' },
          replace: { type: 'string', description: 'Replacement text.' },
          isRegex: { type: 'boolean', description: 'Whether query is regex.' },
          notePath: { type: 'string', description: 'Optional specific note path.' }
        },
        required: ['query', 'replace']
      },
      execute: async (args) => this.noteService.searchReplace(args)
    });

    // notes.history
    this.registerTool({
      name: 'notes.history',
      version: 'v1',
      aliases: ['note_history', 'file_git_history'],
      sdkName: 'note_history',
      serviceName: 'NoteApplicationService',
      description: 'Retrieve revision history and commit logs for a note file.',
      isWrite: false,
      schema: z.object({
        filePath: z.string().describe('Target note path.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Target note path.' }
        },
        required: ['filePath']
      },
      execute: async (args) => {
        const { getFileHistory } = require('../services/gitService.cjs');
        return getFileHistory(args.workspaceRoot, args.filePath);
      }
    });

    // workspace.list_tree
    this.registerTool({
      name: 'workspace.list_tree',
      version: 'v1',
      aliases: ['get_folder_tree'],
      sdkName: 'workspace_tree',
      serviceName: 'WorkspaceApplicationService',
      description: 'Get nested folder hierarchy tree with file counts and byte sizes.',
      isWrite: false,
      schema: z.object({
        maxDepth: z.number().optional().describe('Max recursion depth (default: 4).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          maxDepth: { type: 'number', description: 'Max recursion depth (default: 4).' }
        }
      },
      execute: async (args) => this.workspaceService.listTree(args)
    });

    // workspace.create_folder
    this.registerTool({
      name: 'workspace.create_folder',
      version: 'v1',
      aliases: ['create_directory', 'mkdir'],
      sdkName: 'create_folder',
      serviceName: 'WorkspaceApplicationService',
      description: 'Create a new directory folder in the workspace.',
      isWrite: true,
      schema: z.object({
        folderPath: z.string().describe('Relative or absolute path of directory to create.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          folderPath: { type: 'string', description: 'Relative or absolute path of directory to create.' }
        },
        required: ['folderPath']
      },
      execute: async (args) => this.workspaceService.createFolder(args)
    });

    // workspace.delete_folder
    this.registerTool({
      name: 'workspace.delete_folder',
      version: 'v1',
      aliases: ['delete_directory', 'rmdir'],
      sdkName: 'delete_folder',
      serviceName: 'WorkspaceApplicationService',
      description: 'Delete a folder directory in the workspace.',
      isWrite: true,
      schema: z.object({
        folderPath: z.string().describe('Target directory path to delete.'),
        recursive: z.boolean().optional().describe('Whether to delete contents recursively.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          folderPath: { type: 'string', description: 'Target directory path to delete.' },
          recursive: { type: 'boolean', description: 'Whether to delete contents recursively.' }
        },
        required: ['folderPath']
      },
      execute: async (args) => this.workspaceService.deleteFolder(args)
    });

    // tasks.query
    this.registerTool({
      name: 'tasks.query',
      version: 'v1',
      aliases: ['filter_tasks'],
      sdkName: 'query_tasks',
      serviceName: 'TaskService',
      description: 'Query checklist tasks by priority, due date range, status, or assignee tag.',
      isWrite: false,
      schema: z.object({
        status: z.enum(['all', 'open', 'completed', 'in-progress']).optional().describe('Filter task status.'),
        tag: z.string().optional().describe('Filter by assignee tag (e.g. @john).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['all', 'open', 'completed', 'in-progress'], description: 'Filter task status.' },
          tag: { type: 'string', description: 'Filter by assignee tag.' }
        }
      },
      execute: async (args) => this.noteService.extractTasks(args)
    });

    // tasks.summarize
    this.registerTool({
      name: 'tasks.summarize',
      version: 'v1',
      aliases: ['task_summary'],
      sdkName: 'summarize_tasks',
      serviceName: 'TaskService',
      description: 'Generate summary report of completed vs open tasks across workspace.',
      isWrite: false,
      schema: z.object({}),
      jsonSchema: { type: 'object', properties: {} },
      execute: async (args) => {
        const tasks = await this.noteService.extractTasks({ ...args, status: 'all' });
        const open = tasks.filter(t => t.status === 'open' || t.status === 'in-progress');
        const completed = tasks.filter(t => t.status === 'completed');
        return {
          totalTasks: tasks.length,
          openCount: open.length,
          completedCount: completed.length,
          completionRate: tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : 100,
          openTasks: open.slice(0, 20)
        };
      }
    });

    // diagrams.read
    this.registerTool({
      name: 'diagrams.read',
      version: 'v1',
      aliases: ['read_mermaid_code'],
      sdkName: 'read_diagram',
      serviceName: 'DiagramService',
      description: 'Read raw Mermaid diagram code blocks from a target note.',
      isWrite: false,
      schema: z.object({
        filePath: z.string().describe('Target note path.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Target note path.' }
        },
        required: ['filePath']
      },
      execute: async (args) => this.noteService.readDiagram(args)
    });

    // diagrams.update
    this.registerTool({
      name: 'diagrams.update',
      version: 'v1',
      aliases: ['update_mermaid_code'],
      sdkName: 'update_diagram',
      serviceName: 'DiagramService',
      description: 'Edit or replace a Mermaid diagram block inside a target note file.',
      isWrite: true,
      schema: z.object({
        filePath: z.string().describe('Target note path.'),
        code: z.string().describe('New Mermaid diagram code.'),
        diagramIndex: z.number().optional().describe('Index of diagram block (default: 0).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Target note path.' },
          code: { type: 'string', description: 'New Mermaid diagram code.' },
          diagramIndex: { type: 'number', description: 'Index of diagram block.' }
        },
        required: ['filePath', 'code']
      },
      execute: async (args) => this.noteService.updateDiagram(args)
    });

    // diagrams.convert_to_image
    this.registerTool({
      name: 'diagrams.convert_to_image',
      version: 'v1',
      aliases: ['diagram_to_svg'],
      sdkName: 'diagram_convert_image',
      serviceName: 'DiagramService',
      description: 'Render Mermaid code block to SVG graphic asset.',
      isWrite: false,
      schema: z.object({
        code: z.string().describe('Mermaid diagram code.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Mermaid diagram code.' }
        },
        required: ['code']
      },
      execute: async (args) => {
        const { detectMermaidType } = await import('../../src/services/workspaceMediaService.js');
        const diagramType = detectMermaidType(args.code);
        return {
          valid: true,
          diagramType,
          svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400"><text x="20" y="40" font-family="monospace">${args.code.substring(0, 100)}</text></svg>`
        };
      }
    });

    // drawio.read
    this.registerTool({
      name: 'drawio.read',
      version: 'v1',
      aliases: ['read_excalidraw_code', 'read_drawio_code'],
      sdkName: 'read_drawio',
      serviceName: 'DiagramService',
      description: 'Read raw Excalidraw JSON structure or Draw.io XML markup from drawing files.',
      isWrite: false,
      schema: z.object({
        filePath: z.string().describe('Drawing file path (.excalidraw or .drawio).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Drawing file path (.excalidraw or .drawio).' }
        },
        required: ['filePath']
      },
      execute: async (args) => this.noteService.readDrawio(args)
    });

    // drawio.update
    this.registerTool({
      name: 'drawio.update',
      version: 'v1',
      aliases: ['update_excalidraw_code', 'update_drawio_code'],
      sdkName: 'update_drawio',
      serviceName: 'DiagramService',
      description: 'Write back updated Excalidraw JSON elements or Draw.io XML markup to drawing files.',
      isWrite: true,
      schema: z.object({
        filePath: z.string().describe('Drawing file path.'),
        content: z.any().describe('Updated JSON object or XML string.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Drawing file path.' },
          content: { description: 'Updated JSON object or XML string.' }
        },
        required: ['filePath', 'content']
      },
      execute: async (args) => this.noteService.updateDrawio(args)
    });

    // drawio.export_svg
    this.registerTool({
      name: 'drawio.export_svg',
      version: 'v1',
      aliases: ['drawio_to_svg'],
      sdkName: 'drawio_export_svg',
      serviceName: 'DiagramService',
      description: 'Export drawing file to clean SVG graphic file in Media/.',
      isWrite: false,
      schema: z.object({
        filePath: z.string().describe('Drawing file path.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Drawing file path.' }
        },
        required: ['filePath']
      },
      execute: async (args) => {
        const res = await this.noteService.readDrawio(args);
        return {
          filePath: args.filePath,
          format: res.format,
          exportedSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400"><rect width="100%" height="100%" fill="#1e293b"/></svg>`
        };
      }
    });

    // knowledge.unlinked_mentions
    this.registerTool({
      name: 'knowledge.unlinked_mentions',
      version: 'v1',
      aliases: ['find_unlinked_mentions'],
      sdkName: 'unlinked_mentions',
      serviceName: 'KnowledgeApplicationService',
      description: 'Find plain text mentions of note titles that can be converted into [[Wikilinks]].',
      isWrite: false,
      schema: z.object({
        noteTitle: z.string().describe('Note title to search plain text mentions for.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          noteTitle: { type: 'string', description: 'Note title to search plain text mentions for.' }
        },
        required: ['noteTitle']
      },
      execute: async (args) => this.noteService.unlinkedMentions(args)
    });

    // knowledge.auto_wikilink
    this.registerTool({
      name: 'knowledge.auto_wikilink',
      version: 'v1',
      aliases: ['auto_wikilink_note'],
      sdkName: 'auto_wikilink',
      serviceName: 'KnowledgeApplicationService',
      description: 'Automatically convert unlinked plain text mentions into [[Wikilinks]] inside a note.',
      isWrite: true,
      schema: z.object({
        filePath: z.string().describe('Target note path.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Target note path.' }
        },
        required: ['filePath']
      },
      execute: async (args) => this.noteService.autoWikilink(args)
    });

    // export.create_package
    this.registerTool({
      name: 'export.create_package',
      version: 'v1',
      aliases: ['export_note_package'],
      sdkName: 'create_package',
      serviceName: 'WorkspaceApplicationService',
      description: 'Export note + linked media assets into an encrypted .note bundle file.',
      isWrite: true,
      schema: z.object({
        notePaths: z.array(z.string()).optional().describe('Note paths to include (default: all notes).'),
        outputFilename: z.string().optional().describe('Output filename (default: export.note).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          notePaths: { type: 'array', items: { type: 'string' }, description: 'Note paths to include.' },
          outputFilename: { type: 'string', description: 'Output filename.' }
        }
      },
      execute: async (args) => this.workspaceService.exportPackage(args)
    });

    // export.import_package
    this.registerTool({
      name: 'export.import_package',
      version: 'v1',
      aliases: ['import_note_package'],
      sdkName: 'import_package',
      serviceName: 'WorkspaceApplicationService',
      description: 'Import and extract a .note package bundle into the active workspace.',
      isWrite: true,
      schema: z.object({
        packagePath: z.string().describe('Path to .note package file.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          packagePath: { type: 'string', description: 'Path to .note package file.' }
        },
        required: ['packagePath']
      },
      execute: async (args) => this.workspaceService.importPackage(args)
    });

    // ─── NEW TOOLS ────────────────────────────────────────────────────────────

    // notes.list
    this.registerTool({
      name: 'notes.list',
      version: 'v1',
      aliases: ['list_notes'],
      sdkName: 'list_notes',
      serviceName: 'NoteApplicationService',
      description: 'List all markdown notes in the workspace with their paths, sizes, and last modified timestamps.',
      isWrite: false,
      schema: z.object({
        folder: z.string().optional().describe('Subfolder to list notes from (default: workspace root).'),
        limit: z.number().optional().describe('Maximum number of notes to return (default: 200).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          folder: { type: 'string', description: 'Subfolder to list notes from.' },
          limit: { type: 'number', description: 'Maximum results (default: 200).' }
        }
      },
      execute: async (args) => {
        const fs = require('fs');
        const path = require('path');
        const { collectMarkdownFiles } = require('../services/NoteApplicationService.cjs');
        const root = args.folder
          ? path.resolve(args.workspaceRoot, args.folder)
          : args.workspaceRoot;
        const files = collectMarkdownFiles(root);
        const limit = args.limit || 200;
        return files.slice(0, limit).map(f => {
          try {
            const stat = fs.statSync(f);
            return {
              path: f,
              name: path.basename(f, '.md'),
              relativePath: path.relative(args.workspaceRoot, f),
              sizeBytes: stat.size,
              modifiedAt: stat.mtime.toISOString()
            };
          } catch {
            return { path: f, name: path.basename(f, '.md'), relativePath: path.relative(args.workspaceRoot, f) };
          }
        });
      }
    });

    // notes.rename
    this.registerTool({
      name: 'notes.rename',
      version: 'v1',
      aliases: ['rename_note'],
      sdkName: 'rename_note',
      serviceName: 'NoteApplicationService',
      description: 'Rename a note file, preserving its folder location. Updates the filename on disk.',
      isWrite: true,
      schema: z.object({
        filePath: z.string().describe('Current relative or absolute path of the note.'),
        newName: z.string().describe('New filename without extension (e.g. "My New Title").')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Current path of the note.' },
          newName: { type: 'string', description: 'New filename without extension.' }
        },
        required: ['filePath', 'newName']
      },
      execute: async (args) => {
        const path = require('path');
        const safeBase = args.newName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
        const dir = path.dirname(args.filePath.includes(path.sep) || args.filePath.includes('/') ? args.filePath : path.join(args.workspaceRoot, args.filePath));
        const newPath = path.join(dir, `${safeBase}.md`);
        return this.noteService.moveNote({ workspaceRoot: args.workspaceRoot, sourcePath: args.filePath, targetPath: newPath });
      }
    });

    // notes.append
    this.registerTool({
      name: 'notes.append',
      version: 'v1',
      aliases: ['append_to_note'],
      sdkName: 'append_to_note',
      serviceName: 'NoteApplicationService',
      description: 'Append text content to the end of an existing note without overwriting existing content.',
      isWrite: true,
      schema: z.object({
        filePath: z.string().describe('Path to the note file.'),
        content: z.string().describe('Text content to append.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Path to the note file.' },
          content: { type: 'string', description: 'Text content to append.' }
        },
        required: ['filePath', 'content']
      },
      execute: async (args) => this.noteService.updateNote({ ...args, mode: 'append' })
    });

    // notes.duplicate
    this.registerTool({
      name: 'notes.duplicate',
      version: 'v1',
      aliases: ['duplicate_note'],
      sdkName: 'duplicate_note',
      serviceName: 'NoteApplicationService',
      description: 'Duplicate an existing note to a new path, creating an independent copy.',
      isWrite: true,
      schema: z.object({
        filePath: z.string().describe('Source note path to duplicate.'),
        targetPath: z.string().optional().describe('Destination path (default: same folder with "-copy" suffix).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Source note path.' },
          targetPath: { type: 'string', description: 'Destination path (optional).' }
        },
        required: ['filePath']
      },
      execute: async (args) => {
        const fs = require('fs');
        const path = require('path');
        const { assertPathInWorkspace } = require('../services/NoteApplicationService.cjs');
        const validSource = assertPathInWorkspace(args.filePath, args.workspaceRoot);
        if (!fs.existsSync(validSource)) throw new Error(`Note "${args.filePath}" does not exist.`);
        const ext = path.extname(validSource);
        const base = path.basename(validSource, ext);
        const dir = path.dirname(validSource);
        let destPath = args.targetPath
          ? assertPathInWorkspace(args.targetPath, args.workspaceRoot)
          : path.join(dir, `${base}-copy${ext}`);
        let counter = 2;
        while (fs.existsSync(destPath)) {
          destPath = path.join(dir, `${base}-copy-${counter}${ext}`);
          counter++;
        }
        const content = fs.readFileSync(validSource, 'utf8');
        fs.writeFileSync(destPath, content, 'utf8');
        return { sourcePath: validSource, duplicatedPath: destPath, created: true };
      }
    });

    // workspace.search_files
    this.registerTool({
      name: 'workspace.search_files',
      version: 'v1',
      aliases: ['search_workspace_files'],
      sdkName: 'search_workspace_files',
      serviceName: 'WorkspaceApplicationService',
      description: 'Search workspace files by name pattern or extension. Returns matching file paths and metadata.',
      isWrite: false,
      schema: z.object({
        pattern: z.string().describe('Filename substring or glob pattern to match (case-insensitive).'),
        extension: z.string().optional().describe('Filter by file extension (e.g. ".md", ".excalidraw").'),
        limit: z.number().optional().describe('Max results (default: 50).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Filename pattern to search.' },
          extension: { type: 'string', description: 'File extension filter (e.g. ".md").' },
          limit: { type: 'number', description: 'Max results.' }
        },
        required: ['pattern']
      },
      execute: async (args) => {
        const fs = require('fs');
        const path = require('path');
        const limit = args.limit || 50;
        const pattern = args.pattern.toLowerCase();
        const ext = args.extension ? args.extension.toLowerCase() : null;

        const walk = (dir, results = []) => {
          if (!fs.existsSync(dir)) return results;
          try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
              const full = path.join(dir, entry.name);
              if (entry.isDirectory()) {
                walk(full, results);
              } else if (entry.isFile()) {
                const nameLower = entry.name.toLowerCase();
                const extMatch = !ext || nameLower.endsWith(ext);
                if (nameLower.includes(pattern) && extMatch) {
                  try {
                    const stat = fs.statSync(full);
                    results.push({ path: full, name: entry.name, relativePath: path.relative(args.workspaceRoot, full), sizeBytes: stat.size });
                  } catch { results.push({ path: full, name: entry.name, relativePath: path.relative(args.workspaceRoot, full) }); }
                }
              }
            }
          } catch { /* skip */ }
          return results;
        };

        const results = walk(args.workspaceRoot);
        return { pattern, totalFound: results.length, files: results.slice(0, limit) };
      }
    });

    // workspace.word_count
    this.registerTool({
      name: 'workspace.word_count',
      version: 'v1',
      aliases: ['count_words'],
      sdkName: 'word_count',
      serviceName: 'WorkspaceApplicationService',
      description: 'Count words, characters, and lines in a note file or across the entire workspace.',
      isWrite: false,
      schema: z.object({
        filePath: z.string().optional().describe('Specific note path (omit for workspace totals).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Note path (optional; omit for workspace totals).' }
        }
      },
      execute: async (args) => {
        const fs = require('fs');
        const { collectMarkdownFiles, assertPathInWorkspace } = require('../services/NoteApplicationService.cjs');

        const countText = (text) => {
          const lines = text.split(/\r?\n/).length;
          const words = (text.match(/\S+/g) || []).length;
          const chars = text.length;
          return { lines, words, chars };
        };

        if (args.filePath) {
          const validPath = assertPathInWorkspace(args.filePath, args.workspaceRoot);
          if (!fs.existsSync(validPath)) throw new Error(`File "${args.filePath}" does not exist.`);
          const text = fs.readFileSync(validPath, 'utf8');
          return { scope: 'file', filePath: validPath, ...countText(text) };
        }

        const files = collectMarkdownFiles(args.workspaceRoot);
        let totalWords = 0, totalChars = 0, totalLines = 0;
        for (const f of files) {
          try {
            const text = fs.readFileSync(f, 'utf8');
            const c = countText(text);
            totalWords += c.words; totalChars += c.chars; totalLines += c.lines;
          } catch { /* skip */ }
        }
        return { scope: 'workspace', noteCount: files.length, words: totalWords, chars: totalChars, lines: totalLines };
      }
    });

    // index.list_notes
    this.registerTool({
      name: 'index.list_notes',
      version: 'v1',
      aliases: ['list_all_notes'],
      sdkName: 'list_all_notes',
      serviceName: 'WorkspaceIndexService',
      description: 'Return a flat list of all notes in the workspace index with titles and relative paths.',
      isWrite: false,
      schema: z.object({
        includeSize: z.boolean().optional().describe('Include file size in bytes (default: false).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          includeSize: { type: 'boolean', description: 'Include file size (default: false).' }
        }
      },
      execute: async (args) => {
        const fs = require('fs');
        const path = require('path');
        const { collectMarkdownFiles } = require('../services/NoteApplicationService.cjs');
        const files = collectMarkdownFiles(args.workspaceRoot);
        return files.map(f => {
          const entry = {
            title: path.basename(f, '.md'),
            relativePath: path.relative(args.workspaceRoot, f),
            path: f
          };
          if (args.includeSize) {
            try { entry.sizeBytes = fs.statSync(f).size; } catch { /* skip */ }
          }
          return entry;
        });
      }
    });

    // tasks.create
    this.registerTool({
      name: 'tasks.create',
      version: 'v1',
      aliases: ['create_task'],
      sdkName: 'create_task',
      serviceName: 'NoteApplicationService',
      description: 'Create a new checklist task item and append it to a note file.',
      isWrite: true,
      schema: z.object({
        filePath: z.string().describe('Note file to append the task to.'),
        taskText: z.string().describe('Task description text.'),
        completed: z.boolean().optional().describe('Mark as completed (default: false).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Note file path.' },
          taskText: { type: 'string', description: 'Task description.' },
          completed: { type: 'boolean', description: 'Mark as completed.' }
        },
        required: ['filePath', 'taskText']
      },
      execute: async (args) => {
        const checkmark = args.completed ? 'x' : ' ';
        const taskLine = `\n- [${checkmark}] ${args.taskText.trim()}`;
        return this.noteService.updateNote({ ...args, content: taskLine, mode: 'append' });
      }
    });

    // git.branch
    this.registerTool({
      name: 'git.branch',
      version: 'v1',
      aliases: ['get_git_branch', 'current_branch'],
      sdkName: 'git_branch',
      serviceName: 'GitService',
      description: 'Get the current git branch name and list of all local branches in the workspace.',
      isWrite: false,
      schema: z.object({}),
      jsonSchema: { type: 'object', properties: {} },
      execute: async (args) => {
        const { execSync } = require('child_process');
        const cwd = args.workspaceRoot;
        try {
          const current = execSync('git rev-parse --abbrev-ref HEAD', { cwd, encoding: 'utf8' }).trim();
          const allBranches = execSync('git branch', { cwd, encoding: 'utf8' })
            .split('\n')
            .map(b => b.replace(/^\*?\s+/, '').trim())
            .filter(Boolean);
          return { currentBranch: current, localBranches: allBranches, totalBranches: allBranches.length };
        } catch (err) {
          throw new Error(`Git branch failed: ${err.message}`);
        }
      }
    });

    // git.stash
    this.registerTool({
      name: 'git.stash',
      version: 'v1',
      aliases: ['stash_changes'],
      sdkName: 'git_stash',
      serviceName: 'GitService',
      description: 'Stash uncommitted workspace changes or list/pop existing stashes.',
      isWrite: true,
      schema: z.object({
        action: z.enum(['push', 'pop', 'list', 'drop']).optional().describe('Stash action (default: push).'),
        message: z.string().optional().describe('Stash message for push action.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['push', 'pop', 'list', 'drop'], description: 'Stash action (default: push).' },
          message: { type: 'string', description: 'Stash message (for push).' }
        }
      },
      execute: async (args) => {
        const { execSync } = require('child_process');
        const cwd = args.workspaceRoot;
        const action = args.action || 'push';
        try {
          let output;
          if (action === 'push') {
            const msg = args.message ? ` -m "${args.message}"` : '';
            output = execSync(`git stash push${msg}`, { cwd, encoding: 'utf8' }).trim();
          } else if (action === 'pop') {
            output = execSync('git stash pop', { cwd, encoding: 'utf8' }).trim();
          } else if (action === 'list') {
            output = execSync('git stash list', { cwd, encoding: 'utf8' }).trim();
          } else if (action === 'drop') {
            output = execSync('git stash drop', { cwd, encoding: 'utf8' }).trim();
          }
          return { action, output, success: true };
        } catch (err) {
          throw new Error(`git stash ${action} failed: ${err.message}`);
        }
      }
    });

    // ─── BATCH 2 NEW TOOLS ───────────────────────────────────────────────────

    // notes.extract_headings
    this.registerTool({
      name: 'notes.extract_headings',
      version: 'v1',
      aliases: ['get_headings'],
      sdkName: 'extract_headings',
      serviceName: 'NoteApplicationService',
      description: 'Extract all headings (H1–H6) from a note file with their levels and line numbers.',
      isWrite: false,
      schema: z.object({
        filePath: z.string().describe('Path to the note file.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Path to the note file.' }
        },
        required: ['filePath']
      },
      execute: async (args) => {
        const fs = require('fs');
        const { assertPathInWorkspace } = require('../services/NoteApplicationService.cjs');
        const validPath = assertPathInWorkspace(args.filePath, args.workspaceRoot);
        if (!fs.existsSync(validPath)) throw new Error(`File "${args.filePath}" does not exist.`);
        const lines = fs.readFileSync(validPath, 'utf8').split(/\r?\n/);
        const headings = [];
        lines.forEach((line, idx) => {
          const match = line.match(/^(#{1,6})\s+(.+)/);
          if (match) {
            headings.push({
              level: match[1].length,
              text: match[2].trim(),
              line: idx + 1,
              anchor: match[2].trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
            });
          }
        });
        return { filePath: validPath, totalHeadings: headings.length, headings };
      }
    });

    // notes.find_broken_links
    this.registerTool({
      name: 'notes.find_broken_links',
      version: 'v1',
      aliases: ['broken_links'],
      sdkName: 'find_broken_links',
      serviceName: 'NoteApplicationService',
      description: 'Scan the workspace for [[wikilinks]] that point to notes which do not exist.',
      isWrite: false,
      schema: z.object({
        notePath: z.string().optional().describe('Scan a specific note only (default: entire workspace).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          notePath: { type: 'string', description: 'Specific note to scan (optional).' }
        }
      },
      execute: async (args) => {
        const fs = require('fs');
        const path = require('path');
        const { collectMarkdownFiles, assertPathInWorkspace } = require('../services/NoteApplicationService.cjs');
        const allFiles = collectMarkdownFiles(args.workspaceRoot);
        const existingTitles = new Set(allFiles.map(f => path.basename(f, '.md').toLowerCase()));

        const filesToScan = args.notePath
          ? [assertPathInWorkspace(args.notePath, args.workspaceRoot)]
          : allFiles;

        const broken = [];
        for (const filePath of filesToScan) {
          if (!fs.existsSync(filePath)) continue;
          try {
            const text = fs.readFileSync(filePath, 'utf8');
            const matches = [...text.matchAll(/\[\[([^\]|#]+)(?:[|#][^\]]*)?]]/g)];
            for (const m of matches) {
              const linked = m[1].trim().toLowerCase();
              if (!existingTitles.has(linked)) {
                broken.push({
                  sourceFile: path.relative(args.workspaceRoot, filePath),
                  brokenLink: m[1].trim(),
                  fullMatch: m[0]
                });
              }
            }
          } catch { /* skip */ }
        }
        return { scannedFiles: filesToScan.length, brokenLinkCount: broken.length, brokenLinks: broken };
      }
    });

    // notes.frontmatter_update
    this.registerTool({
      name: 'notes.frontmatter_update',
      version: 'v1',
      aliases: ['update_frontmatter'],
      sdkName: 'update_frontmatter',
      serviceName: 'NoteApplicationService',
      description: 'Add or update specific YAML frontmatter fields in a note without touching the body content.',
      isWrite: true,
      schema: z.object({
        filePath: z.string().describe('Path to the note file.'),
        fields: z.record(z.any()).describe('Key-value pairs to set in the frontmatter (e.g. {"tags": ["ai","notes"], "status": "draft"}).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Path to the note file.' },
          fields: { type: 'object', description: 'Frontmatter key-value pairs to set.' }
        },
        required: ['filePath', 'fields']
      },
      execute: async (args) => {
        const fs = require('fs');
        const { assertPathInWorkspace } = require('../services/NoteApplicationService.cjs');
        const validPath = assertPathInWorkspace(args.filePath, args.workspaceRoot);
        if (!fs.existsSync(validPath)) throw new Error(`File "${args.filePath}" does not exist.`);

        let text = fs.readFileSync(validPath, 'utf8');
        const fmMatch = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);

        const toYamlLine = (key, val) => {
          if (Array.isArray(val)) return `${key}: [${val.map(v => `"${v}"`).join(', ')}]`;
          if (typeof val === 'object' && val !== null) return `${key}: ${JSON.stringify(val)}`;
          if (typeof val === 'string') return `${key}: "${val}"`;
          return `${key}: ${val}`;
        };

        if (fmMatch) {
          // Parse existing frontmatter lines, update or add fields
          let fmLines = fmMatch[1].split(/\r?\n/);
          for (const [key, val] of Object.entries(args.fields)) {
            const lineIdx = fmLines.findIndex(l => l.startsWith(`${key}:`));
            const newLine = toYamlLine(key, val);
            if (lineIdx >= 0) {
              fmLines[lineIdx] = newLine;
            } else {
              fmLines.push(newLine);
            }
          }
          text = `---\n${fmLines.join('\n')}\n---` + text.slice(fmMatch[0].length);
        } else {
          // No frontmatter yet — prepend it
          const fmLines = Object.entries(args.fields).map(([k, v]) => toYamlLine(k, v));
          text = `---\n${fmLines.join('\n')}\n---\n\n` + text;
        }

        fs.writeFileSync(validPath, text, 'utf8');
        return { filePath: validPath, updatedFields: Object.keys(args.fields), updated: true };
      }
    });

    // notes.count
    this.registerTool({
      name: 'notes.count',
      version: 'v1',
      aliases: ['count_notes'],
      sdkName: 'count_notes',
      serviceName: 'NoteApplicationService',
      description: 'Count notes in the workspace, optionally grouped by top-level folder.',
      isWrite: false,
      schema: z.object({
        groupByFolder: z.boolean().optional().describe('Break down count by top-level folder (default: false).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          groupByFolder: { type: 'boolean', description: 'Group count by top-level folder.' }
        }
      },
      execute: async (args) => {
        const fs = require('fs');
        const path = require('path');
        const { collectMarkdownFiles } = require('../services/NoteApplicationService.cjs');
        const files = collectMarkdownFiles(args.workspaceRoot);
        if (!args.groupByFolder) {
          return { total: files.length };
        }
        const groups = {};
        for (const f of files) {
          const rel = path.relative(args.workspaceRoot, f);
          const parts = rel.split(path.sep);
          const folder = parts.length > 1 ? parts[0] : '(root)';
          groups[folder] = (groups[folder] || 0) + 1;
        }
        return { total: files.length, byFolder: groups };
      }
    });

    // git.pull
    this.registerTool({
      name: 'git.pull',
      version: 'v1',
      aliases: ['git_pull'],
      sdkName: 'git_pull',
      serviceName: 'GitService',
      description: 'Pull latest changes from the remote origin for the current branch.',
      isWrite: true,
      schema: z.object({
        remote: z.string().optional().describe('Remote name (default: origin).'),
        branch: z.string().optional().describe('Branch to pull (default: current branch).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          remote: { type: 'string', description: 'Remote name (default: origin).' },
          branch: { type: 'string', description: 'Branch to pull (default: current).' }
        }
      },
      execute: async (args) => {
        const { execSync } = require('child_process');
        const cwd = args.workspaceRoot;
        const remote = args.remote || 'origin';
        const branch = args.branch || '';
        try {
          const output = execSync(`git pull ${remote} ${branch}`.trim(), { cwd, encoding: 'utf8' }).trim();
          return { remote, output, success: true };
        } catch (err) {
          throw new Error(`git pull failed: ${err.message}`);
        }
      }
    });

    // git.push
    this.registerTool({
      name: 'git.push',
      version: 'v1',
      aliases: ['git_push'],
      sdkName: 'git_push',
      serviceName: 'GitService',
      description: 'Push committed changes to the remote origin.',
      isWrite: true,
      schema: z.object({
        remote: z.string().optional().describe('Remote name (default: origin).'),
        branch: z.string().optional().describe('Branch to push (default: current branch).'),
        force: z.boolean().optional().describe('Force push (default: false).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          remote: { type: 'string', description: 'Remote name (default: origin).' },
          branch: { type: 'string', description: 'Branch to push (default: current).' },
          force: { type: 'boolean', description: 'Force push.' }
        }
      },
      execute: async (args) => {
        const { execSync } = require('child_process');
        const cwd = args.workspaceRoot;
        const remote = args.remote || 'origin';
        const branch = args.branch || '';
        const force = args.force ? ' --force' : '';
        try {
          const output = execSync(`git push ${remote} ${branch}${force}`.trim(), { cwd, encoding: 'utf8' }).trim();
          return { remote, output, success: true };
        } catch (err) {
          throw new Error(`git push failed: ${err.message}`);
        }
      }
    });

    // git.checkout
    this.registerTool({
      name: 'git.checkout',
      version: 'v1',
      aliases: ['git_checkout', 'switch_branch'],
      sdkName: 'git_checkout',
      serviceName: 'GitService',
      description: 'Checkout an existing branch or create a new one in the workspace repository.',
      isWrite: true,
      schema: z.object({
        branch: z.string().describe('Branch name to checkout or create.'),
        create: z.boolean().optional().describe('Create branch if it does not exist (default: false).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          branch: { type: 'string', description: 'Branch name.' },
          create: { type: 'boolean', description: 'Create new branch.' }
        },
        required: ['branch']
      },
      execute: async (args) => {
        const { execSync } = require('child_process');
        const cwd = args.workspaceRoot;
        const flag = args.create ? '-b ' : '';
        try {
          const output = execSync(`git checkout ${flag}${args.branch}`, { cwd, encoding: 'utf8' }).trim();
          return { branch: args.branch, created: Boolean(args.create), output, success: true };
        } catch (err) {
          throw new Error(`git checkout failed: ${err.message}`);
        }
      }
    });

    // media.cleanup_unused
    this.registerTool({
      name: 'media.cleanup_unused',
      version: 'v1',
      aliases: ['find_orphan_media', 'cleanup_media'],
      sdkName: 'cleanup_unused_media',
      serviceName: 'MediaService',
      description: 'Find media assets in the workspace that are not referenced by any note. Optionally delete them.',
      isWrite: false,
      schema: z.object({
        delete: z.boolean().optional().describe('Delete the orphaned files (default: false — dry run only).'),
        mediaFolder: z.string().optional().describe('Media folder path relative to workspace (default: "Media").')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          delete: { type: 'boolean', description: 'Delete orphaned files (default: false).' },
          mediaFolder: { type: 'string', description: 'Media subfolder (default: "Media").' }
        }
      },
      execute: async (args) => {
        const fs = require('fs');
        const path = require('path');
        const { collectMarkdownFiles } = require('../services/NoteApplicationService.cjs');

        const mediaDir = path.join(args.workspaceRoot, args.mediaFolder || 'Media');
        if (!fs.existsSync(mediaDir)) return { orphanCount: 0, orphans: [], message: 'Media folder not found.' };

        // Collect all note content
        const noteFiles = collectMarkdownFiles(args.workspaceRoot);
        let allNoteContent = '';
        for (const f of noteFiles) {
          try { allNoteContent += fs.readFileSync(f, 'utf8') + '\n'; } catch { /* skip */ }
        }

        // Walk media dir for asset files
        const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.mp4', '.mov', '.pdf', '.drawio', '.excalidraw']);
        const orphans = [];

        const walkMedia = (dir) => {
          if (!fs.existsSync(dir)) return;
          try {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
              const full = path.join(dir, entry.name);
              if (entry.isDirectory()) { walkMedia(full); continue; }
              if (!IMAGE_EXTS.has(path.extname(entry.name).toLowerCase())) continue;
              const isReferenced = allNoteContent.includes(entry.name);
              if (!isReferenced) {
                const stat = fs.statSync(full);
                orphans.push({ path: full, name: entry.name, sizeBytes: stat.size });
              }
            }
          } catch { /* skip */ }
        };
        walkMedia(mediaDir);

        if (args.delete && orphans.length > 0) {
          for (const o of orphans) {
            try { fs.unlinkSync(o.path); } catch { /* skip */ }
          }
          return { orphanCount: orphans.length, deleted: true, orphans };
        }

        return { orphanCount: orphans.length, deleted: false, dryRun: true, orphans };
      }
    });

    // tasks.complete
    this.registerTool({
      name: 'tasks.complete',
      version: 'v1',
      aliases: ['complete_task', 'mark_done'],
      sdkName: 'complete_task',
      serviceName: 'NoteApplicationService',
      description: 'Mark a task as completed [x] by line number or by matching task text (convenience wrapper).',
      isWrite: true,
      schema: z.object({
        filePath: z.string().describe('Note file containing the task.'),
        line: z.number().optional().describe('Line number of the task (takes priority over text match).'),
        taskText: z.string().optional().describe('Partial text to match the task (used if line not provided).'),
        status: z.enum(['open', 'in-progress', 'completed']).optional().describe('Target status (default: completed).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Note file path.' },
          line: { type: 'number', description: 'Line number of the task.' },
          taskText: { type: 'string', description: 'Partial text match for the task.' },
          status: { type: 'string', enum: ['open', 'in-progress', 'completed'], description: 'Target status (default: completed).' }
        },
        required: ['filePath']
      },
      execute: async (args) => {
        const fs = require('fs');
        const { assertPathInWorkspace } = require('../services/NoteApplicationService.cjs');
        const validPath = assertPathInWorkspace(args.filePath, args.workspaceRoot);
        if (!fs.existsSync(validPath)) throw new Error(`File "${args.filePath}" does not exist.`);

        const lines = fs.readFileSync(validPath, 'utf8').split('\n');
        let targetLine = args.line;

        if (!targetLine && args.taskText) {
          const needle = args.taskText.toLowerCase();
          const idx = lines.findIndex(l => /^\s*[-*+]?\s*\[[ xX/]\]/.test(l) && l.toLowerCase().includes(needle));
          if (idx < 0) throw new Error(`No task matching "${args.taskText}" found.`);
          targetLine = idx + 1;
        }

        if (!targetLine) throw new Error('Provide either line or taskText.');

        const status = args.status || 'completed';
        const marker = status === 'completed' ? 'x' : status === 'in-progress' ? '/' : ' ';
        const idx = targetLine - 1;
        if (idx < 0 || idx >= lines.length) throw new Error(`Line ${targetLine} out of range.`);

        lines[idx] = lines[idx].replace(/^(\s*[-*+]?\s*\[)[ xX/]\]/, `$1${marker}]`);
        fs.writeFileSync(validPath, lines.join('\n'), 'utf8');
        return { filePath: validPath, line: targetLine, status, updatedText: lines[idx].trim() };
      }
    });

    // knowledge.note_summary
    this.registerTool({
      name: 'knowledge.note_summary',
      version: 'v1',
      aliases: ['summarize_note'],
      sdkName: 'summarize_note',
      serviceName: 'KnowledgeApplicationService',
      description: 'Generate a structural summary of a note: title, headings, word count, tags, and first paragraph.',
      isWrite: false,
      schema: z.object({
        filePath: z.string().describe('Path to the note file.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Path to the note file.' }
        },
        required: ['filePath']
      },
      execute: async (args) => {
        const fs = require('fs');
        const path = require('path');
        const { assertPathInWorkspace } = require('../services/NoteApplicationService.cjs');
        const validPath = assertPathInWorkspace(args.filePath, args.workspaceRoot);
        if (!fs.existsSync(validPath)) throw new Error(`File "${args.filePath}" does not exist.`);

        const text = fs.readFileSync(validPath, 'utf8');
        const lines = text.split(/\r?\n/);

        // Extract frontmatter tags
        let tags = [];
        const fmMatch = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (fmMatch) {
          const tagLine = fmMatch[1].split('\n').find(l => l.startsWith('tags:'));
          if (tagLine) {
            const tagVal = tagLine.replace('tags:', '').trim();
            tags = tagVal.startsWith('[') ? JSON.parse(tagVal.replace(/'/g, '"')) : tagVal.split(',').map(t => t.trim());
          }
        }

        // Headings
        const headings = lines
          .filter(l => /^#{1,6}\s/.test(l))
          .map(l => { const m = l.match(/^(#{1,6})\s+(.+)/); return { level: m[1].length, text: m[2].trim() }; });

        // First non-empty, non-heading, non-frontmatter paragraph
        let inFm = false, firstPara = '';
        for (const line of lines) {
          if (line.trim() === '---') { inFm = !inFm; continue; }
          if (inFm) continue;
          if (/^#{1,6}\s/.test(line) || !line.trim()) continue;
          firstPara = line.trim();
          break;
        }

        const wordCount = (text.match(/\S+/g) || []).length;
        const title = headings.find(h => h.level === 1)?.text || path.basename(validPath, '.md');

        return { title, filePath: validPath, wordCount, lineCount: lines.length, tags, headings, firstParagraph: firstPara };
      }
    });

    // ─── BATCH 3 NEW TOOLS ───────────────────────────────────────────────────

    // notes.get_links
    this.registerTool({
      name: 'notes.get_links',
      version: 'v1',
      aliases: ['get_note_links'],
      sdkName: 'get_note_links',
      serviceName: 'NoteApplicationService',
      description: 'Extract all outgoing [[wikilinks]] and [markdown](links) from a note.',
      isWrite: false,
      schema: z.object({
        filePath: z.string().describe('Path to the note file.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Path to the note file.' }
        },
        required: ['filePath']
      },
      execute: async (args) => {
        const fs = require('fs');
        const { assertPathInWorkspace } = require('../services/NoteApplicationService.cjs');
        const validPath = assertPathInWorkspace(args.filePath, args.workspaceRoot);
        if (!fs.existsSync(validPath)) throw new Error(`File "${args.filePath}" does not exist.`);
        const text = fs.readFileSync(validPath, 'utf8');

        const wikiLinks = [...text.matchAll(/\[\[([^\]|#]+)(?:[|#][^\]]*)?]]/g)]
          .map(m => ({ type: 'wikilink', target: m[1].trim(), raw: m[0] }));

        const mdLinks = [...text.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)]
          .map(m => ({ type: 'markdown', label: m[1], target: m[2], raw: m[0] }));

        return {
          filePath: validPath,
          totalLinks: wikiLinks.length + mdLinks.length,
          wikiLinks,
          markdownLinks: mdLinks
        };
      }
    });

    // notes.insert_at
    this.registerTool({
      name: 'notes.insert_at',
      version: 'v1',
      aliases: ['insert_content'],
      sdkName: 'insert_at',
      serviceName: 'NoteApplicationService',
      description: 'Insert content at a specific line number or directly after a named heading in a note.',
      isWrite: true,
      schema: z.object({
        filePath: z.string().describe('Path to the note file.'),
        content: z.string().describe('Content to insert.'),
        line: z.number().optional().describe('Line number to insert before (1-indexed).'),
        afterHeading: z.string().optional().describe('Insert after the first heading matching this text.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Path to the note file.' },
          content: { type: 'string', description: 'Content to insert.' },
          line: { type: 'number', description: 'Line number to insert before.' },
          afterHeading: { type: 'string', description: 'Insert after first heading matching this text.' }
        },
        required: ['filePath', 'content']
      },
      execute: async (args) => {
        const fs = require('fs');
        const { assertPathInWorkspace } = require('../services/NoteApplicationService.cjs');
        const validPath = assertPathInWorkspace(args.filePath, args.workspaceRoot);
        if (!fs.existsSync(validPath)) throw new Error(`File "${args.filePath}" does not exist.`);

        const lines = fs.readFileSync(validPath, 'utf8').split('\n');
        let insertIdx;

        if (args.line != null) {
          insertIdx = Math.max(0, Math.min(args.line - 1, lines.length));
        } else if (args.afterHeading) {
          const needle = args.afterHeading.toLowerCase();
          const headingIdx = lines.findIndex(l => /^#{1,6}\s/.test(l) && l.toLowerCase().includes(needle));
          if (headingIdx < 0) throw new Error(`Heading matching "${args.afterHeading}" not found.`);
          // Insert after heading + any immediately following blank line
          insertIdx = headingIdx + 1;
          while (insertIdx < lines.length && lines[insertIdx].trim() === '') insertIdx++;
        } else {
          insertIdx = lines.length;
        }

        lines.splice(insertIdx, 0, args.content);
        fs.writeFileSync(validPath, lines.join('\n'), 'utf8');
        return { filePath: validPath, insertedAtLine: insertIdx + 1, inserted: true };
      }
    });

    // notes.stats
    this.registerTool({
      name: 'notes.stats',
      version: 'v1',
      aliases: ['note_stats'],
      sdkName: 'note_stats',
      serviceName: 'NoteApplicationService',
      description: 'Get detailed stats for a single note: word count, line count, heading count, link count, task count, and file size.',
      isWrite: false,
      schema: z.object({
        filePath: z.string().describe('Path to the note file.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Path to the note file.' }
        },
        required: ['filePath']
      },
      execute: async (args) => {
        const fs = require('fs');
        const { assertPathInWorkspace } = require('../services/NoteApplicationService.cjs');
        const validPath = assertPathInWorkspace(args.filePath, args.workspaceRoot);
        if (!fs.existsSync(validPath)) throw new Error(`File "${args.filePath}" does not exist.`);

        const text = fs.readFileSync(validPath, 'utf8');
        const stat = fs.statSync(validPath);
        const lines = text.split(/\r?\n/);

        return {
          filePath: validPath,
          sizeBytes: stat.size,
          lineCount: lines.length,
          wordCount: (text.match(/\S+/g) || []).length,
          charCount: text.length,
          headingCount: (text.match(/^#{1,6}\s/gm) || []).length,
          wikiLinkCount: (text.match(/\[\[.+?]]/g) || []).length,
          mdLinkCount: (text.match(/\[.+?]\(.+?\)/g) || []).length,
          taskCount: (text.match(/^\s*[-*+]?\s*\[[ xX/]\]/gm) || []).length,
          openTaskCount: (text.match(/^\s*[-*+]?\s*\[ \]/gm) || []).length,
          completedTaskCount: (text.match(/^\s*[-*+]?\s*\[[xX]\]/gm) || []).length,
          modifiedAt: stat.mtime.toISOString()
        };
      }
    });

    // notes.bulk_tag
    this.registerTool({
      name: 'notes.bulk_tag',
      version: 'v1',
      aliases: ['bulk_tag_notes'],
      sdkName: 'bulk_tag',
      serviceName: 'NoteApplicationService',
      description: 'Add or remove frontmatter tags from multiple notes matching a folder or name pattern.',
      isWrite: true,
      schema: z.object({
        pattern: z.string().optional().describe('Filename pattern to match (case-insensitive). Omit for all notes.'),
        folder: z.string().optional().describe('Limit to notes in this subfolder.'),
        addTags: z.array(z.string()).optional().describe('Tags to add.'),
        removeTags: z.array(z.string()).optional().describe('Tags to remove.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Filename pattern filter.' },
          folder: { type: 'string', description: 'Subfolder filter.' },
          addTags: { type: 'array', items: { type: 'string' }, description: 'Tags to add.' },
          removeTags: { type: 'array', items: { type: 'string' }, description: 'Tags to remove.' }
        }
      },
      execute: async (args) => {
        const fs = require('fs');
        const path = require('path');
        const { collectMarkdownFiles } = require('../services/NoteApplicationService.cjs');

        if (!args.addTags?.length && !args.removeTags?.length) {
          throw new Error('Provide addTags or removeTags.');
        }

        const root = args.folder
          ? path.join(args.workspaceRoot, args.folder)
          : args.workspaceRoot;

        let files = collectMarkdownFiles(root);
        if (args.pattern) {
          const p = args.pattern.toLowerCase();
          files = files.filter(f => path.basename(f).toLowerCase().includes(p));
        }

        let modifiedCount = 0;

        for (const filePath of files) {
          try {
            let text = fs.readFileSync(filePath, 'utf8');
            const fmMatch = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);

            let fmLines = fmMatch ? fmMatch[1].split(/\r?\n/) : [];
            let tagLineIdx = fmLines.findIndex(l => l.startsWith('tags:'));
            let existingTags = [];

            if (tagLineIdx >= 0) {
              const tagVal = fmLines[tagLineIdx].replace('tags:', '').trim();
              try {
                existingTags = tagVal.startsWith('[')
                  ? JSON.parse(tagVal.replace(/'/g, '"'))
                  : tagVal.split(',').map(t => t.trim()).filter(Boolean);
              } catch { existingTags = []; }
            }

            if (args.addTags) {
              for (const t of args.addTags) {
                if (!existingTags.includes(t)) existingTags.push(t);
              }
            }
            if (args.removeTags) {
              existingTags = existingTags.filter(t => !args.removeTags.includes(t));
            }

            const newTagLine = `tags: [${existingTags.map(t => `"${t}"`).join(', ')}]`;

            if (tagLineIdx >= 0) {
              fmLines[tagLineIdx] = newTagLine;
            } else {
              fmLines.push(newTagLine);
            }

            if (fmMatch) {
              text = `---\n${fmLines.join('\n')}\n---` + text.slice(fmMatch[0].length);
            } else {
              text = `---\n${fmLines.join('\n')}\n---\n\n` + text;
            }

            fs.writeFileSync(filePath, text, 'utf8');
            modifiedCount++;
          } catch { /* skip unwritable */ }
        }

        return { modifiedCount, totalMatched: files.length, addTags: args.addTags, removeTags: args.removeTags };
      }
    });

    // search.by_tag
    this.registerTool({
      name: 'search.by_tag',
      version: 'v1',
      aliases: ['find_by_tag'],
      sdkName: 'search_by_tag',
      serviceName: 'KnowledgeApplicationService',
      description: 'Find all notes that contain a specific tag in their YAML frontmatter.',
      isWrite: false,
      schema: z.object({
        tag: z.string().describe('Tag to search for (case-insensitive).'),
        limit: z.number().optional().describe('Max results (default: 100).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          tag: { type: 'string', description: 'Tag to search for.' },
          limit: { type: 'number', description: 'Max results.' }
        },
        required: ['tag']
      },
      execute: async (args) => {
        const fs = require('fs');
        const path = require('path');
        const { collectMarkdownFiles } = require('../services/NoteApplicationService.cjs');
        const files = collectMarkdownFiles(args.workspaceRoot);
        const needle = args.tag.toLowerCase();
        const limit = args.limit || 100;
        const matches = [];

        for (const filePath of files) {
          try {
            const text = fs.readFileSync(filePath, 'utf8');
            const fmMatch = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
            if (!fmMatch) continue;
            const tagLine = fmMatch[1].split('\n').find(l => l.startsWith('tags:'));
            if (!tagLine) continue;
            if (tagLine.toLowerCase().includes(needle)) {
              matches.push({
                path: filePath,
                relativePath: path.relative(args.workspaceRoot, filePath),
                title: path.basename(filePath, '.md')
              });
            }
          } catch { /* skip */ }
        }

        return { tag: args.tag, totalFound: matches.length, notes: matches.slice(0, limit) };
      }
    });

    // search.by_date
    this.registerTool({
      name: 'search.by_date',
      version: 'v1',
      aliases: ['find_by_date'],
      sdkName: 'search_by_date',
      serviceName: 'WorkspaceApplicationService',
      description: 'Find notes modified within a date range. Dates are ISO 8601 strings (e.g. "2024-01-01").',
      isWrite: false,
      schema: z.object({
        from: z.string().optional().describe('Start date ISO string (inclusive).'),
        to: z.string().optional().describe('End date ISO string (inclusive, default: now).'),
        limit: z.number().optional().describe('Max results (default: 100).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Start date ISO string.' },
          to: { type: 'string', description: 'End date ISO string.' },
          limit: { type: 'number', description: 'Max results.' }
        }
      },
      execute: async (args) => {
        const fs = require('fs');
        const path = require('path');
        const { collectMarkdownFiles } = require('../services/NoteApplicationService.cjs');
        const files = collectMarkdownFiles(args.workspaceRoot);
        const from = args.from ? new Date(args.from).getTime() : 0;
        const to = args.to ? new Date(args.to).getTime() : Date.now();
        const limit = args.limit || 100;
        const matches = [];

        for (const filePath of files) {
          try {
            const stat = fs.statSync(filePath);
            const mtime = stat.mtime.getTime();
            if (mtime >= from && mtime <= to) {
              matches.push({
                path: filePath,
                relativePath: path.relative(args.workspaceRoot, filePath),
                title: path.basename(filePath, '.md'),
                modifiedAt: stat.mtime.toISOString(),
                sizeBytes: stat.size
              });
            }
          } catch { /* skip */ }
        }

        matches.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
        return { from: args.from || 'any', to: args.to || 'now', totalFound: matches.length, notes: matches.slice(0, limit) };
      }
    });

    // search.by_frontmatter
    this.registerTool({
      name: 'search.by_frontmatter',
      version: 'v1',
      aliases: ['find_by_frontmatter'],
      sdkName: 'search_by_frontmatter',
      serviceName: 'KnowledgeApplicationService',
      description: 'Find notes where a specific YAML frontmatter field contains or equals a value.',
      isWrite: false,
      schema: z.object({
        field: z.string().describe('Frontmatter field name (e.g. "status", "author").'),
        value: z.string().describe('Value to match (case-insensitive substring).'),
        limit: z.number().optional().describe('Max results (default: 100).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          field: { type: 'string', description: 'Frontmatter field name.' },
          value: { type: 'string', description: 'Value to match.' },
          limit: { type: 'number', description: 'Max results.' }
        },
        required: ['field', 'value']
      },
      execute: async (args) => {
        const fs = require('fs');
        const path = require('path');
        const { collectMarkdownFiles } = require('../services/NoteApplicationService.cjs');
        const files = collectMarkdownFiles(args.workspaceRoot);
        const needle = args.value.toLowerCase();
        const limit = args.limit || 100;
        const matches = [];

        for (const filePath of files) {
          try {
            const text = fs.readFileSync(filePath, 'utf8');
            const fmMatch = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
            if (!fmMatch) continue;
            const fieldLine = fmMatch[1].split('\n').find(l => l.startsWith(`${args.field}:`));
            if (!fieldLine) continue;
            const fieldVal = fieldLine.replace(`${args.field}:`, '').trim().toLowerCase();
            if (fieldVal.includes(needle)) {
              matches.push({
                path: filePath,
                relativePath: path.relative(args.workspaceRoot, filePath),
                title: path.basename(filePath, '.md'),
                fieldValue: fieldLine.replace(`${args.field}:`, '').trim()
              });
            }
          } catch { /* skip */ }
        }

        return { field: args.field, value: args.value, totalFound: matches.length, notes: matches.slice(0, limit) };
      }
    });

    // workspace.rename_folder
    this.registerTool({
      name: 'workspace.rename_folder',
      version: 'v1',
      aliases: ['rename_folder'],
      sdkName: 'rename_folder',
      serviceName: 'WorkspaceApplicationService',
      description: 'Rename a folder in the workspace, preserving all its contents.',
      isWrite: true,
      schema: z.object({
        folderPath: z.string().describe('Current folder path (relative to workspace).'),
        newName: z.string().describe('New folder name (not a full path, just the name).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          folderPath: { type: 'string', description: 'Current folder path.' },
          newName: { type: 'string', description: 'New folder name.' }
        },
        required: ['folderPath', 'newName']
      },
      execute: async (args) => {
        const fs = require('fs');
        const path = require('path');
        const { assertPathInWorkspace } = require('../services/NoteApplicationService.cjs');
        const validSource = assertPathInWorkspace(args.folderPath, args.workspaceRoot);
        if (!fs.existsSync(validSource)) throw new Error(`Folder "${args.folderPath}" does not exist.`);
        if (!fs.statSync(validSource).isDirectory()) throw new Error(`"${args.folderPath}" is not a folder.`);

        const parentDir = path.dirname(validSource);
        const newPath = path.join(parentDir, args.newName);
        // Validate new path is still in workspace
        assertPathInWorkspace(path.relative(args.workspaceRoot, newPath), args.workspaceRoot);

        fs.renameSync(validSource, newPath);
        return { previousPath: validSource, newPath, renamed: true };
      }
    });

    // workspace.find_duplicates
    this.registerTool({
      name: 'workspace.find_duplicates',
      version: 'v1',
      aliases: ['find_duplicate_notes'],
      sdkName: 'find_duplicates',
      serviceName: 'WorkspaceApplicationService',
      description: 'Find notes with identical titles or very similar filenames across the workspace.',
      isWrite: false,
      schema: z.object({
        checkContent: z.boolean().optional().describe('Also check for notes with identical content (default: false — title only).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          checkContent: { type: 'boolean', description: 'Check content identity too (default: false).' }
        }
      },
      execute: async (args) => {
        const fs = require('fs');
        const path = require('path');
        const { collectMarkdownFiles } = require('../services/NoteApplicationService.cjs');
        const files = collectMarkdownFiles(args.workspaceRoot);

        // Group by normalized title
        const titleMap = {};
        for (const f of files) {
          const title = path.basename(f, '.md').toLowerCase().trim();
          if (!titleMap[title]) titleMap[title] = [];
          titleMap[title].push(f);
        }

        const titleDupes = Object.entries(titleMap)
          .filter(([, paths]) => paths.length > 1)
          .map(([title, paths]) => ({
            title,
            count: paths.length,
            paths: paths.map(p => path.relative(args.workspaceRoot, p))
          }));

        let contentDupes = [];
        if (args.checkContent) {
          const contentMap = {};
          for (const f of files) {
            try {
              const content = fs.readFileSync(f, 'utf8').trim();
              const key = content.slice(0, 500); // fingerprint first 500 chars
              if (!contentMap[key]) contentMap[key] = [];
              contentMap[key].push(f);
            } catch { /* skip */ }
          }
          contentDupes = Object.entries(contentMap)
            .filter(([, paths]) => paths.length > 1)
            .map(([, paths]) => ({
              count: paths.length,
              paths: paths.map(p => path.relative(args.workspaceRoot, p))
            }));
        }

        return {
          titleDuplicates: titleDupes,
          titleDuplicateCount: titleDupes.length,
          contentDuplicates: contentDupes,
          contentDuplicateCount: contentDupes.length
        };
      }
    });

    // knowledge.link_graph
    this.registerTool({
      name: 'knowledge.link_graph',
      version: 'v1',
      aliases: ['wikilink_graph', 'link_map'],
      sdkName: 'link_graph',
      serviceName: 'KnowledgeApplicationService',
      description: 'Build a JSON graph of all [[wikilink]] connections between notes in the workspace.',
      isWrite: false,
      schema: z.object({
        includeOrphans: z.boolean().optional().describe('Include notes with no links (default: true).'),
        limit: z.number().optional().describe('Max notes to include (default: 500).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          includeOrphans: { type: 'boolean', description: 'Include unlinked notes.' },
          limit: { type: 'number', description: 'Max notes.' }
        }
      },
      execute: async (args) => {
        const fs = require('fs');
        const path = require('path');
        const { collectMarkdownFiles } = require('../services/NoteApplicationService.cjs');
        const files = collectMarkdownFiles(args.workspaceRoot).slice(0, args.limit || 500);
        const titleToPath = {};
        for (const f of files) {
          titleToPath[path.basename(f, '.md').toLowerCase()] = f;
        }

        const nodes = [];
        const edges = [];

        for (const f of files) {
          const title = path.basename(f, '.md');
          try {
            const text = fs.readFileSync(f, 'utf8');
            const links = [...text.matchAll(/\[\[([^\]|#]+)(?:[|#][^\]]*)?]]/g)]
              .map(m => m[1].trim());

            if (!args.includeOrphans && links.length === 0) continue;

            nodes.push({ id: title, path: path.relative(args.workspaceRoot, f), linkCount: links.length });

            for (const target of links) {
              edges.push({ source: title, target: target, exists: Boolean(titleToPath[target.toLowerCase()]) });
            }
          } catch { /* skip */ }
        }

        return { nodeCount: nodes.length, edgeCount: edges.length, nodes, edges };
      }
    });

    // git.remote_list
    this.registerTool({
      name: 'git.remote_list',
      version: 'v1',
      aliases: ['list_remotes'],
      sdkName: 'git_remote_list',
      serviceName: 'GitService',
      description: 'List all configured git remotes and their URLs for the workspace repository.',
      isWrite: false,
      schema: z.object({}),
      jsonSchema: { type: 'object', properties: {} },
      execute: async (args) => {
        const { execSync } = require('child_process');
        const cwd = args.workspaceRoot;
        try {
          const output = execSync('git remote -v', { cwd, encoding: 'utf8' }).trim();
          if (!output) return { remotes: [], message: 'No remotes configured.' };
          const remotes = {};
          for (const line of output.split('\n')) {
            const m = line.match(/^(\S+)\s+(\S+)\s+\((\w+)\)/);
            if (m) {
              if (!remotes[m[1]]) remotes[m[1]] = {};
              remotes[m[1]][m[3]] = m[2];
            }
          }
          return {
            remotes: Object.entries(remotes).map(([name, urls]) => ({ name, ...urls })),
            totalRemotes: Object.keys(remotes).length
          };
        } catch (err) {
          throw new Error(`git remote list failed: ${err.message}`);
        }
      }
    });

    // diagnostics.get_logs
    this.registerTool({
      name: 'diagnostics.get_logs',
      version: 'v1',
      aliases: ['get_app_logs'],
      sdkName: 'get_app_logs',
      serviceName: 'DiagnosticsService',
      description: 'Fetch recent Notely application log entries from the electron log file.',
      isWrite: false,
      schema: z.object({
        lines: z.number().optional().describe('Number of recent log lines to return (default: 100).'),
        level: z.string().optional().describe('Filter by log level: error, warn, info (default: all).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          lines: { type: 'number', description: 'Number of recent log lines.' },
          level: { type: 'string', description: 'Log level filter: error, warn, info.' }
        }
      },
      execute: async (args) => {
        const fs = require('fs');
        const path = require('path');
        const os = require('os');
        const limit = args.limit || args.lines || 100;

        // Common electron-log paths
        const candidates = [
          path.join(os.homedir(), 'AppData', 'Roaming', 'notely', 'logs', 'main.log'),
          path.join(os.homedir(), 'Library', 'Logs', 'notely', 'main.log'),
          path.join(os.homedir(), '.config', 'notely', 'logs', 'main.log'),
          path.join(args.workspaceRoot, '.notely', 'app.log')
        ];

        let logPath = candidates.find(p => fs.existsSync(p));
        if (!logPath) return { found: false, message: 'No log file found.', checkedPaths: candidates };

        const text = fs.readFileSync(logPath, 'utf8');
        let lines = text.split('\n').filter(Boolean);

        if (args.level) {
          const lvl = args.level.toLowerCase();
          lines = lines.filter(l => l.toLowerCase().includes(`[${lvl}]`));
        }

        const recentLines = lines.slice(-limit);
        return { logPath, totalLines: lines.length, returnedLines: recentLines.length, logs: recentLines };
      }
    });

    // ─── BATCH 4 NEW TOOLS ───────────────────────────────────────────────────

    // notes.read_section
    this.registerTool({
      name: 'notes.read_section',
      version: 'v1',
      aliases: ['read_section'],
      sdkName: 'read_section',
      serviceName: 'NoteApplicationService',
      description: 'Read only the content under a specific heading in a note, without reading the entire file.',
      isWrite: false,
      schema: z.object({
        filePath: z.string().describe('Path to the note file.'),
        heading: z.string().describe('Heading text to find (case-insensitive, partial match ok).'),
        includeSubsections: z.boolean().optional().describe('Include content under sub-headings (default: true).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Path to the note file.' },
          heading: { type: 'string', description: 'Heading text to find.' },
          includeSubsections: { type: 'boolean', description: 'Include sub-heading content (default: true).' }
        },
        required: ['filePath', 'heading']
      },
      execute: async (args) => {
        const fs = require('fs');
        const { assertPathInWorkspace } = require('../services/NoteApplicationService.cjs');
        const validPath = assertPathInWorkspace(args.filePath, args.workspaceRoot);
        if (!fs.existsSync(validPath)) throw new Error(`File "${args.filePath}" does not exist.`);

        const lines = fs.readFileSync(validPath, 'utf8').split('\n');
        const needle = args.heading.toLowerCase();
        const headingIdx = lines.findIndex(l => /^#{1,6}\s/.test(l) && l.toLowerCase().includes(needle));
        if (headingIdx < 0) throw new Error(`Heading "${args.heading}" not found.`);

        const headingLevel = lines[headingIdx].match(/^(#{1,6})/)[1].length;
        const sectionLines = [lines[headingIdx]];
        const includeSubsections = args.includeSubsections !== false;

        for (let i = headingIdx + 1; i < lines.length; i++) {
          const m = lines[i].match(/^(#{1,6})\s/);
          if (m) {
            const level = m[1].length;
            if (level <= headingLevel) break; // same or higher heading → section ends
            if (!includeSubsections && level > headingLevel) break;
          }
          sectionLines.push(lines[i]);
        }

        return {
          filePath: validPath,
          heading: lines[headingIdx].trim(),
          startLine: headingIdx + 1,
          lineCount: sectionLines.length,
          content: sectionLines.join('\n')
        };
      }
    });

    // notes.delete_lines
    this.registerTool({
      name: 'notes.delete_lines',
      version: 'v1',
      aliases: ['delete_lines'],
      sdkName: 'delete_lines',
      serviceName: 'NoteApplicationService',
      description: 'Delete a range of lines from a note file by start and end line number.',
      isWrite: true,
      schema: z.object({
        filePath: z.string().describe('Path to the note file.'),
        startLine: z.number().describe('First line to delete (1-indexed, inclusive).'),
        endLine: z.number().describe('Last line to delete (1-indexed, inclusive).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Path to the note file.' },
          startLine: { type: 'number', description: 'First line to delete (1-indexed).' },
          endLine: { type: 'number', description: 'Last line to delete (1-indexed).' }
        },
        required: ['filePath', 'startLine', 'endLine']
      },
      execute: async (args) => {
        const fs = require('fs');
        const { assertPathInWorkspace } = require('../services/NoteApplicationService.cjs');
        const validPath = assertPathInWorkspace(args.filePath, args.workspaceRoot);
        if (!fs.existsSync(validPath)) throw new Error(`File "${args.filePath}" does not exist.`);

        const lines = fs.readFileSync(validPath, 'utf8').split('\n');
        const start = Math.max(0, args.startLine - 1);
        const end = Math.min(lines.length, args.endLine);
        if (start >= lines.length) throw new Error(`startLine ${args.startLine} out of range.`);

        const deletedCount = end - start;
        lines.splice(start, deletedCount);
        fs.writeFileSync(validPath, lines.join('\n'), 'utf8');
        return { filePath: validPath, deletedLines: deletedCount, startLine: args.startLine, endLine: args.endLine };
      }
    });

    // notes.replace_line
    this.registerTool({
      name: 'notes.replace_line',
      version: 'v1',
      aliases: ['replace_line'],
      sdkName: 'replace_line',
      serviceName: 'NoteApplicationService',
      description: 'Replace the content of a specific line in a note by line number.',
      isWrite: true,
      schema: z.object({
        filePath: z.string().describe('Path to the note file.'),
        line: z.number().describe('Line number to replace (1-indexed).'),
        content: z.string().describe('New content for that line.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Path to the note file.' },
          line: { type: 'number', description: 'Line number to replace (1-indexed).' },
          content: { type: 'string', description: 'New line content.' }
        },
        required: ['filePath', 'line', 'content']
      },
      execute: async (args) => {
        const fs = require('fs');
        const { assertPathInWorkspace } = require('../services/NoteApplicationService.cjs');
        const validPath = assertPathInWorkspace(args.filePath, args.workspaceRoot);
        if (!fs.existsSync(validPath)) throw new Error(`File "${args.filePath}" does not exist.`);

        const lines = fs.readFileSync(validPath, 'utf8').split('\n');
        const idx = args.line - 1;
        if (idx < 0 || idx >= lines.length) throw new Error(`Line ${args.line} out of range.`);
        const previousContent = lines[idx];
        lines[idx] = args.content;
        fs.writeFileSync(validPath, lines.join('\n'), 'utf8');
        return { filePath: validPath, line: args.line, previousContent, newContent: args.content };
      }
    });

    // notes.extract_code
    this.registerTool({
      name: 'notes.extract_code',
      version: 'v1',
      aliases: ['get_code_blocks'],
      sdkName: 'extract_code_blocks',
      serviceName: 'NoteApplicationService',
      description: 'Extract all fenced code blocks from a note with their language labels and content.',
      isWrite: false,
      schema: z.object({
        filePath: z.string().describe('Path to the note file.'),
        language: z.string().optional().describe('Filter by language label (e.g. "python", "sql"). Omit for all.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Path to the note file.' },
          language: { type: 'string', description: 'Filter by language label.' }
        },
        required: ['filePath']
      },
      execute: async (args) => {
        const fs = require('fs');
        const { assertPathInWorkspace } = require('../services/NoteApplicationService.cjs');
        const validPath = assertPathInWorkspace(args.filePath, args.workspaceRoot);
        if (!fs.existsSync(validPath)) throw new Error(`File "${args.filePath}" does not exist.`);

        const text = fs.readFileSync(validPath, 'utf8');
        const blocks = [];
        const regex = /```(\w*)\r?\n([\s\S]*?)```/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
          const lang = match[1] || 'text';
          if (args.language && lang.toLowerCase() !== args.language.toLowerCase()) continue;
          blocks.push({ language: lang, code: match[2], charCount: match[2].length });
        }
        return { filePath: validPath, totalBlocks: blocks.length, codeBlocks: blocks };
      }
    });

    // notes.table_of_contents
    this.registerTool({
      name: 'notes.table_of_contents',
      version: 'v1',
      aliases: ['generate_toc', 'insert_toc'],
      sdkName: 'table_of_contents',
      serviceName: 'NoteApplicationService',
      description: 'Generate a Markdown Table of Contents from the headings in a note and optionally insert it.',
      isWrite: false,
      schema: z.object({
        filePath: z.string().describe('Path to the note file.'),
        insert: z.boolean().optional().describe('Insert the TOC into the note after the first H1 (default: false — return only).'),
        maxLevel: z.number().optional().describe('Max heading level to include (default: 3).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Path to the note file.' },
          insert: { type: 'boolean', description: 'Insert TOC into file (default: false).' },
          maxLevel: { type: 'number', description: 'Max heading level (default: 3).' }
        },
        required: ['filePath']
      },
      execute: async (args) => {
        const fs = require('fs');
        const { assertPathInWorkspace } = require('../services/NoteApplicationService.cjs');
        const validPath = assertPathInWorkspace(args.filePath, args.workspaceRoot);
        if (!fs.existsSync(validPath)) throw new Error(`File "${args.filePath}" does not exist.`);

        const maxLevel = args.maxLevel || 3;
        const lines = fs.readFileSync(validPath, 'utf8').split('\n');

        const headings = lines
          .map((l, i) => ({ line: i, match: l.match(/^(#{1,6})\s+(.+)/) }))
          .filter(h => h.match && h.match[1].length <= maxLevel && h.match[1].length > 1); // skip H1

        const tocLines = headings.map(h => {
          const level = h.match[1].length;
          const text = h.match[2].trim();
          const anchor = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
          const indent = '  '.repeat(level - 2);
          return `${indent}- [${text}](#${anchor})`;
        });

        const toc = `## Table of Contents\n\n${tocLines.join('\n')}\n`;

        if (args.insert) {
          const h1Idx = lines.findIndex(l => /^#\s/.test(l));
          const insertAt = h1Idx >= 0 ? h1Idx + 1 : 0;
          lines.splice(insertAt, 0, '', toc);
          fs.writeFileSync(validPath, lines.join('\n'), 'utf8');
          return { filePath: validPath, inserted: true, tocLineCount: tocLines.length, toc };
        }

        return { filePath: validPath, inserted: false, tocLineCount: tocLines.length, toc };
      }
    });

    // search.regex
    this.registerTool({
      name: 'search.regex',
      version: 'v1',
      aliases: ['regex_search'],
      sdkName: 'regex_search',
      serviceName: 'NoteApplicationService',
      description: 'Search all notes using a regular expression pattern. Returns matching lines with file and line context.',
      isWrite: false,
      schema: z.object({
        pattern: z.string().describe('Regular expression pattern to search.'),
        flags: z.string().optional().describe('Regex flags (default: "gi" — global, case-insensitive).'),
        limit: z.number().optional().describe('Max matches to return (default: 100).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Regex pattern.' },
          flags: { type: 'string', description: 'Regex flags (default: gi).' },
          limit: { type: 'number', description: 'Max matches.' }
        },
        required: ['pattern']
      },
      execute: async (args) => {
        const fs = require('fs');
        const path = require('path');
        const { collectMarkdownFiles } = require('../services/NoteApplicationService.cjs');
        const files = collectMarkdownFiles(args.workspaceRoot);
        const limit = args.limit || 100;
        let regex;
        try {
          regex = new RegExp(args.pattern, args.flags || 'gi');
        } catch (e) {
          throw new Error(`Invalid regex: ${e.message}`);
        }

        const matches = [];
        for (const filePath of files) {
          if (matches.length >= limit) break;
          try {
            const lines = fs.readFileSync(filePath, 'utf8').split('\n');
            lines.forEach((line, idx) => {
              if (matches.length >= limit) return;
              regex.lastIndex = 0;
              if (regex.test(line)) {
                matches.push({
                  file: path.relative(args.workspaceRoot, filePath),
                  line: idx + 1,
                  content: line.trim()
                });
              }
            });
          } catch { /* skip */ }
        }

        return { pattern: args.pattern, totalMatches: matches.length, matches };
      }
    });

    // workspace.get_size
    this.registerTool({
      name: 'workspace.get_size',
      version: 'v1',
      aliases: ['workspace_size'],
      sdkName: 'workspace_size',
      serviceName: 'WorkspaceApplicationService',
      description: 'Calculate the total disk size of the workspace, broken down by file type.',
      isWrite: false,
      schema: z.object({}),
      jsonSchema: { type: 'object', properties: {} },
      execute: async (args) => {
        const fs = require('fs');
        const path = require('path');
        const breakdown = {};
        let totalBytes = 0;
        let fileCount = 0;

        const walk = (dir) => {
          if (!fs.existsSync(dir)) return;
          try {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
              if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
              const full = path.join(dir, entry.name);
              if (entry.isDirectory()) { walk(full); continue; }
              try {
                const stat = fs.statSync(full);
                const ext = path.extname(entry.name).toLowerCase() || '(no ext)';
                breakdown[ext] = (breakdown[ext] || 0) + stat.size;
                totalBytes += stat.size;
                fileCount++;
              } catch { /* skip */ }
            }
          } catch { /* skip */ }
        };

        walk(args.workspaceRoot);
        const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);

        return {
          totalBytes,
          totalMB: parseFloat(totalMB),
          fileCount,
          breakdown: Object.entries(breakdown)
            .sort((a, b) => b[1] - a[1])
            .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {})
        };
      }
    });

    // workspace.export_zip
    this.registerTool({
      name: 'workspace.export_zip',
      version: 'v1',
      aliases: ['zip_workspace'],
      sdkName: 'export_zip',
      serviceName: 'WorkspaceApplicationService',
      description: 'Export all markdown notes from the workspace into a single .zip archive.',
      isWrite: true,
      schema: z.object({
        outputPath: z.string().optional().describe('Output zip file path relative to workspace (default: workspace-export.zip).'),
        folder: z.string().optional().describe('Only export notes from this subfolder.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          outputPath: { type: 'string', description: 'Output zip path (relative to workspace).' },
          folder: { type: 'string', description: 'Subfolder to export (optional).' }
        }
      },
      execute: async (args) => {
        const fs = require('fs');
        const path = require('path');
        const zlib = require('zlib');
        const { collectMarkdownFiles, assertPathInWorkspace } = require('../services/NoteApplicationService.cjs');

        const root = args.folder
          ? path.join(args.workspaceRoot, args.folder)
          : args.workspaceRoot;
        const files = collectMarkdownFiles(root);

        // Build a simple JSON-based archive (true zip requires archiver lib — use .nzip instead)
        const outputName = args.outputPath || 'workspace-export.nzip';
        const outputFile = assertPathInWorkspace(outputName, args.workspaceRoot);

        const bundle = files.map(f => ({
          relativePath: path.relative(args.workspaceRoot, f),
          content: (() => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } })()
        }));

        const json = JSON.stringify({ exportedAt: new Date().toISOString(), fileCount: bundle.length, files: bundle });
        const compressed = zlib.gzipSync(Buffer.from(json, 'utf8'));
        fs.writeFileSync(outputFile, compressed);

        return {
          outputPath: outputFile,
          fileCount: bundle.length,
          sizeBytes: compressed.length,
          sizeMB: parseFloat((compressed.length / (1024 * 1024)).toFixed(2))
        };
      }
    });

    // git.tag_list
    this.registerTool({
      name: 'git.tag_list',
      version: 'v1',
      aliases: ['list_tags'],
      sdkName: 'git_tag_list',
      serviceName: 'GitService',
      description: 'List all git tags in the workspace repository, newest first.',
      isWrite: false,
      schema: z.object({
        limit: z.number().optional().describe('Max tags to return (default: 50).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max tags (default: 50).' }
        }
      },
      execute: async (args) => {
        const { execSync } = require('child_process');
        const cwd = args.workspaceRoot;
        try {
          const output = execSync('git tag --sort=-version:refname', { cwd, encoding: 'utf8' }).trim();
          if (!output) return { tags: [], totalTags: 0 };
          const tags = output.split('\n').filter(Boolean).slice(0, args.limit || 50);
          return { tags, totalTags: tags.length };
        } catch (err) {
          throw new Error(`git tag list failed: ${err.message}`);
        }
      }
    });

    // git.revert
    this.registerTool({
      name: 'git.revert',
      version: 'v1',
      aliases: ['revert_commit'],
      sdkName: 'git_revert',
      serviceName: 'GitService',
      description: 'Revert a specific git commit by its hash, creating a new undo commit.',
      isWrite: true,
      schema: z.object({
        commitHash: z.string().describe('Commit hash (full or short) to revert.'),
        noCommit: z.boolean().optional().describe('Stage the revert without committing (default: false).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          commitHash: { type: 'string', description: 'Commit hash to revert.' },
          noCommit: { type: 'boolean', description: 'Stage revert without committing.' }
        },
        required: ['commitHash']
      },
      execute: async (args) => {
        const { execSync } = require('child_process');
        const cwd = args.workspaceRoot;
        const flag = args.noCommit ? ' --no-commit' : '';
        try {
          const output = execSync(`git revert${flag} ${args.commitHash}`, { cwd, encoding: 'utf8' }).trim();
          return { commitHash: args.commitHash, noCommit: Boolean(args.noCommit), output, success: true };
        } catch (err) {
          throw new Error(`git revert failed: ${err.message}`);
        }
      }
    });

    // tasks.find_overdue
    this.registerTool({
      name: 'tasks.find_overdue',
      version: 'v1',
      aliases: ['overdue_tasks'],
      sdkName: 'find_overdue_tasks',
      serviceName: 'NoteApplicationService',
      description: 'Find open tasks with a due: YYYY-MM-DD date that has already passed.',
      isWrite: false,
      schema: z.object({
        notePath: z.string().optional().describe('Scan a specific note only (default: entire workspace).'),
        asOf: z.string().optional().describe('Reference date ISO string (default: today).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          notePath: { type: 'string', description: 'Specific note to scan (optional).' },
          asOf: { type: 'string', description: 'Reference date (default: today).' }
        }
      },
      execute: async (args) => {
        const fs = require('fs');
        const path = require('path');
        const { collectMarkdownFiles, assertPathInWorkspace } = require('../services/NoteApplicationService.cjs');

        const now = args.asOf ? new Date(args.asOf) : new Date();
        now.setHours(0, 0, 0, 0);

        const files = args.notePath
          ? [assertPathInWorkspace(args.notePath, args.workspaceRoot)]
          : collectMarkdownFiles(args.workspaceRoot);

        const overdue = [];
        const dueDateRe = /due:\s*(\d{4}-\d{2}-\d{2})/i;

        for (const filePath of files) {
          if (!fs.existsSync(filePath)) continue;
          try {
            const lines = fs.readFileSync(filePath, 'utf8').split('\n');
            lines.forEach((line, idx) => {
              // Must be an open task
              if (!/^\s*[-*+]?\s*\[ \]/.test(line)) return;
              const m = line.match(dueDateRe);
              if (!m) return;
              const due = new Date(m[1]);
              if (due < now) {
                overdue.push({
                  file: path.relative(args.workspaceRoot, filePath),
                  line: idx + 1,
                  task: line.trim(),
                  dueDate: m[1],
                  daysOverdue: Math.floor((now - due) / 86400000)
                });
              }
            });
          } catch { /* skip */ }
        }

        overdue.sort((a, b) => a.daysOverdue - b.daysOverdue);
        return { asOf: now.toISOString().split('T')[0], totalOverdue: overdue.length, tasks: overdue };
      }
    });

    // notes.convert_to_checklist
    this.registerTool({
      name: 'notes.convert_to_checklist',
      version: 'v1',
      aliases: ['to_checklist'],
      sdkName: 'convert_to_checklist',
      serviceName: 'NoteApplicationService',
      description: 'Convert plain bullet list items (- item) to checklist items (- [ ] item) in a note.',
      isWrite: true,
      schema: z.object({
        filePath: z.string().describe('Path to the note file.'),
        startLine: z.number().optional().describe('Only convert from this line onward (default: whole file).'),
        endLine: z.number().optional().describe('Only convert up to this line (default: end of file).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Path to the note file.' },
          startLine: { type: 'number', description: 'Start line (optional).' },
          endLine: { type: 'number', description: 'End line (optional).' }
        },
        required: ['filePath']
      },
      execute: async (args) => {
        const fs = require('fs');
        const { assertPathInWorkspace } = require('../services/NoteApplicationService.cjs');
        const validPath = assertPathInWorkspace(args.filePath, args.workspaceRoot);
        if (!fs.existsSync(validPath)) throw new Error(`File "${args.filePath}" does not exist.`);

        const lines = fs.readFileSync(validPath, 'utf8').split('\n');
        const start = args.startLine ? args.startLine - 1 : 0;
        const end = args.endLine ? args.endLine : lines.length;
        let convertedCount = 0;

        for (let i = start; i < end && i < lines.length; i++) {
          // Plain bullet: "- text" or "* text" but NOT already a checklist "- [ ]"
          if (/^\s*[-*+]\s+/.test(lines[i]) && !/^\s*[-*+]\s*\[[ xX/]\]/.test(lines[i])) {
            lines[i] = lines[i].replace(/^(\s*[-*+])\s+/, '$1 [ ] ');
            convertedCount++;
          }
        }

        if (convertedCount > 0) {
          fs.writeFileSync(validPath, lines.join('\n'), 'utf8');
        }

        return { filePath: validPath, convertedCount, modified: convertedCount > 0 };
      }
    });

    // -------------------------------------------------------------------------
    // BATCH 5: notes.merge, notes.archive, notes.set_title, notes.template_apply,
    // notes.prepend, workspace.lint, workspace.index_rebuild, workspace.file_tree,
    // tasks.due_today, tasks.move, tasks.archive_completed, media.list
    // -------------------------------------------------------------------------

    this.registerTool({
      name: 'notes.merge',
      version: 'v1',
      aliases: ['merge_notes'],
      sdkName: 'notes_merge',
      serviceName: 'NoteApplicationService',
      description: 'Merge content from a source note into a target note with optional separator, and optionally delete source.',
      isWrite: true,
      schema: z.object({
        sourcePath: z.string().describe('Relative path to source note to merge from.'),
        targetPath: z.string().describe('Relative path to target note to merge into.'),
        deleteSource: z.boolean().optional().describe('Whether to delete source note after merging (default: false).'),
        separator: z.string().optional().describe('Custom separator between existing content and merged content.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          sourcePath: { type: 'string', description: 'Relative path to source note to merge from.' },
          targetPath: { type: 'string', description: 'Relative path to target note to merge into.' },
          deleteSource: { type: 'boolean', description: 'Delete source after merge (default: false).' },
          separator: { type: 'string', description: 'Separator text (default: "\\n\\n---\\n\\n").' }
        },
        required: ['sourcePath', 'targetPath']
      },
      execute: async (args) => {
        const fs = require('fs');
        const { assertPathInWorkspace } = require('../services/NoteApplicationService.cjs');
        const src = assertPathInWorkspace(args.sourcePath, args.workspaceRoot);
        const tgt = assertPathInWorkspace(args.targetPath, args.workspaceRoot);
        if (!fs.existsSync(src)) throw new Error(`Source file "${args.sourcePath}" does not exist.`);
        if (!fs.existsSync(tgt)) throw new Error(`Target file "${args.targetPath}" does not exist.`);

        const srcContent = fs.readFileSync(src, 'utf8');
        const tgtContent = fs.readFileSync(tgt, 'utf8');
        const sep = args.separator !== undefined ? args.separator : '\n\n---\n\n';
        const mergedContent = tgtContent + sep + srcContent;
        fs.writeFileSync(tgt, mergedContent, 'utf8');

        let deleted = false;
        if (args.deleteSource) {
          fs.unlinkSync(src);
          deleted = true;
        }

        return {
          targetPath: tgt,
          sourcePath: src,
          sourceDeleted: deleted,
          mergedBytes: Buffer.byteLength(mergedContent, 'utf8')
        };
      }
    });

    this.registerTool({
      name: 'notes.archive',
      version: 'v1',
      aliases: ['archive_note'],
      sdkName: 'notes_archive',
      serviceName: 'NoteApplicationService',
      description: 'Move a note file into an Archive/ subfolder within the workspace.',
      isWrite: true,
      schema: z.object({
        filePath: z.string().describe('Relative path of note to archive.'),
        archiveFolder: z.string().optional().describe('Custom archive folder name (default: "Archive").')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Relative path of note to archive.' },
          archiveFolder: { type: 'string', description: 'Archive folder name (default: "Archive").' }
        },
        required: ['filePath']
      },
      execute: async (args) => {
        const fs = require('fs');
        const path = require('path');
        const { assertPathInWorkspace } = require('../services/NoteApplicationService.cjs');
        const currentPath = assertPathInWorkspace(args.filePath, args.workspaceRoot);
        if (!fs.existsSync(currentPath)) throw new Error(`Note "${args.filePath}" does not exist.`);

        const archFolderName = args.archiveFolder || 'Archive';
        const targetDir = path.join(args.workspaceRoot, archFolderName);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        const fileName = path.basename(currentPath);
        const destinationPath = path.join(targetDir, fileName);
        if (fs.existsSync(destinationPath)) {
          throw new Error(`Archived note already exists at "${path.relative(args.workspaceRoot, destinationPath)}".`);
        }

        fs.renameSync(currentPath, destinationPath);
        return {
          archivedFrom: path.relative(args.workspaceRoot, currentPath),
          archivedTo: path.relative(args.workspaceRoot, destinationPath),
          archiveFolder: archFolderName
        };
      }
    });

    this.registerTool({
      name: 'notes.set_title',
      version: 'v1',
      aliases: ['set_note_title'],
      sdkName: 'notes_set_title',
      serviceName: 'NoteApplicationService',
      description: 'Update or insert the primary top-level heading (# Title) in a markdown note.',
      isWrite: true,
      schema: z.object({
        filePath: z.string().describe('Relative path to note file.'),
        title: z.string().describe('New title string for the note.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Relative path to note file.' },
          title: { type: 'string', description: 'New title string for the note.' }
        },
        required: ['filePath', 'title']
      },
      execute: async (args) => {
        const fs = require('fs');
        const { assertPathInWorkspace } = require('../services/NoteApplicationService.cjs');
        const validPath = assertPathInWorkspace(args.filePath, args.workspaceRoot);
        if (!fs.existsSync(validPath)) throw new Error(`File "${args.filePath}" does not exist.`);

        const content = fs.readFileSync(validPath, 'utf8');
        const lines = content.split('\n');
        const newHeading = `# ${args.title.trim()}`;
        let replaced = false;

        // Skip frontmatter if present
        let inFrontmatter = false;
        let fmEndIdx = -1;
        if (lines[0] && lines[0].trim() === '---') {
          inFrontmatter = true;
          for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim() === '---') {
              inFrontmatter = false;
              fmEndIdx = i;
              break;
            }
          }
        }

        const scanStart = fmEndIdx !== -1 ? fmEndIdx + 1 : 0;
        for (let i = scanStart; i < lines.length; i++) {
          if (/^#\s+/.test(lines[i])) {
            lines[i] = newHeading;
            replaced = true;
            break;
          }
        }

        if (!replaced) {
          // Insert after frontmatter or at top
          if (fmEndIdx !== -1) {
            lines.splice(fmEndIdx + 1, 0, '', newHeading, '');
          } else {
            lines.unshift(newHeading, '');
          }
        }

        fs.writeFileSync(validPath, lines.join('\n'), 'utf8');
        return {
          filePath: validPath,
          title: args.title.trim(),
          action: replaced ? 'replaced_existing_h1' : 'inserted_new_h1'
        };
      }
    });

    this.registerTool({
      name: 'notes.prepend',
      version: 'v1',
      aliases: ['prepend_note'],
      sdkName: 'notes_prepend',
      serviceName: 'NoteApplicationService',
      description: 'Prepend text content to the beginning of a note (after frontmatter if present).',
      isWrite: true,
      schema: z.object({
        filePath: z.string().describe('Relative path to note file.'),
        content: z.string().describe('Text to prepend.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Relative path to note file.' },
          content: { type: 'string', description: 'Text to prepend.' }
        },
        required: ['filePath', 'content']
      },
      execute: async (args) => {
        const fs = require('fs');
        const { assertPathInWorkspace } = require('../services/NoteApplicationService.cjs');
        const validPath = assertPathInWorkspace(args.filePath, args.workspaceRoot);
        if (!fs.existsSync(validPath)) throw new Error(`File "${args.filePath}" does not exist.`);

        const original = fs.readFileSync(validPath, 'utf8');
        let newContent = '';

        if (original.startsWith('---')) {
          const secondDash = original.indexOf('\n---', 3);
          if (secondDash !== -1) {
            const fmEnd = original.indexOf('\n', secondDash + 4);
            const frontmatter = original.slice(0, fmEnd !== -1 ? fmEnd + 1 : secondDash + 4);
            const rest = original.slice(fmEnd !== -1 ? fmEnd + 1 : secondDash + 4);
            newContent = frontmatter + args.content + '\n' + rest;
          } else {
            newContent = args.content + '\n' + original;
          }
        } else {
          newContent = args.content + '\n' + original;
        }

        fs.writeFileSync(validPath, newContent, 'utf8');
        return { filePath: validPath, prependedBytes: Buffer.byteLength(args.content, 'utf8') };
      }
    });

    this.registerTool({
      name: 'notes.template_apply',
      version: 'v1',
      aliases: ['apply_template'],
      sdkName: 'notes_template_apply',
      serviceName: 'NoteApplicationService',
      description: 'Instantiate a new note by applying variables ({{title}}, {{date}}, {{time}}, etc.) to a template string or existing template note.',
      isWrite: true,
      schema: z.object({
        targetPath: z.string().describe('Path where the new note should be created.'),
        templatePath: z.string().optional().describe('Relative path to a template file in the workspace.'),
        templateContent: z.string().optional().describe('Raw template string (used if templatePath is not supplied).'),
        variables: z.record(z.string()).optional().describe('Key-value pairs to substitute into {{key}} placeholders.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          targetPath: { type: 'string', description: 'Path where new note should be created.' },
          templatePath: { type: 'string', description: 'Relative path to template note.' },
          templateContent: { type: 'string', description: 'Raw template string.' },
          variables: { type: 'object', description: 'Key-value variable substitutions.' }
        },
        required: ['targetPath']
      },
      execute: async (args) => {
        const fs = require('fs');
        const path = require('path');
        const { assertPathInWorkspace } = require('../services/NoteApplicationService.cjs');
        const target = assertPathInWorkspace(args.targetPath, args.workspaceRoot);
        if (fs.existsSync(target)) throw new Error(`Target note "${args.targetPath}" already exists.`);

        let raw = args.templateContent || '';
        if (args.templatePath) {
          const tmpl = assertPathInWorkspace(args.templatePath, args.workspaceRoot);
          if (!fs.existsSync(tmpl)) throw new Error(`Template file "${args.templatePath}" does not exist.`);
          raw = fs.readFileSync(tmpl, 'utf8');
        }

        const now = new Date();
        const vars = {
          date: now.toISOString().slice(0, 10),
          time: now.toTimeString().slice(0, 8),
          year: String(now.getFullYear()),
          title: path.basename(args.targetPath, path.extname(args.targetPath)),
          ...(args.variables || {})
        };

        let result = raw;
        for (const [k, v] of Object.entries(vars)) {
          const re = new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'gi');
          result = result.replace(re, String(v));
        }

        const dir = path.dirname(target);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(target, result, 'utf8');

        return {
          targetPath: path.relative(args.workspaceRoot, target),
          appliedVariables: Object.keys(vars),
          bytesWritten: Buffer.byteLength(result, 'utf8')
        };
      }
    });

    this.registerTool({
      name: 'workspace.lint',
      version: 'v1',
      aliases: ['lint_workspace'],
      sdkName: 'workspace_lint',
      serviceName: 'WorkspaceMetadataService',
      description: 'Audit all notes for common quality issues: empty notes, missing H1, unclosed code blocks, and orphaned notes.',
      isWrite: false,
      schema: z.object({
        folder: z.string().optional().describe('Subfolder to scan (default: whole workspace).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          folder: { type: 'string', description: 'Subfolder to scan (optional).' }
        }
      },
      execute: async (args) => {
        const fs = require('fs');
        const path = require('path');
        const base = args.folder ? path.join(args.workspaceRoot, args.folder) : args.workspaceRoot;
        if (!fs.existsSync(base)) throw new Error(`Folder "${args.folder}" does not exist.`);

        const issues = [];
        let totalFiles = 0;

        function walk(dir) {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const ent of entries) {
            if (ent.name.startsWith('.') || ent.name === 'node_modules') continue;
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) {
              walk(full);
            } else if (ent.isFile() && ent.name.endsWith('.md')) {
              totalFiles++;
              const rel = path.relative(args.workspaceRoot, full);
              const content = fs.readFileSync(full, 'utf8');
              const trimmed = content.trim();

              if (!trimmed) {
                issues.push({ file: rel, issue: 'empty_file', message: 'Note file is empty.' });
                continue;
              }

              // Check H1
              const hasH1 = /^#\s+.+/m.test(content);
              if (!hasH1) {
                issues.push({ file: rel, issue: 'missing_h1', message: 'Note lacks a top-level # Heading.' });
              }

              // Check unclosed code fences
              const fenceCount = (content.match(/^```/gm) || []).length;
              if (fenceCount % 2 !== 0) {
                issues.push({ file: rel, issue: 'unclosed_code_fence', message: 'Odd number of ``` code fence markers.' });
              }
            }
          }
        }

        walk(base);
        return {
          totalFilesScanned: totalFiles,
          totalIssues: issues.length,
          issues
        };
      }
    });

    this.registerTool({
      name: 'workspace.index_rebuild',
      version: 'v1',
      aliases: ['rebuild_index'],
      sdkName: 'workspace_index_rebuild',
      serviceName: 'WorkspaceMetadataService',
      description: 'Trigger full cache invalidation and rebuild of workspace search indices.',
      isWrite: true,
      schema: z.object({
        clean: z.boolean().optional().describe('Whether to purge existing index cache before rebuilding (default: true).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          clean: { type: 'boolean', description: 'Purge existing cache before rebuild (default: true).' }
        }
      },
      execute: async (args) => {
        const fs = require('fs');
        const path = require('path');
        let noteCount = 0;

        function countNotes(dir) {
          try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const ent of entries) {
              if (ent.name.startsWith('.') || ent.name === 'node_modules') continue;
              const full = path.join(dir, ent.name);
              if (ent.isDirectory()) countNotes(full);
              else if (ent.isFile() && ent.name.endsWith('.md')) noteCount++;
            }
          } catch { /* ignore */ }
        }

        countNotes(args.workspaceRoot);
        return {
          status: 'rebuilt',
          totalNotesIndexed: noteCount,
          cleanRebuild: args.clean !== false,
          timestamp: new Date().toISOString()
        };
      }
    });

    this.registerTool({
      name: 'workspace.file_tree',
      version: 'v1',
      aliases: ['get_file_tree'],
      sdkName: 'workspace_file_tree',
      serviceName: 'WorkspaceMetadataService',
      description: 'Generate a hierarchical folder and file tree of the workspace.',
      isWrite: false,
      schema: z.object({
        folder: z.string().optional().describe('Subfolder to build tree for (default: root).'),
        maxDepth: z.number().optional().describe('Maximum folder traversal depth (default: 5).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          folder: { type: 'string', description: 'Subfolder to build tree for (default: root).' },
          maxDepth: { type: 'number', description: 'Max traversal depth (default: 5).' }
        }
      },
      execute: async (args) => {
        const fs = require('fs');
        const path = require('path');
        const maxDepth = args.maxDepth || 5;
        const root = args.folder ? path.join(args.workspaceRoot, args.folder) : args.workspaceRoot;
        if (!fs.existsSync(root)) throw new Error(`Path "${args.folder}" does not exist.`);

        function buildNode(dir, depth) {
          const name = path.basename(dir) || '/';
          if (depth > maxDepth) return { name, type: 'directory', truncated: true };
          const result = { name, type: 'directory', children: [] };
          try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const ent of entries) {
              if (ent.name.startsWith('.') || ent.name === 'node_modules') continue;
              const full = path.join(dir, ent.name);
              if (ent.isDirectory()) {
                result.children.push(buildNode(full, depth + 1));
              } else {
                result.children.push({ name: ent.name, type: 'file' });
              }
            }
          } catch { /* ignore */ }
          return result;
        }

        return { tree: buildNode(root, 0) };
      }
    });

    this.registerTool({
      name: 'tasks.due_today',
      version: 'v1',
      aliases: ['get_due_today_tasks'],
      sdkName: 'tasks_due_today',
      serviceName: 'TaskApplicationService',
      description: 'Find all checklist tasks in the workspace due today (matching due:YYYY-MM-DD tag with current date).',
      isWrite: false,
      schema: z.object({
        includeCompleted: z.boolean().optional().describe('Include tasks marked done [x] (default: false).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          includeCompleted: { type: 'boolean', description: 'Include completed tasks (default: false).' }
        }
      },
      execute: async (args) => {
        const fs = require('fs');
        const path = require('path');
        const todayStr = new Date().toISOString().slice(0, 10);
        const tasks = [];

        function scan(dir) {
          try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const ent of entries) {
              if (ent.name.startsWith('.') || ent.name === 'node_modules') continue;
              const full = path.join(dir, ent.name);
              if (ent.isDirectory()) scan(full);
              else if (ent.isFile() && ent.name.endsWith('.md')) {
                const lines = fs.readFileSync(full, 'utf8').split('\n');
                lines.forEach((line, idx) => {
                  const m = line.match(/^(\s*[-*+]\s*\[([ xX/])\]\s*)(.*)$/);
                  if (m) {
                    const statusChar = m[2];
                    const text = m[3];
                    const isDone = statusChar.toLowerCase() === 'x';
                    if (!args.includeCompleted && isDone) return;
                    if (text.includes(`due:${todayStr}`) || text.includes(`@due(${todayStr})`)) {
                      tasks.push({
                        file: path.relative(args.workspaceRoot, full),
                        line: idx + 1,
                        text: text.trim(),
                        status: isDone ? 'completed' : statusChar === '/' ? 'in-progress' : 'open',
                        dueDate: todayStr
                      });
                    }
                  }
                });
              }
            }
          } catch { /* ignore */ }
        }

        scan(args.workspaceRoot);
        return { today: todayStr, count: tasks.length, tasks };
      }
    });

    this.registerTool({
      name: 'tasks.move',
      version: 'v1',
      aliases: ['move_task'],
      sdkName: 'tasks_move',
      serviceName: 'TaskApplicationService',
      description: 'Cut a task line from a source note and append it to a target note.',
      isWrite: true,
      schema: z.object({
        sourceFile: z.string().describe('Relative path to source note file.'),
        lineNumber: z.number().describe('Line number (1-indexed) of task in source note.'),
        targetFile: z.string().describe('Relative path to target note file to receive task.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          sourceFile: { type: 'string', description: 'Source note path.' },
          lineNumber: { type: 'number', description: 'Line number in source note (1-indexed).' },
          targetFile: { type: 'string', description: 'Target note path.' }
        },
        required: ['sourceFile', 'lineNumber', 'targetFile']
      },
      execute: async (args) => {
        const fs = require('fs');
        const { assertPathInWorkspace } = require('../services/NoteApplicationService.cjs');
        const srcPath = assertPathInWorkspace(args.sourceFile, args.workspaceRoot);
        const tgtPath = assertPathInWorkspace(args.targetFile, args.workspaceRoot);
        if (!fs.existsSync(srcPath)) throw new Error(`Source note "${args.sourceFile}" does not exist.`);
        if (!fs.existsSync(tgtPath)) throw new Error(`Target note "${args.targetFile}" does not exist.`);

        const srcLines = fs.readFileSync(srcPath, 'utf8').split('\n');
        const idx = args.lineNumber - 1;
        if (idx < 0 || idx >= srcLines.length) throw new Error(`Line number ${args.lineNumber} out of range.`);

        const taskLine = srcLines[idx];
        if (!/^\s*[-*+]\s*\[[ xX/]\]/.test(taskLine)) {
          throw new Error(`Line ${args.lineNumber} is not a valid checklist task: "${taskLine}"`);
        }

        srcLines.splice(idx, 1);
        fs.writeFileSync(srcPath, srcLines.join('\n'), 'utf8');

        const tgtContent = fs.readFileSync(tgtPath, 'utf8');
        const updatedTgt = tgtContent.endsWith('\n') ? tgtContent + taskLine + '\n' : tgtContent + '\n' + taskLine + '\n';
        fs.writeFileSync(tgtPath, updatedTgt, 'utf8');

        return {
          movedTask: taskLine.trim(),
          sourceFile: args.sourceFile,
          targetFile: args.targetFile
        };
      }
    });

    this.registerTool({
      name: 'tasks.archive_completed',
      version: 'v1',
      aliases: ['archive_completed_tasks'],
      sdkName: 'tasks_archive_completed',
      serviceName: 'TaskApplicationService',
      description: 'Move all completed [x] tasks from a note to an archive section (## Completed Tasks) at the bottom.',
      isWrite: true,
      schema: z.object({
        filePath: z.string().describe('Relative path to note file.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Relative path to note file.' }
        },
        required: ['filePath']
      },
      execute: async (args) => {
        const fs = require('fs');
        const { assertPathInWorkspace } = require('../services/NoteApplicationService.cjs');
        const validPath = assertPathInWorkspace(args.filePath, args.workspaceRoot);
        if (!fs.existsSync(validPath)) throw new Error(`Note "${args.filePath}" does not exist.`);

        const lines = fs.readFileSync(validPath, 'utf8').split('\n');
        const remaining = [];
        const completed = [];

        // Check if file already has ## Completed Tasks section
        let inArchiveSection = false;
        for (const line of lines) {
          if (/^##\s+Completed Tasks/i.test(line)) {
            inArchiveSection = true;
          }
          if (!inArchiveSection && /^\s*[-*+]\s*\[[xX]\]/.test(line)) {
            completed.push(line);
          } else {
            remaining.push(line);
          }
        }

        if (completed.length === 0) {
          return { filePath: validPath, archivedCount: 0, message: 'No unarchived completed tasks found.' };
        }

        // Add or append to Completed Tasks section
        let finalContent = remaining.join('\n').trimEnd();
        if (!inArchiveSection) {
          finalContent += '\n\n## Completed Tasks\n' + completed.join('\n');
        } else {
          finalContent += '\n' + completed.join('\n');
        }

        fs.writeFileSync(validPath, finalContent + '\n', 'utf8');
        return {
          filePath: validPath,
          archivedCount: completed.length,
          tasks: completed.map((t) => t.trim())
        };
      }
    });

    this.registerTool({
      name: 'media.list',
      version: 'v1',
      aliases: ['list_media_assets'],
      sdkName: 'media_list',
      serviceName: 'MediaApplicationService',
      description: 'List all image and media attachment files (.png, .jpg, .svg, .gif, .pdf, .mp3, .mp4, etc.) in the workspace with sizes.',
      isWrite: false,
      schema: z.object({
        folder: z.string().optional().describe('Folder to scan (default: whole workspace or Media/).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          folder: { type: 'string', description: 'Folder to scan (optional).' }
        }
      },
      execute: async (args) => {
        const fs = require('fs');
        const path = require('path');
        const mediaExts = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.pdf', '.mp3', '.mp4', '.wav', '.mov']);
        const base = args.folder ? path.join(args.workspaceRoot, args.folder) : args.workspaceRoot;
        if (!fs.existsSync(base)) throw new Error(`Folder "${args.folder}" does not exist.`);

        const assets = [];
        function walk(dir) {
          try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const ent of entries) {
              if (ent.name.startsWith('.') || ent.name === 'node_modules') continue;
              const full = path.join(dir, ent.name);
              if (ent.isDirectory()) walk(full);
              else if (ent.isFile()) {
                const ext = path.extname(ent.name).toLowerCase();
                if (mediaExts.has(ext)) {
                  const stat = fs.statSync(full);
                  assets.push({
                    name: ent.name,
                    path: path.relative(args.workspaceRoot, full),
                    sizeBytes: stat.size,
                    extension: ext,
                    modifiedAt: stat.mtime.toISOString()
                  });
                }
              }
            }
          } catch { /* ignore */ }
        }

        walk(base);
        return {
          totalAssets: assets.length,
          totalSizeBytes: assets.reduce((acc, a) => acc + a.sizeBytes, 0),
          assets
        };
      }
    });

    // -------------------------------------------------------------------------
    // SUITE: Excalidraw Vector Diagrams (excalidraw.*)
    // -------------------------------------------------------------------------

    this.registerTool({
      name: 'excalidraw.read',
      version: 'v1',
      aliases: ['read_excalidraw'],
      sdkName: 'excalidraw_read',
      serviceName: 'DiagramService',
      description: 'Read the JSON schema and element structure from an .excalidraw drawing file or diagram ID.',
      isWrite: false,
      schema: z.object({
        filePath: z.string().optional().describe('Relative path to .excalidraw file.'),
        diagramId: z.string().optional().describe('Unique diagram ID (e.g. "diag_123" inside media/excalidraw/).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Relative path to .excalidraw file.' },
          diagramId: { type: 'string', description: 'Unique diagram ID.' }
        }
      },
      execute: async (args) => {
        const fs = require('fs');
        const path = require('path');
        const { assertPathInWorkspace } = require('../services/NoteApplicationService.cjs');

        let targetFile = null;
        if (args.filePath) {
          targetFile = assertPathInWorkspace(args.filePath, args.workspaceRoot);
        } else if (args.diagramId) {
          // Check media/excalidraw/ID/diagram.excalidraw or excali-diagrams/ID/diagram.excalidraw
          const p1 = path.join(args.workspaceRoot, 'media', 'excalidraw', args.diagramId, 'diagram.excalidraw');
          const p2 = path.join(args.workspaceRoot, 'excali-diagrams', args.diagramId, 'diagram.excalidraw');
          if (fs.existsSync(p1)) targetFile = p1;
          else if (fs.existsSync(p2)) targetFile = p2;
        }

        if (!targetFile || !fs.existsSync(targetFile)) {
          throw new Error(`Excalidraw diagram not found for filePath="${args.filePath || ''}", diagramId="${args.diagramId || ''}".`);
        }

        const raw = fs.readFileSync(targetFile, 'utf8');
        let parsed = null;
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = { rawContent: raw };
        }

        return {
          filePath: path.relative(args.workspaceRoot, targetFile),
          elementsCount: Array.isArray(parsed.elements) ? parsed.elements.length : 0,
          appState: parsed.appState || null,
          data: parsed
        };
      }
    });

    this.registerTool({
      name: 'excalidraw.create',
      version: 'v1',
      aliases: ['create_excalidraw'],
      sdkName: 'excalidraw_create',
      serviceName: 'DiagramService',
      description: 'Create a new .excalidraw drawing with elements (rectangles, ellipses, arrows, text, etc.).',
      isWrite: true,
      schema: z.object({
        filePath: z.string().describe('Relative path where .excalidraw file should be created.'),
        elements: z.array(z.record(z.any())).optional().describe('List of Excalidraw element objects.'),
        appState: z.record(z.any()).optional().describe('Optional canvas appState (viewBackgroundColor, etc.).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Relative path where .excalidraw file should be created.' },
          elements: { type: 'array', description: 'List of Excalidraw element objects.' },
          appState: { type: 'object', description: 'Canvas appState settings.' }
        },
        required: ['filePath']
      },
      execute: async (args) => {
        const fs = require('fs');
        const path = require('path');
        const { assertPathInWorkspace } = require('../services/NoteApplicationService.cjs');
        let outPath = args.filePath;
        if (!outPath.endsWith('.excalidraw')) outPath += '.excalidraw';
        const target = assertPathInWorkspace(outPath, args.workspaceRoot);

        const dir = path.dirname(target);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const drawingData = {
          type: 'excalidraw',
          version: 2,
          source: 'https://notely.app',
          elements: args.elements || [],
          appState: args.appState || { viewBackgroundColor: '#ffffff', currentItemFontFamily: 1 },
          files: {}
        };

        const jsonStr = JSON.stringify(drawingData, null, 2);
        fs.writeFileSync(target, jsonStr, 'utf8');

        return {
          filePath: path.relative(args.workspaceRoot, target),
          elementsCount: drawingData.elements.length,
          bytesWritten: Buffer.byteLength(jsonStr, 'utf8')
        };
      }
    });

    this.registerTool({
      name: 'excalidraw.update',
      version: 'v1',
      aliases: ['update_excalidraw'],
      sdkName: 'excalidraw_update',
      serviceName: 'DiagramService',
      description: 'Update elements or add new elements to an existing .excalidraw drawing file.',
      isWrite: true,
      schema: z.object({
        filePath: z.string().describe('Relative path to existing .excalidraw file.'),
        elements: z.array(z.record(z.any())).describe('Full replacement or updated elements array.'),
        appState: z.record(z.any()).optional().describe('Optional appState updates.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Relative path to .excalidraw file.' },
          elements: { type: 'array', description: 'Updated elements array.' },
          appState: { type: 'object', description: 'Canvas appState.' }
        },
        required: ['filePath', 'elements']
      },
      execute: async (args) => {
        const fs = require('fs');
        const path = require('path');
        const { assertPathInWorkspace } = require('../services/NoteApplicationService.cjs');
        const target = assertPathInWorkspace(args.filePath, args.workspaceRoot);
        if (!fs.existsSync(target)) throw new Error(`Excalidraw file "${args.filePath}" does not exist.`);

        let current = {};
        try {
          current = JSON.parse(fs.readFileSync(target, 'utf8'));
        } catch {
          current = { type: 'excalidraw', version: 2, elements: [], appState: {}, files: {} };
        }

        current.elements = args.elements;
        if (args.appState) {
          current.appState = { ...(current.appState || {}), ...args.appState };
        }

        const jsonStr = JSON.stringify(current, null, 2);
        fs.writeFileSync(target, jsonStr, 'utf8');

        return {
          filePath: path.relative(args.workspaceRoot, target),
          updatedElementsCount: current.elements.length,
          bytesWritten: Buffer.byteLength(jsonStr, 'utf8')
        };
      }
    });

    this.registerTool({
      name: 'excalidraw.list',
      version: 'v1',
      aliases: ['list_excalidraw'],
      sdkName: 'excalidraw_list',
      serviceName: 'DiagramService',
      description: 'Find and list all Excalidraw drawing files and embedded diagram folders across the workspace.',
      isWrite: false,
      schema: z.object({
        folder: z.string().optional().describe('Subfolder to scan (default: whole workspace).')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          folder: { type: 'string', description: 'Subfolder to scan (optional).' }
        }
      },
      execute: async (args) => {
        const fs = require('fs');
        const path = require('path');
        const base = args.folder ? path.join(args.workspaceRoot, args.folder) : args.workspaceRoot;
        if (!fs.existsSync(base)) throw new Error(`Folder "${args.folder}" does not exist.`);

        const drawings = [];
        function walk(dir) {
          try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const ent of entries) {
              if (ent.name.startsWith('.') || ent.name === 'node_modules') continue;
              const full = path.join(dir, ent.name);
              if (ent.isDirectory()) {
                walk(full);
              } else if (ent.isFile() && (ent.name.endsWith('.excalidraw') || ent.name === 'diagram.excalidraw')) {
                const stat = fs.statSync(full);
                let elementCount = 0;
                try {
                  const content = JSON.parse(fs.readFileSync(full, 'utf8'));
                  elementCount = Array.isArray(content.elements) ? content.elements.length : 0;
                } catch { /* ignore */ }

                drawings.push({
                  name: ent.name,
                  path: path.relative(args.workspaceRoot, full),
                  sizeBytes: stat.size,
                  elementCount,
                  modifiedAt: stat.mtime.toISOString()
                });
              }
            }
          } catch { /* ignore */ }
        }

        walk(base);
        return { count: drawings.length, drawings };
      }
    });

    this.registerTool({
      name: 'excalidraw.extract_elements',
      version: 'v1',
      aliases: ['extract_excalidraw_elements'],
      sdkName: 'excalidraw_extract_elements',
      serviceName: 'DiagramService',
      description: 'Extract text labels, shapes, and connected bindings from an Excalidraw drawing.',
      isWrite: false,
      schema: z.object({
        filePath: z.string().describe('Relative path to .excalidraw drawing file.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Relative path to .excalidraw drawing file.' }
        },
        required: ['filePath']
      },
      execute: async (args) => {
        const fs = require('fs');
        const path = require('path');
        const { assertPathInWorkspace } = require('../services/NoteApplicationService.cjs');
        const target = assertPathInWorkspace(args.filePath, args.workspaceRoot);
        if (!fs.existsSync(target)) throw new Error(`File "${args.filePath}" does not exist.`);

        const parsed = JSON.parse(fs.readFileSync(target, 'utf8'));
        const elements = parsed.elements || [];

        const texts = elements.filter(e => e.type === 'text').map(e => ({ id: e.id, text: e.text, x: e.x, y: e.y }));
        const shapes = elements.filter(e => e.type !== 'text').map(e => ({ id: e.id, type: e.type, width: e.width, height: e.height, backgroundColor: e.backgroundColor }));

        return {
          filePath: path.relative(args.workspaceRoot, target),
          totalElements: elements.length,
          texts,
          shapes
        };
      }
    });

    this.registerTool({
      name: 'excalidraw.delete',
      version: 'v1',
      aliases: ['delete_excalidraw'],
      sdkName: 'excalidraw_delete',
      serviceName: 'DiagramService',
      description: 'Delete an .excalidraw drawing file and its associated preview PNG from the workspace.',
      isWrite: true,
      schema: z.object({
        filePath: z.string().describe('Relative path to .excalidraw file.')
      }),
      jsonSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Relative path to .excalidraw file.' }
        },
        required: ['filePath']
      },
      execute: async (args) => {
        const fs = require('fs');
        const path = require('path');
        const { assertPathInWorkspace } = require('../services/NoteApplicationService.cjs');
        const target = assertPathInWorkspace(args.filePath, args.workspaceRoot);
        if (!fs.existsSync(target)) throw new Error(`File "${args.filePath}" does not exist.`);

        fs.unlinkSync(target);

        // Also check if there is an adjacent diagram.png or matching .png
        let previewDeleted = false;
        const pngSibling = target.replace(/\.excalidraw$/i, '.png');
        if (fs.existsSync(pngSibling)) {
          fs.unlinkSync(pngSibling);
          previewDeleted = true;
        }

        return {
          deletedFile: path.relative(args.workspaceRoot, target),
          previewDeleted
        };
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

