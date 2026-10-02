import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { TaskDatabase } from '../electron/lib/tasks/TaskDatabase.cjs';
import { parseMarkdownTasks } from '../electron/lib/tasks/taskIpc.cjs';

describe('Calendar Task & Note Timestamp Tests', () => {
  let tempDir;
  let taskDb;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'calendar-events-test-'));
    taskDb = new TaskDatabase(tempDir);
  });

  afterEach(() => {
    taskDb.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  it('parses markdown task scheduling, due dates, completion and priorities correctly', () => {
    const markdown = `
# Project Plan
- [ ] Simple task
- [ ] Task with due date @due(2026-10-15)
- [ ] Task with time @due(2026-10-15 14:30) #p1
- [ ] Task with schedule @sched(2026-10-12 09:00) @end(2026-10-12 10:30) #urgent
- [x] Completed task @done(2026-10-10 18:00)
    `;

    const tasks = parseMarkdownTasks(markdown);
    expect(tasks.length).toBe(5);

    expect(tasks[0].title).toBe('Simple task');
    expect(tasks[0].due_date).toBeNull();
    expect(tasks[0].is_all_day).toBe(1);

    expect(tasks[1].due_date).toBe('2026-10-15');
    expect(tasks[1].is_all_day).toBe(1);

    expect(tasks[2].due_date).toBe('2026-10-15');
    expect(tasks[2].scheduled_start).toBe('2026-10-15 14:30');
    expect(tasks[2].is_all_day).toBe(0);
    expect(tasks[2].priority).toBe(3);

    expect(tasks[3].scheduled_start).toBe('2026-10-12 09:00');
    expect(tasks[3].scheduled_end).toBe('2026-10-12 10:30');
    expect(tasks[3].is_all_day).toBe(0);
    expect(tasks[3].priority).toBe(3);

    expect(tasks[4].status).toBe('done');
    expect(tasks[4].completed_at).toBe('2026-10-10 18:00');
  });

  it('persists and retrieves accurate calendar lifecycle events for tasks', () => {
    const notePath = path.join(tempDir, 'notes', 'sprint.md');
    const parsed = [
      {
        title: 'Design Review',
        status: 'open',
        line: 1,
        lineText: '- [ ] Design Review @sched(2026-10-05 10:00)',
        scheduled_start: '2026-10-05 10:00',
        scheduled_end: '2026-10-05 11:00',
        is_all_day: 0,
        due_date: '2026-10-05',
        priority: 2,
      },
      {
        title: 'Backend API Deployment',
        status: 'done',
        line: 2,
        lineText: '- [x] Backend API Deployment @due(2026-10-04) @done(2026-10-04 16:30)',
        due_date: '2026-10-04',
        completed_at: '2026-10-04 16:30',
        is_all_day: 1,
        priority: 1,
      },
      {
        title: 'Old Missed Deadline',
        status: 'open',
        line: 3,
        lineText: '- [ ] Old Missed Deadline @due(2020-01-01)',
        due_date: '2020-01-01',
        is_all_day: 1,
        priority: 3,
      }
    ];

    taskDb.syncFromNote(notePath, parsed);

    const octEvents = taskDb.getCalendarTaskEvents('2026-10-01', '2026-10-31');
    expect(octEvents.length).toBeGreaterThanOrEqual(2);

    const schedEvent = octEvents.find(e => e.type === 'task-scheduled');
    expect(schedEvent).toBeDefined();
    expect(schedEvent.title).toBe('Design Review');
    expect(schedEvent.start).toBe('2026-10-05 10:00');
    expect(schedEvent.allDay).toBe(false);

    const doneEvent = octEvents.find(e => e.type === 'task-completed');
    expect(doneEvent).toBeDefined();
    expect(doneEvent.title).toContain('Backend API Deployment');
    expect(doneEvent.start).toBe('2026-10-04 16:30');

    // Overdue task check
    const overdueEvents = taskDb.getCalendarTaskEvents('2020-01-01', '2020-01-02');
    const overdueTask = overdueEvents.find(e => e.type === 'task-overdue');
    expect(overdueTask).toBeDefined();
    expect(overdueTask.title).toBe('Old Missed Deadline');
  });
});
