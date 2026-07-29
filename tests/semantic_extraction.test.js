import { describe, it, expect, beforeEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import {
  SemanticExtractionEngine,
  GLiNER2RelexAdapter,
  ExtractionValidator,
  Entity,
  Relationship,
  Evidence,
  ExtractionResult
} from '../ai/graph/semantic';
import AIConfig from '../ai/core/AIConfig';

describe('Model-Driven GLiNER2-Relex ONNX Semantic Extraction Layer', () => {
  let adapter;
  let engine;

  beforeEach(() => {
    adapter = new GLiNER2RelexAdapter();
    engine = new SemanticExtractionEngine(__dirname);
  });

  it('1. Per-label Logit Vector Decoding (FIX-2 & FIX-4 Validation)', () => {
    // Labels array: ["Database", "Framework", "Application"]
    const labels = ['Database', 'Framework', 'Application'];
    const words = ['SQLite', 'is', 'used'];
    const charOffsets = [0, 7, 10];
    const threshold = 0.60;
    const maxWidth = 1;
    const validSpans = [{ wordIndexStart: 0, length: 1 }]; // "SQLite"

    // Raw logits array for span 0 across 3 labels:
    // Database logit: 2.0 (sigmoid(2.0) ≈ 0.880)
    // Framework logit: -1.0 (sigmoid(-1.0) ≈ 0.268)
    // Application logit: 0.1 (sigmoid(0.1) ≈ 0.525)
    const logitsData = new Float32Array([2.0, -1.0, 0.1]);

    const decoded = adapter._decodeSpanScores(
      logitsData,
      words,
      labels,
      charOffsets,
      threshold,
      maxWidth,
      validSpans
    );

    expect(decoded.length).toBe(1);
    expect(decoded[0].text).toBe('SQLite');
    expect(decoded[0].type).toBe('Database'); // Correctly picked label 0 (Database) by logit vector slice
    expect(decoded[0].confidence).toBeGreaterThanOrEqual(0.60);
  });

  it('2. Model-Driven Label Assignment — No Hardcoded Regex Overrides', () => {
    const labels = ['Database', 'Framework', 'Application'];
    const words = ['CustomTech', 'system'];
    const charOffsets = [0, 11];
    const threshold = 0.60;
    const validSpans = [{ wordIndexStart: 0, length: 1 }]; // "CustomTech"

    // Raw logits: Framework logit highest (3.0 -> sigmoid ~0.95)
    const logitsData = new Float32Array([-2.0, 3.0, -1.0]);

    const decoded = adapter._decodeSpanScores(
      logitsData,
      words,
      labels,
      charOffsets,
      threshold,
      1,
      validSpans
    );

    expect(decoded.length).toBe(1);
    expect(decoded[0].text).toBe('CustomTech');
    expect(decoded[0].type).toBe('Framework'); // Assigned Framework purely via neural logit score
  });

  it('3. Common Words like "your" Are Not Inflated or Extracted via Fallback', () => {
    const labels = ['Database', 'Framework', 'Application'];
    const words = ['Your', 'application'];
    const charOffsets = [0, 5];
    const threshold = 0.60;
    const validSpans = [{ wordIndexStart: 0, length: 1 }]; // "Your"

    // Low logit vector for all labels: [-3.0, -2.5, -2.0] -> max sigmoid(-2.0) ≈ 0.119 < 0.60
    const logitsData = new Float32Array([-3.0, -2.5, -2.0]);

    const decoded = adapter._decodeSpanScores(
      logitsData,
      words,
      labels,
      charOffsets,
      threshold,
      1,
      validSpans
    );

    // "Your" must NOT be extracted
    expect(decoded.length).toBe(0);
  });

  it('4. Standby / Mock Mode Returns Empty Array — Zero Keyword False Positives (FIX-5)', () => {
    const mockEntities = adapter._mockExtractSentEntities(
      ['Your', 'application', 'uses', 'SQLite'],
      ['Application', 'Database'],
      0.60
    );

    // Standby mode MUST produce empty result without model weights
    expect(mockEntities).toEqual([]);
  });

  it('5. Dynamic UI Preference Loading Path Verification (FIX-13)', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notely-test-'));
    try {
      const config = new AIConfig(tempDir);
      config.savePreferences({ graphConfidence: 0.78 });

      const testAdapter = new GLiNER2RelexAdapter({ appDataDir: tempDir });
      const loadedConfidence = testAdapter.getSavedConfidenceThreshold();

      expect(loadedConfidence).toBe(0.78);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('6. Schema Validation & Graph Explosion Protection (FIX-11)', () => {
    const validator = new ExtractionValidator({ minConfidence: 0.60 });

    const entity1 = new Entity({
      text: 'SQLite',
      type: 'Database',
      confidence: 0.95,
      sourceEvidence: { sourceFile: 'test.md', lineNumber: 1 }
    });

    const entity2 = new Entity({
      text: 'GraphWorker',
      type: 'Service',
      confidence: 0.88,
      sourceEvidence: { sourceFile: 'test.md', lineNumber: 1 }
    });

    const relation = new Relationship({
      sourceEntityId: entity1.id,
      targetEntityId: entity2.id,
      relationType: 'USES',
      confidence: 0.90,
      sourceText: 'SQLite',
      targetText: 'GraphWorker',
      sourceEvidence: { sourceFile: 'test.md', lineNumber: 1 }
    });

    const result = new ExtractionResult({
      entities: [entity1, entity2],
      relations: [relation],
      evidence: [entity1.sourceEvidence]
    });

    const decisions = validator.validate(result);
    expect(decisions.valid).toBe(true);
    expect(decisions.duplicateNodesCount).toBe(0);
    expect(decisions.invalidReferencesCount).toBe(0);
    expect(decisions.graphExplosionDetected).toBe(false);
  });
});
