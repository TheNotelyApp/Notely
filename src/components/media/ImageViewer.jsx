import { useState, useRef, useEffect } from "react";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import AppIconButton from "../AppIconButton";

export function ImageViewer({
  src,
  annotation,
  dimensions,
  fileSize,
  onError,
  onContextMenu,
}) {
  const [imageZoom, setImageZoom] = useState(1);
  const [imagePan, setImagePan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const containerRef = useRef(null);
  const imageRef = useRef(null);

  const handleZoomIn = () => setImageZoom((prev) => Math.min(prev + 0.25, 4));
  const handleZoomOut = () => setImageZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleZoomReset = () => {
    setImageZoom(1);
    setImagePan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e) => {
    if (imageZoom <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - imagePan.x, y: e.clientY - imagePan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !dragStart || imageZoom <= 1) return;
    setImagePan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
      setDragStart(null);
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, []);

  return (
    <div className="image-viewer-component">
      <div className="image-zoom-bar">
        <AppIconButton
          size="sm"
          onClick={handleZoomOut}
          disabled={imageZoom <= 0.5}
          data-tooltip="Zoom out"
          aria-label="Zoom out"
        >
          <ZoomOut size={14} />
        </AppIconButton>
        <span className="image-zoom-level">{Math.round(imageZoom * 100)}%</span>
        <AppIconButton
          size="sm"
          onClick={handleZoomIn}
          disabled={imageZoom >= 4}
          data-tooltip="Zoom in"
          aria-label="Zoom in"
        >
          <ZoomIn size={14} />
        </AppIconButton>
        <AppIconButton
          size="sm"
          onClick={handleZoomReset}
          data-tooltip="Reset zoom"
          aria-label="Reset zoom"
        >
          <Maximize2 size={14} />
        </AppIconButton>
      </div>

      <div
        className="media-preview-image-container"
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <div
          className="media-preview-image-frame"
          style={{
            transform: `translate(${imagePan.x}px, ${imagePan.y}px) scale(${imageZoom})`,
            transformOrigin: "center",
            cursor: imageZoom > 1 && isDragging ? "grabbing" : imageZoom > 1 ? "grab" : "default",
          }}
        >
          <img
            ref={imageRef}
            src={src}
            alt="Preview"
            onError={onError}
            onContextMenu={onContextMenu}
            draggable={false}
          />
          {annotation?.text && (
            <span className="media-preview-image-annotation">
              {annotation.text}
            </span>
          )}
        </div>
      </div>

      {dimensions && (
        <div className="image-info-bar">
          <span className="info-item">📐 {dimensions.width} × {dimensions.height}px</span>
          {fileSize && <span className="info-item">💾 {fileSize}</span>}
        </div>
      )}
    </div>
  );
}
