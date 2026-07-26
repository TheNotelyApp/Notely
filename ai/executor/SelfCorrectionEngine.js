/**
 * SelfCorrectionEngine - Response validation & self-correction loop for Notely AI
 * Validates generated LLM responses before returning them to the user.
 * Checks for zero-jargon compliance, citation grounding, and evidence alignment.
 */

const { GroundingEngine } = require('../grounding');
const { getRegisteredTools } = require('../tools');
class SelfCorrectionEngine {
  /**
   * Dynamically build regex pattern matching all registered tool names
   * @private
   */
  static _getDynamicToolTagPattern() {
    try {
      const tools = getRegisteredTools();
      const names = [];
      for (const t of tools) {
        if (t.name) names.push(t.name);
        if (t.fullName) names.push(t.fullName);
        if (Array.isArray(t.aliases)) names.push(...t.aliases);
      }
      const uniqueNames = Array.from(new Set(names)).map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      if (uniqueNames.length > 0) {
        return new RegExp(`<(${uniqueNames.join('|')})[^>]*>[\\s\\S]*?<\\/\\1>`, 'gi');
      }
    } catch { /* fallback */ }
    return /<[a-zA-Z0-9_-]+>[^<]*\{[\s\S]*?\}[\s\S]*?<\/[a-zA-Z0-9_-]+>/gi;
  }

  /**
   * Validate and self-correct response text
   * @param {string} text
   * @param {object} options - { query, evidenceContext }
   * @returns {{ validatedText: string, corrected: boolean, issues: string[] }}
   */
  static validateAndCorrect(text, options = {}) {
    if (!text || typeof text !== 'string') {
      return { validatedText: '', corrected: false, issues: [] };
    }

    let currentText = text;
    const issues = [];
    let corrected = false;

    // 1. Zero-Jargon Compliance Check (Strip internal tool names dynamically if leaked by LLM)
    const jargonPatterns = [
      /I executed the following tools:?/gi,
      /#### Tool Output:?\s*\w+/gi,
      /\[Tool:\s*\w+\]/gi,
      /I invoked tool \w+/gi,
      // Generic pattern for any XML tag enclosing JSON object parameters
      /<[a-zA-Z0-9_-]+>[^<]*\{[\s\S]*?\}[\s\S]*?<\/[a-zA-Z0-9_-]+>/gi,
      // Dynamic pattern generated from ApplicationToolRegistry
      this._getDynamicToolTagPattern()
    ];

    for (const pattern of jargonPatterns) {
      if (pattern.test(currentText)) {
        issues.push('Leaked internal tool technical jargon');
        currentText = currentText.replace(pattern, '').trim();
        corrected = true;
      }
    }

    // 2. Citation Link Verification (Verify file:/// links exist on disk)
    const citationRes = GroundingEngine.verifyCitations(currentText);
    if (citationRes.brokenCitations > 0) {
      issues.push(`Found ${citationRes.brokenCitations} broken note links`);
      currentText = citationRes.text;
      corrected = true;
    }

    // 3. Note Title Hallucination Verification & Line Link Formatting
    if (options.workspaceFiles && Array.isArray(options.workspaceFiles)) {
      const titleRes = GroundingEngine.verifyNoteTitleClaims(currentText, options.workspaceFiles);
      if (titleRes.hallucinations.length > 0) {
        issues.push(`Stripped ${titleRes.hallucinations.length} ungrounded note title claim(s)`);
        currentText = titleRes.text;
        corrected = true;
      }
      currentText = GroundingEngine.formatLineNumberLinks(currentText, options.workspaceFiles);
    }

    // 4. Grounding Fallback Check
    if (options.evidenceContext === false || options.evidenceContext === '') {
      const lower = currentText.toLowerCase();
      if (lower.includes('in your note') && !lower.includes("couldn't find")) {
        issues.push('Claimed note facts without workspace evidence');
      }
    }

    return {
      validatedText: currentText,
      corrected,
      issues
    };
  }
}

module.exports = SelfCorrectionEngine;
