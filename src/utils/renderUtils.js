/**
 * Markdown rendering and processing utilities
 */

import MarkdownIt from "markdown-it";
import hljs from "highlight.js";

const md = new MarkdownIt({
  html: false,
  linkify: false,
  typographer: true,
});

md.validateLink = (url) => {
  const urlLower = String(url || "").trim().toLowerCase();
  if (
    urlLower.startsWith("http://") ||
    urlLower.startsWith("https://") ||
    urlLower.startsWith("mailto:") ||
    urlLower.startsWith("ftp://") ||
    urlLower.startsWith("file://")
  ) {
    return true;
  }
  // Allow relative and local paths (e.g. ./path, ../path, path/to/file)
  // Ensure no unsafe protocol schemes like javascript: are allowed
  return !/^[a-z+.-]+:/i.test(urlLower);
};

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

function highlightCode(content, language) {
  const code = String(content || "");
  const lang = String(language || "").trim().toLowerCase();

  try {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
    }
    return hljs.highlightAuto(code).value;
  } catch {
    return escapeHtml(code);
  }
}

function getLanguageDisplayLabel(language) {
  const normalized = String(language || "").trim().toLowerCase();
  if (!normalized) return "text";

  const aliases = {
    js: "JavaScript",
    jsx: "JSX",
    ts: "TypeScript",
    tsx: "TSX",
    py: "Python",
    sh: "Shell",
    bash: "Bash",
    zsh: "Zsh",
    ps1: "PowerShell",
    csharp: "C#",
    cs: "C#",
    cpp: "C++",
    yml: "YAML",
    md: "Markdown",
    html: "HTML",
    css: "CSS",
    json: "JSON",
    sql: "SQL",
    xml: "XML",
    plaintext: "text",
    text: "text",
  };

  return aliases[normalized] || normalized;
}

md.renderer.rules.fence = (tokens, idx, options, env) => {
  const token = tokens[idx];
  const info = String(token.info || "").trim();
  const language = (info.split(/\s+/)[0] || "").toLowerCase();
  const languageLabel = getLanguageDisplayLabel(language);
  const rawCode = String(token.content || "").replace(/\n$/, "");
  const highlighted = highlightCode(rawCode, language);
  const highlightedLines = highlighted.split(/\r?\n/);
  const rawCodeData = encodeURIComponent(rawCode);
  const lineOffset = Number(env?.sourceLineOffset) || 0;
  const sourceStartLine = Array.isArray(token.map) ? (Number(token.map[0]) || 0) + lineOffset + 1 : 0;
  const sourceLineAttr = sourceStartLine > 0 ? ` data-source-line="${sourceStartLine}"` : "";

  const numberedHtml = highlightedLines
    .map((line, lineIndex) => {
      const lineContent = line || "&nbsp;";
      const mappedLine = sourceStartLine > 0 ? sourceStartLine + lineIndex : 0;
      const mappedLineAttr = mappedLine > 0 ? ` data-source-line="${mappedLine}"` : "";
      return `<span class="markdown-code-line"${mappedLineAttr}><span class="markdown-code-line-number" aria-hidden="true">${lineIndex + 1}</span><span class="markdown-code-line-content">${lineContent}</span></span>`;
    })
    .join("");

  const canRun = language === "javascript" || language === "js" || language === "python" || language === "py";
  const runTooltip = canRun ? "Run code block" : "Only JavaScript and Python code blocks can be executed locally";
  const runBtnHtml = `<button type="button" class="markdown-code-copy" ${canRun ? `data-code-run="true" data-code-lang="${escapeHtml(language)}" data-code-raw="${rawCodeData}"` : `disabled style="opacity: 0.35; cursor: not-allowed;"`} aria-label="Run code block" data-tooltip="${escapeHtml(runTooltip)}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-play" style="opacity:0.8; margin-top:2px;"><polygon points="6 3 20 12 6 21 6 3"/></svg></button>`;

  return `<figure class="markdown-code-block"${sourceLineAttr}><figcaption class="markdown-code-header"><span class="markdown-code-lang">${escapeHtml(languageLabel)}</span><div style="display:flex;gap:4px;">${runBtnHtml}<button type="button" class="markdown-code-copy" data-code-format="true" data-code-lang="${escapeHtml(language)}" data-code-raw="${rawCodeData}" aria-label="Format code block" data-tooltip="Format code"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-wand-2" style="opacity:0.8; margin-top:2px;"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/></svg></button><button type="button" class="markdown-code-copy" data-code-edit="true" data-code-lang="${escapeHtml(language)}" data-code-raw="${rawCodeData}" aria-label="Edit code block" data-tooltip="Edit code"><span class="markdown-code-edit-icon" aria-hidden="true" style="font-size:12px; opacity:0.8;">✎</span></button><button type="button" class="markdown-code-copy" data-code-copy="true" data-code-raw="${rawCodeData}" aria-label="Copy code block" data-tooltip="Copy code"><span class="markdown-code-copy-icon" aria-hidden="true"></span></button></div></figcaption><pre class="markdown-code-pre"><code class="hljs${language ? ` language-${escapeHtml(language)}` : ""}">${numberedHtml}</code></pre></figure>`;
};

