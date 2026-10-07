/**
 * SpreadsheetExtractor.cjs
 * Extracts tabular structured Markdown from .xlsx, .xls, and .csv files using SheetJS (xlsx).
 */

const fs = require('fs');
const XLSX = require('xlsx');

async function extractSpreadsheet(filePath, _options = {}) {
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
    let workbook;
    try {
      workbook = XLSX.read(dataBuffer, { type: 'buffer' });
    } catch (parseErr) {
      return {
        success: false,
        status: 'failed',
        error: `Failed to parse spreadsheet: ${parseErr.message}`,
        pageCount: 0,
        wordCount: 0,
        markdown: '',
        text: '',
      };
    }

    const sheetNames = workbook.SheetNames || [];
    if (sheetNames.length === 0) {
      return {
        success: false,
        status: 'empty',
        error: 'No sheets found in workbook',
        pageCount: 0,
        wordCount: 0,
        markdown: '',
        text: '',
      };
    }

    const sheetSections = [];
    let totalWords = 0;

    for (const sheetName of sheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      if (!rows || rows.length === 0) continue;

      // Filter out completely empty rows
      const nonEmptyRows = rows.filter((r) => Array.isArray(r) && r.some((c) => String(c).trim().length > 0));
      if (nonEmptyRows.length === 0) continue;

      const maxCols = Math.max(...nonEmptyRows.map((r) => r.length));
      if (maxCols === 0) continue;

      const paddedRows = nonEmptyRows.map((r) => {
        const rowCopy = [...r];
        while (rowCopy.length < maxCols) rowCopy.push('');
        return rowCopy.map((c) => String(c ?? '').replace(/\|/g, '\\|').replace(/\r?\n|\r/g, ' ').trim());
      });

      const header = paddedRows[0];
      const mdTableLines = [];
      mdTableLines.push(`### Sheet: ${sheetName}\n`);
      mdTableLines.push(`| ${header.map((c) => c || ' ').join(' | ')} |`);
      mdTableLines.push(`| ${header.map(() => '---').join(' | ')} |`);

      for (let i = 1; i < paddedRows.length; i++) {
        mdTableLines.push(`| ${paddedRows[i].map((c) => c || ' ').join(' | ')} |`);
      }

      const sheetMd = mdTableLines.join('\n');
      sheetSections.push(sheetMd);

      const sheetRawText = paddedRows.map((r) => r.join(' ')).join(' ');
      const words = sheetRawText.split(/\s+/).filter(Boolean);
      totalWords += words.length;
    }

    const fullMarkdown = sheetSections.join('\n\n---\n\n');
    const fullPlainText = fullMarkdown.replace(/^#+\s+/gm, '').replace(/\|/g, ' ');
    const status = totalWords === 0 ? 'empty' : 'ready';

    return {
      success: status === 'ready',
      status,
      pageCount: sheetNames.length,
      wordCount: totalWords,
      markdown: fullMarkdown,
      text: fullPlainText,
      error: status === 'empty' ? 'Spreadsheet contains no data' : null,
    };
  } catch (err) {
    return {
      success: false,
      status: 'failed',
      error: err.message || 'Unexpected spreadsheet extraction error',
      pageCount: 0,
      wordCount: 0,
      markdown: '',
      text: '',
    };
  }
}

module.exports = {
  extractSpreadsheet,
};
