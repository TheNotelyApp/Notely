import { RefreshCw, Wifi, WifiOff } from "lucide-react";

function formatDateTime(value) {
  if (!value) return "Unknown";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

export function P2PStatusPanel({ status, loading, onRefresh }) {
  if (!status) {
    return (
      <div className="p2p-status-empty">
        <p>No P2P status available yet.</p>
      </div>
    );
  }

  const peers = Array.isArray(status.peers) ? status.peers : [];

  return (
    <div className="p2p-status-wrap">
      <div className="p2p-status-actions">
        <button className="small-button" type="button" onClick={onRefresh} disabled={loading}>
          <RefreshCw size={14} />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="p2p-status-summary-grid">
        <div className="p2p-status-summary-card">
          <span>State</span>
          <strong className={status.available ? "online" : "offline"}>
            {status.available ? <Wifi size={14} /> : <WifiOff size={14} />}
            {status.available ? "Available" : "No Local Data"}
          </strong>
        </div>
        <div className="p2p-status-summary-card">
          <span>Peers</span>
          <strong>{status.peerCount || 0}</strong>
        </div>
        <div className="p2p-status-summary-card">
          <span>Trusted Links</span>
          <strong>{status.trustedLinkCount || 0}</strong>
        </div>
        <div className="p2p-status-summary-card">
          <span>Workspace Keys</span>
          <strong>{status.workspaceKeyCount || 0}</strong>
        </div>
      </div>

      <div className="p2p-status-meta">
        <p>
          <span>Generated</span>
          <strong>{formatDateTime(status.generatedAt)}</strong>
        </p>
        <p>
          <span>Session</span>
          <strong>{status.sessionId || "N/A"}</strong>
        </p>
        <p>
          <span>Workspace</span>
          <strong>{status.workspaceId || "N/A"}</strong>
        </p>
        <p>
          <span>Source</span>
          <strong>{status.source || "N/A"}</strong>
        </p>
      </div>

      <div className="p2p-status-peer-table-wrap">
        <table className="p2p-status-peer-table">
          <thead>
            <tr>
              <th>Peer</th>
              <th>Peer ID</th>
              <th>Trusted Peers</th>
              <th>Workspace Keys</th>
              <th>Inbox</th>
            </tr>
          </thead>
          <tbody>
            {!peers.length ? (
              <tr>
                <td colSpan={5} className="p2p-status-table-empty">No peers found in status artifacts.</td>
              </tr>
            ) : (
              peers.map((peer) => (
                <tr key={peer.peerId}>
                  <td>{peer.name}</td>
                  <td className="mono-cell" title={peer.peerId}>{peer.peerId}</td>
                  <td>{peer.trustedPeerCount}</td>
                  <td>{peer.workspaceKeyCount}</td>
                  <td>{peer.inboxCount}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
