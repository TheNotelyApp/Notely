/**
 * Utils Module Facade
 * Single entry point for HTTP client, IPC protocol helpers, and AI response utility formatters.
 */

const HttpClient = require('./HttpClient');
const ipcProtocol = require('./ipcProtocol');
const aiUtils = require('./aiUtils');

module.exports = {
  HttpClient,
  ipcProtocol,
  aiUtils,
  formatResponse: aiUtils.formatResponse,
  parseCommand: aiUtils.parseCommand
};
