/**
 * SearchQueryUtils.js
 * Utility for parsing, extracting, and normalizing search keywords from natural language user queries.
 */

const STOP_WORDS = new Set([
  'a', 'about', 'aboout', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and',
  'any', 'anything', 'are', 'aren\'t', 'as', 'at', 'be', 'because', 'been', 'before', 'being',
  'below', 'between', 'both', 'but', 'by', 'can', 'can\'t', 'cannot', 'check', 'could', 'couldn\'t',
  'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during', 'each',
  'few', 'file', 'files', 'find', 'for', 'from', 'further', 'get', 'got', 'had', 'hadn\'t',
  'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her',
  'here', 'here\'s', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'how\'s', 'i',
  'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it', 'it\'s',
  'its', 'itself', 'let\'s', 'list', 'look', 'me', 'more', 'most', 'mustn\'t', 'my',
  'myself', 'no', 'nor', 'not', 'note', 'notes', 'of', 'off', 'on', 'once', 'only',
  'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'please',
  'read', 'search', 'see', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should',
  'shouldn\'t', 'show', 'so', 'some', 'such', 'tell', 'than', 'that', 'that\'s', 'the',
  'their', 'theirs', 'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they',
  'they\'d', 'they\'ll', 'they\'re', 'they\'ve', 'thing', 'things', 'this', 'those',
  'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we',
  'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when',
  'when\'s', 'where', 'where\'s', 'which', 'while', 'who', 'who\'s', 'whom', 'why',
  'why\'s', 'with', 'won\'t', 'workspace', 'workspaces', 'would', 'wouldn\'t', 'you',
  'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves'
]);

/**
 * Extract clean, high-signal search keywords from a raw natural language query.
 * @param {string} query Raw user prompt string
 * @returns {Array<string>} List of cleaned, lowercased keyword tokens
 */
function extractSearchKeywords(query = '') {
  if (!query || typeof query !== 'string') return [];

  // Normalize: lower case and replace punctuation with spaces
  const cleaned = query.toLowerCase().replace(/[^a-z0-9_\-\s]/g, ' ');
  const tokens = cleaned.split(/\s+/).filter(Boolean);

  // Filter out stop words and short filler tokens (unless token is length >= 2)
  const keywords = tokens.filter(t => !STOP_WORDS.has(t) && t.length >= 2);

  // Fallback: If stop-word filtering removed everything, return non-empty tokens
  if (keywords.length === 0 && tokens.length > 0) {
    return tokens.filter(t => t.length >= 2);
  }

  return keywords;
}

/**
 * Build a sanitized search query string suitable for keyword or vector search.
 * @param {string} query
 * @returns {string}
 */
function normalizeSearchQuery(query = '') {
  const keywords = extractSearchKeywords(query);
  return keywords.length > 0 ? keywords.join(' ') : query.trim();
}

module.exports = {
  STOP_WORDS,
  extractSearchKeywords,
  normalizeSearchQuery
};
