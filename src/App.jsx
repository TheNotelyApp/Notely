import { useEffect, useMemo, useRef, useState } from "react";
import MarkdownIt from "markdown-it";
import mermaid from "mermaid";
import {
  Home,
  Save,
  RotateCcw,
  Heading2,
  Bold,
  Italic,
  List,
  Quote,
  Code,
  FileText,
  FilePenLine,
  PenLine,
  SplitSquareHorizontal,
  Eye,
  ImagePlus,
  Zap,
  Clock,
  MapPin,
  User,
  Images
} from "lucide-react";

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true
});

mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict",
  theme: "base",
  themeVariables: {
    primaryColor: "#f4f1ea",
    primaryBorderColor: "#2f5d62",
    primaryTextColor: "#172326",
    lineColor: "#506b70",
    secondaryColor: "#dce8e3",
    tertiaryColor: "#ffffff"
  }
});

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function renderMarkdown(content) {
  return md.render(content || "");
}

function extractImagesFromMarkdown(content) {
  if (!content) return [];
  const regex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const images = [];
  let match;
  while ((match = regex.exec(content))) {
    images.push({
      altText: match[1] || "Image",
      path: match[2],
      id: `${match[2]}-${Math.random().toString(36).slice(2)}`,
    });
  }
  return images;
}

