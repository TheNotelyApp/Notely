const { assertTrustedIpcSender } = require("../ipc/ipcSecurity.cjs");
const hljs = require("highlight.js");

function createImageMedia(deps) {
  const {
    BrowserWindow,
    shell,
    fs,
    path,
    crypto,
    nativeImage,
    pathToFileURL,
    getMarkdownIt = deps?.MarkdownIt ? () => deps.MarkdownIt : null,
    buildPdfStyles,
    escapeHtml,
    safeDecode,
    filePathWithin,
    normalizeToPosix,
    ensureDir,
    getActiveProject,
    walkFiles,
    WALK_EXCLUDE_DIRS,
    moveFileToRemoved,
    getUniquePath,
    getNotesRoot,
    getAppDataDir
  } = deps;

  const THUMBNAIL_DIR_NAME = "thumbnails";
  const ORIGINAL_IMAGE_DIR_NAME = "image-originals";
  const THUMBNAIL_MAX_WIDTH = 360;
  const THUMBNAIL_JPEG_QUALITY = 72;
  const RASTER_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp", ".ico"]);

function getOriginalImageBackupPath(imagePath) {
  if (!imagePath) return "";
  const absPath = path.resolve(imagePath);
  const root = getNotesRoot();
  const rawRelative = path.relative(root, absPath);
  const safeRelative = rawRelative.startsWith("..") ? `external_${crypto.createHash("md5").update(absPath).digest("hex")}_${path.basename(absPath)}` : rawRelative;
  return path.join(getAppDataDir(), ORIGINAL_IMAGE_DIR_NAME, safeRelative);
}

function hasOriginalImageBackup(imagePath) {
  const backupPath = getOriginalImageBackupPath(imagePath);
  return Boolean(backupPath && fs.existsSync(backupPath));
}

function ensureOriginalImageBackup(imagePath) {
  if (!imagePath || !fs.existsSync(imagePath) || hasOriginalImageBackup(imagePath)) {
    return hasOriginalImageBackup(imagePath);
  }

  const backupPath = getOriginalImageBackupPath(imagePath);
  ensureDir(path.dirname(backupPath));
  fs.copyFileSync(imagePath, backupPath);
  return true;
}

function removeOriginalImageBackup(imagePath) {
  const backupPath = getOriginalImageBackupPath(imagePath);
  if (!backupPath || !fs.existsSync(backupPath)) return;

  try {
    fs.unlinkSync(backupPath);
  } catch {
    return;
  }

  let currentDir = path.dirname(backupPath);
  const backupRoot = path.join(getAppDataDir(), ORIGINAL_IMAGE_DIR_NAME);
  while (currentDir && currentDir.startsWith(backupRoot) && currentDir !== backupRoot) {
    try {
      if (fs.readdirSync(currentDir).length > 0) break;
      fs.rmdirSync(currentDir);
      currentDir = path.dirname(currentDir);
    } catch {
      break;
    }
  }
}

function moveOriginalImageBackup(fromImagePath, toImagePath) {
  const fromBackupPath = getOriginalImageBackupPath(fromImagePath);
  if (!fromBackupPath || !fs.existsSync(fromBackupPath)) return;

  const toBackupPath = getOriginalImageBackupPath(toImagePath);
  ensureDir(path.dirname(toBackupPath));
  fs.renameSync(fromBackupPath, toBackupPath);
  removeOriginalImageBackup(fromImagePath);
}


function buildPdfExportHtml({ title, markdownContent, baseHref, sourceDir, downsampleImages = false, pdfQualityPreset = "full" }) {
  const MarkdownItCtor = typeof getMarkdownIt === "function" ? getMarkdownIt() : null;
  if (!MarkdownItCtor) {
    throw new Error("Markdown renderer is unavailable.");
  }

  const markdown = new MarkdownItCtor({
    html: false,
    linkify: true,
    typographer: true
  });

  const escapeCodeHtml = (value) => String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const highlightCode = (code, language) => {
    const source = String(code || "");
    const lang = String(language || "").trim().toLowerCase();
    try {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(source, { language: lang, ignoreIllegals: true }).value;
      }
      return hljs.highlightAuto(source).value;
    } catch {
      return escapeCodeHtml(source);
    }
  };

  const getLanguageDisplayLabel = (language) => {
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
  };

  markdown.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx];
    const info = String(token.info || "").trim();
    const language = (info.split(/\s+/)[0] || "").toLowerCase();
    const rawCode = String(token.content || "").replace(/\n$/, "");

    if (language === "mermaid") {
      return `<div class="notely-mermaid-container"><pre class="mermaid">${escapeCodeHtml(rawCode)}</pre></div>`;
    }

    const languageLabel = getLanguageDisplayLabel(language);
    const highlighted = highlightCode(rawCode, language);
    const highlightedLines = highlighted.split(/\r?\n/);

    const numberedHtml = highlightedLines
      .map((line, lineIndex) => {
        const lineContent = line || "&nbsp;";
        return `<span class="markdown-code-line"><span class="markdown-code-line-number">${lineIndex + 1}</span><span class="markdown-code-line-content">${lineContent}</span></span>`;
      })
      .join("");

    return `<figure class="markdown-code-block"><figcaption class="markdown-code-header"><span class="markdown-code-lang">${escapeCodeHtml(languageLabel)}</span></figcaption><pre class="markdown-code-pre"><code class="hljs${language ? ` language-${escapeCodeHtml(language)}` : ""}">${numberedHtml}</code></pre></figure>`;
  };

  const defaultImage = markdown.renderer.rules.image
    || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));

  markdown.renderer.rules.image = (tokens, idx, options, env, self) => {
    const srcIndex = tokens[idx].attrIndex("src");
    let annotation = null;
    if (srcIndex >= 0) {
      const rawSrc = String(tokens[idx].attrs[srcIndex][1] || "").trim();
      const isExplicitAudio = /\.(mp3|wav|m4a|aac|flac|wma)(\?|#|$)/i.test(rawSrc);
      const isAudioDir = /[/\\]audio[/\\]/i.test(rawSrc);
      const isAudioNamed = /(recording|voice|meeting|mic|audio).*?\.(webm|ogg)$/i.test(rawSrc);
      const isAudioAlt = /(audio|voice)/i.test(tokens[idx].content || tokens[idx].attrGet("alt") || "");
      const isAudio = isExplicitAudio || (isAudioDir && /\.(webm|ogg|wav|mp3|m4a|aac|flac)(\?|#|$)/i.test(rawSrc)) || (isAudioNamed && !rawSrc.includes("screen") && !rawSrc.includes("rec_")) || (isAudioAlt && !rawSrc.includes("screen") && /\.(webm|ogg)(\?|#|$)/i.test(rawSrc));

      if (isAudio) {
        const altText = tokens[idx].content || tokens[idx].attrGet("alt") || "Audio Recording";
        const fileName = rawSrc.split(/[?#]/)[0].split(/[/\\]/).pop() || "recording";
        const ext = fileName.split(".").pop()?.toUpperCase() || "AUDIO";
        return `<div class="notely-pdf-audio-card" style="display:inline-flex;align-items:center;gap:12px;padding:10px 16px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;margin:8px 0;page-break-inside:avoid;"><span style="font-size:22px;line-height:1;">🎙️</span><div style="display:flex;flex-direction:column;"><strong style="font-size:13px;color:#0f172a;">${escapeCodeHtml(altText)}</strong><span style="font-size:11px;color:#64748b;">${escapeCodeHtml(fileName)} (${escapeCodeHtml(ext)})</span></div></div>`;
      }

      const isVideo = /\.(webm|mp4|ogg|mov|mkv|avi|m4v)(\?|#|$)/i.test(rawSrc);
      if (isVideo) {
        const altText = tokens[idx].content || tokens[idx].attrGet("alt") || "Video Recording";
        const fileName = rawSrc.split(/[?#]/)[0].split(/[/\\]/).pop() || "recording";
        const ext = fileName.split(".").pop()?.toUpperCase() || "VIDEO";
        return `<div class="notely-pdf-video-card" style="display:inline-flex;align-items:center;gap:12px;padding:10px 16px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;margin:8px 0;page-break-inside:avoid;"><span style="font-size:22px;line-height:1;">🎬</span><div style="display:flex;flex-direction:column;"><strong style="font-size:13px;color:#0f172a;">${escapeCodeHtml(altText)}</strong><span style="font-size:11px;color:#64748b;">${escapeCodeHtml(fileName)} (${escapeCodeHtml(ext)})</span></div></div>`;
      }

      if (rawSrc && !/^(https?:|data:|blob:)/i.test(rawSrc)) {
        const pathPart = rawSrc.split(/[?#]/)[0];
        annotation = getImageAnnotationForMarkdownAsset(path.join(sourceDir || getNotesRoot(), "__notely_export__.md"), pathPart);

        const normalizedSrc = safeDecode(pathPart.replace(/\\/g, "/"));
        const resolvedImagePath = resolveImageAssetPath(
          path.join(sourceDir || getNotesRoot(), "__notely_export__.md"),
          normalizedSrc
        );

        if (resolvedImagePath && fs.existsSync(resolvedImagePath)) {
          tokens[idx].attrs[srcIndex][1] = pathToFileURL(resolvedImagePath).href;
        }

        if (downsampleImages && resolvedImagePath && filePathWithin(getNotesRoot(), resolvedImagePath) && fs.existsSync(resolvedImagePath) && isRasterImagePath(resolvedImagePath)) {
          const thumbnailPath = ensureImageThumbnail(resolvedImagePath);
            if (thumbnailPath) {
              tokens[idx].attrs[srcIndex][1] = pathToFileURL(thumbnailPath).href;
            }
        }
      }
    }

    return renderImageHtmlWithAnnotation(defaultImage(tokens, idx, options, env, self), annotation);
  };

  function processCallouts(html) {
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

  const bodyHtml = processCallouts(markdown.render(markdownContent || ""));

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <base href="${baseHref}" />
    <title>${escapeHtml(title)}</title>
    <style>
  ${buildPdfStyles({ compact: pdfQualityPreset === "compact" })}
    </style>
  </head>
  <body>
    <main class="markdown-body">
      ${bodyHtml}
    </main>
  </body>
</html>`;
}


function collectImageUsage(basePath) {
  const resolvedBasePath = path.resolve(String(basePath || ""));
  if (!filePathWithin(getNotesRoot(), resolvedBasePath)) {
    throw new Error("Invalid document path.");
  }

  const activeProject = getActiveProject();
  const scopeRoot = path.resolve(activeProject?.rootPath || getNotesRoot());
  const markdownFiles = walkFiles(scopeRoot, { excludeDirs: Array.from(WALK_EXCLUDE_DIRS) })
    .filter((item) => path.extname(item).toLowerCase() === ".md");
  const markdownMediaPattern = /(?:!\[[^\]]*\]|\[[^\]]*\])\((<[^>]+>|[^)]+)\)/g;
  const wikilinkPattern = /(?:!\[\[|\[\[)([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  const htmlMediaPattern = /<(?:img|audio|video|source)\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  const usageByAssetPath = {};

  for (const markdownFile of markdownFiles) {
    const content = fs.readFileSync(markdownFile, "utf8");
    const seenInDocument = new Set();

    const processCandidatePath = (rawCandidate) => {
      let rawPath = String(rawCandidate || "").trim();
      if (!rawPath || /^(https?:|data:|blob:|mailto:|#)/i.test(rawPath)) return;
      if (rawPath.startsWith("<") && rawPath.endsWith(">")) {
        rawPath = rawPath.slice(1, -1);
      }
      rawPath = rawPath.replace(/\s+["'][^"']*["']\s*$/, "").split("?")[0].split("#")[0].trim();

      const resolvedAssetPath = resolveImageAssetPath(markdownFile, rawPath);
      if (!resolvedAssetPath) return;

      const resolved = path.resolve(resolvedAssetPath);
      const baseDir = path.dirname(resolvedBasePath);
      const root = getNotesRoot();

      const localImagesDir = path.join(baseDir, "images").toLowerCase();
      const rootImagesDir = path.join(root, "images").toLowerCase();
      const rootMediaImagesDir = path.join(root, "media", "images").toLowerCase();
      const rootMediaDocsDir = path.join(root, "media", "docs").toLowerCase();

      const resolvedDir = path.dirname(resolved).toLowerCase();
      const fileName = path.basename(resolved);

      let relativeAssetPath = "";
      if (resolvedDir === localImagesDir) {
        relativeAssetPath = `./images/${fileName}`;
      } else if (resolvedDir === rootImagesDir) {
        relativeAssetPath = `/images/${fileName}`;
      } else if (resolvedDir === rootMediaImagesDir) {
        relativeAssetPath = `/media/images/${fileName}`;
      } else if (resolvedDir === rootMediaDocsDir) {
        relativeAssetPath = `/media/docs/${fileName}`;
      } else {
        relativeAssetPath = normalizeToPosix(path.relative(baseDir, resolved));
      }

      if (seenInDocument.has(resolved.toLowerCase())) return;
      seenInDocument.add(resolved.toLowerCase());

      const aliases = new Set([
        relativeAssetPath,
        `./images/${fileName}`,
        `images/${fileName}`,
        `/images/${fileName}`,
        `media/images/${fileName}`,
        `/media/images/${fileName}`,
        `./media/images/${fileName}`,
        `media/docs/${fileName}`,
        `/media/docs/${fileName}`,
        fileName,
      ]);

      const docRef = {
        filePath: markdownFile,
        fileName: path.basename(markdownFile),
        title: path.basename(markdownFile, ".md"),
      };

      for (const alias of aliases) {
        const entry = usageByAssetPath[alias] || {
          referenceCount: 0,
          documents: [],
        };
        entry.referenceCount += 1;
        entry.documents.push(docRef);
        usageByAssetPath[alias] = entry;
      }
    };

    let match;
    while ((match = markdownMediaPattern.exec(content))) {
      processCandidatePath(match[1]);
    }
    while ((match = wikilinkPattern.exec(content))) {
      processCandidatePath(match[1]);
    }
    while ((match = htmlMediaPattern.exec(content))) {
      processCandidatePath(match[1]);
    }
  }

  return usageByAssetPath;
}

function resolveImageAssetPath(basePath, assetPath) {
  const rawAsset = (assetPath || "").trim();
  if (!rawAsset) return null;

  let baseDir = path.resolve(basePath);
  try {
    if (fs.existsSync(baseDir) && !fs.statSync(baseDir).isDirectory()) {
      baseDir = path.dirname(baseDir);
    }
  } catch {
    baseDir = path.dirname(baseDir);
  }

  let resolvedAssetPath = "";
  if (/^https?:/i.test(rawAsset)) {
    try {
      const url = new URL(rawAsset);
      let localPath = url.pathname || "";
      for (let i = 0; i < 5; i += 1) {
        try {
          const next = decodeURIComponent(localPath);
          if (next === localPath) break;
          localPath = next;
        } catch {
          break;
        }
      }
      if (/^\/(images|media)\//i.test(localPath)) {
        resolvedAssetPath = path.resolve(getNotesRoot(), `.${localPath}`);
      } else {
        return null;
      }
    } catch {
      return null;
    }
  } else if (/^file:/i.test(rawAsset)) {
    try {
      const url = new URL(rawAsset);
      resolvedAssetPath = decodeURI(url.pathname);
      if (/^\/[A-Za-z]:\//.test(resolvedAssetPath)) {
        resolvedAssetPath = resolvedAssetPath.slice(1);
      }
    } catch {
      return null;
    }
  } else {
    let decodedAsset = rawAsset;
    for (let i = 0; i < 5; i += 1) {
      try {
        const next = decodeURIComponent(decodedAsset);
        if (next === decodedAsset) break;
        decodedAsset = next;
      } catch {
        break;
      }
    }
    const isWorkspaceImageLink = /^[/\\]+(images|media|audio|transcripts)[/\\]/i.test(decodedAsset);
    const normalizedAsset = decodedAsset
      .replace(/^\.\//, "")
      .replace(/^[/\\]+(images|media|audio|transcripts)[/\\]/i, "$1/");
    const legacyDiagramMatch = normalizedAsset.match(/^(?:\.notes-app[\\/])?excali-diagrams[\\/]([^\\/]+)[\\/]([^\\/]+)[\\/]diagram\.png$/i);
    const sluglessDiagramMatch = normalizedAsset.match(/^(?:\.notes-app[\\/])?excali-diagrams[\\/]([^\\/]+)[\\/]diagram\.png$/i);

    // Collect candidate paths
    const candidates = [];
    if (path.isAbsolute(decodedAsset)) {
      candidates.push(path.resolve(decodedAsset));
    }
    if (path.isAbsolute(rawAsset)) {
      candidates.push(path.resolve(rawAsset));
    }

    if (isWorkspaceImageLink) {
      candidates.push(path.resolve(getNotesRoot(), normalizedAsset));
    } else if (/^(images|media|audio|transcripts)[\\/]/i.test(normalizedAsset)) {
      candidates.push(path.resolve(baseDir, normalizedAsset));
      candidates.push(path.resolve(getNotesRoot(), normalizedAsset));
    } else {
      candidates.push(path.resolve(baseDir, normalizedAsset));
      candidates.push(path.resolve(baseDir, "images", normalizedAsset));
      candidates.push(path.resolve(baseDir, "media", normalizedAsset));
      candidates.push(path.resolve(baseDir, "audio", normalizedAsset));
      candidates.push(path.resolve(baseDir, "transcripts", normalizedAsset));
      candidates.push(path.resolve(getNotesRoot(), normalizedAsset));
      candidates.push(path.resolve(getNotesRoot(), "images", normalizedAsset));
      candidates.push(path.resolve(getNotesRoot(), "media", normalizedAsset));
      candidates.push(path.resolve(getNotesRoot(), "audio", normalizedAsset));
      candidates.push(path.resolve(getNotesRoot(), "transcripts", normalizedAsset));
      if (sluglessDiagramMatch && !/^\.notes-app[\\/]/i.test(normalizedAsset)) {
        const [, diagramId] = sluglessDiagramMatch;
        candidates.push(path.resolve(baseDir, `.notes-app/excali-diagrams/${diagramId}/diagram.png`));
        candidates.push(path.resolve(getNotesRoot(), `.notes-app/excali-diagrams/${diagramId}/diagram.png`));
      }
      if (legacyDiagramMatch) {
        const [, , diagramId] = legacyDiagramMatch;
        candidates.push(path.resolve(baseDir, `.notes-app/excali-diagrams/${diagramId}/diagram.png`));
        candidates.push(path.resolve(baseDir, `excali-diagrams/${diagramId}/diagram.png`));
        candidates.push(path.resolve(getNotesRoot(), `.notes-app/excali-diagrams/${diagramId}/diagram.png`));
      }
    }

    resolvedAssetPath = candidates.find((candidate) => {
      try {
        return fs.existsSync(candidate);
      } catch {
        return false;
      }
    }) || candidates[0];
  }

  const notesRoot = getNotesRoot();
  const activeProj = typeof getActiveProject === "function" ? getActiveProject() : null;
  const allowedRoots = [notesRoot, baseDir, path.resolve(basePath), activeProj?.rootPath].filter(Boolean);

  const isAllowed = allowedRoots.some((root) => filePathWithin(root, resolvedAssetPath));
  if (!isAllowed) {
    return null;
  }

  return path.resolve(resolvedAssetPath);
}

function isRasterImagePath(filePath) {
  return RASTER_IMAGE_EXTENSIONS.has(path.extname(filePath || "").toLowerCase());
}

function getThumbnailDirForImage(imagePath) {
  if (!imagePath) return "";
  const absPath = path.resolve(imagePath);
  const root = getNotesRoot();
  const rawRelative = path.relative(root, absPath);
  const safeRelative = rawRelative.startsWith("..") ? `external_${crypto.createHash("md5").update(absPath).digest("hex")}` : rawRelative;
  const relativeDir = path.dirname(safeRelative);
  return path.join(getAppDataDir(), THUMBNAIL_DIR_NAME, relativeDir);
}

function getThumbnailPathForImage(imagePath) {
  const stat = fs.statSync(imagePath);
  const ext = path.extname(imagePath);
  const baseName = path.basename(imagePath, ext).replace(/[<>:"/\\|?*]+/g, "-") || "image";
  const cacheKey = crypto
    .createHash("sha1")
    .update(`${path.resolve(imagePath)}:${stat.size}:${Math.round(stat.mtimeMs)}`)
    .digest("hex")
    .slice(0, 12);
  const thumbnailDir = getThumbnailDirForImage(imagePath);
  return path.join(thumbnailDir, `${baseName}-${cacheKey}.jpg`);
}

function ensureImageThumbnail(imagePath) {
  if (!imagePath || !fs.existsSync(imagePath) || !isRasterImagePath(imagePath)) {
    return null;
  }

  const thumbnailPath = getThumbnailPathForImage(imagePath);
  if (fs.existsSync(thumbnailPath)) {
    return thumbnailPath;
  }

  // Clear any existing stale thumbnails for this image before generating a new one
  clearThumbnailCacheForImage(imagePath);

  ensureDir(path.dirname(thumbnailPath));
  const image = nativeImage.createFromPath(imagePath);
  if (image.isEmpty()) {
    return null;
  }

  const size = image.getSize();
  const width = Math.min(THUMBNAIL_MAX_WIDTH, Math.max(1, size.width || THUMBNAIL_MAX_WIDTH));
  const resized = image.resize({ width, quality: "good" });
  fs.writeFileSync(thumbnailPath, resized.toJPEG(THUMBNAIL_JPEG_QUALITY));
  return thumbnailPath;
}

function clearThumbnailCacheForImage(imagePath) {
  if (!imagePath) return;
  const thumbnailDir = getThumbnailDirForImage(imagePath);
  if (!thumbnailDir || !fs.existsSync(thumbnailDir)) return;

  const ext = path.extname(imagePath);
  const baseName = path.basename(imagePath, ext).replace(/[<>:"/\\|?*]+/g, "-") || "image";
  for (const entry of fs.readdirSync(thumbnailDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.startsWith(`${baseName}-`) && entry.name.toLowerCase().endsWith(".jpg")) {
      try {
        fs.unlinkSync(path.join(thumbnailDir, entry.name));
      } catch {
        // Cache cleanup is best-effort.
      }
    }
  }
}

function getImageAnnotationsPath() {
  return path.join(getAppDataDir(), "image-annotations.json");
}

function getImageAnnotationKey(resolvedAssetPath) {
  return normalizeToPosix(path.relative(getNotesRoot(), path.resolve(resolvedAssetPath))).toLowerCase();
}

function readImageAnnotations() {
  const annotationsPath = getImageAnnotationsPath();
  if (!fs.existsSync(annotationsPath)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(annotationsPath, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeImageAnnotations(annotations) {
  ensureDir(path.dirname(getImageAnnotationsPath()));
  fs.writeFileSync(getImageAnnotationsPath(), JSON.stringify(annotations || {}, null, 2), "utf8");
}

function normalizeImageAnnotation(annotation) {
  const text = String(annotation?.text || "").trim().slice(0, 80);
  return text ? { text, position: "top-left" } : null;
}

function getImageAnnotationForMarkdownAsset(basePath, assetPath) {
  const resolvedAssetPath = resolveImageAssetPath(basePath, assetPath);
  if (!resolvedAssetPath) return null;
  const annotations = readImageAnnotations();
  return normalizeImageAnnotation(annotations[getImageAnnotationKey(resolvedAssetPath)]);
}

function renderImageHtmlWithAnnotation(imageHtml, annotation) {
  const normalized = normalizeImageAnnotation(annotation);
  if (!normalized) return imageHtml;
  return `<span class="notely-image-frame">${imageHtml}<span class="notely-image-annotation">${escapeHtml(normalized.text)}</span></span>`;
}

function removeImageReferencesForAsset(resolvedAssetPath, options = {}) {
  const normalizedTarget = path.resolve(resolvedAssetPath).toLowerCase();
  const normalizedBasePath = options.basePath
    ? path.resolve(options.basePath).toLowerCase()
    : "";
  const removeAllReferences = Boolean(options.removeAllReferences);
  const activeProject = getActiveProject();
  const scopeRoot = path.resolve(activeProject?.rootPath || getNotesRoot());
  const markdownFiles = walkFiles(scopeRoot, { excludeDirs: Array.from(WALK_EXCLUDE_DIRS) })
    .filter((item) => path.extname(item).toLowerCase() === ".md");
  const markdownImagePattern = /!\[[^\]]*\]\((<[^>]+>|[^)]+)\)/g;
  let referencesFound = 0;
  let referencesRemoved = 0;
  let remainingReferences = 0;
  const documentsUpdated = [];

  for (const markdownFile of markdownFiles) {
    const content = fs.readFileSync(markdownFile, "utf8");
    let removedInDocument = 0;
    const normalizedMarkdownFile = path.resolve(markdownFile).toLowerCase();
    const nextContent = content.replace(markdownImagePattern, (match, rawPath) => {
      const assetPath = String(rawPath || "").trim();
      const unwrapped = assetPath.startsWith("<") && assetPath.endsWith(">")
        ? assetPath.slice(1, -1)
        : assetPath;
      const resolved = resolveImageAssetPath(markdownFile, unwrapped);
      if (!resolved || path.resolve(resolved).toLowerCase() !== normalizedTarget) {
        return match;
      }

      referencesFound += 1;
      const shouldRemoveReference = removeAllReferences || normalizedMarkdownFile === normalizedBasePath;
      if (!shouldRemoveReference) {
        remainingReferences += 1;
        return match;
      }

      removedInDocument += 1;
      referencesRemoved += 1;
      return "";
    });

    if (removedInDocument > 0 && nextContent !== content) {
      fs.writeFileSync(markdownFile, nextContent, "utf8");
      documentsUpdated.push({
        filePath: markdownFile,
        fileName: path.basename(markdownFile),
        title: path.basename(markdownFile, ".md"),
        removed: removedInDocument,
      });
    }
  }

  return { referencesFound, referencesRemoved, remainingReferences, documentsUpdated };
}


  function registerIpcHandlers(ipcMain) {
function registerTrustedHandler(channel, handler) {
  ipcMain.handle(channel, (event, payload) => {
    assertTrustedIpcSender(BrowserWindow, event, channel);
    return handler(event, payload);
  });
}

registerTrustedHandler("images:save", (_event, payload) => {
  const { fileName, base64Data } = payload || {};
  if (!fileName || typeof fileName !== "string") {
    throw new Error("Invalid media filename.");
  }
  if (!base64Data || typeof base64Data !== "string" || !base64Data.includes(",")) {
    throw new Error("Invalid media payload.");
  }

  const safeFileName = path.basename(fileName).replace(/[<>:"/\\|?*]+/g, "-");
  const ext = path.extname(safeFileName).toLowerCase();
  const baseName = path.basename(safeFileName, ext) || "file";
  const finalExt = ext || ".bin";

  const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp", ".ico", ".gif", ".svg"]);
  const audioExtensions = new Set([".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac"]);
  const videoExtensions = new Set([".mp4", ".mov", ".mkv", ".avi"]);

  const isImage = imageExtensions.has(finalExt);
  const isAudio = audioExtensions.has(finalExt);
  const isVideo = videoExtensions.has(finalExt);

  let relPath = "";
  let mediaFilePath = "";

  if (isAudio) {
    const bundleDirName = `${baseName}_${Date.now().toString(36)}`;
    const bundleDir = path.join(getNotesRoot(), "media", "audio", bundleDirName);
    ensureDir(bundleDir);
    mediaFilePath = path.join(bundleDir, `${baseName}${finalExt}`);
    relPath = `media/audio/${bundleDirName}/${baseName}${finalExt}`;
  } else if (isVideo) {
    const bundleDirName = `${baseName}_${Date.now().toString(36)}`;
    const bundleDir = path.join(getNotesRoot(), "media", "video", bundleDirName);
    ensureDir(bundleDir);
    mediaFilePath = path.join(bundleDir, `${baseName}${finalExt}`);
    relPath = `media/video/${bundleDirName}/${baseName}${finalExt}`;
  } else {
    const subFolder = isImage ? "images" : "docs";
    const mediaDir = path.join(getNotesRoot(), "media", subFolder);
    ensureDir(mediaDir);

    let finalName = `${baseName}${finalExt}`;
    let counter = 1;
    while (fs.existsSync(path.join(mediaDir, finalName))) {
      finalName = `${baseName}-${counter}${finalExt}`;
      counter++;
    }

    mediaFilePath = path.join(mediaDir, finalName);
    relPath = `media/${subFolder}/${finalName}`;
  }

  const buffer = Buffer.from(base64Data.split(",")[1], "base64");
  if (!buffer.length) {
    throw new Error("File data is empty.");
  }
  fs.writeFileSync(mediaFilePath, buffer);

  if (isImage) {
    ensureImageThumbnail(mediaFilePath);
  }

  return `/${relPath.replace(/\\/g, "/")}`;
});

registerTrustedHandler("video:save", (_event, payload) => {
  const { fileName, base64Data } = payload || {};
  if (!fileName || typeof fileName !== "string") {
    throw new Error("Invalid video filename.");
  }
  if (!base64Data || typeof base64Data !== "string" || !base64Data.includes(",")) {
    throw new Error("Invalid video payload.");
  }

  const safeFileName = path.basename(fileName).replace(/[<>:"/\\|?*]+/g, "-");
  const ext = path.extname(safeFileName) || ".webm";
  const baseName = path.basename(safeFileName, ext) || "recording";

  const bundleDirName = `${baseName}_${Date.now().toString(36)}`;
  const bundleDir = path.join(getNotesRoot(), "media", "video", bundleDirName);
  ensureDir(bundleDir);

  const targetPath = path.join(bundleDir, `${baseName}${ext}`);
  if (!filePathWithin(getNotesRoot(), targetPath)) {
    throw new Error("Invalid recording path.");
  }

  const buffer = Buffer.from(base64Data.split(",")[1], "base64");
  if (!buffer.length) {
    throw new Error("Video data is empty.");
  }
  fs.writeFileSync(targetPath, buffer);
  return `media/video/${bundleDirName}/${baseName}${ext}`;
});

registerTrustedHandler("audio:save", (_event, payload) => {
  const { fileName, base64Data, transcript } = payload || {};
  const rawFileName = String(fileName || "recording.webm");
  const safeFileName = path.basename(rawFileName).replace(/[<>:"/\\|?*]+/g, "-");

  // Handle standalone companion transcript saving
  if (transcript && !base64Data) {
    let transcriptPath = "";
    let transcriptRelPath = "";

    if (transcript.sourceMedia && typeof transcript.sourceMedia === "string") {
      const sourceNorm = transcript.sourceMedia.replace(/^[/\\]+/, "").replace(/\\/g, "/");
      const parentDir = path.dirname(sourceNorm);
      const targetDir = path.join(getNotesRoot(), parentDir);
      ensureDir(targetDir);
      transcriptPath = path.join(targetDir, "transcript.json");
      transcriptRelPath = `${parentDir}/transcript.json`.replace(/\\/g, "/");
    } else if (rawFileName.includes("/") || rawFileName.includes("\\")) {
      const relNorm = rawFileName.replace(/^[/\\]+/, "").replace(/\\/g, "/");
      transcriptPath = path.join(getNotesRoot(), relNorm);
      ensureDir(path.dirname(transcriptPath));
      transcriptRelPath = relNorm;
    } else {
      const baseName = safeFileName.replace(/\.[^.]+$/, "");
      const bundleDir = path.join(getNotesRoot(), "media", "audio", baseName);
      ensureDir(bundleDir);
      transcriptPath = path.join(bundleDir, "transcript.json");
      transcriptRelPath = `media/audio/${baseName}/transcript.json`;
    }

    const content = typeof transcript === "string" ? transcript : JSON.stringify(transcript, null, 2);
    fs.writeFileSync(transcriptPath, content, "utf8");
    return {
      audioPath: null,
      transcriptPath: transcriptRelPath,
      fileName: path.basename(transcriptPath),
    };
  }

  if (!base64Data || typeof base64Data !== "string" || !base64Data.includes(",")) {
    throw new Error("Invalid audio payload.");
  }

  const ext = path.extname(safeFileName) || ".webm";
  const baseName = path.basename(safeFileName, ext) || "recording";
  const bundleDirName = `${baseName}_${Date.now().toString(36)}`;
  const bundleDir = path.join(getNotesRoot(), "media", "audio", bundleDirName);
  ensureDir(bundleDir);

  const targetPath = path.join(bundleDir, `${baseName}${ext}`);
  if (!filePathWithin(getNotesRoot(), targetPath)) {
    throw new Error("Invalid audio path.");
  }

  const buffer = Buffer.from(base64Data.split(",")[1], "base64");
  if (!buffer.length) {
    throw new Error("Audio data is empty.");
  }
  fs.writeFileSync(targetPath, buffer);

  let transcriptRelPath = null;
  if (transcript) {
    const transcriptPath = path.join(bundleDir, "transcript.json");
    const content = typeof transcript === "string" ? transcript : JSON.stringify(transcript, null, 2);
    fs.writeFileSync(transcriptPath, content, "utf8");
    transcriptRelPath = `media/audio/${bundleDirName}/transcript.json`;
  }

  return {
    audioPath: `media/audio/${bundleDirName}/${baseName}${ext}`,
    transcriptPath: transcriptRelPath,
    fileName: `${baseName}${ext}`,
  };
});

registerTrustedHandler("media:list-disk-assets", () => {
  const notesRoot = getNotesRoot();
  if (!notesRoot || !fs.existsSync(notesRoot)) {
    return [];
  }

  const scanDirs = [
    path.join(notesRoot, "media"),
    path.join(notesRoot, "assets"),
    path.join(notesRoot, "images"),
  ];

  const results = [];
  const visitedPaths = new Set();

  for (const rootDir of scanDirs) {
    if (!fs.existsSync(rootDir)) continue;

    const queue = [rootDir];
    while (queue.length > 0) {
      const currentDir = queue.shift();
      let entries;
      try {
        entries = fs.readdirSync(currentDir, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        if (entry.name === THUMBNAIL_DIR_NAME || entry.name === ORIGINAL_IMAGE_DIR_NAME) continue;

        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          queue.push(fullPath);
        } else if (entry.isFile()) {
          const relFromRoot = path.relative(notesRoot, fullPath).replace(/\\/g, "/");
          if (visitedPaths.has(relFromRoot.toLowerCase())) continue;
          visitedPaths.add(relFromRoot.toLowerCase());

          const ext = path.extname(entry.name).slice(1).toLowerCase();
          // Skip internal metadata/temporary files
          if (["tmp", "crswap", "bak"].includes(ext)) continue;

          let size = 0;
          let mtime = null;
          try {
            const stat = fs.statSync(fullPath);
            size = stat.size;
            mtime = stat.mtime.toISOString();
          } catch {
            // Ignore stat read failure for transient files
          }

          results.push({
            path: relFromRoot,
            name: entry.name,
            ext,
            size,
            mtime,
          });
        }
      }
    }
  }

  return results;
});

registerTrustedHandler("images:download", async (event, payload) => {
  const { getExportManager } = require("../export/ExportManager.cjs");
  const exportManager = getExportManager();
  return await exportManager.runExport({ type: "diagram_image", payload: payload || {} });
});

registerTrustedHandler("images:list", (_event, payload) => {
  const { basePath, includeAnnotations = false, includeOriginalStatus = false } = payload || {};
  if (!basePath || typeof basePath !== "string") {
    throw new Error("Invalid base path.");
  }

  const resolvedBasePath = path.resolve(basePath);
  if (!filePathWithin(getNotesRoot(), resolvedBasePath)) {
    throw new Error("Invalid document path.");
  }

  const readImagesIn = (dir) => {
    if (!fs.existsSync(dir)) return [];

    const files = [];
    const queue = [""];

    while (queue.length > 0) {
      const relativeDir = queue.shift();
      const absoluteDir = relativeDir ? path.join(dir, relativeDir) : dir;

      let entries;
      try {
        entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        const relativePath = relativeDir
          ? path.posix.join(relativeDir.replace(/\\/g, "/"), entry.name)
          : entry.name;

        if (entry.isDirectory()) {
          if (entry.name === THUMBNAIL_DIR_NAME || entry.name === ORIGINAL_IMAGE_DIR_NAME) {
            continue;
          }
          queue.push(relativePath);
          continue;
        }

        if (!entry.isFile()) continue;
        files.push(relativePath.replace(/\\/g, "/"));
      }
    }

    return files;
  };

  const baseDir = path.dirname(path.resolve(basePath));
  const paths = [];
  const seen = new Set();

  const addEntries = (dir, prefix) => {
    const names = readImagesIn(dir);
    for (const name of names) {
      const assetPath = `${prefix}/${name}`.replace(/\/+/g, "/").replace(/^\.\//, "./");
      const key = assetPath.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        paths.push(assetPath);
      }
    }
  };

  // Local note-adjacent directories
  addEntries(path.join(baseDir, "images"), "./images");
  addEntries(path.join(baseDir, "audio"), "./audio");
  addEntries(path.join(baseDir, "transcripts"), "./transcripts");
  addEntries(path.join(baseDir, "media"), "./media");

  // Workspace-root directories
  addEntries(path.join(getNotesRoot(), "images"), "/images");
  addEntries(path.join(getNotesRoot(), "audio"), "/audio");
  addEntries(path.join(getNotesRoot(), "transcripts"), "/transcripts");
  addEntries(path.join(getNotesRoot(), "media"), "/media");

  if (!includeAnnotations && !includeOriginalStatus) return paths;

  const annotations = readImageAnnotations();
  return paths.map((assetPath) => {
    const resolvedAssetPath = resolveImageAssetPath(basePath, assetPath);
    const annotation = resolvedAssetPath
      ? normalizeImageAnnotation(annotations[getImageAnnotationKey(resolvedAssetPath)])
      : null;
    const hasOriginal = resolvedAssetPath ? hasOriginalImageBackup(resolvedAssetPath) : false;
    return {
      path: assetPath,
      annotation: includeAnnotations ? annotation : null,
      hasOriginal: includeOriginalStatus ? hasOriginal : false,
    };
  });
});

registerTrustedHandler("images:usage", (_event, payload) => {
  const { basePath } = payload || {};
  if (!basePath || typeof basePath !== "string") {
    throw new Error("Invalid base path.");
  }

  return collectImageUsage(basePath);
});

registerTrustedHandler("images:get-annotation", (_event, payload) => {
  const { basePath, assetPath } = payload || {};
  if (!basePath || typeof basePath !== "string") {
    throw new Error("Invalid base path.");
  }
  if (!assetPath || typeof assetPath !== "string") {
    throw new Error("Invalid asset path.");
  }

  const resolvedAssetPath = resolveImageAssetPath(basePath, assetPath);
  if (!resolvedAssetPath) return null;
  const annotations = readImageAnnotations();
  return normalizeImageAnnotation(annotations[getImageAnnotationKey(resolvedAssetPath)]);
});

registerTrustedHandler("images:set-annotation", (_event, payload) => {
  const { basePath, assetPath, annotation } = payload || {};
  if (!basePath || typeof basePath !== "string") {
    throw new Error("Invalid base path.");
  }
  if (!assetPath || typeof assetPath !== "string") {
    throw new Error("Invalid asset path.");
  }

  const resolvedAssetPath = resolveImageAssetPath(basePath, assetPath);
  if (!resolvedAssetPath) {
    throw new Error("Image file not found.");
  }

  const annotations = readImageAnnotations();
  const key = getImageAnnotationKey(resolvedAssetPath);
  const normalized = normalizeImageAnnotation(annotation);
  if (normalized) {
    annotations[key] = normalized;
  } else {
    delete annotations[key];
  }
  writeImageAnnotations(annotations);
  return normalized;
});

registerTrustedHandler("images:get-original-status", (_event, payload) => {
  const { basePath, assetPath } = payload || {};
  if (!basePath || typeof basePath !== "string") {
    throw new Error("Invalid base path.");
  }
  if (!assetPath || typeof assetPath !== "string") {
    throw new Error("Invalid asset path.");
  }

  const resolvedAssetPath = resolveImageAssetPath(basePath, assetPath);
  if (!resolvedAssetPath || !fs.existsSync(resolvedAssetPath)) {
    return { hasOriginal: false };
  }

  return {
    hasOriginal: hasOriginalImageBackup(resolvedAssetPath),
  };
});

registerTrustedHandler("images:restore-original", (_event, payload) => {
  const { basePath, assetPath } = payload || {};
  if (!basePath || typeof basePath !== "string") {
    throw new Error("Invalid base path.");
  }
  if (!assetPath || typeof assetPath !== "string") {
    throw new Error("Invalid asset path.");
  }

  const resolvedAssetPath = resolveImageAssetPath(basePath, assetPath);
  if (!resolvedAssetPath || !fs.existsSync(resolvedAssetPath)) {
    throw new Error("Image file not found.");
  }

  const backupPath = getOriginalImageBackupPath(resolvedAssetPath);
  if (!backupPath || !fs.existsSync(backupPath)) {
    throw new Error("Original image backup not found.");
  }

  clearThumbnailCacheForImage(resolvedAssetPath);
  fs.copyFileSync(backupPath, resolvedAssetPath);
  ensureImageThumbnail(resolvedAssetPath);
  return { restored: true };
});

registerTrustedHandler("images:delete", (_event, payload) => {
  const { basePath, assetPath, removeAllReferences } = payload || {};
  if (!basePath || typeof basePath !== "string") {
    throw new Error("Invalid base path.");
  }
  if (!assetPath || typeof assetPath !== "string") {
    throw new Error("Invalid asset path.");
  }

  const resolvedAssetPath = resolveImageAssetPath(basePath, assetPath);
  if (!resolvedAssetPath || !fs.existsSync(resolvedAssetPath)) {
    return { deletedFile: false, referencesRemoved: 0, documentsUpdated: [] };
  }

  const referenceResult = removeImageReferencesForAsset(resolvedAssetPath, {
    basePath,
    removeAllReferences,
  });
  const shouldDeleteFile = referenceResult.remainingReferences === 0;
  let movedPath = null;
  if (shouldDeleteFile) {
    clearThumbnailCacheForImage(resolvedAssetPath);
    removeOriginalImageBackup(resolvedAssetPath);
    const annotations = readImageAnnotations();
    delete annotations[getImageAnnotationKey(resolvedAssetPath)];
    writeImageAnnotations(annotations);
    movedPath = moveFileToRemoved(resolvedAssetPath, "images");
  }

  return {
    deletedFile: Boolean(movedPath),
    movedPath,
    referencesFound: referenceResult.referencesFound,
    referencesRemoved: referenceResult.referencesRemoved,
    remainingReferences: referenceResult.remainingReferences,
    documentsUpdated: referenceResult.documentsUpdated,
    keptFileBecauseReferencedElsewhere: !shouldDeleteFile,
  };
});

registerTrustedHandler("images:replace", (_event, payload) => {
  const { basePath, assetPath, base64Data } = payload || {};
  if (!basePath || typeof basePath !== "string") {
    throw new Error("Invalid base path.");
  }
  if (!assetPath || typeof assetPath !== "string") {
    throw new Error("Invalid asset path.");
  }
  if (!base64Data || typeof base64Data !== "string" || !base64Data.includes(",")) {
    throw new Error("Invalid image payload.");
  }

  const resolvedAssetPath = resolveImageAssetPath(basePath, assetPath);
  if (!resolvedAssetPath || !fs.existsSync(resolvedAssetPath)) {
    throw new Error("Image file not found.");
  }

  const buffer = Buffer.from(base64Data.split(",")[1], "base64");
  if (!buffer.length) {
    throw new Error("Image data is empty.");
  }

  ensureOriginalImageBackup(resolvedAssetPath);
  clearThumbnailCacheForImage(resolvedAssetPath);
  fs.writeFileSync(resolvedAssetPath, buffer);
  ensureImageThumbnail(resolvedAssetPath);
  return true;
});

registerTrustedHandler("images:rename", (_event, payload) => {
  const { basePath, assetPath, nextFileName } = payload || {};
  if (!basePath || typeof basePath !== "string") {
    throw new Error("Invalid base path.");
  }
  if (!assetPath || typeof assetPath !== "string") {
    throw new Error("Invalid asset path.");
  }
  if (!nextFileName || typeof nextFileName !== "string") {
    throw new Error("Invalid image filename.");
  }

  const resolvedAssetPath = resolveImageAssetPath(basePath, assetPath);
  if (!resolvedAssetPath || !fs.existsSync(resolvedAssetPath)) {
    throw new Error("Image file not found.");
  }

  const imagesDir = path.resolve(path.join(getNotesRoot(), "images"));
  if (!filePathWithin(imagesDir, resolvedAssetPath)) {
    throw new Error("Image path must be inside notes/images.");
  }

  const currentExt = path.extname(resolvedAssetPath);
  const rawName = path.basename(String(nextFileName || "").trim()).replace(/[<>:"/\\|?*]+/g, "-");
  const desiredExt = path.extname(rawName) || currentExt || ".png";
  const desiredBase = path.basename(rawName, path.extname(rawName)) || "image";
  const candidatePath = path.join(path.dirname(resolvedAssetPath), `${desiredBase}${desiredExt}`);

  const normalizedCurrent = path.resolve(resolvedAssetPath);
  const normalizedCandidate = path.resolve(candidatePath);
  let finalPath = normalizedCandidate;
  if (normalizedCandidate.toLowerCase() !== normalizedCurrent.toLowerCase()) {
    finalPath = getUniquePath(normalizedCandidate);
    fs.renameSync(normalizedCurrent, finalPath);
  }

  const annotations = readImageAnnotations();
  const oldAnnotationKey = getImageAnnotationKey(normalizedCurrent);
  const nextAnnotation = annotations[oldAnnotationKey];
  if (nextAnnotation) {
    delete annotations[oldAnnotationKey];
    annotations[getImageAnnotationKey(finalPath)] = nextAnnotation;
    writeImageAnnotations(annotations);
  }

  moveOriginalImageBackup(normalizedCurrent, finalPath);

  return `./images/${path.basename(finalPath)}`;
});

registerTrustedHandler("images:read", (_event, payload) => {
  const { basePath, assetPath, thumbnail } = payload || {};
  if (!basePath || typeof basePath !== "string") {
    throw new Error("Invalid base path.");
  }
  if (!assetPath || typeof assetPath !== "string") {
    throw new Error("Invalid asset path.");
  }

  const rawAsset = assetPath.trim();
  if (/^(data:|blob:)/i.test(rawAsset)) {
    return assetPath;
  }

  const resolvedAssetPath = resolveImageAssetPath(basePath, rawAsset);
  if (!resolvedAssetPath) {
    return rawAsset;
  }
  if (!fs.existsSync(resolvedAssetPath)) {
    return rawAsset;
  }

  const fileToRead = thumbnail ? (ensureImageThumbnail(resolvedAssetPath) || resolvedAssetPath) : resolvedAssetPath;
  const ext = path.extname(fileToRead).toLowerCase();
  const mimeMap = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".bmp": "image/bmp",
    ".ico": "image/x-icon",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".ogv": "video/ogg",
    ".mov": "video/quicktime",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".flac": "audio/flac",
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".txt": "text/plain",
    ".rtf": "application/rtf",
    ".odt": "application/vnd.oasis.opendocument.text",
    ".ods": "application/vnd.oasis.opendocument.spreadsheet",
    ".odp": "application/vnd.oasis.opendocument.presentation",
    ".csv": "text/csv",
    ".json": "application/json",
    ".xml": "application/xml",
    ".zip": "application/zip",
    ".7z": "application/x-7z-compressed",
    ".rar": "application/vnd.rar"
  };
  let mimeType = mimeMap[ext] || "application/octet-stream";
  if (ext === ".webm" && (/[/\\]audio[/\\]/i.test(fileToRead) || /(recording|voice|mic|audio)/i.test(path.basename(fileToRead)))) {
    mimeType = "audio/webm";
  }
  const buffer = fs.readFileSync(fileToRead);
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
});

registerTrustedHandler("images:open-default-app", async (_event, payload) => {
  const { basePath, assetPath } = payload || {};
  if (!basePath || typeof basePath !== "string") {
    throw new Error("Invalid base path.");
  }
  if (!assetPath || typeof assetPath !== "string") {
    throw new Error("Invalid asset path.");
  }

  const resolvedAssetPath = resolveImageAssetPath(basePath, assetPath);
  if (!resolvedAssetPath || !fs.existsSync(resolvedAssetPath)) {
    throw new Error("Media file not found.");
  }

  const openResult = await shell.openPath(resolvedAssetPath);
  if (openResult) {
    throw new Error(openResult);
  }
  return true;
});

registerTrustedHandler("images:reveal-in-explorer", async (_event, payload) => {
  const { basePath, assetPath } = payload || {};
  if (!basePath || typeof basePath !== "string") {
    throw new Error("Invalid base path.");
  }
  if (!assetPath || typeof assetPath !== "string") {
    throw new Error("Invalid asset path.");
  }

  const resolvedAssetPath = resolveImageAssetPath(basePath, assetPath);
  if (!resolvedAssetPath || !fs.existsSync(resolvedAssetPath)) {
    throw new Error("Media file not found.");
  }

  shell.showItemInFolder(resolvedAssetPath);
  return true;
});

  }

  return {
    buildPdfExportHtml,
    getImageAnnotationForMarkdownAsset,
    renderImageHtmlWithAnnotation,
    ensureImageThumbnail,
    registerIpcHandlers,
  };
}

module.exports = { createImageMedia };
