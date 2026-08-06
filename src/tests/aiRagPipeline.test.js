import { describe, it, expect } from 'vitest';
import MarkdownASTParser from '../../ai/graph/MarkdownASTParser';
import MarkdownChunker from '../../ai/embeddings/MarkdownChunker';

describe('AI RAG Pipeline Unit Tests', () => {
  it('should parse markdown AST and extract wikilinks and headers', () => {
    const parser = new MarkdownASTParser();
    const markdown = `# Architecture Overview\n\nThis note links to [[Project Roadmap]] and [[Design System]].\n\n## Subsystem Details\n- Item 1\n- Item 2`;
    const ast = parser.parse('/path/to/arch.md', markdown);

    expect(ast).toBeDefined();
    expect(ast.rootEntity.name).toBe('arch');
    expect(ast.links.length).toBeGreaterThanOrEqual(2);
    expect(ast.links.map(l => l.targetName)).toContain('Project Roadmap');
    expect(ast.links.map(l => l.targetName)).toContain('Design System');
  });

  it('should chunk markdown into logical blocks without empty header chunks', () => {
    const markdown = `# Main Title\nFirst paragraph content here.\n\n## Section 1\nSecond paragraph content with details.\n- List item A\n- List item B`;
    const chunks = MarkdownChunker.chunk(markdown, 'notes/sample.md', { minChunkSize: 0 });

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // Heading 1 paragraph chunk
    expect(chunks[0].chunk_type).toBe('heading');
    expect(chunks[0].content).toContain('Main Title');
    expect(chunks[0].content).toContain('First paragraph content');

    // Section 1 heading paragraph chunk
    expect(chunks[1].chunk_type).toBe('heading');
    expect(chunks[1].content).toContain('Section 1');
  });
});
