/**
 * DocumentExtractor.cjs
 * Unified facade for extracting structured text and metadata from supported document files.
 */

const path = require('path');
const { extractPdf } = require('./PdfExtractor.cjs');
const { extractDocx } = require('./DocxExtractor.cjs');
const { extractPptx } = require('./PptxExtractor.cjs');
const { extractSpreadsheet } = require('./SpreadsheetExtractor.cjs');

const SUPPORTED_EXTENSIONS = new Set([
  '.pdf',
  '.docx',
  '.pptx',
  '.xlsx',
  '.xls',
  '.csv',
]);

function isSupportedDocument(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
}

function getDocumentMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.pdf':
      return 'application/pdf';
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case '.pptx':
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    case '.xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case '.xls':
      return 'application/vnd.ms-excel';
    case '.csv':
      return 'text/csv';
    default:
      return 'application/octet-stream';
  }
}

async function extractDocument(filePath, options = {}) {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case '.pdf':
      return await extractPdf(filePath, options);
    case '.docx':
      return await extractDocx(filePath, options);
    case '.pptx':
      return await extractPptx(filePath, options);
    case '.xlsx':
    case '.xls':
    case '.csv':
      return await extractSpreadsheet(filePath, options);
    default:
      return {
        success: false,
        status: 'failed',
        error: `Unsupported document format: ${ext}`,
        pageCount: 0,
        wordCount: 0,
        markdown: '',
        text: '',
      };
  }
}

module.exports = {
  SUPPORTED_EXTENSIONS,
  isSupportedDocument,
  getDocumentMimeType,
  extractDocument,
};
