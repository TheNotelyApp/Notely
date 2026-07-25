/**
 * Database Module Facade
 * Single entry point for legacy database manager and SQLite migration runners.
 */

const DatabaseManager = require('./LegacyDBManager');
const LegacyMigrations = require('./LegacyMigrations');

module.exports = {
  DatabaseManager,
  LegacyMigrations,

  createDatabaseManager: (dbPath) => new DatabaseManager(dbPath)
};
