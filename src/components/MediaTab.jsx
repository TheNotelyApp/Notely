import { useMemo } from "react";
import { extractImagesFromMarkdown } from "../utils/mediaUtils";
import "../styles/media.css";

export function MediaTab({ content }) {
  const images = useMemo(() => {
    return extractImagesFromMarkdown(content);
  }, [content]);

  if (images.length === 0) {
    return (
      <div className="media-empty">
        <p>No images found in this note.</p>
        <p className="muted">Insert images using the toolbar button or drag & drop.</p>
      </div>
    );
  }

  return (
    <div className="media-grid">
      {images.map((image) => (
        <div className="media-item" key={image.id}>
          <div className="media-preview">
            <img src={image.path} alt={image.altText} />
          </div>
          <div className="media-info">
            <p className="media-alt">{image.altText}</p>
            <p className="media-path" title={image.path}>{image.path}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
