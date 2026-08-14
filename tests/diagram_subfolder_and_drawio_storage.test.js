import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { setupDiagramHandlers } from '../electron/diagram-handlers.cjs';
import { scanNoteDependencies } from '../electron/lib/export/notePackageIpc.cjs';
import { parseDiagramBlocks } from '../src/utils/renderUtils.js';

describe('Diagram Storage in Subfolders & .notes-app Isolation', () => {
  let tmpDir;
  let workspaceRoot;
  let subfolderDir;
  let ipcHandlers = {};

  const fakeIpcMain = {
    handle: (channel, handler) => {
      ipcHandlers[channel] = handler;
    },
  };

  beforeEach(() => {
    ipcHandlers = {};
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notely-diag-test-'));
    workspaceRoot = path.join(tmpDir, 'workspace');
    subfolderDir = path.join(workspaceRoot, 'nested', 'deep-folder');

    fs.mkdirSync(subfolderDir, { recursive: true });
    // Initialize workspace .notes-app directory
    fs.mkdirSync(path.join(workspaceRoot, '.notes-app'), { recursive: true });

    setupDiagramHandlers(fakeIpcMain, tmpDir, {
      getNotesRoot: () => workspaceRoot,
      filePathWithin: (root, target) => String(target).startsWith(root),
    });
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  it('1. Writing Excalidraw from a note in a subfolder saves to workspace root .notes-app, NOT subfolder', async () => {
    const noteInSubfolder = path.join(subfolderDir, 'meeting.md');
    const diagramId = 'excali_sub_123';
    const diagramData = JSON.stringify({ elements: [{ id: 'el1', type: 'rectangle' }] });

    const writeRes = await ipcHandlers['diagram:write-source'](null, {
      documentPath: noteInSubfolder,
      diagramId,
      data: diagramData,
    });

    expect(writeRes.success).toBe(true);

    // Assert it was created in workspace root .notes-app/excali-diagrams/
    const expectedRootFile = path.join(workspaceRoot, '.notes-app', 'excali-diagrams', diagramId, 'diagram.excalidraw');
    expect(fs.existsSync(expectedRootFile)).toBe(true);

    // Assert NO .notes-app was created inside subfolder
    const subfolderMeta = path.join(subfolderDir, '.notes-app');
    expect(fs.existsSync(subfolderMeta)).toBe(false);

    // Assert read from subfolder note resolves to root diagram
    const readRes = await ipcHandlers['diagram:read-source'](null, {
      documentPath: noteInSubfolder,
      diagramId,
    });
    expect(readRes.success).toBe(true);
    expect(readRes.data).toBe(diagramData);
  });

  it('2. Writing Draw.io diagram from subfolder note saves inside workspace .notes-app/drawio-diagrams', async () => {
    const noteInSubfolder = path.join(subfolderDir, 'architecture.md');
    const diagramId = 'drawio_sub_456';
    const xmlData = '<mxfile><diagram name="Page-1"><mxGraphModel><root/></mxGraphModel></diagram></mxfile>';
    const pngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const writeSourceRes = await ipcHandlers['drawio:write-source'](null, {
      diagramId,
      data: xmlData,
      documentPath: noteInSubfolder,
    });
    expect(writeSourceRes.success).toBe(true);

    const writeImageRes = await ipcHandlers['drawio:write-image'](null, {
      diagramId,
      imageData: pngBase64,
      documentPath: noteInSubfolder,
    });
    expect(writeImageRes.success).toBe(true);

    // Verify stored inside .notes-app/drawio-diagrams
    const expectedXmlFile = path.join(workspaceRoot, '.notes-app', 'drawio-diagrams', `${diagramId}.drawio`);
    const expectedPngFile = path.join(workspaceRoot, '.notes-app', 'drawio-diagrams', `${diagramId}.png`);
    expect(fs.existsSync(expectedXmlFile)).toBe(true);
    expect(fs.existsSync(expectedPngFile)).toBe(true);

    // Assert NO local subfolder .notes-app was created
    expect(fs.existsSync(path.join(subfolderDir, '.notes-app'))).toBe(false);

    // Read back source and image
    const readSourceRes = await ipcHandlers['drawio:read-source'](null, { diagramId, documentPath: noteInSubfolder });
    expect(readSourceRes.success).toBe(true);
    expect(readSourceRes.data).toBe(xmlData);

    const readImageRes = await ipcHandlers['drawio:read-image'](null, { diagramId, documentPath: noteInSubfolder });
    expect(readImageRes.success).toBe(true);
    expect(readImageRes.data).toContain('data:image/png;base64,');
  });

  it('3. renderUtils and scanNoteDependencies recognize new .notes-app/drawio-diagrams and legacy media/draw.io', () => {
    const markdownWithNew = '# New Note\n![Draw.io Diagram](.notes-app/drawio-diagrams/diag_new_999.png){data-diagram-id="diag_new_999"}';
    const markdownWithLegacy = '# Legacy Note\n![Drawio Diagram](media/draw.io/diag_legacy_888.png)';

    // 1. renderUtils parser
    const blocksNew = parseDiagramBlocks(markdownWithNew);
    expect(blocksNew.some(b => b.type === 'drawio' && b.diagramId === 'diag_new_999')).toBe(true);

    const blocksLegacy = parseDiagramBlocks(markdownWithLegacy);
    expect(blocksLegacy.some(b => b.type === 'drawio' && b.diagramId === 'diag_legacy_888')).toBe(true);

    // 2. Note package dependency scanner
    const depsNew = scanNoteDependencies(markdownWithNew);
    expect(depsNew.drawioIds).toContain('diag_new_999');

    const depsLegacy = scanNoteDependencies(markdownWithLegacy);
    expect(depsLegacy.drawioIds).toContain('diag_legacy_888');
  });

  it('4. ExportManager correctly bundles .notes-app/drawio-diagrams into .nly export package', async () => {
    const exportModule = await import('../electron/lib/export/ExportManager.cjs');
    const ExportManager = exportModule.ExportManager || exportModule.default?.ExportManager;

    const mgr = new ExportManager({
      getNotesRoot: () => workspaceRoot,
      filePathWithin: (root, target) => String(target).startsWith(root),
    });

    // Create note referencing diagram
    const notePath = path.join(workspaceRoot, 'packaged-note.md');
    fs.writeFileSync(notePath, '# Package Me\n![Draw.io Diagram](.notes-app/drawio-diagrams/pkg_diag_1.png){data-diagram-id="pkg_diag_1"}');

    // Create diagram in .notes-app/drawio-diagrams
    const diagDir = path.join(workspaceRoot, '.notes-app', 'drawio-diagrams');
    fs.mkdirSync(diagDir, { recursive: true });
    fs.writeFileSync(path.join(diagDir, 'pkg_diag_1.drawio'), '<mxfile><diagram name="D1"/></mxfile>');
    fs.writeFileSync(path.join(diagDir, 'pkg_diag_1.png'), 'fake-png-data');

    const outputPath = path.join(tmpDir, 'test-export.nly');
    const result = await mgr._exportNotePackage({
      noteFilePaths: [notePath],
      outputPath,
    }, tmpDir);

    expect(result.success).toBe(true);
    expect(fs.existsSync(outputPath)).toBe(true);
    expect(result.fileSize).toBeGreaterThan(0);
    expect(result.filename).toBe('test-export.nly');
  });
});

