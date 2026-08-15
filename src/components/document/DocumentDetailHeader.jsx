import {
  Save,
  CheckSquare,
  Square,
  ListTree,
  Sparkles,
  Maximize,
  Minimize,
  ListChecks,
  ExternalLink,
} from "lucide-react";
import AppButton from "../AppButton";

export function DocumentDetailHeader({
  isFocusMode,
  breadcrumbs = [],
  onNavigateBreadcrumb,
  onBack,
  document,
  taskCounts = { total: 0, open: 0, closed: 0 },
  isTaskSummaryOpen,
  setIsTaskSummaryOpen,
  taskPopoverTimerRef,
  taskSummaryPopoverId,
  openTaskItems = [],
  closedTaskItems = [],
  jumpToLine,
  onOpenAllTasks,
  dirty,
  saving,
  changedOnDisk,
  handleManualSave,
  showMetadataPanel,
  setShowMetadataPanel,
  aiPanelVisible,
  aiEnabled,
  onShowAI,
  toggleFocusMode,
}) {
  if (isFocusMode) return null;

  return (
    <div className="detail-topbar">
      <nav className="detail-breadcrumb" aria-label="Note location">
        {breadcrumbs.length ? (
          breadcrumbs.map((segment) => (
            <span className="detail-breadcrumb-part" key={segment.path}>
              <button
                className="detail-breadcrumb-link"
                type="button"
                onClick={() => onNavigateBreadcrumb?.(segment.path)}
              >
                {segment.label}
              </button>
              <span className="detail-breadcrumb-separator" aria-hidden="true">/</span>
            </span>
          ))
        ) : (
          <span className="detail-breadcrumb-part">
            <button className="detail-breadcrumb-link" type="button" onClick={onBack}>
              Notes
            </button>
            <span className="detail-breadcrumb-separator" aria-hidden="true">/</span>
          </span>
        )}
        <span className="detail-breadcrumb-current" data-tooltip={document.title}>
          {document.title}
        </span>
      </nav>

      {taskCounts.total > 0 && (
        <div
          className={`detail-task-summary${isTaskSummaryOpen ? " open" : ""}`}
          onMouseEnter={() => {
            if (taskPopoverTimerRef.current) {
              clearTimeout(taskPopoverTimerRef.current);
              taskPopoverTimerRef.current = null;
            }
            setIsTaskSummaryOpen(true);
          }}
          onMouseLeave={() => {
            if (taskPopoverTimerRef.current) clearTimeout(taskPopoverTimerRef.current);
            taskPopoverTimerRef.current = setTimeout(() => {
              setIsTaskSummaryOpen(false);
            }, 450);
          }}
          onFocus={() => setIsTaskSummaryOpen(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setIsTaskSummaryOpen(false);
            }
          }}
        >
          <button
            className="detail-task-counts"
            type="button"
            aria-label={`${taskCounts.open} open tasks and ${taskCounts.closed} closed tasks`}
            aria-expanded={isTaskSummaryOpen}
            aria-controls={taskSummaryPopoverId}
          >
            <span className="task-count-item" data-tooltip="Open tasks">
              <CheckSquare size={14} />
              {taskCounts.open}
            </span>
            <span className="task-count-item" data-tooltip="Closed tasks">
              <Square size={14} />
              {taskCounts.closed}
            </span>
          </button>
          <div
            id={taskSummaryPopoverId}
            className="detail-task-popover"
            role="tooltip"
            aria-label="Note task summary"
          >
            {openTaskItems.length ? (
              <div className="detail-task-popover-section">
                <strong>Open</strong>
                <div className="detail-task-popover-list">
                  {openTaskItems.map((task) => (
                    <button
                      type="button"
                      className="detail-task-popover-item open"
                      key={task.id}
                      onClick={() => jumpToLine(task.line, task.text)}
                      data-tooltip="Click to jump to task in editor"
                    >
                      <span className="detail-task-popover-marker">[ ]</span>
                      <span>{task.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {closedTaskItems.length ? (
              <div className="detail-task-popover-section">
                <strong>Closed</strong>
                <div className="detail-task-popover-list">
                  {closedTaskItems.map((task) => (
                    <button
                      type="button"
                      className="detail-task-popover-item closed"
                      key={task.id}
                      onClick={() => jumpToLine(task.line, task.text)}
                      data-tooltip="Click to jump to task in editor"
                    >
                      <span className="detail-task-popover-marker">[x]</span>
                      <span>{task.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="detail-task-popover-footer">
              <button
                type="button"
                className="detail-task-popover-page-link"
                onClick={() => {
                  setIsTaskSummaryOpen(false);
                  onOpenAllTasks?.(document.filePath || document.path);
                }}
              >
                <ListChecks size={14} />
                <span>Open in Tasks Page</span>
                <ExternalLink size={12} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Primary Action: Save Button */}
      <AppButton
        variant={dirty ? "primary" : "small"}
        onClick={handleManualSave}
        disabled={saving || changedOnDisk || !dirty}
        data-tooltip={dirty ? "Save changes (Ctrl+S)" : "All changes saved"}
        style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
      >
        <Save size={14} />
        <span>{saving ? "Saving..." : (dirty ? "Save" : "Saved")}</span>
      </AppButton>

      {/* Workspace Action: Details */}
      <AppButton
        variant="small"
        className={showMetadataPanel ? "active" : ""}
        data-tooltip="Toggle note metadata"
        onClick={() => setShowMetadataPanel((prev) => !prev)}
        style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
      >
        <ListTree size={14} />
        <span>Details</span>
      </AppButton>

      {/* Workspace Action: AI Assistant */}
      <AppButton
        variant="small"
        className={aiPanelVisible ? "active" : ""}
        data-tooltip={aiEnabled ? "Toggle AI Assistant Chat" : "Configure AI to toggle Assistant"}
        onClick={onShowAI}
        style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
      >
        <Sparkles size={14} />
        <span>{aiPanelVisible ? "Hide AI" : "AI Assistant"}</span>
      </AppButton>

      {/* View Action: Full Screen */}
      <AppButton
        variant="small"
        onClick={toggleFocusMode}
        data-tooltip={isFocusMode ? "Exit Full Screen" : "Enter Full Screen"}
        style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
      >
        {isFocusMode ? <Minimize size={14} /> : <Maximize size={14} />}
        <span>{isFocusMode ? "Exit Full Screen" : "Full Screen"}</span>
      </AppButton>
    </div>
  );
}
