import { useMemo, useEffect, useRef, useState } from "react";
import {
  renderMarkdown,
  parseDiagramBlocks,
  normalizeMarkdownImagePaths,
} from "../utils/renderUtils";
import { readImage, runExport } from "../services/electronService";
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

    const mediaElements = Array.from(container.querySelectorAll("img, video, audio"));
    for (const el of mediaElements) {
      const isImg = el instanceof HTMLImageElement;
      const rawSrc = el.getAttribute("data-asset-path") || el.getAttribute("data-video-src") || el.getAttribute("data-audio-src") || el.getAttribute("src") || "";
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

    // Handle media action buttons (copy, download)
    const imageAction = target.closest?.("[data-image-action]");
    if (imageAction instanceof HTMLButtonElement) {
      event.preventDefault();
      event.stopPropagation();
      const frame = imageAction.closest?.(".markdown-image-frame");
      const media = frame?.querySelector?.("img, audio, video");
      const assetPath = frame?.getAttribute?.("data-asset-path") || frame?.getAttribute?.("data-audio-src") || frame?.getAttribute?.("data-video-src") || media?.getAttribute?.("src") || "";
      if (imageAction.dataset.imageAction === "copy") {
        if (assetPath) {
          navigator.clipboard.writeText(assetPath);
        }
        return;
      }
      if (imageAction.dataset.imageAction === "download") {
        const altText = frame?.getAttribute?.("data-audio-title") || frame?.getAttribute?.("data-video-title") || media?.getAttribute?.("alt") || "media";
        const rawName = (assetPath || altText).split(/[?#]/)[0].split(/[/\\]/).pop() || "media";
        (async () => {
          try {
            let downloadSrc = assetPath;
            if (basePath && assetPath && !/^(https?:|data:|blob:)/i.test(assetPath)) {
              try { downloadSrc = (await readImage(basePath, assetPath)) || assetPath; } catch { /* ignore */ }
            }
            if (!downloadSrc && media) downloadSrc = media.src || "";
            let dataUrl;
            let srcPath;
            if (typeof downloadSrc === "string" && downloadSrc.startsWith("data:")) {
              dataUrl = downloadSrc;
            } else if (typeof downloadSrc === "string" && (downloadSrc.startsWith("http") || downloadSrc.startsWith("blob:"))) {
              const resp = await fetch(downloadSrc);
              const blob = await resp.blob();
              dataUrl = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
              });
            } else {
              srcPath = downloadSrc;
            }
            const ext = (rawName.split(".").pop() || "").toLowerCase();
            await runExport("media", { dataUrl, srcPath, filename: rawName, customExportType: ext, category: "media" });
          } catch (err) {
            console.error("Download failed in webview:", err);
          }
        })();
        return;
      }
    }

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
