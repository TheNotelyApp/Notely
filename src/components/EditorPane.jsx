import { MarkdownEditor } from "./MarkdownEditor";
import { MarkdownPreview } from "./MarkdownPreview";

export function EditorPane({ value, onChange, mode, textareaRef }) {
  const markdownEditor = (
    <MarkdownEditor value={value} onChange={onChange} textareaRef={textareaRef} />
  );

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
