/**
 * CompactionEngine - Programmatic Context Compaction & Intent Extraction Engine
 *
 * Implements 0ms zero-latency NLP heuristics and a 2-tier sliding window algorithm:
 *  - Tier 1 (Verbatim Window): Recent N turns (last 4 messages) preserved verbatim.
 *  - Tier 2 (Executive Memory Summary): Older turns programmatically compressed
 *    into structured intent + outcome bullet points.
 */

const FILLER_PATTERNS = [
  /^(can you|could you|please|kindly|i want to|i need to|how do i|what is|where is|tell me|explain to me|help me with)\s+/i,
  /\b(please|thanks|thank you|asap|now)\b/gi
];

class CompactionEngine {
  /**
   * Programmatically extract intent from user query string
   * @param {string} userText
   * @returns {string} Clean intent statement
   */
  static extractUserIntent(userText) {
    if (!userText || typeof userText !== 'string') return 'General inquiry';

    let cleaned = userText.trim();
    for (const pattern of FILLER_PATTERNS) {
      cleaned = cleaned.replace(pattern, '').trim();
    }

    if (cleaned.length > 80) {
      cleaned = cleaned.slice(0, 80) + '...';
    }

    return cleaned || userText.slice(0, 60);
  }

  /**
   * Programmatically extract outcome / artifacts from assistant response
   * @param {string} assistantText
   * @returns {string} Compact outcome summary
   */
  static extractAssistantOutcome(assistantText) {
    if (!assistantText || typeof assistantText !== 'string') return 'Completed response';

    // Check for note links file:///
    const fileLinkMatches = [...assistantText.matchAll(/\[([^\]]+)\]\(file:\/\/\/[^\)]+\)/g)];
    if (fileLinkMatches.length > 0) {
      const uniqueTitles = [...new Set(fileLinkMatches.map(m => m[1]))];
      return `Referenced notes: ${uniqueTitles.slice(0, 3).join(', ')}`;
    }

    // Check for code block / tool execution output
    if (assistantText.includes('```')) {
      const codeMatch = assistantText.match(/```(\w+)?\n([\s\S]*?)```/);
      const lang = codeMatch ? (codeMatch[1] || 'code') : 'code';
      return `Generated ${lang} snippet/action`;
    }

    // Extract first meaningful sentence
    const sentences = assistantText
      .replace(/<[^>]+>/g, '')
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 10 && !s.startsWith('#'));

    if (sentences.length > 0) {
      const first = sentences[0];
      return first.length > 90 ? first.slice(0, 90) + '...' : first;
    }

    return assistantText.slice(0, 80) + '...';
  }

  /**
   * Extract a single turn summary from a user & assistant message pair
   * @param {object} userMsg
   * @param {object} assistantMsg
   * @returns {string} Single bullet point summary
   */
  static extractTurnSummary(userMsg, assistantMsg) {
    const intent = this.extractUserIntent(userMsg?.content || '');
    const outcome = this.extractAssistantOutcome(assistantMsg?.content || '');
    return `User requested "${intent}" -> ${outcome}`;
  }

  /**
   * Perform 2-Tier Sliding Window Context Compaction
   * @param {Array<object>} messages - Complete conversation message array
   * @param {object} options - { maxVerbatimCount: 4 }
   * @returns {{ compactedMessages: Array<object>, isCompacted: boolean, summaryText: string, turnsCompacted: number }}
   */
  static compactHistory(messages = [], options = {}) {
    const maxVerbatimCount = options.maxVerbatimCount || 4;

    if (!Array.isArray(messages) || messages.length <= maxVerbatimCount) {
      return {
        compactedMessages: messages || [],
        isCompacted: false,
        summaryText: '',
        turnsCompacted: 0
      };
    }

    const olderMessages = messages.slice(0, messages.length - maxVerbatimCount);
    const recentMessages = messages.slice(messages.length - maxVerbatimCount);

    // Group older messages into user/assistant turn pairs
    const turnSummaries = [];
    for (let i = 0; i < olderMessages.length; i += 2) {
      const uMsg = olderMessages[i];
      const aMsg = olderMessages[i + 1];
      if (uMsg && uMsg.role === 'user') {
        const turnBullet = this.extractTurnSummary(uMsg, aMsg);
        turnSummaries.push(`- Turn ${Math.floor(i / 2) + 1}: ${turnBullet}`);
      }
    }

    const summaryText = turnSummaries.length > 0
      ? `[EXECUTIVE MEMORY SUMMARY OF PAST TURNS]\n${turnSummaries.join('\n')}`
      : '';

    const compactedMessages = [];
    if (summaryText) {
      compactedMessages.push({
        role: 'system',
        content: summaryText,
        isCompactedSummary: true
      });
    }

    compactedMessages.push(...recentMessages);

    return {
      compactedMessages,
      isCompacted: true,
      summaryText,
      turnsCompacted: turnSummaries.length
    };
  }
}

module.exports = CompactionEngine;
