import { Globe, X, RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";
import { OverlayDialog } from "./OverlayDialog";

export default function UpdateModal({
  isOpen,
  onClose,
  status, // 'checking', 'up-to-date', 'available', 'error'
  details, // { latestVersion, currentVersion, releaseUrl, releaseNotes, error }
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
      <div className="overlay-dialog-header" style={{ padding: "1.25rem 1.5rem" }}>
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

      <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
        {status === "checking" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", padding: "1.5rem 0" }}>
            <RefreshCw className="animate-spin" size={20} style={{ color: "var(--accent-solid)", animation: "spin 1.5s linear infinite", transform: "scale(1.6)" }} />
            <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>Checking GitHub for new releases...</p>
          </div>
        )}

        {status === "up-to-date" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", padding: "1.5rem 0", textAlign: "center" }}>
            <CheckCircle size={20} style={{ color: "var(--status-success-text)", transform: "scale(2)", margin: "8px 0" }} />
            <div>
              <p style={{ fontWeight: "600", fontSize: "1.1rem", color: "var(--text-strong)", margin: "0 0 4px 0" }}>
                You are up to date!
              </p>
              <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", margin: 0 }}>
                Notely v{cleanCurrent || "0.0.0"} is currently the latest version.
              </p>
            </div>
            <button className="primary-button" onClick={onClose} type="button" style={{ marginTop: "12px" }}>
              Dismiss
            </button>
          </div>
        )}

        {status === "available" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", width: "40px", height: "40px", borderRadius: "50%", background: "var(--surface-accent)", color: "var(--accent-solid)", flexShrink: 0 }}>
                <Globe size={20} />
              </div>
              <div>
                <p style={{ fontWeight: "600", fontSize: "1.1rem", color: "var(--text-strong)", margin: "0 0 4px 0" }}>
                  New update available!
                </p>
                <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", margin: 0 }}>
                  Version <strong>v{cleanLatest}</strong> is available. You are running v{cleanCurrent}.
                </p>
              </div>
            </div>

            {details?.releaseNotes && (
              <div style={{ marginTop: "8px" }}>
                <p style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text-strong)", margin: "0 0 6px 0" }}>
                  Release Notes:
                </p>
                <div
                  style={{
                    maxHeight: "180px",
                    overflowY: "auto",
                    background: "var(--surface-muted)",
                    border: "1px solid var(--border-soft)",
                    borderRadius: "6px",
                    padding: "10px 12px",
                    fontSize: "0.82rem",
                    color: "var(--text-default)",
                    whiteSpace: "pre-wrap",
                    lineHeight: "1.4"
                  }}
                >
                  {details.releaseNotes}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
              <button
                className="primary-button"
                onClick={handleOpenReleaseUrl}
                type="button"
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
              >
                <Globe size={14} />
                Download Update
              </button>
              <button
                className="secondary-button"
                onClick={onClose}
                type="button"
                style={{
                  padding: "0 16px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-default)",
                  background: "transparent",
                  color: "var(--text-strong)",
                  fontSize: "0.9rem",
                  fontWeight: "500",
                  cursor: "pointer"
                }}
              >
                Later
              </button>
            </div>
          </div>
        )}

        {status === "error" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", padding: "1.5rem 0", textAlign: "center" }}>
            <AlertTriangle size={20} style={{ color: "var(--status-danger-text)", transform: "scale(2)", margin: "8px 0" }} />
            <div>
              <p style={{ fontWeight: "600", fontSize: "1.1rem", color: "var(--text-strong)", margin: "0 0 4px 0" }}>
                Update check failed
              </p>
              <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", margin: 0 }}>
                {details?.error || "Could not connect to GitHub Releases API."}
              </p>
            </div>
            <button className="primary-button" onClick={onClose} type="button" style={{ marginTop: "12px" }}>
              Dismiss
            </button>
          </div>
        )}
      </div>
    </OverlayDialog>
  );
}
