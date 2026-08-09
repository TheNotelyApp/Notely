import { useEffect, useState } from "react";
import { Download, Pencil } from "lucide-react";
import { readDrawioImage, readDrawioSource, writeDrawioSource } from "../services/drawioService";
import { runExport } from "../services/electronService";
import DrawioEditor from "./DrawioEditor";
import "../styles/ExcalidrawBlock.css"; // Reuse block styles

export function DrawioBlock({ imagePath, diagramId, onUpdate, onNotify, onForceSaveNote }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [thumbnail, setThumbnail] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [diagramData, setDiagramData] = useState("");

  useEffect(() => {
    if (!diagramId) return;

    let cancelled = false;
    const loadDiagram = async () => {
      try {
        setLoading(true);

        const source = await readDrawioSource(diagramId);
        if (!cancelled && source) {
          setDiagramData(source);
        }

        const imageDataUrl = await readDrawioImage(diagramId);
        if (!cancelled) {
          if (imageDataUrl) {
            setThumbnail(imageDataUrl);
          } else if (imagePath) {
            setThumbnail(imagePath);
          }
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load Draw.io diagram:", err);
          setError("Failed to load diagram");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadDiagram();
    return () => {
      cancelled = true;
    };
  }, [diagramId, imagePath]);

  const handleDownload = async () => {
    if (!thumbnail) return;
    try {
      const filename = `${diagramId || "drawio-diagram"}.png`;
      const result = await runExport("diagram_image", {
        dataUrl: thumbnail,
        filename,
        customExportType: "diagram_drawio",
        category: "diagram",
      });
      if (result?.success) {
        onNotify?.(`Diagram exported to ${result.filename}`, "success");
      } else {
        onNotify?.(result?.error || "Failed to export diagram.", "error");
      }
    } catch (err) {
      console.error("Failed to download diagram:", err);
      onNotify?.("Failed to export diagram.", "error");
    }
  };

  const handleSave = async (newDiagramXml, previewImageData) => {
    try {
      setLoading(true);
      
      const sourceSaved = await writeDrawioSource(diagramId, newDiagramXml);
      if (!sourceSaved) {
        throw new Error("Failed to persist diagram source");
      }

      if (previewImageData) {
        setThumbnail(previewImageData);
      }
      
      setDiagramData(newDiagramXml);
      onUpdate?.({
        diagramId,
        imagePath,
        data: newDiagramXml,
      });
      
      setError("");
      onNotify?.("Diagram saved successfully.", "success");
      onForceSaveNote?.();
    } catch (err) {
      console.error("Failed to save diagram:", err);
      setError("Failed to save diagram");
      onNotify?.("Failed to save diagram.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="excalidraw-block drawio-block"
      data-diagram-id={diagramId || ""}
      data-diagram-image-path={imagePath || ""}
    >
      <div
        className="excalidraw-preview-container"
        onClick={() => !loading && setIsModalOpen(true)}
        role="button"
        tabIndex={0}
        onKeyPress={(e) => {
          if (e.key === "Enter" && !loading) setIsModalOpen(true);
        }}
      >
        {loading && <div className="excalidraw-loading">Loading...</div>}
        
        {thumbnail && !loading ? (
          <div className="excalidraw-preview-thumbnail">
            <div className="markdown-block-actions">
              <button
                type="button"
                className="markdown-block-action-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsModalOpen(true);
                }}
                data-tooltip="Edit diagram"
                aria-label="Edit diagram"
              >
                <Pencil size={12} style={{ marginRight: "4px" }} />
                <span>Edit</span>
              </button>
              <span className="markdown-block-action-separator" />
              <button
                type="button"
                className="markdown-block-action-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDownload();
                }}
                data-tooltip="Download diagram as PNG"
                aria-label="Download diagram image"
              >
                <Download size={12} style={{ marginRight: "4px" }} />
                <span>Download</span>
              </button>
            </div>
            <img 
              src={thumbnail} 
              alt="Draw.io Diagram preview" 
              className="diagram-image"
              onError={() => setThumbnail(null)}
            />
          </div>
        ) : !loading ? (
          <div className="excalidraw-empty-state">
            <div className="empty-icon">📊</div>
            <span>Click to create a Draw.io diagram</span>
          </div>
        ) : null}
      </div>

      {error && <div className="excalidraw-error">{error}</div>}

      {isModalOpen && (
        <DrawioEditor
          initialData={diagramData}
          diagramId={diagramId}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
export default DrawioBlock;
