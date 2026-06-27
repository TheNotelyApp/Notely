import { formatDate } from "../utils/dateUtils";
import { useEffect, useMemo, useState } from "react";
import { readImage } from "../services/electronService";

export function DocumentList({ documents, onOpen, loading, viewMode = "tile" }) {
  const [resolvedPreviewImages, setResolvedPreviewImages] = useState({});

  const previewRequests = useMemo(() => {
    return documents.flatMap((doc) => (doc.previewImages || []).slice(0, 4).map((image, index) => ({
      key: `${doc.filePath}:${index}:${image.sourceFilePath || doc.filePath}:${image.path}`,
      basePath: image.sourceFilePath || doc.filePath,
      path: image.path,
      name: image.name || image.path,
    })));
  }, [documents]);

  useEffect(() => {
    let cancelled = false;

    async function loadPreviewImages() {
      if (!previewRequests.length) {
        setResolvedPreviewImages({});
        return;
      }

      const entries = await Promise.all(previewRequests.map(async (request) => {
        try {
          const src = await readImage(request.basePath, request.path, { thumbnail: true });
          return [request.key, { src, name: request.name }];
        } catch {
          return [request.key, null];
        }
      }));

      if (!cancelled) {
        setResolvedPreviewImages(Object.fromEntries(entries.filter(([, value]) => value)));
      }
    }

    loadPreviewImages();

    return () => {
      cancelled = true;
    };
  }, [previewRequests]);

  if (loading) {
    return <div className="empty-state">Loading notes...</div>;
  }

  if (!documents.length) {
    return <div className="empty-state">No folders or markdown files found in this location.</div>;
  }

  if (viewMode === "table") {
    return (
      <div className="document-table-wrap">
        <table className="document-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Metadata</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr
                key={doc.filePath}
                onClick={() => onOpen(doc)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpen(doc);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={doc.entryType === "folder" ? `Open folder ${doc.title}` : `Open note ${doc.title}`}
              >
                <td>{doc.entryType === "folder" ? `/${doc.title}` : doc.title}</td>
                <td>{doc.entryType === "folder" ? "Folder" : "Markdown"}</td>
                <td>
                  {doc.entryType === "folder"
                    ? "-"
                    : ([doc.metadata?.time, doc.metadata?.location].filter(Boolean).join(" - ") ||
                      "No meeting metadata")}
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
        <button className="document-card" key={doc.filePath} onClick={() => onOpen(doc)}>
          {(doc.previewImages || []).length ? (
            <span className="document-thumb-strip" aria-hidden="true">
              {(doc.previewImages || []).slice(0, 4).map((image, index) => {
                const key = `${doc.filePath}:${index}:${image.sourceFilePath || doc.filePath}:${image.path}`;
                const resolved = resolvedPreviewImages[key];
                return resolved ? (
                  <img src={resolved.src} alt="" title={resolved.name} key={key} />
                ) : null;
              })}
            </span>
          ) : null}
          <span className="document-title">{doc.entryType === "folder" ? `/${doc.title}` : doc.title}</span>
          <span className="document-meta">
            {doc.entryType === "folder"
              ? "Folder"
              : ([doc.metadata?.time, doc.metadata?.location].filter(Boolean).join(" - ") ||
                "No meeting metadata")}
          </span>
          <span className="document-updated">Updated {formatDate(doc.updatedAt)}</span>
        </button>
      ))}
    </div>
  );
}
