import { useEffect, useMemo, useRef, useState, memo } from "react";
import { Search, Copy, ExternalLink, Pencil, RefreshCw, Trash2, RotateCcw } from "lucide-react";
import {
  renderMarkdown,
  parseDiagramBlocks,
  normalizeMarkdownImagePaths,
} from "../utils/renderUtils";
import { readMarkdownSource, openFolder, openMediaInDefaultApp, runExport } from "../services/electronService";
import { readImage, replaceImage, deleteImage, renameImage, getImageAnnotation, setImageAnnotation, getImageOriginalStatus, restoreImageOriginal } from "../services/electronService";
import { readFileAsDataUrl } from "../utils/mediaTypeUtils";
import { createImageMarkdown, normalizeImagePathForMarkdown } from "../utils/markdownUtils";
import { createDiagramMarkdown, generateDiagramId } from "../utils/diagramFileUtils";
import { writeDiagramSource, writeDiagramImage } from "../services/diagramService";
import { getMediaTypeFromExtension } from "../utils/mediaUtils";
import { tableElementToPngDataUrl } from "../utils/exportUtils";
import { tableElementToCsv } from "../utils/tableUtils";
import { formatImageDeleteResult } from "../utils/imageDeleteResult";
import { removeImageReferenceFromMarkdown, toComparableAssetPath, replaceFirstImageReferenceWithDiagram } from "../utils/imageMarkdownReferences";
import useConfirm from "../hooks/useConfirm";
import { MermaidBlock } from "./MermaidBlock";
import { ExcalidrawBlock } from "./ExcalidrawBlock";
import { DrawioBlock } from "./DrawioBlock";
import { PreviewModalsContainer } from "./preview/PreviewModalsContainer";

function replaceAllLiteral(source, needle, replacement) {
  if (!needle || needle === replacement) return source;
  return String(source || "").split(needle).join(replacement);
}

function imageCacheKey(assetPath, variant = "thumbnail") {
  return `${variant}:${assetPath}`;
}

function getImageActionElement(target) {
  if (!(target instanceof HTMLElement)) return null;
  if (target.closest?.(".excalidraw-block")) return null;
  if (target.tagName === "IMG") return target;
  const frame = target.closest?.(".markdown-image-frame");
  const framedImage = frame?.querySelector?.("img");
  return framedImage instanceof HTMLImageElement ? framedImage : null;
}

function getExcalidrawActionContext(target) {
  if (!(target instanceof HTMLElement)) return null;
  const block = target.closest?.(".excalidraw-block");
  if (!block) return null;

  const preview = block.querySelector?.(".excalidraw-preview-container");
  if (!(preview instanceof HTMLElement)) return null;

  const image = block.querySelector?.(".diagram-image");
  const bounds = preview.getBoundingClientRect();
  return {
    block,
    preview,
    image: image instanceof HTMLImageElement ? image : null,
    bounds,
    diagramId: block.getAttribute("data-diagram-id") || "",
    imagePath: block.getAttribute("data-diagram-image-path") || "",
    originAssetPath: block.getAttribute("data-origin-asset-path") || "",
    originAltText: block.getAttribute("data-origin-alt-text") || "",
  };
}

function sanitizeAttributeValue(value) {
  return String(value || "").replace(/"/g, "&quot;");
}

function replaceDiagramReferenceWithOriginal(content, options = {}) {
  const source = String(content || "");
  const {
    diagramId,
    diagramImagePath,
    originAssetPath,
    originAltText,
  } = options;

  const comparableDiagramPath = toComparableAssetPath(diagramImagePath);
  const replacementMarkdown = createImageMarkdown(originAltText || "Image", originAssetPath || "");
  const diagramRegex = /!\[Excalidraw Diagram\]\(((?:\.notes-app\/)?excali-diagrams\/(?:(?:[^/]+\/)?([^/]+))\/diagram\.png)\)\s*(\{[^}]*\})?/gi;
  let replaced = false;

  const nextContent = source.replace(diagramRegex, (match, imagePath, fallbackDiagramId, attributeBlock) => {
    if (replaced) return match;
    const explicitIdMatch = String(attributeBlock || "").match(/data-diagram-id=["“]([^"”]+)["”]/i);
    const currentDiagramId = String(explicitIdMatch?.[1] || fallbackDiagramId || "").trim();
    const currentComparablePath = toComparableAssetPath(imagePath);
    const idMatch = diagramId && currentDiagramId && diagramId === currentDiagramId;
    const pathMatch = comparableDiagramPath && comparableDiagramPath === currentComparablePath;
    if (!idMatch && !pathMatch) return match;
    replaced = true;
    return replacementMarkdown;
  });

  return { nextContent, replaced };
}

function replaceCodeBlockAtLine(source, targetLine, newLanguage, newCode) {
  const lines = String(source || "").split("\n");
  const startIdx = targetLine - 1; // 0-indexed

  if (startIdx < 0 || startIdx >= lines.length || !lines[startIdx].startsWith("```")) {
    return null;
  }

  let endIdx = -1;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].trim() === "```") {
      endIdx = i;
      break;
    }
  }

  if (endIdx === -1) return null;

  const before = lines.slice(0, startIdx);
  const after = lines.slice(endIdx + 1);
  const newBlock = `\`\`\`${newLanguage}\n${newCode}\n\`\`\``;

  return [...before, newBlock, ...after].join("\n");
}

function inferDataUrlMimeType(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,/i);
  return String(match?.[1] || "image/png").toLowerCase();
}

function measureDataUrlImage(dataUrl) {
  return new Promise((resolve) => {
    const image = new Image();
    let settled = false;
    const finish = (dimensions) => {
      if (settled) return;
      settled = true;
      resolve(dimensions);
    };

    image.onload = () => {
      finish({
        width: Number(image.naturalWidth || image.width || 1280),
        height: Number(image.naturalHeight || image.height || 720),
      });
    };
    image.onerror = () => {
      finish({ width: 1280, height: 720 });
    };
    image.src = dataUrl;
    setTimeout(() => {
      finish({ width: 1280, height: 720 });
    }, 0);
  });
}

function createExcalidrawSeed() {
  return Math.floor(Math.random() * 2147483647);
}

function buildExcalidrawInitialDataFromImage(imageDataUrl, dimensions = {}, imageLabel = "Image") {
  const fileId = `file-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const elementId = `el-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const width = Math.max(1, Math.round(Number(dimensions.width) || 1280));
  const height = Math.max(1, Math.round(Number(dimensions.height) || 720));
  const now = Date.now();

  return {
    elements: [
      {
        id: elementId,
        type: "image",
        x: 0,
        y: 0,
        width,
        height,
        angle: 0,
        strokeColor: "transparent",
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: 1,
        strokeStyle: "solid",
        roughness: 0,
        opacity: 100,
        groupIds: [],
        roundness: null,
        seed: createExcalidrawSeed(),
        version: 1,
        versionNonce: createExcalidrawSeed(),
        isDeleted: false,
        boundElements: null,
        updated: now,
        link: null,
        locked: false,
        status: "saved",
        fileId,
        scale: [1, 1],
        crop: null,
      },
    ],
    appState: {
      viewBackgroundColor: "#ffffff",
      selectedElementIds: {
        [elementId]: true,
      },
    },
    files: {
      [fileId]: {
        id: fileId,
        dataURL: imageDataUrl,
        mimeType: inferDataUrlMimeType(imageDataUrl),
        created: now,
        lastRetrieved: now,
        size: 0,
        name: imageLabel || "Image",
      },
    },
  };
}

function resolveDocumentPathFromBase(basePath) {
  if (!basePath) return ".";
  const parts = String(basePath).split(/[\\/]/);
  if (parts.length <= 1) return ".";
  return parts.slice(0, -1).join("/") || ".";
}

function applyImageAnnotation(image, annotation) {
  const frame = image?.closest?.(".markdown-image-frame");
  if (!frame) return;
  frame.querySelector(".markdown-image-annotation")?.remove();
  const text = String(annotation?.text || "").trim();
  if (!text) return;

  const overlay = document.createElement("span");
  overlay.className = "markdown-image-annotation";
  overlay.textContent = text;
  frame.appendChild(overlay);
}

function applyImageOriginalBadge(image, hasOriginal) {
  const frame = image?.closest?.(".markdown-image-frame");
  if (!frame) return;
  frame.querySelector(".markdown-image-original-badge")?.remove();
  if (!hasOriginal) return;

  const badge = document.createElement("span");
  badge.className = "markdown-image-original-badge";
  badge.textContent = "Original saved";
  frame.appendChild(badge);
}

function getImagePath(imageElement) {
  return imageElement?.getAttribute("data-asset-path") || imageElement?.getAttribute("src") || "";
}

function normalizePathSeparators(value) {
  return String(value || "").replace(/\\/g, "/");
}

