<template>
  <div class="shortcut-table-wrapper">
    <table class="shortcut-table" :aria-label="`${context} keyboard shortcuts`">
      <thead>
        <tr>
          <th scope="col">Action</th>
          <th scope="col">Windows / Linux</th>
          <th scope="col">macOS</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="s in shortcuts" :key="s.action">
          <td class="action-cell">{{ s.action }}</td>
          <td class="key-cell">
            <kbd v-for="key in toKeyList(s.win ?? s.key)" :key="key">{{ key }}</kbd>
          </td>
          <td class="key-cell">
            <kbd v-for="key in toKeyList(s.mac ?? macify(s.key))" :key="key">{{ key }}</kbd>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
interface Shortcut {
  action: string;
  /** Cross-platform shortcut (Ctrl/Cmd notation) */
  key: string;
  /** Windows override if different */
  win?: string;
  /** macOS override if different */
  mac?: string;
}

const props = withDefaults(
  defineProps<{
    shortcuts: Shortcut[];
    context?: string;
  }>(),
  { context: "Keyboard" }
);

function toKeyList(key: string): string[] {
  return key.split("+").map((k) => k.trim());
}

function macify(key: string): string {
  return key
    .replace(/Ctrl/gi, "⌘")
    .replace(/Alt/gi, "⌥")
    .replace(/Shift/gi, "⇧")
    .replace(/Cmd/gi, "⌘");
}
</script>

<style scoped>
.shortcut-table-wrapper {
  overflow-x: auto;
  margin: var(--space-7) 0;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
}

.shortcut-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-body-sm);
}

.shortcut-table th {
  background: var(--surface-accent);
  color: var(--text-strong);
  font-size: var(--font-size-label);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: var(--space-4) var(--space-5);
  text-align: left;
  border-bottom: 1px solid var(--border-default);
}

.shortcut-table td {
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--border-muted);
  color: var(--app-text);
  vertical-align: middle;
}

.shortcut-table tbody tr:last-child td {
  border-bottom: none;
}

.shortcut-table tbody tr:hover {
  background: var(--surface-muted);
}

.action-cell {
  font-weight: 500;
  color: var(--text-strong);
}

.key-cell {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}

kbd {
  display: inline-block;
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  padding: 2px 6px;
  background: var(--surface-elevated);
  border: 1px solid var(--border-default);
  border-bottom-width: 2px;
  border-radius: var(--radius-sm);
  color: var(--text-strong);
  line-height: 1.4;
  white-space: nowrap;
}
</style>
