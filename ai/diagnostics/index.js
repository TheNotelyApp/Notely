/**
 * Diagnostics Module Facade
 * Single entry point for health diagnostics metrics aggregation.
 */

const { getSubsystemHealth } = require('./AIHealth');

module.exports = {
  getSubsystemHealth
};
