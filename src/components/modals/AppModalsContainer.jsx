import { Suspense, lazy } from "react";
import { X } from "lucide-react";
import { OverlayDialog } from "../OverlayDialog";
import { TrashDialog } from "../TrashDialog";
import UpdateModal from "../UpdateModal";
import GlobalTooltip from "../GlobalTooltip";

const MarkdownGuideModal = lazy(() =>
  import("../MarkdownGuideModal").then((m) => ({ default: m.default || m.MarkdownGuideModal }))
);
const DictionaryModal = lazy(() =>
  import("../DictionaryModal").then((m) => ({ default: m.default || m.DictionaryModal }))
);
const AboutModal = lazy(() =>
  import("../AboutModal").then((m) => ({ default: m.default || m.AboutModal }))
);
const FeedbackModal = lazy(() =>
  import("../FeedbackModal").then((m) => ({ default: m.default || m.FeedbackModal }))
);
const HelpConfirmationModal = lazy(() =>
  import("../HelpConfirmationModal").then((m) => ({ default: m.default || m.HelpConfirmationModal }))
);
const ExportImportModal = lazy(() =>
  import("../ExportImportModal").then((m) => ({ default: m.default || m.ExportImportModal }))
);
const MediaTab = lazy(() =>
  import("../MediaTab").then((m) => ({ default: m.default || m.MediaTab }))
);
import { TransferNoteWorkspaceModal } from "./TransferNoteWorkspaceModal";

export function AppModalsContainer({
  markdownGuideOpen,
  setMarkdownGuideOpen,
  dictionaryOpen,
  setDictionaryOpen,
  ignoredSpellingWords,
  handleAddDictionaryWord,
  handleRemoveDictionaryWord,
  trashDialogOpen,
  setTrashDialogOpen,
  loadDocumentsData,
  aboutOpen,
  setAboutOpen,
  appInfo,
  feedbackOpen,
  setFeedbackOpen,
  themePreference,
  landingAssetsOpen,
  setLandingAssetsOpen,
  landingFolderPath,
  current,
  activeProject,
  notesFolderPath,
  notify,
  handleOpenReferencedDocumentFromUI,
  showUpdateModal,
  setShowUpdateModal,
  updateStatus,
  updateDetails,
  helpConfirmationOpen,
  setHelpConfirmationOpen,
  exportImportOpen,
  exportImportMode,
  setExportImportOpen,
  transferModalState,
  setTransferModalState,
  onTransferSuccess,
}) {
  return (
    <>
      {transferModalState?.isOpen && (
        <TransferNoteWorkspaceModal
          isOpen={transferModalState.isOpen}
          onClose={() => setTransferModalState?.({ isOpen: false, document: null, mode: "copy" })}
          document={transferModalState.document}
          initialMode={transferModalState.mode}
          onTransferSuccess={onTransferSuccess}
          onNotify={notify}
        />
      )}
      {markdownGuideOpen ? (
        <Suspense fallback={null}>
          <MarkdownGuideModal
            open={markdownGuideOpen}
            onClose={() => setMarkdownGuideOpen(false)}
          />
        </Suspense>
      ) : null}

      {dictionaryOpen ? (
        <Suspense fallback={null}>
          <DictionaryModal
            open={dictionaryOpen}
            onClose={() => setDictionaryOpen(false)}
            ignoredSpellingWords={ignoredSpellingWords}
            onAddWord={handleAddDictionaryWord}
            onRemoveWord={handleRemoveDictionaryWord}
          />
        </Suspense>
      ) : null}

      {trashDialogOpen ? (
        <TrashDialog
          isOpen={trashDialogOpen}
          onClose={() => setTrashDialogOpen(false)}
          onRestored={loadDocumentsData}
        />
      ) : null}

      {aboutOpen ? (
        <Suspense fallback={<div className="lazy-loading">Loading about…</div>}>
          <AboutModal
            open={aboutOpen}
            onClose={() => setAboutOpen(false)}
            appInfo={appInfo}
          />
        </Suspense>
      ) : null}

      {feedbackOpen ? (
        <Suspense fallback={null}>
          <FeedbackModal
            open={feedbackOpen}
            onClose={() => setFeedbackOpen(false)}
            themePreference={themePreference}
          />
        </Suspense>
      ) : null}

      {landingAssetsOpen ? (
        <OverlayDialog
          open={landingAssetsOpen}
          onClose={() => setLandingAssetsOpen(false)}
          ariaLabel="Assets"
          cardClassName="assets-dialog-card"
        >
          <div className="overlay-dialog-header assets-dialog-header">
            <div className="assets-dialog-title-group">
              <h2>Assets Library</h2>
              <p>Browse assets in this workspace folder.</p>
            </div>
            <button
              className="icon-button assets-close-button"
              onClick={() => setLandingAssetsOpen(false)}
              type="button"
              aria-label="Close assets dialog"
            >
              <X size={16} />
            </button>
          </div>
          <div className="assets-dialog-body">
            <Suspense fallback={<div className="lazy-loading">Loading media…</div>}>
              <MediaTab
                content=""
                basePath={`${(landingFolderPath || (current?.filePath ? current.filePath.split(/[\\/]/).slice(0, -1).join("/") : "") || activeProject?.rootPath || notesFolderPath || "").replace(/[\\/]+$/, "")}/_assets.md`}
                onNotify={notify}
                onOpenDocument={handleOpenReferencedDocumentFromUI}
              />
            </Suspense>
          </div>
        </OverlayDialog>
      ) : null}

      {showUpdateModal ? (
        <UpdateModal
          isOpen={showUpdateModal}
          onClose={() => setShowUpdateModal(false)}
          status={updateStatus}
          details={updateDetails}
        />
      ) : null}

      {helpConfirmationOpen ? (
        <Suspense fallback={null}>
          <HelpConfirmationModal
            open={helpConfirmationOpen}
            onClose={() => setHelpConfirmationOpen(false)}
          />
        </Suspense>
      ) : null}

      {exportImportOpen && (
        <Suspense fallback={null}>
          <ExportImportModal
            isOpen={exportImportOpen}
            mode={exportImportMode}
            onClose={() => setExportImportOpen(false)}
            notify={notify}
            reloadDocuments={loadDocumentsData}
          />
        </Suspense>
      )}

      <GlobalTooltip />
    </>
  );
}
