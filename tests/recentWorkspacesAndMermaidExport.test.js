import { describe, it, expect } from 'vitest';

const { buildAppMenuTemplate } = require('../electron/lib/core/appMenu.cjs');
const { createImageMedia } = require('../electron/lib/media/imageMedia.cjs');
const MarkdownIt = require('markdown-it');

describe('Recent Workspaces Menu & Limits', () => {
  it('caps visible recent workspaces to 8 and adds "X more..." item when > 8 exist', () => {
    const fakeWorkspaces = Array.from({ length: 14 }, (_, i) => `C:\\workspaces\\project-${i + 1}`);

    const menu = buildAppMenuTemplate(
      { isDestroyed: () => false },
      {
        recentWorkspacePaths: fakeWorkspaces,
        availableWorkspaces: [],
      },
      {}
    );

    // Find File menu -> Open Recent
    const fileMenu = menu.find((item) => item.label === 'File');
    expect(fileMenu).toBeDefined();

    const openRecentItem = fileMenu.submenu.find((item) => item.label === 'Open Recent');
    expect(openRecentItem).toBeDefined();

    const submenu = openRecentItem.submenu;
    // First 8 items should be the first 8 workspaces
    expect(submenu.slice(0, 8).map((it) => it.label)).toEqual(fakeWorkspaces.slice(0, 8));

    // 9th item should be a separator
    expect(submenu[8].type).toBe('separator');

    // 10th item should be "6 more..." with action "open-recent-workspaces"
    expect(submenu[9].label).toBe('6 more...');
    expect(submenu[9].action).toBe('open-recent-workspaces');
  });

  it('shows all workspaces and always appends "More..." when <= 8 exist', () => {
    const fakeWorkspaces = Array.from({ length: 5 }, (_, i) => `C:\\workspaces\\project-${i + 1}`);

    const menu = buildAppMenuTemplate(
      { isDestroyed: () => false },
      {
        recentWorkspacePaths: fakeWorkspaces,
        availableWorkspaces: [],
      },
      {}
    );

    const fileMenu = menu.find((item) => item.label === 'File');
    const openRecentItem = fileMenu.submenu.find((item) => item.label === 'Open Recent');
    const submenu = openRecentItem.submenu;

    expect(submenu.length).toBe(7); // 5 items + separator + "More..."
    expect(submenu.slice(0, 5).map((it) => it.label)).toEqual(fakeWorkspaces);
    expect(submenu[5].type).toBe('separator');
    expect(submenu[6].label).toBe('More...');
    expect(submenu[6].action).toBe('open-recent-workspaces');
  });
});

describe('Mermaid Diagram Export Rendering', () => {
  it('renders mermaid fence blocks as mermaid containers in buildPdfExportHtml', () => {
    const media = createImageMedia({
      getMarkdownIt: () => MarkdownIt,
      getNotesRoot: () => process.cwd(),
      filePathWithin: () => true,
      escapeHtml: (s) => String(s || ''),
      buildPdfStyles: () => '',
    });

    const markdownWithMermaid = [
      '# Architecture Diagram',
      '',
      '```mermaid',
      'graph TD;',
      '    A-->B;',
      '    A-->C;',
      '```',
      '',
      'Regular text after diagram'
    ].join('\n');

    const html = media.buildPdfExportHtml({
      title: 'Diagram Note',
      markdownContent: markdownWithMermaid,
      baseHref: 'file:///C:/test/',
      sourceDir: 'C:\\test',
    });

    // Should include mermaid container and pre.mermaid
    expect(html).toContain('class="notely-mermaid-container"');
    expect(html).toContain('<pre class="mermaid">');
    expect(html).toContain('graph TD;');
    expect(html).toContain('A--&gt;B;');

    // Should NOT wrap mermaid in code block highlighter
    expect(html).not.toContain('class="markdown-code-lang">mermaid</span>');
  });
});
