const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const LogDB = require('../../ai/logs/LogDB');
const Agent = require('../../ai/core/Agent');
const QueryExecutor = require('../../ai/core/QueryExecutor');

describe('Prompt Tracking Option A Tests', () => {
  let tmpDir;
  let logDb;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notely-prompt-track-'));
    logDb = new LogDB(tmpDir);
    logDb.initialize();
  });

  afterEach(() => {
    if (logDb) logDb.close();
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should store prompt logs in LogDB under PromptTracker subsystem', () => {
    const mockAgent = {
      logDb,
      logPrompt(query, systemPrompt, metadata = {}) {
        if (this.logDb && this.logDb.isInitialized) {
          this.logDb.addLog('PromptTracker', `Prompt executed for query: "${query.slice(0, 80)}"`, 'info', {
            query,
            systemPrompt,
            ...metadata
          });
        }
      }
    };

    mockAgent.logPrompt('What are active projects?', 'System prompt: You are Notely AI', {
      persona: 'brainstorming',
      model: 'gemini-flash'
    });

    const logs = logDb.getLogs('PromptTracker', 10);
    assert.strictEqual(logs.length, 1);
    assert.strictEqual(logs[0].subsystem, 'PromptTracker');
    assert.strictEqual(logs[0].metadata.query, 'What are active projects?');
    assert.strictEqual(logs[0].metadata.persona, 'brainstorming');
    assert.strictEqual(logs[0].metadata.systemPrompt, 'System prompt: You are Notely AI');
  });
});
