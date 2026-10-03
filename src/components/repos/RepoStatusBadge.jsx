import { CheckCircle2, Clock, AlertCircle } from "lucide-react";

export function RepoStatusBadge({ status = "unindexed", symbolCount = 0 }) {
  const normalizedStatus = String(status || "unindexed").toLowerCase();

  if (normalizedStatus === "indexed") {
    return (
      <span className="arp-status-badge arp-status-badge--indexed" title={`Indexed (${symbolCount} symbols)`}>
        <CheckCircle2 size={12} />
        <span>Indexed{symbolCount > 0 ? ` (${symbolCount})` : ""}</span>
      </span>
    );
  }

  if (normalizedStatus === "indexing") {
    return (
      <span className="arp-status-badge arp-status-badge--indexing" title="Indexing in progress">
        <Clock size={12} className="spin" />
        <span>Indexing…</span>
      </span>
    );
  }

  if (normalizedStatus === "error") {
    return (
      <span className="arp-status-badge arp-status-badge--error" title="Indexing encountered an error">
        <AlertCircle size={12} />
        <span>Error</span>
      </span>
    );
  }

  return (
    <span className="arp-status-badge arp-status-badge--unindexed" title="Not yet indexed">
      <Clock size={12} />
      <span>Unindexed</span>
    </span>
  );
}

export default RepoStatusBadge;
