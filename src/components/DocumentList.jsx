import { formatDate } from "../utils/dateUtils";

export function DocumentList({ documents, onOpen, loading, viewMode = "tile" }) {
  if (loading) {
    return <div className="empty-state">Loading notes...</div>;
  }

  if (!documents.length) {
    return <div className="empty-state">No markdown files found in this project.</div>;
  }

  if (viewMode === "table") {
    return (
      <div className="document-table-wrap">
        <table className="document-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Metadata</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.filePath} onClick={() => onOpen(doc.filePath)}>
                <td>{doc.title}</td>
                <td>
                  {[doc.metadata?.time, doc.metadata?.location].filter(Boolean).join(" - ") ||
                    "No meeting metadata"}
                </td>
                <td>{formatDate(doc.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="document-grid">
      {documents.map((doc) => (
        <button className="document-card" key={doc.filePath} onClick={() => onOpen(doc.filePath)}>
          <span className="document-title">{doc.title}</span>
          <span className="document-meta">
            {[doc.metadata?.time, doc.metadata?.location].filter(Boolean).join(" - ") ||
              "No meeting metadata"}
          </span>
          <span className="document-updated">Updated {formatDate(doc.updatedAt)}</span>
        </button>
      ))}
    </div>
  );
}
