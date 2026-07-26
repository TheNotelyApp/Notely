/**
 * Registry Utility Helpers for AI Planner
 */

const { createLogger } = require('../core/logger');
const log = createLogger('PlannerRegistryUtils');

/**
 * Utility to fetch mapped tools from ApplicationToolRegistry
 * @returns {Array}
 */
function getRegisteredTools() {
  try {
    const { applicationToolRegistry } = require('../../electron/tools/ApplicationToolRegistry.cjs');
    return Array.from(applicationToolRegistry.tools.values()).map(t => ({
      name: t.sdkName || t.aliases?.[0] || t.name,
      fullName: t.name,
      aliases: t.aliases || [],
      capability: t.capability || 'generic',
      informationNeeds: Array.isArray(t.informationNeeds) ? t.informationNeeds : [],
      description: t.description || ''
    }));
  } catch (err) {
    log.warn('Failed to resolve ApplicationToolRegistry:', err.message);
    return [];
  }
}

module.exports = {
  getRegisteredTools
};
