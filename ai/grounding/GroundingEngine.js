/**
 * GroundingEngine - Verifies claims and citation links against workspace filesystem
 */

const fs = require('fs');

class GroundingEngine {
  /**
   * Verify file links in response text
   * @param {string} text
   * @returns {{ text: string, verifiedCitations: number, brokenCitations: number }}
   */
  static verifyCitations(text) {
    if (!text || typeof text !== 'string') {
      return { text: text || '', verifiedCitations: 0, brokenCitations: 0 };
    }

    let verified = 0;
    let broken = 0;

    const linkRegex = /\[([^\]]+)\]\(file:\/\/\/([^)]+)\)/g;
    const verifiedText = text.replace(linkRegex, (match, label, filePath) => {
      // Decode URI spaces and split line number hashes
      const cleanFilePath = filePath.split('#')[0];
      const decodedPath = decodeURIComponent(cleanFilePath);
      // Strip leading slash on Windows (e.g. /c:/Users... -> c:/Users...)
      const osPath = decodedPath.replace(/^\/([a-zA-Z]:)/, '$1');

      if (fs.existsSync(osPath)) {
        verified++;
        return match;
      } else {
        broken++;
        return label; // Fallback to plain label if link target doesn't exist
      }
    });

    return {
      text: verifiedText,
      verifiedCitations: verified,
      brokenCitations: broken
    };
  }

  /**
   * Verify note title claims against actual workspace files
   * @param {string} text
   * @param {string[]} workspaceFiles
   * @returns {{ text: string, hallucinations: string[] }}
   */
  static verifyNoteTitleClaims(text, workspaceFiles = []) {
    if (!text || typeof text !== 'string' || !Array.isArray(workspaceFiles) || workspaceFiles.length === 0) {
      return { text: text || '', hallucinations: [] };
    }

    const noteBasenames = new Set(workspaceFiles.map(f => {
      const name = String(f).split(/[\\/]/).pop().replace(/\.md$/i, '').toLowerCase();
      return name;
    }));

    const hallucinations = [];
    const titleRegex = /(?:a\s+)?note\s+(?:titled|named|called|on|about|titled:?)\s+["']?([A-Za-z0-9\s\-_]+?)["']?(?=[,.\n\r]|\s+that|\s+covers|\s+discusses|\s+is|\s+covers)/gi;

    const cleanedText = text.replace(titleRegex, (match, claimedTitle) => {
      const normTitle = String(claimedTitle || '').trim().toLowerCase();
      if (normTitle && normTitle.length > 2 && !noteBasenames.has(normTitle)) {
        hallucinations.push(claimedTitle);
        return `(no note file found in workspace matching "${claimedTitle}")`;
      }
      return match;
    });

    return { text: cleanedText, hallucinations };
  }

  /**
   * Auto-format unlinked note mentions or line numbers into clickable file:/// links
   * @param {string} text
   * @param {string[]} workspaceFiles
   * @returns {string}
   */
  static formatLineNumberLinks(text, workspaceFiles = []) {
    if (!text || typeof text !== 'string' || !Array.isArray(workspaceFiles) || workspaceFiles.length === 0) {
      return text || '';
    }

    const fileMap = new Map();
    for (const f of workspaceFiles) {
      const filename = String(f).split(/[\\/]/).pop();
      fileMap.set(filename.toLowerCase(), String(f));
    }

    // 1. Line numbers: "filename.md (line 18)" or "filename.md:18-23"
    const unlinkedLineRegex = /(?<!\(file:\/\/\/[^)]*)\b([A-Za-z0-9\-_.]+\.md)\b(?:\s*\(?(?:lines?|L)?\s*(\d+)(?:\s*[-–—]\s*(\d+))?\)?|:(\d+)(?:-(\d+))?)/gi;

    let processed = text.replace(unlinkedLineRegex, (match, filename, line1, line2, lineAlt1, lineAlt2) => {
      const fullPath = fileMap.get(filename.toLowerCase());
      if (!fullPath) return match;

      const startLine = line1 || lineAlt1;
      const endLine = line2 || lineAlt2;
      const normPath = fullPath.replace(/\\/g, '/');
      const fileUri = normPath.startsWith('/') ? normPath : '/' + normPath;

      if (startLine && endLine) {
        return `[${filename}:L${startLine}-L${endLine}](file://${fileUri}#L${startLine})`;
      } else if (startLine) {
        return `[${filename}:L${startLine}](file://${fileUri}#L${startLine})`;
      }

      return match;
    });

    // 2. Unlinked filename mentions e.g. "ai-and-search.md:" or "ai-and-search.md"
    const unlinkedFileRegex = /(?<!\[[^\]]*\]\(file:\/\/\/[^)]*)\b([A-Za-z0-9\-_.]+\.md)\b(?!=:L|\))/gi;
    processed = processed.replace(unlinkedFileRegex, (match, filename) => {
      const fullPath = fileMap.get(filename.toLowerCase());
      if (!fullPath) return match;

      const normPath = fullPath.replace(/\\/g, '/');
      const fileUri = normPath.startsWith('/') ? normPath : '/' + normPath;
      return `[${filename}](file://${fileUri})`;
    });

    return processed;
  }
}

module.exports = GroundingEngine;
