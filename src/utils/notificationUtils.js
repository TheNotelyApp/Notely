/**
 * Global Notification & Toast Utility
 * Standardizes app notifications across Notely using the unified 'app:toast' event bus.
 */

/**
 * Dispatch a global toast notification.
 * @param {string} message - Notification text
 * @param {"info"|"success"|"error"|"warning"} [type="info"] - Toast type
 * @param {object|null} [action=null] - Optional interactive action { label: string, onClick: function }
 */
export function showToast(message, type = "info", action = null) {
  if (typeof window === "undefined" || !message) return;
  window.dispatchEvent(
    new CustomEvent("app:toast", {
      detail: {
        message: String(message),
        type: type || "info",
        action: action || null,
      },
    })
  );
}

export function showSuccessToast(message, action = null) {
  showToast(message, "success", action);
}

export function showErrorToast(message, action = null) {
  showToast(message, "error", action);
}

export function showInfoToast(message, action = null) {
  showToast(message, "info", action);
}

export function showWarningToast(message, action = null) {
  showToast(message, "warning", action);
}
