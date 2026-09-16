import { EditorView } from "@codemirror/view";

export const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "transparent",
  },
  "&.cm-focused": {
    outline: "none !important",
  },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily: '"Cascadia Code", Consolas, ui-monospace, monospace',
    lineHeight: "1.6",
  },
  ".cm-content": {
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    fontFamily: 'inherit',
    fontSize: "var(--font-size-body, 14px)",
    color: "var(--app-text)",
    padding: "14px 0 max(72px, 45vh)",
    minHeight: "100%",
  },
  ".cm-line": {
    padding: "0 16px",
  },
  ".cm-gutters": {
    backgroundColor: "var(--surface-bg)",
    borderRight: "1px solid var(--border-default)",
    color: "var(--text-muted)",
  },
  ".cm-activeLine, .cm-activeLineGutter": {
    backgroundColor: "var(--surface-accent)",
  },
  ".cm-selectionLayer": {
    display: "none !important",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "rgba(10, 107, 138, 0.3) !important",
  },
  ".cm-issue-spelling": {
    backgroundColor: "var(--status-warning-bg)",
    boxShadow: "inset 0 -2px 0 var(--status-warning-border)",
    borderRadius: "4px",
  },
  ".cm-issue-other": {
    backgroundColor: "var(--status-danger-bg)",
    boxShadow: "inset 0 -2px 0 var(--status-danger-border)",
    borderRadius: "4px",
  },
  ".cm-find-match": {
    backgroundColor: "var(--status-success-bg)",
    boxShadow: "inset 0 0 0 1px var(--status-success-border)",
    borderRadius: "4px",
  },
  ".cm-find-match-active": {
    backgroundColor: "var(--status-success-bg)",
    boxShadow: "inset 0 0 0 2px var(--status-success-text)",
    borderRadius: "4px",
  },
});