md.core.ruler.push("notely-source-lines", (state) => {
  const offset = Number(state.env?.sourceLineOffset) || 0;
  state.tokens.forEach((token) => {
    if (token.nesting === 1 && Array.isArray(token.map)) {
      token.attrSet("data-source-line", String(token.map[0] + offset + 1));
    }
  });
});

md.renderer.rules.table_open = (tokens, idx, options, env) => {
  const token = tokens[idx];
  const mappedLine = Array.isArray(token.map) ? (Number(token.map[0]) || 0) + (Number(env?.sourceLineOffset) || 0) + 1 : 0;
  const attrLine = Number(token.attrGet("data-source-line")) || 0;
  const sourceStartLine = mappedLine || attrLine;
  const lineAttr = sourceStartLine > 0 ? ` data-source-line="${sourceStartLine}"` : "";
  return `<div class="markdown-table-wrapper"${lineAttr} role="button" tabindex="0" title="Click to edit table"><div class="markdown-block-actions"><button type="button" class="markdown-block-action-btn" data-table-action="edit" aria-label="Edit table" data-tooltip="Edit table"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg><span>Edit</span></button><span class="markdown-block-action-separator"></span><button type="button" class="markdown-block-action-btn" data-table-action="export-image" aria-label="Download table image" data-tooltip="Download table image (PNG)"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg><span>Download Image</span></button><span class="markdown-block-action-separator"></span><button type="button" class="markdown-block-action-btn" data-table-action="export-csv" aria-label="Download table CSV" data-tooltip="Download table CSV"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg><span>Download CSV</span></button></div><table>`;
};

md.renderer.rules.table_close = () => {
  return `</table></div>`;
};

const defaultLinkOpenRenderer = md.renderer.rules.link_open || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
const defaultLinkCloseRenderer = md.renderer.rules.link_close || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const openHtml = defaultLinkOpenRenderer(tokens, idx, options, env, self);
  return `<span class="markdown-link-wrapper">${openHtml}`;
};

