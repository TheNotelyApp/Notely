/**
 * Logs Module Facade
 * Single entry point for application and prompt trace log database operations.
 */

const LogDB = require('./LogDB');

module.exports = {
  LogDB,
  createLogDB: (workspaceRoot) => new LogDB(workspaceRoot)
};
