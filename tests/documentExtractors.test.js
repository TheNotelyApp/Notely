import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';

const { extractDocx } = require('../electron/lib/extractors/DocxExtractor.cjs');
const { extractPptx } = require('../electron/lib/extractors/PptxExtractor.cjs');
const { extractSpreadsheet } = require('../electron/lib/extractors/SpreadsheetExtractor.cjs');
const { DocumentCacheStore } = require('../electron/lib/documents/DocumentCacheStore.cjs');
const { DocumentExtractionService } = require('../electron/services/DocumentExtractionService.cjs');

describe('Document Extractors & Cache Pipeline', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notely-doc-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('DocxExtractor', () => {
    it('extracts paragraphs, headings, and tables from a docx zip archive', async () => {
      const docxPath = path.join(tempDir, 'test.docx');
      const zip = new JSZip();

      const sampleXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p>
            <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
            <w:r><w:t>Project Specification</w:t></w:r>
          </w:p>
          <w:p>
            <w:r><w:t>This is an automated test document for Notely.</w:t></w:r>
          </w:p>
          <w:tbl>
            <w:tr>
              <w:tc><w:p><w:r><w:t>Feature</w:t></w:r></w:p></w:tc>
              <w:tc><w:p><w:r><w:t>Status</w:t></w:r></w:p></w:tc>
            </w:tr>
            <w:tr>
              <w:tc><w:p><w:r><w:t>Extraction</w:t></w:r></w:p></w:tc>
              <w:tc><w:p><w:r><w:t>Done</w:t></w:r></w:p></w:tc>
            </w:tr>
          </w:tbl>
        </w:body>
      </w:document>`;

      zip.file('word/document.xml', sampleXml);
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });
      fs.writeFileSync(docxPath, buffer);

      const result = await extractDocx(docxPath);
      expect(result.success).toBe(true);
      expect(result.status).toBe('ready');
      expect(result.markdown).toContain('# Project Specification');
      expect(result.markdown).toContain('This is an automated test document for Notely.');
      expect(result.markdown).toContain('| Feature | Status |');
      expect(result.wordCount).toBeGreaterThan(5);
    });

    it('gracefully handles missing document.xml', async () => {
      const docxPath = path.join(tempDir, 'empty.docx');
      const zip = new JSZip();
      zip.file('other.txt', 'hello');
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });
      fs.writeFileSync(docxPath, buffer);

      const result = await extractDocx(docxPath);
      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
    });
  });

  describe('PptxExtractor', () => {
    it('extracts slide titles, bullet points, and speaker notes', async () => {
      const pptxPath = path.join(tempDir, 'presentation.pptx');
      const zip = new JSZip();

      const slide1Xml = `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
        <p:cSld>
          <p:spTree>
            <p:sp>
              <p:txBody>
                <a:p><a:r><a:t>Quarterly Roadmap</a:t></a:r></a:p>
                <a:p><a:r><a:t>Key Milestone 1: Media Extraction</a:t></a:r></a:p>
                <a:p><a:r><a:t>Key Milestone 2: Gallery Search</a:t></a:r></a:p>
              </p:txBody>
            </p:sp>
          </p:spTree>
        </p:cSld>
      </p:sld>`;

      const notes1Xml = `<?xml version="1.0" encoding="UTF-8"?>
      <p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
        <p:cSld>
          <p:spTree>
            <p:sp>
              <p:txBody>
                <a:p><a:r><a:t>Remember to mention Q4 target delivery.</a:t></a:r></a:p>
              </p:txBody>
            </p:sp>
          </p:spTree>
        </p:cSld>
      </p:notes>`;

      zip.file('ppt/slides/slide1.xml', slide1Xml);
      zip.file('ppt/notesSlides/notesSlide1.xml', notes1Xml);

      const buffer = await zip.generateAsync({ type: 'nodebuffer' });
      fs.writeFileSync(pptxPath, buffer);

      const result = await extractPptx(pptxPath);
      expect(result.success).toBe(true);
      expect(result.status).toBe('ready');
      expect(result.pageCount).toBe(1);
      expect(result.markdown).toContain('### Slide 1: Quarterly Roadmap');
      expect(result.markdown).toContain('Key Milestone 1: Media Extraction');
      expect(result.markdown).toContain('Remember to mention Q4 target delivery.');
    });
  });

  describe('SpreadsheetExtractor', () => {
    it('extracts sheets and tables to markdown', async () => {
      const xlsxPath = path.join(tempDir, 'budget.xlsx');
      const wb = XLSX.utils.book_new();
      const wsData = [
        ['Item', 'Cost', 'Department'],
        ['Server Hosting', '$150', 'Infrastructure'],
        ['Domain Name', '$15', 'Operations'],
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
      XLSX.writeFile(wb, xlsxPath);

      const result = await extractSpreadsheet(xlsxPath);
      expect(result.success).toBe(true);
      expect(result.status).toBe('ready');
      expect(result.markdown).toContain('### Sheet: Expenses');
      expect(result.markdown).toContain('| Item | Cost | Department |');
      expect(result.markdown).toContain('| Server Hosting | $150 | Infrastructure |');
    });
  });

  describe('DocumentCacheStore & SQLite Persistence', () => {
    it('manages document cache, hashes, and orphan cleanup', async () => {
      const store = new DocumentCacheStore(tempDir);
      const testFile = path.join(tempDir, 'notes.docx');
      fs.writeFileSync(testFile, 'Hello world document');

      const hash = await store.computeFileHash(testFile);
      expect(hash).toBeTruthy();

      const extractedPath = store.saveExtractedMarkdown(hash, '# Extracted Content');
      expect(extractedPath).toContain(hash);

      const record = store.upsertRecord({
        relativePath: 'notes.docx',
        contentHash: hash,
        fileSize: 20,
        mtime: 123456789,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        extractedRelPath: extractedPath,
        pageCount: 1,
        wordCount: 2,
        status: 'ready',
      });

      expect(record.relative_path).toBe('notes.docx');
      expect(record.content_hash).toBe(hash);

      const retrieved = store.getRecord('notes.docx');
      expect(retrieved).not.toBeNull();
      expect(retrieved.status).toBe('ready');

      const readBack = store.readExtractedMarkdown(extractedPath);
      expect(readBack).toBe('# Extracted Content');

      // Cleanup missing
      const removed = store.cleanupMissingFiles(['other.docx']);
      expect(removed).toContain('notes.docx');
      expect(store.getRecord('notes.docx')).toBeNull();

      store.close();
    });
  });

  describe('DocumentExtractionService', () => {
    it('scans workspace, processes documents, and updates status', async () => {
      const service = new DocumentExtractionService(tempDir);

      // Create a test xlsx
      const xlsxPath = path.join(tempDir, 'data.csv');
      fs.writeFileSync(xlsxPath, 'Category,Value\nBooks,10\nGames,20');

      const records = await service.scanWorkspace();
      expect(records).toBeDefined();

      // Wait for background queue to finish
      let readyRecord = null;
      for (let i = 0; i < 20; i++) {
        readyRecord = service.getRecord('data.csv');
        if (readyRecord && readyRecord.status === 'ready') break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      expect(readyRecord).not.toBeNull();
      expect(readyRecord.status).toBe('ready');
      expect(readyRecord.wordCount).toBeGreaterThan(0);

      const extractedText = await service.getExtractedContent('data.csv');
      expect(extractedText).toContain('Category');
      expect(extractedText).toContain('Books');

      service.close();
    });
  });
});
