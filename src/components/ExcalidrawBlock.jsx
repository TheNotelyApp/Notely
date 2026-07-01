import { useEffect, useState } from "react";
import { readDiagramImage, readDiagramSource, writeDiagramSource } from "../services/diagramService";
import ExcalidrawComponent from "./ExcalidrawEditor";
import "./ExcalidrawBlock.css";

export function ExcalidrawBlock({ imagePath, diagramId, docSlug, documentPath, onUpdate }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [thumbnail, setThumbnail] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [diagramData, setDiagramData] = useState(null);

  // Load diagram source and image on mount
  useEffect(() => {
    loadDiagram();
  }, [diagramId, documentPath]);

  const loadDiagram = async () => {
    if (!diagramId || !documentPath) return;
    
    try {
      setLoading(true);
      
      // Try to load the source file
      const source = await readDiagramSource(documentPath, diagramId);
      if (source) {
        setDiagramData(source);
      }

      const imageDataUrl = await readDiagramImage(documentPath, diagramId);
      if (imageDataUrl) {
        setThumbnail(imageDataUrl);
      } else if (imagePath) {
        // fallback for legacy references
        setThumbnail(imagePath);
      }
      
      setError("");
    } catch (err) {
      console.error("Failed to load diagram:", err);
      setError("Failed to load diagram");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (newDiagramData, previewImageData) => {
    try {
      setLoading(true);
      
      // Save source file
      const sourceSaved = await writeDiagramSource(documentPath, diagramId, newDiagramData);
      if (!sourceSaved) {
        throw new Error("Failed to persist diagram source");
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
      setIsModalOpen(false);
    } catch (err) {
      console.error("Failed to save diagram:", err);
      setError("Failed to save diagram");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="excalidraw-block"
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
            <img 
              src={thumbnail} 
              alt="Diagram preview" 
              className="diagram-image"
              onError={() => setThumbnail(null)}
            />
            <span className="click-hint">(Click to edit)</span>
          </div>
        ) : !loading ? (
          <div className="excalidraw-empty-state">
            <div className="empty-icon">📐</div>
            <span>Click to create a diagram</span>
          </div>
        ) : null}
      </div>

      {error && <div className="excalidraw-error">{error}</div>}

      {isModalOpen && (
        <ExcalidrawComponent
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
