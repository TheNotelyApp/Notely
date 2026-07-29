import { useState, useMemo, useEffect, useRef } from "react";
import {
  FileText,
  User,
  Clock,
  MapPin,
  Tag,
  X,
  Save,
  FileCode,
} from "lucide-react";
import AppButton from "./AppButton";
import AppInput from "./AppInput";

function getMonthLabels() {
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
}

const MONTH_INDEX_BY_LABEL = getMonthLabels().reduce((map, label, index) => {
  map[label.toLowerCase()] = index;
  return map;
}, {});

function formatDateTimeLocalForHeader(value) {
  const text = String(value || "").trim();
  if (!text || !text.includes("T")) return "";
  const [datePart, timePart] = text.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  if (!year || !month || !day || !timePart) return "";
  const label = getMonthLabels()[month - 1];
  if (!label) return "";
  return `${timePart}, ${String(day).padStart(2, "0")} ${label} ${year}`;
}

function parseHeaderDateTimeToInput(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const match = text.match(/^(\d{1,2}):(\d{2}),\s*(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/);
  if (!match) return "";

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const day = Number(match[3]);
  const month = MONTH_INDEX_BY_LABEL[String(match[4]).slice(0, 3).toLowerCase()];
  const year = Number(match[5]);

  if (!Number.isInteger(month) || hour < 0 || hour > 23 || minute < 0 || minute > 59 || day < 1 || day > 31 || year < 1000) {
    return "";
  }

  return `${String(year).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseTimeRangeToInputs(value) {
  const text = String(value || "").trim();
  if (!text) return { from: "", to: "" };

  const parts = text.split(/\s+to\s+/i);
  if (parts.length === 2) {
    return {
      from: parseHeaderDateTimeToInput(parts[0]),
      to: parseHeaderDateTimeToInput(parts[1]),
    };
  }

  return {
    from: parseHeaderDateTimeToInput(text),
    to: "",
  };
}

function buildTimeRangeHeaderValue(fromValue, toValue) {
  const fromLabel = formatDateTimeLocalForHeader(fromValue);
  const toLabel = formatDateTimeLocalForHeader(toValue);

  if (fromLabel && toLabel) return `${fromLabel} to ${toLabel}`;
  if (fromLabel) return fromLabel;
  if (toLabel) return toLabel;
  return "";
}

function parseHeaderField(header, fieldName) {
  const normalizedField = String(fieldName || "").trim().toLowerCase();
  const line = String(header || "").split(/\r?\n/).find((item) => {
    const match = item.match(/^([^:]+):\s*(.*)$/);
    return match && match[1].trim().toLowerCase() === normalizedField;
  });
  return line?.replace(/^[^:]+:\s*/, "") || "";
}

function setHeaderField(header, fieldName, value) {
  const normalizedField = String(fieldName || "").trim().toLowerCase();
  const label = String(fieldName || "").trim();
  const nextValue = String(value || "").trim();
  const lines = String(header || "").split(/\r?\n/);
  let replaced = false;
  const nextLines = lines.filter((line) => line.trim() || lines.length > 1).map((line) => {
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (match && match[1].trim().toLowerCase() === normalizedField) {
      replaced = true;
      return nextValue ? `${label}: ${nextValue}` : "";
    }
    return line;
  }).filter(Boolean);

  if (!replaced && nextValue) {
    nextLines.push(`${label}: ${nextValue}`);
  }

  return nextLines.join("\n").trim();
}

function parseTagList(value) {
  return String(value || "")
    .split(/[\s,#]+/)
    .map((tag) => tag.trim().replace(/^#+/, ""))
    .filter(Boolean);
}

function mergeTagLists(existingTags, incomingTags) {
  const dedup = new Set();
  const output = [];

  for (const item of [...(existingTags || []), ...(incomingTags || [])]) {
    const tag = String(item || "").trim().replace(/^#+/, "");
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (dedup.has(key)) continue;
    dedup.add(key);
    output.push(tag);
  }

  return output;
}

function getDefaultDateTimeStrings() {
  const now = new Date();
  const fromStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const oneHourLater = new Date(now.getTime() + 3600000);
  const toStr = new Date(oneHourLater.getTime() - oneHourLater.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return { fromStr, toStr };
}

export function MetadataPopover({
  document,
  isOpen,
  onClose,
  onChange,
  onSaveDocument,
  onRenameTitle,
}) {
  const popoverRef = useRef(null);

  // Parse initial state from document
  const initialTitle = document?.title || "";
  const initialHeader = document?.header || "";
  const initialName = parseHeaderField(initialHeader, "Name");
  const initialLocation = parseHeaderField(initialHeader, "Location");
  const initialTime = parseHeaderField(initialHeader, "Time");
  const initialTagsStr = parseHeaderField(initialHeader, "Tags");
  const initialTags = useMemo(() => parseTagList(initialTagsStr), [initialTagsStr]);

  const initialParsedTime = useMemo(() => parseTimeRangeToInputs(initialTime), [initialTime]);
  const defaults = useMemo(() => getDefaultDateTimeStrings(), []);

  // Draft state
  const [titleDraft, setTitleDraft] = useState(initialTitle);
  const [nameDraft, setNameDraft] = useState(initialName);
  const [locationDraft, setLocationDraft] = useState(initialLocation);
  const [timeFromDraft, setTimeFromDraft] = useState(initialParsedTime.from || defaults.fromStr);
  const [timeToDraft, setTimeToDraft] = useState(initialParsedTime.to || defaults.toStr);
  const [tagsDraft, setTagsDraft] = useState(initialTags);
  const [tagInputText, setTagInputText] = useState("");

  // Sync draft state when document changes or popover opens
  useEffect(() => {
    if (isOpen) {
      setTitleDraft(document?.title || "");
      setNameDraft(parseHeaderField(document?.header, "Name"));
      setLocationDraft(parseHeaderField(document?.header, "Location"));
      const parsed = parseTimeRangeToInputs(parseHeaderField(document?.header, "Time"));
      const defs = getDefaultDateTimeStrings();
      setTimeFromDraft(parsed.from || defs.fromStr);
      setTimeToDraft(parsed.to || defs.toStr);
      setTagsDraft(parseTagList(parseHeaderField(document?.header, "Tags")));
      setTagInputText("");
    }
  }, [isOpen, document?.title, document?.header, document?.filePath]);

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleOutsideClick = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose?.();
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Compute if changes exist
  const timeRangeHeaderValue = buildTimeRangeHeaderValue(timeFromDraft, timeToDraft);
  const hasChanges = useMemo(() => {
    if (titleDraft.trim() !== initialTitle.trim()) return true;
    if (nameDraft.trim() !== initialName.trim()) return true;
    if (locationDraft.trim() !== initialLocation.trim()) return true;
    if (timeRangeHeaderValue.trim() !== initialTime.trim()) return true;
    if (tagsDraft.join(", ") !== initialTags.join(", ")) return true;
    return false;
  }, [
    titleDraft, initialTitle,
    nameDraft, initialName,
    locationDraft, initialLocation,
    timeRangeHeaderValue, initialTime,
    tagsDraft, initialTags
  ]);

  const timeRangeWarning = useMemo(() => {
    if (!timeFromDraft || !timeToDraft) return "";
    const fromTs = Date.parse(timeFromDraft);
    const toTs = Date.parse(timeToDraft);
    if (!Number.isFinite(fromTs) || !Number.isFinite(toTs)) return "";
    return fromTs > toTs ? "End time must be after start time." : "";
  }, [timeFromDraft, timeToDraft]);

  if (!isOpen) return null;

  const handleTagRemove = (tagToRemove) => {
    setTagsDraft((prev) => prev.filter((t) => t.toLowerCase() !== tagToRemove.toLowerCase()));
  };

  const handleTagInputKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const newTags = parseTagList(tagInputText);
      if (newTags.length) {
        setTagsDraft((prev) => mergeTagLists(prev, newTags));
        setTagInputText("");
      }
    }
  };

  const handleSave = async () => {
    if (!hasChanges) return;

    // Apply header updates to document
    let updatedHeader = document?.header || "";
    updatedHeader = setHeaderField(updatedHeader, "Name", nameDraft);
    updatedHeader = setHeaderField(updatedHeader, "Location", locationDraft);
    updatedHeader = setHeaderField(updatedHeader, "Time", timeRangeHeaderValue);
    updatedHeader = setHeaderField(updatedHeader, "Tags", tagsDraft.join(", "));

    const updatedDoc = {
      ...document,
      header: updatedHeader,
    };

    // Rename title if changed
    if (titleDraft.trim() && titleDraft.trim() !== (document?.title || "").trim()) {
      if (typeof onRenameTitle === "function") {
        await onRenameTitle(titleDraft.trim());
      }
    }

    onChange?.(updatedDoc);

    // Save file as requested by user
    if (typeof onSaveDocument === "function") {
      await onSaveDocument();
    }

    onClose?.();
  };

  return (
    <div className="metadata-popover-overlay">
      <div className="metadata-popover-card" ref={popoverRef} role="dialog" aria-label="Note Metadata Details">
        <div className="metadata-popover-header">
          <div className="metadata-popover-title-group">
            <FileText size={16} className="metadata-popover-header-icon" />
            <span className="metadata-popover-title">Note Details</span>
          </div>
          <button
            type="button"
            className="metadata-popover-close-btn"
            onClick={onClose}
            aria-label="Close details popover"
          >
            <X size={16} />
          </button>
        </div>

        <div className="metadata-popover-body">
          {/* Title field */}
          <div className="metadata-field-group">
            <label className="metadata-field-label" htmlFor="meta-popover-title">
              <FileText size={14} />
              <span>Title</span>
            </label>
            <AppInput
              id="meta-popover-title"
              type="text"
              className="metadata-field-input"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (titleDraft.trim() && titleDraft.trim() !== initialTitle.trim()) {
                    onRenameTitle?.(titleDraft.trim());
                  }
                } else if (e.key === "Escape") {
                  setTitleDraft(initialTitle);
                }
              }}
              onBlur={() => {
                if (titleDraft.trim() && titleDraft.trim() !== initialTitle.trim()) {
                  const confirmed = window.confirm(`Rename note to "${titleDraft.trim()}"?`);
                  if (confirmed) {
                    onRenameTitle?.(titleDraft.trim());
                  } else {
                    setTitleDraft(initialTitle);
                  }
                }
              }}
              placeholder="Note Title"
              aria-label="Note title"
            />
          </div>

          {/* Filename readonly field */}
          <div className="metadata-field-group">
            <label className="metadata-field-label">
              <FileCode size={14} />
              <span>File Name</span>
            </label>
            <div className="metadata-readonly-value">
              {document?.fileName || "Untitled"}
            </div>
          </div>

          {/* Name field */}
          <div className="metadata-field-group">
            <label className="metadata-field-label" htmlFor="meta-popover-name">
              <User size={14} />
              <span>Author / Name</span>
            </label>
            <AppInput
              id="meta-popover-name"
              type="text"
              className="metadata-field-input"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Add author or name"
            />
          </div>

          {/* Location field */}
          <div className="metadata-field-group">
            <label className="metadata-field-label" htmlFor="meta-popover-location">
              <MapPin size={14} />
              <span>Location</span>
            </label>
            <AppInput
              id="meta-popover-location"
              type="text"
              className="metadata-field-input"
              value={locationDraft}
              onChange={(e) => setLocationDraft(e.target.value)}
              placeholder="Add location"
            />
          </div>

          {/* Time Range fields */}
          <div className="metadata-field-group metadata-field-full">
            <label className="metadata-field-label">
              <Clock size={14} />
              <span>Reminder Time Range</span>
            </label>
            <div className="metadata-time-inputs">
              <div className="metadata-time-subfield">
                <span className="metadata-time-sublabel">From</span>
                <AppInput
                  type="datetime-local"
                  className="metadata-field-input"
                  value={timeFromDraft}
                  onChange={(e) => setTimeFromDraft(e.target.value)}
                />
              </div>
              <div className="metadata-time-subfield">
                <span className="metadata-time-sublabel">To</span>
                <AppInput
                  type="datetime-local"
                  className="metadata-field-input"
                  value={timeToDraft}
                  onChange={(e) => setTimeToDraft(e.target.value)}
                />
              </div>
            </div>
            {timeRangeWarning && <span className="metadata-popover-warning">{timeRangeWarning}</span>}
          </div>

          {/* Tags field */}
          <div className="metadata-field-group metadata-field-full">
            <label className="metadata-field-label" htmlFor="meta-popover-tags">
              <Tag size={14} />
              <span>Tags</span>
            </label>
            <div className="metadata-tags-container">
              <div className="metadata-tag-chip-list">
                {tagsDraft.length ? (
                  tagsDraft.map((tag) => (
                    <span className="metadata-tag-chip" key={tag.toLowerCase()}>
                      <span>#{tag}</span>
                      <button
                        type="button"
                        className="metadata-tag-chip-remove"
                        onClick={() => handleTagRemove(tag)}
                        aria-label={`Remove tag ${tag}`}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))
                ) : (
                  <span className="metadata-no-tags">No tags yet</span>
                )}
              </div>
              <AppInput
                id="meta-popover-tags"
                type="text"
                className="metadata-field-input"
                value={tagInputText}
                onChange={(e) => setTagInputText(e.target.value)}
                onKeyDown={handleTagInputKeyDown}
                placeholder="Type tag and press Enter"
              />
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="metadata-popover-footer">
          <AppButton variant="small" onClick={onClose}>
            Close
          </AppButton>
          <AppButton
            variant="primary"
            size="small"
            onClick={handleSave}
            disabled={!hasChanges}
          >
            <Save size={14} />
            <span>Save</span>
          </AppButton>
        </div>
      </div>
    </div>
  );
}
