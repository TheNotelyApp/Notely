/**
 * PptxExtractor.cjs
 * Extracts slide-by-slide structured Markdown and speaker notes from .pptx files using JSZip.
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

function parseSlideXml(xmlString) {
  const lines = [];

  // Match paragraphs <a:p>...</a:p>
  const paragraphMatches = xmlString.match(/<a:p[\s>][\s\S]*?<\/a:p>/gi) || [];

  for (const pXml of paragraphMatches) {
    const textMatches = pXml.match(/<a:t(?:\s+[^>]*)?>([\s\S]*?)<\/a:t>/gi) || [];
    const text = textMatches
      .map((t) => {
        const inner = t.replace(/^<a:t(?:\s+[^>]*)?>/i, '').replace(/<\/a:t>$/i, '');
        return decodeXmlEntities(inner);
      })
      .join('')
      .trim();

    if (text) {
      lines.push(text);
    }
  }

  return lines;
}

async function extractPptx(filePath, _options = {}) {
  try {
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        status: 'failed',
        error: `File not found: ${filePath}`,
        pageCount: 0,
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
        error: `Corrupted PPTX zip archive: ${zipErr.message}`,
        pageCount: 0,
        wordCount: 0,
        markdown: '',
        text: '',
      };
    }

    // Find all slide files and sort them numerically (slide1.xml, slide2.xml...)
    const slideFileNames = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] || '0', 10);
        const numB = parseInt(b.match(/\d+/)?.[0] || '0', 10);
        return numA - numB;
      });

    if (slideFileNames.length === 0) {
      return {
        success: false,
        status: 'empty',
        error: 'No slides found in presentation',
        pageCount: 0,
        wordCount: 0,
        markdown: '',
        text: '',
      };
    }

    const slideChunks = [];
    let totalWords = 0;

    for (let idx = 0; idx < slideFileNames.length; idx++) {
      const slideFileName = slideFileNames[idx];
      const slideNum = idx + 1;
      const slideFile = zip.file(slideFileName);
      if (!slideFile) continue;

      const xml = await slideFile.async('string');
      const lines = parseSlideXml(xml);

      // Check if speaker notes exist for this slide
      const notesFileName = `ppt/notesSlides/notesSlide${slideNum}.xml`;
      const notesFile = zip.file(notesFileName);
      let notesText = '';
      if (notesFile) {
        try {
          const notesXml = await notesFile.async('string');
          const notesLines = parseSlideXml(notesXml);
          notesText = notesLines.filter((l) => !/slide\s*\d+/i.test(l)).join(' ').trim();
        } catch {
          // ignore notes failure
        }
      }

      const slideTitle = lines[0] ? `: ${lines[0]}` : '';
      const slideBody = lines.slice(lines[0] ? 1 : 0);

      const sectionLines = [`### Slide ${slideNum}${slideTitle}`];
      if (slideBody.length > 0) {
        sectionLines.push('');
        slideBody.forEach((l) => sectionLines.push(`* ${l}`));
      }
      if (notesText) {
        sectionLines.push('');
        sectionLines.push(`> 💡 **Notes:** ${notesText}`);
      }

      const slideMd = sectionLines.join('\n');
      slideChunks.push(slideMd);

      const fullSlideText = `${lines.join(' ')} ${notesText}`;
      const words = fullSlideText.split(/\s+/).filter(Boolean);
      totalWords += words.length;
    }

    const fullMarkdown = slideChunks.join('\n\n---\n\n');
    const fullPlainText = fullMarkdown.replace(/^#+\s+/gm, '').replace(/^\*\s+/gm, '').replace(/^>\s+/gm, '');
    const status = totalWords === 0 ? 'empty' : 'ready';

    return {
      success: status === 'ready',
      status,
      pageCount: slideFileNames.length,
      wordCount: totalWords,
      markdown: fullMarkdown,
      text: fullPlainText,
      error: status === 'empty' ? 'Presentation contains no text in slides' : null,
    };
  } catch (err) {
    return {
      success: false,
      status: 'failed',
      error: err.message || 'Unexpected PPTX extraction error',
      pageCount: 0,
      wordCount: 0,
      markdown: '',
      text: '',
    };
  }
}

module.exports = {
  extractPptx,
};
