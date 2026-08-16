import ExcalidrawComponent from "../ExcalidrawEditor";
import { ImageCropModal } from "../ImageCropModal";
import CodeBlockModal from "../CodeBlockModal";
import MarkdownTableEditor from "../MarkdownTableEditor";
import { MermaidVisualEditorModal } from "../mermaid/MermaidVisualEditorModal";

export function PreviewModalsContainer({
  diagramEditState,
  closeDiagramEditor,
  saveExcalidrawFromImageMenu,
  cropState,
  cropSaving,
  closeCropModal,
  handleRestoreOriginal,
  handleSaveCrop,
  codeEditState,
  setCodeEditState,
  onContentChange,
  onForceSaveDocument,
  onNotify,
  content,
  replaceCodeBlockAtLine,
  tableEditState,
  setTableEditState,
  mermaidEditState,
  setMermaidEditState,
}) {
  return (
    <>
      {diagramEditState?.open ? (
        <ExcalidrawComponent
          initialData={diagramEditState.initialData}
          diagramId={diagramEditState.diagramId}
          documentPath={diagramEditState.documentPath}
          onClose={closeDiagramEditor}
          onSave={saveExcalidrawFromImageMenu}
        />
      ) : null}

      {cropState?.open ? (
        <ImageCropModal
          open={cropState.open}
          imageSrc={cropState.src}
          imageLabel={cropState.imageLabel}
          initialAnnotation={cropState.annotation}
          annotationOnly={cropState.annotationOnly}
          restoreOriginalAvailable={cropState.hasOriginal}
          saving={cropSaving}
          onClose={closeCropModal}
          onRestoreOriginal={handleRestoreOriginal}
          onSave={handleSaveCrop}
        />
      ) : null}

      {codeEditState?.open ? (
        <CodeBlockModal
          open={codeEditState.open}
          initialLanguage={codeEditState.language}
          initialCode={codeEditState.code}
          onClose={() => setCodeEditState({ open: false, language: "", code: "", sourceLine: null })}
          onSave={({ language, code }) => {
            if (!onContentChange || !codeEditState.sourceLine) return;
            const nextContent = replaceCodeBlockAtLine(content, codeEditState.sourceLine, language, code);
            if (nextContent !== null) {
              onContentChange(nextContent);
              setTimeout(() => {
                onForceSaveDocument?.(nextContent);
              }, 50);
            } else {
              onNotify?.("Failed to update code block. Source line might have shifted.", "error");
            }
          }}
        />
      ) : null}

      {tableEditState?.open ? (
        <MarkdownTableEditor
          initialMarkdown={tableEditState.initialMarkdown}
          onCommit={(newMarkdown) => {
            if (onContentChange && tableEditState.sourceLine) {
              const lines = String(content || "").split("\n");
              const startIdx = tableEditState.sourceLine - 1;
              lines.splice(startIdx, tableEditState.lineCount, newMarkdown);
              onContentChange(lines.join("\n"));
              const newLineCount = newMarkdown.split("\n").length;
              setTableEditState((prev) => ({
                ...prev,
                initialMarkdown: newMarkdown,
                lineCount: newLineCount,
              }));
              onNotify?.("Table saved successfully.", "success");
            }
          }}
          onCancel={() => setTableEditState({ open: false, initialMarkdown: "", sourceLine: null, lineCount: 0 })}
        />
      ) : null}

      {mermaidEditState?.open ? (
        <MermaidVisualEditorModal
          isOpen={mermaidEditState.open}
          initialCode={mermaidEditState.initialCode}
          onClose={() => setMermaidEditState({ open: false, initialCode: "", originalBlockCode: "" })}
          onSave={(newCode) => {
            if (onContentChange) {
              const oldBlock = `\`\`\`mermaid\n${mermaidEditState.originalBlockCode}\n\`\`\``;
              const newBlock = `\`\`\`mermaid\n${newCode}\n\`\`\``;
              if (content && content.includes(oldBlock)) {
                onContentChange(content.replace(oldBlock, newBlock));
              } else if (content && content.includes(mermaidEditState.originalBlockCode)) {
                onContentChange(content.replace(mermaidEditState.originalBlockCode, newCode));
              } else {
                onContentChange(`${content}\n\n${newBlock}`);
              }
              onNotify?.("Mermaid diagram saved.", "success");
            }
            setMermaidEditState({ open: false, initialCode: "", originalBlockCode: "" });
          }}
        />
      ) : null}
    </>
  );
}
