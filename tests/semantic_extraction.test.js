import { describe, it, expect, beforeEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import {
  SemanticExtractionEngine,
  GLiNER2RelexAdapter,
  ExtractionValidator,
  Entity,
  Relationship,
  Evidence,
  ExtractionResult
} from '../ai/graph/semantic';

describe('Model-Agnostic Semantic Extraction Layer (GLiNER2-Relex ONNX)', () => {
  let engine;

  beforeEach(() => {
    engine = new SemanticExtractionEngine(__dirname);
  });

  it('1. Software Architecture Paragraph Test: Notely USES SQLite', async () => {
    const doc = {
      id: 'arch-doc.md',
      content: 'Notely stores workspace notes and relationship graph data in SQLite.',
      sourceType: 'markdown',
      metadata: { sourceFile: 'arch-doc.md' }
    };

    const result = await engine.extract(doc, { confidenceThreshold: 0.40 });

    expect(result).toBeInstanceOf(ExtractionResult);
    expect(result.entities.length).toBeGreaterThan(0);

    const notelyEntity = result.entities.find(e => e.text.toLowerCase().includes('notely'));
    const sqliteEntity = result.entities.find(e => e.text.toLowerCase().includes('sqlite'));

    expect(notelyEntity).toBeDefined();
    expect(sqliteEntity).toBeDefined();

    const relation = result.relations.find(
      r => r.relationType === 'USES' || r.relationType === 'STORES'
    );
    expect(relation).toBeDefined();
    expect(relation.sourceText.toLowerCase()).toContain('notely');

    // Check provenance evidence
    expect(notelyEntity.sourceEvidence).toBeDefined();
    expect(notelyEntity.sourceEvidence.extractionModel).toBe('gliner2-relex');
  });

  it('2. IoT Paragraph Test: ESP32 CONTROLS Relay', async () => {
    const doc = {
      id: 'iot-doc.md',
      content: 'The ESP32 microcontroller controls the relay module to trigger the irrigation pump.',
      sourceType: 'markdown',
      metadata: { sourceFile: 'iot-doc.md' }
    };

    const result = await engine.extract(doc, { confidenceThreshold: 0.40 });

    expect(result.entities.length).toBeGreaterThan(0);

    const esp32Entity = result.entities.find(e => e.text.toLowerCase().includes('esp32'));
    expect(esp32Entity).toBeDefined();

    const controlsRelation = result.relations.find(
      r => r.relationType === 'CONTROLS' || r.relationType === 'USES'
    );
    expect(controlsRelation).toBeDefined();
    expect(controlsRelation.sourceText.toLowerCase()).toContain('esp32');
  });

  it('3. Research Paragraph Test: BERT USES Transformer', async () => {
    const doc = {
      id: 'research-doc.md',
      content: 'BERT uses bidirectional Transformer encoders for pre-training language models.',
      sourceType: 'markdown',
      metadata: { sourceFile: 'research-doc.md' }
    };

    const result = await engine.extract(doc, { confidenceThreshold: 0.40 });

    expect(result.entities.length).toBeGreaterThan(0);

    const bertEntity = result.entities.find(e => e.text.toLowerCase().includes('bert'));
    const transformerEntity = result.entities.find(e => e.text.toLowerCase().includes('transformer'));

    expect(bertEntity).toBeDefined();
    expect(transformerEntity).toBeDefined();

    const usesRelation = result.relations.find(r => r.relationType === 'USES');
    expect(usesRelation).toBeDefined();
    expect(usesRelation.sourceText.toLowerCase()).toContain('bert');
    expect(usesRelation.targetText.toLowerCase()).toContain('transformer');
  });

  it('4. Mixed Workspace Paragraph Test: Quality, Consistency & Provenance', async () => {
    const doc = {
      id: 'mixed-doc.md',
      content: 'GraphWorker uses SQLite to persist knowledge graph edges while VectorService communicates with BGE embedding engine.',
      sourceType: 'markdown',
      metadata: { sourceFile: 'mixed-doc.md' }
    };

    const result = await engine.extract(doc, { confidenceThreshold: 0.40 });

    expect(result.metadata.event).toBe('semantic_extraction_completed');
    expect(result.metadata.entities).toBeGreaterThan(0);
    expect(result.metadata.validation.valid).toBe(true);

    // Validate Telemetry
    const recentTelemetry = engine.getRecentTelemetry();
    expect(recentTelemetry.length).toBeGreaterThan(0);
    expect(recentTelemetry.some(t => t.event === 'semantic_extraction_started')).toBe(true);
    expect(recentTelemetry.some(t => t.event === 'semantic_extraction_completed')).toBe(true);
  });

  it('5. Model Replaceability & Schema Validation Test', () => {
    const validator = new ExtractionValidator();

    const testEntity1 = new Entity({
      text: 'GraphWorker',
      type: 'Software Component',
      confidence: 0.95,
      sourceEvidence: { sourceFile: 'test.md', lineNumber: 2 }
    });

    const testEntity2 = new Entity({
      text: 'SQLite',
      type: 'Database',
      confidence: 0.96,
      sourceEvidence: { sourceFile: 'test.md', lineNumber: 2 }
    });

    const testRelation = new Relationship({
      sourceEntityId: testEntity1.id,
      targetEntityId: testEntity2.id,
      relationType: 'USES',
      confidence: 0.93,
      sourceText: 'GraphWorker',
      targetText: 'SQLite',
      sourceEvidence: { sourceFile: 'test.md', lineNumber: 2 }
    });

    const extractionResult = new ExtractionResult({
      entities: [testEntity1, testEntity2],
      relations: [testRelation],
      evidence: [testEntity1.sourceEvidence, testEntity2.sourceEvidence]
    });

    const validation = validator.validate(extractionResult);
    expect(validation.valid).toBe(true);
    expect(validation.duplicateNodesCount).toBe(0);
    expect(validation.invalidReferencesCount).toBe(0);
    expect(validation.graphExplosionDetected).toBe(false);
  });
});