md.renderer.rules.link_close = (tokens, idx, options, env, self) => {
  let href = "";
  for (let i = idx - 1; i >= 0; i--) {
    if (tokens[i].type === "link_open") {
      href = tokens[i].attrGet("href") || "";
      break;
    }
  }
  const isWebUrl = /^https?:\/\/|^\/\//i.test(href);
  const closeHtml = defaultLinkCloseRenderer(tokens, idx, options, env, self);
  const safeHref = escapeHtml(href);

  const copyBtn = `<button type="button" class="link-hover-popup-btn" data-link-action="copy" data-href="${safeHref}" aria-label="Copy link"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg><span>Copy</span></button>`;
  const revealBtn = `<span class="link-hover-popup-separator"></span><button type="button" class="link-hover-popup-btn" data-link-action="reveal" data-href="${safeHref}" aria-label="Reveal in Explorer"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg><span>Reveal in Explorer</span></button>`;
  const openFileBtn = !isWebUrl ? `<span class="link-hover-popup-separator"></span><button type="button" class="link-hover-popup-btn" data-link-action="open-file" data-href="${safeHref}" aria-label="Open file"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg><span>Open File</span></button>` : "";
  const downloadBtn = !isWebUrl ? `<span class="link-hover-popup-separator"></span><button type="button" class="link-hover-popup-btn" data-link-action="download" data-href="${safeHref}" aria-label="Download file"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg><span>Download</span></button>` : "";

  const popoverHtml = `<span class="markdown-link-popover">${copyBtn}${revealBtn}${openFileBtn}${downloadBtn}</span>`;

  return `${closeHtml}${popoverHtml}</span>`;
};

md.renderer.rules.image = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const src = token.attrGet("src") || "";
  const isVideo = /\.(webm|mp4|ogg)(\?|#|$)/i.test(src);

  if (isVideo) {
    const safeSrc = escapeHtml(src);
    const label = getImageDisplayName(src, token.content || token.attrGet("alt") || "Video");
    return `<span class="markdown-image-frame markdown-video-card" data-asset-path="${safeSrc}" data-video-src="${safeSrc}" data-video-title="${escapeHtml(label)}" role="button" tabindex="0" title="Click to play video" style="cursor:pointer;position:relative;display:inline-block;"><video src="${safeSrc}" preload="metadata" style="max-width:100%;max-height:280px;border-radius:6px;object-fit:cover;pointer-events:none;display:block;"></video><span class="markdown-video-play-badge" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(15,23,42,0.85);backdrop-filter:blur(6px);color:#fff;padding:8px 16px;border-radius:999px;font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px;box-shadow:0 4px 16px rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.2);pointer-events:none;">▶ Play Video</span><span class="markdown-image-name" data-tooltip="${escapeHtml(label)}">${escapeHtml(label)}</span></span>`;
  }

  if (src && !token.attrGet("data-asset-path") && !/^(data:|blob:)/i.test(src)) {
    token.attrSet("data-asset-path", src);
  }
  const label = getImageDisplayName(src, token.content || token.attrGet("alt") || "Image");
  const imageHtml = defaultImageRenderer(tokens, idx, options, env, self);
  return `<span class="markdown-image-frame">${imageHtml}<span class="markdown-image-actions"><button type="button" class="markdown-image-action" data-image-action="view" aria-label="View image"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg><span>View</span></button><span class="markdown-image-action-separator"></span><button type="button" class="markdown-image-action" data-image-action="annotate" aria-label="Annotate image"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg><span>Annotate</span></button><span class="markdown-image-action-separator"></span><button type="button" class="markdown-image-action" data-image-action="edit" aria-label="Edit image"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg><span>Edit</span></button><span class="markdown-image-action-separator"></span><button type="button" class="markdown-image-action" data-image-action="download" aria-label="Download image"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg><span>Download</span></button></span><span class="markdown-image-name" data-tooltip="${escapeHtml(label)}">${escapeHtml(label)}</span></span>`;
};


/**
 * Normalizes markdown links (e.g. [text](url)) so that URLs with spaces,
 * backslashes, or raw file paths parse correctly with MarkdownIt.
 */
