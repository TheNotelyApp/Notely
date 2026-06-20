/**
 * Complete markdown validation with typo checking and linting
 */

import { validateMarkdownSyntax } from "./markdownValidation";
import { checkSpelling } from "./spellAndGrammarCheck";

export async function validateMarkdownComplete(content) {
  const text = content || "";

  // Get markdown syntax and table issues
  const syntaxIssues = await validateMarkdownSyntax(text);

  // Get typo issues only
  const spellingIssues = await checkSpelling(text);

  // Combine all issues
  const allIssues = [...syntaxIssues, ...spellingIssues];

  // Sort by line and column
  return allIssues.sort((left, right) => {
    if (left.line !== right.line) return left.line - right.line;
    return (left.column || 1) - (right.column || 1);
  });
}
