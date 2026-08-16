import { memo, useRef, useState, useEffect, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FileText,
  FilePenLine,
  FileDown,
  PenLine,
  SplitSquareHorizontal,
  Eye,
  Images,
  X,
  ListTree,
  Clipboard,
  Code2,
  Type,
} from "lucide-react";
import AppButton from "./AppButton";
import AppIconButton from "./AppIconButton";
import AppInput from "./AppInput";
import { EditorPane } from "./EditorPane";
import { MediaTab } from "./MediaTab";
import OverlayDialog from "./OverlayDialog";
import DialogSelectField from "./DialogSelectField";

import { downloadPdf, syncTasksFromNote } from "../services/electronService";
import { GitNoteHistoryPanel } from "./GitNoteHistoryPanel";
import { useDocumentEditorActions } from "../hooks/useDocumentEditorActions";
import { useWorkspaceScopedStorage } from "../hooks/useWorkspaceScopedStorage";
import { renderMarkdown } from "../utils/renderUtils";
import { extractTasksFromText, getTaskCountsFromText } from "../utils/taskUtils";
import { getLineStartOffset, resolveTargetLine } from "../utils/markdownUtils";
import { NoteTabBar } from "./NoteTabBar";
import { MetadataPopover } from "./MetadataPopover";
import { TaskDetailModal } from "./TaskDetailModal";
import { DocumentDetailHeader } from "./document/DocumentDetailHeader";

function getBlockRange(value, anchorIndex) {
  const text = String(value || "");
  const safeAnchor = Math.max(0, Math.min(Number(anchorIndex) || 0, text.length));

  let start = safeAnchor;
  while (start > 0) {
    const previousBreak = text.lastIndexOf("\n\n", start - 1);
    if (previousBreak === -1) {
      start = 0;
      break;
    }

    const candidate = text.slice(previousBreak + 2, safeAnchor).trim();
    if (candidate) {
      start = previousBreak + 2;
      break;
    }

    start = previousBreak;
  }

  let end = safeAnchor;
  while (end < text.length) {
    const nextBreak = text.indexOf("\n\n", end);
    if (nextBreak === -1) {
      end = text.length;
      break;
    }

    const candidate = text.slice(safeAnchor, nextBreak).trim();
    if (candidate) {
      end = nextBreak;
      break;
    }

    end = nextBreak + 2;
  }

  return {
    start,
    end,
    text: text.slice(start, end),
  };
}



const AUTOSAVE_DELAY_MS = 1200;
const EDITOR_MODE_OPTIONS = [
  { key: "edit", label: "Edit", icon: PenLine, announceLabel: "Edit" },
  { key: "split", label: "Split", icon: SplitSquareHorizontal, announceLabel: "Split" },
  { key: "preview", label: "Preview", icon: Eye, announceLabel: "Preview" },
];

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tryBuildFindRegex(pattern, caseSensitive) {
  const source = String(pattern || "");
  if (!source) return null;
  try {
    return new RegExp(source, caseSensitive ? "gm" : "gim");
  } catch {
    return null;
  }
}

function isValidFindRegex(pattern) {
  if (!pattern) return true;
  try {
    void new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

function collectMatches(text, query, caseSensitive, useRegex = false) {
  const source = String(text || "");
  const needle = String(query || "");
  if (!needle) return [];

  if (useRegex) {
    const regex = tryBuildFindRegex(needle, caseSensitive);
    if (!regex) return [];

    const output = [];
    let match;
    while ((match = regex.exec(source)) !== null) {
      const matchText = String(match[0] || "");
      if (!matchText.length) {
        regex.lastIndex += 1;
        continue;
      }
      output.push({ start: match.index, end: match.index + matchText.length });
    }
    return output;
  }

  const haystack = caseSensitive ? source : source.toLowerCase();
  const searchNeedle = caseSensitive ? needle : needle.toLowerCase();
  const output = [];
  let fromIndex = 0;

  while (fromIndex <= haystack.length) {
    const at = haystack.indexOf(searchNeedle, fromIndex);
    if (at === -1) break;
    output.push({ start: at, end: at + needle.length });
    fromIndex = at + Math.max(searchNeedle.length, 1);
  }

  return output;
}

function getSelectedMatchIndex(matches, selectionStart, selectionEnd) {
  if (!matches.length) return -1;
  const safeStart = Number.isFinite(selectionStart) ? selectionStart : -1;
  const safeEnd = Number.isFinite(selectionEnd) ? selectionEnd : -1;
  if (safeStart < 0 || safeEnd < safeStart) return -1;

  return matches.findIndex((match) => match.start === safeStart && match.end === safeEnd);
}




const FindReplacePanel = memo(function FindReplacePanel({
  showFindReplace,
  showReplaceControls,
  findQuery,
  setFindQuery,
  replaceValue,
  setReplaceValue,
  findCaseSensitive,
  setFindCaseSensitive,
  findUseRegex,
  setFindUseRegex,
  regexValid,
  onFindPrevious,
  onFindNext,
  onReplace,
  onReplaceAll,
  currentMatchLabel,
  onClose,
}) {
  if (!showFindReplace) return null;
  const panelLabel = showReplaceControls ? "Find and replace" : "Find in note";
  const closeLabel = showReplaceControls ? "Close find and replace" : "Close find";

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose?.();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (event.shiftKey) {
        onFindPrevious?.();
      } else {
        onFindNext?.();
      }
    }
  };

  return (
    <div className="find-replace-panel" role="region" aria-label={panelLabel} onKeyDown={handleKeyDown}>
      <div className="find-input-group">
        <AppInput
          value={findQuery}
          onChange={(event) => setFindQuery(event.target.value)}
          placeholder="Find"
          autoFocus
          aria-label="Find query"
          className={`find-panel-input find-panel-input-query${findUseRegex && !regexValid ? " find-input-error" : ""}`}
        />
        {showReplaceControls ? (
          <AppInput
            value={replaceValue}
            onChange={(event) => setReplaceValue(event.target.value)}
            placeholder="Replace"
            aria-label="Replace with"
            className="find-panel-input find-panel-input-replace"
          />
        ) : null}
      </div>
      <div className="find-toggle-group" aria-label="Find options">
        <button
          type="button"
          className={`find-toggle-button ${findCaseSensitive ? "active" : ""}`}
          onClick={() => setFindCaseSensitive((value) => !value)}
          aria-pressed={findCaseSensitive}
          aria-label="Toggle case sensitive search"
          data-tooltip="Match case"
        >
          <Type size={14} />
          Case
        </button>
        <button
          type="button"
          className={`find-toggle-button ${findUseRegex ? "active" : ""}${findUseRegex && !regexValid ? " error" : ""}`}
          onClick={() => setFindUseRegex((value) => !value)}
          aria-pressed={findUseRegex}
          aria-label="Toggle regular expression search"
          data-tooltip="Use regular expression"
        >
          <Code2 size={14} />
          Regex
        </button>
      </div>
      <AppButton variant="small" className="find-action-button" onClick={onFindPrevious} data-tooltip="Previous match (Shift+Enter)">
        <ChevronLeft size={14} />
        Prev
      </AppButton>
      <AppButton variant="small" className="find-action-button" onClick={onFindNext} data-tooltip="Next match (Enter)">
        <ChevronRight size={14} />
        Next
      </AppButton>
      {showReplaceControls ? (
        <AppButton variant="small" className="find-action-button" onClick={onReplace} data-tooltip="Replace current match">
          <PenLine size={14} />
          Replace
        </AppButton>
      ) : null}
      {showReplaceControls ? (
        <AppButton variant="small" className="find-action-button" onClick={onReplaceAll} data-tooltip="Replace all matches">
          <FilePenLine size={14} />
          Replace All
        </AppButton>
      ) : null}
      {findUseRegex && !regexValid ? <span className="find-error" role="alert">Invalid regex</span> : null}
      <span className="find-count" aria-live="polite" aria-label={`Current match ${currentMatchLabel.replace("/", " of ")}`}>
        {currentMatchLabel}
      </span>
      <AppIconButton className="find-close" onClick={onClose} aria-label={closeLabel}>
        <X size={16} />
      </AppIconButton>
    </div>
  );
});

