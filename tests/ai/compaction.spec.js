const compaction = require('../../ai/compaction');
const { CompactionEngine } = require('../../ai/compaction');

describe('Compaction Module & NLP Intent Extraction Tests', () => {
  it('should export all compaction facade methods', () => {
    expect(compaction.CompactionEngine).toBeDefined();
    expect(typeof compaction.compactHistory).toBe('function');
    expect(typeof compaction.extractTurnSummary).toBe('function');
    expect(typeof compaction.extractUserIntent).toBe('function');
  });

  it('should programmatically extract clean intent from user query', () => {
    const rawQuery = 'Can you please explain how auth middleware validates JWT tokens?';
    const intent = compaction.extractUserIntent(rawQuery);
    expect(intent).toBe('explain how auth middleware validates JWT tokens?');
  });

  it('should extract assistant outcome from note link response', () => {
    const assistantText = 'Here is the details from your note: [Architecture Notes](file:////path/to/arch.md).';
    const outcome = CompactionEngine.extractAssistantOutcome(assistantText);
    expect(outcome).toContain('Referenced notes: Architecture Notes');
  });

  it('should return uncompacted history when messages <= 4', () => {
    const msgs = [
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello!' },
      { role: 'user', content: 'How are you?' },
      { role: 'assistant', content: 'Doing great!' }
    ];

    const res = compaction.compactHistory(msgs, { maxVerbatimCount: 4 });
    expect(res.isCompacted).toBe(false);
    expect(res.compactedMessages).toHaveLength(4);
    expect(res.turnsCompacted).toBe(0);
  });

  it('should compact older turns when messages > 4 into executive memory summary', () => {
    const msgs = [
      { role: 'user', content: 'Can you review the AI workflow and modularize planner?' },
      { role: 'assistant', content: 'Modularized planner facade into ai/planner/index.js.' },
      { role: 'user', content: 'Also ensure telemetry logging in AIFlow.' },
      { role: 'assistant', content: 'Added 5-stage telemetry trace to LogDB.' },
      { role: 'user', content: 'What about response formatting?' },
      { role: 'assistant', content: 'Created ai/formatter/index.js facade.' },
      { role: 'user', content: 'Should we add context compaction?' },
      { role: 'assistant', content: 'Yes, implementing sliding window algorithm.' }
    ];

    const res = compaction.compactHistory(msgs, { maxVerbatimCount: 4 });
    expect(res.isCompacted).toBe(true);
    expect(res.turnsCompacted).toBe(2);
    expect(res.summaryText).toContain('[EXECUTIVE MEMORY SUMMARY OF PAST TURNS]');
    expect(res.summaryText).toContain('Turn 1');
    expect(res.summaryText).toContain('Turn 2');

    // System summary message + last 4 verbatim messages
    expect(res.compactedMessages).toHaveLength(5);
    expect(res.compactedMessages[0].role).toBe('system');
    expect(res.compactedMessages[0].isCompactedSummary).toBe(true);
    expect(res.compactedMessages[4].content).toBe('Yes, implementing sliding window algorithm.');
  });
});
