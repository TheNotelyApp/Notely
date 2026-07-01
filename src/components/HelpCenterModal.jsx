import { X } from "lucide-react";
import { useMemo, useState } from "react";
import MarkdownIt from "markdown-it";

function normalizeDocPath(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  return raw.replace(/^\.?\//, "");
}

function resolveDocSlugFromHref(href, docs) {
  const rawHref = String(href || "").trim();
  if (!rawHref) return "";

  const [pathPart] = rawHref.split("#");
  const normalizedPath = normalizeDocPath(pathPart);
  if (!normalizedPath.endsWith(".md")) {
    return "";
  }

  const match = docs.find((entry) => {
    const fileName = normalizeDocPath(entry?.fileName);
    const slugPath = `${normalizeDocPath(entry?.slug)}.md`;
    return normalizedPath === fileName || normalizedPath === slugPath;
  });

  return String(match?.slug || "");
}

export function HelpCenterModal({ open, onClose, appInfo, documents = [] }) {
  if (!open) return null;

  const normalizedDocs = Array.isArray(documents) ? documents : [];
  const [activeSlug, setActiveSlug] = useState(() => String(normalizedDocs?.[0]?.slug || ""));

  const markdownRenderer = useMemo(() => {
    return new MarkdownIt({
      html: false,
      linkify: true,
      breaks: false,
      typographer: true,
    });
  }, []);

  const firstSlug = String(normalizedDocs?.[0]?.slug || "");
  const resolvedSlug = normalizedDocs.some((entry) => entry?.slug === activeSlug)
    ? activeSlug
    : firstSlug;
  const activeDocument = normalizedDocs.find((entry) => entry?.slug === resolvedSlug) || null;
  const renderedHtml = activeDocument
    ? markdownRenderer.render(String(activeDocument.markdown || ""))
    : "";

  function handleMarkdownLinkClick(event) {
    const anchor = event.target?.closest?.("a[href]");
    if (!anchor) return;

    const href = String(anchor.getAttribute("href") || "").trim();
    if (!href) return;

    if (/^https?:\/\//i.test(href)) {
      event.preventDefault();
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }

    const docSlug = resolveDocSlugFromHref(href, normalizedDocs);
    if (docSlug) {
      event.preventDefault();
      setActiveSlug(docSlug);
    }
  }

  return (
    <div
      className="overlay-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="Help center"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="overlay-dialog-card help-center-dialog-card">
        <div className="overlay-dialog-header">
          <h2>Documentation</h2>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Close help center">
            <X size={16} />
          </button>
        </div>

        <div className="help-center-content">
          <div className="help-doc-layout" aria-label="Documentation viewer">
            <aside className="help-doc-nav" aria-label="Help sections">
              {normalizedDocs.length ? normalizedDocs.map((entry) => {
                const isActive = entry.slug === resolvedSlug;
                return (
                  <button
                    key={entry.slug || entry.fileName}
                    type="button"
                    className={`help-doc-nav-item${isActive ? " active" : ""}`}
                    onClick={() => setActiveSlug(entry.slug)}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span className="help-doc-nav-title">{entry.title || "Documentation"}</span>
                    {entry.summary ? <span className="help-doc-nav-summary">{entry.summary}</span> : null}
                  </button>
                );
              }) : (
                <p className="help-doc-empty">No documentation files were found in docs/.</p>
              )}
            </aside>

            <article className="help-doc-article" aria-label="Documentation content">
              {activeDocument ? (
                <>
                  <header className="help-doc-article-header">
                    <h3>{activeDocument.title || "Documentation"}</h3>
                    <p>{activeDocument.summary || "Detailed guidance for this topic."}</p>
                  </header>
                  <div
                    className="help-doc-markdown"
                    onClick={handleMarkdownLinkClick}
                    dangerouslySetInnerHTML={{ __html: renderedHtml }}
                  />
                </>
              ) : (
                <p className="help-doc-empty">Select a section to view documentation.</p>
              )}
            </article>
          </div>
        </div>
      </div>
    </div>
  );
}