export function normalizeMarkdownLinks(content) {
  if (!content) return content;

  // 1. Clean LLM backslash-escaped markdown link delimiters
  let text = String(content)
    .replace(/\]\\\(file:/gi, '](file:')
    .replace(/\]\\\(/gi, '](')
    .replace(/(file:[^)]+)\\\)/gi, '$1)');

  // 2. Process explicit markdown links: [alt](url) or [alt](<url>)
  let normalized = text.replace(/\[([^\]]+)\]\((<[^>]+>|[^)]+)\)/g, (_match, linkText, rawUrl) => {
    const trimmed = (rawUrl || "").trim();
    const isAngleWrapped = trimmed.startsWith("<") && trimmed.endsWith(">");
    let url = isAngleWrapped ? trimmed.slice(1, -1) : trimmed;

    if (url.toLowerCase().startsWith("file:") || /^[a-z]:[\\/]/i.test(url)) {
      url = url.replace(/\\/g, "/");
      if (/^[a-z]:\//i.test(url)) {
        url = `file:///${url}`;
      }
    }

    let decoded = url;
    for (let i = 0; i < 3; i += 1) {
      try {
        const next = decodeURIComponent(decoded);
        if (next === decoded) break;
        decoded = next;
      } catch {
        break;
      }
    }

    const safeUrl = encodeURI(decoded);
    return `[${linkText}](${safeUrl})`;
  });

  return normalized;
}

export function renderCallouts(html) {
  if (!html || typeof html !== "string" || !html.includes("<blockquote")) return html;

  const calloutConfigs = {
    NOTE: { title: "Note", icon: "ℹ️", class: "callout-note" },
    INFO: { title: "Info", icon: "ℹ️", class: "callout-note" },
    WARNING: { title: "Warning", icon: "⚠️", class: "callout-warning" },
    TIP: { title: "Tip", icon: "💡", class: "callout-tip" },
    HINT: { title: "Hint", icon: "💡", class: "callout-tip" },
    TODO: { title: "Todo", icon: "📝", class: "callout-todo" },
    IMPORTANT: { title: "Important", icon: "🌟", class: "callout-important" },
    CAUTION: { title: "Caution", icon: "🚫", class: "callout-caution" },
    DANGER: { title: "Danger", icon: "🚫", class: "callout-caution" },
    ERROR: { title: "Error", icon: "🚫", class: "callout-caution" },
    BUG: { title: "Bug", icon: "🐛", class: "callout-caution" },
    SUCCESS: { title: "Success", icon: "✅", class: "callout-tip" },
    QUESTION: { title: "Question", icon: "❓", class: "callout-todo" },
    QUOTE: { title: "Quote", icon: "💬", class: "callout-note" },
    ABSTRACT: { title: "Abstract", icon: "📋", class: "callout-important" },
    SUMMARY: { title: "Summary", icon: "📋", class: "callout-important" },
    EXAMPLE: { title: "Example", icon: "🔍", class: "callout-note" },
  };

  const bqRegex = /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi;

  return html.replace(bqRegex, (fullMatch, innerContent) => {
    const headerMatch = innerContent.match(/^\s*(?:<p[^>]*>\s*)?\[!([A-Za-z0-9_-]+)\]([^\n<]*)(?:<br\s*\/?>)?/i);
    if (!headerMatch) return fullMatch;

    const rawType = headerMatch[1].toUpperCase();
    const customTitle = headerMatch[2].trim();
    const config = calloutConfigs[rawType] || {
      title: rawType.charAt(0) + rawType.slice(1).toLowerCase(),
      icon: "📌",
      class: "callout-note",
    };

    const displayTitle = customTitle || config.title;

    let bodyContent = innerContent.replace(headerMatch[0], "").trim();
    bodyContent = bodyContent.replace(/^<\/p>/i, "").trim();

    if (bodyContent && !bodyContent.startsWith("<p>") && !bodyContent.startsWith("<div") && !bodyContent.startsWith("<ul") && !bodyContent.startsWith("<ol")) {
      bodyContent = `<p>${bodyContent}`;
    }
    if (bodyContent && bodyContent.startsWith("<p>") && !bodyContent.endsWith("</p>")) {
      bodyContent = `${bodyContent}</p>`;
    }

    return `<div class="notely-callout ${config.class}">
      <div class="notely-callout-header">
        <span class="notely-callout-icon">${config.icon}</span>
        <span class="notely-callout-title">${displayTitle}</span>
      </div>
      <div class="notely-callout-body">
        ${bodyContent}
      </div>
    </div>`;
  });
}

