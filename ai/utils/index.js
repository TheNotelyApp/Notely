/**
 * Utils Module Facade
 * Single entry point for HTTP client, IPC protocol helpers, and AI response utility formatters.
 */

const HttpClient = require('./HttpClient');
const ipcProtocol = require('./ipcProtocol');
const aiUtils = require('./aiUtils');
const SearchQueryUtils = require('./SearchQueryUtils');

module.exports = {
  HttpClient,
  ipcProtocol,
  aiUtils,
  SearchQueryUtils,
  extractSearchKeywords: SearchQueryUtils.extractSearchKeywords,
  normalizeSearchQuery: SearchQueryUtils.normalizeSearchQuery,
  formatResponse: aiUtils.formatResponse,
  parseCommand: aiUtils.parseCommand
};

