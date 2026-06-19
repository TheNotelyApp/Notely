import { useEffect, useMemo, useRef, useState } from "react";
import { createImageMarkdown, insertTextAtCursor } from "../utils/markdownUtils";
import { insertImagesFromFiles } from "../services/imageService";

function getLineStartIndex(text, lineNumber) {
  const targetLine = Math.max(lineNumber, 1);
  let currentLine = 1;
  for (let index = 0; index < text.length; index += 1) {
    if (currentLine === targetLine) return index;
    if (text[index] === "\n") currentLine += 1;
  }
  return text.length;
}

export function MarkdownEditor({
  value,
  onChange,
  textareaRef,
  onNotify,
  validationIssues = [],
  focusedLine = 1,
}) {
  const gutterRef = useRef(null);
  const [activeLine, setActiveLine] = useState(1);
  const lineNumbers = useMemo(() => {
    const count = (value.match(/\n/g) || []).length + 1;
    return Array.from({ length: count }, (_value, index) => index + 1);
  }, [value]);
  const issueLineSet = useMemo(() => {
    return new Set((validationIssues || []).map((issue) => issue.line));
  }, [validationIssues]);

  useEffect(() => {
    if (Number.isFinite(focusedLine) && focusedLine > 0) {
      setActiveLine(focusedLine);
    }
  }, [focusedLine]);

  const handleDragOver = (event) => {
    if (event.dataTransfer?.types?.includes("Files")) {
      event.preventDefault();
    }
  };

  const handleDrop = async (event) => {
    const files = event.dataTransfer?.files || [];
    if (!files.length) return;

    event.preventDefault();

    try {
      const results = await insertImagesFromFiles(files);
      const markdownImages = results.map((result) =>
        createImageMarkdown(result.altText, result.imagePath)
      );
      insertTextAtCursor(value, onChange, `${markdownImages.join("\n\n")}\n`, textareaRef);
      onNotify?.(`Inserted ${results.length} image${results.length > 1 ? "s" : ""}.`, "success");
    } catch (error) {
      console.error("Image drop insertion failed:", error);
      onNotify?.(error?.message || "Failed to insert dropped images.", "error");
    }
  };

  const handleEditorScroll = (event) => {
    if (gutterRef.current) {
      gutterRef.current.scrollTop = event.target.scrollTop;
    }
  };

  const updateActiveLineFromSelection = (event) => {
    const beforeCursor = event.target.value.slice(0, event.target.selectionStart);
    const line = beforeCursor.split("\n").length;
    setActiveLine(line);
  };

  const handleLineClick = async (line) => {
    const editor = textareaRef?.current;
    if (!editor) return;

    const startIndex = getLineStartIndex(value || "", line);
    editor.focus();
    editor.selectionStart = startIndex;
    editor.selectionEnd = startIndex;
    setActiveLine(line);

    try {
      await navigator.clipboard.writeText(`#L${line}`);
      onNotify?.(`Line ${line} copied as #L${line}.`, "info");
    } catch {
      // Clipboard may be blocked; ignore silently.
    }
  };

  return (
    <div className="markdown-editor">
      <div className="markdown-editor-shell">
        <div className="markdown-gutter" ref={gutterRef} aria-hidden="true">
          {lineNumbers.map((line) => (
            <button
              type="button"
              className={`markdown-line-number ${activeLine === line ? "active" : ""}`}
              key={line}
              onClick={() => handleLineClick(line)}
              title={`Go to line ${line}`}
            >
              <span>{line}</span>
              {issueLineSet.has(line) ? <em className="line-issue-marker">!</em> : null}
            </button>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          className="markdown-textarea with-line-numbers"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onScroll={handleEditorScroll}
          onClick={updateActiveLineFromSelection}
          onKeyUp={updateActiveLineFromSelection}
          spellCheck
        />
      </div>
    </div>
  );
}
