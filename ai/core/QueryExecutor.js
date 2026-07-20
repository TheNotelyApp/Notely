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

      // 1. Build core persona instructions — prefer ContextEngine persona if available
      let systemPrompt;
      let contextEngineTools = {};
      if (this.agent.contextEngine) {
        try {
          const conversationId = context.conversationId || 'default';
          const ceCtx = this.agent.contextEngine.buildContext({
            conversationId,
            activeNotePath: context.currentFile || null,
            activeNoteContent: context.activeNoteContent || null
          });
          systemPrompt = ceCtx.system;
          contextEngineTools = ceCtx.tools || {}; // { searchNotes, exploreGraph }
        } catch (ceErr) {
          console.warn('[QueryExecutor] ContextEngine.buildContext failed, falling back:', ceErr.message);
        }
      }
      if (!systemPrompt) {
        systemPrompt = context.systemPrompt || 'You are a helpful AI assistant for Notely, a modern markdown notes application.';
      }

      // 2. ALWAYS append workspace context metadata
      systemPrompt += `\n\nWorkspace context:
- Workspace folder: ${this.agent.workspaceRoot || 'none'}
- Current open note path: ${context.currentFile || 'none'}`;

      const { getOfficialTools, runTool } = require('./QueryTools');

      if (llm.baseUrl && llm.baseUrl.includes('api.groq.com')) {
        const { Groq } = require('groq-sdk');
        const groq = new Groq({ apiKey: llm.apiKey, dangerouslyAllowBrowser: true });

        const officialTools = getOfficialTools(this.agent);

        const messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ];

        let steps = 0;
        let finalResponseText = '';
        let totalTokens = 0;
        const trace = [];

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
              
              const output = await runTool(this.agent, name, args);

              trace.push({ name, args, output: output.slice(0, 500) });
              
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
        // Write back to provider so health diagnostics see real stats
        if (llm.usageStats) {
          llm.usageStats.tokensUsedTotal += totalTokens;
          llm.usageStats.requestsTotal += 1;
        }

        return {
          type: 'query',
          result: finalResponseText,
          tokensUsed: totalTokens,
          trace
        };
      }
      const mergedTools = {
        ...tools,
        ...contextEngineTools
      };

      const result = await generateText({
        model,
        system: systemPrompt,
        prompt: query,
        tools: mergedTools,
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

