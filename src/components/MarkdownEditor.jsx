import { createImageMarkdown, insertTextAtCursor } from "../utils/markdownUtils";
import { insertImagesFromFiles } from "../services/imageService";

export function MarkdownEditor({ value, onChange, textareaRef }) {
  const handleDragOver = (event) => {
    if (event.dataTransfer?.types?.includes("Files")) {
      event.preventDefault();
    }
  };

  const handleDrop = async (event) => {
    const files = event.dataTransfer?.files || [];
    if (!files.length) return;

    event.preventDefault();

    try {
      const results = await insertImagesFromFiles(files);
      const markdownImages = results.map((result) =>
        createImageMarkdown(result.altText, result.imagePath)
      );
      insertTextAtCursor(value, onChange, `${markdownImages.join("\n\n")}\n`, textareaRef);
    } catch (error) {
      console.error("Image drop insertion failed:", error);
      alert("Failed to insert images: " + error.message);
    }
  };

  return (
    <div className="markdown-editor">
      <textarea
        ref={textareaRef}
        className="markdown-textarea"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        spellCheck
      />
    </div>
  );
}
