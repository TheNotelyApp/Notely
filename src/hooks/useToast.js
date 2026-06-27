import { useCallback, useState } from "react";

// Transient toast notifications. Each toast auto-dismisses after a fixed delay.
export function useToast(autoDismissMs = 3000) {
  const [toasts, setToasts] = useState([]);

  const notify = useCallback(
    (message, type = "info") => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setToasts((currentToasts) => [...currentToasts, { id, message, type }]);
      window.setTimeout(() => {
        setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id));
      }, autoDismissMs);
    },
    [autoDismissMs]
  );

  return { toasts, notify };
}
