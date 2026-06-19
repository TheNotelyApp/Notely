import { useEffect, useRef } from "react";
import { MarkdownEditor } from "./MarkdownEditor";
import { MarkdownPreview } from "./MarkdownPreview";
import { MarkdownToolbar } from "./MarkdownToolbar";
import { MarkdownValidationBanner } from "./MarkdownValidationBanner";
import { useMarkdownValidation } from "../hooks/useMarkdownValidation";

export function EditorPane({
  value,
  onChange,
  mode,
  textareaRef,
  basePath,
  showToolbar = true,
  onNotify,
}) {
  const previewRef = useRef(null);
  const { issues: validationIssues, status: validationStatus } = useMarkdownValidation(value);

  useEffect(() => {
    if (mode !== "split") return undefined;

    const editorElement = textareaRef?.current;
    const previewElement = previewRef.current;
    if (!editorElement || !previewElement) return undefined;

    const headingLines = [];
    const lines = (value || "").split(/\r?\n/);
    lines.forEach((line, index) => {
      if (/^#{1,6}\s+/.test(line.trim())) {
        headingLines.push(index + 1);
      }
    });

    const previewHeadings = Array.from(previewElement.querySelectorAll("h1, h2, h3, h4, h5, h6"));

    const syncPreviewFromEditor = () => {
      const lineHeight = parseFloat(window.getComputedStyle(editorElement).lineHeight) || 20;
      const currentLine = Math.floor(editorElement.scrollTop / lineHeight) + 1;

      if (headingLines.length && previewHeadings.length) {
        let headingIndex = -1;
        for (let index = 0; index < headingLines.length; index += 1) {
          if (headingLines[index] <= currentLine) {
            headingIndex = index;
          } else {
            break;
          }
        }

        if (headingIndex >= 0 && previewHeadings[headingIndex]) {
          const currentHeadingLine = headingLines[headingIndex];
          const nextHeadingLine = headingLines[headingIndex + 1] || lines.length + 1;
          const sectionRatio =
            (currentLine - currentHeadingLine) / Math.max(nextHeadingLine - currentHeadingLine, 1);

          const currentHeadingTop = previewHeadings[headingIndex].offsetTop;
          const nextHeadingTop = previewHeadings[headingIndex + 1]
            ? previewHeadings[headingIndex + 1].offsetTop
            : previewElement.scrollHeight - previewElement.clientHeight;

          const targetTop =
            currentHeadingTop +
            Math.max(Math.min(sectionRatio, 1), 0) * Math.max(nextHeadingTop - currentHeadingTop, 0);
          previewElement.scrollTop = targetTop;
          return;
        }
      }

      const sourceScrollable = editorElement.scrollHeight - editorElement.clientHeight;
      const targetScrollable = previewElement.scrollHeight - previewElement.clientHeight;
      const ratio = sourceScrollable > 0 ? editorElement.scrollTop / sourceScrollable : 0;
      previewElement.scrollTop = ratio * Math.max(targetScrollable, 0);
    };

    const handleEditorScroll = () => syncPreviewFromEditor();

    editorElement.addEventListener("scroll", handleEditorScroll, { passive: true });
    syncPreviewFromEditor();

    return () => {
      editorElement.removeEventListener("scroll", handleEditorScroll);
    };
  }, [mode, textareaRef, value]);

  const markdownEditor = (
    <MarkdownEditor
      value={value}
      onChange={onChange}
      textareaRef={textareaRef}
      onNotify={onNotify}
      validationIssues={validationIssues}
    />
  );

  if (mode === "preview") {
    return <MarkdownPreview content={value} basePath={basePath} />;
  }

  if (mode === "split") {
    return (
      <div className="split-pane">
        <section className="pane-block">
          <div className="pane-title toolbar-label-row">
            <span className="pane-title-label">Editor</span>
          </div>
          {showToolbar ? (
            <div className="pane-toolbar-row">
              <MarkdownToolbar
                value={value}
                onChange={onChange}
                textareaRef={textareaRef}
                basePath={basePath}
                onNotify={onNotify}
                validationIssues={validationIssues}
                validationStatus={validationStatus}
              />
            </div>
          ) : null}
          {showToolbar ? <MarkdownValidationBanner issues={validationIssues} status={validationStatus} /> : null}
          <div className="markdown-editor">{markdownEditor}</div>
        </section>
        <section className="pane-block">
          <div className="pane-title">
            <span className="pane-title-label">Preview</span>
          </div>
          {showToolbar ? <div className="pane-toolbar-spacer" aria-hidden="true" /> : null}
          <MarkdownPreview content={value} basePath={basePath} externalRef={previewRef} />
        </section>
      </div>
    );
  }

  return (
    <section className="pane-block">
      <div className="pane-title toolbar-label-row">
        <span className="pane-title-label">Markdown Editor</span>
      </div>
      {showToolbar ? (
        <div className="pane-toolbar-row">
          <MarkdownToolbar
            value={value}
            onChange={onChange}
            textareaRef={textareaRef}
            basePath={basePath}
            onNotify={onNotify}
            validationIssues={validationIssues}
            validationStatus={validationStatus}
          />
        </div>
      ) : null}
      {showToolbar ? <MarkdownValidationBanner issues={validationIssues} status={validationStatus} /> : null}
      <div className="markdown-editor">{markdownEditor}</div>
    </section>
  );
}
