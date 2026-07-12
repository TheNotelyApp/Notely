<template>
  <div
    class="notely-callout"
    :class="type"
    role="note"
    :aria-label="`${labelText} callout`"
  >
    <div class="callout-header">
      <span class="callout-icon" aria-hidden="true">{{ icon }}</span>
      <span class="callout-label">{{ labelText }}</span>
    </div>
    <div class="callout-body">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    type?: "info" | "tip" | "warning" | "danger" | "important" | "success";
    label?: string;
  }>(),
  { type: "info" }
);

const icon = computed(() => {
  const icons: Record<string, string> = {
    info: "ℹ",
    tip: "💡",
    warning: "⚠️",
    danger: "🚨",
    important: "📌",
    success: "✅",
  };
  return icons[props.type] ?? "ℹ";
});

const labelText = computed(() => {
  if (props.label) return props.label;
  const defaults: Record<string, string> = {
    info: "Info",
    tip: "Tip",
    warning: "Warning",
    danger: "Danger",
    important: "Important",
    success: "Success",
  };
  return defaults[props.type] ?? "Note";
});
</script>

<style scoped>
.notely-callout {
  margin: var(--space-7) 0;
  padding: var(--space-5) var(--space-7);
  border-left: 3px solid;
  border-radius: var(--radius-md);
  font-size: var(--font-size-body-sm);
  line-height: 1.6;
}

.callout-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.callout-icon {
  font-size: 14px;
  line-height: 1;
}

.callout-label {
  font-size: var(--font-size-label);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

/* Status-mapped colors — all tokens, zero hardcoded values */
.notely-callout.info {
  background: var(--status-info-bg);
  border-color: var(--status-info-border);
  color: var(--status-info-text);
}

.notely-callout.tip,
.notely-callout.success {
  background: var(--status-success-bg);
  border-color: var(--status-success-border);
  color: var(--status-success-text);
}

.notely-callout.warning {
  background: var(--status-warning-bg);
  border-color: var(--status-warning-border);
  color: var(--status-warning-text);
}

.notely-callout.danger {
  background: var(--status-danger-bg);
  border-color: var(--status-danger-border);
  color: var(--status-danger-text);
}

.notely-callout.important {
  background: var(--surface-accent-strong);
  border-color: var(--accent-solid);
  color: var(--text-strong);
}
</style>
