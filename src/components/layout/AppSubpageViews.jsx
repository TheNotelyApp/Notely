import { Suspense, lazy } from "react";
import { ErrorBoundary } from "../ErrorBoundary";

const GitVersionControlPage = lazy(() =>
  import("../GitVersionControlPage").then((m) => ({ default: m.default || m.GitVersionControlPage }))
);
const KnowledgeGraph = lazy(() =>
  import("../KnowledgeGraph").then((m) => ({ default: m.default || m.KnowledgeGraph }))
);
const EmbeddingsPage = lazy(() =>
  import("../EmbeddingsPage").then((m) => ({ default: m.default || m.EmbeddingsPage }))
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
const WorkspaceIndexPage = lazy(() =>
  import("../WorkspaceIndexPage").then((m) => ({ default: m.default || m.WorkspaceIndexPage }))
);
const WorkspaceDiagramsMediaPage = lazy(() =>
  import("../WorkspaceDiagramsMediaPage").then((m) => ({ default: m.default || m.WorkspaceDiagramsMediaPage }))
);
const MCPToolsPage = lazy(() =>
  import("../MCPToolsPage").then((m) => ({ default: m.default || m.MCPToolsPage }))
);
const AttachedReposPage = lazy(() =>
  import("../AttachedReposPage").then((m) => ({ default: m.default || m.AttachedReposPage }))
);

export const SUBPAGE_DEFINITIONS = [
  {
    key: "gitVC",
    isOpen: (p) => p.activeSubpage === "gitVC" || Boolean(p.gitVCOpen),
    onClose: (p) => (p.onCloseSubpage ? p.onCloseSubpage() : p.setGitVCOpen?.(false)),
    label: "Version Control",
    render: (p, close) => (
      <GitVersionControlPage
        workspacePath={p.notesFolderPath}
        onBack={close}
        onNotify={p.notify}
        onGitStateChange={p.handleGitStateChange}
        currentFilePath={p.current?.filePath}
        initialTab={p.gitVCInitialTab}
        documents={p.documents}
      />
    ),
  },
  {
    key: "graph",
    isOpen: (p) => p.activeSubpage === "graph" || Boolean(p.graphPanelOpen),
    onClose: (p) => (p.onCloseSubpage ? p.onCloseSubpage() : p.setGraphPanelOpen?.(false)),
    label: "Knowledge Graph",
    render: (_p, close) => <KnowledgeGraph onBack={close} />,
  },
  {
    key: "attachedRepos",
    isOpen: (p) => p.activeSubpage === "attachedRepos" || Boolean(p.attachedReposPageOpen),
    onClose: (p) => (p.onCloseSubpage ? p.onCloseSubpage() : p.setAttachedReposPageOpen?.(false)),
    label: "Attached Repositories",
    render: (p, close) => (
      <AttachedReposPage
        notesFolderPath={p.notesFolderPath}
        documents={p.documents}
        onBack={close}
        onClose={close}
        onOpenKnowledgeGraph={() => {
          close();
          if (p.onOpenSubpage) p.onOpenSubpage("graph");
          else p.setGraphPanelOpen?.(true);
        }}
        onOpenNote={(filePath) => {
          close();
          if (p.handleOpenReferencedDocument) {
            void p.handleOpenReferencedDocument(filePath);
          }
        }}
      />
    ),
  },
  {
    key: "embeddings",
    isOpen: (p) => p.activeSubpage === "embeddings" || Boolean(p.embeddingsPageOpen),
    onClose: (p) => (p.onCloseSubpage ? p.onCloseSubpage() : p.setEmbeddingsPageOpen?.(false)),
    label: "Embeddings Engine",
    render: (_p, close) => <EmbeddingsPage onBack={close} />,
  },
  {
    key: "health",
    isOpen: (p) => p.activeSubpage === "health" || Boolean(p.healthPageOpen),
    onClose: (p) => (p.onCloseSubpage ? p.onCloseSubpage() : p.setHealthPageOpen?.(false)),
    label: "Health & Diagnostics",
    render: (_p, close) => <AIHealthPage onBack={close} />,
  },
  {
    key: "appLogs",
    isOpen: (p) => p.activeSubpage === "appLogs" || Boolean(p.appLogsOpen),
    onClose: (p) => (p.onCloseSubpage ? p.onCloseSubpage() : p.setAppLogsOpen?.(false)),
    label: "Application Logs",
    render: (_p, close) => <AppLogsPage onBack={close} />,
  },
  {
    key: "tasks",
    isOpen: (p) => p.activeSubpage === "tasks" || Boolean(p.taskWorkspaceOpen),
    onClose: (p) => (p.onCloseSubpage ? p.onCloseSubpage() : p.setTaskWorkspaceOpen?.(false)),
    label: "Task Workspace",
    render: (p, close) => (
      <TaskWorkspacePage
        onBack={close}
        onOpenNote={(filePath) => {
          close();
          void p.handleOpenReferencedDocument?.(filePath);
        }}
        noteFilter={p.taskWorkspaceContext?.noteFilter ?? null}
      />
    ),
  },
  {
    key: "calendar",
    isOpen: (p) => p.activeSubpage === "calendar" || Boolean(p.calendarPageOpen),
    onClose: (p) => (p.onCloseSubpage ? p.onCloseSubpage() : p.setCalendarPageOpen?.(false)),
    label: "Calendar",
    render: (p, close) => (
      <CalendarPage
        onBack={close}
        workspacePath={p.notesFolderPath}
        onOpenNote={(filePath) => {
          close();
          void p.handleOpenReferencedDocument?.(filePath);
        }}
        onOpenTask={(task) => {
          close();
          p.setTaskWorkspaceContext?.(task?.source_path ? { noteFilter: task.source_path } : null);
          if (p.onOpenSubpage) p.onOpenSubpage("tasks");
          else p.setTaskWorkspaceOpen?.(true);
        }}
        onOpenVersionControl={() => {
          close();
          if (p.onOpenSubpage) p.onOpenSubpage("gitVC");
          else p.setGitVCOpen?.(true);
        }}
      />
    ),
  },
  {
    key: "downloads",
    isOpen: (p) => p.activeSubpage === "downloads" || Boolean(p.downloadsPageOpen),
    onClose: (p) => (p.onCloseSubpage ? p.onCloseSubpage() : p.setDownloadsPageOpen?.(false)),
    label: "Downloads & Export History",
    render: (_p, close) => <DownloadsPage onBack={close} />,
  },
  {
    key: "workspaceIndex",
    isOpen: (p) => p.activeSubpage === "workspaceIndex" || Boolean(p.workspaceIndexOpen),
    onClose: (p) => (p.onCloseSubpage ? p.onCloseSubpage() : p.setWorkspaceIndexOpen?.(false)),
    label: "Workspace Index",
    render: (p, close) => (
      <WorkspaceIndexPage
        documents={p.documents}
        workspacePath={p.notesFolderPath}
        onBack={close}
        onSelectHeader={(docId, line) => {
          close();
          if (p.onSelectHeader) p.onSelectHeader(docId, line);
        }}
      />
    ),
  },
  {
    key: "diagramsMedia",
    isOpen: (p) => p.activeSubpage === "diagramsMedia" || Boolean(p.diagramsMediaOpen),
    onClose: (p) => (p.onCloseSubpage ? p.onCloseSubpage() : p.setDiagramsMediaOpen?.(false)),
    label: "Diagrams & Media",
    render: (p, close) => (
      <WorkspaceDiagramsMediaPage
        documents={p.documents}
        workspacePath={p.notesFolderPath}
        onBack={close}
        onNotify={p.notify}
        onOpenNote={(filePath, line) => {
          close();
          if (p.handleOpenReferencedDocument) {
            void p.handleOpenReferencedDocument(filePath, line);
          }
        }}
      />
    ),
  },
  {
    key: "mcpTools",
    isOpen: (p) => p.activeSubpage === "mcpTools" || Boolean(p.mcpToolsPageOpen),
    onClose: (p) => (p.onCloseSubpage ? p.onCloseSubpage() : p.setMcpToolsPageOpen?.(false)),
    label: "MCP Tools",
    render: (p, close) => (
      <MCPToolsPage
        onBack={close}
        onNotify={p.notify}
        onOpenSettings={() => {
          close();
          if (p.onOpenMcpSettings) p.onOpenMcpSettings();
        }}
      />
    ),
  },
];

export function AppSubpageViews(props) {
  const activeDef = SUBPAGE_DEFINITIONS.find((def) => def.isOpen(props));
  if (!activeDef) return null;

  const closeHandler = () => activeDef.onClose(props);

  return (
    <div className="app-subpage-overlay" key={activeDef.key}>
      <ErrorBoundary label={activeDef.label} onReset={closeHandler}>
        <Suspense fallback={<div className="lazy-loading">Loading {activeDef.label}…</div>}>
          {activeDef.render(props, closeHandler)}
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
