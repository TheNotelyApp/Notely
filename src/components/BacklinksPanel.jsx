import React, { useEffect, useState } from "react";
import { Link, FileText, ArrowLeftRight } from "lucide-react";
import { getBacklinks } from "../services/electronService";

export function BacklinksPanel({ filePath, onOpenNote }) {
  const [backlinks, setBacklinks] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchBacklinks() {
      if (!filePath) {
        setBacklinks([]);
        return;
      }
      setLoading(true);
      try {
        const res = await getBacklinks(filePath);
        if (!cancelled && res?.success && Array.isArray(res?.data)) {
          setBacklinks(res.data);
        }
      } catch {
        if (!cancelled) setBacklinks([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchBacklinks();
    return () => {
      cancelled = true;
    };
  }, [filePath]);

  if (!filePath || (!loading && backlinks.length === 0)) {
    return null;
  }

  return (
    <div className="backlinks-panel" style={{ marginTop: "1rem", padding: "0.75rem", border: "1px solid var(--border-color, #e2e8f0)", borderRadius: "6px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 600, fontSize: "0.875rem", marginBottom: "0.5rem" }}>
        <ArrowLeftRight size={16} /> Backlinks ({backlinks.length})
      </div>
      {loading ? (
        <div style={{ fontSize: "0.8rem", color: "gray" }}>Loading backlinks...</div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {backlinks.map((link, idx) => (
            <li key={idx} style={{ marginBottom: "0.25rem" }}>
              <button
                type="button"
                className="backlink-item-btn"
                style={{ background: "none", border: "none", color: "var(--accent-color, #3b82f6)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.35rem", fontSize: "0.85rem", textDecoration: "underline" }}
                onClick={() => onOpenNote?.(link.filePath)}
              >
                <FileText size={14} />
                {link.sourceName || link.filePath}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
