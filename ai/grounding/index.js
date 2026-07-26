/**
 * Grounding Module Facade
 * Single entry point for citation link verification, note claim validation, and hallucination detection.
 */

const GroundingEngine = require('./GroundingEngine');

module.exports = {
  GroundingEngine,

  verifyCitations: (text) => GroundingEngine.verifyCitations(text),
  verifyNoteTitleClaims: (text, workspaceFiles) => GroundingEngine.verifyNoteTitleClaims(text, workspaceFiles),
  formatLineNumberLinks: (text, workspaceFiles) => GroundingEngine.formatLineNumberLinks(text, workspaceFiles)
};
