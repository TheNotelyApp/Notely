/**
 * Spell checking and grammar checking utilities
 * Uses a local spell checker and LanguageTool API for grammar
 */

import MarkdownIt from "markdown-it";

const markdownParser = new MarkdownIt({
  html: false,
  linkify: false,
  typographer: false,
});

// Simple spell checker using common English words
// For a production app, consider using a proper dictionary
const COMMON_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "up", "about", "into", "through", "during",
  "is", "are", "am", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "must", "can", "shall",
  "i", "you", "he", "she", "it", "we", "they", "what", "which", "who",
  "this", "that", "these", "those", "my", "your", "his", "her", "its", "our",
  "there", "here", "where", "when", "why", "how", "all", "each", "every",
  "both", "few", "more", "most", "other", "some", "such", "no", "nor", "not",
  "only", "same", "so", "than", "too", "very", "as", "if", "just", "because",
  "note", "add", "example", "see", "also", "one", "two", "three", "first",
  "second", "third", "etc", "vs", "vs.", "e.g", "i.e", "markdown", "html",
  "css", "javascript", "python", "java", "c", "database", "api", "rest",
  "json", "xml", "react", "vue", "angular", "node", "express", "npm",
  "yarn", "webpack", "babel", "eslint", "prettier", "git", "github",
  "notely", "tata", "chemicals", "mithapur", "tcl", "project", "folder",
  "file", "document", "notes", "meeting", "metadata", "location", "time",
  "raw", "cleansed", "preview", "edit", "save", "delete", "create",
]);

// Common abbreviations and acronyms that shouldn't be flagged
const KNOWN_ABBREVIATIONS = new Set([
  "mr", "mrs", "ms", "dr", "prof", "gen", "col", "sgt", "capt",
  "etc", "eg", "ie", "vs", "al", "id", "no", "co", "inc", "ltd",
  "api", "url", "http", "https", "ftp", "sql", "html", "css", "xml",
  "json", "csv", "pdf", "png", "jpg", "jpeg", "gif", "svg", "mp4",
  "mp3", "exe", "zip", "rar", "iso", "ai", "ml", "cv", "ir",
  "utc", "gmt", "pst", "est", "cst", "mst", "usa", "uk", "us",
  "hr", "min", "sec", "ms", "kb", "mb", "gb", "tb", "hz", "khz",
  "mhz", "ghz", "cpu", "gpu", "ram", "rom", "io", "ui", "ux",
]);

function extractWords(text) {
  // Extract words from text, handling markdown syntax
  return text
    .toLowerCase()
    .replace(/[#*_`\[\](){}|\\]/g, " ") // Remove markdown syntax
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

function isValidWord(word) {
  const cleanWord = word.replace(/[^\w'-]/g, "").toLowerCase();
  if (cleanWord.length === 0) return true;
  if (cleanWord.length <= 2) return true;
  if (/^\d+/.test(cleanWord)) return true; // Numbers
  if (COMMON_WORDS.has(cleanWord)) return true;
  if (KNOWN_ABBREVIATIONS.has(cleanWord)) return true;
  if (cleanWord.includes("-")) return true; // Hyphenated words often valid
  if (cleanWord.endsWith("ing") || cleanWord.endsWith("ed") || cleanWord.endsWith("ly")) return true;
  return false;
}

function levenshteinDistance(left, right) {
  const a = left || "";
  const b = right || "";
  const rows = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));

  for (let row = 0; row <= a.length; row += 1) rows[row][0] = row;
  for (let column = 0; column <= b.length; column += 1) rows[0][column] = column;

  for (let row = 1; row <= a.length; row += 1) {
    for (let column = 1; column <= b.length; column += 1) {
      const cost = a[row - 1] === b[column - 1] ? 0 : 1;
      rows[row][column] = Math.min(
        rows[row - 1][column] + 1,
        rows[row][column - 1] + 1,
        rows[row - 1][column - 1] + cost
      );
    }
  }

  return rows[a.length][b.length];
}

function suggestCorrection(word) {
  const cleanWord = word.replace(/[^\w'-]/g, "").toLowerCase();
  if (!cleanWord) return "";

  const candidates = [...COMMON_WORDS, ...KNOWN_ABBREVIATIONS].filter((candidate) => candidate.length > 2);
  let bestCandidate = "";
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const distance = levenshteinDistance(cleanWord, candidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestCandidate = candidate;
    }
  }

  return bestDistance <= 2 ? bestCandidate : "";
}

function collectInlineText(children) {
  let output = "";

  for (const child of children || []) {
    if (child.type === "text") {
      output += child.content || "";
      continue;
    }

    if (child.type === "softbreak" || child.type === "hardbreak") {
      output += " ";
      continue;
    }

    if (child.type === "code_inline" || child.type === "image" || child.type === "html_inline") {
      continue;
    }

    if (Array.isArray(child.children) && child.children.length) {
      output += collectInlineText(child.children);
    }
  }

  return output;
}

function preprocessMarkdownForLanguageChecks(content) {
  return (content || "")
    .replace(/!\[([^\]]*)\]\((<[^>]+>|[^)]+)\)/g, " ")
    .replace(/\[([^\]]+)\]\((<[^>]+>|[^)]+)\)/g, (match, linkText) => linkText || "")
    .replace(/\[([^\]]+)\]\[([^\]]*)\]/g, (match, linkText) => linkText || "")
    .replace(/^\s*\[[^\]]+\]:\s+.+$/gm, "")
    .replace(/<([^\s>]+)>/g, (match, inner) => inner || "");
}

