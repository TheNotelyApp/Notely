/**
 * ToolRegistry.js
 * AI Engine bridge to the central Application Tool Registry.
 * Translates Vercel AI SDK getTools calls to applicationToolRegistry capabilities.
 * Direct filesystem/DB access is strictly prohibited in this layer.
 */

const { applicationToolRegistry } = require('../../electron/tools/ApplicationToolRegistry.cjs');
const { createLogger } = require('../core');

const log = createLogger('ToolRegistry');

async function getTools(agentInstance) {
  try {
    log.info('Binding Agent instance to Application Tool Registry');
    if (agentInstance) {
      applicationToolRegistry.setAgentInstance(agentInstance);
    }

    const context = {
      workspaceRoot: agentInstance?.workspaceRoot || null,
      caller: 'internal_ai'
    };

    return await applicationToolRegistry.toVercelTools(context);
  } catch (err) {
    log.error('Failed to initialize tools from ApplicationToolRegistry:', err.message);
    return {};
  }
}

/**
 * Utility to fetch mapped tools from ApplicationToolRegistry
 * @returns {Array}
 */
function getRegisteredTools() {
  try {
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

module.exports = { getTools, getRegisteredTools };
