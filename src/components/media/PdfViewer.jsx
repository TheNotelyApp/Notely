import { useState, useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import PdfWorker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?worker";
import { dataUrlToUint8Array } from "./mediaUtils";

let pdfWorkerPort = null;
function ensurePdfWorker() {
  if (typeof window === "undefined") return;
  if (pdfjsLib.GlobalWorkerOptions.workerPort) return;
  if (!pdfWorkerPort) {
    pdfWorkerPort = new PdfWorker();
  }
  pdfjsLib.GlobalWorkerOptions.workerPort = pdfWorkerPort;
}

export function PdfViewer({ src }) {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      if (!src) {
        if (!cancelled) {
          setPages([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError(null);

      try {
        ensurePdfWorker();

        let source = src;
        if (typeof src === "string" && src.startsWith("data:")) {
          const bytes = dataUrlToUint8Array(src);
          if (bytes) {
            source = { data: bytes };
          }
        }

        const loadingTask = pdfjsLib.getDocument(source);
        const pdf = await loadingTask.promise;

        const renderedPages = [];
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
          if (cancelled) return;
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({
            canvasContext: context,
            viewport,
          }).promise;

          renderedPages.push({
            page: pageNum,
            dataUrl: canvas.toDataURL(),
          });
        }

        if (!cancelled) {
          setPages(renderedPages);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Failed to render PDF document.");
          setLoading(false);
        }
      }
    }

    loadPdf();
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (loading) {
    return (
      <div className="pdf-empty-state">
        <div className="presentation-spinner" style={{ margin: "0 auto 12px" }} />
        <p>Rendering PDF…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pdf-empty-state error" style={{ color: "var(--danger, #e06c75)" }}>
        <p>{error}</p>
      </div>
    );
  }

  if (!pages.length) {
    return <div className="pdf-empty-state">No pages to display.</div>;
  }

  return (
    <div className="media-preview-pdf-container">
      <div className="pdf-viewer">
        {pages.map((entry) => (
          <div className="pdf-page-frame" key={`pdf-page-${entry.page}`}>
            <img src={entry.dataUrl} alt={`PDF page ${entry.page}`} />
            <span className="pdf-page-label">Page {entry.page} of {pages.length}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
