/**
 * Centralized Note Drag and Drop Manager & React Hook.
 * Consolidates payload serialization, drag states, hover cues, and spring-loading.
 */
import { useState, useRef, useCallback, useEffect } from "react";

export const NOTELY_DRAG_MIME = "application/x-notely-note";

export class NoteDragDropManager {
  static encode(entry) {
    if (!entry || !entry.filePath) return "";
    return JSON.stringify({
      filePath: entry.filePath,
      title: entry.title || entry.name || "Untitled",
      entryType: entry.entryType || "file",
    });
  }

  static decode(dataTransfer) {
    if (!dataTransfer) return null;
    try {
      const customData = dataTransfer.getData(NOTELY_DRAG_MIME);
      if (customData) return JSON.parse(customData);

      // Fallback to standard json
      const jsonData = dataTransfer.getData("application/json");
      if (jsonData) return JSON.parse(jsonData);
    } catch (err) {
      console.error("[NoteDragDropManager] Failed to decode drag data:", err);
    }
    return null;
  }

  static isNoteDrag(dataTransfer) {
    if (!dataTransfer || !dataTransfer.types) return false;
    return (
      dataTransfer.types.includes(NOTELY_DRAG_MIME) ||
      dataTransfer.types.includes("application/json")
    );
  }
}

export function useNoteDragDrop({ onMove, onTrash, springDelayMs = 600 } = {}) {
  const [draggedPath, setDraggedPath] = useState(null);
  const [dragTargetFolder, setDragTargetFolder] = useState(null);
  const [dropLine, setDropLine] = useState(null);
  const [isDragOverTrash, setIsDragOverTrash] = useState(false);
  const springTimerRef = useRef(null);

  const clearSpringTimer = useCallback(() => {
    if (springTimerRef.current) {
      clearTimeout(springTimerRef.current);
      springTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearSpringTimer();
  }, [clearSpringTimer]);

  const bindDraggableNote = useCallback(
    (doc, { parentFolderPath, allowDropBetween = true } = {}) => {
      if (!doc || doc.entryType === "folder") return {};

      return {
        draggable: true,
        onDragStart: (e) => {
          const payload = NoteDragDropManager.encode(doc);
          e.dataTransfer.setData(NOTELY_DRAG_MIME, payload);
          e.dataTransfer.setData("application/json", payload);
          e.dataTransfer.effectAllowed = "move";
          setDraggedPath(doc.filePath);
        },
        onDragEnd: () => {
          setDraggedPath(null);
          setDragTargetFolder(null);
          setDropLine(null);
          setIsDragOverTrash(false);
          clearSpringTimer();
        },
        ...(allowDropBetween
          ? {
              onDragOver: (e) => {
                if (!NoteDragDropManager.isNoteDrag(e.dataTransfer)) return;
                if (draggedPath && draggedPath === doc.filePath) return;
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = "move";

                const rect = e.currentTarget.getBoundingClientRect();
                const position = e.clientY - rect.top < rect.height / 2 ? "top" : "bottom";
                setDropLine({ filePath: doc.filePath, position });

                const targetFolder =
                  parentFolderPath || doc.filePath.replace(/[\\/][^\\/]+$/, "");
                if (dragTargetFolder !== targetFolder) {
                  setDragTargetFolder(targetFolder);
                }
              },
              onDragLeave: (e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) {
                  setDropLine((prev) => (prev?.filePath === doc.filePath ? null : prev));
                }
              },
              onDrop: (e) => {
                e.preventDefault();
                e.stopPropagation();
                setDropLine(null);
                setDragTargetFolder(null);
                setDraggedPath(null);

                const item = NoteDragDropManager.decode(e.dataTransfer);
                const targetFolder =
                  parentFolderPath || doc.filePath.replace(/[\\/][^\\/]+$/, "");
                if (item && item.filePath && item.entryType === "file" && targetFolder) {
                  onMove?.(item.filePath, targetFolder);
                }
              },
            }
          : {}),
      };
    },
    [clearSpringTimer, draggedPath, dragTargetFolder, onMove]
  );

  const bindFolderDrop = useCallback(
    (folder, { onExpand, isExpanded } = {}) => {
      if (!folder || folder.entryType !== "folder") return {};

      return {
        onDragOver: (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = "move";
          if (dragTargetFolder !== folder.filePath) {
            setDragTargetFolder(folder.filePath);
          }

          // Spring-loading: auto-expand collapsed folder on hover
          if (!isExpanded && onExpand && !springTimerRef.current) {
            springTimerRef.current = setTimeout(() => {
              onExpand(folder.filePath);
              springTimerRef.current = null;
            }, springDelayMs);
          }
        },
        onDragLeave: (e) => {
          e.stopPropagation();
          clearSpringTimer();
          setDragTargetFolder(null);
        },
        onDrop: (e) => {
          e.preventDefault();
          e.stopPropagation();
          clearSpringTimer();
          setDragTargetFolder(null);
          setDraggedPath(null);

          const item = NoteDragDropManager.decode(e.dataTransfer);
          if (item && item.filePath && item.entryType === "file" && item.filePath !== folder.filePath) {
            onMove?.(item.filePath, folder.filePath);
          }
        },
      };
    },
    [dragTargetFolder, onMove, springDelayMs, clearSpringTimer]
  );

  const bindBreadcrumbDrop = useCallback(
    (segment) => {
      if (!segment || !segment.path) return {};

      return {
        onDragOver: (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          e.currentTarget.classList.add("drop-target-active");
        },
        onDragLeave: (e) => {
          e.currentTarget.classList.remove("drop-target-active");
        },
        onDrop: (e) => {
          e.preventDefault();
          e.currentTarget.classList.remove("drop-target-active");
          const item = NoteDragDropManager.decode(e.dataTransfer);
          if (item && item.filePath && item.entryType === "file") {
            onMove?.(item.filePath, segment.path);
          }
        },
      };
    },
    [onMove]
  );

  const bindTrashDrop = useCallback(() => {
    return {
      onDragOver: (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setIsDragOverTrash(true);
      },
      onDragLeave: () => {
        setIsDragOverTrash(false);
      },
      onDrop: (e) => {
        e.preventDefault();
        setIsDragOverTrash(false);
        const item = NoteDragDropManager.decode(e.dataTransfer);
        if (item && item.filePath) {
          onTrash?.(item);
        }
      },
    };
  }, [onTrash]);

  return {
    draggedPath,
    dragTargetFolder,
    dropLine,
    isDragOverTrash,
    bindDraggableNote,
    bindFolderDrop,
    bindBreadcrumbDrop,
    bindTrashDrop,
  };
}