function normalizeAbsolutePath(pathValue) {
  const normalized = normalizePathSeparators(pathValue).trim();
  if (!normalized) return "";

  const driveMatch = normalized.match(/^([A-Za-z]:)(\/.*)?$/);
  if (driveMatch) {
    const drive = driveMatch[1];
    const rest = driveMatch[2] || "/";
    const segments = rest.split("/");
    const output = [];
    for (const segment of segments) {
      if (!segment || segment === ".") continue;
      if (segment === "..") {
        if (output.length > 0) output.pop();
        continue;
      }
      output.push(segment);
    }
    return `${drive}/${output.join("/")}`;
  }

  if (normalized.startsWith("/")) {
    const segments = normalized.split("/");
    const output = [];
    for (const segment of segments) {
      if (!segment || segment === ".") continue;
      if (segment === "..") {
        if (output.length > 0) output.pop();
        continue;
      }
      output.push(segment);
    }
    return `/${output.join("/")}`;
  }

  return "";
}

function dirname(pathValue) {
  const normalized = normalizePathSeparators(pathValue);
  const at = normalized.lastIndexOf("/");
  if (at <= 0) return normalized;
  return normalized.slice(0, at);
}

function hasPathExtension(pathValue) {
  const normalized = normalizePathSeparators(pathValue);
  const leaf = normalized.split("/").pop() || "";
  return /\.[^./\\]+$/.test(leaf);
}

