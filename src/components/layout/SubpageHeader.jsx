import { useEffect } from "react";
import PropTypes from "prop-types";

/**
 * Standard unified header for all full-screen subpages in Notely.
 */
export function SubpageHeader({
  title,
  currentTitle,
  breadcrumbCurrent,
  breadcrumbParent,
  breadcrumbs = null,
  rootLabel = "Workspace",
  onBack,
  actions = null,
  badge = null,
  children = null,
}) {
  useEffect(() => {
    if (!onBack) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onBack();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onBack]);

  const effectiveRoot = breadcrumbParent || rootLabel;
  const currentLabel = currentTitle || breadcrumbCurrent || title || "";

  const segments = Array.isArray(breadcrumbs) && breadcrumbs.length > 0
    ? breadcrumbs
    : (currentLabel ? [currentLabel] : []);

  const intermediateSegments = segments.slice(0, -1);
  const lastSegment = segments.length > 0 ? segments[segments.length - 1] : "";
  const lastSegmentText = typeof lastSegment === "string" ? lastSegment : (lastSegment?.label || "");

  return (
    <div className="detail-topbar subpage-unified-header">
      <nav className="detail-breadcrumb" aria-label={`${lastSegmentText || "Page"} location`}>
        <span className="detail-breadcrumb-part">
          <button className="detail-breadcrumb-link" type="button" onClick={onBack}>
            {effectiveRoot}
          </button>
          <span className="detail-breadcrumb-separator" aria-hidden="true">
            /
          </span>
        </span>
        {intermediateSegments.map((seg, idx) => {
          const label = typeof seg === "string" ? seg : seg?.label;
          const onClick = typeof seg === "object" ? seg?.onClick : undefined;
          return (
            <span className="detail-breadcrumb-part" key={idx}>
              {onClick ? (
                <button className="detail-breadcrumb-link" type="button" onClick={onClick}>
                  {label}
                </button>
              ) : (
                <span className="detail-breadcrumb-link" style={{ cursor: "default" }}>
                  {label}
                </span>
              )}
              <span className="detail-breadcrumb-separator" aria-hidden="true">
                /
              </span>
            </span>
          );
        })}
        {lastSegmentText && (
          <span className="detail-breadcrumb-current">
            {lastSegmentText}
          </span>
        )}
        {badge && <span className="subpage-header-badge">{badge}</span>}
      </nav>

      {(actions || children) && (
        <div className="detail-topbar-actions subpage-header-actions">
          {actions}
          {children}
        </div>
      )}
    </div>
  );
}

SubpageHeader.propTypes = {
  title: PropTypes.string,
  currentTitle: PropTypes.string,
  breadcrumbCurrent: PropTypes.string,
  breadcrumbParent: PropTypes.string,
  breadcrumbs: PropTypes.arrayOf(
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.shape({
        label: PropTypes.string.isRequired,
        onClick: PropTypes.func,
      }),
    ])
  ),
  rootLabel: PropTypes.string,
  onBack: PropTypes.func.isRequired,
  actions: PropTypes.node,
  badge: PropTypes.node,
  children: PropTypes.node,
};

export default SubpageHeader;
