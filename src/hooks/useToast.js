import { useCallback, useEffect, useRef, useState } from "react";

const DEDUPE_WINDOW_MS = 1000;
const MAX_VISIBLE_TOASTS = 3;

/**
 * Transient toast notifications hook with deduplication and auto-dismissal.
 * @param {number} [autoDismissMs=3000] - Default auto-dismiss timeout in ms
 */
export function useToast(autoDismissMs = 3000) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());
  const recentHistoryRef = useRef(new Map());

  // Clean up all timers on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timerId) => window.clearTimeout(timerId));
      timers.clear();
    };
  }, []);

  const dismiss = useCallback((id) => {
    const timerId = timersRef.current.get(id);
    if (timerId) {
      window.clearTimeout(timerId);
      timersRef.current.delete(id);
    }
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (message, type = "info", action = null, options = {}) => {
      if (!message || typeof message !== "string") return;
      const normalizedMsg = message.trim();
      if (!normalizedMsg) return;

      const dedupeKey = `${type}:${normalizedMsg}`;
      const now = Date.now();
      const recent = recentHistoryRef.current.get(dedupeKey);
      const duration = options.duration || autoDismissMs;

      // Deduplicate if identical toast arrived within DEDUPE_WINDOW_MS
      if (recent && now - recent.time < DEDUPE_WINDOW_MS) {
        // Refresh timer on existing toast if still active
        const existingTimerId = timersRef.current.get(recent.id);
        if (existingTimerId) {
          window.clearTimeout(existingTimerId);
          const newTimerId = window.setTimeout(() => {
            dismiss(recent.id);
          }, duration);
          timersRef.current.set(recent.id, newTimerId);
        }
        recent.time = now;
        return recent.id;
      }

      const id = `${now}-${Math.random().toString(16).slice(2)}`;
      recentHistoryRef.current.set(dedupeKey, { id, time: now });

      const timerId = window.setTimeout(() => {
        dismiss(id);
      }, duration);
      timersRef.current.set(id, timerId);

      setToasts((currentToasts) => {
        const next = [...currentToasts, { id, message: normalizedMsg, type, action }];
        if (next.length > MAX_VISIBLE_TOASTS) {
          const removed = next.shift();
          if (removed) {
            const removedTimer = timersRef.current.get(removed.id);
            if (removedTimer) {
              window.clearTimeout(removedTimer);
              timersRef.current.delete(removed.id);
            }
          }
        }
        return next;
      });

      return id;
    },
    [autoDismissMs, dismiss]
  );

  return { toasts, notify, dismiss };
}

