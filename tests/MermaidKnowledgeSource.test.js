import { describe, it, expect } from 'vitest';
import MermaidKnowledgeSource from '../ai/graph/sources/MermaidKnowledgeSource';

describe('MermaidKnowledgeSource', () => {
  it('should return correct sourceType and baseConfidence', () => {
    const source = new MermaidKnowledgeSource();
    expect(source.sourceType()).toBe('mermaid');
    expect(source.baseConfidence()).toBe(0.90);
  });

  it('should parse flowchart markup into entities and relationships', async () => {
    const source = new MermaidKnowledgeSource();
    const mermaidText = `
      graph TD
        A[Client App] -->|HTTP Request| B[API Gateway]
        B --> C[Auth Service]
    `;

    const entities = await source.extractEntities(null, mermaidText);
    const relationships = await source.extractRelationships(null, mermaidText);

    expect(entities.map(e => e.name)).toContain('Client App');
    expect(entities.map(e => e.name)).toContain('API Gateway');
    expect(entities.map(e => e.name)).toContain('Auth Service');

    expect(relationships).toHaveLength(2);
    expect(relationships[0].source_name).toBe('Client App');
    expect(relationships[0].target_name).toBe('API Gateway');
    expect(relationships[0].type).toBe('http_request');
  });
});
