import { useMemo, useEffect, useRef, useState } from "react";
import {
  renderMarkdown,
  parseDiagramBlocks,
  normalizeMarkdownImagePaths,
} from "../utils/renderUtils";
import { readImage } from "../services/electronService";
import { MermaidBlock } from "./MermaidBlock";
import { ExcalidrawBlock } from "./ExcalidrawBlock";
import { DrawioBlock } from "./DrawioBlock";
import { WireframeBlock } from "./WireframeBlock";
import { VideoPlayerModal } from "./VideoPlayerModal";

export function WebViewPreview({ content, basePath }) {
  const parts = useMemo(() => parseDiagramBlocks(content), [content]);
  const pageRef = useRef(null);
  const [activeVideo, setActiveVideo] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const container = pageRef.current;
    if (!container || !basePath) return undefined;

    const mediaElements = Array.from(container.querySelectorAll("img, video"));
    for (const el of mediaElements) {
      const isImg = el instanceof HTMLImageElement;
      const rawSrc = el.getAttribute("data-asset-path") || el.getAttribute("data-video-src") || el.getAttribute("src") || "";
      if (!rawSrc || /^(data:|blob:|https?:)/i.test(rawSrc)) continue;

      const cleanPath = rawSrc.split(/[?#]/)[0];
      readImage(basePath, cleanPath, { thumbnail: false })
        .then((resolved) => {
          if (!cancelled && resolved) {
            el.src = resolved;
            if (!isImg && el instanceof HTMLVideoElement) {
              el.onloadeddata = () => {
                try {
                  if (el.currentTime === 0) el.currentTime = 0.1;
                } catch {
                  // Ignore seek error
                }
              };
            }
          }
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [parts, basePath]);

  const handlePageClick = async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    // Handle video card click
    const videoCard = target.closest(".markdown-video-card");
    if (videoCard) {
      event.preventDefault();
      event.stopPropagation();
      const videoEl = videoCard.querySelector("video");
      const videoSrc = videoEl?.src || videoCard.getAttribute("data-video-src") || "";
      const videoTitle = videoCard.getAttribute("data-video-title") || "Screen Recording";
      if (videoSrc) {
        setActiveVideo({ src: videoSrc, title: videoTitle });
      }
      return;
    }

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
      <article className="webview-page" ref={pageRef} onClick={handlePageClick}>
        {parts.map((part, index) =>
          part.type === "mermaid" ? (
            <MermaidBlock code={part.value} index={index} key={`${part.type}-${index}`} />
          ) : part.type === "excalidraw" ? (
            <ExcalidrawBlock
              imagePath={part.imagePath}
              diagramId={part.diagramId}
              originAssetPath={part.originAssetPath}
              originAltText={part.originAltText}
              documentPath={basePath}
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

      {activeVideo ? (
        <VideoPlayerModal
          open={Boolean(activeVideo)}
          src={activeVideo.src}
          title={activeVideo.title}
          onClose={() => setActiveVideo(null)}
        />
      ) : null}
    </div>
  );
}
