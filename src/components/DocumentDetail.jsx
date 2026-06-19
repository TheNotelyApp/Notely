import { useRef, useState } from "react";
import {
  Home,
  Save,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  FileText,
  FilePenLine,
  PenLine,
  SplitSquareHorizontal,
  Eye,
  Clock,
  MapPin,
  User,
  Images,
  GitCompare,
  Trash2,
  X,
} from "lucide-react";
import { EditorPane } from "./EditorPane";
import { MediaTab } from "./MediaTab";
import { formatDate } from "../utils/dateUtils";
import { openInEditor } from "../services/electronService";
import { deleteVersion, readVersion } from "../services/electronService";

function buildDiffRows(latest, previous) {
  const latestLines = (latest || "").replace(/\r\n/g, "\n").split("\n");
  const previousLines = (previous || "").replace(/\r\n/g, "\n").split("\n");
  const max = Math.max(latestLines.length, previousLines.length);
  const rows = [];

  for (let index = 0; index < max; index += 1) {
    const latestLine = latestLines[index] ?? "";
    const previousLine = previousLines[index] ?? "";
    let status = "same";
    if (index >= previousLines.length) status = "added";
    else if (index >= latestLines.length) status = "removed";
    else if (latestLine !== previousLine) status = "changed";

    rows.push({ line: index + 1, latestLine, previousLine, status });
  }

  return rows;
}

