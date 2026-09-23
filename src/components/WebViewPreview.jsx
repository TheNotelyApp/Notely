import { useMemo } from "react";
import {
  renderMarkdown,
  parseDiagramBlocks,
  normalizeMarkdownImagePaths,
} from "../utils/renderUtils";
import { MermaidBlock } from "./MermaidBlock";
import { ExcalidrawBlock } from "./ExcalidrawBlock";
import { DrawioBlock } from "./DrawioBlock";
import { WireframeBlock } from "./WireframeBlock";

export function WebViewPreview({ content, basePath }) {
  const parts = useMemo(() => parseDiagramBlocks(content), [content]);

  const handlePageClick = async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const copyButton = target.closest('[data-code-copy="true"]');
    if (!(copyButton instanceof HTMLButtonElement)) return;

    event.preventDefault();
    event.stopPropagation();

    const rawCode = decodeURIComponent(copyButton.getAttribute("data-code-raw") || "");
    try {
      await navigator.clipboard.writeText(rawCode);
      copyButton.dataset.copyState = "copied";
      copyButton.title = "Copied";
      window.setTimeout(() => {
        copyButton.dataset.copyState = "";
        copyButton.title = "Copy code";
      }, 900);
    } catch {
      copyButton.dataset.copyState = "failed";
      copyButton.title = "Copy failed";
      window.setTimeout(() => {
        copyButton.dataset.copyState = "";
        copyButton.title = "Copy code";
      }, 900);
    }
  };

  return (
    <div className="webview-shell">
      <div className="webview-browser-bar">
        <span className="dot red" />
        <span className="dot amber" />
        <span className="dot green" />
        <div className="address-pill">https://notely.local/note</div>
      </div>
      <article className="webview-page" onClick={handlePageClick}>
        {parts.map((part, index) =>
          part.type === "mermaid" ? (
            <MermaidBlock code={part.value} index={index} key={`${part.type}-${index}`} />
          ) : part.type === "excalidraw" ? (
            <ExcalidrawBlock
              imagePath={part.imagePath}
              diagramId={part.diagramId}
              docSlug={basePath ? basePath.split(/[/\\]/).pop()?.replace(".md", "") || "document" : "document"}
              documentPath={basePath ? basePath.split(/[/\\]/).slice(0, -1).join("/") : ""}
              index={index}
              key={`${part.type}-${index}`}
            />
          ) : part.type === "drawio" ? (
            <DrawioBlock
              imagePath={part.imagePath}
              diagramId={part.diagramId}
              documentPath={basePath}
              key={`${part.type}-${index}`}
            />
          ) : part.type === "wireframe" ? (
            <WireframeBlock
              imagePath={part.imagePath}
              diagramId={part.diagramId}
              documentPath={basePath}
              key={`${part.type}-${index}`}
            />
          ) : (
            <div
              key={`${part.type}-${index}`}
              dangerouslySetInnerHTML={{
                __html: renderMarkdown(normalizeMarkdownImagePaths(part.value), {
                  sourceLineOffset: part.startLine || 0,
                }),
              }}
            />
          )
        )}
      </article>
    </div>
  );
}
