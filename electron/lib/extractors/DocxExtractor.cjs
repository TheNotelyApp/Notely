/**
 * DocxExtractor.cjs
 * Extracts structured Markdown text from .docx files using JSZip and OpenXML parsing.
 */

const fs = require('fs');
const JSZip = require('jszip');

function decodeXmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function parseDocxXml(xmlString) {
  const blocks = [];

  // Match paragraphs and tables
  // We can process top-level paragraphs and tables by regex/token scanning
  const blockRegex = /<(w:p|w:tbl)([\s>][\s\S]*?<\/\1>|<w:p\/>|<w:tbl\/>)/gi;
  let match;

  while ((match = blockRegex.exec(xmlString)) !== null) {
    const tag = match[1];
    const content = match[0];

    if (tag === 'w:p') {
      // Check heading style
      const styleMatch = content.match(/<w:pStyle\s+[^>]*?w:val="([^"]+)"/i);
      const style = styleMatch ? styleMatch[1] : '';

      // Check if list item
      const isListItem = /<w:numPr>/i.test(content);

      // Extract all text nodes <w:t ...>text</w:t> or <w:t>text</w:t>
      const textMatches = content.match(/<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/gi) || [];
      const text = textMatches
        .map((t) => {
          const inner = t.replace(/^<w:t(?:\s+[^>]*)?>/i, '').replace(/<\/w:t>$/i, '');
          return decodeXmlEntities(inner);
        })
        .join('');

      const cleanText = text.trim();
      if (!cleanText) continue;

      if (/^Heading\s*1$/i.test(style) || /^Title$/i.test(style)) {
        blocks.push(`# ${cleanText}`);
      } else if (/^Heading\s*2$/i.test(style) || /^Subtitle$/i.test(style)) {
        blocks.push(`## ${cleanText}`);
      } else if (/^Heading\s*3$/i.test(style)) {
        blocks.push(`### ${cleanText}`);
      } else if (/^Heading\s*4$/i.test(style)) {
        blocks.push(`#### ${cleanText}`);
      } else if (isListItem) {
        blocks.push(`* ${cleanText}`);
      } else {
        blocks.push(cleanText);
      }
    } else if (tag === 'w:tbl') {
      // Table processing
      const rows = [];
      const rowMatches = content.match(/<w:tr[\s>][\s\S]*?<\/w:tr>/gi) || [];

      for (const rowXml of rowMatches) {
        const cells = [];
        const cellMatches = rowXml.match(/<w:tc[\s>][\s\S]*?<\/w:tc>/gi) || [];
        for (const cellXml of cellMatches) {
          const textMatches = cellXml.match(/<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/gi) || [];
          const cellText = textMatches
            .map((t) => {
              const inner = t.replace(/^<w:t(?:\s+[^>]*)?>/i, '').replace(/<\/w:t>$/i, '');
              return decodeXmlEntities(inner);
            })
            .join(' ')
            .replace(/\r?\n|\r/g, ' ')
            .trim();
          cells.push(cellText);
        }
        if (cells.length > 0) {
          rows.push(cells);
        }
      }

      if (rows.length > 0) {
        // Build Markdown table
        const maxCols = Math.max(...rows.map((r) => r.length));
        if (maxCols > 0) {
          const paddedRows = rows.map((r) => {
            while (r.length < maxCols) r.push('');
            return r;
          });

          const header = paddedRows[0];
          const mdTableLines = [];
          mdTableLines.push(`| ${header.map((c) => c || ' ').join(' | ')} |`);
          mdTableLines.push(`| ${header.map(() => '---').join(' | ')} |`);

          for (let i = 1; i < paddedRows.length; i++) {
            mdTableLines.push(`| ${paddedRows[i].map((c) => c || ' ').join(' | ')} |`);
          }
          blocks.push(mdTableLines.join('\n'));
        }
      }
    }
  }

  return blocks;
}

async function extractDocx(filePath, _options = {}) {
  try {
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        status: 'failed',
        error: `File not found: ${filePath}`,
        pageCount: 1,
        wordCount: 0,
        markdown: '',
        text: '',
      };
    }

    const dataBuffer = fs.readFileSync(filePath);
    let zip;
    try {
      zip = await JSZip.loadAsync(dataBuffer);
    } catch (zipErr) {
      return {
        success: false,
        status: 'failed',
        error: `Corrupted DOCX zip archive: ${zipErr.message}`,
        pageCount: 1,
        wordCount: 0,
        markdown: '',
        text: '',
      };
    }

    const docFile = zip.file('word/document.xml');
    if (!docFile) {
      return {
        success: false,
        status: 'failed',
        error: 'Invalid DOCX: missing word/document.xml',
        pageCount: 1,
        wordCount: 0,
        markdown: '',
        text: '',
      };
    }

    const xmlString = await docFile.async('string');
    const blocks = parseDocxXml(xmlString);

    const fullMarkdown = blocks.join('\n\n');
    const fullPlainText = fullMarkdown.replace(/^#+\s+/gm, '').replace(/^\*\s+/gm, '');
    const wordCount = fullPlainText.split(/\s+/).filter(Boolean).length;
    const status = wordCount === 0 ? 'empty' : 'ready';

    return {
      success: status === 'ready',
      status,
      pageCount: 1,
      wordCount,
      markdown: fullMarkdown,
      text: fullPlainText,
      error: status === 'empty' ? 'Document contains no text content' : null,
    };
  } catch (err) {
    return {
      success: false,
      status: 'failed',
      error: err.message || 'Unexpected DOCX extraction error',
      pageCount: 1,
      wordCount: 0,
      markdown: '',
      text: '',
    };
  }
}

module.exports = {
  extractDocx,
};
