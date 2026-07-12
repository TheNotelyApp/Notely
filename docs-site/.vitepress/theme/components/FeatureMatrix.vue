<template>
  <div class="feature-matrix-wrapper">
    <table class="feature-matrix" aria-label="Feature availability matrix">
      <thead>
        <tr>
          <th scope="col">Feature</th>
          <th scope="col">Available by default</th>
          <th scope="col">Needs setup</th>
          <th scope="col">Internet required</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="f in features" :key="f.feature">
          <td class="feature-name">{{ f.feature }}</td>
          <td><StatusIcon :value="f.available" /></td>
          <td>
            <span v-if="f.setup && f.setup !== 'No'" class="setup-label">{{ f.setup }}</span>
            <StatusIcon v-else :value="f.setup === 'No' ? false : false" />
          </td>
          <td><StatusIcon :value="f.internet" /></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { defineComponent, h } from "vue";

interface Feature {
  feature: string;
  available: boolean;
  setup: boolean | string;
  internet: boolean | string;
}

defineProps<{ features: Feature[] }>();

const StatusIcon = defineComponent({
  props: { value: [Boolean, String] },
  render() {
    const v = this.value;
    if (v === true || v === "Yes")
      return h("span", { class: "status-yes", "aria-label": "Yes" }, "✓");
    if (v === false || v === "No" || v === "")
      return h("span", { class: "status-no", "aria-label": "No" }, "—");
    return h("span", { class: "status-partial", "aria-label": String(v) }, "◦");
  },
});
</script>

<style scoped>
.feature-matrix-wrapper {
  overflow-x: auto;
  margin: var(--space-7) 0;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
}

.feature-matrix {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-body-sm);
}

.feature-matrix th {
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

.feature-matrix td {
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--border-muted);
  color: var(--app-text);
  vertical-align: middle;
}

.feature-matrix tbody tr:last-child td {
  border-bottom: none;
}

.feature-matrix tbody tr:hover {
  background: var(--surface-muted);
}

.feature-name {
  font-weight: 500;
  color: var(--text-strong);
}

.setup-label {
  font-size: var(--font-size-label);
  color: var(--status-info-text);
  background: var(--status-info-bg);
  border: 1px solid var(--status-info-border);
  border-radius: var(--radius-pill);
  padding: 2px 8px;
  white-space: nowrap;
}

:deep(.status-yes) {
  color: var(--status-success-text);
  font-weight: 700;
  font-size: 15px;
}

:deep(.status-no) {
  color: var(--text-subtle);
  font-weight: 400;
}

:deep(.status-partial) {
  color: var(--status-warning-text);
  font-weight: 600;
}
</style>
