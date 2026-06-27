import { lazy, Suspense, useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { ArrowUp, FolderOpen, FolderPlus, Image as ImageIcon, LayoutGrid, NotebookPen, Rows3, Terminal, X } from "lucide-react";
import { DocumentList } from "./components/DocumentList";
import { DocumentDetail } from "./components/DocumentDetail";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { P2PStatusPanel } from "./components/P2PStatusPanel";
import { WorkspaceActivityPanel } from "./components/WorkspaceActivityPanel";
import { ConflictResolutionPanel } from "./components/ConflictResolutionPanel";

// Heavy / rarely-used surfaces are code-split so they don't bloat startup.
const EmbeddedTerminal = lazy(() =>
  import("./components/EmbeddedTerminal").then((m) => ({ default: m.EmbeddedTerminal }))
);
const MediaTab = lazy(() =>
  import("./components/MediaTab").then((m) => ({ default: m.MediaTab }))
);
const AIChatPanel = lazy(() => import("./components/AIChatPanel"));
const AISettings = lazy(() => import("./components/AISettings"));
import {
  aiGetApiKey,
  aiQuery,
  aiBuildGraph,
  aiClearData,
  aiDetectPatterns,
  aiGenerateEmbeddings,
  createFolder,
  createDocument,
  deleteDocument as deleteDocumentApi,
  getNotesRootSetting,
  listProjects,
  listDocuments,
  onMenuAction,
  pickFolder,
  openInEditor,
  openWebView,
  readDocument,
  renameDocument as renameDocumentApi,
  saveDocument as saveDocumentApi,
  setNotesRootSetting,
  getHistory,
  updateMenuContext,
} from "./services/electronService";
import {
  buildAIContextSummary,
  extractEditableAIText,
  normalizePaletteIntent,
  resolveAITarget,
} from "./utils/aiContext";
import { useToast } from "./hooks/useToast";
import { useP2PSync } from "./hooks/useP2PSync";

mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict",
  theme: "base",
  themeVariables: {
    primaryColor: "#f4f1ea",
    primaryBorderColor: "#2f5d62",
    primaryTextColor: "#172326",
    lineColor: "#506b70",
    secondaryColor: "#dce8e3",
    tertiaryColor: "#ffffff",
  },
});