export function renderTaskLinks(html) {
  if (!html || typeof html !== "string" || !html.includes("[") || !html.includes("]")) return html;

  // Protect code blocks and figures from task replacement
  const protectedBlocks = [];
  const protectedHtml = html.replace(/<(figure|pre|code)[^>]*>[\s\S]*?<\/\1>/gi, (match) => {
    const placeholder = `__PROTECTED_BLOCK_${protectedBlocks.length}__`;
    protectedBlocks.push(match);
    return placeholder;
  });

  // Match task checkboxes in block containers (li, p, div)
  const taskBlockRegex = /<(li|p|div)([^>]*)>\s*\[([ xX])\]\s*([\s\S]*?)<\/\1>/gi;

  let processed = protectedHtml.replace(taskBlockRegex, (fullMatch, tag, attrs, rawStatus, innerContent) => {
    const isDone = rawStatus.toLowerCase() === "x";
    const status = isDone ? "done" : "open";
    const cleanText = innerContent.replace(/<[^>]+>/g, "").trim();
    const escapedTitle = String(cleanText)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const itemClass = tag === "li" ? "task-list-item" : "task-paragraph-item";
    const updatedAttrs = attrs.includes('class="')
      ? attrs.replace('class="', `class="${itemClass} `)
      : `${attrs} class="${itemClass}"`;

    return `<${tag}${updatedAttrs}><button type="button" class="task-preview-link ${status}" data-task-status="${status}" data-task-title="${escapedTitle}" data-tooltip="Click to view task details" title="Click to view task details"><span class="task-checkbox-icon">${isDone ? "[x]" : "[ ]"}</span><span class="task-title-text">${innerContent}</span></button></${tag}>`;
  });

  // Restore protected blocks
  protectedBlocks.forEach((block, index) => {
    processed = processed.replace(`__PROTECTED_BLOCK_${index}__`, block);
  });

  return processed;
}