export function DocumentDetail({
  document,
  history,
  activeTab,
  setActiveTab,
  mode,
  setMode,
  onChange,
  onSave,
  onRefreshHistory,
  saving,
  dirty,
  onHome,
  onNotify,
}) {
  const textareaRef = useRef(null);
  const [isHistoryPanelCollapsed, setIsHistoryPanelCollapsed] = useState(false);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareMeta, setCompareMeta] = useState(null);
  const [diffRows, setDiffRows] = useState([]);
  const content = activeTab === "raw" ? document.rawNotes : document.cleansed;
  const mediaContent = `${document.rawNotes || ""}\n\n${document.cleansed || ""}`.trim();

  const updateContent = (value) => {
    onChange({
      ...document,
      [activeTab === "raw" ? "rawNotes" : "cleansed"]: value,
    });
  };

  const handleOpenLatestFile = async () => {
    try {
      const result = await openInEditor(document.filePath);
      if (result?.openedWith === "default") {
        onNotify?.("VS Code not available. Opened with system default app.", "info");
      } else {
        onNotify?.("Opened latest note file in VS Code.", "success");
      }
    } catch (error) {
      onNotify?.(error?.message || "Unable to open file in editor.", "error");
    }
  };

  const handleCompareVersion = async (entry) => {
    setCompareLoading(true);
    setCompareModalOpen(true);
    setCompareMeta(entry);
    setDiffRows([]);

    try {
      const latest = [
        (document.header || "").trim(),
        "# RawNotes",
        (document.rawNotes || "").trim(),
        "",
        "# Cleansed",
        (document.cleansed || "").trim(),
      ].join("\n");

      const previous = await readVersion(document.filePath, entry.versionPath);
      const rows = buildDiffRows(latest, previous);
      setDiffRows(rows);
    } catch (error) {
      onNotify?.(error?.message || "Unable to load version diff.", "error");
      setCompareModalOpen(false);
    } finally {
      setCompareLoading(false);
    }
  };

  const handleDeleteVersion = async (entry) => {
    const confirmed = window.confirm("Delete this older version? This cannot be undone.");
    if (!confirmed) return;

    try {
      await deleteVersion(document.filePath, entry.versionPath);
      await onRefreshHistory();
      onNotify?.("Older version deleted.", "success");
    } catch (error) {
      onNotify?.(error?.message || "Unable to delete version.", "error");
    }
  };

  return (
    <div className="detail-shell">
      <div className="detail-topbar">
        <button className="back-button" onClick={onHome} title="Back to home">
          <Home size={18} />
        </button>
        <div className="crumb">Notes / {document.title}</div>
        <div className="save-status">{dirty ? "Unsaved changes" : "Saved"}</div>
        <button className="text-button" onClick={handleOpenLatestFile} title="Open latest file">
          <FolderOpen size={18} />
          Open
        </button>
        <button
          className="primary-button"
          onClick={onSave}
          disabled={saving || !dirty}
          title="Save document"
        >
          <Save size={18} />
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      <header className="doc-header">
        <div>
          <h1>{document.title}</h1>
          <p>{document.fileName}</p>
        </div>
        <div className="metadata-grid">
          <div>
            <User size={16} />
            <span>Name</span>
            <strong>{document.metadata?.name || "Not captured"}</strong>
          </div>
          <div>
            <Clock size={16} />
            <span>Time</span>
            <strong>{document.metadata?.time || "Not captured"}</strong>
          </div>
          <div>
            <MapPin size={16} />
            <span>Location</span>
            <strong>{document.metadata?.location || "Not captured"}</strong>
          </div>
        </div>
      </header>

      <div className={`workspace ${isHistoryPanelCollapsed ? "history-panel-collapsed" : ""}`}>
        <aside className={`history-panel ${isHistoryPanelCollapsed ? "collapsed" : ""}`}>
          {isHistoryPanelCollapsed ? (
            <div className="history-collapsed-actions">
              <button
                className="small-button"
                onClick={() => setIsHistoryPanelCollapsed(false)}
                title="Expand versions panel"
                aria-expanded="false"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          ) : (
            <>
              <div className="panel-title-row">
                <h2>Versions</h2>
                <div className="panel-actions">
                  <button className="small-button" onClick={onRefreshHistory} title="Refresh history">
                    <RotateCcw size={16} />
                  </button>
                  <button
                    className="small-button"
                    onClick={() => setIsHistoryPanelCollapsed(true)}
                    title="Collapse versions panel"
                    aria-expanded="true"
                  >
                    <ChevronLeft size={16} />
                  </button>
                </div>
              </div>
              {history.length ? (
                <div className="history-list">
                  {history.map((entry) => (
                    <div className="history-item" key={entry.versionPath}>
                      <strong>{formatDate(entry.createdAt)}</strong>
                      <span>{entry.reason}</span>
                      <div className="history-item-actions">
                        <button
                          className="small-button"
                          onClick={() => handleCompareVersion(entry)}
                          title="Compare with latest"
                        >
                          <GitCompare size={14} />
                          Compare
                        </button>
                        <button
                          className="small-button"
                          onClick={() => handleDeleteVersion(entry)}
                          title="Delete this version"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">Versions appear after the first save.</p>
              )}
            </>
          )}
        </aside>

        <main className="editor-panel">
          <div className="tab-row">
            <div className="tabs">
              <button
                className={activeTab === "raw" ? "active" : ""}
                onClick={() => setActiveTab("raw")}
                title="Quick notes"
              >
                <FilePenLine size={16} />
                <span>Quick Notes</span>
              </button>
              <button
                className={activeTab === "cleansed" ? "active" : ""}
                onClick={() => setActiveTab("cleansed")}
                title="Formal notes"
              >
                <FileText size={16} />
                <span>Formal Notes</span>
              </button>
              <button
                className={activeTab === "media" ? "active" : ""}
                onClick={() => setActiveTab("media")}
                title="Media and images"
              >
                <Images size={16} />
                <span>Media</span>
              </button>
            </div>
            <div className="mode-switch">
              {[
                { key: "edit", label: "Edit", icon: PenLine },
                { key: "split", label: "Split", icon: SplitSquareHorizontal },
                { key: "preview", label: "Preview", icon: Eye },
              ].map((item) => (
                <button
                  className={mode === item.key ? "active" : ""}
                  key={item.key}
                  onClick={() => setMode(item.key)}
                >
                  <item.icon size={16} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {activeTab === "media" ? (
            <MediaTab content={mediaContent} basePath={document.filePath} onNotify={onNotify} />
          ) : (
            <EditorPane
              value={content}
              onChange={updateContent}
              mode={mode}
              textareaRef={textareaRef}
              basePath={document.filePath}
              showToolbar={activeTab !== "media"}
              onNotify={onNotify}
            />
          )}
        </main>
      </div>

      {compareModalOpen ? (
        <div className="diff-modal-overlay" role="dialog" aria-label="Version diff">
          <div className="diff-modal">
            <div className="diff-modal-header">
              <strong>
                Compare Latest with {compareMeta?.createdAt ? formatDate(compareMeta.createdAt) : "Version"}
              </strong>
              <button className="small-button" onClick={() => setCompareModalOpen(false)} title="Close diff">
                <X size={14} />
              </button>
            </div>

            {compareLoading ? (
              <p className="muted">Loading diff...</p>
            ) : (
              <div className="diff-table">
                <div className="diff-table-head">
                  <span>Line</span>
                  <span>Latest</span>
                  <span>Selected Version</span>
                </div>
                <div className="diff-table-body">
                  {diffRows.map((row) => (
                    <div className={`diff-row ${row.status}`} key={`diff-${row.line}`}>
                      <span>{row.line}</span>
                      <pre>{row.latestLine || " "}</pre>
                      <pre>{row.previousLine || " "}</pre>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
