import { Suspense, lazy } from "react";

const GitVersionControlPage = lazy(() =>
  import("../GitVersionControlPage").then((m) => ({ default: m.default || m.GitVersionControlPage }))
);
const KnowledgeGraph = lazy(() =>
  import("../KnowledgeGraph").then((m) => ({ default: m.default || m.KnowledgeGraph }))
);
const EmbeddingsPage = lazy(() =>
  import("../EmbeddingsPage").then((m) => ({ default: m.default || m.EmbeddingsPage }))
);
const AIPersonasManager = lazy(() =>
  import("../AIPersonasManager").then((m) => ({ default: m.default || m.AIPersonasManager }))
);
const AIHealthPage = lazy(() =>
  import("../AIHealthPage").then((m) => ({ default: m.default || m.AIHealthPage }))
);
const AppLogsPage = lazy(() =>
  import("../AppLogsPage").then((m) => ({ default: m.default || m.AppLogsPage }))
);
const TaskWorkspacePage = lazy(() =>
  import("../TaskWorkspacePage").then((m) => ({ default: m.default || m.TaskWorkspacePage }))
);
const CalendarPage = lazy(() =>
  import("../CalendarPage").then((m) => ({ default: m.default || m.CalendarPage }))
);
const DownloadsPage = lazy(() =>
  import("../DownloadsPage").then((m) => ({ default: m.default || m.DownloadsPage }))
);

const fullScreenOverlayStyle = {
  position: "fixed",
  top: "32px",
  right: 0,
  bottom: "28px",
  left: 0,
  zIndex: 1000,
  display: "flex",
  flexDirection: "column",
  background: "var(--app-bg)",
  color: "var(--app-text)",
};

export function AppSubpageViews({
  gitVCOpen,
  setGitVCOpen,
  notesFolderPath,
  notify,
  handleGitStateChange,
  current,
  gitVCInitialTab,
  documents,
  graphPanelOpen,
  setGraphPanelOpen,
  embeddingsPageOpen,
  setEmbeddingsPageOpen,
  personasPageOpen,
  setPersonasPageOpen,
  healthPageOpen,
  setHealthPageOpen,
  appLogsOpen,
  setAppLogsOpen,
  taskWorkspaceOpen,
  setTaskWorkspaceOpen,
  taskWorkspaceContext,
  setTaskWorkspaceContext,
  handleOpenReferencedDocument,
  calendarPageOpen,
  setCalendarPageOpen,
  downloadsPageOpen,
  setDownloadsPageOpen,
}) {
  return (
    <>
      {gitVCOpen && (
        <div style={fullScreenOverlayStyle}>
          <Suspense fallback={<div className="lazy-loading">Loading Version Control…</div>}>
            <GitVersionControlPage
              workspacePath={notesFolderPath}
              onBack={() => setGitVCOpen(false)}
              onNotify={notify}
              onGitStateChange={handleGitStateChange}
              currentFilePath={current?.filePath}
              initialTab={gitVCInitialTab}
              documents={documents}
            />
          </Suspense>
        </div>
      )}

      {graphPanelOpen && (
        <div style={fullScreenOverlayStyle}>
          <Suspense fallback={<div className="lazy-loading">Loading Knowledge Graph…</div>}>
            <KnowledgeGraph onBack={() => setGraphPanelOpen(false)} />
          </Suspense>
        </div>
      )}

      {embeddingsPageOpen && (
        <div style={fullScreenOverlayStyle}>
          <Suspense fallback={<div className="lazy-loading">Loading Embeddings Engine…</div>}>
            <EmbeddingsPage onBack={() => setEmbeddingsPageOpen(false)} />
          </Suspense>
        </div>
      )}

      {personasPageOpen && (
        <div style={fullScreenOverlayStyle}>
          <Suspense fallback={<div className="lazy-loading">Loading Personas…</div>}>
            <AIPersonasManager onBack={() => setPersonasPageOpen(false)} />
          </Suspense>
        </div>
      )}

      {healthPageOpen && (
        <div style={fullScreenOverlayStyle}>
          <Suspense fallback={<div className="lazy-loading">Loading Health & Diagnostics…</div>}>
            <AIHealthPage onBack={() => setHealthPageOpen(false)} />
          </Suspense>
        </div>
      )}

      {appLogsOpen && (
        <div style={fullScreenOverlayStyle}>
          <Suspense fallback={<div className="lazy-loading">Loading System & Application Logs…</div>}>
            <AppLogsPage onBack={() => setAppLogsOpen(false)} />
          </Suspense>
        </div>
      )}

      {taskWorkspaceOpen && (
        <div style={fullScreenOverlayStyle}>
          <Suspense fallback={<div className="lazy-loading">Loading Task Workspace…</div>}>
            <TaskWorkspacePage
              onBack={() => setTaskWorkspaceOpen(false)}
              onOpenNote={(filePath) => {
                setTaskWorkspaceOpen(false);
                void handleOpenReferencedDocument(filePath);
              }}
              noteFilter={taskWorkspaceContext?.noteFilter ?? null}
            />
          </Suspense>
        </div>
      )}

      {calendarPageOpen && (
        <div style={fullScreenOverlayStyle}>
          <Suspense fallback={<div className="lazy-loading">Loading Calendar…</div>}>
            <CalendarPage
              onBack={() => setCalendarPageOpen(false)}
              onOpenNote={(filePath) => {
                setCalendarPageOpen(false);
                void handleOpenReferencedDocument(filePath);
              }}
              onOpenTask={(task) => {
                setCalendarPageOpen(false);
                setTaskWorkspaceContext(task?.source_path ? { noteFilter: task.source_path } : null);
                setTaskWorkspaceOpen(true);
              }}
            />
          </Suspense>
        </div>
      )}

      {downloadsPageOpen && (
        <div style={fullScreenOverlayStyle}>
          <Suspense fallback={<div className="lazy-loading">Loading Downloads & Export History…</div>}>
            <DownloadsPage onBack={() => setDownloadsPageOpen(false)} />
          </Suspense>
        </div>
      )}
    </>
  );
}