function MediaTab({ content }) {
  const images = useMemo(() => extractImagesFromMarkdown(content), [content]);

  if (images.length === 0) {
    return (
      <div className="media-empty">
        <p>No images found in this note.</p>
        <p className="muted">Insert images using the toolbar button or drag &amp; drop.</p>
      </div>
    );
  }

  return (
    <div className="media-grid">
      {images.map((image) => (
        <div className="media-item" key={image.id}>
          <div className="media-preview">
            <img src={image.path} alt={image.altText} />
          </div>
          <div className="media-info">
            <p className="media-alt">{image.altText}</p>
            <p className="media-path" title={image.path}>{image.path}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function replaceTextAtSelection(value, start, end, insertion) {
  const safeStart = Number.isInteger(start) ? start : value.length;
  const safeEnd = Number.isInteger(end) ? end : safeStart;
  return value.slice(0, safeStart) + insertion + value.slice(safeEnd);
}

function insertTextAtCursor(value, onChange, text, textareaRef) {
  if (!textareaRef?.current) {
    console.error("Textarea ref not available");
    // Fallback: try querySelector
    const textarea = document.querySelector(".markdown-textarea");
    if (!textarea) {
      console.error("Could not find textarea element");
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const next = replaceTextAtSelection(value, start, end, text);
    onChange(next);
    return;
  }

  const textarea = textareaRef.current;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const next = replaceTextAtSelection(value, start, end, text);
  onChange(next);

  // Set focus and selection after React updates
  setTimeout(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = start + text.length;
      textareaRef.current.selectionEnd = start + text.length;
    }
  }, 0);
}

function toFileUrl(absolutePath) {
  return encodeURI(`file:///${absolutePath.replace(/\\/g, "/").replace(/^\/*/, "")}`);
}

function resolveAssetUrl(basePath, assetPath) {
  if (!assetPath || /^(data:|https?:|file:|blob:|\/)/i.test(assetPath)) {
    return assetPath;
  }

  if (!basePath) return assetPath;

  const baseDir = basePath.replace(/[\\/][^\\/]*$/, "");
  const normalizedAsset = assetPath.replace(/^\.\//, "");
  return toFileUrl(`${baseDir}/${normalizedAsset}`);
}

function rewriteMarkdownImages(html, basePath) {
  if (!basePath) return html;

  return html.replace(/<img\b([^>]*?)src="([^"]+)"([^>]*)>/gi, (match, before, src, after) => {
    const resolved = resolveAssetUrl(basePath, src);
    return `<img${before}src="${resolved}"${after}>`;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function DocumentList({ documents, onOpen, loading }) {
  if (loading) {
    return <div className="empty-state">Loading notes...</div>;
  }

  if (!documents.length) {
    return <div className="empty-state">No markdown files found in this folder.</div>;
  }

  return (
    <div className="document-grid">
      {documents.map((doc) => (
        <button className="document-card" key={doc.filePath} onClick={() => onOpen(doc.filePath)}>
          <span className="document-title">{doc.title}</span>
          <span className="document-meta">
            {[doc.metadata?.time, doc.metadata?.location].filter(Boolean).join(" · ") || "No meeting metadata"}
          </span>
          <span className="document-updated">Updated {formatDate(doc.updatedAt)}</span>
        </button>
      ))}
    </div>
  );
}

function MermaidBlock({ code, index }) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const id = `mermaid-${index}-${Math.random().toString(36).slice(2)}`;

    mermaid.render(id, code)
      .then((result) => {
        if (!cancelled) {
          setSvg(result.svg);
          setError("");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setSvg("");
          setError(err?.message || "Unable to render Mermaid diagram.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [code, index]);

  if (error) {
    return <pre className="diagram-error">{error}</pre>;
  }

  return <div className="mermaid-render" dangerouslySetInnerHTML={{ __html: svg }} />;
}

function MarkdownPreview({ content }) {
  const parts = useMemo(() => {
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
  }, [content]);

  return (
    <div className="preview">
      {parts.map((part, index) => (
        part.type === "mermaid"
          ? <MermaidBlock code={part.value} index={index} key={`${part.type}-${index}`} />
          : <div key={`${part.type}-${index}`} dangerouslySetInnerHTML={{ __html: renderMarkdown(part.value) }} />
      ))}
    </div>
  );
}

function MarkdownToolbar({ value, onChange, textareaRef }) {
  const imageInputRef = useRef(null);

  const applySnippet = (before, after = "", placeholder = "") => {
    const textarea = textareaRef?.current;
    if (!textarea) {
      console.error("Textarea not available for snippet");
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end) || placeholder;
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = start + before.length;
      textarea.selectionEnd = start + before.length + selected.length;
    });
  };

  const handleImageSelect = (event) => {
    console.log("Image file selected:", event.target.files);
    const file = event.target.files?.[0];
    if (!file) {
      console.warn("No file selected");
      return;
    }

    console.log("Processing file:", file.name, file.type, file.size);
    readFileAsDataUrl(file)
      .then((dataUrl) => {
        console.log("DataURL created, sending to Electron...");
        // Use Electron IPC to save the image to disk
        if (!window.notesApi?.saveImage) {
          throw new Error("Image saving not available (Electron not running)");
        }
        return window.notesApi.saveImage({ fileName: file.name, base64Data: dataUrl });
      })
      .then((imagePath) => {
        console.log("Image saved at:", imagePath);
        const altText = file.name.replace(/\.[^.]+$/, "");
        const markdown = `![${altText}](${imagePath})`;
        console.log("Inserting markdown:", markdown);
        insertTextAtCursor(value, onChange, markdown, textareaRef);
      })
      .catch((error) => {
        console.error("Image insertion failed:", error);
        alert("Failed to insert image. Please try again.");
      })
      .finally(() => {
        event.target.value = "";
      });
  };

  return (
    <div className="editor-toolbar" aria-label="Markdown formatting toolbar">
      <button onClick={() => applySnippet("## ", "", "Heading")} title="Heading"><Heading2 size={18} /></button>
      <button onClick={() => applySnippet("**", "**", "bold text")} title="Bold"><Bold size={18} /></button>
      <button onClick={() => applySnippet("_", "_", "italic text")} title="Italic"><Italic size={18} /></button>
      <button onClick={() => applySnippet("- ", "", "list item")} title="List"><List size={18} /></button>
      <button onClick={() => applySnippet("> ", "", "quote")} title="Quote"><Quote size={18} /></button>
      <button onClick={() => applySnippet("`", "`", "code")} title="Code"><Code size={18} /></button>
      <button onClick={() => imageInputRef.current?.click()} title="Insert image"><ImagePlus size={18} /></button>
      <button onClick={() => applySnippet("```mermaid\n", "\n```", "flowchart LR\n  A[Start] --> B[End]")} title="Mermaid"><Zap size={18} /></button>
      <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageSelect} hidden />
    </div>
  );
}

function MarkdownEditor({ value, onChange, textareaRef }) {
  const handleDragOver = (event) => {
    if (event.dataTransfer?.types?.includes("Files")) {
      event.preventDefault();
    }
  };

  const handleDrop = async (event) => {
    const files = Array.from(event.dataTransfer?.files || []).filter((file) => file.type.startsWith("image/"));
    if (!files.length) return;

    event.preventDefault();

    try {
      if (!window.notesApi?.saveImage) {
        throw new Error("Image saving not available (Electron not running)");
      }

      const images = [];
      for (const file of files) {
        const dataUrl = await readFileAsDataUrl(file);
        const imagePath = await window.notesApi.saveImage({ fileName: file.name, base64Data: dataUrl });
        const altText = file.name.replace(/\.[^.]+$/, "");
        images.push(`![${altText}](${imagePath})`);
      }

      insertTextAtCursor(value, onChange, `${images.join("\n\n")}\n`, textareaRef);
    } catch (error) {
      console.error("Image drop insertion failed:", error);
      alert("Failed to insert images. Please try again.");
    }
  };

  return (
    <div className="markdown-editor">
      <textarea
        ref={textareaRef}
        className="markdown-textarea"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        spellCheck
      />
    </div>
  );
}

function EditorPane({ value, onChange, mode, textareaRef }) {
  const markdownEditor = <MarkdownEditor value={value} onChange={onChange} textareaRef={textareaRef} />;

  if (mode === "preview") {
    return <MarkdownPreview content={value} />;
  }

  if (mode === "split") {
    return (
      <div className="split-pane">
        <section className="pane-block">
          <div className="pane-title">Editor</div>
          <div className="markdown-editor">{markdownEditor}</div>
        </section>
        <section className="pane-block">
          <div className="pane-title">Preview</div>
          <MarkdownPreview content={value} />
        </section>
      </div>
    );
  }

  return (
    <section className="pane-block">
      <div className="pane-title">Markdown Editor</div>
      <div className="markdown-editor">{markdownEditor}</div>
    </section>
  );
}

function DocumentDetail({ documents, document, history, activeTab, setActiveTab, mode, setMode, onChange, onSave, onOpenDocument, onRefreshHistory, saving, dirty, onHome }) {
  const textareaRef = useRef(null);
  const content = activeTab === "raw" ? document.rawNotes : document.cleansed;

  const updateContent = (value) => {
    onChange({
      ...document,
      [activeTab === "raw" ? "rawNotes" : "cleansed"]: value
    });
  };

  return (
    <div className="detail-shell">
      <div className="detail-topbar">
        <button className="back-button" onClick={onHome} title="Back to home"><Home size={18} /></button>
        <div className="crumb">Notes / {document.title}</div>
        <div className="save-status">{dirty ? "Unsaved changes" : "Saved"}</div>
        <button className="primary-button" onClick={onSave} disabled={saving || !dirty} title="Save document">
          <Save size={18} />
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      <header className="doc-header">
        <div>
          <h1>{document.title}</h1>
          <p>{document.fileName}</p>
        </div>
        <div className="metadata-grid">
          <div>
            <User size={16} />
            <span>Name</span>
            <strong>{document.metadata?.name || "Not captured"}</strong>
          </div>
          <div>
            <Clock size={16} />
            <span>Time</span>
            <strong>{document.metadata?.time || "Not captured"}</strong>
          </div>
          <div>
            <MapPin size={16} />
            <span>Location</span>
            <strong>{document.metadata?.location || "Not captured"}</strong>
          </div>
        </div>
      </header>

      <div className="workspace">
        <aside className="history-panel">
          <div className="panel-title-row">
            <h2>Versions</h2>
            <button className="small-button" onClick={onRefreshHistory} title="Refresh history"><RotateCcw size={16} /></button>
          </div>
          {history.length ? (
            <div className="history-list">
              {history.map((entry) => (
                <div className="history-item" key={entry.versionPath}>
                  <strong>{formatDate(entry.createdAt)}</strong>
                  <span>{entry.reason}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">Versions appear after the first save.</p>
          )}
        </aside>

        <main className="editor-panel">
          <div className="tab-row">
            <div className="tabs">
              <button className={activeTab === "raw" ? "active" : ""} onClick={() => setActiveTab("raw")} title="Quick notes">
                <FilePenLine size={16} />
                <span>Quick Notes</span>
              </button>
              <button className={activeTab === "cleansed" ? "active" : ""} onClick={() => setActiveTab("cleansed")} title="Formal notes">
                <FileText size={16} />
                <span>Formal Notes</span>
              </button>
              <button className={activeTab === "media" ? "active" : ""} onClick={() => setActiveTab("media")} title="Media and images">
                <Images size={16} />
                <span>Media</span>
              </button>
            </div>
            {mode !== "preview" && activeTab !== "media" && <MarkdownToolbar value={content} onChange={updateContent} textareaRef={textareaRef} />}
            <div className="mode-switch">
              {[
                { key: "edit", label: "Edit", icon: PenLine },
                { key: "split", label: "Split", icon: SplitSquareHorizontal },
                { key: "preview", label: "Preview", icon: Eye }
              ].map((item) => (
                <button className={mode === item.key ? "active" : ""} key={item.key} onClick={() => setMode(item.key)}>
                  <item.icon size={16} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
          {activeTab === "media" ? (
            <MediaTab content={content} />
          ) : (
            <EditorPane value={content} onChange={updateContent} mode={mode} textareaRef={textareaRef} />
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [current, setCurrent] = useState(null);
  const [savedHash, setSavedHash] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("raw");
  const [mode, setMode] = useState("edit");
  const [error, setError] = useState("");

  const dirty = current ? savedHash !== JSON.stringify({
    header: current.header,
    rawNotes: current.rawNotes,
    cleansed: current.cleansed
  }) : false;

  async function loadDocuments() {
    setLoading(true);
    setError("");
    try {
      setDocuments(await window.notesApi.listDocuments());
    } catch (err) {
      setError(err?.message || "Unable to load documents.");
    } finally {
      setLoading(false);
    }
  }

  async function openDocument(filePath) {
    setError("");
    const doc = await window.notesApi.readDocument(filePath);
    setCurrent(doc);
    setSavedHash(JSON.stringify({
      header: doc.header,
      rawNotes: doc.rawNotes,
      cleansed: doc.cleansed
    }));
    setActiveTab("raw");
    setHistory(await window.notesApi.getHistory(filePath));
  }

  async function saveDocument() {
    if (!current) return;
    setSaving(true);
    setError("");

    try {
      const saved = await window.notesApi.saveDocument({
        filePath: current.filePath,
        header: current.header,
        rawNotes: current.rawNotes,
        cleansed: current.cleansed,
        reason: "manual-save"
      });
      setCurrent(saved);
      setSavedHash(JSON.stringify({
        header: saved.header,
        rawNotes: saved.rawNotes,
        cleansed: saved.cleansed
      }));
      setHistory(await window.notesApi.getHistory(saved.filePath));
      await loadDocuments();
    } catch (err) {
      setError(err?.message || "Unable to save document.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadDocuments();
  }, []);

  return (
    <div className="app-shell">
      {error && <div className="error-banner">{error}</div>}
      {!current ? (
        <>
          <header className="landing-header">
            <div>
              <p>TCL Mithapur</p>
              <h1>Meeting Notes</h1>
            </div>
            <span>Markdown source files with quick notes, formal notes, Mermaid diagrams, and local versions.</span>
          </header>
          <DocumentList documents={documents} onOpen={openDocument} loading={loading} />
        </>
      ) : (
        <DocumentDetail
          documents={documents}
          document={current}
          history={history}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          mode={mode}
          setMode={setMode}
          onChange={setCurrent}
          onSave={saveDocument}
          onOpenDocument={openDocument}
          onRefreshHistory={async () => setHistory(await window.notesApi.getHistory(current.filePath))}
          saving={saving}
          dirty={dirty}
          onHome={() => setCurrent(null)}
        />
      )}
    </div>
  );
}