const OutlinePanel = memo(function OutlinePanel({
  isOutlineEnabled,
  isOutlineCollapsed,
  setIsOutlineCollapsed,
  outlineHeadings,
  onJumpToLine,
  style,
}) {
  if (!isOutlineEnabled) return null;

  return (
    <aside className={`outline-panel ${isOutlineCollapsed ? "collapsed" : ""}`} style={style}>
      {isOutlineCollapsed ? (
        <div className="outline-collapsed-actions">
          <AppButton
            variant="small"
            onClick={() => setIsOutlineCollapsed(false)}
            data-tooltip="Open outline panel"
            aria-expanded="false"
          >
            <ListTree size={16} />
          </AppButton>
        </div>
      ) : (
        <>
          <div className="panel-title-row">
            <h2>Outline</h2>
            <div className="panel-actions">
              <AppButton
                variant="small"
                onClick={() => setIsOutlineCollapsed(true)}
                data-tooltip="Close outline panel"
                aria-expanded="true"
              >
                <ChevronRight size={16} />
              </AppButton>
            </div>
          </div>
          {outlineHeadings.length ? (
            <div className="outline-list">
              {outlineHeadings.map((entry) => (
                <button
                  key={`${entry.line}-${entry.text}`}
                  type="button"
                  className={`outline-item level-${entry.level}`}
                  onClick={() => onJumpToLine(entry.line)}
                  data-tooltip={`Go to line ${entry.line}`}
                >
                  <span>{entry.text}</span>
                  <em>L{entry.line}</em>
                </button>
              ))}
            </div>
          ) : (
            <p className="muted">No headings in this section yet.</p>
          )}
        </>
      )}
    </aside>
  );
});