function isSentenceLike(text) {
  const normalized = stripMarkdownArtifacts(text || "");
  if (!normalized) return false;

  if (/[.!?]["')\]]*$/.test(normalized)) {
    return true;
  }

  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  return wordCount >= 5 && normalized.length >= 20;
}

function isProseLike(text) {
  const normalized = stripMarkdownArtifacts(text || "");
  if (!normalized) return false;

  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  return wordCount >= 1;
}

function stripMarkdownArtifacts(text) {
  return (text || "")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/www\.\S+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isStandaloneLowercaseWord(text) {
  const normalized = stripMarkdownArtifacts(text || "");
  if (!normalized) return false;

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length !== 1) return false;

  const word = words[0].replace(/[^\w'-]/g, "");
  return /^[a-z][a-z'-]{3,}$/.test(word);
}

function shouldSpellCheckLine(text, blockType) {
  const normalized = stripMarkdownArtifacts(text || "");
  if (!normalized) return false;

  if (isSentenceLike(normalized)) {
    return true;
  }

  if (blockType === "heading_open") {
    return false;
  }

  return isStandaloneLowercaseWord(normalized);
}

function extractMarkdownProseLines(content) {
  const normalizedContent = preprocessMarkdownForLanguageChecks(content);
  const tokens = markdownParser.parse(normalizedContent || "", {});
  const proseBlockTypes = new Set([
    "paragraph_open",
    "heading_open",
    "blockquote_open",
    "list_item_open",
  ]);
  const lines = [];
  const openStack = [];

  for (const token of tokens) {
    if (token.type.endsWith("_open")) {
      openStack.push({
        type: token.type,
        line: Number.isFinite(token.map?.[0]) ? token.map[0] + 1 : null,
      });
    }

    if (token.type === "inline") {
      const inProseBlock = openStack.some((entry) => proseBlockTypes.has(entry.type));
      if (inProseBlock) {
        const extracted = stripMarkdownArtifacts(collectInlineText(token.children));
        if (extracted) {
          const visibleLines = extracted.split(/\n+/).filter(Boolean);
          const baseLine =
            Number.isFinite(token.map?.[0])
              ? token.map[0] + 1
              : (openStack.slice().reverse().find((entry) => Number.isFinite(entry.line))?.line || 1);

          visibleLines.forEach((lineText, index) => {
            if (isSentenceLike(lineText)) {
              lines.push({ line: baseLine + index, text: lineText });
            }
          });
        }
      }
    }

    if (token.type.endsWith("_close")) {
      openStack.pop();
    }
  }

  return lines;
}

function extractMarkdownSpellingLines(content) {
  const normalizedContent = preprocessMarkdownForLanguageChecks(content);
  const tokens = markdownParser.parse(normalizedContent || "", {});
  const proseBlockTypes = new Set([
    "paragraph_open",
    "heading_open",
    "blockquote_open",
    "list_item_open",
  ]);
  const lines = [];
  const openStack = [];

  for (const token of tokens) {
    if (token.type.endsWith("_open")) {
      openStack.push({
        type: token.type,
        line: Number.isFinite(token.map?.[0]) ? token.map[0] + 1 : null,
      });
    }

    if (token.type === "inline") {
      const inProseBlock = openStack.some((entry) => proseBlockTypes.has(entry.type));
      if (inProseBlock) {
        const extracted = stripMarkdownArtifacts(collectInlineText(token.children));
        if (extracted) {
          const visibleLines = extracted.split(/\n+/).filter(Boolean);
          const baseLine =
            Number.isFinite(token.map?.[0])
              ? token.map[0] + 1
              : (openStack.slice().reverse().find((entry) => Number.isFinite(entry.line))?.line || 1);
          const blockType = openStack.slice().reverse().find((entry) => proseBlockTypes.has(entry.type))?.type || null;

          visibleLines.forEach((lineText, index) => {
            if (shouldSpellCheckLine(lineText, blockType)) {
              lines.push({ line: baseLine + index, text: lineText });
            }
          });
        }
      }
    }

    if (token.type.endsWith("_close")) {
      openStack.pop();
    }
  }

  return lines;
}

function maskMarkdownCodePreservingLayout(text) {
  const lines = (text || "").split("\n");
  const maskedLines = [];
  let inCodeBlock = false;
  let fenceMarker = "";

  for (const line of lines) {
    const trimmed = line.trim();
    const fenceMatch = trimmed.match(/^(```+|~~~+)/);

    if (fenceMatch) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        fenceMarker = fenceMatch[1];
      } else if (trimmed.startsWith(fenceMarker)) {
        inCodeBlock = false;
        fenceMarker = "";
      }

      maskedLines.push(" ".repeat(line.length));
      continue;
    }

    if (inCodeBlock) {
      maskedLines.push(" ".repeat(line.length));
      continue;
    }

    maskedLines.push(line.replace(/`[^`]*`/g, (match) => " ".repeat(match.length)));
  }

  return maskedLines.join("\n");
}

export async function checkSpelling(content) {
  const text = content || "";
  const issues = [];

  const proseLines = extractMarkdownSpellingLines(text);

  for (const proseLine of proseLines) {
    const line = proseLine.text;
    const wordRegex = /[A-Za-z][A-Za-z0-9'-]*/g;
    let match;

    while ((match = wordRegex.exec(line))) {
      const word = match[0];
      if (!isValidWord(word)) {
        const suggestion = suggestCorrection(word);
        issues.push({
          line: proseLine.line,
          column: match.index + 1,
          message: `Possible spelling: "${word}"`,
          ruleId: "spelling",
          severity: "warning",
          length: word.length,
          word,
          suggestion,
        });
      }
    }
  }

  return issues;
}

export async function checkGrammar(content) {
  // Use LanguageTool API for grammar checking
  const text = content || "";
  const proseLines = extractMarkdownProseLines(text);
  if (!proseLines.length) {
    return [];
  }

  const grammarInput = proseLines.map((item) => item.text).join("\n");

  try {
    // LanguageTool has a free public API
    const response = await fetch("https://api.languagetool.org/v2/check", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        text: grammarInput,
        language: "en-US",
      }).toString(),
    });

    if (!response.ok) {
      console.error("LanguageTool API error:", response.status);
      return [];
    }

    const data = await response.json();
    const issues = [];
    const lineOffsets = [];
    let cursor = 0;

    for (const proseLine of proseLines) {
      lineOffsets.push({
        line: proseLine.line,
        start: cursor,
        end: cursor + proseLine.text.length,
      });
      cursor += proseLine.text.length + 1;
    }

    function findLineForOffset(offset) {
      for (const entry of lineOffsets) {
        if (offset >= entry.start && offset <= entry.end) {
          return entry;
        }
      }
      return lineOffsets[lineOffsets.length - 1] || { line: 1, start: 0, end: 0 };
    }

    (data.matches || []).forEach((match) => {
      // Skip some overly pedantic rules
      if (
        match.rule?.id === "WHITESPACE_RULE" ||
        match.rule?.id === "COMMA_PARENTHESIS_WHITESPACE"
      ) {
        return;
      }

      const offset = match.offset || 0;
      const length = match.length || 0;
      const lineEntry = findLineForOffset(offset);
      const line = lineEntry.line;
      const column = Math.max(1, offset - lineEntry.start + 1);

      issues.push({
        line,
        column,
        message: match.message || "Grammar issue",
        ruleId: match.rule?.id || "grammar",
        severity: match.rule?.issueType === "misspelling" ? "error" : "info",
        suggestion: (match.replacements || [])[0]?.value,
        length,
      });
    });

    return issues;
  } catch (error) {
    console.error("Grammar check failed:", error);
    return [];
  }
}

export async function checkSpellingAndGrammar(content) {
  try {
    const [spellingIssues, grammarIssues] = await Promise.all([
      checkSpelling(content),
      checkGrammar(content),
    ]);

    // Combine and deduplicate issues
    const combined = [...spellingIssues, ...grammarIssues];
    combined.sort((a, b) => {
      if (a.line !== b.line) return a.line - b.line;
      return (a.column || 1) - (b.column || 1);
    });

    return combined;
  } catch (error) {
    console.error("Spell and grammar check failed:", error);
    return [];
  }
}
