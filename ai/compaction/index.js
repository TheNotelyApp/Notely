/**
 * ai/compaction/index.js - Single entry point facade for Compaction Domain Module
 */

const CompactionEngine = require('./CompactionEngine');

module.exports = {
  CompactionEngine,

  /**
   * Perform 2-tier context compaction over message history
   * @param {Array<object>} messages
   * @param {object} options
   */
  compactHistory: (messages, options) => CompactionEngine.compactHistory(messages, options),

  /**
   * Extract single turn summary
   * @param {object} userMsg
   * @param {object} assistantMsg
   */
  extractTurnSummary: (userMsg, assistantMsg) => CompactionEngine.extractTurnSummary(userMsg, assistantMsg),

  /**
   * Extract user intent from query
   * @param {string} userText
   */
  extractUserIntent: (userText) => CompactionEngine.extractUserIntent(userText)
};