function resolveMarkdownLinkPath(basePath, href) {
  const cleanedHref = String(href || "").trim();
  if (!cleanedHref) return "";

  let withoutQuery = cleanedHref;
  if (!/^file:/i.test(withoutQuery)) {
    withoutQuery = withoutQuery.split(/[?#]/)[0];
  }
  if (!withoutQuery || /^(https?:|data:|blob:|mailto:|#)/i.test(withoutQuery)) {
    return "";
  }

  let decoded = withoutQuery;
  for (let i = 0; i < 5; i += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }

  if (/^file:/i.test(decoded)) {
    try {
      const parsed = new URL(decoded);
      let pathname = parsed.pathname || "";
      if (/^\/[A-Za-z]:\//.test(pathname)) {
        pathname = pathname.slice(1);
      }
      let filePath = decodeURIComponent(pathname || "");
      if (filePath === "." || filePath === "./" || filePath.endsWith("/")) return "";
      const hasExt = hasPathExtension(filePath);
      if (hasExt && !filePath.toLowerCase().endsWith(".md")) return "";
      if (!hasExt) filePath = `${filePath}.md`;
      const normalizedFilePath = normalizeAbsolutePath(filePath);
      return normalizedFilePath.replace(/\//g, "\\");
    } catch {
      return "";
    }
  }

  if (decoded === "." || decoded === "./" || decoded.endsWith("/")) return "";
  const hasExt = hasPathExtension(decoded);
  if (hasExt && !decoded.toLowerCase().endsWith(".md")) return "";
  if (!hasExt) {
    decoded = `${decoded}.md`;
  }
  const normalizedBasePath = normalizeAbsolutePath(basePath);
  if (!normalizedBasePath) return "";

  if (/^[a-zA-Z]:\//.test(decoded)) {
    const absolute = normalizeAbsolutePath(decoded);
    return absolute.replace(/\//g, "\\");
  }

  const driveMatch = normalizedBasePath.match(/^([a-zA-Z]:)/);
  const drive = driveMatch ? driveMatch[1] : "";
  const baseDir = dirname(normalizedBasePath);

  if (decoded.startsWith("/")) {
    const absolute = normalizeAbsolutePath(drive ? `${drive}${decoded}` : decoded);
    return absolute.replace(/\//g, "\\");
  }

  const absolute = normalizeAbsolutePath(`${baseDir}/${decoded}`);
  return absolute.replace(/\//g, "\\");
}

function resolveAnyLocalLinkPath(basePath, href) {
  const cleaned = String(href || "").trim();
  if (!cleaned || /^(https?:|data:|blob:|mailto:|#)/i.test(cleaned)) {
    return "";
  }

  let withoutQuery = cleaned.split(/[?#]/)[0];
  let decoded = withoutQuery;
  try {
    decoded = decodeURIComponent(withoutQuery);
  } catch { /* keep original */ }

  if (/^file:/i.test(decoded)) {
    try {
      const parsed = new URL(decoded);
      let pathname = parsed.pathname || "";
      if (/^\/[A-Za-z]:\//.test(pathname)) {
        pathname = pathname.slice(1);
      }
      return decodeURIComponent(pathname || "").replace(/\//g, "\\");
    } catch {
      return decoded.replace(/^file:\/\/\/?/i, "").replace(/\//g, "\\");
    }
  }

  if (/^[a-zA-Z]:[/\\]/.test(decoded)) {
    return decoded.replace(/\//g, "\\");
  }

  if (decoded.startsWith("/")) {
    return decoded;
  }

  if (basePath) {
    const normalizedBase = String(basePath).replace(/\//g, "\\");
    const lastSlash = normalizedBase.lastIndexOf("\\");
    const dir = lastSlash >= 0 ? normalizedBase.slice(0, lastSlash) : normalizedBase;
    const parts = decoded.replace(/\//g, "\\").split("\\");
    const dirParts = dir.split("\\").filter(Boolean);

    for (const part of parts) {
      if (part === ".") continue;
      if (part === "..") {
        if (dirParts.length > 0) dirParts.pop();
      } else if (part) {
        dirParts.push(part);
      }
    }

    const driveMatch = normalizedBase.match(/^([a-zA-Z]:)/);
    const prefix = driveMatch ? driveMatch[1] : "";
    return (prefix ? "" : "") + dirParts.join("\\");
  }

  return decoded.replace(/\//g, "\\");
}

function clearInlineLinkedPreview(linkElement) {
  const next = linkElement?.nextElementSibling;
  if (next instanceof HTMLElement && next.classList.contains("inline-linked-note")) {
    next.remove();
    return true;
  }
  return false;
}

export const MarkdownPreview = memo(function MarkdownPreviewContent({
  content,
  basePath,
  externalRef,
  onNotify,
  onContentChange,
  onMediaClick,
  showOriginalImages = false,
  inlineLinkedMarkdown = false,
  onSearchRequest,
  onForceSaveDocument,
  onOpenTaskDetails,
  readOnly = false,
}) {
  const previewRef = useRef(null);
  const menuRef = useRef(null);
  const menuItemsRef = useRef([]);
  const menuSourceRef = useRef(null);
  const replaceInputRef = useRef(null);
  const imageResolveCacheRef = useRef(new Map());
  const { confirm } = useConfirm();
  const [cropState, setCropState] = useState({
    open: false,
    src: "",
    assetPath: "",
    imageLabel: "",
    annotation: null,
    hasOriginal: false,
    annotationOnly: false,
  });
  const [contextMenu, setContextMenu] = useState(null);
  const handleLinkNavigateRef = useRef(null);


  const [menuIndex, setMenuIndex] = useState(0);
  const [cropSaving, setCropSaving] = useState(false);
  const [replaceState, setReplaceState] = useState({ busy: false, assetPath: "" });
  const [codeEditState, setCodeEditState] = useState({ open: false, language: "", code: "", sourceLine: null });
  const [mermaidEditState, setMermaidEditState] = useState({ open: false, initialCode: "", originalBlockCode: "" });
  const [tableEditState, setTableEditState] = useState({ open: false, initialMarkdown: "", sourceLine: null, lineCount: 0 });
  const [diagramEditState, setDiagramEditState] = useState({
    open: false,
    diagramId: "",
    documentPath: "",
    initialData: null,
    sourceAssetPath: "",
    sourceAltText: "",
    converted: false,
  });
  const parts = useMemo(() => {
    return parseDiagramBlocks(content);
  }, [content]);

  useEffect(() => {
    let cancelled = false;
    const previewElement = previewRef.current;
    if (!previewElement || !basePath) return undefined;

    const resolveImage = async (image) => {
      if (!image || !(image instanceof HTMLImageElement)) return;
      if (!image.hasAttribute("tabindex")) {
        image.setAttribute("tabindex", "0");
      }
      image.setAttribute("aria-haspopup", "menu");
      image.setAttribute("aria-label", image.getAttribute("alt") || "Image");

      const existingAssetPath = image.getAttribute("data-asset-path") || "";
      const src = image.getAttribute("src") || "";
      const assetPath = (existingAssetPath && !/^(data:|blob:)/i.test(existingAssetPath))
        ? existingAssetPath
        : (!/^(data:|blob:)/i.test(src) ? src : "");

      if (assetPath) {
        image.setAttribute("data-asset-path", assetPath);
      }

      const shouldSkipResolution = !assetPath || /^(data:|blob:|https?:)/i.test(assetPath);
      if (shouldSkipResolution) return;

      const cache = imageResolveCacheRef.current;
      const variant = showOriginalImages ? "original" : "thumbnail";
      const cacheKey = imageCacheKey(assetPath, variant);
      if (cache.has(cacheKey)) {
        const cached = cache.get(cacheKey);
        if (!cancelled && cached) image.src = cached;
        const annotationKey = `annotation:${assetPath}`;
        if (cache.has(annotationKey)) {
          if (!cancelled) applyImageAnnotation(image, cache.get(annotationKey));
        } else {
          try {
            const annotation = await getImageAnnotation(basePath, assetPath);
            cache.set(annotationKey, annotation);
            if (!cancelled) applyImageAnnotation(image, annotation);
          } catch {
            if (!cancelled) applyImageAnnotation(image, null);
          }
        }
        const originalKey = `original:${assetPath}`;
        if (cache.has(originalKey)) {
          if (!cancelled) applyImageOriginalBadge(image, Boolean(cache.get(originalKey)));
        } else {
          try {
            const originalStatus = await getImageOriginalStatus(basePath, assetPath);
            cache.set(originalKey, Boolean(originalStatus?.hasOriginal));
            if (!cancelled) applyImageOriginalBadge(image, Boolean(originalStatus?.hasOriginal));
          } catch {
            if (!cancelled) applyImageOriginalBadge(image, false);
          }
        }
        return;
      }

      try {
        const resolved = await readImage(basePath, assetPath, { thumbnail: !showOriginalImages });
        if (!cancelled && resolved) {
          cache.set(cacheKey, resolved);
          image.src = resolved;
        }
      } catch {
        // Keep original src if resolution fails.
      }

      try {
        const annotation = await getImageAnnotation(basePath, assetPath);
        cache.set(`annotation:${assetPath}`, annotation);
        if (!cancelled) applyImageAnnotation(image, annotation);
      } catch {
        if (!cancelled) applyImageAnnotation(image, null);
      }
      try {
        const originalStatus = await getImageOriginalStatus(basePath, assetPath);
        const hasOrig = Boolean(originalStatus?.hasOriginal);
        cache.set(`original:${assetPath}`, hasOrig);
        if (!cancelled) applyImageOriginalBadge(image, hasOrig);
      } catch {
        if (!cancelled) applyImageOriginalBadge(image, false);
      }
    };

    const resolveAllImages = () => {
      const images = Array.from(previewElement.querySelectorAll("img"));
      images.forEach((image) => {
        void resolveImage(image);
      });
    };

    resolveAllImages();
    const timer = window.setTimeout(resolveAllImages, 40);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.tagName === "IMG") {
            void resolveImage(node);
            return;
          }
          node.querySelectorAll?.("img").forEach((image) => {
            void resolveImage(image);
          });
        });
      });
    });

    observer.observe(previewElement, { childList: true, subtree: true });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [content, basePath, showOriginalImages]);

  useEffect(() => {
    if (!onMediaClick && !inlineLinkedMarkdown) return;

    const previewElement = previewRef.current;
    if (!previewElement) return;

    const openInlineLinkedMarkdown = async (linkElement, event) => {
      if (!inlineLinkedMarkdown || !basePath) return false;

      const rawHref = linkElement.getAttribute("href") || "";
      const resolvedPath = resolveMarkdownLinkPath(basePath, rawHref);
      if (!resolvedPath) return false;

      event.preventDefault();
      event.stopPropagation();

      if (clearInlineLinkedPreview(linkElement)) {
        return true;
      }

      const wrapper = document.createElement("section");
      wrapper.className = "inline-linked-note";
      wrapper.innerHTML = "<div class=\"inline-linked-note-status\">Loading linked note…</div>";
      linkElement.insertAdjacentElement("afterend", wrapper);

      try {
        const source = await readMarkdownSource(resolvedPath);
        const normalized = normalizeMarkdownImagePaths(source || "");
        wrapper.innerHTML = `
          <div class="inline-linked-note-header">
            <strong>Linked Note</strong>
            <span>${resolvedPath.split(/[/\\\\]/).pop() || "note.md"}</span>
          </div>
          <div class="inline-linked-note-body">${renderMarkdown(normalized, { sourceLineOffset: 0 })}</div>
        `;
      } catch (error) {
        const message = error?.message || "Unable to load linked note.";
        wrapper.innerHTML = `<div class="inline-linked-note-status error">${message}</div>`;
        onNotify?.(message, "error");
      }

      return true;
    };

    handleLinkNavigateRef.current = async (linkElement) => {
      const rawHref = (linkElement?.getAttribute("href") || "").trim();
      if (!rawHref) return;

      if (rawHref === "." || rawHref === "./") {
        onNotify?.("Directory links like ./ are not supported here. Link a specific .md file.", "info");
        return;
      }

      if (inlineLinkedMarkdown) {
        const fakeEvent = {
          preventDefault: () => {},
          stopPropagation: () => {}
        };
        const openedInline = await openInlineLinkedMarkdown(linkElement, fakeEvent);
        if (openedInline) return;
      }

      if (rawHref.startsWith("http://") || rawHref.startsWith("https://")) {
        window.notesApi?.openExternal?.(rawHref);
        return;
      }

      try {
        await openFolder(rawHref, basePath);
      } catch (dirCheckErr) {
        onNotify?.(dirCheckErr?.message || "Failed to open in File Explorer", "error");
      }
    };


    const openImageViewer = (imageElement, event) => {
      const src = getImagePath(imageElement);
      if (!src) return;

      const ext = src.split(".").pop()?.toLowerCase();
      const mediaType = getMediaTypeFromExtension(ext);
      if (!mediaType) return;

      event.preventDefault();
      event.stopPropagation();
      onMediaClick({ path: src, type: mediaType });
    };

    const openImageEditor = async (imageElement, event, options = {}) => {
      const { annotationOnly = false } = options;
      const assetPath = imageElement.getAttribute("data-asset-path") || "";
      const isWorkspaceImage = Boolean(basePath && assetPath && !/^(https?:|data:|blob:)/i.test(assetPath));
      if (!isWorkspaceImage) {
        onNotify?.("Image editing is available for workspace images only.", "info");
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      let fullSizeSrc = imageElement.currentSrc || imageElement.src || "";
      let annotation = null;
      let hasOriginal = false;

      const cache = imageResolveCacheRef.current;

      try {
        fullSizeSrc = await readImage(basePath, assetPath);
      } catch {
        // Fall back to the rendered preview image if the full-size read fails.
      }

      const annotationKey = `annotation:${assetPath}`;
      if (cache.has(annotationKey)) {
        annotation = cache.get(annotationKey);
      } else {
        try {
          annotation = await getImageAnnotation(basePath, assetPath);
          cache.set(annotationKey, annotation);
        } catch {
          annotation = null;
        }
      }

      const originalKey = `original:${assetPath}`;
      if (cache.has(originalKey)) {
        hasOriginal = Boolean(cache.get(originalKey));
      } else {
        try {
          const originalStatus = await getImageOriginalStatus(basePath, assetPath);
          hasOriginal = Boolean(originalStatus?.hasOriginal);
          cache.set(originalKey, hasOriginal);
        } catch {
          hasOriginal = false;
        }
      }

      setCropState({
        open: true,
        src: fullSizeSrc,
        assetPath,
        imageLabel: imageElement.getAttribute("alt") || assetPath,
        annotation,
        hasOriginal,
        annotationOnly,
      });
    };

    const handleRunCodeBlock = async (runButton) => {
      const rawCode = decodeURIComponent(runButton.getAttribute("data-code-raw") || "");
      const lang = runButton.getAttribute("data-code-lang") || "";
      const figure = runButton.closest("figure.markdown-code-block");
      if (!figure) return;

      let outputDiv = figure.querySelector(".code-execution-output");
      if (!outputDiv) {
        outputDiv = document.createElement("div");
        outputDiv.className = "code-execution-output";
        outputDiv.style.marginTop = "8px";
        outputDiv.style.borderRadius = "4px";
        outputDiv.style.border = "1px solid #282c34";
        outputDiv.style.background = "#181a1f";
        outputDiv.style.color = "#abb2bf";
        outputDiv.style.fontFamily = "Consolas, Monaco, 'Courier New', monospace";
        outputDiv.style.fontSize = "12px";
        outputDiv.style.padding = "8px 12px";

        const header = document.createElement("div");
        header.style.display = "flex";
        header.style.justify = "space-between";
        header.style.alignItems = "center";
        header.style.paddingBottom = "6px";
        header.style.borderBottom = "1px solid #282c34";
        header.style.marginBottom = "6px";
        header.style.fontSize = "11px";
        header.style.fontWeight = "600";
        header.style.color = "#5c6370";
        header.innerHTML = `
          <span class="status-label">EXECUTION OUTPUT</span>
          <button type="button" class="clear-output-btn" style="background:none; border:none; color:#e06c75; cursor:pointer; font-size:11px; padding: 2px 6px;">Clear</button>
        `;
        outputDiv.appendChild(header);

        const pre = document.createElement("pre");
        pre.style.margin = "0";
        pre.style.whiteSpace = "pre-wrap";
        pre.style.wordBreak = "break-all";
        pre.style.maxHeight = "200px";
        pre.style.overflowY = "auto";
        pre.style.color = "#abb2bf";
        outputDiv.appendChild(pre);

        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.style.width = "100%";
        iframe.style.height = "250px";
        iframe.style.border = "none";
        iframe.style.background = "#ffffff";
        iframe.style.borderRadius = "2px";
        iframe.style.marginTop = "4px";
        iframe.sandbox = "allow-scripts";
        outputDiv.appendChild(iframe);

        figure.appendChild(outputDiv);

        const clearBtn = header.querySelector(".clear-output-btn");
        clearBtn.onclick = () => {
          outputDiv.remove();
        };
      }

      const pre = outputDiv.querySelector("pre");
      const iframe = outputDiv.querySelector("iframe");
      const statusLabel = outputDiv.querySelector(".status-label");

      statusLabel.textContent = "EXECUTING...";
      statusLabel.style.color = "#61afef";
      if (iframe) iframe.style.display = "none";
      if (pre) {
        pre.style.display = "block";
        pre.textContent = "Running script...";
        pre.style.color = "#abb2bf";
      }

      try {
        const { executeCodeBlock } = await import("../services/electronService");
        const result = await executeCodeBlock(lang, rawCode);

        if (result.success) {
          if (result.isHtml) {
            statusLabel.textContent = "HTML PREVIEW";
            statusLabel.style.color = "#98c379";
            if (pre) pre.style.display = "none";
            if (iframe) {
              iframe.style.display = "block";
              iframe.srcdoc = result.htmlContent;
            }
          } else {
            statusLabel.textContent = `SUCCESS (exit code ${result.exitCode})`;
            statusLabel.style.color = "#98c379";
            if (iframe) iframe.style.display = "none";
            if (pre) {
              pre.style.display = "block";
              pre.textContent = result.stdout || "(No output)";
              pre.style.color = "#abb2bf";
            }
          }
        } else {
          statusLabel.textContent = `FAILED (exit code ${result.exitCode})`;
          statusLabel.style.color = "#e06c75";
          if (iframe) iframe.style.display = "none";
          if (pre) {
            pre.style.display = "block";
            pre.textContent = result.stderr || result.stdout || "Execution failed with no output.";
            pre.style.color = "#e06c75";
          }
        }
      } catch (err) {
        statusLabel.textContent = "ERROR";
        statusLabel.style.color = "#e06c75";
        if (iframe) iframe.style.display = "none";
        if (pre) {
          pre.style.display = "block";
          pre.textContent = err.message || "Failed to execute code block.";
          pre.style.color = "#e06c75";
        }
      }
    };
    const handleCopyLinkFromPreview = (href) => {
      if (!href) return;
      navigator.clipboard.writeText(href);
      onNotify?.(`Copied link path: ${href}`, "success");
    };

    const handleDownloadFileFromPreview = (href) => {
      if (!href) return;
      const resolvedPath = resolveAnyLocalLinkPath(basePath, href) || String(href || "").trim().replace(/^file:\/\/\/?/i, "").split(/[?#]/)[0];
      const ext = resolvedPath.split(".").pop()?.toLowerCase();
      const mediaType = getMediaTypeFromExtension(ext) || "document";

      if (typeof onMediaClick === "function") {
        onMediaClick({ path: resolvedPath, type: mediaType });
      } else if (basePath && typeof openMediaInDefaultApp === "function") {
        openMediaInDefaultApp(basePath, resolvedPath).catch((err) => {
          onNotify?.(err?.message || "Failed to open file.", "error");
        });
      }
    };

    const handleDirectDownloadFileFromPreview = async (href) => {
      if (!href) return;
      try {
        const resolvedPath = resolveAnyLocalLinkPath(basePath, href) || String(href || "").trim().replace(/^file:\/\/\/?/i, "").split(/[?#]/)[0];
        const filename = resolvedPath.split(/[/\\]/).pop() || "file";

        let downloadSrc = resolvedPath;
        if (basePath && downloadSrc && !/^(https?:|data:|blob:)/i.test(downloadSrc)) {
          try {
            const loaded = await readImage(basePath, downloadSrc);
            if (loaded) downloadSrc = loaded;
          } catch { /* keep resolvedPath */ }
        }

        let dataUrl;
        let srcPath;

        if (typeof downloadSrc === "string" && downloadSrc.startsWith("data:")) {
          dataUrl = downloadSrc;
        } else if (typeof downloadSrc === "string" && (downloadSrc.startsWith("blob:") || downloadSrc.startsWith("http"))) {
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

        const result = await runExport("media", {
          dataUrl,
          srcPath,
          filename,
        });

        if (result?.success) {
          onNotify?.(`Downloaded ${result.filename} to Downloads folder`, "success");
        } else {
          onNotify?.(result?.error || "Failed to download file.", "error");
        }
      } catch (err) {
        onNotify?.(err?.message || "Failed to download file.", "error");
      }
    };

    const handleExportTableImage = async (tableWrapper) => {
      if (!tableWrapper) return;
      try {
        const dataUrl = await tableElementToPngDataUrl(tableWrapper);
        const result = await runExport("media", {
          dataUrl,
          filename: "table.png",
          customExportType: "image",
          category: "media",
        });
        if (result?.success) {
          onNotify?.(`Table image exported to ${result.filename}`, "success");
        } else {
          onNotify?.(result?.error || "Export failed", "error");
        }
      } catch (err) {
        onNotify?.(`Failed to export table image: ${err?.message || "Unknown error"}`, "error");
      }
    };

    const handleExportTableCsv = async (tableWrapper) => {
      if (!tableWrapper) return;
      try {
        const csvContent = tableElementToCsv(tableWrapper);
        if (!csvContent) {
          throw new Error("Table content is empty.");
        }
        const dataUrl = `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`;
        const result = await runExport("media", {
          dataUrl,
          filename: "table.csv",
          customExportType: "csv",
          category: "document",
        });
        if (result?.success) {
          onNotify?.(`Table CSV exported to ${result.filename}`, "success");
        } else {
          onNotify?.(result?.error || "Export failed", "error");
        }
      } catch (err) {
        onNotify?.(`Failed to export table CSV: ${err?.message || "Unknown error"}`, "error");
      }
    };

    const handleMediaClick = async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const runButton = target.closest('[data-code-run="true"]');
      if (runButton instanceof HTMLButtonElement) {
        event.preventDefault();
        event.stopPropagation();
        handleRunCodeBlock(runButton);
        return;
      }

      const copyButton = target.closest('[data-code-copy="true"]');
      if (copyButton instanceof HTMLButtonElement) {
        event.preventDefault();
        event.stopPropagation();
        const rawCode = decodeURIComponent(copyButton.getAttribute("data-code-raw") || "");
        try {
          await navigator.clipboard.writeText(rawCode);
          onNotify?.("Code copied.", "success");
        } catch {
          onNotify?.("Unable to copy code.", "error");
        }
        return;
      }

      const formatButton = target.closest('[data-code-format="true"]');
      if (formatButton instanceof HTMLButtonElement) {
        event.preventDefault();
        event.stopPropagation();
        const rawCode = decodeURIComponent(formatButton.getAttribute("data-code-raw") || "");
        const lang = formatButton.getAttribute("data-code-lang") || "";
        const figure = formatButton.closest("figure.markdown-code-block");
        const sourceLine = figure ? Number(figure.getAttribute("data-source-line")) : null;
        
        if (sourceLine) {
          import("../utils/codeFormatter").then(({ formatCode }) => {
            formatCode(rawCode, lang).then((formatted) => {
              if (formatted && formatted !== rawCode) {
                if (onContentChange) {
                  const nextContent = replaceCodeBlockAtLine(content, sourceLine, lang, formatted);
                  if (nextContent !== null) {
                    onContentChange(nextContent);
                    onNotify?.("Code formatted successfully.", "success");
                  }
                }
              } else {
                onNotify?.("Code is already formatted or language unsupported.", "info");
              }
            });
          });
        }
        return;
      }

      const exportImgBtn = target.closest('[data-table-action="export-image"]');
      if (exportImgBtn) {
        event.preventDefault();
        event.stopPropagation();
        const tableWrapper = exportImgBtn.closest(".markdown-table-wrapper");
        void handleExportTableImage(tableWrapper);
        return;
      }

      const exportCsvBtn = target.closest('[data-table-action="export-csv"]');
      if (exportCsvBtn) {
        event.preventDefault();
        event.stopPropagation();
        const tableWrapper = exportCsvBtn.closest(".markdown-table-wrapper");
        void handleExportTableCsv(tableWrapper);
        return;
      }

      const tableWrapper = target.closest(".markdown-table-wrapper");
      if (tableWrapper) {
        if (target.closest(".markdown-table-dropdown-popover")) return;
        if (target.closest("a, input, select, textarea")) return;
        event.preventDefault();
        event.stopPropagation();
        
        const sourceLine = Number(tableWrapper.getAttribute("data-source-line")) || null;
        const lines = String(content || "").split("\n");

        if (sourceLine) {
          let lineIdx = Math.max(0, Math.min(lines.length - 1, sourceLine - 1));
          if (!lines[lineIdx] || !lines[lineIdx].includes("|")) {
            for (const offset of [-1, 1, -2, 2, -3, 3, -4, 4, -5, 5]) {
              const candidate = lineIdx + offset;
              if (candidate >= 0 && candidate < lines.length && lines[candidate].includes("|")) {
                lineIdx = candidate;
                break;
              }
            }
          }
          if (lines[lineIdx] && lines[lineIdx].includes("|")) {
            let startIdx = lineIdx;
            while (startIdx > 0 && lines[startIdx - 1].includes("|")) startIdx -= 1;
            let endIdx = lineIdx;
            while (endIdx < lines.length - 1 && lines[endIdx + 1].includes("|")) endIdx += 1;
            const tableLines = lines.slice(startIdx, endIdx + 1);
            setTableEditState({ open: true, initialMarkdown: tableLines.join("\n"), sourceLine: startIdx + 1, lineCount: tableLines.length });
            return;
          }
        }

        // Fallback: locate table containing '|' in content
        const firstTableIdx = lines.findIndex((l) => l.includes("|"));
        if (firstTableIdx !== -1) {
          let startIdx = firstTableIdx;
          while (startIdx > 0 && lines[startIdx - 1].includes("|")) startIdx -= 1;
          let endIdx = firstTableIdx;
          while (endIdx < lines.length - 1 && lines[endIdx + 1].includes("|")) endIdx += 1;
          const tableLines = lines.slice(startIdx, endIdx + 1);
          setTableEditState({ open: true, initialMarkdown: tableLines.join("\n"), sourceLine: startIdx + 1, lineCount: tableLines.length });
        } else {
          onNotify?.("Unable to read table source.", "error");
        }
        return;
      }

      const editButton = target.closest('[data-code-edit="true"]');
      if (editButton instanceof HTMLButtonElement) {
        event.preventDefault();
        event.stopPropagation();
        const rawCode = decodeURIComponent(editButton.getAttribute("data-code-raw") || "");
        const lang = editButton.getAttribute("data-code-lang") || "";
        const figure = editButton.closest("figure.markdown-code-block");
        const sourceLine = figure ? Number(figure.getAttribute("data-source-line")) : null;
        
        if (sourceLine) {
          setCodeEditState({ open: true, language: lang, code: rawCode, sourceLine });
        } else {
          onNotify?.("Unable to determine source line for this block.", "error");
        }
        return;
      }

      const imageAction = target.closest?.("[data-image-action]");
      if (imageAction instanceof HTMLButtonElement) {
        const imageElement = getImageActionElement(imageAction);
        if (!imageElement) return;

        if (imageAction.dataset.imageAction === "annotate") {
          void openImageEditor(imageElement, event, { annotationOnly: true });
          return;
        }

        if (imageAction.dataset.imageAction === "edit") {
          void openImageEditor(imageElement, event, { annotationOnly: false });
          return;
        }

        if (imageAction.dataset.imageAction === "download") {
          event.preventDefault();
          event.stopPropagation();
          const assetPath = imageElement.getAttribute("data-asset-path") || imageElement.getAttribute("src") || "";
          const altText = imageElement.getAttribute("alt") || "image.png";
          const rawName = (assetPath || altText).split(/[?#]/)[0].split(/[/\\]/).pop() || "image.png";

          (async () => {
            try {
              let downloadSrc = assetPath;
              if (basePath && assetPath && !/^(https?:|data:|blob:)/i.test(assetPath)) {
                try {
                  downloadSrc = (await readImage(basePath, assetPath)) || assetPath;
                } catch { /* fallback */ }
              }
              if (!downloadSrc) {
                downloadSrc = imageElement.currentSrc || imageElement.src || "";
              }

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

              const result = await runExport("media", {
                dataUrl,
                srcPath,
                filename: rawName,
                customExportType: "image",
                category: "media",
              });

              if (result?.success) {
                onNotify?.(`Downloaded ${result.filename} to Downloads folder`, "success");
              } else {
                onNotify?.(result?.error || "Failed to download image.", "error");
              }
            } catch (err) {
              onNotify?.(`Image download failed: ${err.message}`, "error");
            }
          })();
          return;
        }

        openImageViewer(imageElement, event);
        return;
      }

      const linkActionBtn = target.closest('[data-link-action]');
      if (linkActionBtn) {
        event.preventDefault();
        event.stopPropagation();
        const action = linkActionBtn.getAttribute("data-link-action");
        const href = linkActionBtn.getAttribute("data-href") || "";
        const wrapper = linkActionBtn.closest(".markdown-link-wrapper");
        const linkElement = wrapper?.querySelector("a") || target.closest("a");

        if (action === "copy") {
          handleCopyLinkFromPreview(href);
        } else if (action === "reveal") {
          if (linkElement) handleLinkNavigateRef.current?.(linkElement);
        } else if (action === "open-file") {
          handleDownloadFileFromPreview(href);
        } else if (action === "download") {
          handleDirectDownloadFileFromPreview(href);
        }
        return;
      }

      const linkElement = target.closest("a");
      if (linkElement instanceof HTMLAnchorElement) {
        if (target.closest('[data-link-action]')) return;
        event.preventDefault();
        event.stopPropagation();
        handleLinkNavigateRef.current?.(linkElement);
        return;
      }

      const imageElement = getImageActionElement(target);
      if (imageElement) {
        openImageViewer(imageElement, event);
        return;
      }

      // Handle audio/video element clicks
      if (target.tagName === "AUDIO" || target.tagName === "VIDEO") {
        const src = target.querySelector("source")?.getAttribute("src") || target.getAttribute("src") || "";
        if (src) {
          const ext = src.split(".").pop()?.toLowerCase();
          const mediaType = getMediaTypeFromExtension(ext);
          if (mediaType) {
            event.preventDefault();
            event.stopPropagation();
            onMediaClick({ path: src, type: mediaType });
          }
        }
      }
    };

    const handleMediaDblClick = (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const figure = target.closest("figure.markdown-code-block");
      if (figure) {
        const editBtn = figure.querySelector('[data-code-edit="true"]');
        if (editBtn) {
          event.preventDefault();
          event.stopPropagation();
          editBtn.click();
        }
      }
    };

    previewElement.addEventListener("click", handleMediaClick);
    previewElement.addEventListener("dblclick", handleMediaDblClick);

    return () => {
      previewElement.removeEventListener("click", handleMediaClick);
      previewElement.removeEventListener("dblclick", handleMediaDblClick);
    };
  }, [basePath, inlineLinkedMarkdown, onMediaClick, onNotify, content, onContentChange, confirm]);



  useEffect(() => {
    if (!contextMenu) return undefined;

    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setContextMenu(null);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setContextMenu(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    setMenuIndex(0);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!contextMenu) return;
    const activeItem = menuItemsRef.current[menuIndex];
    activeItem?.focus();
  }, [contextMenu, menuIndex]);

  const closeContextMenu = (options = {}) => {
    const { restoreFocus = true } = options;
    const shouldRestoreFocus = restoreFocus && Boolean(contextMenu?.keyboardOpened);
    setContextMenu(null);
    if (shouldRestoreFocus) {
      menuSourceRef.current?.focus?.();
    }
    menuSourceRef.current = null;
    menuItemsRef.current = [];
    setMenuIndex(0);
  };

  const openImageContextMenu = (event, sourceImage = null, x = null, y = null) => {
    const sourceTarget = sourceImage || event?.target;
    const diagramContext = getExcalidrawActionContext(sourceTarget);
    if (diagramContext) {
      event?.preventDefault?.();
      menuSourceRef.current = diagramContext.preview;
      setContextMenu({
        kind: "diagram",
        x: Number.isFinite(x) ? x : event?.clientX,
        y: Number.isFinite(y) ? y : event?.clientY,
        keyboardOpened: !Number.isFinite(event?.clientX),
        anchorX: diagramContext.bounds.left + Math.min(diagramContext.bounds.width * 0.5, 220),
        anchorY: diagramContext.bounds.top + Math.min(diagramContext.bounds.height * 0.5, 80),
        diagramId: diagramContext.diagramId,
        diagramImagePath: diagramContext.imagePath,
        originAssetPath: diagramContext.originAssetPath,
        originAltText: diagramContext.originAltText,
      });
      return;
    }

    const imageElement = sourceImage || getImageActionElement(event.target);
    if (!imageElement) {
      const selection = window.getSelection();
      const text = selection.toString().trim();
      if (text) {
        event?.preventDefault?.();
        setContextMenu({
          kind: "text",
          x: Number.isFinite(x) ? x : event?.clientX,
          y: Number.isFinite(y) ? y : event?.clientY,
          keyboardOpened: !Number.isFinite(event?.clientX),
          anchorX: Number.isFinite(x) ? x : event?.clientX,
          anchorY: Number.isFinite(y) ? y : event?.clientY,
          selectedText: text,
        });
        return;
      }
      closeContextMenu({ restoreFocus: false });
      return;
    }

    const rawAsset = imageElement.getAttribute("data-asset-path") || imageElement.getAttribute("src") || "";
    let assetPath = rawAsset.replace(/^https?:\/\/[^/]+\//i, "");
    if (/^(?:file|app|atom):\/\//i.test(assetPath) || /^(?:[a-z]:\/|\/)/i.test(assetPath)) {
      assetPath = toComparableAssetPath(assetPath, basePath);
    }
    const isWorkspaceImage = Boolean(basePath && assetPath && !/^(https?:|data:|blob:)/i.test(assetPath));

    event?.preventDefault?.();
    const bounds = imageElement.getBoundingClientRect();
    menuSourceRef.current = imageElement;
    setContextMenu({
      kind: "image",
      x: Number.isFinite(x) ? x : event.clientX,
      y: Number.isFinite(y) ? y : event.clientY,
      keyboardOpened: !Number.isFinite(event?.clientX),
      anchorX: bounds.left + Math.min(bounds.width * 0.5, 220),
      anchorY: bounds.top + Math.min(bounds.height * 0.5, 80),
      isWorkspaceImage,
      src: imageElement.currentSrc || imageElement.src || "",
      assetPath,
      imageLabel: imageElement.getAttribute("alt") || assetPath,
    });
  };

  const handlePreviewKeyDown = (event) => {
    const imageElement = event.target?.closest?.("img");
    if (!imageElement) return;

    const shouldOpenMenu = event.key === "ContextMenu" || (event.shiftKey && event.key === "F10");
    if (!shouldOpenMenu) return;

    const bounds = imageElement.getBoundingClientRect();
    openImageContextMenu(event, imageElement, bounds.left + bounds.width / 2, bounds.top + Math.min(bounds.height / 2, 80));
  };

  const openCropFromMenu = async () => {
    if (!contextMenu?.isWorkspaceImage) {
      onNotify?.("Crop is available for workspace images only.", "info");
      closeContextMenu();
      return;
    }

    const assetPath = contextMenu.assetPath;
    let fullSizeSrc = contextMenu.src;
    let annotation = null;
    try {
      fullSizeSrc = await readImage(basePath, assetPath);
    } catch {
      // Fall back to the rendered preview image if the full-size read fails.
    }
    try {
      annotation = await getImageAnnotation(basePath, assetPath);
    } catch {
      annotation = null;
    }
    let hasOriginal = false;
    try {
      const originalStatus = await getImageOriginalStatus(basePath, assetPath);
      hasOriginal = Boolean(originalStatus?.hasOriginal);
    } catch {
      hasOriginal = false;
    }

    setCropState({
      open: true,
      src: fullSizeSrc,
      assetPath,
      imageLabel: contextMenu.imageLabel,
      annotation,
      hasOriginal,
      annotationOnly: false,
    });
    closeContextMenu({ restoreFocus: false });
  };

  const viewImageFromMenu = () => {
    if (!contextMenu) return;
    if (typeof onMediaClick !== "function") {
      onNotify?.("Image viewer is unavailable in this view.", "info");
      closeContextMenu();
      return;
    }

    const imagePath = contextMenu.assetPath || contextMenu.src || "";
    if (!imagePath) {
      closeContextMenu();
      return;
    }

    const ext = imagePath.split(/[?#]/)[0].split(".").pop()?.toLowerCase();
    const mediaType = getMediaTypeFromExtension(ext) || "image";
    onMediaClick({ path: imagePath, type: mediaType });
    closeContextMenu({ restoreFocus: false });
  };

  const copyMarkdownFromMenu = async () => {
    if (!contextMenu) return;
    const markdown = createImageMarkdown(
      contextMenu.imageLabel || "image",
      contextMenu.assetPath || contextMenu.src || ""
    );

    try {
      await navigator.clipboard.writeText(markdown);
      onNotify?.("Image markdown copied.", "success");
    } catch {
      onNotify?.("Unable to copy image markdown.", "error");
    } finally {
      closeContextMenu();
    }
  };

  const editDiagramFromMenu = () => {
    const source = menuSourceRef.current;
    const preview = source instanceof HTMLElement
      ? (source.classList.contains("excalidraw-preview-container") ? source : source.closest?.(".excalidraw-preview-container"))
      : null;
    if (preview instanceof HTMLElement) {
      preview.click();
    }
    closeContextMenu();
  };

  const copyDiagramMarkdownFromMenu = async () => {
    if (!contextMenu?.diagramImagePath) {
      onNotify?.("Diagram reference unavailable.", "info");
      closeContextMenu({ restoreFocus: false });
      return;
    }

    const metadata = contextMenu.diagramId
      ? `{data-diagram-id="${contextMenu.diagramId}" data-diagram-type="excalidraw"}`
      : "";
    const markdown = `![Excalidraw Diagram](${contextMenu.diagramImagePath})${metadata}`;

    try {
      await navigator.clipboard.writeText(markdown);
      onNotify?.("Diagram markdown copied.", "success");
    } catch {
      onNotify?.("Unable to copy diagram markdown.", "error");
    } finally {
      closeContextMenu();
    }
  };

  const closeDiagramEditor = () => {
    setDiagramEditState({
      open: false,
      diagramId: "",
      documentPath: "",
      initialData: null,
      sourceAssetPath: "",
      sourceAltText: "",
      converted: false,
    });
  };

  const openExcalidrawFromImageMenu = async () => {
    if (!basePath || !contextMenu?.isWorkspaceImage || !contextMenu?.assetPath) {
      onNotify?.("Edit with Excalidraw is available for workspace images only.", "info");
      closeContextMenu({ restoreFocus: false });
      return;
    }

    const sourceAssetPath = contextMenu.assetPath;
    const sourceAltText = contextMenu.imageLabel || "Image";
    closeContextMenu();

    try {
      let fullSizeSrc = null;
      try {
        fullSizeSrc = await readImage(basePath, sourceAssetPath);
      } catch {
        fullSizeSrc = contextMenu.src;
      }
      if (!fullSizeSrc) {
        fullSizeSrc = contextMenu.src;
      }
      const dimensions = await measureDataUrlImage(fullSizeSrc);
      const diagramId = generateDiagramId();
      const initialData = buildExcalidrawInitialDataFromImage(fullSizeSrc, dimensions, sourceAltText);

      setDiagramEditState({
        open: true,
        diagramId,
        documentPath: resolveDocumentPathFromBase(basePath),
        initialData,
        sourceAssetPath,
        sourceAltText,
        converted: false,
      });
    } catch (error) {
      onNotify?.(error?.message || "Unable to open image in Excalidraw.", "error");
    }
  };

  const saveExcalidrawFromImageMenu = async (newDiagramData, previewImageData) => {
    if (!diagramEditState.diagramId || !diagramEditState.sourceAssetPath) {
      onNotify?.("Missing diagram metadata required for save.", "error");
      return;
    }

    const docPath = diagramEditState.documentPath || resolveDocumentPathFromBase(basePath) || ".";
    const sourceAssetPath = diagramEditState.sourceAssetPath;
    const sourceAltText = diagramEditState.sourceAltText || "Image";

    try {
      await writeDiagramSource(docPath, diagramEditState.diagramId, newDiagramData);

      if (previewImageData) {
        await writeDiagramImage(docPath, diagramEditState.diagramId, previewImageData);
      }

      if (diagramEditState.converted) {
        onNotify?.("Diagram saved.", "success");
        onForceSaveDocument?.();
        return;
      }

      const baseMarkdown = createDiagramMarkdown("document", diagramEditState.diagramId);
      const normalizedOriginAsset = normalizeImagePathForMarkdown(sourceAssetPath);
      const metadataSuffix = ` data-origin-asset="${sanitizeAttributeValue(normalizedOriginAsset)}" data-origin-alt="${sanitizeAttributeValue(sourceAltText)}"}`;
      const diagramMarkdown = baseMarkdown.includes("}")
        ? baseMarkdown.replace(/\}$/, metadataSuffix)
        : `${baseMarkdown}{data-diagram-id="${diagramEditState.diagramId}" data-diagram-type="excalidraw" data-origin-asset="${sanitizeAttributeValue(normalizedOriginAsset)}" data-origin-alt="${sanitizeAttributeValue(sourceAltText)}"}`;

      const replacementResult = replaceFirstImageReferenceWithDiagram(content, sourceAssetPath, diagramMarkdown, basePath);
      if (!replacementResult.replaced) {
        throw new Error("Could not locate the source image markdown to replace.");
      }

      const finalContent = replacementResult.nextContent;
      if (typeof onContentChange === "function") {
        onContentChange(finalContent);
      }

      onNotify?.("Image converted to Excalidraw diagram.", "success");
      onForceSaveDocument?.(finalContent);
      setDiagramEditState((prev) => ({
        ...prev,
        converted: true,
      }));
    } catch (error) {
      console.error("saveExcalidrawFromImageMenu error:", error);
      onNotify?.(error?.message || "Unable to save Excalidraw diagram.", "error");
    }
  };

  const restoreOriginalImageFromDiagramMenu = () => {
    if (!contextMenu?.originAssetPath) {
      onNotify?.("Original image metadata is unavailable for this diagram.", "info");
      closeContextMenu();
      return;
    }

    const result = replaceDiagramReferenceWithOriginal(content, {
      diagramId: contextMenu.diagramId,
      diagramImagePath: contextMenu.diagramImagePath,
      originAssetPath: contextMenu.originAssetPath,
      originAltText: contextMenu.originAltText || "Image",
    });

    if (!result.replaced) {
      onNotify?.("Unable to restore the original image reference.", "error");
      closeContextMenu();
      return;
    }

    if (typeof onContentChange === "function" && result.nextContent !== String(content || "")) {
      onContentChange(result.nextContent);
    }
    onNotify?.("Restored original image reference.", "success");
    onForceSaveDocument?.(result.nextContent);
    closeContextMenu({ restoreFocus: false });
  };

  const openReplaceFromMenu = () => {
    if (!contextMenu?.isWorkspaceImage) {
      onNotify?.("Replace is available for workspace images only.", "info");
      closeContextMenu();
      return;
    }

    setReplaceState({ busy: false, assetPath: contextMenu.assetPath });
    closeContextMenu();
    replaceInputRef.current?.click();
  };

  const handleReplaceImageFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !basePath || !replaceState.assetPath) {
      event.target.value = "";
      return;
    }

    setReplaceState((current) => ({ ...current, busy: true }));
    try {
      const dataUrl = await readFileAsDataUrl(file);
      await replaceImage(basePath, replaceState.assetPath, dataUrl);
      imageResolveCacheRef.current.delete(imageCacheKey(replaceState.assetPath));
      imageResolveCacheRef.current.delete(imageCacheKey(replaceState.assetPath, "original"));
      const originalStatus = await getImageOriginalStatus(basePath, replaceState.assetPath).catch(() => ({ hasOriginal: false }));

      if (previewRef.current) {
        previewRef.current.querySelectorAll("img").forEach((image) => {
          if ((image.getAttribute("data-asset-path") || "") === replaceState.assetPath) {
            image.src = dataUrl;
            applyImageOriginalBadge(image, Boolean(originalStatus?.hasOriginal));
          }
        });
      }

      onNotify?.("Image replaced.", "success");
    } catch (error) {
      onNotify?.(error?.message || "Unable to replace image.", "error");
    } finally {
      setReplaceState({ busy: false, assetPath: "" });
      event.target.value = "";
    }
  };

  const handleDeleteFromMenu = async () => {
    if (!contextMenu?.isWorkspaceImage || !basePath || !contextMenu.assetPath) {
      onNotify?.("Delete is available for workspace images only.", "info");
      closeContextMenu();
      return;
    }

    const approved = await confirm({
      title: "Remove Image?",
      message: "Remove this image? Links are removed first; the image file is kept if it is referenced elsewhere.",
      confirmLabel: "Remove",
      cancelLabel: "Cancel",
      variant: "danger"
    });
    if (!approved) {
      closeContextMenu();
      return;
    }

    try {
      const result = await deleteImage(basePath, contextMenu.assetPath);
      imageResolveCacheRef.current.delete(imageCacheKey(contextMenu.assetPath));

      if (previewRef.current) {
        previewRef.current.querySelectorAll("img").forEach((image) => {
          if ((image.getAttribute("data-asset-path") || "") === contextMenu.assetPath) {
            image.removeAttribute("src");
          }
        });
      }

      if (typeof onContentChange === "function" && Number(result?.referencesRemoved || 0) > 0) {
        const nextContent = removeImageReferenceFromMarkdown(content, contextMenu.assetPath);
        if (nextContent !== String(content || "")) {
          onContentChange(nextContent);
        }
      }

      const message = formatImageDeleteResult(result);
      onNotify?.(message, "success");
    } catch (error) {
      onNotify?.(error?.message || "Unable to delete image.", "error");
    } finally {
      closeContextMenu();
    }
  };

  const handleRenameFromMenu = async () => {
    if (!contextMenu?.isWorkspaceImage || !basePath || !contextMenu.assetPath) {
      onNotify?.("Rename is available for workspace images only.", "info");
      closeContextMenu();
      return;
    }

    const currentFileName = contextMenu.assetPath.split("/").pop() || "image.png";
    const nextFileName = window.prompt("Rename image file", currentFileName);
    if (!nextFileName || !nextFileName.trim()) {
      closeContextMenu();
      return;
    }

    const oldAssetPath = contextMenu.assetPath;
    try {
      const renamedAssetPath = await renameImage(basePath, oldAssetPath, nextFileName.trim());
      const normalizedNewAssetPath = encodeURI(String(renamedAssetPath || "").trim());

      imageResolveCacheRef.current.delete(imageCacheKey(oldAssetPath));
      if (previewRef.current) {
        previewRef.current.querySelectorAll("img").forEach((image) => {
          if ((image.getAttribute("data-asset-path") || "") === oldAssetPath) {
            image.setAttribute("data-asset-path", normalizedNewAssetPath);
            image.setAttribute("src", normalizedNewAssetPath);
          }
        });
      }

      if (typeof onContentChange === "function") {
        let nextContent = String(content || "");
        nextContent = replaceAllLiteral(nextContent, oldAssetPath, normalizedNewAssetPath);

        try {
          const decodedOld = decodeURIComponent(oldAssetPath);
          if (decodedOld && decodedOld !== oldAssetPath) {
            nextContent = replaceAllLiteral(nextContent, decodedOld, normalizedNewAssetPath);
          }
        } catch {
          // Keep best-effort replacement.
        }

        if (nextContent !== String(content || "")) {
          onContentChange(nextContent);
        }
      }

      onNotify?.("Image renamed and markdown updated.", "success");
    } catch (error) {
      onNotify?.(error?.message || "Unable to rename image.", "error");
    } finally {
      closeContextMenu();
    }
  };

  const imageMenuActions = [
    {
      key: "view-image",
      label: "View image",
      icon: <ExternalLink size={16} />,
      onSelect: viewImageFromMenu,
      disabled: false,
    },
    {
      key: "crop",
      label: "Edit image",
      icon: <Pencil size={16} />,
      onSelect: openCropFromMenu,
      disabled: false,
    },
    {
      key: "edit-excalidraw",
      label: "Edit with Excalidraw",
      icon: <Pencil size={16} />,
      onSelect: openExcalidrawFromImageMenu,
      disabled: false,
    },
    {
      key: "copy",
      label: "Copy markdown",
      icon: <Copy size={16} />,
      onSelect: copyMarkdownFromMenu,
      disabled: false,
    },
    {
      key: "replace",
      label: "Replace image",
      icon: <RefreshCw size={16} />,
      onSelect: openReplaceFromMenu,
      disabled: replaceState.busy,
    },
    {
      key: "rename",
      label: "Rename image",
      icon: <Pencil size={16} />,
      onSelect: handleRenameFromMenu,
      disabled: replaceState.busy,
    },
    {
      key: "delete",
      label: "Delete image",
      icon: <Trash2 size={16} />,
      onSelect: handleDeleteFromMenu,
      disabled: replaceState.busy,
    },
  ];

  const diagramMenuActions = [
    {
      key: "edit-diagram",
      label: "Edit diagram",
      icon: <Pencil size={16} />,
      onSelect: editDiagramFromMenu,
      disabled: false,
    },
    {
      key: "copy-diagram",
      label: "Copy diagram markdown",
      icon: <Copy size={16} />,
      onSelect: copyDiagramMarkdownFromMenu,
      disabled: false,
    },
  ];

  if (contextMenu?.originAssetPath) {
    diagramMenuActions.push({
      key: "restore-original",
      label: "Restore original image",
      icon: <RotateCcw size={16} />,
      onSelect: restoreOriginalImageFromDiagramMenu,
      disabled: false,
    });
  }

  const textMenuActions = [
    {
      key: "copy-text",
      label: "Copy selection",
      icon: <Copy size={16} />,
      onSelect: () => {
        navigator.clipboard.writeText(contextMenu?.selectedText || "").then(() => {
          onNotify?.("Copied to clipboard", "success");
        }).catch(() => {
          onNotify?.("Failed to copy text", "error");
        });
        closeContextMenu();
      },
      disabled: false,
    },
    {
      key: "search-text",
      label: "Find in document",
      icon: <Search size={16} />,
      onSelect: () => {
        onSearchRequest?.(contextMenu?.selectedText || "");
        closeContextMenu();
      },
      disabled: false,
    }
  ];

  const activeMenuActions =
    contextMenu?.kind === "text"
      ? textMenuActions
      : contextMenu?.kind === "diagram"
      ? diagramMenuActions
      : imageMenuActions;

  const handleMenuKeyDown = (event) => {
    if (!contextMenu) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeContextMenu();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setMenuIndex((current) => (current + 1) % activeMenuActions.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setMenuIndex((current) => (current - 1 + activeMenuActions.length) % activeMenuActions.length);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setMenuIndex(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      setMenuIndex(activeMenuActions.length - 1);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const action = activeMenuActions[menuIndex];
      if (!action?.disabled) {
        action.onSelect();
      }
    }
  };

  const closeCropModal = () => {
    if (cropSaving) return;
    setCropState({ open: false, src: "", assetPath: "", imageLabel: "", annotation: null, hasOriginal: false, annotationOnly: false });
  };

  const handleRestoreOriginal = async () => {
    if (!basePath || !cropState.assetPath || !cropState.hasOriginal) return "";
    const approved = await confirm({
      title: "Restore Original?",
      message: "Restore the original image from .notes-app backup? This will overwrite the current edited image.",
      confirmLabel: "Restore",
      cancelLabel: "Cancel",
      variant: "danger"
    });
    if (!approved) return "";

    try {
      await restoreImageOriginal(basePath, cropState.assetPath);
      imageResolveCacheRef.current.delete(imageCacheKey(cropState.assetPath));
      imageResolveCacheRef.current.delete(imageCacheKey(cropState.assetPath, "original"));

      const fullSizeSrc = await readImage(basePath, cropState.assetPath);
      const previewImage = showOriginalImages
        ? fullSizeSrc
        : await readImage(basePath, cropState.assetPath, { thumbnail: true }).catch(() => fullSizeSrc);

      // Update cropState.src so that the ImageCropModal's imageSrc prop reflects the
      // restored original. Without this, subsequent rotation in the modal would still
      // use the old (edited) image as its base, producing degraded output.
      if (fullSizeSrc) {
        setCropState((prev) => ({ ...prev, src: fullSizeSrc }));
      }

      if (previewRef.current) {
        previewRef.current.querySelectorAll("img").forEach((image) => {
          if ((image.getAttribute("data-asset-path") || "") === cropState.assetPath) {
            image.src = previewImage || fullSizeSrc;
            applyImageOriginalBadge(image, true);
          }
        });
      }

      return fullSizeSrc || previewImage || "";
    } catch (error) {
      onNotify?.(error?.message || "Unable to restore original image.", "error");
      return "";
    }
  };

  const handleSaveCrop = async (editedDataUrl, annotation) => {
    if (!basePath || !cropState.assetPath) return;
    setCropSaving(true);
    const targetAssetPath = cropState.assetPath;

    try {
      if (editedDataUrl) {
        imageResolveCacheRef.current.delete(imageCacheKey(targetAssetPath));
        imageResolveCacheRef.current.delete(imageCacheKey(targetAssetPath, "original"));
        if (previewRef.current) {
          previewRef.current.querySelectorAll("img").forEach((image) => {
            if ((image.getAttribute("data-asset-path") || "") === targetAssetPath) {
              image.src = editedDataUrl;
            }
          });
        }
        await replaceImage(basePath, targetAssetPath, editedDataUrl);
      }

      const savedAnnotation = await setImageAnnotation(basePath, targetAssetPath, annotation);
      const originalStatus = await getImageOriginalStatus(basePath, targetAssetPath).catch(() => ({ hasOriginal: false }));
      if (previewRef.current) {
        previewRef.current.querySelectorAll("img").forEach((image) => {
          if ((image.getAttribute("data-asset-path") || "") === targetAssetPath) {
            applyImageAnnotation(image, savedAnnotation);
            applyImageOriginalBadge(image, Boolean(originalStatus?.hasOriginal));
          }
        });
      }

      onNotify?.(editedDataUrl ? "Image edit saved." : "Image annotation saved.", "success");
      onForceSaveDocument?.();
      setCropState({ open: false, src: "", assetPath: "", imageLabel: "", annotation: null, hasOriginal: false, annotationOnly: false });
    } catch (error) {
      imageResolveCacheRef.current.delete(imageCacheKey(targetAssetPath));
      onNotify?.(error?.message || "Unable to save image edit.", "error");
    } finally {
      setCropSaving(false);
    }
  };

  return (
    <>
      <div
        className="preview"
        onContextMenu={openImageContextMenu}
        onKeyDown={handlePreviewKeyDown}
        onClick={(e) => {
          const taskBtn = e.target.closest?.(".task-preview-link");
          if (taskBtn) {
            e.preventDefault();
            e.stopPropagation();
            const rawTitle = taskBtn.getAttribute("data-task-title") || taskBtn.textContent || "";
            const status = taskBtn.getAttribute("data-task-status") || "open";
            const lineAttr = taskBtn.closest("[data-source-line]")?.getAttribute("data-source-line");
            const sourceLine = lineAttr ? parseInt(lineAttr, 10) : null;

            onOpenTaskDetails?.({
              title: String(rawTitle).replace(/^\[[ xX]\]\s*/, "").trim(),
              status,
              sourceLine,
              filePath: basePath,
            });
          }
        }}
        ref={(node) => {
          previewRef.current = node;
          if (externalRef && typeof externalRef === "object") {
            externalRef.current = node;
          }
        }}
      >
      {parts.map((part, index) => {
        const blockKey =
          part.type === "mermaid"
            ? `mermaid-${part.startLine}-${part.value.slice(0, 35)}`
            : part.type === "excalidraw"
            ? part.diagramId ? `excalidraw-${part.diagramId}` : `excalidraw-${part.startLine}-${part.imagePath}`
            : part.type === "drawio"
            ? part.diagramId ? `drawio-${part.diagramId}` : `drawio-${part.startLine}-${part.imagePath}`
            : `md-${part.startLine}-${part.value.slice(0, 30)}`;

        return part.type === "mermaid" ? (
          <MermaidBlock
            code={part.value}
            index={index}
            key={blockKey}
            onNotify={onNotify}
            onEdit={(codeToEdit) => {
              if (!readOnly) {
                setMermaidEditState({
                  open: true,
                  initialCode: codeToEdit,
                  originalBlockCode: part.value,
                });
              }
            }}
          />
        ) : part.type === "excalidraw" ? (
          readOnly ? (
            <div key={blockKey} className="excalidraw-block">
              <div className="excalidraw-preview-container" style={{ cursor: "default", pointerEvents: "none" }}>
                {part.imagePath ? (
                  <div className="excalidraw-preview-thumbnail">
                    <img src={part.imagePath} alt="Diagram" className="diagram-image" />
                  </div>
                ) : (
                  <div className="excalidraw-empty-state" style={{ pointerEvents: "none" }}>
                    <div className="empty-icon">📐</div>
                    <span>Excalidraw diagram</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <ExcalidrawBlock
              imagePath={part.imagePath}
              diagramId={part.diagramId}
              originAssetPath={part.originAssetPath}
              originAltText={part.originAltText}
              documentPath={basePath}
              onNotify={onNotify}
              index={index}
              key={blockKey}
              onForceSaveNote={onForceSaveDocument}
            />
          )
        ) : part.type === "drawio" ? (
          readOnly ? (
            <div key={blockKey} className="drawio-block">
              {part.imagePath ? (
                <img src={part.imagePath} alt="Draw.io diagram" style={{ maxWidth: "100%", display: "block" }} />
              ) : (
                <div style={{ padding: "12px", color: "var(--text-muted)", fontSize: "12px", fontStyle: "italic" }}>
                  Draw.io diagram
                </div>
              )}
            </div>
          ) : (
            <DrawioBlock
              imagePath={part.imagePath}
              diagramId={part.diagramId}
              documentPath={basePath}
              onNotify={onNotify}
              key={blockKey}
              onForceSaveNote={onForceSaveDocument}
            />
          )
        ) : (
          <div
            key={blockKey}
            dangerouslySetInnerHTML={{
              __html: renderMarkdown(normalizeMarkdownImagePaths(part.value), {
                sourceLineOffset: part.startLine || 0,
              }),
            }}
          />
        );
      })}
      </div>
      {contextMenu ? (
        <div
          ref={menuRef}
          className="editor-context-menu"
          style={{
            left: Number.isFinite(contextMenu.x) ? contextMenu.x : contextMenu.anchorX,
            top: Number.isFinite(contextMenu.y) ? contextMenu.y : contextMenu.anchorY,
          }}
          role="menu"
          aria-label="Image context menu"
          onKeyDown={handleMenuKeyDown}
        >
          <div className="editor-context-menu-group">
            <div className="editor-context-menu-label">
              {contextMenu?.kind === "diagram" ? "Diagram actions" : contextMenu?.kind === "text" ? "Text actions" : "Image actions"}
            </div>
            {activeMenuActions.map((action, index) => (
              <button
                key={action.key}
                type="button"
                role="menuitem"
                ref={(node) => {
                  menuItemsRef.current[index] = node;
                }}
                onClick={action.onSelect}
                disabled={action.disabled}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleReplaceImageFile}
      />
      <PreviewModalsContainer
        diagramEditState={diagramEditState}
        closeDiagramEditor={closeDiagramEditor}
        saveExcalidrawFromImageMenu={saveExcalidrawFromImageMenu}
        cropState={cropState}
        cropSaving={cropSaving}
        closeCropModal={closeCropModal}
        handleRestoreOriginal={handleRestoreOriginal}
        handleSaveCrop={handleSaveCrop}
        codeEditState={codeEditState}
        setCodeEditState={setCodeEditState}
        onContentChange={onContentChange}
        onForceSaveDocument={onForceSaveDocument}
        onNotify={onNotify}
        content={content}
        replaceCodeBlockAtLine={replaceCodeBlockAtLine}
        tableEditState={tableEditState}
        setTableEditState={setTableEditState}
        mermaidEditState={mermaidEditState}
        setMermaidEditState={setMermaidEditState}
      />
    </>
  );
});

