/**
 * McpPrompts.cjs
 * Enterprise Prompts Registry for Notely MCP.
 * Implements standard MCP Prompts primitive (prompts/list, prompts/get).
 */

const ENTERPRISE_PROMPTS = [
  {
    name: 'summarize_note',
    description: 'Generate an executive summary, key takeaways, and action items for a workspace note.',
    arguments: [
      {
        name: 'notePath',
        description: 'Path or title of the note to summarize (e.g. "docs/Architecture.md")',
        required: true
      },
      {
        name: 'depth',
        description: 'Level of detail: "brief" (1 paragraph) or "detailed" (comprehensive)',
        required: false
      }
    ],
    generateMessages: (args) => {
      const depth = args.depth === 'brief' ? 'brief 1-paragraph summary' : 'comprehensive, structured breakdown';
      return [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Please inspect the note at "${args.notePath}" using the read_note tool and produce a ${depth}.
Include:
1. Executive Summary
2. Core Takeaways & Key Decisions
3. Referenced Diagrams or Media Assets (if any)
4. Open Tasks & Follow-up Items`
          }
        }
      ];
    }
  },
  {
    name: 'plan_tasks',
    description: 'Break down a project goal or feature into actionable checklist tasks and append them to a note.',
    arguments: [
      {
        name: 'goal',
        description: 'The objective or feature to plan tasks for',
        required: true
      },
      {
        name: 'targetNote',
        description: 'Optional note path to append tasks to (defaults to generating the checklist)',
        required: false
      },
      {
        name: 'includeDates',
        description: 'Whether to assign tentative due dates (e.g. due:YYYY-MM-DD)',
        required: false
      }
    ],
    generateMessages: (args) => {
      const targetNoteInstruction = args.targetNote
        ? `After generating the checklist, use the edit_note or manage_tasks tool to append them to "${args.targetNote}".`
        : 'Output the checklist formatted with markdown checkboxes (- [ ] task).';

      return [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Please plan an actionable checklist for the following goal: "${args.goal}".
Break this down into logical phases (Preparation, Implementation, Testing, Deployment).
${args.includeDates ? 'Assign reasonable due dates formatted as due:YYYY-MM-DD.' : ''}
${targetNoteInstruction}`
          }
        }
      ];
    }
  },
  {
    name: 'explore_knowledge_graph',
    description: 'Analyze relationships, backlinks, and conceptual clusters around a topic or note in the workspace.',
    arguments: [
      {
        name: 'topicOrNote',
        description: 'Topic name, concept, or note path to explore in the knowledge graph',
        required: true
      },
      {
        name: 'maxDepth',
        description: 'Maximum hops to traverse (default: 2)',
        required: false
      }
    ],
    generateMessages: (args) => {
      return [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Please explore connections around "${args.topicOrNote}" using the search, read_note, and workspace_overview tools.
Identify:
1. Direct backlinks and outgoing [[wikilinks]]
2. Related concepts and cluster nodes
3. Construct a Mermaid diagram showing the relationship graph.`
          }
        }
      ];
    }
  },
  {
    name: 'refactor_note',
    description: 'Clean up an unstructured note: format frontmatter, ensure clean H1-H3 hierarchy, and detect unlinked mentions.',
    arguments: [
      {
        name: 'notePath',
        description: 'Path of the note to refactor',
        required: true
      }
    ],
    generateMessages: (args) => {
      return [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Please read note "${args.notePath}" using read_note. Refactor its structure:
1. Ensure standard YAML frontmatter (title, tags, modified date).
2. Clean up heading hierarchy (single H1, clean H2/H3 subheadings).
3. Find plain text mentions of other known notes and recommend converting them to [[wikilinks]].
4. Consolidate any action items into checklist format (- [ ] item).
Review with dryRun before writing changes.`
          }
        }
      ];
    }
  },
  {
    name: 'daily_review',
    description: 'Perform a daily briefing: inspect open/overdue tasks across the workspace and summarize recently edited notes.',
    arguments: [
      {
        name: 'filter',
        description: 'Task filter: "today", "overdue", or "all" (default: "today")',
        required: false
      }
    ],
    generateMessages: (args) => {
      const filter = args.filter || 'today';
      return [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Please perform a workspace daily review using manage_tasks (filter: "${filter}") and workspace_overview (operation: "recent_activity").
Provide an executive daily briefing:
1. High-priority tasks (overdue or due today)
2. Recently updated notes and summaries of recent activity
3. Suggested focus priorities for today.`
          }
        }
      ];
    }
  },
  {
    name: 'synthesize_document',
    description: 'Read an extracted PDF, slide presentation, Word doc, or audio transcript and produce a structured Markdown study note with wikilinks.',
    arguments: [
      {
        name: 'assetPath',
        description: 'Relative path of the document or audio file (e.g. "specs/system.pdf", "media/audio/standup")',
        required: true
      },
      {
        name: 'targetNote',
        description: 'Optional destination note path to create (e.g. "docs/System-Synthesis.md")',
        required: false
      }
    ],
    generateMessages: (args) => {
      return [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Please inspect the extracted text or audio transcript for "${args.assetPath}" using the search and read_note tools.
Produce a comprehensive synthesis note:
1. Document Overview & Key Themes
2. Core Takeaways & Architectural Highlights
3. Connect relevant concepts to existing workspace notes using [[wikilinks]]
4. Extract all actionable tasks formatted as checkboxes with due dates if mentioned (- [ ] task @due(YYYY-MM-DD))
${args.targetNote ? `Save the synthesized note to "${args.targetNote}" using the edit_note tool.` : ''}`
          }
        }
      ];
    }
  },
  {
    name: 'create_diagram',
    description: 'Generate a Mermaid visual diagram (flowchart, sequence, class, state, or ER) from note contents or specifications.',
    arguments: [
      {
        name: 'notePath',
        description: 'Path of the note to generate a diagram for',
        required: true
      },
      {
        name: 'diagramType',
        description: 'Diagram type: "flowchart", "sequence", "class", "state", "er", or "mindmap" (default: "flowchart")',
        required: false
      }
    ],
    generateMessages: (args) => {
      const type = args.diagramType || 'flowchart';
      return [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Please read the note at "${args.notePath}" using read_note.
Construct a clear, elegant Mermaid diagram of type "${type}":
1. Model the core processes, data flows, or entities described in the note.
2. Ensure valid Mermaid syntax.
3. Use manage_diagrams or edit_note to embed the diagram block into the note.`
          }
        }
      ];
    }
  },
  {
    name: 'atomic_split',
    description: 'Refactor a large monolithic note into focused atomic notes, creating a master Map of Content (MOC) index note.',
    arguments: [
      {
        name: 'sourceNote',
        description: 'Path of the monolithic note to split',
        required: true
      },
      {
        name: 'outputFolder',
        description: 'Folder to store the new atomic notes in (e.g. "topics/arch/")',
        required: false
      }
    ],
    generateMessages: (args) => {
      return [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Please read note "${args.sourceNote}" using read_note and plan an atomic refactoring:
1. Identify 2-5 distinct subtopics that should become standalone atomic notes.
2. For each subtopic: define a clear title, YAML frontmatter (with tags/aliases), and concise content.
3. Turn the original note into an index Map of Content (MOC) linking to each new note with [[wikilinks]].
4. Review with dryRun before creating files.`
          }
        }
      ];
    }
  },
  {
    name: 'codebase_sync',
    description: 'Cross-reference an attached Git repository against workspace notes to detect undocumented APIs or missing documentation.',
    arguments: [
      {
        name: 'repoName',
        description: 'Name of the attached repository to inspect (from dynamic-context.md)',
        required: true
      }
    ],
    generateMessages: (args) => {
      return [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Please inspect the attached code repository "${args.repoName}" alongside workspace notes using workspace_overview and search.
Identify:
1. Key exported modules, endpoints, or data models in the codebase.
2. Which APIs or components are already documented in notes vs. which are missing.
3. Draft a documentation note outline with [[wikilinks]] linking related concepts.`
          }
        }
      ];
    }
  }
];

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

class McpPromptsRegistry {
  constructor() {
    this.builtinPrompts = new Map();
    for (const p of ENTERPRISE_PROMPTS) {
      this.builtinPrompts.set(p.name, { ...p, source: 'builtin' });
    }
  }

  /**
   * Scan and load custom markdown prompts from <workspaceRoot>/.notes-app/prompts/*.md
   * @param {string} workspaceRoot 
   * @returns {Map<string, object>}
   */
  loadWorkspacePrompts(workspaceRoot) {
    const promptsMap = new Map();
    if (!workspaceRoot || typeof workspaceRoot !== 'string') {
      return promptsMap;
    }

    const promptsDir = path.join(workspaceRoot, '.notes-app', 'prompts');
    if (!fs.existsSync(promptsDir)) {
      return promptsMap;
    }

    try {
      const files = fs.readdirSync(promptsDir);
      for (const file of files) {
        if (!file.endsWith('.md')) continue;
        const filePath = path.join(promptsDir, file);
        try {
          const raw = fs.readFileSync(filePath, 'utf8');
          const parsed = this.parsePromptFile(raw, file);
          if (parsed) {
            parsed.filePath = filePath;
            parsed.fileName = file;
            parsed.source = 'workspace';
            promptsMap.set(parsed.name, parsed);
          }
        } catch (err) {
          console.warn(`[McpPrompts] Failed to parse custom prompt file "${file}":`, err.message);
        }
      }
    } catch (err) {
      console.warn(`[McpPrompts] Error reading prompts directory "${promptsDir}":`, err.message);
    }

    return promptsMap;
  }

  /**
   * Parse a Markdown prompt file with YAML frontmatter.
   */
  parsePromptFile(rawContent, fallbackName = 'custom_prompt') {
    const fmMatch = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    let frontmatter = {};
    let templateBody = rawContent.trim();

    if (fmMatch) {
      try {
        frontmatter = yaml.load(fmMatch[1]) || {};
        templateBody = (fmMatch[2] || '').trim();
      } catch (err) {
        console.warn('[McpPrompts] YAML parse error:', err.message);
      }
    }

    const name = String(frontmatter.name || path.basename(fallbackName, '.md'))
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_');

    const description = String(frontmatter.description || 'Workspace custom prompt workflow.').trim();
    const argsDef = Array.isArray(frontmatter.arguments)
      ? frontmatter.arguments.map(arg => ({
          name: String(arg.name || '').trim(),
          description: String(arg.description || '').trim(),
          required: Boolean(arg.required)
        })).filter(a => Boolean(a.name))
      : [];

    return {
      name,
      description,
      arguments: argsDef,
      template: templateBody,
      generateMessages: (providedArgs = {}) => {
        let text = templateBody;
        // Interpolate {{argName}} or {{argName || "fallback"}}
        text = text.replace(/\{\{\s*([a-zA-Z0-9_-]+)(?:\s*\|\|\s*["']([^"']*)["'])?\s*\}\}/g, (_match, varName, fallbackVal) => {
          if (providedArgs[varName] !== undefined && providedArgs[varName] !== null && String(providedArgs[varName]).trim() !== '') {
            return String(providedArgs[varName]);
          }
          return fallbackVal !== undefined ? fallbackVal : '';
        });

        return [
          {
            role: 'user',
            content: {
              type: 'text',
              text
            }
          }
        ];
      }
    };
  }

  /**
   * List all prompts (Built-in + Workspace Custom).
   * @param {string} [workspaceRoot]
   */
  listPrompts(workspaceRoot = null) {
    const results = [];

    // Built-ins
    for (const p of this.builtinPrompts.values()) {
      results.push({
        name: p.name,
        description: p.description,
        arguments: p.arguments || [],
        source: 'builtin'
      });
    }

    // Workspace custom
    if (workspaceRoot) {
      const wsPrompts = this.loadWorkspacePrompts(workspaceRoot);
      for (const p of wsPrompts.values()) {
        // If name collides with built-in, custom overrides or appears with source
        const existingIdx = results.findIndex(r => r.name === p.name);
        const item = {
          name: p.name,
          description: p.description,
          arguments: p.arguments || [],
          template: p.template || '',
          source: 'workspace',
          fileName: p.fileName
        };
        if (existingIdx !== -1) {
          results[existingIdx] = item;
        } else {
          results.push(item);
        }
      }
    }

    return results;
  }

  /**
   * Get and execute prompt message generator.
   * @param {string} name 
   * @param {object} args 
   * @param {string} [workspaceRoot]
   */
  getPrompt(name, args = {}, workspaceRoot = null) {
    if (!name) throw new Error('Prompt name is required.');
    const cleanName = String(name).trim().toLowerCase();

    // Check workspace prompts first
    if (workspaceRoot) {
      const wsPrompts = this.loadWorkspacePrompts(workspaceRoot);
      if (wsPrompts.has(cleanName)) {
        const prompt = wsPrompts.get(cleanName);
        return {
          description: prompt.description,
          messages: prompt.generateMessages(args || {})
        };
      }
    }

    // Fall back to built-ins
    const prompt = this.builtinPrompts.get(cleanName);
    if (!prompt) {
      throw new Error(`Prompt "${name}" not found in MCP Prompts Registry.`);
    }

    return {
      description: prompt.description,
      messages: prompt.generateMessages(args || {})
    };
  }

  /**
   * Save a workspace custom prompt to .notes-app/prompts/<name>.md
   * @param {string} workspaceRoot 
   * @param {object} promptData 
   */
  saveCustomPrompt(workspaceRoot, promptData = {}) {
    if (!workspaceRoot) throw new Error('Workspace root is required to save custom prompt.');
    if (!promptData.name) throw new Error('Prompt name is required.');

    const cleanName = String(promptData.name)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_');

    const promptsDir = path.join(workspaceRoot, '.notes-app', 'prompts');
    if (!fs.existsSync(promptsDir)) {
      fs.mkdirSync(promptsDir, { recursive: true });
    }

    const frontmatter = {
      name: cleanName,
      description: String(promptData.description || '').trim(),
      arguments: Array.isArray(promptData.arguments) ? promptData.arguments : []
    };

    const yml = yaml.dump(frontmatter).trim();
    const templateBody = String(promptData.template || '').trim();
    const fileContent = `---\n${yml}\n---\n\n${templateBody}\n`;

    const targetPath = path.join(promptsDir, `${cleanName}.md`);
    const tmpPath = path.join(promptsDir, `.${cleanName}.${Date.now()}.tmp`);

    fs.writeFileSync(tmpPath, fileContent, 'utf8');
    fs.renameSync(tmpPath, targetPath);

    return {
      success: true,
      name: cleanName,
      fileName: `${cleanName}.md`,
      filePath: targetPath
    };
  }

  /**
   * Delete a workspace custom prompt from .notes-app/prompts/<name>.md
   * @param {string} workspaceRoot 
   * @param {string} name 
   */
  deleteCustomPrompt(workspaceRoot, name) {
    if (!workspaceRoot) throw new Error('Workspace root is required.');
    if (!name) throw new Error('Prompt name is required.');

    const cleanName = String(name).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const targetPath = path.join(workspaceRoot, '.notes-app', 'prompts', `${cleanName}.md`);

    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
      return { success: true, name: cleanName, deleted: true };
    }

    return { success: false, name: cleanName, deleted: false, error: 'File not found' };
  }
}

const mcpPromptsRegistry = new McpPromptsRegistry();

module.exports = {
  mcpPromptsRegistry,
  McpPromptsRegistry,
  ENTERPRISE_PROMPTS
};
