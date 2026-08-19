import React, { useState, useEffect } from "react";
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Clock,
  RotateCcw,
  X,
  GitCommit,
  FileText,
  GitCompare,
  User,
  ShieldCheck,
  Calendar,
} from "lucide-react";

export function TimeMachineScrubber({
  commits = [],
  currentIndex = 0,
  onChangeIndex,
  onRestore,
  onClose,
  isPlaying = false,
  onTogglePlay,
  viewMode = "preview",
  onToggleViewMode,
  isWorkingDraft = false,
  loading = false,
}) {
  const totalSteps = commits.length;
  const currentCommit = commits[currentIndex] || null;
  const [hoverIndex, setHoverIndex] = useState(null);

  // Keyboard navigation: Left/Right arrows step commits, Space toggles playback, Esc closes
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onChangeIndex?.(Math.min(totalSteps - 1, currentIndex + 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onChangeIndex?.(Math.max(0, currentIndex - 1));
      } else if (e.key === " ") {
        if (document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
          e.preventDefault();
          onTogglePlay?.();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, totalSteps, onChangeIndex, onTogglePlay]);

  if (totalSteps === 0 && !loading) {
    return (
      <div className="time-machine-bar time-machine-bar--empty">
        <div className="time-machine-bar__empty-text">
          <Clock size={14} className="time-machine-bar__icon" aria-hidden="true" />
          <span>No commit history recorded for this note yet. Commit changes in Git to inspect history.</span>
        </div>
        <button type="button" className="time-machine-close-btn" onClick={onClose} title="Exit Time Machine (Esc)">
          <X size={14} />
        </button>
      </div>
    );
  }

  const formatFullDate = (isoString) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return String(isoString);
    }
  };

  const hoveredCommit = hoverIndex !== null ? commits[hoverIndex] : null;

  // Calculate timeline track fill percentage
  const fillPercent = totalSteps > 1 ? ((totalSteps - 1 - currentIndex) / (totalSteps - 1)) * 100 : 100;

  return (
    <header className="time-machine-bar" role="region" aria-label="Time Machine History Inspection Toolbar">
      {/* Left: Branding & Status Badge */}
      <div className="time-machine-bar__left">
        <div className="time-machine-bar__brand">
          <div className="time-machine-bar__logo">
            <Clock size={14} />
          </div>
          <span className="time-machine-bar__title">Time Machine</span>
        </div>

        <div className="time-machine-bar__status-chip">
          <span className="time-machine-bar__pulse" />
          <span className="time-machine-bar__status-label">
            {isWorkingDraft ? "Working Draft" : `Revision ${totalSteps - currentIndex} of ${totalSteps}`}
          </span>
        </div>
      </div>

      {/* Center: Playback Controls & Timeline Range Track */}
      <div className="time-machine-bar__center">
        <div className="time-machine-bar__playback">
          <button
            type="button"
            className="time-machine-btn"
            onClick={() => onChangeIndex?.(Math.min(totalSteps - 1, currentIndex + 1))}
            disabled={currentIndex >= totalSteps - 1}
            title="Older revision (Left Arrow)"
            aria-label="Previous revision"
          >
            <ChevronLeft size={14} />
          </button>

          <button
            type="button"
            className={`time-machine-btn time-machine-btn--play ${isPlaying ? "is-playing" : ""}`}
            onClick={onTogglePlay}
            disabled={totalSteps <= 1}
            title={isPlaying ? "Pause timeline (Space)" : "Play timeline (Space)"}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause size={12} /> : <Play size={12} />}
          </button>

          <button
            type="button"
            className="time-machine-btn"
            onClick={() => onChangeIndex?.(Math.max(0, currentIndex - 1))}
            disabled={currentIndex <= 0}
            title="Newer revision (Right Arrow)"
            aria-label="Next revision"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="time-machine-bar__slider-wrapper">
          {hoveredCommit && (
            <div className="time-machine-tooltip">
              <span className="time-machine-tooltip__hash">
                {hoveredCommit.shortHash || hoveredCommit.hash?.slice(0, 7)}
              </span>
              <span className="time-machine-tooltip__msg">{hoveredCommit.message}</span>
            </div>
          )}

          <div className="time-machine-track-container">
            <div className="time-machine-track-fill" style={{ width: `${fillPercent}%` }} />
            <input
              type="range"
              min={0}
              max={totalSteps - 1}
              value={totalSteps - 1 - currentIndex}
              onChange={(e) => {
                const sliderVal = Number(e.target.value);
                const targetIdx = totalSteps - 1 - sliderVal;
                onChangeIndex?.(targetIdx);
              }}
              onMouseMove={(e) => {
                if (totalSteps <= 1) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const posRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                const hoverVal = Math.round(posRatio * (totalSteps - 1));
                setHoverIndex(totalSteps - 1 - hoverVal);
              }}
              onMouseLeave={() => setHoverIndex(null)}
              className="time-machine-slider"
              aria-label="History timeline scrubber"
            />
            <div className="time-machine-ticks">
              {Array.from({ length: Math.min(totalSteps, 14) }).map((_, i) => (
                <span key={i} className="time-machine-tick" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right: Commit Meta, View Switcher & Action Buttons */}
      <div className="time-machine-bar__right">
        {currentCommit && (
          <div className="time-machine-bar__commit-card" title={`Commit: ${currentCommit.message}`}>
            <span className="time-machine-bar__hash-pill">
              <GitCommit size={12} />
              {currentCommit.shortHash || currentCommit.hash?.slice(0, 7)}
            </span>
            <span className="time-machine-bar__commit-msg">{currentCommit.message}</span>
            {currentCommit.date && (
              <span className="time-machine-bar__commit-date">{formatFullDate(currentCommit.date)}</span>
            )}
          </div>
        )}

        <div className="time-machine-mode-switch" role="radiogroup" aria-label="View Mode">
          <button
            type="button"
            className={`time-machine-mode-btn ${viewMode === "preview" ? "is-active" : ""}`}
            onClick={() => onToggleViewMode?.("preview")}
            title="Preview snapshot content"
            role="radio"
            aria-checked={viewMode === "preview"}
          >
            <FileText size={12} />
            <span>Preview</span>
          </button>
          <button
            type="button"
            className={`time-machine-mode-btn ${viewMode === "diff" ? "is-active" : ""}`}
            onClick={() => onToggleViewMode?.("diff")}
            title="View line-by-line diff changes"
            role="radio"
            aria-checked={viewMode === "diff"}
          >
            <GitCompare size={12} />
            <span>Diff</span>
          </button>
        </div>

        {currentCommit && (
          <button
            type="button"
            className={`time-machine-restore-btn ${isWorkingDraft ? "is-hidden" : ""}`}
            onClick={() => !isWorkingDraft && onRestore?.(currentCommit)}
            title="Restore document to this revision"
            aria-hidden={isWorkingDraft}
            tabIndex={isWorkingDraft ? -1 : 0}
          >
            <RotateCcw size={12} />
            <span>Restore Version</span>
          </button>
        )}

        <button
          type="button"
          className="time-machine-close-btn"
          onClick={onClose}
          aria-label="Exit Time Machine"
          title="Exit Time Machine (Esc)"
        >
          <X size={14} />
        </button>
      </div>
    </header>
  );
}

export default TimeMachineScrubber;