export function DocumentDetail({
  document,
  _history,
  workspacePath,
  branch,
  activeTab,
  setActiveTab,
  mode,
  setMode,
  onChange,
  onSave,
  onRenameTitle,
  onRefreshHistory,
  saving,
  dirty,
  menuAction,
  onNotify,
  onBack,
  breadcrumbs = [],
  onNavigateBreadcrumb,
  onOpenAIRequest,
  onInlineAIRequest,
  onRegisterAIEditor,
  inlineGhostSuggestion,
  onAcceptInlineGhost,
  onRejectInlineGhost,
  aiEnabled = true,
  aiPanelVisible = true,
  onShowAI,
  onOpenAISettings,
  onOpenDocument,
  initialLine = null,
  workspaceTagSuggestions = [],
  workspaceStorageScope = "default",
  typoCheckEnabled = true,
  screenCaptureMode = "auto",
  showOriginalImages = false,
  inlineLinkedMarkdown = false,
  outlineEnabled = true,
  onOutlineEnabledChange,
  focusModeEnabled = false,
  onFocusModeChange,
  tableEditorEnabled,
  onTableEditorToggle,
  scrollSyncEnabled,
  onScrollSyncEnabledChange,
  aiSidebar = null,
  ignoredSpellingWords = [],
  onIgnoreSpellingWord,
  onForceSaveDocument,
  autosaveEnabled = false,
  setAutosaveEnabled,
  openTabs = [],
  onReorderTabs,
  activeTabPath = null,
  tabStates = {},
  documents = [],
  onSelectTab,
  onCloseTab,
  onNewTab,
  onNewFolder,
  onCloseOthers,
  onCloseToRight,
  onCloseSaved,
  onCloseAll,
  onOpenInEditor,
  onRevealInExplorer,
  onCopyLinkPath,
  onReloadFromDisk,
  onOpenAllTasks,
  onTransferWorkspace,
}) {
  const MAX_EDITOR_HISTORY = 200;
  const textareaRef = useRef(null);
  const taskPopoverTimerRef = useRef(null);
  const historyStateRef = useRef({
    raw: { undo: [], redo: [] },
    cleansed: { undo: [], redo: [] },
  });
  const applyingHistoryRef = useRef(false);
  const [showHistoryPopover, setShowHistoryPopover] = useState(false);
  const [selectedTaskForModal, setSelectedTaskForModal] = useState(null);

  const [pdfExporting, setPdfExporting] = useState(false);
  const [pdfOptionsOpen, setPdfOptionsOpen] = useState(false);
  const [pdfExportMode, setPdfExportMode] = useState("formal");
  const [pdfQualityPreset, setPdfQualityPreset] = useState("full");

  const [, setLastAutoSaveAt] = useState(0);
  const [changedOnDisk, setChangedOnDisk] = useState(false);
  const [outlineWidth, setOutlineWidth] = useWorkspaceScopedStorage({
    workspaceScope: workspaceStorageScope,
    key: "notes:outline-sidebar-width",
    defaultValue: 190,
    normalize: (value) => {
      const parsed = parseInt(value, 10);
      return Number.isNaN(parsed) ? 190 : parsed;
    },
  });

  const [aiSidebarWidth, setAiSidebarWidth] = useWorkspaceScopedStorage({
    workspaceScope: workspaceStorageScope,
    key: "notes:ai-sidebar-width",
    defaultValue: 380,
    normalize: (value) => {
      const parsed = parseInt(value, 10);
      return Number.isNaN(parsed) ? 380 : parsed;
    },
  });

  const [targetLine, setTargetLine] = useState(initialLine);

  useEffect(() => {
    if (initialLine != null) {
      setTargetLine(initialLine);
    }
  }, [initialLine]);

  const workspaceLayoutRef = useRef(null);

  const clampOutlineWidth = (w) => Math.min(Math.max(w, 150), 350);
  const clampAiSidebarWidth = (w) => Math.min(Math.max(w, 260), 600);

  const startOutlineResize = (event) => {
    const workspace = workspaceLayoutRef.current;
    if (!workspace) return;
    event.preventDefault();
    const updateWidth = (clientX) => {
      const bounds = workspace.getBoundingClientRect();
      const nextWidth = bounds.right - clientX - (aiSidebar ? aiSidebarWidth + 8 : 0);
      setOutlineWidth(clampOutlineWidth(nextWidth));
    };
    const handlePointerMove = (moveEvent) => {
      updateWidth(moveEvent.clientX);
    };
    const handlePointerUp = () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    };
    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
  };

  const handleOutlineResizerKeyDown = (event) => {
    const STEP = event.shiftKey ? 20 : 5;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setOutlineWidth((w) => clampOutlineWidth(w + STEP));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setOutlineWidth((w) => clampOutlineWidth(w - STEP));
    } else if (event.key === "Home") {
      event.preventDefault();
      setOutlineWidth(150);
    } else if (event.key === "End") {
      event.preventDefault();
      setOutlineWidth(350);
    }
  };

  const startAiResize = (event) => {
    const workspace = workspaceLayoutRef.current;
    if (!workspace) return;
    event.preventDefault();
    const updateWidth = (clientX) => {
      const bounds = workspace.getBoundingClientRect();
      const nextWidth = bounds.right - clientX;
      setAiSidebarWidth(clampAiSidebarWidth(nextWidth));
    };
    const handlePointerMove = (moveEvent) => {
      updateWidth(moveEvent.clientX);
    };
    const handlePointerUp = () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    };
    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
  };

  const handleAiResizerKeyDown = (event) => {
    const STEP = event.shiftKey ? 20 : 5;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setAiSidebarWidth((w) => clampAiSidebarWidth(w + STEP));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setAiSidebarWidth((w) => clampAiSidebarWidth(w - STEP));
    } else if (event.key === "Home") {
      event.preventDefault();
      setAiSidebarWidth(260);
    } else if (event.key === "End") {
      event.preventDefault();
      setAiSidebarWidth(600);
    }
  };

  useEffect(() => {
    setChangedOnDisk(false);
  }, [document.filePath, document.rawNotes, document.cleansed]);

  useEffect(() => {
    if (typeof window.notesApi?.onDocumentChangedOnDisk !== "function") return undefined;
    const unsubscribe = window.notesApi.onDocumentChangedOnDisk((payload) => {
      if (payload && payload.filePath === document.filePath) {
        setChangedOnDisk(true);
        setAutosaveEnabled(false);
      }
    });
    return () => unsubscribe();
  }, [document.filePath, setAutosaveEnabled]);

  useEffect(() => {
    const currentPath = document.filePath;
    if (typeof window.notesApi?.startWatching === "function") {
      window.notesApi.startWatching(currentPath);
    }
    return () => {
      if (typeof window.notesApi?.stopWatching === "function") {
        window.notesApi.stopWatching(currentPath);
      }
    };
  }, [document.filePath]);

  const handleReloadFromDisk = async () => {
    try {
      if (typeof onReloadFromDisk === "function") {
        await onReloadFromDisk(document.filePath);
      } else if (typeof onOpenDocument === "function") {
        await onOpenDocument(document.filePath, { forceReload: true, preserveActiveTab: true });
      }
      setChangedOnDisk(false);
      onNotify?.("Note reloaded from disk.", "success");
    } catch (err) {
      onNotify?.(err?.message || "Failed to reload document.", "error");
    }
  };
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [showReplaceControls, setShowReplaceControls] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [replaceValue, setReplaceValue] = useState("");
  const [findCaseSensitive, setFindCaseSensitive] = useState(false);
  const [findUseRegex, setFindUseRegex] = useState(false);
  const [findMatchIndex, setFindMatchIndex] = useState(-1);
  const [isOutlineCollapsed, setIsOutlineCollapsed] = useState(false);
  const [showMetadataPanel, setShowMetadataPanel] = useState(false);
  const [showMediaManager, setShowMediaManager] = useState(false);
  const [isTaskSummaryOpen, setIsTaskSummaryOpen] = useState(false);
  const findRegexValid = !findUseRegex || isValidFindRegex(findQuery);
  const content = activeTab === "raw" ? document.rawNotes : document.cleansed;
  const findMatches = useMemo(
    () => collectMatches(content, findQuery, findCaseSensitive, findUseRegex),
    [content, findQuery, findCaseSensitive, findUseRegex],
  );
  const mediaContent = `${document.rawNotes || ""}\n\n${document.cleansed || ""}`.trim();
  const selectedFindMatchIndex = getSelectedMatchIndex(
    findMatches,
    textareaRef.current?.selectionStart,
    textareaRef.current?.selectionEnd,
  );
  const activeFindMatchIndex = selectedFindMatchIndex !== -1
    ? selectedFindMatchIndex
    : (findMatchIndex >= 0 && findMatchIndex < findMatches.length ? findMatchIndex : (findMatches.length ? 0 : -1));
  const currentFindMatchLabel = findMatches.length
    ? `${activeFindMatchIndex + 1}/${findMatches.length}`
    : "0/0";



  const activeEditorField = activeTab === "raw" ? "rawNotes" : "cleansed";
  const activeHistoryKey = activeTab === "raw" ? "raw" : "cleansed";
  const isOutlineEnabled = outlineEnabled !== false;
  const isFocusMode = focusModeEnabled === true;
  const setEditorMode = (nextMode, options = {}) => {
    const { announce = true, force = false } = options;
    if (!force && showMediaManager) {
      if (announce) {
        onNotify?.("Close Assets view to switch editor mode.", "info");
      }
      return false;
    }

    setMode(nextMode);
    if (announce) {
      const activeMode = EDITOR_MODE_OPTIONS.find((item) => item.key === nextMode);
      onNotify?.(`Editor mode: ${activeMode?.announceLabel || nextMode}.`, "info");
    }
    return true;
  };

  const outlineHeadings = useMemo(() => {
    if (showMediaManager) return [];
    const lines = String(content || "").split(/\r?\n/);
    const headings = [];
    lines.forEach((lineText, index) => {
      const match = lineText.match(/^(#{1,6})\s+(.+)$/);
      if (!match) return;
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
        line: index + 1,
      });
    });
    return headings;
  }, [content, showMediaManager]);

  const taskItems = useMemo(() => extractTasksFromText(content), [content]);

  const taskCounts = useMemo(() => getTaskCountsFromText(content), [content]);

  const openTaskItems = useMemo(() => taskItems.filter((task) => task.status === "open"), [taskItems]);
  const closedTaskItems = useMemo(() => taskItems.filter((task) => task.status === "closed"), [taskItems]);
  const taskSummaryPopoverId = useMemo(
    () => `detail-task-popover-${String(document.filePath || document.fileName || "note").toLowerCase().replace(/[^a-z0-9_-]+/g, "-")}`,
    [document.filePath, document.fileName],
  );

  const getCurrentAIContext = () => {
    const editor = textareaRef.current;
    const currentValue = String(content || "");
    const selectionStart = Number(editor?.selectionStart) || 0;
    const selectionEnd = Number(editor?.selectionEnd) || selectionStart;
    const hasSelection = selectionEnd > selectionStart;
    const selectedText = hasSelection
      ? currentValue.slice(selectionStart, selectionEnd)
      : "";
    const anchor = hasSelection ? selectionStart : selectionEnd;
    const currentBlock = getBlockRange(currentValue, anchor);

    return {
      tab: activeTab,
      field: activeEditorField,
      selectionStart,
      selectionEnd,
      hasSelection,
      selectedText,
      currentBlock,
      cursorOffset: selectionEnd,
      contentLength: currentValue.length,
      value: currentValue,
    };
  };

  const applyAIResult = ({ text, mode, previewOnly = false, insertAt = null }) => {
    const editor = textareaRef.current;
    const currentValue = String(content || "");
    const insertion = String(text || "");
    if (!editor || !insertion) {
      return { applied: false, reason: "No editor target available." };
    }

    const selectionStart = Number(editor.selectionStart) || 0;
    const selectionEnd = Number(editor.selectionEnd) || selectionStart;
    const currentBlock = getBlockRange(currentValue, selectionEnd);

    let start = Number.isInteger(insertAt) ? insertAt : selectionEnd;
    let end = Number.isInteger(insertAt) ? insertAt : selectionEnd;

    if (mode === "replace-selection") {
      start = selectionStart;
      end = selectionEnd;
      if (end <= start) {
        return { applied: false, reason: "Select text to replace." };
      }
    } else if (mode === "replace-block") {
      start = currentBlock.start;
      end = currentBlock.end;
      if (end <= start) {
        return { applied: false, reason: "No current block found." };
      }
    }

    if (previewOnly && mode !== "insert") {
      return {
        applied: false,
        preview: true,
        mode,
        currentText: currentValue.slice(start, end),
        nextText: insertion,
        start,
        end,
      };
    }

    const nextValue = `${currentValue.slice(0, start)}${insertion}${currentValue.slice(end)}`;
    updateContent(nextValue);

    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      textareaRef.current.focus();
      const nextCursor = start + insertion.length;
      textareaRef.current.selectionStart = nextCursor;
      textareaRef.current.selectionEnd = nextCursor;
    });

    return { applied: true, mode, start, end };
  };

  useEffect(() => {
    if (typeof onRegisterAIEditor !== "function") return undefined;

    onRegisterAIEditor({
      getContext: getCurrentAIContext,
      applyResult: applyAIResult,
    });

    return () => onRegisterAIEditor(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRegisterAIEditor, content, activeTab, activeEditorField]);

  useEffect(() => {
    historyStateRef.current = {
      raw: { undo: [], redo: [] },
      cleansed: { undo: [], redo: [] },
    };
  }, [document.filePath]);

  const captureEditorSnapshot = () => {
    const editor = textareaRef.current;
    if (!editor) return null;
    return {
      filePath: document.filePath,
      tab: activeTab,
      selectionStart: Number(editor.selectionStart) || 0,
      selectionEnd: Number(editor.selectionEnd) || 0,
      scrollTop: Number(editor.scrollTop) || 0,
    };
  };

  const restoreEditorSnapshot = (snapshot) => {
    if (!snapshot) return;

    let canceled = false;
    const restore = () => {
      if (canceled) return;
      const editor = textareaRef.current;
      if (!editor) return;

      const docLength = String(editor.value || "").length;
      const nextStart = Math.max(0, Math.min(snapshot.selectionStart, docLength));
      const nextEnd = Math.max(0, Math.min(snapshot.selectionEnd, docLength));
      editor.selectionStart = nextStart;
      editor.selectionEnd = nextEnd;
      editor.scrollTop = snapshot.scrollTop;
    };

    requestAnimationFrame(restore);
    const lateRestoreA = window.setTimeout(restore, 80);
    const lateRestoreB = window.setTimeout(restore, 220);
    const lateRestoreC = window.setTimeout(restore, 300);

    return () => {
      canceled = true;
      window.clearTimeout(lateRestoreA);
      window.clearTimeout(lateRestoreB);
      window.clearTimeout(lateRestoreC);
    };
  };

  const savePreservingEditorViewport = async (options) => {
    const snapshot = captureEditorSnapshot();
    try {
      await onSave(options);
      if (document?.filePath) {
        void syncTasksFromNote({ filePath: document.filePath, content: content || "" }).catch(() => {});
      }
    } finally {
      const shouldRestore = snapshot
        && snapshot.filePath === document.filePath
        && snapshot.tab === activeTab;
      if (shouldRestore) {
        restoreEditorSnapshot(snapshot);
      }
    }
  };

  useEffect(() => {
    if (!autosaveEnabled || !dirty || saving || showMediaManager) return undefined;

    const timer = window.setTimeout(async () => {
      await savePreservingEditorViewport({ reason: "autosave", silent: true });
      setLastAutoSaveAt(Date.now());
    }, AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autosaveEnabled, dirty, saving, showMediaManager, onSave, document.filePath, document.header, document.rawNotes, document.cleansed, activeTab]);

  useEffect(() => {
    const total = findMatches.length;
    if (!total) {
      setFindMatchIndex(-1);
    } else if (findMatchIndex >= total) {
      setFindMatchIndex(total - 1);
    }
  }, [findMatches, findMatchIndex]);

  const updateContent = (value) => {
    if (value === content) return;

    if (!applyingHistoryRef.current) {
      const currentHistory = historyStateRef.current[activeHistoryKey];
      currentHistory.undo.push(content);
      if (currentHistory.undo.length > MAX_EDITOR_HISTORY) {
        currentHistory.undo.shift();
      }
      currentHistory.redo = [];
    }

    onChange({
      ...document,
      [activeEditorField]: value,
    });
  };

  const canUndo = !showMediaManager && historyStateRef.current[activeHistoryKey].undo.length > 0;
  const canRedo = !showMediaManager && historyStateRef.current[activeHistoryKey].redo.length > 0;

  const toggleOutlineEnabled = () => {
    if (isFocusMode) {
      onNotify?.("Outline is unavailable while Focus mode is enabled.", "info");
      return;
    }

    onOutlineEnabledChange?.((value) => {
      const nextEnabled = value === false;
      onNotify?.(nextEnabled ? "Outline panel shown." : "Outline panel hidden.", "info");
      return nextEnabled;
    });
  };

  const toggleFocusMode = () => {
    onFocusModeChange?.((value) => {
      return value !== true;
    });
  };

  const jumpToLine = (line, textHint = null) => {
    const editor = textareaRef?.current;
    const activeText = editor?.value ?? content ?? "";
    const safeLine = resolveTargetLine(activeText, line, textHint);

    setTargetLine(safeLine);
    setIsTaskSummaryOpen(false);

    if (mode === "preview") {
      setEditorMode("edit", { announce: false, force: true });
    }

    setTimeout(() => {
      const ed = textareaRef?.current;
      if (ed) {
        ed.focus();
        if (typeof ed.scrollToLine === "function") {
          ed.scrollToLine(safeLine);
        } else {
          const startIndex = typeof ed.getLineStartOffset === "function"
            ? ed.getLineStartOffset(safeLine)
            : getLineStartOffset(ed.value ?? content ?? "", safeLine);

          if (typeof ed.setSelectionRange === "function") {
            ed.setSelectionRange(startIndex, startIndex);
          } else {
            ed.selectionStart = startIndex;
            ed.selectionEnd = startIndex;
          }

          const lineHeight = typeof ed.getLineHeight === "function"
            ? ed.getLineHeight()
            : parseFloat(window.getComputedStyle(ed).lineHeight) || 20;
          const viewportHeight = Number(ed.clientHeight) || lineHeight * 20;
          const targetTop = (safeLine - 1) * lineHeight - viewportHeight * 0.66;
          const maxScroll = Math.max(0, (Number(ed.scrollHeight) || 0) - viewportHeight);
          ed.scrollTop = Math.max(0, Math.min(targetTop, maxScroll));
        }
      }

      const previewEl = window.document.querySelector(".markdown-preview, .preview-container");
      if (previewEl) {
        const targetNode = previewEl.querySelector(`[data-source-line="${safeLine}"]`) ||
          Array.from(previewEl.querySelectorAll("[data-source-line]")).find(el => Number(el.getAttribute("data-source-line")) >= safeLine);
        if (targetNode) {
          targetNode.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }, 15);
  };

  const openFindPanel = ({ showReplace = false } = {}) => {
    if (mode !== "edit" && mode !== "split") {
      setEditorMode("edit", { announce: false, force: true });
    }
    setShowReplaceControls(showReplace);
    setShowFindReplace(true);
    const selectedText = textareaRef.current
      ? textareaRef.current.value.slice(textareaRef.current.selectionStart, textareaRef.current.selectionEnd)
      : "";
    if (selectedText && !selectedText.includes("\n")) {
      setFindQuery(selectedText);
    }
    onNotify?.("Find panel opened.", "info");
  };

  const openFindInNotePanel = () => {
    openFindPanel({ showReplace: false });
  };

  const toggleFindInNotePanel = () => {
    if (showFindReplace) {
      closeFindReplacePanel();
      onNotify?.("Find panel closed.", "info");
      return;
    }

    openFindInNotePanel();
  };

  const openFindReplacePanel = () => {
    openFindPanel({ showReplace: true });
  };

  const closeFindReplacePanel = () => {
    setShowFindReplace(false);
    setFindMatchIndex(-1);
    textareaRef.current?.focus?.();
  };

  const handleManualSave = async () => {
    if (changedOnDisk) return;
    try {
      await savePreservingEditorViewport({ reason: "manual-save", silent: true });
      onNotify?.("Note saved.", "success");
    } catch (error) {
      onNotify?.(error?.message || "Unable to save note.", "error");
    }
  };

  const handleCopyAsHtml = () => {
    const html = renderMarkdown(content || "");
    navigator.clipboard.writeText(html)
      .then(() => onNotify?.("Copied as HTML.", "success"))
      .catch(() => onNotify?.("Unable to copy to clipboard.", "error"));
  };

  const handleCopyAsText = () => {
    navigator.clipboard.writeText(content || "")
      .then(() => onNotify?.("Copied as plain text.", "success"))
      .catch(() => onNotify?.("Unable to copy to clipboard.", "error"));
  };

  const goToMatch = (nextIndex) => {
    const editor = textareaRef.current;
    if (!editor) return;

    if (!findMatches.length) {
      setFindMatchIndex(-1);
      return;
    }

    const safeIndex = ((nextIndex % findMatches.length) + findMatches.length) % findMatches.length;
    const match = findMatches[safeIndex];

    if (mode !== "edit" && mode !== "split") {
      setEditorMode("edit", { announce: false, force: true });
    }

    editor.focus();
    if (typeof editor.setSelectionRange === "function") {
      editor.setSelectionRange(match.start, match.end);
    } else {
      editor.selectionStart = match.start;
      editor.selectionEnd = match.end;
    }
    editor.scrollTop = Math.max(0, editor.scrollTop - 1);
    setFindMatchIndex(safeIndex);
  };

  const handleFindNext = () => {
    const editor = textareaRef.current;
    if (!editor || !findMatches.length) return;

    const cursor = editor.selectionEnd;
    const next = findMatches.findIndex((entry) => entry.start > cursor);
    goToMatch(next === -1 ? 0 : next);
  };

  const handleFindPrevious = () => {
    const editor = textareaRef.current;
    if (!editor || !findMatches.length) return;

    const cursor = editor.selectionStart;
    let previous = -1;
    for (let index = 0; index < findMatches.length; index += 1) {
      if (findMatches[index].start < cursor) previous = index;
      else break;
    }
    goToMatch(previous === -1 ? findMatches.length - 1 : previous);
  };

  const replaceCurrentMatch = () => {
    if (!findQuery) return;
    const editor = textareaRef.current;
    if (!editor) return;

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selectedMatchIndex = getSelectedMatchIndex(findMatches, start, end);
    const targetIndex = selectedMatchIndex !== -1 ? selectedMatchIndex : activeFindMatchIndex;
    if (targetIndex === -1) {
      return;
    }

    const targetMatch = findMatches[targetIndex];
    const nextValue = `${content.slice(0, targetMatch.start)}${replaceValue}${content.slice(targetMatch.end)}`;
    const nextCursor = targetMatch.start + replaceValue.length;
    updateContent(nextValue);

    requestAnimationFrame(() => {
      const nextEditor = textareaRef.current;
      if (!nextEditor) return;

      const nextRegexMatches = collectMatches(nextValue, findQuery, findCaseSensitive, findUseRegex);
      if (!nextRegexMatches.length) {
        nextEditor.focus();
        if (typeof nextEditor.setSelectionRange === "function") {
          nextEditor.setSelectionRange(nextCursor, nextCursor);
        } else {
          nextEditor.selectionStart = nextCursor;
          nextEditor.selectionEnd = nextCursor;
        }
        setFindMatchIndex(-1);
        return;
      }

      const nextIndex = nextRegexMatches.findIndex((entry) => entry.start >= nextCursor);
      const safeIndex = nextIndex === -1 ? 0 : nextIndex;
      const nextMatch = nextRegexMatches[safeIndex];

      nextEditor.focus();
      if (typeof nextEditor.setSelectionRange === "function") {
        nextEditor.setSelectionRange(nextMatch.start, nextMatch.end);
      } else {
        nextEditor.selectionStart = nextMatch.start;
        nextEditor.selectionEnd = nextMatch.end;
      }
      setFindMatchIndex(safeIndex);
    });
  };

  const replaceAllMatches = () => {
    if (!findQuery) return;
    if (!findMatches.length) return;

    let nextValue = "";
    if (findUseRegex) {
      const regex = tryBuildFindRegex(findQuery, findCaseSensitive);
      if (!regex) {
        onNotify?.("Invalid regular expression.", "error");
        return;
      }
      nextValue = content.replace(regex, replaceValue);
    } else {
      nextValue = findCaseSensitive
        ? content.split(findQuery).join(replaceValue)
        : content.replace(new RegExp(escapeRegExp(findQuery), "gi"), replaceValue);
    }

    updateContent(nextValue);
    onNotify?.(`Replaced ${findMatches.length} match${findMatches.length > 1 ? "es" : ""}.`, "success");
  };



  const handleUndo = () => {
    if (showMediaManager) return false;
    const currentHistory = historyStateRef.current[activeHistoryKey];
    if (!currentHistory.undo.length) return false;

    const previousValue = currentHistory.undo.pop();
    currentHistory.redo.push(content);

    applyingHistoryRef.current = true;
    onChange({
      ...document,
      [activeEditorField]: previousValue,
    });
    applyingHistoryRef.current = false;
    return true;
  };

  const handleRedo = () => {
    if (showMediaManager) return false;
    const currentHistory = historyStateRef.current[activeHistoryKey];
    if (!currentHistory.redo.length) return false;

    const nextValue = currentHistory.redo.pop();
    currentHistory.undo.push(content);

    applyingHistoryRef.current = true;
    onChange({
      ...document,
      [activeEditorField]: nextValue,
    });
    applyingHistoryRef.current = false;
    return true;
  };

  useDocumentEditorActions({
    menuAction,
    isFocusMode,
    showMediaManager,
    textareaRef,
    setFindQuery,
    toggleFindInNotePanel,
    openFindInNotePanel,
    openFindReplacePanel,
    toggleOutlineEnabled,
    toggleSplitPreview: () => {
      if (!showMediaManager) {
        setMode((value) => (value === "split" ? "edit" : "split"));
        onNotify?.("Split preview toggled.", "info");
      }
    },
    toggleFocusMode,
    openPdfOptions: () => {
      setPdfExportMode("formal");
      setPdfQualityPreset("full");
      setPdfOptionsOpen(true);
    },
    openHistoryVersions: () => setShowHistoryPopover(true),
    setEditorMode,
    handleManualSave,
    handleUndo,
    handleRedo,
    onNotify,
  });

  const handleConfirmPdfExport = async () => {
    const includeRawNotes = pdfExportMode === "raw" || pdfExportMode === "both";
    const includeCleansed = pdfExportMode === "formal" || pdfExportMode === "both";

    setPdfExporting(true);

    try {
      const result = await downloadPdf({
        filePath: document.filePath,
        title: document.title,
        rawNotes: document.rawNotes,
        cleansed: document.cleansed,
        includeRawNotes,
        includeCleansed,
        pdfQualityPreset,
      });
      if (!result?.canceled) {
        onNotify?.("PDF downloaded.", "success");
        setPdfOptionsOpen(false);
      }
    } catch (error) {
      onNotify?.(error?.message || "Unable to download PDF.", "error");
    } finally {
      setPdfExporting(false);
    }
  };



  const hasOutline = isOutlineEnabled && !isOutlineCollapsed;
  const hasAi = !!aiSidebar;

  let gridColumnsStyle = "minmax(0, 1fr)";
  if (hasOutline && hasAi) {
    gridColumnsStyle = `minmax(0, 1fr) 8px ${outlineWidth}px 8px ${aiSidebarWidth}px`;
  } else if (hasOutline) {
    gridColumnsStyle = `minmax(0, 1fr) 8px ${outlineWidth}px`;
  } else if (isOutlineEnabled && isOutlineCollapsed && hasAi) {
    gridColumnsStyle = `minmax(0, 1fr) 28px 8px ${aiSidebarWidth}px`;
  } else if (isOutlineEnabled && isOutlineCollapsed) {
    gridColumnsStyle = `minmax(0, 1fr) 28px`;
  } else if (hasAi) {
    gridColumnsStyle = `minmax(0, 1fr) 8px ${aiSidebarWidth}px`;
  }
  const workspaceStyle = isFocusMode ? {} : { gridTemplateColumns: gridColumnsStyle, gap: 0 };

  return (
    <div className="detail-shell">
      {!isFocusMode && (
        <NoteTabBar
          openTabs={openTabs}
          onReorderTabs={onReorderTabs}
          activeTabPath={activeTabPath}
          tabStates={tabStates}
          documents={documents}
          onSelectTab={onSelectTab}
          onCloseTab={onCloseTab}
          onNewTab={onNewTab}
          onNewFolder={onNewFolder}
          onCloseOthers={onCloseOthers}
          onCloseToRight={onCloseToRight}
          onCloseSaved={onCloseSaved}
          onCloseAll={onCloseAll}
          onOpenInEditor={onOpenInEditor}
          onRevealInExplorer={onRevealInExplorer}
          onCopyLinkPath={onCopyLinkPath}
          onReloadFromDisk={onReloadFromDisk}
        />
      )}
      <DocumentDetailHeader
        isFocusMode={isFocusMode}
        breadcrumbs={breadcrumbs}
        onNavigateBreadcrumb={onNavigateBreadcrumb}
        onBack={onBack}
        document={document}
        taskCounts={taskCounts}
        isTaskSummaryOpen={isTaskSummaryOpen}
        setIsTaskSummaryOpen={setIsTaskSummaryOpen}
        taskPopoverTimerRef={taskPopoverTimerRef}
        taskSummaryPopoverId={taskSummaryPopoverId}
        openTaskItems={openTaskItems}
        closedTaskItems={closedTaskItems}
        jumpToLine={jumpToLine}
        onOpenAllTasks={onOpenAllTasks}
        dirty={dirty}
        saving={saving}
        changedOnDisk={changedOnDisk}
        handleManualSave={handleManualSave}
        showMetadataPanel={showMetadataPanel}
        setShowMetadataPanel={setShowMetadataPanel}
        aiPanelVisible={aiPanelVisible}
        aiEnabled={aiEnabled}
        onShowAI={onShowAI}
        toggleFocusMode={toggleFocusMode}
        onTransferWorkspace={onTransferWorkspace}
      />

      {isFocusMode && (
        <div className="mode-contract-banner" role="status" aria-live="polite">
          <span>Focus mode is active</span>
          <AppButton
            variant="small"
            data-tooltip="Exit focus mode"
            className="mode-contract-exit"
            onClick={() => onFocusModeChange?.(false)}
          >
            Exit
          </AppButton>
        </div>
      )}

      <MetadataPopover
        document={document}
        isOpen={showMetadataPanel && !isFocusMode}
        onClose={() => setShowMetadataPanel(false)}
        onChange={onChange}
        onSaveDocument={handleManualSave}
        onRenameTitle={onRenameTitle}
        workspaceTagSuggestions={workspaceTagSuggestions}
      />

      {changedOnDisk && (
        <div className="disk-change-banner" role="alert" style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          padding: "10px 14px",
          margin: "0 18px 12px",
          borderRadius: "8px",
          border: "1px solid #9b2f2f",
          backgroundColor: "#fff1f0",
          color: "#7d2020",
          fontSize: "13.5px",
          fontWeight: "550",
          boxShadow: "0 2px 8px rgba(155, 47, 47, 0.12)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "16px" }}>⚠️</span>
            <span>Content has been changed on disk by another tool. Autosave is disabled.</span>
          </div>
          <AppButton variant="primary" size="small" onClick={handleReloadFromDisk}>
            Reload content from disk
          </AppButton>
        </div>
      )}

      <div 
        ref={workspaceLayoutRef}
        style={workspaceStyle}
        className={`workspace ${changedOnDisk ? "workspace-disabled" : ""} ${isOutlineEnabled ? "" : "outline-panel-disabled"} ${isOutlineCollapsed ? "outline-panel-collapsed" : ""} ${aiSidebar ? "with-ai-chat" : ""}`}
        onKeyDown={(e) => {
          if (changedOnDisk) {
            // Let Ctrl+Shift+R pass through, block all other shortcuts/keys
            const isReload = (e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "r";
            if (!isReload) {
              e.preventDefault();
              e.stopPropagation();
            }
          }
        }}
      >
        <main className="editor-panel">
          {!isFocusMode && (
          <div className="tab-row">
            <div className="mode-switch">
              <div className="copy-menu" role="group" aria-label="Copy options">
                <button
                  type="button"
                  className="copy-menu-trigger"
                  data-tooltip="Copy note content"
                  disabled={showMediaManager}
                >
                  <Clipboard size={16} />
                  <span>Copy</span>
                  <ChevronDown size={14} />
                </button>
                <div className="copy-menu-panel" role="menu" aria-label="Copy actions">
                  <button
                    type="button"
                    role="menuitem"
                    data-tooltip="Copy note content as rendered HTML"
                    onClick={handleCopyAsHtml}
                    disabled={showMediaManager}
                  >
                    <Code2 size={16} />
                    <span>Copy HTML</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    data-tooltip="Copy note content as plain text (markdown source)"
                    onClick={handleCopyAsText}
                    disabled={showMediaManager}
                  >
                    <Clipboard size={16} />
                    <span>Copy Text</span>
                  </button>
                </div>
              </div>
              <div className="button-group-separator" />
              <div className="button-group">
                <button
                  className={activeTab === "raw" ? "active" : ""}
                  onClick={() => {
                    setShowMediaManager(false);
                    setActiveTab("raw");
                  }}
                  data-tooltip="Quick notes"
                >
                  <FilePenLine size={16} />
                  <span>Quick Notes</span>
                </button>
                <button
                  className={activeTab === "cleansed" ? "active" : ""}
                  onClick={() => {
                    setShowMediaManager(false);
                    setActiveTab("cleansed");
                  }}
                  data-tooltip="Formal notes"
                >
                  <FileText size={16} />
                  <span>Formal Notes</span>
                </button>
              </div>
              <div className="button-group-separator" />
              <button
                className={showMediaManager ? "active" : ""}
                type="button"
                data-tooltip="Open assets manager"
                onClick={() => setShowMediaManager((value) => !value)}
              >
                <Images size={16} />
                <span>Assets</span>
              </button>
              <div className="button-group mode-switch-modes">
                {EDITOR_MODE_OPTIONS.map((item) => (
                  <button
                    className={mode === item.key ? "active" : ""}
                    key={item.key}
                    disabled={showMediaManager}
                    onClick={() => setEditorMode(item.key, { announce: false })}
                    data-tooltip={showMediaManager ? "Close Assets view to switch mode" : `Switch to ${item.label} mode`}
                  >
                    <item.icon size={16} />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          )}

          <FindReplacePanel
            showFindReplace={showFindReplace}
            showReplaceControls={showReplaceControls}
            findQuery={findQuery}
            setFindQuery={setFindQuery}
            replaceValue={replaceValue}
            setReplaceValue={setReplaceValue}
            findCaseSensitive={findCaseSensitive}
            setFindCaseSensitive={setFindCaseSensitive}
            findUseRegex={findUseRegex}
            setFindUseRegex={setFindUseRegex}
            regexValid={findRegexValid}
            onFindPrevious={handleFindPrevious}
            onFindNext={handleFindNext}
            onReplace={replaceCurrentMatch}
            onReplaceAll={replaceAllMatches}
            currentMatchLabel={currentFindMatchLabel}
            onClose={closeFindReplacePanel}
          />

          <EditorPane
            value={content}
            onChange={updateContent}
            mode={mode}
            textareaRef={textareaRef}
            basePath={document.filePath}
            typoCheckEnabled={typoCheckEnabled}
            screenCaptureMode={screenCaptureMode}
            showToolbar={!showMediaManager}
            onNotify={onNotify}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={canUndo}
            canRedo={canRedo}
            onOpenFind={openFindInNotePanel}
            onToggleFind={toggleFindInNotePanel}
            aiEnabled={aiEnabled}
            onOpenAIRequest={onOpenAIRequest}
            onOpenAISettings={onOpenAISettings}
            onInlineAIContinue={() => {
              onInlineAIRequest?.({
                initialQuery: "Continue the current paragraph naturally in the same tone and structure.",
                target: "block",
                source: "inline-continue",
              });
            }}
            ghostSuggestion={inlineGhostSuggestion}
            onAcceptInlineGhost={onAcceptInlineGhost}
            onRejectInlineGhost={onRejectInlineGhost}
            findMatches={findMatches}
            activeFindMatchIndex={activeFindMatchIndex}
            showOriginalImages={showOriginalImages}
            inlineLinkedMarkdown={inlineLinkedMarkdown}
            ignoredSpellingWords={ignoredSpellingWords}
            onIgnoreSpellingWord={onIgnoreSpellingWord}
            onForceSaveDocument={onForceSaveDocument}
            initialLine={targetLine ?? initialLine}
            onLineJumped={() => setTargetLine(null)}
            outlineEnabled={outlineEnabled}
            onOutlineEnabledChange={onOutlineEnabledChange}
            tableEditorEnabled={tableEditorEnabled}
            onTableEditorToggle={onTableEditorToggle}
            scrollSyncEnabled={scrollSyncEnabled}
            onScrollSyncEnabledChange={onScrollSyncEnabledChange}
            onOpenTaskDetails={(taskInfo) => setSelectedTaskForModal({ ...taskInfo, noteContent: content })}
          />
        </main>

        {hasOutline && (
          <div
            className="split-resizer"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize outline panel"
            aria-valuemin={150}
            aria-valuemax={350}
            aria-valuenow={outlineWidth}
            aria-valuetext={`${outlineWidth}px outline width`}
            tabIndex={0}
            onPointerDown={startOutlineResize}
            onKeyDown={handleOutlineResizerKeyDown}
          />
        )}
        <OutlinePanel
          isOutlineEnabled={isOutlineEnabled}
          isOutlineCollapsed={isOutlineCollapsed}
          setIsOutlineCollapsed={setIsOutlineCollapsed}
          outlineHeadings={outlineHeadings}
          onJumpToLine={jumpToLine}
          style={hasOutline ? { width: `${outlineWidth}px` } : {}}
        />
        {hasAi && (
          <div
            className="split-resizer"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize AI sidebar"
            aria-valuemin={260}
            aria-valuemax={600}
            aria-valuenow={aiSidebarWidth}
            aria-valuetext={`${aiSidebarWidth}px AI width`}
            tabIndex={0}
            onPointerDown={startAiResize}
            onKeyDown={handleAiResizerKeyDown}
          />
        )}
        {aiSidebar && (
          <div style={{ width: `${aiSidebarWidth}px`, flexShrink: 0, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {aiSidebar}
          </div>
        )}

      </div>


      {showHistoryPopover ? (
        <GitNoteHistoryPanel
          open={showHistoryPopover}
          onClose={() => setShowHistoryPopover(false)}
          filePath={document?.filePath}
          workspacePath={workspacePath}
          branch={branch}
          onNotify={onNotify}
          onRestored={async () => {
            // Trigger refresh/re-read of the note from disk
            if (typeof onRefreshHistory === "function") {
              await onRefreshHistory();
            }
          }}
        />
      ) : null}

      {showMediaManager ? (
        <OverlayDialog
          onClose={() => setShowMediaManager(false)}
          ariaLabel="Assets"
          cardClassName="assets-dialog-card"
        >
            <div className="overlay-dialog-header assets-dialog-header">
              <div className="assets-dialog-title-group">
                <h2>Assets Library</h2>
                <p>Manage images referenced across your notes.</p>
              </div>
              <AppIconButton
                className="assets-close-button"
                onClick={() => setShowMediaManager(false)}
                aria-label="Close assets dialog"
              >
                <X size={16} />
              </AppIconButton>
            </div>
            <div className="assets-dialog-body">
              <MediaTab
                content={mediaContent}
                basePath={document.filePath}
                onNotify={onNotify}
                onOpenDocument={async (filePath) => {
                  setShowMediaManager(false);
                  await onOpenDocument?.(filePath);
                }}
              />
            </div>
        </OverlayDialog>
      ) : null}

      {pdfOptionsOpen ? (
        <OverlayDialog
          onClose={() => setPdfOptionsOpen(false)}
          ariaLabel="Export PDF"
        >
            <div className="overlay-dialog-header">
              <h2>Export PDF</h2>
              <AppIconButton onClick={() => setPdfOptionsOpen(false)} aria-label="Close export options">
                <X size={16} />
              </AppIconButton>
            </div>
            <DialogSelectField
              id="pdf-export-content-mode"
              label="Content"
              value={pdfExportMode}
              onChange={(event) => setPdfExportMode(event.target.value)}
            >
                <option value="formal">Formal Notes</option>
                <option value="raw">Raw Notes</option>
                <option value="both">Both Raw and Formal</option>
            </DialogSelectField>
            <DialogSelectField
              id="pdf-export-quality"
              label="Quality"
              value={pdfQualityPreset}
              onChange={(event) => setPdfQualityPreset(event.target.value)}
            >
                <option value="full">Full quality</option>
                <option value="balanced">Balanced size</option>
                <option value="compact">Compact file</option>
            </DialogSelectField>
            <div className="overlay-dialog-actions">
              <AppButton
                variant="primary"
                onClick={handleConfirmPdfExport}
                disabled={pdfExporting}
              >
                <FileDown size={14} />
                {pdfExporting ? "Exporting..." : "Export"}
              </AppButton>
            </div>
        </OverlayDialog>
      ) : null}

      <TaskDetailModal
        open={Boolean(selectedTaskForModal)}
        onClose={() => setSelectedTaskForModal(null)}
        taskInfo={selectedTaskForModal}
        onOpenNote={(targetPath) => {
          setSelectedTaskForModal(null);
          onOpenDocument?.(targetPath);
        }}
        onNotify={onNotify}
        onTaskUpdated={async (updatedTask) => {
          // 1. Save active note buffer first if dirty so no unsaved text edits are lost
          if (dirty) {
            try {
              await savePreservingEditorViewport({ reason: "pre-task-update-save", silent: true });
            } catch (saveErr) {
              console.warn("[DocumentDetail] Pre-task-update save warning:", saveErr);
            }
          }

          // 2. Clear disk warning flag and reload updated note content from disk without prompt
          setChangedOnDisk(false);
          const targetPath = updatedTask?.source_path || updatedTask?.sourcePath || document.filePath;
          if (targetPath && targetPath === document.filePath) {
            try {
              if (typeof onOpenDocument === "function") {
                await onOpenDocument(targetPath, { forceReload: true, preserveActiveTab: true });
              } else if (typeof onReloadFromDisk === "function") {
                await onReloadFromDisk(targetPath);
              }
            } catch { /* ignore reload error */ }
          }
        }}
      />

    </div>
  );
}
