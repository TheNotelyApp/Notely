import { Globe, X, RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";
import { OverlayDialog } from "./OverlayDialog";

export default function UpdateModal({
  isOpen,
  onClose,
  status,
  details,
}) {
  if (!isOpen) return null;

  const cleanLatest = String(details?.latestVersion || "").replace(/^v/, "");
  const cleanCurrent = String(details?.currentVersion || "").replace(/^v/, "");

  const handleOpenReleaseUrl = () => {
    if (details?.releaseUrl) {
      window.open(details.releaseUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <OverlayDialog
      open={isOpen}
      onClose={onClose}
      ariaLabel="Application Update Status"
      cardClassName="update-modal-card"
    >
      <div className="overlay-dialog-header">
        <h2>Check for Updates</h2>
        <button
          className="icon-button"
          onClick={onClose}
          type="button"
          aria-label="Close update check"
        >
          <X size={16} />
        </button>
      </div>

      <div className="update-modal-body">
        {status === "checking" && (
          <div className="update-status-checking">
            <RefreshCw className="update-status-checking-icon" size={20} />
            <p className="update-status-checking-text">Checking GitHub for new releases...</p>
          </div>
        )}

        {status === "up-to-date" && (
          <div className="update-status-uptodate">
            <CheckCircle size={20} className="update-status-uptodate-icon" />
            <div>
              <p className="update-status-uptodate-title">
                You are up to date!
              </p>
              <p className="update-status-uptodate-sub">
                Notely v{cleanCurrent || "0.0.0"} is currently the latest version.
              </p>
            </div>
            <button className="primary-button" onClick={onClose} type="button">
              Dismiss
            </button>
          </div>
        )}

        {status === "available" && (
          <div className="update-status-available">
            <div className="update-status-available-head">
              <div className="update-status-available-badge">
                <Globe size={20} />
              </div>
              <div>
                <p className="update-status-available-title">
                  New update available!
                </p>
                <p className="update-status-available-sub">
                  Version <strong>v{cleanLatest}</strong> is available. You are running v{cleanCurrent}.
                </p>
              </div>
            </div>

            {details?.releaseNotes && (
              <div className="update-status-notes-section">
                <p className="update-status-notes-label">
                  Release Notes:
                </p>
                <div className="update-status-notes-box">
                  {details.releaseNotes}
                </div>
              </div>
            )}

            <div className="update-status-available-actions">
              <button
                className="primary-button"
                onClick={handleOpenReleaseUrl}
                type="button"
              >
                <Globe size={14} />
                Download Update
              </button>
              <button
                className="secondary-button"
                onClick={onClose}
                type="button"
              >
                Later
              </button>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="update-status-error">
            <AlertTriangle size={20} className="update-status-error-icon" />
            <div>
              <p className="update-status-uptodate-title">
                Update check failed
              </p>
              <p className="update-status-uptodate-sub">
                {details?.error || "Could not connect to GitHub Releases API."}
              </p>
            </div>
            <button className="primary-button" onClick={onClose} type="button">
              Dismiss
            </button>
          </div>
        )}
      </div>
    </OverlayDialog>
  );
}
