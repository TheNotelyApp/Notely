import { useMemo } from "react";
import { renderMarkdown, parseMermaidBlocks } from "../utils/renderUtils";
import { MermaidBlock } from "./MermaidBlock";

export function MarkdownPreview({ content }) {
  const parts = useMemo(() => {
    return parseMermaidBlocks(content);
  }, [content]);

  return (
    <div className="preview">
      {parts.map((part, index) =>
        part.type === "mermaid" ? (
          <MermaidBlock code={part.value} index={index} key={`${part.type}-${index}`} />
        ) : (
          <div
            key={`${part.type}-${index}`}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(part.value) }}
          />
        )
      )}
    </div>
  );
}
