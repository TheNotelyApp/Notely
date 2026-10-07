import { useState, useEffect, useRef, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import AppButton from "../AppButton";
import AppIconButton from "../AppIconButton";
import { dataUrlToUint8Array } from "./mediaUtils";

if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

export function PdfViewer({ src }) {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [zoom, setZoom] = useState(1);
  const [stageDimensions, setStageDimensions] = useState({ width: 0, height: 0 });
  const [pageRendering, setPageRendering] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const renderTaskRef = useRef(null);

  // Measure stage dimensions using ResizeObserver
  useEffect(() => {
    const stageEl = stageRef.current;
    if (!stageEl) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0) {
          setStageDimensions((prev) => {
            if (Math.abs(prev.width - width) > 5 || Math.abs(prev.height - height) > 5) {
              return { width, height };
            }
            return prev;
          });
        }
      }
    });

    ro.observe(stageEl);
    return () => ro.disconnect();
  }, [loading]);

  // 1. Load the PDF Document
  useEffect(() => {
    let cancelled = false;
    let loadingTask = null;
    let loadedPdf = null;

    async function loadPdf() {
      if (!src) {
        if (!cancelled) {
          setPdfDoc(null);
          setNumPages(0);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError(null);
      setPdfDoc(null);
      setNumPages(0);
      setCurrentPage(1);
      setPageInput("1");
      setZoom(1);

      try {
        let source = src;
        if (typeof src === "string" && src.startsWith("data:")) {
          const bytes = dataUrlToUint8Array(src);
          if (bytes) {
            source = { data: bytes };
          }
        }

        loadingTask = pdfjsLib.getDocument(source);
        const pdf = await loadingTask.promise;

        if (!cancelled) {
          loadedPdf = pdf;
          setPdfDoc(pdf);
          setNumPages(pdf.numPages);
          setLoading(false);
        } else {
          try {
            await pdf.destroy();
          } catch {
            // ignore
          }
        }
      } catch (err) {
        if (!cancelled) {
          if (err?.name !== "RenderingCancelledException" && !String(err?.message || "").includes("cancelled")) {
            setError(err?.message || "Failed to load PDF document.");
          }
          setLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      cancelled = true;
      if (loadedPdf) {
        loadedPdf.destroy().catch(() => {});
      } else if (loadingTask) {
        loadingTask.destroy().catch(() => {});
      }
    };
  }, [src]);

  // 2. Render Current Page to Canvas with responsive fit
  useEffect(() => {
    let isCurrent = true;

    async function renderPage() {
      if (!pdfDoc || !canvasRef.current) return;

      // Cancel any in-flight render and WAIT for it to release the canvas;
      // starting a new render() on the same canvas before that throws.
      const previous = renderTaskRef.current;
      if (previous) {
        try {
          previous.cancel();
        } catch {
          // ignore cancel error
        }
        try {
          await previous.promise;
        } catch {
          // cancelled render rejects; expected
        }
      }
      if (!isCurrent) return;

      setPageRendering(true);

      try {
        const page = await pdfDoc.getPage(currentPage);
        if (!isCurrent) return;

        // Determine available width from measured stage width
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const availableWidth = Math.max(600, (stageDimensions.width || stageRef.current?.clientWidth || (window.innerWidth * 0.9 - 64)) - 48);

        // Compute width-filling scale multiplied by user zoom level
        const baseScale = availableWidth / unscaledViewport.width;
        const scale = baseScale * zoom;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        // HiDPI viewport for crisp rendering
        const viewport = page.getViewport({ scale: scale * dpr });

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext("2d");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        // Explicit CSS display size matching the unscaled width
        const displayWidth = Math.floor(unscaledViewport.width * scale);
        const displayHeight = Math.floor(unscaledViewport.height * scale);
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;

        const renderContext = {
          canvasContext: context,
          viewport,
        };

        const task = page.render(renderContext);
        renderTaskRef.current = task;

        await task.promise;
      } catch (err) {
        if (err?.name !== "RenderingCancelledException") {
          console.error("PDF page render error:", err);
        }
      } finally {
        if (isCurrent) {
          setPageRendering(false);
        }
      }
    }

    renderPage();
    setPageInput(String(currentPage));

    return () => {
      isCurrent = false;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [pdfDoc, currentPage, zoom, stageDimensions]);

  // Jump back to the top of the stage whenever the page changes
  useEffect(() => {
    if (stageRef.current) stageRef.current.scrollTop = 0;
  }, [currentPage]);

  const handlePrev = useCallback(() => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  }, []);

  const handleNext = useCallback(() => {
    setCurrentPage((prev) => Math.min(numPages, prev + 1));
  }, [numPages]);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleZoomReset = () => setZoom(1);

  const handlePageSubmit = (e) => {
    e.preventDefault();
    const val = parseInt(pageInput, 10);
    if (!isNaN(val) && val >= 1 && val <= numPages) {
      setCurrentPage(val);
    } else {
      setPageInput(String(currentPage));
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept if user is typing in an input
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePrev, handleNext]);

  if (loading) {
    return (
      <div className="pdf-empty-state">
        <div className="presentation-spinner" style={{ margin: "0 auto 12px" }} />
        <p>Loading PDF document…</p>
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

  if (!numPages) {
    return <div className="pdf-empty-state">No pages to display.</div>;
  }

  return (
    <div className="media-preview-pdf-container">
      {/* Top Toolbar: Navigation, Jump-to-page, Zoom */}
      <div className="pdf-toolbar">
        <div className="pdf-nav-group">
          <AppButton
            variant="small"
            onClick={handlePrev}
            disabled={currentPage <= 1 || pageRendering}
            data-tooltip="Previous page (Left Arrow)"
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
            <span>Prev</span>
          </AppButton>

          <form onSubmit={handlePageSubmit} className="pdf-page-form">
            <input
              type="text"
              className="pdf-page-input"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={handlePageSubmit}
              aria-label="Page number"
            />
            <span className="pdf-page-total">/ {numPages}</span>
          </form>

          <AppButton
            variant="small"
            onClick={handleNext}
            disabled={currentPage >= numPages || pageRendering}
            data-tooltip="Next page (Right Arrow)"
            aria-label="Next page"
          >
            <span>Next</span>
            <ChevronRight size={16} />
          </AppButton>
        </div>

        <div className="pdf-zoom-group">
          <AppIconButton
            size="sm"
            onClick={handleZoomOut}
            disabled={zoom <= 0.5}
            data-tooltip="Zoom out"
            aria-label="Zoom out"
          >
            <ZoomOut size={14} />
          </AppIconButton>
          <span className="pdf-zoom-level">{Math.round(zoom * 100)}%</span>
          <AppIconButton
            size="sm"
            onClick={handleZoomIn}
            disabled={zoom >= 3}
            data-tooltip="Zoom in"
            aria-label="Zoom in"
          >
            <ZoomIn size={14} />
          </AppIconButton>
          <AppIconButton
            size="sm"
            onClick={handleZoomReset}
            disabled={zoom === 1}
            data-tooltip="Fit / Reset zoom"
            aria-label="Reset zoom"
          >
            <Maximize2 size={14} />
          </AppIconButton>
        </div>
      </div>

      {/* Main Single Page Stage */}
      <div className="pdf-stage" ref={stageRef}>
        <div className="pdf-canvas-card">
          <canvas ref={canvasRef} className="pdf-canvas" />
        </div>
      </div>
    </div>
  );
}
