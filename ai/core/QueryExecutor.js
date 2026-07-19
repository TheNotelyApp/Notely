/**
 * QueryExecutor - Routes queries to AI models with multi-step tool execution
 */

const { getTools } = require('../tools/ToolRegistry');

class QueryExecutor {
  constructor(agent) {
    this.agent = agent;
  }

  /**
   * Execute a query using Vercel AI SDK and the tool registry
   */
  async execute(query, context = {}) {
    try {
      const llm = this.agent.llmRegistry.getActiveProvider();
      const model = await llm.getModelInstance();

      const { generateText } = await import('ai');
      const tools = await getTools(this.agent);

      let systemPrompt = context.systemPrompt || `You are a helpful AI assistant for Notely, a modern markdown notes application.
You have access to the workspace note files via tools. Always use these tools to search, find, and read notes when asked.
Workspace context:
- Workspace folder: ${this.agent.workspaceRoot || 'none'}
- Current open note path: ${context.currentFile || 'none'}`;

      systemPrompt += `\n\nCRITICAL TOOL CALLING RULES:
1. When calling search_notes, you MUST provide a non-empty string for the "query" parameter.
2. When calling read_note, you MUST provide the absolute file path string for the "file_path" parameter.
3. Never call tools with empty or null arguments. If you do not have the required parameter values, ask the user to clarify first.`;

      if (llm.baseUrl && llm.baseUrl.includes('api.groq.com')) {
        const { Groq } = require('groq-sdk');
        const groq = new Groq({ apiKey: llm.apiKey, dangerouslyAllowBrowser: true });

        const officialTools = [
          {
            type: 'function',
            function: {
              name: 'read_note',
              description: 'Read the contents of a specific note file in the workspace.',
              parameters: {
                type: 'object',
                properties: {
                  file_path: {
                    type: 'string',
                    description: 'The absolute path to the note file to read.'
                  }
                },
                required: ['file_path']
              }
            }
          },
          {
            type: 'function',
            function: {
              name: 'search_notes',
              description: 'Search for note files containing a query string in the workspace.',
              parameters: {
                type: 'object',
                properties: {
                  query: {
                    type: 'string',
                    description: 'The search term or phrase.'
                  }
                },
                required: ['query']
              }
            }
          }
        ];

        const runTool = async (name, args) => {
          if (name === 'read_note') {
            const filePath = args.file_path || args.filePath;
            try {
              const fs = require('fs');
              if (!filePath || !fs.existsSync(filePath)) {
                return `Error: Note file at path "${filePath}" does not exist.`;
              }
              return fs.readFileSync(filePath, 'utf8');
            } catch (err) {
              return `Error reading file: ${err.message}`;
            }
          }
          if (name === 'search_notes') {
            const queryStr = args.query;
            try {
              const fs = require('fs');
              const files = this.agent.db.getWorkspaceFiles ? this.agent.db.getWorkspaceFiles() : [];
              const results = [];
              for (const f of files) {
                try {
                  const text = fs.readFileSync(f.file_path, 'utf8');
                  if (f.file_path.toLowerCase().includes(queryStr.toLowerCase()) || text.toLowerCase().includes(queryStr.toLowerCase())) {
                    results.push({ path: f.file_path, preview: text.slice(0, 150) + '...' });
                  }
                } catch {
                  // ignore unreadable files
                }
              }
              return JSON.stringify(results.slice(0, 10), null, 2);
            } catch (err) {
              return `Error searching: ${err.message}`;
            }
          }
          return `Error: Tool ${name} not found`;
        };

        const messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ];

        let steps = 0;
        let finalResponseText = '';
        let totalTokens = 0;

        while (steps < 5) {
          const chatCompletion = await groq.chat.completions.create({
            messages,
            model: llm.model || 'llama-3.3-70b-versatile',
            tools: officialTools,
            tool_choice: 'auto',
            temperature: 0.7,
          });

          const choice = chatCompletion.choices[0];
          const responseMessage = choice.message;
          totalTokens += chatCompletion.usage?.total_tokens || 0;

          // Push the assistant's reply (which may contain tool calls) to messages
          messages.push(responseMessage);

          if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
            for (const toolCall of responseMessage.tool_calls) {
              const name = toolCall.function.name;
              const args = JSON.parse(toolCall.function.arguments);
              console.log(`[Groq Native] Executing tool ${name} with args:`, toolCall.function.arguments);
              
              const output = await runTool(name, args);
              
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                name: name,
                content: output
              });
            }
            steps++;
          } else {
            finalResponseText = responseMessage.content || '';
            break;
          }
        }

        return {
          type: 'query',
          result: finalResponseText,
          tokensUsed: totalTokens
        };
      }
      const result = await generateText({
        model,
        system: systemPrompt,
        prompt: query,
        tools,
        maxSteps: 5 // Allow multi-step tool calls
      });

      return {
        type: 'query',
        result: result.text,
        tokensUsed: result.usage?.totalTokens || 0
      };
    } catch (error) {
      console.error('[QueryExecutor] Execution failed:', error.message);
      throw error;
    }
  }
}

module.exports = QueryExecutor;
