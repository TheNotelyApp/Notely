import { useEffect, useRef, useState } from "react";
import { Pencil, Download } from "lucide-react";
import { runExport } from "../services/electronService";
import { svgElementToPngDataUrl } from "../utils/exportUtils";

export function MermaidBlock({ code, onEdit, onNotify }) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    let isCancelled = false;
    const cleanCode = (code || "").trim();

    if (!cleanCode) {
      setSvg("");
      setError("");
      return;
    }

    const renderId = `m${Math.random().toString(36).substring(2, 9)}${Date.now()}`;

    async function doRender() {
      try {
        const mermaidModule = await import("mermaid");
        const mermaid = mermaidModule?.default || mermaidModule;

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "loose",
          theme: "default",
          fontFamily: "Inter, sans-serif",
        });

        const res = await mermaid.render(renderId, cleanCode);
        const svgContent = typeof res === "string" ? res : res?.svg || "";

        if (!isCancelled) {
          setSvg(svgContent);
          setError("");
        }
      } catch (err) {
        if (!isCancelled) {
          console.error("Mermaid Render Error:", err);
          setSvg("");
          setError(err?.message || "Failed to render Mermaid diagram.");
        }
      } finally {
        const tempEl = document.getElementById(renderId);
        if (tempEl) tempEl.remove();
        const tempElD = document.getElementById(`d${renderId}`);
        if (tempElD) tempElD.remove();
      }
    }

    const animFrame = requestAnimationFrame(() => {
      void doRender();
    });

    return () => {
      isCancelled = true;
      cancelAnimationFrame(animFrame);
    };
  }, [code]);

  const handleDownloadImage = async (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (isExporting) return;

    try {
      setIsExporting(true);
      const svgElement = containerRef.current?.querySelector?.("svg");
      if (!svgElement) {
        throw new Error("Rendered diagram SVG not found.");
      }

      const dataUrl = await svgElementToPngDataUrl(svgElement);
      const result = await runExport("diagram_image", {
        dataUrl,
        filename: "mermaid-diagram.png",
      });

      if (result?.success) {
        onNotify?.(`Diagram exported to ${result.filename}`, "success");
      } else {
        onNotify?.(result?.error || "Export failed", "error");
      }
    } catch (err) {
      onNotify?.(`Diagram export failed: ${err.message}`, "error");
    } finally {
      setIsExporting(false);
    }
  };

  if (error) {
    return (
      <div
        className="diagram-error"
        style={{
          padding: "12px 16px",
          color: "var(--danger-color, #ef4444)",
          background: "color-mix(in srgb, var(--danger-color, #ef4444) 8%, transparent)",
          border: "1px solid var(--danger-color, #ef4444)",
          borderRadius: 6,
          fontSize: "0.82rem",
          margin: "8px 0",
        }}
      >
        <strong>Mermaid Render Error:</strong>
        <pre style={{ margin: "6px 0 0 0", whiteSpace: "pre-wrap", fontFamily: "monospace", fontSize: "0.78rem" }}>{error}</pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="mermaid-block-container"
      style={{ position: "relative", width: "100%", margin: "1rem 0" }}
    >
      <div className="markdown-block-actions">
        {onEdit ? (
          <>
            <button
              type="button"
              className="markdown-block-action-btn"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(code);
              }}
              data-tooltip="Edit diagram visually"
              aria-label="Edit diagram"
            >
              <Pencil size={12} style={{ marginRight: "4px" }} />
              <span>Edit</span>
            </button>
            <span className="markdown-block-action-separator" />
          </>
        ) : null}
        <button
          type="button"
          className="markdown-block-action-btn"
          onClick={handleDownloadImage}
          disabled={isExporting}
          data-tooltip="Export diagram as image (PNG)"
          aria-label="Download diagram image"
        >
          <Download size={12} style={{ marginRight: "4px" }} />
          <span>{isExporting ? "Exporting..." : "Download"}</span>
        </button>
      </div>
      <div
        className="mermaid-render"
        onClick={() => onEdit?.(code)}
        style={{
          cursor: onEdit ? "pointer" : "default",
          minHeight: "40px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
        }}
        title={onEdit ? "Click to edit Mermaid diagram visually" : ""}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}

