import { describe, it, expect } from 'vitest';
import CodeKnowledgeSource from '../ai/graph/sources/code/CodeKnowledgeSource';

describe('CodeKnowledgeSource', () => {
  it('should return correct sourceType and baseConfidence', () => {
    const source = new CodeKnowledgeSource();
    expect(source.sourceType()).toBe('code');
    expect(source.baseConfidence()).toBe(0.95);
  });

  it('should identify supported code file extensions', () => {
    const source = new CodeKnowledgeSource();
    expect(source.supports('file.js')).toBe(true);
    expect(source.supports('file.tsx')).toBe(true);
    expect(source.supports('file.py')).toBe(true);
    expect(source.supports('file.go')).toBe(true);
    expect(source.supports('file.rs')).toBe(true);
    expect(source.supports('file.md')).toBe(false);
    expect(source.supports('file.png')).toBe(false);
  });

  it('should extract JavaScript / TypeScript classes, functions, and interfaces', async () => {
    const source = new CodeKnowledgeSource([
      { id: 'repo-1', name: 'my-app', path: '/workspace/my-app' }
    ]);

    const codeSnippet = `
      import { BaseService } from './base';

      export interface UserSession {
        id: string;
        token: string;
      }

      export class AuthService extends BaseService {
        async loginUser(username, password) {
          return true;
        }
      }

      export const fetchUserProfile = async (userId) => {
        return { id: userId };
      };
    `;

    const entities = await source.extractEntities('/workspace/my-app/src/auth.ts', codeSnippet);
    const names = entities.map((e) => e.name);

    expect(names).toContain('my-app/src/auth.ts');
    expect(names).toContain('UserSession');
    expect(names).toContain('AuthService');
    expect(names).toContain('fetchUserProfile()');

    const authService = entities.find((e) => e.name === 'AuthService');
    expect(authService.type).toBe('CodeClass');
    expect(authService.properties.extends).toBe('BaseService');

    const relationships = await source.extractRelationships('/workspace/my-app/src/auth.ts', codeSnippet);
    expect(relationships.some((r) => r.type === 'CONTAINS' && r.target_name === 'my-app/src/auth.ts')).toBe(true);
    expect(relationships.some((r) => r.type === 'IMPORTS' && r.target_name === './base')).toBe(true);
  });

  it('should extract Python classes and functions', async () => {
    const source = new CodeKnowledgeSource([
      { id: 'repo-py', name: 'ml-backend', path: '/workspace/ml-backend' }
    ]);

    const pySnippet = `
class NeuralClassifier(BaseModel):
    def __init__(self):
        pass

def predict_pipeline(tensor_input):
    return 42
    `;

    const entities = await source.extractEntities('/workspace/ml-backend/model.py', pySnippet);
    const names = entities.map((e) => e.name);

    expect(names).toContain('ml-backend/model.py');
    expect(names).toContain('NeuralClassifier');
    expect(names).toContain('predict_pipeline()');

    const classifier = entities.find((e) => e.name === 'NeuralClassifier');
    expect(classifier.type).toBe('CodeClass');
    expect(classifier.properties.baseClass).toBe('BaseModel');
  });

  it('should extract Go structs and functions via AST', async () => {
    const source = new CodeKnowledgeSource([
      { id: 'repo-go', name: 'go-service', path: '/workspace/go-service' }
    ]);

    const goSnippet = `
package main

type Config struct {
    Port int
}

func StartServer(cfg Config) {
}
    `;

    const entities = await source.extractEntities('/workspace/go-service/main.go', goSnippet);
    const names = entities.map((e) => e.name);

    expect(names).toContain('go-service/main.go');
    expect(names).toContain('Config');
    expect(names).toContain('StartServer()');
  });

  it('should extract Rust structs and functions via AST', async () => {
    const source = new CodeKnowledgeSource([
      { id: 'repo-rs', name: 'rust-engine', path: '/workspace/rust-engine' }
    ]);

    const rsSnippet = `
pub struct TaskManager {
    pub id: u64,
}

pub fn execute_job(task: TaskManager) {
}
    `;

    const entities = await source.extractEntities('/workspace/rust-engine/lib.rs', rsSnippet);
    const names = entities.map((e) => e.name);

    expect(names).toContain('rust-engine/lib.rs');
    expect(names).toContain('TaskManager');
    expect(names).toContain('execute_job()');
  });

  it('should extract evidence records for code relationships', async () => {
    const source = new CodeKnowledgeSource([
      { id: 'repo-js', name: 'web-app', path: '/workspace/web-app' }
    ]);

    const jsSnippet = `
      import { Helper } from './helper';
      export class AppController {}
    `;

    const evidence = await source.extractEvidence('/workspace/web-app/src/app.js', jsSnippet);
    expect(evidence.length).toBeGreaterThan(0);
    expect(evidence[0].extractor).toBe('code');
    expect(evidence[0].subjectText).toContain('web-app');
  });

  it('should return empty evidence array for files not matching any repo', async () => {
    const source = new CodeKnowledgeSource([
      { id: 'repo-js', name: 'web-app', path: '/workspace/web-app' }
    ]);

    const evidence = await source.extractEvidence('/other-dir/unrelated.js', 'class X {}');
    expect(evidence).toEqual([]);
  });
});

