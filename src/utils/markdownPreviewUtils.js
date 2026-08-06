import { createImageMarkdown } from "./markdownUtils";
import { toComparableAssetPath } from "./imageMarkdownReferences";

export function replaceAllLiteral(source, needle, replacement) {
  if (!needle || needle === replacement) return source;
  return String(source || "").split(needle).join(replacement);
}

export function imageCacheKey(assetPath, variant = "thumbnail") {
  return `${variant}:${assetPath}`;
}

export function getImageActionElement(target) {
  if (!(target instanceof HTMLElement)) return null;
  if (target.closest?.(".excalidraw-block")) return null;
  if (target.tagName === "IMG") return target;
  const frame = target.closest?.(".markdown-image-frame");
  const framedImage = frame?.querySelector?.("img");
  return framedImage instanceof HTMLImageElement ? framedImage : null;
}

export function getExcalidrawActionContext(target) {
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

export function sanitizeAttributeValue(value) {
  return String(value || "").replace(/"/g, "&quot;");
}

export function replaceDiagramReferenceWithOriginal(content, options = {}) {
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
