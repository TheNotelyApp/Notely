/**
 * MediaStats - Component to display media statistics and insights
 */

import { useMemo } from "react";
import { Trash2, AlertCircle } from "lucide-react";
import { getMediaTypeFromExtension } from "../utils/mediaUtils";
import { formatFileSize } from "../utils/imageProcessingUtils";

export function MediaStats({ allMedia, onDeleteUnused, isDeleting = false }) {
  const stats = useMemo(() => {
    if (!allMedia || allMedia.length === 0) {
      return {
        total: 0,
        used: 0,
        unused: 0,
        byType: {},
        totalSize: 0,
        unusedSize: 0,
        duplicates: [],
      };
    }

    const byType = {};
    let totalSize = 0;
    let unusedSize = 0;
    const pathMap = new Map();
    let used = 0;
    let unused = 0;

    allMedia.forEach((media) => {
      const ext = media.path.split(".").pop()?.toLowerCase();
      const type = getMediaTypeFromExtension(ext) || "unknown";

      if (!byType[type]) {
        byType[type] = { count: 0, size: 0, used: 0, unused: 0 };
      }
      byType[type].count += 1;

      const fileSize = media.fileSize || 0;
      totalSize += fileSize;
      byType[type].size += fileSize;

      const isUsed = (media.referenceCount || 0) > 0;
      if (isUsed) {
        used += 1;
        byType[type].used += 1;
      } else {
        unused += 1;
        unusedSize += fileSize;
        byType[type].unused += 1;
      }

      // Detect potential duplicates (same size, similar name)
      const fileName = media.path.split("/").pop()?.split(".")[0] || "";
      const key = `${fileSize}:${fileName.substring(0, 5).toLowerCase()}`;
      if (!pathMap.has(key)) {
        pathMap.set(key, []);
      }
      pathMap.get(key).push(media.path);
    });

    const duplicates = Array.from(pathMap.values()).filter((paths) => paths.length > 1);

    return {
      total: allMedia.length,
      used,
      unused,
      byType,
      totalSize,
      unusedSize,
      duplicates,
    };
  }, [allMedia]);

  return (
    <div className="media-stats-panel">
      <div className="stats-header">
        <h3>📊 Media Statistics</h3>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Media</div>
        </div>

        <div className="stat-card stat-used">
          <div className="stat-value">{stats.used}</div>
          <div className="stat-label">Used</div>
        </div>

        <div className="stat-card stat-unused">
          <div className="stat-value">{stats.unused}</div>
          <div className="stat-label">Unused</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">{formatFileSize(stats.totalSize)}</div>
          <div className="stat-label">Total Size</div>
        </div>
      </div>

      {stats.byType && Object.keys(stats.byType).length > 0 && (
        <div className="stats-breakdown">
          <div className="breakdown-title">By Type:</div>
          <div className="breakdown-items">
            {Object.entries(stats.byType).map(([type, data]) => (
              <div key={type} className="breakdown-item">
                <span className="type-icon">
                  {type === "image" && "🖼️"}
                  {type === "video" && "🎬"}
                  {type === "audio" && "🎵"}
                  {type === "pdf" && "📄"}
                  {type === "document" && "📃"}
                  {type === "unknown" && "📎"}
                </span>
                <span className="type-name">{type}</span>
                <span className="type-count">{data.count}</span>
                <span className="type-size">({formatFileSize(data.size)})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.unused > 0 && stats.unusedSize > 0 && (
        <div className="stats-insights">
          <div className="insight-card unused-insight">
            <AlertCircle size={16} />
            <div className="insight-content">
              <div className="insight-text">
                <strong>{stats.unused} unused files</strong> taking up <strong>{formatFileSize(stats.unusedSize)}</strong>
              </div>
              <button
                className="cleanup-button"
                onClick={onDeleteUnused}
                disabled={isDeleting}
                title="Delete all unused media files"
              >
                <Trash2 size={14} />
                {isDeleting ? "Cleaning..." : "Clean Up"}
              </button>
            </div>
          </div>
        </div>
      )}

      {stats.duplicates.length > 0 && (
        <div className="stats-insights">
          <div className="insight-card duplicate-insight">
            <AlertCircle size={16} />
            <div className="insight-content">
              <div className="insight-text">
                Found <strong>{stats.duplicates.length} potential duplicates</strong> - review and remove to save space
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
