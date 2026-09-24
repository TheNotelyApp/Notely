import { useState, useEffect, useCallback } from "react";
import JSZip from "jszip";
import { ChevronLeft, ChevronRight, Maximize, Minimize, FileText, Image as ImageIcon } from "lucide-react";
import AppButton from "../AppButton";
import AppIconButton from "../AppIconButton";

/**
 * Robust asynchronous binary resolver for data URLs, blob URLs, http/file URLs, and base64 strings.
 */
async function resolveBinaryBytes(source) {
  if (!source) return null;
  if (source instanceof Uint8Array) return source;
  if (source instanceof ArrayBuffer) return new Uint8Array(source);

  if (typeof source === "string") {
    const trimmed = source.trim();
    if (trimmed.startsWith("data:")) {
      const commaIndex = trimmed.indexOf(",");
      if (commaIndex !== -1) {
        const base64Str = trimmed.slice(commaIndex + 1);
        try {
          const binary = atob(base64Str);
          const len = binary.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i += 1) {
            bytes[i] = binary.charCodeAt(i);
          }
          return bytes;
        } catch {
          return null;
        }
      }
    }

    if (/^(blob:|https?:|file:)/i.test(trimmed)) {
      try {
        const res = await fetch(trimmed);
        const buf = await res.arrayBuffer();
        return new Uint8Array(buf);
      } catch {
        // Continue to fallback
      }
    }

    try {
      const binary = atob(trimmed);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    } catch {
      return null;
    }
  }

  return null;
}

function getElements(parent, tagName) {
  if (!parent) return [];
  if (typeof parent.getElementsByTagNameNS === "function") {
    const nsNodes = Array.from(parent.getElementsByTagNameNS("*", tagName));
    if (nsNodes.length > 0) return nsNodes;
  }
  const prefixed = Array.from(parent.getElementsByTagName(`a:${tagName}`));
  if (prefixed.length > 0) return prefixed;
  const pPrefixed = Array.from(parent.getElementsByTagName(`p:${tagName}`));
  if (pPrefixed.length > 0) return pPrefixed;
  return Array.from(parent.getElementsByTagName(tagName));
}

function extractTextFromNode(node) {
  if (!node) return "";
  const tNodes = getElements(node, "t");
  let text = "";
  for (let i = 0; i < tNodes.length; i += 1) {
    text += tNodes[i].textContent || "";
  }
  return text.trim();
}

