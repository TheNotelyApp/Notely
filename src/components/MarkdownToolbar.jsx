import { useRef } from "react";
import {
  Heading2,
  Bold,
  Italic,
  List,
  Quote,
  Code,
  ImagePlus,
  Zap,
} from "lucide-react";
import { applySnippet, createImageMarkdown, insertTextAtCursor } from "../utils/markdownUtils";
import { insertImageFromFile } from "../services/imageService";

export function MarkdownToolbar({ value, onChange, textareaRef }) {
  const imageInputRef = useRef(null);

  const handleImageSelect = async (event) => {
    console.log("Image file selected:", event.target.files);
    const file = event.target.files?.[0];
    if (!file) {
      console.warn("No file selected");
      return;
    }

    try {
      const { imagePath, altText } = await insertImageFromFile(file);
      const markdown = createImageMarkdown(altText, imagePath);
      console.log("Inserting markdown:", markdown);
      insertTextAtCursor(value, onChange, markdown, textareaRef);
    } catch (error) {
      console.error("Image insertion failed:", error);
      alert("Failed to insert image: " + error.message);
    } finally {
      event.target.value = "";
    }
  };

  const snippets = [
    { key: "heading", icon: Heading2, title: "Heading", before: "## ", after: "", placeholder: "Heading" },
    { key: "bold", icon: Bold, title: "Bold", before: "**", after: "**", placeholder: "bold text" },
    { key: "italic", icon: Italic, title: "Italic", before: "_", after: "_", placeholder: "italic text" },
    { key: "list", icon: List, title: "List", before: "- ", after: "", placeholder: "list item" },
    { key: "quote", icon: Quote, title: "Quote", before: "> ", after: "", placeholder: "quote" },
    { key: "code", icon: Code, title: "Code", before: "`", after: "`", placeholder: "code" },
  ];

  return (
    <div className="editor-toolbar" aria-label="Markdown formatting toolbar">
      {snippets.map((snippet) => (
        <button
          key={snippet.key}
          onClick={() =>
            applySnippet(value, onChange, textareaRef, snippet.before, snippet.after, snippet.placeholder)
          }
          title={snippet.title}
        >
          <snippet.icon size={18} />
        </button>
      ))}
      <button onClick={() => imageInputRef.current?.click()} title="Insert image">
        <ImagePlus size={18} />
      </button>
      <button
        onClick={() =>
          applySnippet(
            value,
            onChange,
            textareaRef,
            "```mermaid\n",
            "\n```",
            "flowchart LR\n  A[Start] --> B[End]"
          )
        }
        title="Mermaid"
      >
        <Zap size={18} />
      </button>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageSelect}
        hidden
      />
    </div>
  );
}
