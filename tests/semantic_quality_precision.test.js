import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import GraphDB from '../ai/graph/GraphDB';
import GraphService from '../ai/graph/GraphService';
import EntityResolver from '../ai/graph/EntityResolver';
import DeterministicSemanticMiner from '../ai/graph/DeterministicSemanticMiner';
import MarkdownASTParser from '../ai/graph/MarkdownASTParser';

describe('Exhaustive Semantic Quality & Precision Verification Suite', () => {
  const tempDir = path.join(__dirname, '../scratch/temp-exhaustive-semantic-test');
  let graphDb;
  let graphService;
  let entityResolver;

  beforeEach(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    graphDb = new GraphDB(tempDir);
    graphDb.initialize();

    entityResolver = new EntityResolver(graphDb);
    graphService = new GraphService({
      workspacePath: tempDir,
      graphDb: graphDb
    });
  });

  afterEach(() => {
    if (graphDb) {
      graphDb.close();
    }
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch { /* ignore clean error */ }
  });

  it('Exhaustive Test 1: Unit noise rejection gate', () => {
    const explicitNoiseArray = [
      'Teh',
      'Again',
      'for',
      'in',
      'ave a',
      '.ot',
      'dddde',
      'a test',
      'This tool will help',
      'AI Integration and',
      'data-diagram-type="excalidraw"',
      'Diagram{data-diagram-id="4e711903"',
      'Column 1 Column 2 Column 3',
      'Value 1.1 Value 1.2',
      'and Search Connect Gemini or Groq API',
      'Weh'
    ];

    for (const term of explicitNoiseArray) {
      const isValid = entityResolver.isValidEntityName(term);
      expect(isValid, `Noise term "${term}" must be rejected by EntityResolver quality gate`).toBe(false);
    }
  });

  it('Exhaustive Test 2: Markdown & HTML attribute cleansing', () => {
    const parser = new MarkdownASTParser();
    const rawMarkdownWithArtifacts = `
# System Overview

Teh Notely application relies on SQLite database.
![Diagram](.assets/diag.png){data-diagram-id="4e711903" data-diagram-type="excalidraw" data-origin-asset="./images/screenshot-2026.png" data-origin-alt="Screenshot"}

| Column 1 | Column 2 | Column 3 | Column 4 |
| Value 1.1| Value 1.2| Value 1.3| Value 1.4|

Again a test for git AI. This tool will help visualize notes.
.ot ave a dddde for in.
Name: Bikash
Time: 10:04
`;

    const cleansed = parser.cleanse(rawMarkdownWithArtifacts);

    // Verify raw editor attributes, table syntax, and key-values are fully stripped
    expect(cleansed).not.toContain('data-diagram-id');
    expect(cleansed).not.toContain('data-diagram-type');
    expect(cleansed).not.toContain('Column 1');
    expect(cleansed).not.toContain('Value 1.1');
    expect(cleansed).not.toContain('Name: Bikash');
    expect(cleansed).not.toContain('Time: 10:04');

    // Verify natural prose terms remain
    expect(cleansed).toContain('Notely application relies on SQLite database');
  });

  it('Exhaustive Test 3: Type coercion for ambiguous entities', () => {
    // Multi-word Title-Cased Name -> Person
    expect(entityResolver.sanitizeEntityType('Bikash Panda', 'Organization')).toBe('Person');
    expect(entityResolver.sanitizeEntityType('Abhiram Panda', 'Organization')).toBe('Person');

    // Single-word Proper Name -> Person
    expect(entityResolver.sanitizeEntityType('Abhiram', 'Organization')).toBe('Person');

    // Screenshot -> Concept (NOT Event)
    expect(entityResolver.sanitizeEntityType('Screenshot', 'Event')).toBe('Concept');

    // Noise/Verbs -> Rejected (null)
    expect(entityResolver.sanitizeEntityType('Create', 'Person')).toBe(null);
    expect(entityResolver.sanitizeEntityType('Teh', 'Location')).toBe(null);
    expect(entityResolver.sanitizeEntityType('Again', 'Person')).toBe(null);
  });

  it('Exhaustive Test 4: End-to-end multi-note workspace ingestion with zero noise leakage', async () => {
    // Note 1: Architecture Notes
    const note1Path = path.join(tempDir, 'architecture_overview.md');
    const note1Content = `---
title: Architecture Overview
---

# Architecture Notes

Notely uses SQLite database for persistent knowledge graph storage.
Excalidraw diagrams and Mermaid charts enable rich visualization.
Abhiram and Bikash Panda lead the core AI engine development.

| Column 1 | Column 2 | Column 3 | Column 4 |
| Value 1  | Value 2  | Value 3  | Value 4  |

![Diagram](.assets/diag.png){data-diagram-id="4e711903" data-diagram-type="excalidraw"}

Again a test for git AI. This tool will help visualize notes.
.ot ave a dddde for in. Teh system depends on SQLite.
`;

    // Note 2: AI & Search Integrations
    const note2Path = path.join(tempDir, 'ai_search_integration.md');
    const note2Content = `---
title: AI Search Integration
---

# AI Integration

Connect Gemini or Groq API keys in settings.
Notely integrates with Gemini API for semantic search.
Notely integrates with Groq API for fast LLM response generation.

Screenshot CONTROLS Diagram. Diagram CONTROLS Screenshot.
Workspace USES and Search Connect Gemini or Groq API.
AI Integration and for in.
`;

    // Note 3: IoT Device Mesh
    const note3Path = path.join(tempDir, 'device_mesh.md');
    const note3Content = `---
title: IoT Device Mesh
---

# Hardware Mesh

ESP32 microcontroller controls Relay module over MQTT protocol.
Weh ave a .ot of text snakjaf.
Hello World IMPLEMENTS dddde.
a test GENERATES for.
`;

    fs.writeFileSync(note1Path, note1Content, 'utf8');
    fs.writeFileSync(note2Path, note2Content, 'utf8');
    fs.writeFileSync(note3Path, note3Content, 'utf8');

    // Process all 3 exhaustive notes
    await graphService.processNote(note1Path, note1Content);
    await graphService.processNote(note2Path, note2Content);
    await graphService.processNote(note3Path, note3Content);

    // Run graph maintenance cleanup to purge any unlinked orphan nodes
    if (graphService.graphMaintenance) {
      graphService.graphMaintenance.run();
    }

    // Export graph JSON and evaluate precision
    const graphData = graphDb.exportAsJSON();
    const entityNames = graphData.entities.map(e => e.name);

    // --- REJECTION VERIFICATIONS ---
    const BANNED_NOISE_TERMS = [
      'Teh', 'Again', 'for', 'in', 'ave a', '.ot', 'dddde', 'a test',
      'This tool will help', 'AI Integration and', 'data-diagram-type="excalidraw"',
      'Column 1', 'Value 1', 'Weh', 'snakjaf', 'and Search Connect Gemini or Groq API'
    ];

    for (const noiseTerm of BANNED_NOISE_TERMS) {
      expect(entityNames, `Graph entity store must NOT contain noise term "${noiseTerm}"`).not.toContain(noiseTerm);
    }

    // --- LEGITIMATE CONCEPT & TYPING VERIFICATIONS ---
    expect(entityNames.some(n => n.toLowerCase().includes('sqlite'))).toBe(true);

    // --- RELATIONSHIP QUALITY & EVIDENCE VERIFICATIONS ---
    expect(graphData.relationships.length).toBeGreaterThan(0);
    expect(graphData.validation.selfLoops).toBe(0);
    expect(graphData.validation.duplicateEdges).toBe(0);
    expect(graphData.validation.evidenceCoverageRatio).toBe(1.0);
  });
});
