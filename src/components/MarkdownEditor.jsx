import { useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { EditorSelection, RangeSetBuilder } from "@codemirror/state";
import { Decoration, EditorView, keymap } from "@codemirror/view";
import { createImageMarkdown, insertTextAtCursor } from "../utils/markdownUtils";
import { insertImagesFromFiles } from "../services/imageService";
import { applyMarkdownQuickFix, applyValidationSuggestion, getIssueFixType } from "../utils/markdownQuickFix";

function getLineStartIndex(text, lineNumber) {
  const targetLine = Math.max(lineNumber, 1);
  let currentLine = 1;
  for (let index = 0; index < text.length; index += 1) {
    if (currentLine === targetLine) return index;
    if (text[index] === "\n") currentLine += 1;
  }
  return text.length;
}

function getLineColumnFromIndex(text, index) {
  const safeIndex = Math.max(0, Math.min(Number(index) || 0, (text || "").length));
  const beforeCursor = (text || "").slice(0, safeIndex);
  const line = beforeCursor.split("\n").length;
  const lineStart = getLineStartIndex(text, line);
  return {
    line,
    column: safeIndex - lineStart + 1,
  };
}

function getTextIndexAtLineColumn(value, line, column) {
  const startIndex = getLineStartIndex(value || "", line);
  const safeColumn = Math.max(Number(column) || 1, 1);
  return Math.min(startIndex + safeColumn - 1, (value || "").length);
}

function getIssueLength(issue) {
  return Math.max(Number(issue?.sourceLength) || 0, Number(issue?.length) || 0, issue?.word?.length || 0, 1);
}

function buildDecorationSet(value, issues) {
  const builder = new RangeSetBuilder();
  const ranges = [];

  for (const issue of issues || []) {
    if (!Number.isFinite(issue?.line) || !Number.isFinite(issue?.column)) continue;
    const from = getTextIndexAtLineColumn(value || "", issue.line, issue.column);
    const to = Math.min(from + getIssueLength(issue), (value || "").length);
    if (to <= from) continue;

    let className = "cm-issue-other";
    if (issue.ruleId === "spelling") className = "cm-issue-spelling";

    ranges.push({ from, to, className });
  }

  ranges
    .sort((a, b) => {
      if (a.from !== b.from) return a.from - b.from;
      if (a.to !== b.to) return a.to - b.to;
      return a.className.localeCompare(b.className);
    })
    .forEach((range) => {
      builder.add(range.from, range.to, Decoration.mark({ class: range.className }));
    });

  if (!ranges.length) {
    // Return an empty set for a stable extension value when no issues are present.
    return builder.finish();
  }

  return builder.finish();
}

const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "transparent",
  },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily: '"Cascadia Code", Consolas, ui-monospace, monospace',
    lineHeight: "1.55",
  },
  ".cm-content": {
    whiteSpace: "pre",
    fontFamily: '"Cascadia Code", Consolas, ui-monospace, monospace',
    fontSize: "13px",
    padding: "14px 0",
    minHeight: "100%",
  },
  ".cm-line": {
    padding: "0 16px",
  },
  ".cm-gutters": {
    backgroundColor: "#f7f9f8",
    borderRight: "1px solid #e1e8e5",
    color: "#8aa0a7",
  },
  ".cm-activeLine, .cm-activeLineGutter": {
    backgroundColor: "rgba(26, 58, 62, 0.05)",
  },
  ".cm-issue-spelling": {
    backgroundColor: "rgba(184, 108, 0, 0.18)",
    boxShadow: "inset 0 -2px 0 rgba(184, 108, 0, 0.55)",
    borderRadius: "4px",
  },
  ".cm-issue-other": {
    backgroundColor: "rgba(142, 61, 90, 0.12)",
    boxShadow: "inset 0 -2px 0 rgba(142, 61, 90, 0.45)",
    borderRadius: "4px",
  },
});

function createEditorAdapter(view) {
  const clamp = (value) => Math.max(0, Math.min(Number(value) || 0, view.state.doc.length));
  const setSelection = (anchor, head) => {
    view.dispatch({ selection: EditorSelection.single(clamp(anchor), clamp(head)) });
  };

  return {
    get value() {
      return view.state.doc.toString();
    },
    focus() {
      view.focus();
    },
    get selectionStart() {
      return view.state.selection.main.from;
    },
    set selectionStart(nextValue) {
      setSelection(nextValue, view.state.selection.main.to);
    },
    get selectionEnd() {
      return view.state.selection.main.to;
    },
    set selectionEnd(nextValue) {
      setSelection(view.state.selection.main.from, nextValue);
    },
    get scrollTop() {
      return view.scrollDOM.scrollTop;
    },
    set scrollTop(nextValue) {
      view.scrollDOM.scrollTop = Number(nextValue) || 0;
    },
    get scrollLeft() {
      return view.scrollDOM.scrollLeft;
    },
    set scrollLeft(nextValue) {
      view.scrollDOM.scrollLeft = Number(nextValue) || 0;
    },
    get scrollHeight() {
      return view.scrollDOM.scrollHeight;
    },
    get clientHeight() {
      return view.scrollDOM.clientHeight;
    },
    getLineHeight() {
      return parseFloat(window.getComputedStyle(view.contentDOM).lineHeight) || 20;
    },
    addEventListener(type, listener, options) {
      view.scrollDOM.addEventListener(type, listener, options);
    },
    removeEventListener(type, listener, options) {
      view.scrollDOM.removeEventListener(type, listener, options);
    },
  };
}

