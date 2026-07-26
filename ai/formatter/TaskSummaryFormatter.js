/**
 * TaskSummaryFormatter - Deterministic task response formatter
 * Formats task arrays directly into structured Markdown without LLM overhead.
 */

function formatFileUriLink(filePath, label) {
  const filename = label || (filePath ? filePath.split(/[\\/]/).pop() : 'note.md');
  if (!filePath) return `[${filename}]`;
  const normPath = String(filePath).replace(/\\/g, '/');
  const fileUri = normPath.startsWith('/') ? normPath : '/' + normPath;
  return `[${filename}](file://${fileUri})`;
}

function TaskSummaryFormatter(tasks = []) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return 'No open tasks found in your workspace notes.';
  }

  const openTasks = tasks.filter(t => !t.status || t.status === 'open' || t.status === 'in-progress');
  const totalOpen = openTasks.length > 0 ? openTasks.length : tasks.length;
  const listToFormat = openTasks.length > 0 ? openTasks : tasks;

  const grouped = new Map();
  for (const t of listToFormat) {
    const key = t.path || t.filePath || t.note || 'workspace';
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(t);
  }

  let md = `## Workspace Task Summary\nFound a total of ${totalOpen} open task${totalOpen === 1 ? '' : 's'} across ${grouped.size} note${grouped.size === 1 ? '' : 's'}.\n\n### Open Tasks by Note\n`;

  for (const [notePath, noteTasks] of grouped.entries()) {
    const noteName = noteTasks[0]?.note || (notePath ? notePath.split(/[\\/]/).pop() : 'note.md');
    const linkStr = formatFileUriLink(notePath, noteName);
    md += `- **${linkStr}**: ${noteTasks.length} open task${noteTasks.length === 1 ? '' : 's'}\n`;
    noteTasks.forEach((task, idx) => {
      const lineStr = task.line ? ` (Line ${task.line})` : '';
      const text = task.text || task.task || task.content || 'Task';
      md += `  ${idx + 1}. ${text}${lineStr}\n`;
    });
  }

  return md.trim();
}

module.exports = {
  TaskSummaryFormatter,
  formatFileUriLink
};
