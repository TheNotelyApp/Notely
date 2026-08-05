/**
 * DeterministicSemanticMiner - Pattern-based semantic relationship extraction engine
 * Extracts rich domain relationships (USES, DEPENDS_ON, IMPLEMENTS, COMMUNICATES_WITH, WORKS_ON)
 * directly from prose text to complement neural GLiNER2-Relex extraction.
 */

const PATTERNS = [
  {
    regex: /\b([A-Za-z0-9_-]{2,})\s+(?:uses|is built with|relies on|utilizes|powered by)\s+([A-Za-z0-9_-]{2,})\b/gi,
    type: 'USES',
    confidence: 0.90
  },
  {
    regex: /\b([A-Za-z0-9_-]{2,})\s+(?:depends on|requires|needs)\s+([A-Za-z0-9_-]{2,})\b/gi,
    type: 'DEPENDS_ON',
    confidence: 0.92
  },
  {
    regex: /\b([A-Za-z0-9_-]{2,})\s+(?:generates|produces|creates|renders)\s+([A-Za-z0-9_-]{2,})\b/gi,
    type: 'GENERATES',
    confidence: 0.90
  },
  {
    regex: /\b([A-Za-z0-9_-]{2,})\s+(?:integrates with|connects to|calls|communicates with|sends data to)\s+([A-Za-z0-9_-]{2,})\b/gi,
    type: 'INTEGRATES_WITH',
    confidence: 0.88
  },
  {
    regex: /\b([A-Za-z0-9_-]{2,})\s+(?:implements|extends|inherits from)\s+([A-Za-z0-9_-]{2,})\b/gi,
    type: 'IMPLEMENTS',
    confidence: 0.92
  },
  {
    regex: /\b([A-Za-z0-9_-]{2,})\s+(?:enables|allows|empowers|unlocks)\s+([A-Za-z0-9_-]{2,}(?:\s+[A-Za-z0-9_-]{2,})?)\b/gi,
    type: 'ENABLES',
    confidence: 0.90
  },
  {
    regex: /\b([A-Za-z0-9_-]{2,})\s+(?:supports|handles|accommodates)\s+([A-Za-z0-9_-]{2,})\b/gi,
    type: 'SUPPORTS',
    confidence: 0.90
  },
  {
    regex: /\b(?:Connect|Use|Integrate)\s+([A-Za-z0-9_-]+(?:\s+or\s+[A-Za-z0-9_-]+)?)\s+(?:API|keys|service|model)\b/gi,
    type: 'USES_TECHNOLOGY',
    confidence: 0.92
  },
  {
    regex: /\b([A-Z][a-zA-Z0-9_-]{2,})\s+(?:Integration|Support|Search|Chat|Graph|Engine|Adapter|Parser)\b/g,
    type: 'FEATURE_CONCEPT',
    confidence: 0.88
  },
  {
    regex: /\b([A-Za-z0-9_-]{2,})\s+(?:works on|maintains|manages|leads)\s+([A-Za-z0-9_-]{2,})\b/gi,
    type: 'WORKS_ON',
    confidence: 0.88
  },
  {
    regex: /\b([A-Z][a-zA-Z0-9_-]{2,})\s+(?:tool|framework|library|database|api|engine|protocol|diagram|service|module)\b/gi,
    type: 'USES_TECHNOLOGY',
    confidence: 0.92
  }
];

class DeterministicSemanticMiner {
  /**
   * Mine text for semantic relationships
   * @param {string} text Raw or cleansed text
   * @returns {Array<{ sourceText: string, targetText: string, type: string, confidence: number, rawSentence: string }>}
   */
  mine(text = '') {
    if (!text || typeof text !== 'string') return [];
    const results = [];
    const seen = new Set();

    // Split text into sentences
    const sentences = text.split(/(?<=[.!?])\s+/);

    for (const sentence of sentences) {
      const cleanSent = sentence.trim();
      if (cleanSent.length < 10) continue;

      for (const pattern of PATTERNS) {
        pattern.regex.lastIndex = 0;
        let match;
        while ((match = pattern.regex.exec(cleanSent)) !== null) {
          const src = match[1] ? match[1].trim() : '';
          const tgt = match[2] ? match[2].trim() : '';

          const STOP_WORDS = new Set(['this', 'that', 'these', 'those', 'it', 'they', 'we', 'you', 'he', 'she', 'what', 'which', 'who', 'where', 'when', 'why', 'how', 'a', 'an', 'the', 'and', 'or', 'but', 'if', 'else', 'for', 'not', 'workspace', 'column', 'value', 'again', 'test', 'diagram', 'screenshot', 'image', 'interactive', 'search', 'connect', 'visualize']);
          if (STOP_WORDS.has(src.toLowerCase()) || (tgt && STOP_WORDS.has(tgt.toLowerCase()))) continue;

          // Reject noise strings, HTML/Markdown attributes, long terms > 25 chars
          if (src.length > 25 || (tgt && tgt.length > 25)) continue;
          if (/[{}=|]|\bdata-|\bvalue \d|\bcolumn \d/i.test(src) || (tgt && /[{}=|]|\bdata-|\bvalue \d|\bcolumn \d/i.test(tgt))) continue;

          if (src && (tgt ? src.toLowerCase() !== tgt.toLowerCase() : true)) {
            const key = `${src}:${pattern.type}:${tgt || 'Concept'}`;
            if (!seen.has(key)) {
              seen.add(key);
              results.push({
                sourceText: src,
                targetText: tgt || src,
                type: pattern.type,
                confidence: pattern.confidence,
                rawSentence: cleanSent
              });
            }
          }
        }
      }
    }

    return results;
  }
}

module.exports = DeterministicSemanticMiner;
