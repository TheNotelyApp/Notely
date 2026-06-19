import { useEffect, useState } from "react";
import mermaid from "mermaid";
import { FolderPlus, LayoutGrid, NotebookPen, Rows3, X } from "lucide-react";
import { DocumentList } from "./components/DocumentList";
import { DocumentDetail } from "./components/DocumentDetail";
import {
  createDocument,
  createProject,
  listProjects,
  listDocuments,
  readDocument,
  saveDocument as saveDocumentApi,
  setActiveProject,
  getHistory,
} from "./services/electronService";

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

  const [documents, setDocuments] = useState([]);
  const [current, setCurrent] = useState(null);
  const [savedHash, setSavedHash] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("raw");
  const [mode, setMode] = useState("edit");
  const [error, setError] = useState("");
  const [toasts, setToasts] = useState([]);
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProjectState] = useState(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [creatingNote, setCreatingNote] = useState(false);
  const [notesViewMode, setNotesViewMode] = useState(initialViewMode);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);

  const notify = (message, type = "info") => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((currentToasts) => [...currentToasts, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id));
    }, 3000);
  };

  const dirty =
    current
      ? savedHash !==
        JSON.stringify({
          header: current.header,
          rawNotes: current.rawNotes,
          cleansed: current.cleansed,
        })
      : false;

  function applyProjectState(result) {
    setProjects(result?.projects || []);
    setActiveProjectState(result?.activeProject || null);
  }

  async function loadDocumentsData() {
    setLoading(true);
    setError("");
    try {
      const projectState = await listProjects();
      applyProjectState(projectState);
      setDocuments(await listDocuments());
    } catch (err) {
      setError(err?.message || "Unable to load documents.");
    } finally {
      setLoading(false);
    }
  }

  async function openDocument(filePath) {
    setError("");
    const doc = await readDocument(filePath);
    setCurrent(doc);
    setSavedHash(
      JSON.stringify({
        header: doc.header,
        rawNotes: doc.rawNotes,
        cleansed: doc.cleansed,
      })
    );
    setActiveTab("raw");
    setHistory(await getHistory(filePath));
  }

  async function saveDocument() {
    if (!current) return;
    setSaving(true);
    setError("");

    try {
      const saved = await saveDocumentApi({
        filePath: current.filePath,
        header: current.header,
        rawNotes: current.rawNotes,
        cleansed: current.cleansed,
        reason: "manual-save",
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
      notify("Document saved.", "success");
    } catch (err) {
      setError(err?.message || "Unable to save document.");
      notify(err?.message || "Unable to save document.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleSwitchProject(slug) {
    if (!slug) return;
    if (activeProject?.slug === slug) return;

    if (current && dirty) {
      const confirmed = window.confirm("You have unsaved changes. Switch project and discard unsaved changes?");
      if (!confirmed) return;
    }

    setError("");
    setLoading(true);
    try {
      const result = await setActiveProject(slug);
      applyProjectState(result);
      setCurrent(null);
      setHistory([]);
      setDocuments(await listDocuments());
      notify("Project switched.", "success");
    } catch (err) {
      setError(err?.message || "Unable to switch project.");
      notify(err?.message || "Unable to switch project.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateProject() {
    const name = newProjectName.trim();
    if (!name) {
      notify("Enter a project name first.", "warning");
      return;
    }

    if (current && dirty) {
      const confirmed = window.confirm("You have unsaved changes. Create and switch project anyway?");
      if (!confirmed) return;
    }

    setCreatingProject(true);
    setError("");
    try {
      const result = await createProject(name);
      applyProjectState(result);
      setCurrent(null);
      setHistory([]);
      setDocuments(await listDocuments());
      setNewProjectName("");
      setProjectDialogOpen(false);
      notify("Project created.", "success");
    } catch (err) {
      setError(err?.message || "Unable to create project.");
      notify(err?.message || "Unable to create project.", "error");
    } finally {
      setCreatingProject(false);
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
      const created = await createDocument(title);
      setNewNoteTitle("");
      setDocuments(await listDocuments());
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

  useEffect(() => {
    loadDocumentsData();
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("notes:view-mode", notesViewMode);
    } catch {
      // Ignore storage failures.
    }
  }, [notesViewMode]);

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
      <section className="project-toolbar">
        <div className="project-toolbar-left">
          <span className="project-toolbar-label">Project</span>
          <select
            className="project-select"
            value={activeProject?.slug || ""}
            onChange={(event) => handleSwitchProject(event.target.value)}
          >
            {(projects || []).map((project) => (
              <option key={project.slug} value={project.slug}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
        <div className="project-toolbar-right">
          <button
            className="small-button"
            onClick={() => {
              setProjectDialogOpen(false);
              setNoteDialogOpen(true);
            }}
            disabled={creatingNote}
          >
            <NotebookPen size={14} />
            New Note
          </button>
          <button
            className="small-button"
            onClick={() => {
              setNoteDialogOpen(false);
              setProjectDialogOpen(true);
            }}
            disabled={creatingProject}
          >
            <FolderPlus size={14} />
            Create Project
          </button>
        </div>
      </section>
      {!current ? (
        <>
          <header className="landing-header">
            <div>
              <p>{activeProject?.name || "Project"}</p>
              <h1>{activeProject?.name ? `${activeProject.name} Notes` : "Meeting Notes"}</h1>
            </div>
            <div className="landing-header-actions">
              <span>
                Markdown source files with quick notes, formal notes, Mermaid diagrams, and local
                versions.
              </span>
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
          </header>
          <DocumentList
            documents={documents}
            onOpen={openDocument}
            loading={loading}
            viewMode={notesViewMode}
          />
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
          onHome={() => setCurrent(null)}
          onNotify={notify}
        />
      )}

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

      {projectDialogOpen ? (
        <div className="overlay-dialog" role="dialog" aria-modal="true" aria-label="Create project">
          <div className="overlay-dialog-card">
            <div className="overlay-dialog-header">
              <h2>New Project</h2>
              <button
                className="icon-button"
                onClick={() => setProjectDialogOpen(false)}
                type="button"
                aria-label="Close new project dialog"
              >
                <X size={16} />
              </button>
            </div>
            <label className="overlay-dialog-field">
              <span>Project title</span>
              <input
                type="text"
                value={newProjectName}
                onChange={(event) => setNewProjectName(event.target.value)}
                placeholder="Enter project title"
                autoFocus
              />
            </label>
            <div className="overlay-dialog-actions">
              <button className="primary-button" onClick={handleCreateProject} disabled={creatingProject} type="button">
                <FolderPlus size={14} />
                {creatingProject ? "Creating..." : "Create Project"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
