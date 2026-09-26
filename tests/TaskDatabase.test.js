import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { TaskDatabase } from '../electron/lib/tasks/TaskDatabase.cjs';

describe('TaskDatabase duplicate titles and collision handling', () => {
  let tempDir;
  let taskDb;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taskdb-test-'));
    taskDb = new TaskDatabase(tempDir);
  });

  afterEach(() => {
    taskDb.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  it('syncs notes with duplicate task titles without unique constraint errors', () => {
    const notePath = path.join(tempDir, 'notes', 'tasks-with-duplicates.md');
    const parsedTasks = [
      { title: 'Duplicate title', status: 'open', line: 5, lineText: '- [ ] Duplicate title' },
      { title: 'Duplicate title', status: 'open', line: 15, lineText: '- [ ] Duplicate title' },
      { title: 'Duplicate title', status: 'done', line: 25, lineText: '- [x] Duplicate title' },
      { title: 'Unique title', status: 'open', line: 30, lineText: '- [ ] Unique title' },
    ];

    expect(() => {
      taskDb.syncFromNote(notePath, parsedTasks);
    }).not.toThrow();

    const tasks = taskDb.listTasks({ noteFilter: notePath });
    expect(tasks.length).toBe(4);

    const doneCount = tasks.filter(t => t.status === 'done').length;
    const openCount = tasks.filter(t => t.status === 'open').length;
    expect(doneCount).toBe(1);
    expect(openCount).toBe(3);
  });

  it('handles editing tasks to identical titles on note update', () => {
    const notePath = path.join(tempDir, 'notes', 'edit-duplicate.md');
    
    // Initial sync with two distinct tasks
    taskDb.syncFromNote(notePath, [
      { title: 'Task A', status: 'open', line: 10, lineText: '- [ ] Task A' },
      { title: 'Task B', status: 'open', line: 20, lineText: '- [ ] Task B' },
    ]);

    // User renames Task B to Task A (same title as Task A)
    expect(() => {
      taskDb.syncFromNote(notePath, [
        { title: 'Task A', status: 'open', line: 10, lineText: '- [ ] Task A' },
        { title: 'Task A', status: 'done', line: 20, lineText: '- [x] Task A' },
      ]);
    }).not.toThrow();

    const tasks = taskDb.listTasks({ noteFilter: notePath });
    expect(tasks.length).toBe(2);
    expect(tasks.every(t => t.title === 'Task A')).toBe(true);
  });
});
