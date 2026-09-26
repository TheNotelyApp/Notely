import { Suspense, lazy } from "react";
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
  notify,
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
