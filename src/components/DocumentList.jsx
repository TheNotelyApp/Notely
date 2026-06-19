import { formatDate } from "../utils/dateUtils";

export function DocumentList({ documents, onOpen, loading }) {
  if (loading) {
    return <div className="empty-state">Loading notes...</div>;
  }

  if (!documents.length) {
    return <div className="empty-state">No markdown files found in this folder.</div>;
  }

  return (
    <div className="document-grid">
      {documents.map((doc) => (
        <button className="document-card" key={doc.filePath} onClick={() => onOpen(doc.filePath)}>
          <span className="document-title">{doc.title}</span>
          <span className="document-meta">
            {[doc.metadata?.time, doc.metadata?.location].filter(Boolean).join(" · ") ||
              "No meeting metadata"}
          </span>
          <span className="document-updated">Updated {formatDate(doc.updatedAt)}</span>
        </button>
      ))}
    </div>
  );
}
