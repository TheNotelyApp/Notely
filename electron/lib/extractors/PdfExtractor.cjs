/**
 * PdfExtractor.cjs
 * Extracts text and metadata from PDF files using pdfjs-dist.
 */

const fs = require('fs');

async function extractPdf(filePath, _options = {}) {
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
    const uint8Array = new Uint8Array(dataBuffer);

    // Dynamically load pdfjs-dist
    const pdfjs = await import('pdfjs-dist');
    let loadingTask = null;
    let pdfDoc = null;

    try {
      loadingTask = pdfjs.getDocument({
        data: uint8Array,
        useSystemFonts: true,
        disableFontFace: true,
        verbosity: 0,
      });

      try {
        pdfDoc = await loadingTask.promise;
      } catch (docErr) {
        if (docErr && (docErr.name === 'PasswordException' || String(docErr.message || '').toLowerCase().includes('password'))) {
          return {
            success: false,
            status: 'encrypted',
            error: 'PDF is password protected',
            pageCount: 0,
            wordCount: 0,
            markdown: '',
            text: '',
          };
        }
        return {
          success: false,
          status: 'failed',
          error: docErr.message || 'Failed to open PDF document',
          pageCount: 0,
          wordCount: 0,
          markdown: '',
          text: '',
        };
      }

      const numPages = pdfDoc.numPages;
      const pageTexts = [];
      let totalWords = 0;

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        try {
          const page = await pdfDoc.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          let lastY = null;
          const lineParts = [];
          let currentLine = [];

          for (const item of textContent.items) {
            if (!item || typeof item.str !== 'string') continue;
            const str = item.str;
            if (!str.trim() && item.hasEOL) {
              if (currentLine.length > 0) {
                lineParts.push(currentLine.join(' '));
                currentLine = [];
              }
              continue;
            }

            const y = item.transform ? item.transform[5] : null;
            if (lastY !== null && y !== null && Math.abs(y - lastY) > 5) {
              if (currentLine.length > 0) {
                lineParts.push(currentLine.join(' '));
                currentLine = [];
              }
            }
            if (str.trim()) {
              currentLine.push(str.trim());
            }
            lastY = y;
          }

          if (currentLine.length > 0) {
            lineParts.push(currentLine.join(' '));
          }

          const pageString = lineParts.join('\n\n').trim();
          pageTexts.push({
            pageNumber: pageNum,
            text: pageString,
          });

          if (pageString) {
            const words = pageString.split(/\s+/).filter(Boolean);
            totalWords += words.length;
          }
        } catch (pageErr) {
          pageTexts.push({
            pageNumber: pageNum,
            text: `[Page ${pageNum} text extraction failed: ${pageErr.message}]`,
          });
        }
      }

      const hasAnyText = pageTexts.some((p) => p.text && p.text.trim().length > 0);
      const status = !hasAnyText ? 'empty' : 'ready';

      // Format into clean Markdown
      const markdownChunks = [];
      for (const p of pageTexts) {
        if (numPages > 1) {
          markdownChunks.push(`### Page ${p.pageNumber}\n\n${p.text || '*(No text layer / scanned image)*'}`);
        } else {
          markdownChunks.push(p.text || '*(No text layer / scanned image)*');
        }
      }

      const fullMarkdown = markdownChunks.join('\n\n---\n\n');
      const fullPlainText = pageTexts.map((p) => p.text).filter(Boolean).join('\n\n');

      return {
        success: status === 'ready',
        status,
        pageCount: numPages,
        wordCount: totalWords,
        markdown: fullMarkdown,
        text: fullPlainText,
        error: status === 'empty' ? 'Document has no extractable text layer (may be a scanned image)' : null,
      };
    } finally {
      if (pdfDoc) {
        try {
          await pdfDoc.cleanup?.();
          await pdfDoc.destroy?.();
        } catch {
          // ignore cleanup error
        }
      }
      if (loadingTask) {
        try {
          await loadingTask.destroy?.();
        } catch {
          // ignore destroy error
        }
      }
    }
  } catch (err) {
    return {
      success: false,
      status: 'failed',
      error: err.message || 'Unexpected PDF extraction error',
      pageCount: 0,
      wordCount: 0,
      markdown: '',
      text: '',
    };
  }
}

module.exports = {
  extractPdf,
};
