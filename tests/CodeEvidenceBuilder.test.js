import { describe, it, expect } from 'vitest';
import { CodeEvidenceBuilder } from '../ai/graph/sources/code/CodeEvidenceBuilder';

describe('CodeEvidenceBuilder', () => {
  it('builds evidence records for code relationships', () => {
    const builder = new CodeEvidenceBuilder();
    const pairs = builder.buildForRelationships({
      repoId: 'repo-abc',
      repoName: 'backend',
      filePath: '/workspace/backend/src/auth.js',
      relPath: 'src/auth.js',
      relationships: [
        {
          source_name: 'backend/src/auth.js',
          source_type: 'CodeModule',
          target_name: 'AuthService',
          target_type: 'CodeClass',
          type: 'CONTAINS',
          confidence: 0.95
        },
        {
          source_name: 'backend/src/auth.js',
          source_type: 'CodeModule',
          target_name: './utils',
          target_type: 'CodeModule',
          type: 'IMPORTS',
          confidence: 0.9
        }
      ]
    });

    expect(pairs.length).toBe(2);
    expect(pairs[0].relationship.type).toBe('CONTAINS');
    expect(pairs[0].evidence.extractor).toBe('code');
    expect(pairs[0].evidence.subjectText).toBe('backend/src/auth.js');
    expect(pairs[0].evidence.predicateText).toBe('CONTAINS');
    expect(pairs[0].evidence.objectText).toBe('AuthService');
    expect(pairs[0].evidence.confidence).toBe(0.95);

    expect(pairs[1].relationship.type).toBe('IMPORTS');
    expect(pairs[1].evidence.extractor).toBe('code');
    expect(pairs[1].evidence.subjectText).toBe('backend/src/auth.js');
    expect(pairs[1].evidence.predicateText).toBe('IMPORTS');
    expect(pairs[1].evidence.objectText).toBe('./utils');
  });
});
