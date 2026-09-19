import { useState, useEffect, useCallback } from "react";
import JSZip from "jszip";
import { ChevronLeft, ChevronRight, Maximize, Minimize } from "lucide-react";
import AppButton from "../AppButton";
import AppIconButton from "../AppIconButton";
import { dataUrlToUint8Array } from "./mediaUtils";

export function PresentationViewer({ dataUrl }) {
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function parsePptx() {
      if (!dataUrl) {
        if (!cancelled) {
          setSlides([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const bytes = dataUrlToUint8Array(dataUrl);
        if (!bytes) throw new Error("Could not decode presentation data.");

        const zip = await JSZip.loadAsync(bytes);

        // Find all slide XML files
        const slideFileNames = Object.keys(zip.files)
          .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
          .sort((a, b) => {
            const numA = parseInt(a.match(/\d+/)?.[0] || "0", 10);
            const numB = parseInt(b.match(/\d+/)?.[0] || "0", 10);
            return numA - numB;
          });

        if (!slideFileNames.length) {
          throw new Error("No slides found in this presentation.");
        }

        const parsed = [];

        for (let i = 0; i < slideFileNames.length; i += 1) {
          const slidePath = slideFileNames[i];
          const xmlContent = await zip.file(slidePath).async("string");
          const parser = new DOMParser();
          const doc = parser.parseFromString(xmlContent, "application/xml");

          // Helper to retrieve elements by tag name regardless of namespace prefix
          const getChildElements = (parent, tag) => {
            if (parent.getElementsByTagNameNS) {
              const nsNodes = Array.from(parent.getElementsByTagNameNS("*", tag));
              if (nsNodes.length > 0) return nsNodes;
            }
            const prefixed = Array.from(parent.getElementsByTagName(`a:${tag}`));
            if (prefixed.length > 0) return prefixed;
            return Array.from(parent.getElementsByTagName(tag));
          };

          // Extract text runs
          const paragraphs = [];
          const pElements = getChildElements(doc, "p");

          for (let p = 0; p < pElements.length; p += 1) {
            const textNodes = getChildElements(pElements[p], "t");
            let pText = "";
            for (let t = 0; t < textNodes.length; t += 1) {
              pText += textNodes[t].textContent || "";
            }
            const trimmed = pText.trim();
            if (trimmed) {
              paragraphs.push(trimmed);
            }
          }

          // Check if first paragraph is a slide title
          const title = paragraphs[0] || `Slide ${i + 1}`;
          const body = paragraphs.length > 1 ? paragraphs.slice(1) : [];

          parsed.push({
            slideNumber: i + 1,
            title,
            body,
          });
        }

        if (!cancelled) {
          setSlides(parsed);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Failed to parse presentation slides.");
          setLoading(false);
        }
      }
    }

    parsePptx();
    return () => {
      cancelled = true;
    };
  }, [dataUrl]);

  const handlePrev = useCallback(() => {
    setCurrentSlideIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNext = useCallback(() => {
    setCurrentSlideIndex((prev) => Math.min(slides.length - 1, prev + 1));
  }, [slides.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === "Space") {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePrev, handleNext]);

  const currentSlide = slides[currentSlideIndex];

  if (loading) {
    return (
      <div className="presentation-loading-state">
        <div className="presentation-spinner" />
        <p>Loading slides…</p>
      </div>
    );
  }

  if (error || !slides.length) {
    return (
      <div className="presentation-error-container">
        <p className="presentation-error-title">Unable to preview presentation</p>
        <p className="presentation-error-msg">{error || "No slide content found."}</p>
      </div>
    );
  }

  return (
    <div className={`presentation-viewer-wrapper ${isFullscreen ? "presentation-fullscreen" : ""}`}>
      <div className="presentation-slide-stage">
        <div className="presentation-slide-card">
          <div className="presentation-slide-header">
            <span className="presentation-slide-num">Slide {currentSlide?.slideNumber}</span>
          </div>
          <div className="presentation-slide-content">
            <h2 className="presentation-slide-title">{currentSlide?.title}</h2>
            {currentSlide?.body?.length > 0 && (
              <ul className="presentation-slide-bullets">
                {currentSlide.body.map((item, idx) => (
                  <li key={`bullet-${idx}`} className="presentation-bullet-item">
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="presentation-controls-bar">
        <div className="presentation-nav-buttons">
          <AppButton
            variant="small"
            onClick={handlePrev}
            disabled={currentSlideIndex === 0}
            data-tooltip="Previous slide (Left Arrow)"
            aria-label="Previous slide"
          >
            <ChevronLeft size={16} />
            <span>Prev</span>
          </AppButton>
          <span className="presentation-counter">
            {currentSlideIndex + 1} / {slides.length}
          </span>
          <AppButton
            variant="small"
            onClick={handleNext}
            disabled={currentSlideIndex >= slides.length - 1}
            data-tooltip="Next slide (Right Arrow)"
            aria-label="Next slide"
          >
            <span>Next</span>
            <ChevronRight size={16} />
          </AppButton>
        </div>

        <AppIconButton
          size="sm"
          onClick={() => setIsFullscreen(!isFullscreen)}
          data-tooltip={isFullscreen ? "Exit fullscreen" : "Fullscreen presentation"}
          aria-label="Toggle fullscreen"
        >
          {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
        </AppIconButton>
      </div>

      {slides.length > 1 && (
        <div className="presentation-thumbnail-strip" role="tablist" aria-label="Slide thumbnails">
          {slides.map((s, idx) => (
            <button
              key={`thumb-${idx}`}
              type="button"
              role="tab"
              aria-selected={currentSlideIndex === idx}
              className={`presentation-thumb-card ${currentSlideIndex === idx ? "active" : ""}`}
              onClick={() => setCurrentSlideIndex(idx)}
              data-tooltip={`Slide ${idx + 1}: ${s.title}`}
            >
              <span className="thumb-num">{idx + 1}</span>
              <span className="thumb-title">{s.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
