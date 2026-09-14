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
  }
];

class McpPromptsRegistry {
  constructor() {
    this.prompts = new Map();
    for (const p of ENTERPRISE_PROMPTS) {
      this.prompts.set(p.name, p);
    }
  }

  listPrompts() {
    return Array.from(this.prompts.values()).map(p => ({
      name: p.name,
      description: p.description,
      arguments: p.arguments || []
    }));
  }

  getPrompt(name, args = {}) {
    const prompt = this.prompts.get(name);
    if (!prompt) {
      throw new Error(`Prompt "${name}" not found in MCP Prompts Registry.`);
    }

    const messages = prompt.generateMessages(args || {});
    return {
      description: prompt.description,
      messages
    };
  }
}

const mcpPromptsRegistry = new McpPromptsRegistry();

module.exports = {
  mcpPromptsRegistry,
  McpPromptsRegistry,
  ENTERPRISE_PROMPTS
};
