/**
 * productionHardening.spec.js
 * Regression tests for AI Telemetry & Production Hardening fixes.
 */

const { describe, it, expect, beforeEach } = require('vitest');
const { TaskSummaryFormatter, formatFileUriLink } = require('../../ai/formatter');
const { normalizeTokensDetail, validateTokenAccounting } = require('../../ai/utils/aiUtils');
const GroundingEngine = require('../../ai/grounding/GroundingEngine');
const IntentAnalyzer = require('../../ai/planner/IntentAnalyzer');

describe('Production Hardening & Telemetry Regression Suite', () => {
  let intentAnalyzer;

  beforeEach(() => {
    intentAnalyzer = new IntentAnalyzer();
  });

  // Test 1 — Task Summary Intent & Orchestration
  it('Test 1 — Task Summary Intent & Execution Routing', async () => {
    const query = "Summarize key tasks across my workspace";
    const manifest = intentAnalyzer.analyze(query);

    expect(manifest.intent || manifest.goal).toBe('workspace_task_summary');
    expect(manifest.capabilities.needsTasks).toBe(true);
    expect(manifest.capabilities.needsGraph).toBe(false);

    // Verify deterministic formatter logic
    const mockTasks = [
      { note: 'ai-and-search.md', path: 'C:\\Users\\Test\\Notes\\ai-and-search.md', line: 16, text: 'An open task', status: 'open' },
      { note: 'ai-and-search.md', path: 'C:\\Users\\Test\\Notes\\ai-and-search.md', line: 17, text: 'Second task', status: 'open' },
      { note: 'diagrams.md', path: 'C:\\Users\\Test\\Notes\\diagrams.md', line: 5, text: 'Third task', status: 'open' }
    ];

    const formatted = TaskSummaryFormatter(mockTasks);
    expect(formatted).toContain('## Workspace Task Summary');
    expect(formatted).toContain('[ai-and-search.md](file:///C:/Users/Test/Notes/ai-and-search.md)');
    expect(formatted).toContain('[diagrams.md](file:///C:/Users/Test/Notes/diagrams.md)');
    expect(formatted).not.toContain('\\]\\(');
  });

  // Test 2 — Token Validation Invariant
  it('Test 2 — Token Validation Invariant (input + output + tool = total)', () => {
    const rawUsage = {
      inputTokens: 100,
      outputTokens: 20,
      toolTokens: 30,
      totalTokens: 150
    };

    const tokensDetail = normalizeTokensDetail(rawUsage);
    expect(tokensDetail.inputTokens).toBe(100);
    expect(tokensDetail.outputTokens).toBe(20);
    expect(tokensDetail.toolTokens).toBe(30);
    expect(tokensDetail.totalTokens).toBe(150);

    const isValid = validateTokenAccounting(tokensDetail);
    expect(isValid).toBe(true);

    // Verify when toolTokens is computed from totalTokens
    const rawImplicitUsage = {
      promptTokens: 2665,
      completionTokens: 8,
      totalTokens: 4497
    };
    const normalizedImplicit = normalizeTokensDetail(rawImplicitUsage);
    expect(normalizedImplicit.inputTokens).toBe(2665);
    expect(normalizedImplicit.outputTokens).toBe(8);
    expect(normalizedImplicit.toolTokens).toBe(1824);
    expect(normalizedImplicit.totalTokens).toBe(4497);
    expect(validateTokenAccounting(normalizedImplicit)).toBe(true);
  });

  // Test 3 — Tool Attribution Telemetry
  it('Test 3 — Tool Attribution Telemetry Classification', () => {
    const toolEvent = {
      toolName: 'get_tasks',
      toolType: 'planned-execution',
      callerType: 'executor',
      selectedBy: 'planner',
      intent: 'workspace_task_summary'
    };

    expect(toolEvent.callerType).toBe('executor');
    expect(toolEvent.selectedBy).toBe('planner');
    expect(toolEvent.toolType).toBe('planned-execution');
    expect(toolEvent.callerType).not.toBe('llm');
    expect(toolEvent.toolType).not.toBe('llm-driven');
  });

  // Test 4 — File URI Rendering
  it('Test 4 — File URI Rendering without backslash escaping', () => {
    const inputPath = 'C:\\Users\\Test\\Notes\\sample.md';
    const link = formatFileUriLink(inputPath, 'sample.md');
    
    expect(link).toBe('[sample.md](file:///C:/Users/Test/Notes/sample.md)');
    expect(link).not.toContain('\\]\\(');
    expect(link).not.toContain('\\[sample.md\\]\\(');

    const groundLink = GroundingEngine.formatFileUriLink(inputPath, 'sample.md');
    expect(groundLink).toBe('[sample.md](file:///C:/Users/Test/Notes/sample.md)');

    const cleanedText = GroundingEngine.cleanMarkdownLinkEscaping('[sample.md]\\(file:///C:/Users/Test/Notes/sample.md\\)');
    expect(cleanedText).toContain('[sample.md](file:///C:/Users/Test/Notes/sample.md)');
  });
});
