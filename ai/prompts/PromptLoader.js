/**
 * PromptLoader - Loads, parses, validates, and caches version-controlled prompt files.
 */

const fs = require('fs');
const path = require('path');
const { createLogger } = require('../core/logger');

const log = createLogger('PromptLoader');

class PromptLoader {
  constructor(promptsDir = null) {
    this.promptsDir = promptsDir || path.resolve(__dirname, '../../resources/prompts');
    this.cache = new Map();
    this.templateCache = new Map();
  }

  /**
   * Simple YAML frontmatter parser
   * @param {string} fileContent
   * @returns {{ metadata: object, body: string }}
   */
  parseFrontmatter(fileContent) {
    if (!fileContent.startsWith('---')) {
      return { metadata: {}, body: fileContent.trim() };
    }

    const endIdx = fileContent.indexOf('---', 3);
    if (endIdx === -1) {
      return { metadata: {}, body: fileContent.trim() };
    }

    const frontmatterText = fileContent.slice(3, endIdx).trim();
    const body = fileContent.slice(endIdx + 3).trim();
    const metadata = {};

    const lines = frontmatterText.split('\n');
    for (const line of lines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;

      const key = line.slice(0, colonIdx).trim();
      let value = line.slice(colonIdx + 1).trim();

      // Handle arrays [a, b, c]
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value
          .slice(1, -1)
          .split(',')
          .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
          .filter(Boolean);
      } else {
        // Strip quotes
        value = value.replace(/^['"]|['"]$/g, '');
      }

      metadata[key] = value;
    }

    return { metadata, body };
  }

  /**
   * Load system prompt file by ID or relative path
   * @param {string} promptId - e.g., 'base-system' or 'behavior-policy'
   * @returns {{ id: string, metadata: object, body: string }}
   */
  loadSystemPrompt(promptId) {
    const cacheKey = `system:${promptId}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const filePath = path.join(this.promptsDir, 'system', `${promptId}.md`);
    if (!fs.existsSync(filePath)) {
      log.warn(`System prompt file missing: ${filePath}`);
      return { id: promptId, metadata: { version: '0.0.0' }, body: '' };
    }

    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const { metadata, body } = this.parseFrontmatter(raw);
      const result = {
        id: metadata.id || promptId,
        metadata,
        body
      };
      this.cache.set(cacheKey, result);
      return result;
    } catch (err) {
      log.error(`Failed to read prompt file ${filePath}:`, err.message);
      return { id: promptId, metadata: { version: '0.0.0' }, body: '' };
    }
  }

  /**
   * Load persona file by ID strictly from designated app personas directory or built-in directory.
   * @param {string} personaId - e.g. 'general', 'software-engineer'
   * @param {string} [userPersonasDir=null] - Specific user app data personas directory (e.g. appDataDir/personas)
   * @returns {{ id: string, metadata: object, body: string }}
   */
  loadPersona(personaId, userPersonasDir = null) {
    const cacheKey = `persona:${personaId}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const candidatePaths = [];
    if (userPersonasDir && typeof userPersonasDir === 'string') {
      candidatePaths.push(path.join(userPersonasDir, `${personaId}.md`));
    }
    candidatePaths.push(path.join(this.promptsDir, 'personas', `${personaId}.md`));

    const filePath = candidatePaths.find(p => fs.existsSync(p));
    if (!filePath) {
      log.warn(`Persona '${personaId}' missing in app directories.`);
      return null;
    }

    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const { metadata, body } = this.parseFrontmatter(raw);
      const result = {
        id: metadata.id || personaId,
        metadata,
        body
      };
      this.cache.set(cacheKey, result);
      return result;
    } catch (err) {
      log.error(`Failed to read persona file ${filePath}:`, err.message);
      return null;
    }
  }

  /**
   * Load template file by name
   * @param {string} templateName - e.g. 'workspace-context'
   * @returns {string}
   */
  loadTemplate(templateName) {
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName);
    }

    const filePath = path.join(this.promptsDir, 'templates', `${templateName}.template`);
    if (!fs.existsSync(filePath)) {
      log.warn(`Template file missing: ${filePath}`);
      return '';
    }

    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      this.templateCache.set(templateName, raw);
      return raw;
    } catch (err) {
      log.error(`Failed to read template ${filePath}:`, err.message);
      return '';
    }
  }

  /**
   * Clear in-memory caches (e.g. for development hot reload)
   */
  clearCache() {
    this.cache.clear();
    this.templateCache.clear();
    log.info('PromptLoader cache cleared.');
  }
}

module.exports = PromptLoader;
