/**
 * Complete markdown validation with spell checking, grammar checking, and linting
 */

import { validateMarkdownSyntax } from "./markdownValidation";
import { checkSpellingAndGrammar } from "./spellAndGrammarCheck";

export async function validateMarkdownComplete(content) {
  const text = content || "";
  
  // Get markdown syntax and table issues
  const syntaxIssues = await validateMarkdownSyntax(text);
  
  // Get spelling and grammar issues
  const spellGrammarIssues = await checkSpellingAndGrammar(text);
  
  // Combine all issues
  const allIssues = [...syntaxIssues, ...spellGrammarIssues];
  
  // Sort by line and column
  return allIssues.sort((left, right) => {
    if (left.line !== right.line) return left.line - right.line;
    return (left.column || 1) - (right.column || 1);
  });
}
