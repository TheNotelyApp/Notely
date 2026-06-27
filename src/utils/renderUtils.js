/**
 * Markdown rendering and processing utilities
 */

import MarkdownIt from "markdown-it";

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
});

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getImageDisplayName(src, fallback) {
  const cleanSrc = String(src || "").split(/[?#]/)[0];
  const rawName = cleanSrc.split(/[\\/]/).pop() || fallback || "Image";
  try {
    return decodeURIComponent(rawName) || rawName;
  } catch {
    return rawName;
  }
}

const defaultImageRenderer = md.renderer.rules.image
  || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));

md.renderer.rules.image = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const src = token.attrGet("src") || "";
  const label = getImageDisplayName(src, token.content || token.attrGet("alt") || "Image");
  const imageHtml = defaultImageRenderer(tokens, idx, options, env, self);
  return `<span class="markdown-image-frame">${imageHtml}<span class="markdown-image-name" title="${escapeHtml(label)}">${escapeHtml(label)}</span></span>`;
};

export function renderMarkdown(content) {
  return md.render(content || "");
}

export function parseMermaidBlocks(content) {
  const chunks = [];
  const regex = /```mermaid\s*([\s\S]*?)```/gi;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content || ""))) {
    if (match.index > lastIndex) {
      chunks.push({ type: "markdown", value: content.slice(lastIndex, match.index) });
    }
    chunks.push({ type: "mermaid", value: match[1].trim() });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < (content || "").length) {
    chunks.push({ type: "markdown", value: content.slice(lastIndex) });
  }

  return chunks.length ? chunks : [{ type: "markdown", value: content || "" }];
}

export function normalizeMarkdownImagePaths(content) {
  if (!content) return content;

  return content.replace(/!\[([^\]]*)\]\((<[^>]+>|[^)]+)\)/g, (match, alt, rawPath) => {
    const trimmed = (rawPath || "").trim();
    const unwrapped =
      trimmed.startsWith("<") && trimmed.endsWith(">")
        ? trimmed.slice(1, -1)
        : trimmed;

    let decoded = unwrapped;
    for (let i = 0; i < 5; i += 1) {
      try {
        const next = decodeURIComponent(decoded);
        if (next === decoded) break;
        decoded = next;
      } catch {
        break;
      }
    }

    return `![${alt}](${encodeURI(decoded)})`;
  });
}
