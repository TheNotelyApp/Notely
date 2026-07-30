/**
 * CapabilityResolver - Layer 2 of Decoupled Hybrid Planning Architecture
 * Responsibility: Capability Resolution & Endpoint Binding
 *
 * Dynamically queries ApplicationToolRegistry & external MCP servers to resolve abstract information needs
 * into semantic capability contracts without maintaining static internal hardcoded tool maps.
 */

const { createLogger } = require('../core');
const log = createLogger('CapabilityResolver');

const { getRegisteredTools } = require('./registryUtils');

class CapabilityResolver {
  /**
   * Fetch registered tools metadata dynamically from ApplicationToolRegistry
   * @returns {Array}
   */
  getRegisteredTools() {
    return getRegisteredTools();
  }

  /**
   * Resolve array of information needs dynamically into bound semantic capabilities
   * @param {Array<string>} informationNeeds
   * @returns {Array<{ need: string, capability: string, toolName: string, description: string }>}
   */
  resolveCapabilities(informationNeeds = []) {
    const registeredTools = this.getRegisteredTools();
    const resolved = [];
    const seenNeeds = new Set();

    for (const need of informationNeeds) {
      if (seenNeeds.has(need)) continue;
      seenNeeds.add(need);

      // Match tools in ApplicationToolRegistry that advertise this informationNeed or matching capability/alias
      const matchingTool = registeredTools.find(t =>
        t.informationNeeds.includes(need) ||
        t.capability.toLowerCase().includes(need.toLowerCase()) ||
        t.name.toLowerCase().includes(need.toLowerCase()) ||
        t.aliases.some(a => a.toLowerCase().includes(need.toLowerCase()))
      ) || registeredTools.find(t => t.description.toLowerCase().includes(need.toLowerCase()));

      if (matchingTool) {
        resolved.push({
          need,
          capability: matchingTool.capability,
          toolName: matchingTool.name,
          description: matchingTool.description
        });
      } else {
        // Fallback matching to primary search tool if no specific registry match found
        const fallbackSearch = registeredTools.find(t => t.capability === 'notes:search') || registeredTools[0];
        if (fallbackSearch) {
          resolved.push({
            need,
            capability: fallbackSearch.capability,
            toolName: fallbackSearch.name,
            description: fallbackSearch.description
          });
        }
      }
    }

    log.debug(`Resolved ${resolved.length} capabilities dynamically from ${informationNeeds.length} info needs`);
    return resolved;
  }
}

module.exports = CapabilityResolver;
