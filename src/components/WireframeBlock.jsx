import { useEffect, useState } from "react";
import { Download, Pencil } from "lucide-react";
import { readWireframeImage, readWireframeSource, writeWireframeSource } from "../services/wireframeService";
import { runExport } from "../services/electronService";
import WireframeEditor from "./WireframeEditor";
import "../styles/ExcalidrawBlock.css"; // Reuse block styles

export function WireframeBlock({ imagePath, diagramId, documentPath, onUpdate, onNotify, onForceSaveNote }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [thumbnail, setThumbnail] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [diagramData, setDiagramData] = useState(null);

  useEffect(() => {
    if (!diagramId) return;

    let cancelled = false;
    const loadWireframe = async () => {
      try {
        setLoading(true);

        const source = await readWireframeSource(diagramId, documentPath);
        if (!cancelled && source) {
          setDiagramData(source);
        }

        const imageDataUrl = await readWireframeImage(diagramId, documentPath);
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
          console.error("Failed to load Wireframe:", err);
          setError("Failed to load wireframe");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadWireframe();
    return () => {
      cancelled = true;
    };
  }, [diagramId, documentPath, imagePath]);

  const handleDownload = async () => {
    if (!thumbnail) return;
    try {
      const filename = `${diagramId || "wireframe-diagram"}.png`;
      const result = await runExport("diagram_image", {
        dataUrl: thumbnail,
        filename,
        customExportType: "diagram_wireframe",
        category: "diagram",
      });
      if (result?.success) {
        onNotify?.(`Wireframe exported to ${result.filename}`, "success");
      } else {
        onNotify?.(result?.error || "Failed to export wireframe.", "error");
      }
    } catch (err) {
      console.error("Failed to download wireframe:", err);
      onNotify?.("Failed to export wireframe.", "error");
    }
  };

  const handleSave = async (newDiagramData, previewImageData) => {
    try {
      setLoading(true);
      
      const sourceSaved = await writeWireframeSource(diagramId, newDiagramData, documentPath);
      if (!sourceSaved) {
        throw new Error("Failed to persist wireframe source");
      }

      if (previewImageData) {
        setThumbnail(previewImageData);
      }
      
      setDiagramData(newDiagramData);
      onUpdate?.({
        diagramId,
        imagePath,
        data: newDiagramData,
      });
      
      setError("");
      onNotify?.("Wireframe saved successfully.", "success");
      onForceSaveNote?.();
    } catch (err) {
      console.error("Failed to save wireframe:", err);
      setError("Failed to save wireframe");
      onNotify?.("Failed to save wireframe.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="excalidraw-block wireframe-block"
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
                data-tooltip="Edit wireframe"
                aria-label="Edit wireframe"
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
                data-tooltip="Download wireframe as PNG"
                aria-label="Download wireframe image"
              >
                <Download size={12} style={{ marginRight: "4px" }} />
                <span>Download</span>
              </button>
            </div>
            <img 
              src={thumbnail} 
              alt="Wireframe preview" 
              className="diagram-image"
              onError={() => setThumbnail(null)}
            />
          </div>
        ) : !loading ? (
          <div className="excalidraw-empty-state">
            <div className="empty-icon">📐</div>
            <span>Click to create a Wireframe</span>
          </div>
        ) : null}
      </div>

      {error && <div className="excalidraw-error">{error}</div>}

      {isModalOpen && (
        <WireframeEditor
          initialData={diagramData}
          diagramId={diagramId}
          documentPath={documentPath}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

export default WireframeBlock;