export function renderMarkdown(content, options = {}) {
  const normalized = String(content || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
  const linkNormalized = normalizeMarkdownLinks(normalized);
  const renderedHtml = md.render(linkNormalized, options);
  const withCallouts = renderCallouts(renderedHtml);
  return renderTaskLinks(withCallouts);
}

/**
 * Parse all diagram blocks (mermaid and excalidraw image references)
 * Supports both ```mermaid and image references to excalidraw diagrams
 */
export function parseDiagramBlocks(content) {
  const chunks = [];
  const mermaidRegex = /```mermaid\s*([\s\S]*?)```/gi;
  const excalidrawRegex = /!\[Excalidraw Diagram\]\(((?:\.notes-app\/)?excali-diagrams\/(?:(?:[^/]+\/)?([^/]+))\/diagram\.png|media\/(?:excalidraw|diagrams)\/(?:(?:[^/]+\/)?([^/]+))\/diagram\.png|media\/diagrams\/([^/.]+)\.png)\)\s*(\{[^}]*\})?/gi;
  const drawioRegex = /!\[(?:Drawio|Draw\.io|draw\.io) Diagram\]\(((?:\.notes-app\/drawio-diagrams\/|media\/draw\.io\/|media\/drawio\/)([^/.]+)\.png)\)\s*(\{[^}]*\})?/gi;
  const positions = [];
  let match;

  const readAttribute = (attributeBlock, attributeName) => {
    if (!attributeBlock) return "";
    const pattern = new RegExp(`${attributeName}=["“]([^"”]+)["”]`, "i");
    const attrMatch = String(attributeBlock).match(pattern);
    return attrMatch ? String(attrMatch[1] || "") : "";
  };

  const countLines = (value) => (String(value || "").match(/\n/g) || []).length;

  // Find all mermaid blocks
  while ((match = mermaidRegex.exec(content || ""))) {
    positions.push({
      index: match.index,
      endIndex: mermaidRegex.lastIndex,
      type: "mermaid",
      value: match[1].trim(),
      fullMatch: match[0],
    });
  }

  // Find all excalidraw image references
  while ((match = excalidrawRegex.exec(content || ""))) {
    const attributeBlock = match[4] || "";
    const explicitDiagramId = readAttribute(attributeBlock, "data-diagram-id");
    const originAssetPath = readAttribute(attributeBlock, "data-origin-asset");
    const originAltText = readAttribute(attributeBlock, "data-origin-alt");
    positions.push({
      index: match.index,
      endIndex: excalidrawRegex.lastIndex,
      type: "excalidraw",
      imagePath: match[1],
      // Prefer explicit data-diagram-id if present, else derive from path segment.
      diagramId: explicitDiagramId || match[2] || match[3],
      originAssetPath,
      originAltText,
      fullMatch: match[0],
    });
  }

  // Find all drawio image references
  while ((match = drawioRegex.exec(content || ""))) {
    const attributeBlock = match[3] || "";
    const explicitDiagramId = readAttribute(attributeBlock, "data-diagram-id");
    positions.push({
      index: match.index,
      endIndex: drawioRegex.lastIndex,
      type: "drawio",
      imagePath: match[1],
      diagramId: explicitDiagramId || match[2],
      fullMatch: match[0],
    });
  }

  // Sort by position
  positions.sort((a, b) => a.index - b.index);

  let lastIndex = 0;
  let currentLine = 0;

  positions.forEach((pos) => {
    if (pos.index > lastIndex) {
      const markdownValue = content.slice(lastIndex, pos.index);
      chunks.push({ type: "markdown", value: markdownValue, startLine: currentLine });
      currentLine += countLines(markdownValue);
    }

    if (pos.type === "mermaid") {
      chunks.push({ type: "mermaid", value: pos.value, startLine: currentLine });
    } else if (pos.type === "excalidraw") {
      chunks.push({
        type: "excalidraw",
        imagePath: pos.imagePath,
        diagramId: pos.diagramId,
        originAssetPath: pos.originAssetPath,
        originAltText: pos.originAltText,
        startLine: currentLine,
      });
    } else if (pos.type === "drawio") {
      chunks.push({
        type: "drawio",
        imagePath: pos.imagePath,
        diagramId: pos.diagramId,
        startLine: currentLine,
      });
    }
    
    currentLine += countLines(pos.fullMatch);
    lastIndex = pos.endIndex;
  });

  if (lastIndex < (content || "").length) {
    chunks.push({ type: "markdown", value: content.slice(lastIndex), startLine: currentLine });
  }

  return chunks.length ? chunks : [{ type: "markdown", value: content || "", startLine: 0 }];
}

/**
 * Legacy function - kept for backward compatibility
 * Use parseDiagramBlocks instead for both mermaid and excalidraw
 */
export function parseMermaidBlocks(content) {
  const chunks = [];
  const regex = /```mermaid\s*([\s\S]*?)```/gi;
  let lastIndex = 0;
  let currentLine = 0;
  let match;

  const countLines = (value) => (String(value || "").match(/\n/g) || []).length;

  while ((match = regex.exec(content || ""))) {
    if (match.index > lastIndex) {
      const markdownValue = content.slice(lastIndex, match.index);
      chunks.push({ type: "markdown", value: markdownValue, startLine: currentLine });
      currentLine += countLines(markdownValue);
    }

    chunks.push({ type: "mermaid", value: match[1].trim(), startLine: currentLine });
    currentLine += countLines(match[0]);
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < (content || "").length) {
    chunks.push({ type: "markdown", value: content.slice(lastIndex), startLine: currentLine });
  }

  return chunks.length ? chunks : [{ type: "markdown", value: content || "", startLine: 0 }];
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
