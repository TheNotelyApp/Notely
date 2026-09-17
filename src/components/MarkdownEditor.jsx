import { useEffect, useMemo, useRef, useState, useCallback, memo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { Search, Copy, BookPlus, Wand2 } from "lucide-react";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { EditorSelection, RangeSetBuilder } from "@codemirror/state";
import { Decoration, EditorView, keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { createMediaMarkdown, insertTextAtCursor } from "../utils/markdownUtils";
import { insertMediaFromFiles } from "../services/imageService";
import { applyMarkdownQuickFix, applyValidationSuggestion, getIssueFixType } from "../utils/markdownQuickFix";
import { editorTheme } from "../utils/editorTheme";
import { generateDiagramId } from "../utils/diagramFileUtils";
import { useClipboardPaste } from "../hooks/useClipboardPaste";
import SlashMenuOverlay from "./SlashMenuOverlay";

function wrapSelection(view, before, after = before, placeholder = "") {
  const changes = view.state.changeByRange((range) => {
    if (range.empty) {
      const insert = before + placeholder + after;
      return {
        changes: { from: range.from, insert },
        range: EditorSelection.range(range.from + before.length, range.from + before.length + placeholder.length),
      };
    }
    const text = view.state.sliceDoc(range.from, range.to);
    if (text.startsWith(before) && text.endsWith(after) && text.length >= before.length + after.length) {
      const unwrapped = text.slice(before.length, text.length - after.length);
      return {
        changes: { from: range.from, to: range.to, insert: unwrapped },
        range: EditorSelection.range(range.from, range.from + unwrapped.length),
      };
    }
    return {
      changes: { from: range.from, to: range.to, insert: before + text + after },
      range: EditorSelection.range(range.from + before.length, range.to + before.length),
    };
  });
  view.dispatch(changes);
  return true;
}

function toggleTaskCheckbox(view) {
  const changes = view.state.changeByRange((range) => {
    const line = view.state.doc.lineAt(range.from);
    const lineText = line.text;
    let nextText = null;

    if (/^(\s*[-*+]\s+)\[ \]\s*/.test(lineText)) {
      nextText = lineText.replace(/^(\s*[-*+]\s+)\[ \]\s*/, "$1[x] ");
    } else if (/^(\s*[-*+]\s+)\[[xX]\]\s*/.test(lineText)) {
      nextText = lineText.replace(/^(\s*[-*+]\s+)\[[xX]\]\s*/, "$1[ ] ");
    } else if (/^(\s*[-*+]\s+)/.test(lineText)) {
      nextText = lineText.replace(/^(\s*[-*+]\s+)/, "$1[ ] ");
    } else if (/^(\s*)/.test(lineText)) {
      nextText = lineText.replace(/^(\s*)/, "$1- [ ] ");
    }

    if (nextText !== null) {
      const diff = nextText.length - lineText.length;
      return {
        changes: { from: line.from, to: line.to, insert: nextText },
        range: EditorSelection.cursor(Math.max(line.from, range.from + diff)),
      };
    }
    return { range };
  });
  view.dispatch(changes);
  return true;
}

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

function buildFindMatchDecorations(matches, activeMatchIndex) {
  const builder = new RangeSetBuilder();

  (matches || []).forEach((match, index) => {
    const from = Number(match?.start);
    const to = Number(match?.end);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return;

    builder.add(
      from,
      to,
      Decoration.mark({ class: index === activeMatchIndex ? "cm-find-match-active" : "cm-find-match" })
    );
  });

  return builder.finish();
}



function createEditorAdapter(view) {
  const clamp = (value) => Math.max(0, Math.min(Number(value) || 0, view.state.doc.length));
  const setSelection = (anchor, head) => {
    view.dispatch({
      selection: EditorSelection.single(clamp(anchor), clamp(head)),
      scrollIntoView: true,
    });
  };

  return {
    get value() {
      return view.state.doc.toString();
    },
    focus() {
      view.focus();
    },
    setSelectionRange(start, end = start) {
      setSelection(start, end);
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
    getTopLine() {
      const block = view.lineBlockAtHeight(view.scrollDOM.scrollTop);
      return view.state.doc.lineAt(block.from).number;
    },
    getLineStartOffset(lineNumber) {
      const safeLine = Math.max(1, Math.min(Number(lineNumber) || 1, view.state.doc.lines));
      return view.state.doc.line(safeLine).from;
    },
    scrollToLine(lineNumber) {
      const safeLine = Math.max(1, Math.min(Number(lineNumber) || 1, view.state.doc.lines));
      const line = view.state.doc.line(safeLine);
      view.dispatch({
        selection: EditorSelection.single(line.from),
        effects: EditorView.scrollIntoView(line.from, { y: "center" }),
      });
    },
    getLineTop(lineNumber) {
      const safeLine = Math.max(1, Math.min(Number(lineNumber) || 1, view.state.doc.lines));
      const line = view.state.doc.line(safeLine);
      const block = view.lineBlockAt(line.from);
      return block.top;
    },
    addEventListener(type, listener, options) {
      view.scrollDOM.addEventListener(type, listener, options);
    },
    removeEventListener(type, listener, options) {
      view.scrollDOM.removeEventListener(type, listener, options);
    },
  };
}

export const MarkdownEditor = memo(function MarkdownEditorContent({
  value,
  onChange,
  textareaRef,
  readOnly = false,
  onNotify,
  validationIssues = [],
  onIgnoreSpellingWord,
  onJumpToLine,
  focusedLine = 1,
  onUndo,
  onRedo,
  onOpenFind,
  onToggleFind,
  onSearchRequest,
  findMatches = [],
  activeFindMatchIndex = -1,
  onEditorReady,
  _tableEditorEnabled = true,
  basePath,
}) {
  const viewRef = useRef(null);

  const handleInsertMarkdownAtCursor = useCallback((mdText) => {
    if (!viewRef.current || !mdText) return;
    const view = viewRef.current;
    const selection = view.state.selection.main;
    view.dispatch({
      changes: { from: selection.from, to: selection.to, insert: mdText },
      selection: { anchor: selection.from + mdText.length },
    });
    onChange?.(view.state.doc.toString());
  }, [onChange]);

  const { handlePaste } = useClipboardPaste({
    enabled: !readOnly,
    basePath,
    onInsertMarkdown: handleInsertMarkdownAtCursor,
    onNotify,
  });
  const menuRef = useRef(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [slashMenu, setSlashMenu] = useState(null);
  const [_activeLine, setActiveLine] = useState(1);
  const [docLength, setDocLength] = useState(String(value || "").length);
  const [activeTableInfo, setActiveTableInfo] = useState(null);

  const handleSelectSlashCommand = useCallback(async (insertedText) => {
    if (!slashMenu || !viewRef.current) return;
    const view = viewRef.current;
    const selection = view.state.selection.main;
    const fromPos = Number.isFinite(slashMenu.slashPos) ? slashMenu.slashPos : selection.head - 1;
    const toPos = selection.head;

    setSlashMenu(null);

    if (insertedText) {
      view.dispatch({
        changes: { from: Math.max(0, fromPos), to: Math.max(fromPos, toPos), insert: insertedText },
        selection: { anchor: Math.max(0, fromPos) + insertedText.length },
      });
      onChange?.(view.state.doc.toString());
    }
  }, [slashMenu, onChange]);

  const lastScrollTopRef = useRef(0);

  useEffect(() => {
    const view = viewRef.current;
    if (!view?.scrollDOM) return;
    const handleScroll = () => {
      if (view?.scrollDOM) {
        lastScrollTopRef.current = view.scrollDOM.scrollTop;
      }
    };
    const scrollDOM = view.scrollDOM;
    scrollDOM.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollDOM.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (viewRef.current?.scrollDOM && lastScrollTopRef.current > 0) {
      const targetScroll = lastScrollTopRef.current;
      requestAnimationFrame(() => {
        if (viewRef.current?.scrollDOM) {
          viewRef.current.scrollDOM.scrollTop = targetScroll;
        }
      });
      window.setTimeout(() => {
        if (viewRef.current?.scrollDOM) {
          viewRef.current.scrollDOM.scrollTop = targetScroll;
        }
      }, 60);
    }
  }, [value]);

  useEffect(() => {
    if (viewRef.current && Number.isFinite(focusedLine) && focusedLine > 0) {
      const view = viewRef.current;
      const safeLine = Math.max(1, Math.min(focusedLine, view.state.doc.lines));
      const lineObj = view.state.doc.line(safeLine);

      // Single cursor at start of line without selecting/highlighting block!
      view.dispatch({
        selection: { anchor: lineObj.from },
        scrollIntoView: true,
      });

      if (view.scrollDOM) {
        const block = view.lineBlockAt(lineObj.from);
        view.scrollDOM.scrollTop = Math.max(0, block.top - view.scrollDOM.clientHeight / 3);
      }
    }
  }, [focusedLine]);

  const [themeMode, setThemeMode] = useState(() => {
    return document.documentElement.getAttribute("data-theme") || "light";
  });

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
      setThemeMode(currentTheme);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const valueLength = String(value || "").length;
  const decorationsSynced = docLength === valueLength;
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);



  const positionSuggestionFlyout = (containerElement) => {
    if (!containerElement) return;

    const submenu = containerElement.querySelector(".editor-fix-submenu-list");
    const trigger = containerElement.querySelector(".editor-fix-submenu-trigger");
    if (!submenu || !trigger) return;

    const previousDisplay = submenu.style.display;
    const previousVisibility = submenu.style.visibility;
    submenu.style.display = "grid";
    submenu.style.visibility = "hidden";

    const submenuBounds = submenu.getBoundingClientRect();
    const triggerBounds = trigger.getBoundingClientRect();

    submenu.style.display = previousDisplay;
    submenu.style.visibility = previousVisibility;

    const viewportPadding = 8;
    const flyoutGap = 6;
    const minRightSpace = 148;
    const minBottomSpace = 120;
    const rightSpace = window.innerWidth - triggerBounds.right;
    const bottomSpace = window.innerHeight - triggerBounds.top;
    const wouldOverflowRight = triggerBounds.right + flyoutGap + submenuBounds.width > window.innerWidth - viewportPadding;
    const wouldOverflowBottom = triggerBounds.top - 4 + submenuBounds.height > window.innerHeight - viewportPadding;
    const shouldPreferLeft = rightSpace < minRightSpace;
    const shouldPreferUp = bottomSpace < minBottomSpace;

    containerElement.classList.toggle("open-left", wouldOverflowRight || shouldPreferLeft);
    containerElement.classList.toggle("open-up", wouldOverflowBottom || shouldPreferUp);
  };

  const validationDecorations = useMemo(() => {
    if (!decorationsSynced) return Decoration.none;
    return buildDecorationSet(value, validationIssues);
  }, [decorationsSynced, value, validationIssues]);

  const findMatchDecorations = useMemo(
    () => {
      if (!decorationsSynced) return Decoration.none;
      return buildFindMatchDecorations(findMatches, activeFindMatchIndex);
    },
    [activeFindMatchIndex, decorationsSynced, findMatches]
  );

  useEffect(() => {
    if (Number.isFinite(focusedLine) && focusedLine > 0) {
      setActiveLine(focusedLine);
    }
  }, [focusedLine]);

  useEffect(() => () => {
    viewRef.current = null;
    if (textareaRef) {
      textareaRef.current = null;
    }
  }, [textareaRef]);

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

  useEffect(() => {
    if (!contextMenu || !menuRef.current) return;

    const VIEWPORT_PADDING = 8;
    const bounds = menuRef.current.getBoundingClientRect();
    const maxX = Math.max(VIEWPORT_PADDING, window.innerWidth - bounds.width - VIEWPORT_PADDING);
    const maxY = Math.max(VIEWPORT_PADDING, window.innerHeight - bounds.height - VIEWPORT_PADDING);

    let nextX = contextMenu.x;
    let nextY = contextMenu.y;

    if (bounds.bottom > window.innerHeight - VIEWPORT_PADDING) {
      nextY = contextMenu.anchorY - bounds.height;
    }

    nextX = Math.min(maxX, Math.max(VIEWPORT_PADDING, nextX));
    nextY = Math.min(maxY, Math.max(VIEWPORT_PADDING, nextY));

    if (nextX !== contextMenu.x || nextY !== contextMenu.y) {
      setContextMenu((current) => {
        if (!current) return current;
        if (current.x === nextX && current.y === nextY) return current;
        return {
          ...current,
          x: nextX,
          y: nextY,
        };
      });
    }
  }, [contextMenu]);

  const withViewportRestore = useCallback((applyChange) => {
    const previousView = viewRef.current;
    const previousScrollTop = viewRef.current?.scrollDOM?.scrollTop;
    const previousScrollLeft = viewRef.current?.scrollDOM?.scrollLeft;
    const previousTopLine = (() => {
      if (!previousView || !Number.isFinite(previousScrollTop)) return null;
      const block = previousView.lineBlockAtHeight(previousScrollTop);
      return previousView.state.doc.lineAt(block.from).number;
    })();
    const restoreViewport = () => {
      const view = viewRef.current;
      if (!view || !Number.isFinite(previousScrollTop)) return;

      if (Number.isFinite(previousTopLine)) {
        const safeLine = Math.max(1, Math.min(previousTopLine, view.state.doc.lines));
        const line = view.state.doc.line(safeLine);
        const block = view.lineBlockAt(line.from);
        view.scrollDOM.scrollTop = block.top;
      } else {
        view.scrollDOM.scrollTop = previousScrollTop;
      }
      view.scrollDOM.scrollLeft = Number.isFinite(previousScrollLeft) ? previousScrollLeft : 0;
    };
    const scheduleViewportRestore = () => {
      requestAnimationFrame(restoreViewport);
      window.setTimeout(restoreViewport, 80);
      window.setTimeout(restoreViewport, 220);
      window.setTimeout(restoreViewport, 300);
    };

    applyChange(scheduleViewportRestore);
  }, []);

  const applyIssueSuggestion = useCallback((issue, selectedSuggestion = null) => {
    withViewportRestore((scheduleViewportRestore) => {
      const suggestionResult = applyValidationSuggestion(value, issue, selectedSuggestion);
      if (!suggestionResult.changed) {
        onNotify?.(suggestionResult.message, "warning");
        return;
      }

      onChange(suggestionResult.nextValue);
      scheduleViewportRestore();
      onNotify?.(suggestionResult.message, "success");
      setContextMenu(null);
    });
  }, [value, onChange, onNotify, withViewportRestore]);

  const applyIssueAction = useCallback((issue) => {
    if (!issue) return;

    withViewportRestore((scheduleViewportRestore) => {
      const quickFixResult = applyMarkdownQuickFix(value, issue);
      if (quickFixResult.changed) {
        const previousValue = value;
        const nextValue = quickFixResult.nextValue;
        onChange(nextValue);
        scheduleViewportRestore();

        const showUndoToast = (currVal, prevVal, isUndo) => {
          onNotify?.(
            isUndo ? "Reverted change." : quickFixResult.message,
            "success",
            {
              label: isUndo ? "Redo" : "Undo",
              onClick: () => {
                onChange(isUndo ? currVal : prevVal);
                showUndoToast(currVal, prevVal, !isUndo);
              }
            }
          );
        };
        showUndoToast(nextValue, previousValue, false);
        setContextMenu(null);
        return;
      }

      const suggestionResult = applyValidationSuggestion(value, issue);
      if (suggestionResult.changed) {
        const previousValue = value;
        const nextValue = suggestionResult.nextValue;
        onChange(nextValue);
        scheduleViewportRestore();

        const showUndoToast = (currVal, prevVal, isUndo) => {
          onNotify?.(
            isUndo ? "Reverted change." : suggestionResult.message,
            "success",
            {
              label: isUndo ? "Redo" : "Undo",
              onClick: () => {
                onChange(isUndo ? currVal : prevVal);
                showUndoToast(currVal, prevVal, !isUndo);
              }
            }
          );
        };
        showUndoToast(nextValue, previousValue, false);
        setContextMenu(null);
        return;
      }

      onNotify?.("No automatic fix available for this issue.", "warning");
    });
  }, [value, onChange, onNotify, withViewportRestore]);

  useEffect(() => {
    if (!window.notesApi?.onContextMenuAction) return undefined;
    const unsubscribe = window.notesApi.onContextMenuAction(({ action, payload }) => {
      if (action === "jump-to-line") {
        onJumpToLine?.(payload);
      } else if (action === "copy-selection") {
        if (viewRef.current) {
          const { from, to } = viewRef.current.state.selection.main;
          const text = viewRef.current.state.sliceDoc(from, to);
          navigator.clipboard.writeText(text).then(() => {
            onNotify?.("Copied to clipboard", "success");
          }).catch(() => {
            onNotify?.("Failed to copy text", "error");
          });
        }
      } else if (action === "find-in-document") {
        onSearchRequest?.(payload);
      } else if (action === "apply-issue-action") {
        if (payload) {
          applyIssueAction(payload);
        }
      } else if (action === "apply-suggestion") {
        if (payload) {
          applyIssueSuggestion(payload.issue, payload.suggestion);
        }
      } else if (action === "ignore-spelling") {
        if (payload) {
          onIgnoreSpellingWord?.(payload);
        }
      }
    });
    return unsubscribe;
  }, [
    onJumpToLine,
    onSearchRequest,
    onNotify,
    onIgnoreSpellingWord,
    value,
    onChange,
    applyIssueAction,
    applyIssueSuggestion,
  ]);

  const editorExtensions = useMemo(() => [
    markdown({ base: markdownLanguage }),
    editorTheme,
    EditorView.decorations.of(findMatchDecorations),
    EditorView.decorations.of(validationDecorations),
    EditorView.lineWrapping,
    EditorView.domEventHandlers({
      contextmenu(event, view) {
        event.preventDefault();
        const position = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.selection.main.from;
        const currentSelection = view.state.selection.main;
        const keepSelection = !currentSelection.empty && position >= currentSelection.from && position <= currentSelection.to;
        if (!keepSelection) {
          view.dispatch({ selection: EditorSelection.single(position) });
        }

        const docValue = view.state.doc.toString();
        const activeSelection = keepSelection ? currentSelection : view.state.selection.main;
        const lineColumn = getLineColumnFromIndex(docValue, position);
        setActiveLine(lineColumn.line);

        const lineIssues = (validationIssues || []).filter((issue) => issue.line === lineColumn.line);
        const matchingIssues = lineIssues.filter((issue) => {
          const issueColumn = Math.max(Number(issue?.column) || 1, 1);
          const issueEndColumn = issueColumn + getIssueLength(issue) - 1;
          return lineColumn.column >= issueColumn && lineColumn.column <= issueEndColumn;
        });
        const targetIssues = matchingIssues.length ? matchingIssues : lineIssues;

        if (window.notesApi?.showContextMenu) {
          const menuTemplate = [];

          if (Number.isFinite(lineColumn.line) && lineColumn.line !== _activeLine) {
            menuTemplate.push({
              label: `Go to line ${lineColumn.line}`,
              action: "jump-to-line",
              payload: lineColumn.line,
            });
            menuTemplate.push({ type: "separator" });
          }

          if (!activeSelection.empty) {
            const selectedText = docValue.slice(activeSelection.from, activeSelection.to);
            menuTemplate.push({
              label: "Copy selection",
              action: "copy-selection",
            });
            menuTemplate.push({
              label: "Find in document",
              action: "find-in-document",
              payload: selectedText,
            });
          }

          if (targetIssues.length) {
            menuTemplate.push({ type: "separator" });
            targetIssues.forEach((issue) => {
              const label = getIssueFixType(issue)
                ? "Quick fix"
                : issue.suggestion
                  ? `Apply suggestion${issue.suggestion ? `: ${issue.suggestion}` : ""}`
                  : "Review issue";
              const alternatives = Array.isArray(issue?.suggestions)
                ? issue.suggestions.filter((entry) => String(entry || "").trim())
                : [];
              
              if (alternatives.length > 1) {
                menuTemplate.push({
                  label: "Apply suggestion",
                  submenu: alternatives.map((entry) => ({
                    label: entry,
                    action: "apply-suggestion",
                    payload: { issue, suggestion: entry },
                  })),
                });
              } else {
                menuTemplate.push({
                  label: label,
                  action: "apply-issue-action",
                  payload: issue,
                });
              }

              if (issue.ruleId === "spelling" && issue.word) {
                menuTemplate.push({
                  label: `Add to dictionary: ${issue.word}`,
                  action: "ignore-spelling",
                  payload: issue.word,
                });
              }
            });
          }

          window.notesApi.showContextMenu(menuTemplate);
          return true;
        }

        setContextMenu({
          x: event.clientX,
          y: event.clientY,
          anchorX: event.clientX,
          anchorY: event.clientY,
          line: lineColumn.line,
          issues: targetIssues,
          hasSelection: !activeSelection.empty,
          selectedText: !activeSelection.empty ? docValue.slice(activeSelection.from, activeSelection.to) : "",
        });
        return true;
      },
      dragover(event) {
        if (event.dataTransfer?.types?.includes("Files")) {
          event.preventDefault();
        }
        return false;
      },
      paste(event) {
        void handlePaste(event);
        return false;
      },
      drop(event, view) {
        const files = event.dataTransfer?.files || [];
        if (!files.length) return false;

        event.preventDefault();
        const dropPosition = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (Number.isFinite(dropPosition)) {
          view.dispatch({ selection: EditorSelection.single(dropPosition) });
        }

        onNotify?.("Uploading dropped files...", "info");

        void (async () => {
          try {
            const drawioFiles = Array.from(files).filter(
              (file) => file.name.endsWith(".drawio") || file.name.endsWith(".drawio.xml")
            );
            const otherFiles = Array.from(files).filter(
              (file) => !file.name.endsWith(".drawio") && !file.name.endsWith(".drawio.xml")
            );

            const insertedBlocks = [];

            // Process Draw.io files
            for (const file of drawioFiles) {
              const xmlContent = await file.text();
              const diagramId = generateDiagramId();
              if (window.notesApi?.drawioWriteSource) {
                await window.notesApi.drawioWriteSource({ diagramId, data: xmlContent, documentPath: basePath });
                insertedBlocks.push(`![Draw.io Diagram](media/draw.io/${diagramId}.png){data-diagram-id="${diagramId}"}`);
              }
            }

            // Process other media files
            if (otherFiles.length > 0) {
              const results = await insertMediaFromFiles(otherFiles);
              const markdownImages = results.map((result) =>
                createMediaMarkdown(result.altText, result.mediaPath || result.imagePath)
              );
              insertedBlocks.push(...markdownImages);
            }

            if (insertedBlocks.length > 0) {
              const adapter = createEditorAdapter(view);
              insertTextAtCursor(
                view.state.doc.toString(),
                onChange,
                `\n\n${insertedBlocks.join("\n\n")}\n`,
                { current: adapter }
              );
              onNotify?.(`Inserted ${insertedBlocks.length} item(s).`, "success");
            }
          } catch (error) {
            console.error("Media drop insertion failed:", error);
            onNotify?.(error?.message || "Failed to insert dropped media.", "error");
          }
        })();

        return true;
      },
    }),
    keymap.of([
      indentWithTab,
      {
        key: "Mod-b",
        run(view) {
          return wrapSelection(view, "**", "**", "bold text");
        },
      },
      {
        key: "Mod-i",
        run(view) {
          return wrapSelection(view, "_", "_", "italic text");
        },
      },
      {
        key: "Mod-e",
        run(view) {
          return wrapSelection(view, "`", "`", "code");
        },
      },
      {
        key: "Mod-Shift-x",
        run(view) {
          return wrapSelection(view, "~~", "~~", "strikethrough");
        },
      },
      {
        key: "Mod-Enter",
        run(view) {
          return toggleTaskCheckbox(view);
        },
      },
      {
        key: "Mod-f",
        run() {
          if (typeof onToggleFind === "function") {
            onToggleFind();
          } else {
            onOpenFind?.();
          }
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
        key: "Escape",
        run(_view) {
          if (slashMenu) {
            setSlashMenu(null);
            return true;
          }
          return false;
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
  ], [basePath, findMatchDecorations, handlePaste, onChange, onNotify, onOpenFind, onRedo, onToggleFind, onUndo, validationDecorations, validationIssues, _activeLine, slashMenu]);

  return (
    <div
      className={`markdown-editor${isDragOver ? " cm-drop-active" : ""}`}
      onDragEnter={(e) => {
        if (e.dataTransfer?.types?.includes("Files")) {
          dragCounterRef.current += 1;
          setIsDragOver(true);
        }
      }}
      onDragLeave={() => {
        dragCounterRef.current -= 1;
        if (dragCounterRef.current <= 0) {
          dragCounterRef.current = 0;
          setIsDragOver(false);
        }
      }}
      onDrop={() => {
        dragCounterRef.current = 0;
        setIsDragOver(false);
      }}
    >
      <CodeMirror
        className="markdown-codemirror"
        value={value}
        height="100%"
        editable={!readOnly}
        theme={themeMode === "dark" ? "dark" : "light"}
        basicSetup={{
          foldGutter: false,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          dropCursor: false,
          searchKeymap: false,
          drawSelection: false,
        }}
        extensions={editorExtensions}
        onCreateEditor={(view) => {
          viewRef.current = view;
          setDocLength(view.state.doc.length);
          if (textareaRef) {
            textareaRef.current = createEditorAdapter(view);
          }
          onEditorReady?.();
        }}
        onUpdate={(update) => {
          setDocLength(update.state.doc.length);

          const position = update.state.selection.main.head;
          const { line } = getLineColumnFromIndex(update.state.doc.toString(), position);
          setActiveLine(line);
          if (textareaRef && viewRef.current) {
            textareaRef.current = createEditorAdapter(viewRef.current);
          }

          if (update.docChanged || update.selectionSet) {
            const lineObj = update.state.doc.line(line);
            const lineText = lineObj.text;
            const cursorCol = position - lineObj.from;
            const slashIndex = lineText.lastIndexOf("/", cursorCol);

            if (slashIndex !== -1 && (slashIndex === 0 || /\s/.test(lineText[slashIndex - 1]))) {
              const query = lineText.slice(slashIndex + 1, cursorCol);
              if (!/\s/.test(query)) {
                const coords = viewRef.current?.coordsAtPos(position);
                if (coords) {
                  setSlashMenu({
                    x: Math.max(16, coords.left),
                    y: Math.max(16, coords.bottom + 4),
                    line,
                    query,
                    slashPos: lineObj.from + slashIndex,
                  });
                }
              } else {
                setSlashMenu(null);
              }
            } else {
              setSlashMenu(null);
            }
          }

          if (update.selectionSet || update.docChanged || update.viewportChanged) {
            if (activeTableInfo && update.state.selection.main.from === update.state.selection.main.to) {
              // Allow overlay to handle itself, unless cursor completely moved away
            }
            setActiveTableInfo(null);
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
          {Number.isFinite(contextMenu.line) && contextMenu.line !== _activeLine ? (
            <button type="button" role="menuitem" onClick={() => onJumpToLine?.(contextMenu.line)}>
              Go to line {contextMenu.line}
            </button>
          ) : null}
          {contextMenu.hasSelection ? (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  if (viewRef.current) {
                    const { from, to } = viewRef.current.state.selection.main;
                    const text = viewRef.current.state.sliceDoc(from, to);
                    navigator.clipboard.writeText(text).then(() => {
                      onNotify?.("Copied to clipboard", "success");
                    }).catch(() => {
                      onNotify?.("Failed to copy text", "error");
                    });
                  }
                  setContextMenu(null);
                }}
              >
                <Copy size={16} />
                Copy selection
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  if (viewRef.current) {
                    const { from, to } = viewRef.current.state.selection.main;
                    const text = viewRef.current.state.sliceDoc(from, to);
                    onSearchRequest?.(text);
                  }
                  setContextMenu(null);
                }}
              >
                <Search size={16} />
                Find in document
              </button>
            </>
          ) : null}

          {contextMenu.issues.length ? (
            <div className="editor-context-menu-group">
              <div className="editor-context-menu-label">Fixes</div>
              {contextMenu.issues.map((issue, index) => {
                const label = getIssueFixType(issue)
                  ? "Quick fix"
                  : issue.suggestion
                    ? `Apply suggestion${issue.suggestion ? `: ${issue.suggestion}` : ""}`
                    : "Review issue";
                const alternatives = Array.isArray(issue?.suggestions)
                  ? issue.suggestions.filter((entry) => String(entry || "").trim())
                  : [];
                const hasSuggestionFlyout = alternatives.length > 1;
                return (
                  <div key={`${issue.line}-${issue.column}-${index}`}>
                    {hasSuggestionFlyout ? (
                      <div
                        className="editor-fix-submenu-flyout"
                        role="none"
                        onMouseEnter={(event) => positionSuggestionFlyout(event.currentTarget)}
                        onFocusCapture={(event) => positionSuggestionFlyout(event.currentTarget)}
                      >
                        <button
                          type="button"
                          role="menuitem"
                          aria-haspopup="menu"
                          className="editor-fix-submenu-trigger"
                          onClick={(event) => {
                            event.preventDefault();
                          }}
                        >
                          Apply suggestion
                        </button>
                        <div className="editor-fix-submenu-list" role="menu">
                          {alternatives.map((entry) => (
                            <button
                              key={`${issue.line}-${issue.column}-${index}-${entry}`}
                              type="button"
                              role="menuitem"
                              onClick={() => applyIssueSuggestion(issue, entry)}
                            >
                              {entry}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => applyIssueAction(issue)}
                      >
                        <Wand2 size={16} />
                        {label}
                      </button>
                    )}
                    {issue.ruleId === "spelling" && issue.word ? (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onIgnoreSpellingWord?.(issue.word);
                          setContextMenu(null);
                        }}
                      >
                        <BookPlus size={16} />
                        Add to dictionary: {issue.word}
                      </button>
                    ) : null}
                  </div>
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
      {slashMenu ? (
        <SlashMenuOverlay
          isOpen={Boolean(slashMenu)}
          filterQuery={slashMenu.query || ""}
          position={{ top: slashMenu.y, left: slashMenu.x }}
          onSelectCommand={handleSelectSlashCommand}
          onClose={() => setSlashMenu(null)}
        />
      ) : null}
    </div>
  );
});