export default function App() {
  const initialViewMode = (() => {
    try {
      const stored = window.localStorage.getItem("notes:view-mode");
      return stored === "table" ? "table" : "tile";
    } catch {
      return "tile";
    }
  })();

  const initialEditorMode = (() => {
    try {
      const stored = window.localStorage.getItem("notes:editor-mode");
      return ["edit", "split", "preview"].includes(stored) ? stored : "edit";
    } catch {
      return "edit";
    }
  })();

  const [documents, setDocuments] = useState([]);
  const [current, setCurrent] = useState(null);
  const [savedHash, setSavedHash] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("raw");
  const [mode, setMode] = useState(initialEditorMode);
  const [error, setError] = useState("");
  const { toasts, notify } = useToast();
  const [_projects, setProjects] = useState([]);
  const [activeProject, setActiveProjectState] = useState(null);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [creatingNote, setCreatingNote] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [notesViewMode, setNotesViewMode] = useState(initialViewMode);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [notesFolderDialogOpen, setNotesFolderDialogOpen] = useState(false);
  const [notesFolderPath, setNotesFolderPath] = useState("");
  const [savingNotesFolder, setSavingNotesFolder] = useState(false);
  const [documentMenuAction, setDocumentMenuAction] = useState(null);
  const [showTerminal, setShowTerminal] = useState(false);
  const [landingFolderPath, setLandingFolderPath] = useState("");
  const [landingAssetsOpen, setLandingAssetsOpen] = useState(false);

  const dirty =
    current
      ? savedHash !==
        JSON.stringify({
          header: current.header,
          rawNotes: current.rawNotes,
          cleansed: current.cleansed,
        })
      : false;

  const syncStateRef = useRef({ current: null, dirty: false, openDocument: null });
  syncStateRef.current = { doc: current, dirty, openDocument };
  const {
    p2pStatusOpen,
    setP2PStatusOpen,
    p2pStatusLoading,
    p2pStatus,
    fullSyncProgressByPeer,
    handleOpenP2PStatus,
    handleStartP2PDiscovery,
    handleStopP2PDiscovery,
    handleSetP2PDeviceName,
    handleSetP2PKeyPolicyDays,
    handleCreateP2PInvite,
    handlePairP2PWithCode,
    handleManualP2PConnect,
    handleRemoveTrustedP2PPeer,
    handleRotateP2PWorkspaceKeys,
    workspaceActivityOpen,
    setWorkspaceActivityOpen,
    workspaceActivityLoading,
    workspaceActivity,
    handleOpenWorkspaceActivity,
    p2pSyncHelpOpen,
    setP2PSyncHelpOpen,
    syncSelfTestOpen,
    setSyncSelfTestOpen,
    syncSelfTestLoading,
    syncSelfTestResult,
    handleRunP2PSyncSelfTest,
    conflictCenterOpen,
    setConflictCenterOpen,
    conflictCenterLoading,
    conflictCenterData,
    conflictResolutionOpen,
    setConflictResolutionOpen,
    conflictResolutionEntry,
    conflictResolutionFiles,
    conflictResolutionLoading,
    handleOpenConflictCenter,
    handleOpenConflictFile,
    handleOpenConflictResolution,
    handleResolveConflict,
    handleOpenNextConflict,
  } = useP2PSync({ notify, setError, loadDocumentsData, syncStateRef });
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [_aiLoading, setAiLoading] = useState(false);
  const [aiQueryLoading, setAiQueryLoading] = useState(false);
  const [aiQueryError, setAiQueryError] = useState("");
  const [aiContextSummary, setAiContextSummary] = useState({
    label: "Open a note to use AI.",
    hasSelection: false,
    hasCurrentBlock: false,
  });
  const [aiPaletteIntent, setAiPaletteIntent] = useState(() => normalizePaletteIntent());
  const [aiChatMessages, setAiChatMessages] = useState([]);
  const [isAIConfigured, setIsAIConfigured] = useState(false);
  const [aiPanelVisible, setAiPanelVisible] = useState(() => {
    try {
      const stored = window.localStorage.getItem("notely:ai-panel-visible");
      return stored !== "false";
    } catch {
      return true;
    }
  });
  const [inlineGhostSuggestion, setInlineGhostSuggestion] = useState(null);
  const aiEditorRef = useRef(null);
  const loadDocumentsRequestRef = useRef(0);

  const terminalCwd = current?.filePath
    ? current.filePath.replace(/[\\/][^\\/]+$/, "")
    : (landingFolderPath || activeProject?.rootPath || notesFolderPath);

  const normalizedProjectRoot = String(activeProject?.rootPath || "")
    .replace(/[\\/]+$/, "")
    .toLowerCase();
  const normalizedLandingFolder = String(landingFolderPath || activeProject?.rootPath || "")
    .replace(/[\\/]+$/, "")
    .toLowerCase();
  const canNavigateUp = Boolean(
    normalizedProjectRoot &&
    normalizedLandingFolder &&
    normalizedLandingFolder !== normalizedProjectRoot
  );

  async function refreshAIConfiguration() {
    try {
      const providers = ["gemini", "openai", "local"];
      const checks = await Promise.all(
        providers.map(async (provider) => {
          try {
            const result = await aiGetApiKey(provider);
            return Boolean(result?.success && result?.data?.apiKey);
          } catch {
            return false;
          }
        })
      );
      setIsAIConfigured(checks.some(Boolean));
    } catch {
      setIsAIConfigured(false);
    }
  }

  function applyProjectState(result) {
    setProjects(result?.projects || []);
    setActiveProjectState(result?.activeProject || null);
  }

  async function loadDocumentsData() {
    const requestId = ++loadDocumentsRequestRef.current;
    setLoading(true);
    setError("");
    try {
      const projectState = await listProjects();
      if (loadDocumentsRequestRef.current !== requestId) return;
      applyProjectState(projectState);
      const baseFolder = projectState?.activeProject?.rootPath || "";
      setLandingFolderPath(baseFolder);
      const docs = await listDocuments(baseFolder);
      if (loadDocumentsRequestRef.current !== requestId) return;
      setDocuments(docs);
      const notesSetting = await getNotesRootSetting();
      if (loadDocumentsRequestRef.current !== requestId) return;
      setNotesFolderPath(notesSetting?.notesRoot || "");
    } catch (err) {
      if (loadDocumentsRequestRef.current !== requestId) return;
      setError(err?.message || "Unable to load documents.");
    } finally {
      if (loadDocumentsRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  }

  async function openDocument(filePath, options = {}) {
    setError("");
    setDocumentMenuAction(null);
    const doc = await readDocument(filePath);
    setCurrent(doc);
    setSavedHash(
      JSON.stringify({
        header: doc.header,
        rawNotes: doc.rawNotes,
        cleansed: doc.cleansed,
      })
    );
    if (!options.preserveActiveTab) {
      setActiveTab("raw");
    }
    setHistory(await getHistory(filePath));
  }

  async function handleReloadCurrentFromDisk() {
    if (!current?.filePath) return;

    if (dirty) {
      const confirmed = window.confirm(
        "Reload this note from disk and discard unsaved changes?"
      );
      if (!confirmed) return;
    }

    try {
      await openDocument(current.filePath, { preserveActiveTab: true });
      notify("Reloaded latest file from disk.", "success");
    } catch (err) {
      setError(err?.message || "Unable to reload document.");
      notify(err?.message || "Unable to reload document.", "error");
    }
  }

  async function handleRenameCurrentDocument(title) {
    if (!current?.filePath) return false;

    const nextTitle = String(title || "").trim();
    if (!nextTitle) {
      notify("Enter a note title first.", "warning");
      return false;
    }

    try {
      if (dirty) {
        await saveDocument({ reason: "rename-save", silent: true });
      }

      const renamed = await renameDocumentApi(current.filePath, nextTitle);
      setCurrent(renamed);
      setSavedHash(
        JSON.stringify({
          header: renamed.header,
          rawNotes: renamed.rawNotes,
          cleansed: renamed.cleansed,
        })
      );
      setHistory(await getHistory(renamed.filePath));
      await loadDocumentsData();
      notify("Note renamed.", "success");
      return true;
    } catch (err) {
      setError(err?.message || "Unable to rename note.");
      notify(err?.message || "Unable to rename note.", "error");
      return false;
    }
  }

  async function handleDeleteCurrentDocument() {
    if (!current?.filePath) return false;

    const confirmed = window.confirm(
      dirty
        ? `Move "${current.title}" to the removed folder and discard unsaved changes?`
        : `Move "${current.title}" to the removed folder?`
    );
    if (!confirmed) return false;

    try {
      await deleteDocumentApi(current.filePath);
      setCurrent(null);
      setHistory([]);
      await loadDocumentsData();
      notify("Note moved to removed folder.", "success");
      return true;
    } catch (err) {
      setError(err?.message || "Unable to delete note.");
      notify(err?.message || "Unable to delete note.", "error");
      return false;
    }
  }

  async function saveDocument(options = {}) {
    if (!current) return;
    const reason = options?.reason || "manual-save";
    const silent = Boolean(options?.silent);
    setSaving(true);
    setError("");

    try {
      const saved = await saveDocumentApi({
        filePath: current.filePath,
        header: current.header,
        rawNotes: current.rawNotes,
        cleansed: current.cleansed,
        reason,
      });
      setCurrent(saved);
      setSavedHash(
        JSON.stringify({
          header: saved.header,
          rawNotes: saved.rawNotes,
          cleansed: saved.cleansed,
        })
      );
      setHistory(await getHistory(saved.filePath));
      await loadDocumentsData();
      if (!silent) {
        notify("Document saved.", "success");
      }
    } catch (err) {
      setError(err?.message || "Unable to save document.");
      if (!silent) {
        notify(err?.message || "Unable to save document.", "error");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateNote() {
    const title = newNoteTitle.trim();
    if (!title) {
      notify("Enter a note title first.", "warning");
      return;
    }

    if (current && dirty) {
      const confirmed = window.confirm("You have unsaved changes. Create and open a new note anyway?");
      if (!confirmed) return;
    }

    setCreatingNote(true);
    setError("");
    try {
      const created = await createDocument(title, landingFolderPath || activeProject?.rootPath);
      setNewNoteTitle("");
      setDocuments(await listDocuments(landingFolderPath || activeProject?.rootPath));
      setCurrent(created);
      setSavedHash(
        JSON.stringify({
          header: created.header,
          rawNotes: created.rawNotes,
          cleansed: created.cleansed,
        })
      );
      setActiveTab("raw");
      setHistory([]);
      setNoteDialogOpen(false);
      notify("Note created.", "success");
    } catch (err) {
      setError(err?.message || "Unable to create note.");
      notify(err?.message || "Unable to create note.", "error");
    } finally {
      setCreatingNote(false);
    }
  }

  async function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name) {
      notify("Enter a folder name first.", "warning");
      return;
    }

    setCreatingFolder(true);
    setError("");
    try {
      await createFolder(name, landingFolderPath || activeProject?.rootPath);
      setNewFolderName("");
      setFolderDialogOpen(false);
      setDocuments(await listDocuments(landingFolderPath || activeProject?.rootPath));
      notify("Folder created.", "success");
    } catch (err) {
      setError(err?.message || "Unable to create folder.");
      notify(err?.message || "Unable to create folder.", "error");
    } finally {
      setCreatingFolder(false);
    }
  }

  async function handlePickNotesFolder() {
    try {
      const selectedPath = await pickFolder();
      if (!selectedPath) return;
      setNotesFolderPath(selectedPath);
    } catch (err) {
      notify(err?.message || "Unable to open folder picker.", "error");
    }
  }

  async function handleSaveNotesFolder() {
    const nextPath = notesFolderPath.trim();
    if (!nextPath) {
      notify("Please provide a notes folder path.", "warning");
      return;
    }

    setSavingNotesFolder(true);
    try {
      const result = await setNotesRootSetting(nextPath);
      if (result?.ignoredByEnv) {
        notify("Path saved, but NOTES_ROOT env override is active. Remove it to use this path.", "warning");
      } else {
        await loadDocumentsData();
        setCurrent(null);
        setHistory([]);
        notify("Notes folder saved and loaded.", "success");
      }
      setNotesFolderDialogOpen(false);
    } catch (err) {
      notify(err?.message || "Unable to save notes folder.", "error");
    } finally {
      setSavingNotesFolder(false);
    }
  }

  function handleGoHome() {
    if (current && dirty) {
      const confirmed = window.confirm("You have unsaved changes. Go back to notes and discard unsaved changes?");
      if (!confirmed) return;
    }

    setDocumentMenuAction(null);
    setCurrent(null);
    setHistory([]);
  }

  async function handleOpenCurrentInEditor() {
    if (!current?.filePath) return;

    try {
      const result = await openInEditor(current.filePath);
      if (result?.openedWith === "default") {
        notify("VS Code not available. Opened with system default app.", "info");
      } else {
        notify("Opened latest note file in VS Code.", "success");
      }
    } catch (err) {
      notify(err?.message || "Unable to open file in editor.", "error");
    }
  }

  async function handleOpenWebsiteFromLanding() {
    try {
      const result = await openWebView();
      if (result?.openedWith === "chrome") {
        notify("Opened project website in Chrome.", "success");
      } else {
        notify("Chrome not found. Opened project website in default browser.", "info");
      }
    } catch (err) {
      notify(err?.message || "Unable to open project website.", "error");
    }
  }

  async function handleOpenWebsiteForCurrent() {
    if (!current?.filePath) return;

    try {
      const result = await openWebView(current.filePath, {
        header: current.header || "",
        rawNotes: current.rawNotes || "",
        cleansed: current.cleansed || "",
      });
      if (result?.openedWith === "chrome") {
        notify("Opened website view in Chrome.", "success");
      } else {
        notify("Chrome not found. Opened in your default browser.", "info");
      }
    } catch (err) {
      notify(err?.message || "Unable to open website view.", "error");
    }
  }

  async function handleRenameFromTopbar() {
    if (!current?.title) return;
    const nextTitle = window.prompt("Rename note", current.title);
    if (nextTitle == null) return;
    await handleRenameCurrentDocument(nextTitle);
  }

  async function handleOpenListItem(item) {
    if (!item) return;
    if (item.entryType === "folder") {
      try {
        setError("");
        setLoading(true);
        setLandingFolderPath(item.filePath);
        setDocuments(await listDocuments(item.filePath));
      } catch (err) {
        setError(err?.message || "Unable to open folder.");
        notify(err?.message || "Unable to open folder.", "error");
      } finally {
        setLoading(false);
      }
      return;
    }
    if (item.entryType === "file") {
      await openDocument(item.filePath);
    }
  }

  async function handleOpenReferencedDocument(filePath) {
    if (!filePath) return;
    if (current && dirty && current.filePath !== filePath) {
      const confirmed = window.confirm("You have unsaved changes. Open the referenced note and discard unsaved changes?");
      if (!confirmed) return;
    }
    await openDocument(filePath);
    setLandingAssetsOpen(false);
  }

  async function handleLandingNavigateUp() {
    const activeRoot = activeProject?.rootPath;
    const currentPath = landingFolderPath || activeRoot;
    if (!activeRoot || !currentPath || !canNavigateUp) return;

    const parentPath = currentPath.replace(/[\\/][^\\/]+[\\/]*$/, "");
    const nextPath = parentPath || activeRoot;
    try {
      setError("");
      setLoading(true);
      setLandingFolderPath(nextPath);
      setDocuments(await listDocuments(nextPath));
    } catch (err) {
      setError(err?.message || "Unable to navigate up.");
      notify(err?.message || "Unable to navigate up.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleAIEmbeddings() {
    setAiLoading(true);
    try {
      const result = await aiGenerateEmbeddings(true);
      if (result?.success) {
        notify("Embeddings generated successfully!", "success");
      } else {
        notify(result?.error || "Failed to generate embeddings", "error");
      }
    } catch (err) {
      notify(err?.message || "Failed to generate embeddings", "error");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleAIGraph() {
    setAiLoading(true);
    try {
      const result = await aiBuildGraph();
      if (result?.success) {
        notify("Relationship graph built successfully!", "success");
      } else {
        notify(result?.error || "Failed to build graph", "error");
      }
    } catch (err) {
      notify(err?.message || "Failed to build graph", "error");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleAIPatterns() {
    setAiLoading(true);
    try {
      const result = await aiDetectPatterns();
      if (result?.success) {
        notify("Patterns detected successfully!", "success");
      } else {
        notify(result?.error || "Failed to detect patterns", "error");
      }
    } catch (err) {
      notify(err?.message || "Failed to detect patterns", "error");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleAIClearCache() {
    setAiLoading(true);
    try {
      const result = await aiClearData();
      if (result?.success) {
        notify("AI cache cleared successfully!", "success");
      } else {
        notify(result?.error || "Failed to clear cache", "error");
      }
    } catch (err) {
      notify(err?.message || "Failed to clear cache", "error");
    } finally {
      setAiLoading(false);
    }
  }

  function handleOpenAIPalette(options = {}) {
    if (!current?.filePath) {
      notify("Open a note to use AI.", "warning");
      return;
    }

    if (!isAIConfigured) {
      notify("Configure an AI provider key in AI Settings to use AI chat.", "warning");
      setAiPanelVisible(false);
      setAiSettingsOpen(true);
      return;
    }

    const editorContext = aiEditorRef.current?.getContext?.() || null;
    const summary = buildAIContextSummary(editorContext, current);
    setAiQueryError("");
    setAiContextSummary(summary);
    setAiPaletteIntent(normalizePaletteIntent(options, summary));
    setAiPanelVisible(true);
  }

  async function handleInlineAIRequest(options = {}) {
    if (!current?.filePath) {
      notify("Open a note to use AI.", "warning");
      return;
    }

    if (!isAIConfigured) {
      notify("Configure an AI provider key in AI Settings to use AI actions.", "warning");
      setAiPanelVisible(false);
      setAiSettingsOpen(true);
      return;
    }

    const query = String(options?.initialQuery || "").trim();
    if (!query) return;

    setAiQueryLoading(true);
    setAiQueryError("");

    try {
      const editorContext = aiEditorRef.current?.getContext?.() || {};
      const resolvedTarget = resolveAITarget(editorContext, options?.target || "block", current, activeTab);

      const response = await aiQuery(query, {
        currentFile: current.filePath,
        workspaceRoot: activeProject?.rootPath || landingFolderPath || notesFolderPath || null,
        activeTab,
        editorMode: mode,
        documentTitle: current.title,
        selectedText: editorContext.selectedText || null,
        currentBlock: editorContext.currentBlock?.text || null,
        selectionStart: editorContext.selectionStart ?? null,
        selectionEnd: editorContext.selectionEnd ?? null,
        cursorOffset: editorContext.cursorOffset ?? null,
        requestedTarget: resolvedTarget.requestedTarget,
        resolvedTarget: resolvedTarget.effectiveTarget,
        workspaceContext: resolvedTarget.requestedTarget === "workspace",
        targetText: resolvedTarget.targetText || null,
      });

      if (!response?.success) {
        throw new Error(response?.error || "AI query failed.");
      }

      const resultText = extractEditableAIText(
        response?.data?.result?.result ||
        response?.data?.result ||
        ""
      );

      if (!resultText) {
        notify("AI did not return an inline suggestion.", "warning");
        return;
      }

      setInlineGhostSuggestion({
        text: resultText,
        insertAt: editorContext.cursorOffset ?? 0,
        source: String(options?.source || "inline"),
      });
      notify("Inline AI suggestion ready.", "success");
    } catch (err) {
      const message = err?.message || "AI query failed.";
      setAiQueryError(message);
      notify(message, "error");
    } finally {
      setAiQueryLoading(false);
    }
  }

  async function handleAIQuery({ query, target }) {
    if (!current?.filePath) {
      throw new Error("Open a note to use AI.");
    }

    if (!isAIConfigured) {
      notify("Configure an AI provider key in AI Settings to use AI chat.", "warning");
      setAiPanelVisible(false);
      setAiSettingsOpen(true);
      throw new Error("AI provider not configured.");
    }

    setAiQueryLoading(true);
    setAiQueryError("");

    try {
      const editorContext = aiEditorRef.current?.getContext?.() || {};
      const resolvedTarget = resolveAITarget(editorContext, target || "auto", current, activeTab);

      const response = await aiQuery(query, {
        currentFile: current.filePath,
        workspaceRoot: activeProject?.rootPath || landingFolderPath || notesFolderPath || null,
        activeTab,
        editorMode: mode,
        documentTitle: current.title,
        selectedText: editorContext.selectedText || null,
        currentBlock: editorContext.currentBlock?.text || null,
        selectionStart: editorContext.selectionStart ?? null,
        selectionEnd: editorContext.selectionEnd ?? null,
        cursorOffset: editorContext.cursorOffset ?? null,
        requestedTarget: resolvedTarget.requestedTarget,
        resolvedTarget: resolvedTarget.effectiveTarget,
        workspaceContext: resolvedTarget.requestedTarget === "workspace",
        targetText: resolvedTarget.targetText || null,
      });

      if (!response?.success) {
        throw new Error(response?.error || "AI query failed.");
      }

      const resultText = extractEditableAIText(
        response?.data?.result?.result ||
        response?.data?.result ||
        "AI query completed."
      );

      notify(resultText.length > 180 ? `${resultText.slice(0, 177)}...` : resultText, "success");
      return {
        response,
        text: resultText,
        scopeLabel: resolvedTarget.scopeLabel,
      };
    } catch (err) {
      const message = err?.message || "AI query failed.";
      setAiQueryError(message);
      notify(message, "error");
      throw err;
    } finally {
      setAiQueryLoading(false);
    }
  }

  async function handleApplyAIResult({ text, mode, previewOnly = false, insertAt = null }) {
    const outcome = aiEditorRef.current?.applyResult?.({ text, mode, previewOnly, insertAt });
    if (!outcome?.applied) {
      if (outcome?.preview) {
        return outcome;
      }
      notify(outcome?.reason || "Unable to apply AI result.", "warning");
      return outcome;
    }

    const message =
      mode === "insert"
        ? "AI content inserted into the editor."
        : mode === "replace-selection"
          ? "Selection replaced with AI content."
          : "Current block replaced with AI content.";
    notify(message, "success");
    return outcome;
  }

  async function handleAIChatSend({ message, target }) {
    const scope = target || "auto";
    const userEntry = {
      id: `user-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      role: "user",
      text: message,
      scope,
      scopeLabel: scope,
    };

    setAiChatMessages((currentMessages) => [...currentMessages, userEntry]);

    try {
      const result = await handleAIQuery({
        query: message,
        target: scope,
      });
      setAiChatMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `assistant-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          role: "assistant",
          text: result?.text || "",
          scope,
          scopeLabel: result?.scopeLabel || scope,
        },
      ]);
      return result;
    } catch {
      return null;
    }
  }

  function handleClearAIChat() {
    setAiChatMessages([]);
    setAiQueryError("");
  }

  function handleRejectInlineGhost() {
    setInlineGhostSuggestion(null);
  }

  async function handleAcceptInlineGhost() {
    if (!inlineGhostSuggestion?.text) return;
    const outcome = await handleApplyAIResult({
      text: inlineGhostSuggestion.text,
      mode: "insert",
      previewOnly: false,
      insertAt: inlineGhostSuggestion.insertAt,
    });
    if (outcome?.applied) {
      setInlineGhostSuggestion(null);
    }
  }

  useEffect(() => {
    loadDocumentsData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refreshAIConfiguration();
  }, []);

  useEffect(() => {
    if (!isAIConfigured && aiPanelVisible) {
      setAiPanelVisible(false);
    }
  }, [isAIConfigured, aiPanelVisible]);

  useEffect(() => {
    if (!aiSettingsOpen) {
      refreshAIConfiguration();
    }
  }, [aiSettingsOpen]);

  useEffect(() => {
    try {
      window.localStorage.setItem("notes:view-mode", notesViewMode);
    } catch {
      // Ignore storage failures.
    }
  }, [notesViewMode]);

  useEffect(() => {
    try {
      window.localStorage.setItem("notes:editor-mode", mode);
    } catch {
      // Ignore storage failures.
    }
  }, [mode]);

  useEffect(() => {
    try {
      window.localStorage.setItem("notely:ai-panel-visible", aiPanelVisible ? "true" : "false");
    } catch {
      // Ignore storage failures.
    }
  }, [aiPanelVisible]);

  useEffect(() => {
    updateMenuContext({
      screen: current ? "document" : "landing",
      viewMode: notesViewMode,
      dirty,
    });
  }, [current, notesViewMode, dirty]);

  useEffect(() => {
    setInlineGhostSuggestion(null);
    setAiChatMessages([]);
  }, [current?.filePath, activeTab]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!current?.filePath) return;
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.shiftKey || event.altKey) return;
      if (event.key.toLowerCase() !== "k") return;

      event.preventDefault();
      handleOpenAIPalette({ forceOpen: true });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.filePath]);

  useEffect(() => {
    return onMenuAction((action) => {
      if (action === "new-note") {
        setNoteDialogOpen(true);
        return;
      }

      if (action === "new-folder") {
        setFolderDialogOpen(true);
        return;
      }

      if (action === "open-notes-folder-settings") {
        setNotesFolderDialogOpen(true);
        return;
      }

      if (action === "open-p2p-status") {
        handleOpenP2PStatus();
        return;
      }

      if (action === "open-workspace-activity") {
        handleOpenWorkspaceActivity();
        return;
      }

      if (action === "open-p2p-sync-help") {
        setP2PSyncHelpOpen(true);
        return;
      }

      if (action === "run-p2p-sync-self-test") {
        handleRunP2PSyncSelfTest();
        return;
      }

      if (action === "rotate-p2p-workspace-keys") {
        handleRotateP2PWorkspaceKeys();
        return;
      }

      if (action === "open-p2p-conflicts") {
        handleOpenConflictCenter();
        return;
      }

      if (action === "view-tile") {
        setNotesViewMode("tile");
        return;
      }

      if (action === "view-table") {
        setNotesViewMode("table");
        return;
      }

      if (action === "save-document") {
        saveDocument();
        return;
      }

      if (action === "back-to-notes") {
        handleGoHome();
        return;
      }

      if (action === "open-in-editor") {
        handleOpenCurrentInEditor();
        return;
      }

      if (action === "rename-note") {
        handleRenameFromTopbar();
        return;
      }

      if (action === "find-in-note" || action === "find-replace") {
        if (current) {
          setDocumentMenuAction({ action: "find-replace", nonce: Date.now() });
        }
        return;
      }

      if (action === "toggle-outline" || action === "toggle-split-preview" || action === "toggle-focus-mode") {
        if (current) {
          setDocumentMenuAction({ action, nonce: Date.now() });
        }
        return;
      }

      if (action === "export-pdf") {
        if (current) {
          setDocumentMenuAction({ action, nonce: Date.now() });
        }
        return;
      }

      if (action === "manage-versions") {
        if (current) {
          setDocumentMenuAction({ action, nonce: Date.now() });
        }
        return;
      }

      if (action === "open-website") {
        if (current) {
          handleOpenWebsiteForCurrent();
        } else {
          handleOpenWebsiteFromLanding();
        }
        return;
      }

      if (action === "reload-document") {
        handleReloadCurrentFromDisk();
        return;
      }

      if (action === "remove-document") {
        handleDeleteCurrentDocument();
        return;
      }

      if (action === "open-ai-settings") {
        setAiSettingsOpen(true);
        return;
      }

      if (action === "open-ai-palette") {
        handleOpenAIPalette({ forceOpen: true });
        return;
      }

      if (action === "ai-generate-embeddings") {
        handleAIEmbeddings();
        return;
      }

      if (action === "ai-build-graph") {
        handleAIGraph();
        return;
      }

      if (action === "ai-detect-patterns") {
        handleAIPatterns();
        return;
      }

      if (action === "ai-clear-cache") {
        handleAIClearCache();
        return;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, dirty, activeProject, activeTab]);

  return (
    <div className="app-shell">
      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div className={`toast-item ${toast.type}`} key={toast.id}>
            {toast.message}
          </div>
        ))}
      </div>
      {error && <div className="error-banner">{error}</div>}
      {!showTerminal ? (
        <div className="terminal-status-bar">
          <div className="terminal-status-left">
            <button
              className="terminal-status-button"
              type="button"
              onClick={() => setShowTerminal(true)}
              title="Open terminal"
            >
              <Terminal size={16} />
              <strong>Terminal</strong>
              {terminalCwd && <span className="terminal-status-path">{terminalCwd}</span>}
            </button>
          </div>
          <div className="terminal-status-right" aria-label="Terminal metadata">
            <span className="terminal-meta-pill" title="Current workspace scope">
              {activeProject?.isRoot ? "Root" : activeProject?.name || "Project"}
            </span>
            {current ? (
              <>
                <span className="terminal-meta-pill" title="Editor mode and active tab">
                  {mode === "split" ? "Split" : mode === "preview" ? "Preview" : "Edit"} | {activeTab === "raw" ? "Raw" : "Formal"}
                </span>
                <span className={`terminal-meta-pill ${dirty ? "warn" : ""}`} title="Document save status">
                  {dirty ? "Unsaved" : "Saved"}
                </span>
              </>
            ) : (
              <span className="terminal-meta-pill" title="Current notes in list">
                {documents.length} notes
              </span>
            )}
          </div>
        </div>
      ) : null}
      {!current ? (
        <>
          <header className="landing-header">
            <div>
              <h1>{activeProject?.isRoot ? "All Notes" : `${activeProject?.name || "Folder"} Notes`}</h1>
              <div className="landing-path" title={landingFolderPath || activeProject?.rootPath || notesFolderPath || "Path unavailable"}>
                {landingFolderPath || activeProject?.rootPath || notesFolderPath || "Path unavailable"}
              </div>
            </div>
            <div className="landing-header-actions">
              <div className="landing-primary-actions">
                {canNavigateUp ? (
                  <button className="small-button" type="button" onClick={handleLandingNavigateUp}>
                    <ArrowUp size={14} />
                    Up
                  </button>
                ) : null}
                <button className="small-button" type="button" onClick={() => setFolderDialogOpen(true)}>
                  <FolderPlus size={14} />
                  New Folder
                </button>
                <button className="small-button" type="button" onClick={() => setNoteDialogOpen(true)}>
                  <NotebookPen size={14} />
                  New Note
                </button>
                <button
                  className="small-button"
                  type="button"
                  onClick={() => setLandingAssetsOpen(true)}
                  title="Browse assets in this folder"
                >
                  <ImageIcon size={14} />
                  Assets
                </button>
                <div className="document-view-toggle" role="group" aria-label="Landing notes view mode">
                  <button
                    className={notesViewMode === "tile" ? "active" : ""}
                    onClick={() => setNotesViewMode("tile")}
                    type="button"
                  >
                    <LayoutGrid size={14} />
                    Tile
                  </button>
                  <button
                    className={notesViewMode === "table" ? "active" : ""}
                    onClick={() => setNotesViewMode("table")}
                    type="button"
                  >
                    <Rows3 size={14} />
                    Table
                  </button>
                </div>
              </div>
            </div>
          </header>
          <DocumentList
            documents={documents}
            onOpen={handleOpenListItem}
            loading={loading}
            viewMode={notesViewMode}
          />
          {landingAssetsOpen ? (
            <div
              className="overlay-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="Assets"
              onClick={(event) => {
                if (event.target === event.currentTarget) setLandingAssetsOpen(false);
              }}
            >
              <div className="overlay-dialog-card assets-dialog-card">
                <div className="overlay-dialog-header assets-dialog-header">
                  <div className="assets-dialog-title-group">
                    <h2>Assets Library</h2>
                    <p>Browse assets in this folder.</p>
                  </div>
                  <button
                    className="icon-button assets-close-button"
                    onClick={() => setLandingAssetsOpen(false)}
                    type="button"
                    aria-label="Close assets dialog"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="assets-dialog-body">
                  <Suspense fallback={<div className="lazy-loading">Loading media…</div>}>
                    <MediaTab
                      content=""
                      basePath={`${(landingFolderPath || activeProject?.rootPath || notesFolderPath || "").replace(/[\\/]+$/, "")}/_assets.md`}
                      onNotify={notify}
                      onOpenDocument={handleOpenReferencedDocument}
                    />
                  </Suspense>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <DocumentDetail
          document={current}
          history={history}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          mode={mode}
          setMode={setMode}
          onChange={setCurrent}
          onSave={saveDocument}
          onRefreshHistory={async () => setHistory(await getHistory(current.filePath))}
          saving={saving}
          dirty={dirty}
          menuAction={documentMenuAction}
          onNotify={notify}
          onBack={handleGoHome}
          onOpenAI={handleOpenAIPalette}
          onOpenAIRequest={handleOpenAIPalette}
          onInlineAIRequest={handleInlineAIRequest}
          onRegisterAIEditor={(api) => {
            aiEditorRef.current = api;
          }}
          inlineGhostSuggestion={inlineGhostSuggestion}
          onAcceptInlineGhost={handleAcceptInlineGhost}
          onRejectInlineGhost={handleRejectInlineGhost}
          aiEnabled={isAIConfigured}
          aiPanelVisible={aiPanelVisible}
          onShowAI={() => {
            if (!isAIConfigured) {
              notify("Configure an AI provider key in AI Settings to use AI chat.", "warning");
              setAiSettingsOpen(true);
              return;
            }
            setAiPanelVisible(true);
          }}
          onOpenAISettings={() => setAiSettingsOpen(true)}
          onOpenDocument={handleOpenReferencedDocument}
          aiSidebar={aiPanelVisible && isAIConfigured ? (
            <ErrorBoundary label="AI chat">
              <Suspense fallback={<div className="lazy-loading">Loading AI…</div>}>
                <AIChatPanel
                  onHide={() => setAiPanelVisible(false)}
                  onClear={handleClearAIChat}
                  onSend={handleAIChatSend}
                  onApply={handleApplyAIResult}
                  isLoading={aiQueryLoading}
                  error={aiQueryError || null}
                  contextSummary={aiContextSummary}
                  intent={aiPaletteIntent}
                  messages={aiChatMessages}
                  noteTitle={current?.title || "Current Note"}
                />
              </Suspense>
            </ErrorBoundary>
          ) : null}
        />
      )}

      {showTerminal ? (
        <div className="terminal-dock open">
          <ErrorBoundary label="Terminal">
            <Suspense fallback={<div className="lazy-loading">Loading terminal…</div>}>
              <EmbeddedTerminal cwd={terminalCwd} onClose={() => setShowTerminal(false)} />
            </Suspense>
          </ErrorBoundary>
        </div>
      ) : null}

      {noteDialogOpen ? (
        <div className="overlay-dialog" role="dialog" aria-modal="true" aria-label="Create note">
          <div className="overlay-dialog-card">
            <div className="overlay-dialog-header">
              <h2>New Note</h2>
              <button
                className="icon-button"
                onClick={() => setNoteDialogOpen(false)}
                type="button"
                aria-label="Close new note dialog"
              >
                <X size={16} />
              </button>
            </div>
            <label className="overlay-dialog-field">
              <span>Note title</span>
              <input
                type="text"
                value={newNoteTitle}
                onChange={(event) => setNewNoteTitle(event.target.value)}
                placeholder="Enter note title"
                autoFocus
              />
            </label>
            <div className="overlay-dialog-actions">
              <button className="primary-button" onClick={handleCreateNote} disabled={creatingNote} type="button">
                <NotebookPen size={14} />
                {creatingNote ? "Creating..." : "Create Note"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {folderDialogOpen ? (
        <div className="overlay-dialog" role="dialog" aria-modal="true" aria-label="Create folder">
          <div className="overlay-dialog-card">
            <div className="overlay-dialog-header">
              <h2>New Folder</h2>
              <button
                className="icon-button"
                onClick={() => setFolderDialogOpen(false)}
                type="button"
                aria-label="Close new folder dialog"
              >
                <X size={16} />
              </button>
            </div>
            <label className="overlay-dialog-field">
              <span>Folder name</span>
              <input
                type="text"
                value={newFolderName}
                onChange={(event) => setNewFolderName(event.target.value)}
                placeholder="Enter folder name"
                autoFocus
              />
            </label>
            <div className="overlay-dialog-actions">
              <button className="primary-button" onClick={handleCreateFolder} disabled={creatingFolder} type="button">
                {creatingFolder ? "Creating..." : "Create Folder"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {notesFolderDialogOpen ? (
        <div className="overlay-dialog" role="dialog" aria-modal="true" aria-label="Configure notes folder">
          <div className="overlay-dialog-card">
            <div className="overlay-dialog-header">
              <h2>Notes Folder</h2>
              <button
                className="icon-button"
                onClick={() => setNotesFolderDialogOpen(false)}
                type="button"
                aria-label="Close notes folder dialog"
              >
                <X size={16} />
              </button>
            </div>
            <label className="overlay-dialog-field">
              <span>Location</span>
              <input
                type="text"
                value={notesFolderPath}
                onChange={(event) => setNotesFolderPath(event.target.value)}
                placeholder="Select notes folder path"
              />
            </label>
            <div className="overlay-dialog-actions split">
              <button className="small-button" onClick={handlePickNotesFolder} type="button">
                <FolderOpen size={14} />
                Browse
              </button>
              <button
                className="primary-button"
                onClick={handleSaveNotesFolder}
                disabled={savingNotesFolder}
                type="button"
              >
                {savingNotesFolder ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {p2pStatusOpen ? (
        <div className="overlay-dialog" role="dialog" aria-modal="true" aria-label="P2P status">
          <div className="overlay-dialog-card p2p-status-dialog-card">
            <div className="overlay-dialog-header">
              <h2>P2P Status</h2>
              <button
                className="icon-button"
                onClick={() => setP2PStatusOpen(false)}
                type="button"
                aria-label="Close P2P status"
              >
                <X size={16} />
              </button>
            </div>
            <P2PStatusPanel
              status={p2pStatus}
              loading={p2pStatusLoading}
              fullSyncProgressByPeer={fullSyncProgressByPeer}
              onRefresh={handleOpenP2PStatus}
              onStartDiscovery={handleStartP2PDiscovery}
              onStopDiscovery={handleStopP2PDiscovery}
              onSetDeviceName={handleSetP2PDeviceName}
              onSetKeyPolicyDays={handleSetP2PKeyPolicyDays}
              onCreateInvite={handleCreateP2PInvite}
              onPairWithCode={handlePairP2PWithCode}
              onManualConnect={handleManualP2PConnect}
              onRemoveTrustedPeer={handleRemoveTrustedP2PPeer}
              onRotateWorkspaceKeys={handleRotateP2PWorkspaceKeys}
            />
          </div>
        </div>
      ) : null}

      {workspaceActivityOpen ? (
        <div className="overlay-dialog" role="dialog" aria-modal="true" aria-label="Workspace activity">
          <div className="overlay-dialog-card activity-dialog-card">
            <div className="overlay-dialog-header">
              <h2>Workspace Activity</h2>
              <button
                className="icon-button"
                onClick={() => setWorkspaceActivityOpen(false)}
                type="button"
                aria-label="Close workspace activity"
              >
                <X size={16} />
              </button>
            </div>
            <WorkspaceActivityPanel
              data={workspaceActivity}
              loading={workspaceActivityLoading}
              onRefresh={handleOpenWorkspaceActivity}
            />
          </div>
        </div>
      ) : null}

      {aiSettingsOpen ? (
        <Suspense fallback={<div className="lazy-loading">Loading settings…</div>}>
          <AISettings
            isOpen={aiSettingsOpen}
            onClose={() => {
              setAiSettingsOpen(false);
              refreshAIConfiguration();
            }}
          />
        </Suspense>
      ) : null}

      {p2pSyncHelpOpen ? (
        <div className="overlay-dialog" role="dialog" aria-modal="true" aria-label="P2P sync notes">
          <div className="overlay-dialog-card">
            <div className="overlay-dialog-header">
              <h2>How P2P Sync Works</h2>
              <button
                className="icon-button"
                onClick={() => setP2PSyncHelpOpen(false)}
                type="button"
                aria-label="Close P2P sync help"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p2p-sync-help-content">
              <p><strong>Current behavior</strong></p>
              <ol>
                <li>Discovery: each app broadcasts a LAN hello packet and lists nearby peers.</li>
                <li>Connect: you can manually ping a peer by address and port.</li>
                <li>Pairing: one peer creates an invite code, the other submits the code to establish trust.</li>
                <li>Trust state: trusted peers are saved locally on each device.</li>
                <li>Sync: create, update, and delete note events are shared between trusted peers.</li>
              </ol>
              <p><strong>File sync status</strong></p>
              <p>Automatic note sync is enabled for trusted peers using AES-256-GCM encrypted sync events.</p>
              <p><strong>Planned next phase</strong></p>
              <ol>
                <li>Replace full-content updates with true section/line deltas.</li>
                <li>Add richer conflict resolution UI (manual choose/merge).</li>
                <li>Add delivery retry queues and offline reconciliation.</li>
              </ol>
            </div>
          </div>
        </div>
      ) : null}

      {conflictResolutionOpen && conflictResolutionEntry ? (
        <div className="overlay-dialog" role="dialog" aria-modal="true" aria-label="Resolve sync conflict">
          <div className="overlay-dialog-card conflict-resolve-dialog-card">
            <div className="overlay-dialog-header">
              <h2>Resolve Conflict</h2>
              <button
                className="icon-button"
                onClick={() => setConflictResolutionOpen(false)}
                type="button"
                aria-label="Close conflict resolution"
              >
                <X size={16} />
              </button>
            </div>
            {conflictResolutionLoading && !conflictResolutionFiles ? (
              <p className="p2p-status-table-empty">Loading files...</p>
            ) : conflictResolutionFiles ? (
              <ConflictResolutionPanel
                localFile={conflictResolutionFiles.local}
                conflictFile={conflictResolutionFiles.conflict}
                relativePath={conflictResolutionEntry.relativePath || conflictResolutionEntry.filePath}
                onResolve={handleResolveConflict}
                loading={conflictResolutionLoading}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {syncSelfTestOpen ? (
        <div className="overlay-dialog" role="dialog" aria-modal="true" aria-label="P2P sync self-test">
          <div className="overlay-dialog-card">
            <div className="overlay-dialog-header">
              <h2>P2P Sync Self-Test</h2>
              <button
                className="icon-button"
                onClick={() => setSyncSelfTestOpen(false)}
                type="button"
                aria-label="Close sync self-test"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p2p-sync-help-content">
              {syncSelfTestLoading ? (
                <p>Running self-test...</p>
              ) : syncSelfTestResult ? (
                <>
                  <p>
                    <strong>Result:</strong>{" "}
                    <span className={syncSelfTestResult.ok ? "p2p-test-pass" : "p2p-test-fail"}>
                      {syncSelfTestResult.ok ? "PASS" : "FAIL"}
                    </span>
                  </p>
                  <p><strong>Crypto round-trip:</strong> {syncSelfTestResult.cryptoRoundTrip || "N/A"}</p>
                  <p><strong>Trusted peers:</strong> {syncSelfTestResult.trustedPeers ?? "N/A"}</p>
                  <p><strong>Outbox count:</strong> {syncSelfTestResult.outboxCount ?? "N/A"}</p>
                  {syncSelfTestResult.error ? (
                    <p className="p2p-test-fail"><strong>Error:</strong> {syncSelfTestResult.error}</p>
                  ) : null}
                </>
              ) : (
                <p>No result yet.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {conflictCenterOpen ? (
        <div className="overlay-dialog" role="dialog" aria-modal="true" aria-label="P2P conflict center">
          <div className="overlay-dialog-card p2p-status-dialog-card">
            <div className="overlay-dialog-header">
              <h2>Conflict Center</h2>
              <button
                className="icon-button"
                onClick={() => setConflictCenterOpen(false)}
                type="button"
                aria-label="Close conflict center"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p2p-conflict-center">
              <div className="p2p-conflict-center-actions">
                <button
                  className="small-button"
                  type="button"
                  onClick={handleOpenNextConflict}
                  disabled={!conflictCenterData?.conflicts?.length}
                >
                  Resolve Next Unresolved
                </button>
              </div>
              {conflictCenterLoading ? (
                <p className="p2p-status-table-empty">Loading conflicts...</p>
              ) : !conflictCenterData?.conflicts?.length ? (
                <p className="p2p-status-table-empty">No unresolved sync conflicts.</p>
              ) : (
                <table className="p2p-status-peer-table">
                  <thead>
                    <tr>
                      <th>Note</th>
                      <th>Conflict File</th>
                      <th>When</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conflictCenterData.conflicts.map((entry) => (
                      <tr key={entry.id}>
                        <td className="mono-cell">{entry.relativePath || entry.filePath}</td>
                        <td className="mono-cell" title={entry.conflictPath}>
                          {entry.conflictPath.split(/[\\/]/).pop()}
                        </td>
                        <td>{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "Unknown"}</td>
                        <td className="p2p-conflict-actions">
                          <button
                            className="small-button"
                            type="button"
                            onClick={() => handleOpenConflictResolution(entry)}
                          >
                            Resolve
                          </button>
                          <button
                            className="small-button"
                            type="button"
                            onClick={() => handleOpenConflictFile(entry.filePath)}
                          >
                            Open Local
                          </button>
                          <button
                            className="small-button"
                            type="button"
                            onClick={() => handleOpenConflictFile(entry.conflictPath)}
                          >
                            Open Conflict
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
