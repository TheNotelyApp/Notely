import React from "react";
import { PropertiesSection } from "./PropertiesSection";
import { StructureSection } from "./StructureSection";
import { AnnotationsSection } from "./AnnotationsSection";

export function WireframeInspector({
  propertiesOpen,
  onToggleProperties,
  structureOpen,
  onToggleStructure,
  annotationsOpen,
  onToggleAnnotations,
  // Property section props
  selectedComp,
  compMeta,
  isLocked,
  onToggleLock,
  onGroupSelection,
  onUngroupSelection,
  isSavingSnippet,
  onToggleSavingSnippet,
  snippetNameInput,
  onSnippetNameChange,
  onSaveSnippet,
  onDuplicateSelected,
  onDeleteSelected,
  quickAddStencilId,
  onQuickAddStencilChange,
  onInsertRelative,
  customSnippets,
  devNote,
  onDevNoteChange,
  propText,
  onTextChange,
  propWidth,
  onWidthChange,
  propHeight,
  onHeightChange,
  propVariant,
  onVariantChange,
  propGap,
  onGapChange,
  propPadding,
  onPaddingChange,
  propDirection,
  onDirectionChange,
  advancedOpen,
  onToggleAdvanced,
  // Annotations props
  annotations,
  onSelectAnnotation,
  onDeleteAnnotation,
  onCopySpecMarkdown
}) {
  return (
    <aside className="wireframe-inspector-panel">
      {/* SECTION 1: PROPERTIES */}
      <PropertiesSection
        isOpen={propertiesOpen}
        onToggle={onToggleProperties}
        selectedComp={selectedComp}
        compMeta={compMeta}
        isLocked={isLocked}
        onToggleLock={onToggleLock}
        onGroupSelection={onGroupSelection}
        onUngroupSelection={onUngroupSelection}
        isSavingSnippet={isSavingSnippet}
        onToggleSavingSnippet={onToggleSavingSnippet}
        snippetNameInput={snippetNameInput}
        onSnippetNameChange={onSnippetNameChange}
        onSaveSnippet={onSaveSnippet}
        onDuplicateSelected={onDuplicateSelected}
        onDeleteSelected={onDeleteSelected}
        quickAddStencilId={quickAddStencilId}
        onQuickAddStencilChange={onQuickAddStencilChange}
        onInsertRelative={onInsertRelative}
        customSnippets={customSnippets}
        devNote={devNote}
        onDevNoteChange={onDevNoteChange}
        propText={propText}
        onTextChange={onTextChange}
        propWidth={propWidth}
        onWidthChange={onWidthChange}
        propHeight={propHeight}
        onHeightChange={onHeightChange}
        propVariant={propVariant}
        onVariantChange={onVariantChange}
        propGap={propGap}
        onGapChange={onGapChange}
        propPadding={propPadding}
        onPaddingChange={onPaddingChange}
        propDirection={propDirection}
        onDirectionChange={onDirectionChange}
        advancedOpen={advancedOpen}
        onToggleAdvanced={onToggleAdvanced}
      />

      {/* SECTION 2: STRUCTURE */}
      <StructureSection
        isOpen={structureOpen}
        onToggle={onToggleStructure}
      />

      {/* SECTION 3: ANNOTATIONS */}
      <AnnotationsSection
        isOpen={annotationsOpen}
        onToggle={onToggleAnnotations}
        annotations={annotations}
        onSelectAnnotation={onSelectAnnotation}
        onDeleteAnnotation={onDeleteAnnotation}
        onCopySpecMarkdown={onCopySpecMarkdown}
      />
    </aside>
  );
}