export function MarkdownEditor({
  value,
  onChange,
  textareaRef,
  onNotify,
  validationIssues = [],
  onJumpToLine,
  focusedLine = 1,
  onUndo,
  onRedo,
  onOpenFind,
  onEditorReady,
}) {
  const viewRef = useRef(null);
  const menuRef = useRef(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [activeLine, setActiveLine] = useState(1);

  const validationDecorations = useMemo(() => buildDecorationSet(value, validationIssues), [value, validationIssues]);

  useEffect(() => {
    if (Number.isFinite(focusedLine) && focusedLine > 0) {
      setActiveLine(focusedLine);
    }
  }, [focusedLine]);

  useEffect(() => {
    if (!contextMenu) return undefined;

    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setContextMenu(null);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setContextMenu(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [contextMenu]);

  const applyIssueAction = (issue) => {
    if (!issue) return;

    const quickFixResult = applyMarkdownQuickFix(value, issue);
    if (quickFixResult.changed) {
      onChange(quickFixResult.nextValue);
      onNotify?.(quickFixResult.message, "success");
      setContextMenu(null);
      return;
    }

    const suggestionResult = applyValidationSuggestion(value, issue);
    if (suggestionResult.changed) {
      onChange(suggestionResult.nextValue);
      onNotify?.(suggestionResult.message, "success");
      setContextMenu(null);
      return;
    }

    onNotify?.("No automatic fix available for this issue.", "warning");
  };

  const editorExtensions = useMemo(() => [
    markdown(),
    editorTheme,
    EditorView.decorations.of(validationDecorations),
    EditorView.lineWrapping,
    EditorView.domEventHandlers({
      contextmenu(event, view) {
        event.preventDefault();
        const position = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.selection.main.from;
        view.dispatch({ selection: EditorSelection.single(position) });

        const docValue = view.state.doc.toString();
        const lineColumn = getLineColumnFromIndex(docValue, position);
        setActiveLine(lineColumn.line);

        const lineIssues = (validationIssues || []).filter((issue) => issue.line === lineColumn.line);
        const matchingIssues = lineIssues.filter((issue) => {
          const issueColumn = Math.max(Number(issue?.column) || 1, 1);
          const issueEndColumn = issueColumn + getIssueLength(issue) - 1;
          return lineColumn.column >= issueColumn && lineColumn.column <= issueEndColumn;
        });
        const targetIssues = matchingIssues.length ? matchingIssues : lineIssues;

        setContextMenu({
          x: event.clientX,
          y: event.clientY,
          line: lineColumn.line,
          issues: targetIssues,
        });
        return true;
      },
      dragover(event) {
        if (event.dataTransfer?.types?.includes("Files")) {
          event.preventDefault();
        }
        return false;
      },
      async drop(event, view) {
        const files = event.dataTransfer?.files || [];
        if (!files.length) return false;

        event.preventDefault();

        try {
          const results = await insertImagesFromFiles(files);
          const markdownImages = results.map((result) => createImageMarkdown(result.altText, result.imagePath));
          const adapter = textareaRef?.current;
          insertTextAtCursor(view.state.doc.toString(), onChange, `${markdownImages.join("\n\n")}\n`, adapter ? { current: adapter } : textareaRef);
          onNotify?.(`Inserted ${results.length} image${results.length > 1 ? "s" : ""}.`, "success");
        } catch (error) {
          console.error("Image drop insertion failed:", error);
          onNotify?.(error?.message || "Failed to insert dropped images.", "error");
        }
        return true;
      },
    }),
    keymap.of([
      {
        key: "Mod-f",
        run() {
          onOpenFind?.();
          return true;
        },
      },
      {
        key: "Mod-z",
        run() {
          onUndo?.();
          return true;
        },
      },
      {
        key: "Mod-y",
        run() {
          onRedo?.();
          return true;
        },
      },
      {
        key: "Mod-Shift-z",
        run() {
          onRedo?.();
          return true;
        },
      },
    ]),
  ], [onChange, onNotify, onOpenFind, onRedo, onUndo, textareaRef, validationDecorations, validationIssues]);

  return (
    <div className="markdown-editor">
      <CodeMirror
        className="markdown-codemirror"
        value={value}
        height="100%"
        basicSetup={{
          foldGutter: false,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          dropCursor: false,
          searchKeymap: false,
        }}
        extensions={editorExtensions}
        onCreateEditor={(view) => {
          viewRef.current = view;
          if (textareaRef) {
            textareaRef.current = createEditorAdapter(view);
          }
          onEditorReady?.();
        }}
        onUpdate={(update) => {
          const position = update.state.selection.main.head;
          const { line } = getLineColumnFromIndex(update.state.doc.toString(), position);
          setActiveLine(line);
          if (textareaRef && viewRef.current) {
            textareaRef.current = createEditorAdapter(viewRef.current);
          }
        }}
        onChange={(nextValue) => {
          onChange(nextValue);
        }}
      />
      {contextMenu ? (
        <div
          ref={menuRef}
          className="editor-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
          aria-label="Editor context menu"
        >
          <button type="button" role="menuitem" onClick={() => onJumpToLine?.(contextMenu.line)}>
            Go to line {contextMenu.line}
          </button>
          {contextMenu.issues.length ? (
            <div className="editor-context-menu-group">
              {contextMenu.issues.map((issue, index) => {
                const label = getIssueFixType(issue)
                  ? "Quick fix"
                  : issue.suggestion
                    ? `Apply suggestion${issue.suggestion ? `: ${issue.suggestion}` : ""}`
                    : "Review issue";
                return (
                  <button
                    key={`${issue.line}-${issue.column}-${index}`}
                    type="button"
                    role="menuitem"
                    onClick={() => applyIssueAction(issue)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ) : (
            <button type="button" role="menuitem" onClick={() => onNotify?.("No validation issues on this line.", "info")}>
              No issues on this line
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