export function PresentationViewer({ dataUrl, fileName }) {
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function parsePresentation() {
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
        const bytes = await resolveBinaryBytes(dataUrl);
        if (!bytes || bytes.length === 0) {
          throw new Error("Could not decode presentation data.");
        }

        // Check for legacy binary .ppt OLE header (D0 CF 11 E0)
        if (bytes.length >= 4 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
          throw new Error("Legacy PowerPoint (.ppt) binary format is not supported in the embedded viewer. Please open externally or convert to .pptx.");
        }

        const zip = await JSZip.loadAsync(bytes);

        // Discover slide order from presentation.xml + relationships if present
        let orderedSlidePaths = [];

        try {
          const presRelsFile = zip.file("ppt/_rels/presentation.xml.rels");
          const presXmlFile = zip.file("ppt/presentation.xml");

          if (presRelsFile && presXmlFile) {
            const relsXml = await presRelsFile.async("string");
            const presXml = await presXmlFile.async("string");
            const parser = new DOMParser();
            const relsDoc = parser.parseFromString(relsXml, "application/xml");
            const presDoc = parser.parseFromString(presXml, "application/xml");

            const relsMap = {};
            const relationshipNodes = getElements(relsDoc, "Relationship");
            relationshipNodes.forEach((rel) => {
              const id = rel.getAttribute("Id") || rel.getAttribute("r:id") || rel.getAttribute("id");
              const target = rel.getAttribute("Target");
              if (id && target) {
                const normTarget = target.startsWith("slides/") ? `ppt/${target}` : target.startsWith("/") ? target.slice(1) : `ppt/${target}`;
                relsMap[id] = normTarget;
              }
            });

            const sldIdNodes = getElements(presDoc, "sldId");
            sldIdNodes.forEach((sld) => {
              const rId = sld.getAttribute("r:id") || sld.getAttribute("id") || sld.getAttribute("r:Id");
              if (rId && relsMap[rId] && zip.file(relsMap[rId])) {
                orderedSlidePaths.push(relsMap[rId]);
              }
            });
          }
        } catch {
          // Fallback to sorting slide filenames directly
        }

        if (orderedSlidePaths.length === 0) {
          orderedSlidePaths = Object.keys(zip.files)
            .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
            .sort((a, b) => {
              const numA = parseInt(a.match(/\d+/)?.[0] || "0", 10);
              const numB = parseInt(b.match(/\d+/)?.[0] || "0", 10);
              return numA - numB;
            });
        }

        if (orderedSlidePaths.length === 0) {
          throw new Error("No slides found in this presentation.");
        }

        const parsedSlides = [];

        for (let i = 0; i < orderedSlidePaths.length; i += 1) {
          const slidePath = orderedSlidePaths[i];
          const slideXmlContent = await zip.file(slidePath).async("string");
          const parser = new DOMParser();
          const doc = parser.parseFromString(slideXmlContent, "application/xml");

          // Load slide relationships to resolve embedded images
          const slideFileName = slidePath.split("/").pop();
          const relsPath = `ppt/slides/_rels/${slideFileName}.rels`;
          const slideRels = {};
          if (zip.file(relsPath)) {
            try {
              const relsXml = await zip.file(relsPath).async("string");
              const relsDoc = parser.parseFromString(relsXml, "application/xml");
              const relNodes = getElements(relsDoc, "Relationship");
              for (const rel of relNodes) {
                const id = rel.getAttribute("Id") || rel.getAttribute("id");
                const target = rel.getAttribute("Target");
                if (id && target) {
                  const mediaPath = target.startsWith("../")
                    ? `ppt/${target.replace(/^\.\.\//, "")}`
                    : `ppt/slides/${target}`;
                  slideRels[id] = mediaPath;
                }
              }
            } catch {
              // Ignore relationship errors
            }
          }

          // Extract slide images
          const slideImages = [];
          const blipNodes = getElements(doc, "blip");
          for (const blip of blipNodes) {
            const embedId = blip.getAttribute("r:embed") || blip.getAttribute("embed");
            const mediaZipPath = slideRels[embedId];
            if (mediaZipPath && zip.file(mediaZipPath)) {
              try {
                const imgData = await zip.file(mediaZipPath).async("base64");
                const ext = mediaZipPath.split(".").pop()?.toLowerCase() || "png";
                const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "svg" ? "image/svg+xml" : `image/${ext}`;
                slideImages.push(`data:${mime};base64,${imgData}`);
              } catch {
                // Ignore image conversion failure
              }
            }
          }

          // Parse shapes, titles, paragraphs, and tables
          let titleText = "";
          let subtitleText = "";
          const bodyParagraphs = [];
          const tables = [];

          const shapes = getElements(doc, "sp");
          for (const sp of shapes) {
            const phNode = getElements(sp, "ph")[0];
            const phType = (phNode?.getAttribute("type") || "").toLowerCase();
            const isTitle = phType === "title" || phType === "ctrtitle" || phType === "header";
            const isSubTitle = phType === "subtitle" || phType === "sub";

            const pNodes = getElements(sp, "p");
            const shapeParagraphs = [];
            for (const p of pNodes) {
              const text = extractTextFromNode(p);
              if (text) {
                shapeParagraphs.push(text);
              }
            }

            if (isTitle && shapeParagraphs.length > 0) {
              if (!titleText) titleText = shapeParagraphs.join(" ");
              else bodyParagraphs.push(...shapeParagraphs);
            } else if (isSubTitle && shapeParagraphs.length > 0) {
              if (!subtitleText) subtitleText = shapeParagraphs.join(" ");
              else bodyParagraphs.push(...shapeParagraphs);
            } else {
              bodyParagraphs.push(...shapeParagraphs);
            }
          }

          // If no title found via placeholders, check first paragraph
          if (!titleText && bodyParagraphs.length > 0) {
            titleText = bodyParagraphs.shift();
          }

          // Parse tables
          const tblNodes = getElements(doc, "tbl");
          for (const tbl of tblNodes) {
            const rows = [];
            const trNodes = getElements(tbl, "tr");
            for (const tr of trNodes) {
              const rowCells = [];
              const tcNodes = getElements(tr, "tc");
              for (const tc of tcNodes) {
                rowCells.push(extractTextFromNode(tc));
              }
              if (rowCells.some(Boolean)) {
                rows.push(rowCells);
              }
            }
            if (rows.length > 0) {
              tables.push(rows);
            }
          }

          // Check for notes slide
          let slideNotes = "";
          const noteSlidePath = `ppt/notesSlides/notesSlide${i + 1}.xml`;
          if (zip.file(noteSlidePath)) {
            try {
              const noteXml = await zip.file(noteSlidePath).async("string");
              const noteDoc = parser.parseFromString(noteXml, "application/xml");
              const noteTexts = [];
              const noteShapes = getElements(noteDoc, "sp");
              for (const sp of noteShapes) {
                const ph = getElements(sp, "ph")[0];
                if (ph?.getAttribute("type") === "body") {
                  const pNodes = getElements(sp, "p");
                  for (const p of pNodes) {
                    const t = extractTextFromNode(p);
                    if (t) noteTexts.push(t);
                  }
                }
              }
              slideNotes = noteTexts.join("\n");
            } catch {
              // Ignore notes parse errors
            }
          }

          parsedSlides.push({
            slideNumber: i + 1,
            title: titleText || `Slide ${i + 1}`,
            subtitle: subtitleText,
            body: bodyParagraphs,
            tables,
            images: slideImages,
            notes: slideNotes,
          });
        }

        if (!cancelled) {
          setSlides(parsedSlides);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Failed to parse presentation slides.");
          setLoading(false);
        }
      }
    }

    void parsePresentation();
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
        <p>Loading presentation slides…</p>
      </div>
    );
  }

  if (error || !slides.length) {
    return (
      <div className="presentation-error-container">
        <p className="presentation-error-title">Unable to preview presentation</p>
        <p className="presentation-error-msg">{error || "No slide content found in file."}</p>
        {fileName && <span className="presentation-file-label">{fileName}</span>}
      </div>
    );
  }

  return (
    <div className={`presentation-viewer-wrapper ${isFullscreen ? "presentation-fullscreen" : ""}`}>
      <div className="presentation-slide-stage">
        <div className="presentation-slide-card">
          <div className="presentation-slide-header">
            <span className="presentation-slide-num">Slide {currentSlide?.slideNumber}</span>
            {currentSlide?.images?.length > 0 && (
              <span className="presentation-badge" title={`${currentSlide.images.length} embedded images`}>
                <ImageIcon size={12} style={{ marginRight: "4px" }} />
                {currentSlide.images.length} {currentSlide.images.length === 1 ? "Image" : "Images"}
              </span>
            )}
          </div>

          <div className="presentation-slide-content">
            <h2 className="presentation-slide-title">{currentSlide?.title}</h2>
            {currentSlide?.subtitle && (
              <h4 className="presentation-slide-subtitle" style={{ color: "var(--text-muted)", marginTop: "-4px", marginBottom: "12px", fontWeight: "normal" }}>
                {currentSlide.subtitle}
              </h4>
            )}

            {currentSlide?.body?.length > 0 && (
              <ul className="presentation-slide-bullets">
                {currentSlide.body.map((item, idx) => (
                  <li key={`bullet-${idx}`} className="presentation-bullet-item">
                    {item}
                  </li>
                ))}
              </ul>
            )}

            {currentSlide?.tables?.map((tableData, tIdx) => (
              <div key={`table-${tIdx}`} style={{ overflowX: "auto", margin: "12px 0" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <tbody>
                    {tableData.map((row, rIdx) => (
                      <tr key={`r-${rIdx}`} style={{ background: rIdx === 0 ? "var(--surface-muted)" : "transparent" }}>
                        {row.map((cell, cIdx) => (
                          <td key={`c-${cIdx}`} style={{ border: "1px solid var(--border-subtle)", padding: "6px 10px" }}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

            {currentSlide?.images?.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "14px" }}>
                {currentSlide.images.map((imgSrc, imgIdx) => (
                  <img
                    key={`img-${imgIdx}`}
                    src={imgSrc}
                    alt={`Slide ${currentSlide.slideNumber} Graphic ${imgIdx + 1}`}
                    style={{ maxHeight: "140px", maxWidth: "100%", borderRadius: "6px", objectFit: "contain", border: "1px solid var(--border-subtle)" }}
                  />
                ))}
              </div>
            )}

            {showNotes && currentSlide?.notes && (
              <div style={{ marginTop: "16px", padding: "10px 14px", background: "var(--surface-muted)", borderRadius: "6px", borderLeft: "3px solid var(--primary-accent)" }}>
                <strong style={{ fontSize: "12px", display: "block", marginBottom: "4px" }}>Speaker Notes:</strong>
                <p style={{ margin: 0, fontSize: "12px", whiteSpace: "pre-wrap" }}>{currentSlide.notes}</p>
              </div>
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

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {currentSlide?.notes ? (
            <AppButton
              variant="small"
              onClick={() => setShowNotes(!showNotes)}
              data-tooltip={showNotes ? "Hide speaker notes" : "Show speaker notes"}
            >
              <FileText size={14} />
              <span>Notes</span>
            </AppButton>
          ) : null}

          <AppIconButton
            size="sm"
            onClick={() => setIsFullscreen(!isFullscreen)}
            data-tooltip={isFullscreen ? "Exit fullscreen" : "Fullscreen presentation"}
            aria-label="Toggle fullscreen"
          >
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </AppIconButton>
        </div>
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
