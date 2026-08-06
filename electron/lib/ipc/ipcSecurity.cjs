function isTrustedIpcSender(BrowserWindow, event) {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) {
      return false;
    }

    const frame = event.senderFrame;
    if (frame && frame.parent) {
      return false;
    }

    // Verify sender frame URL origin (allow app file/localhost URLs)
    const url = String(frame?.url || "").toLowerCase();
    const isAppProtocol = url.startsWith("file:") || url.startsWith("app:") || url.startsWith("http://localhost:") || url.startsWith("http://127.0.0.1:");
    if (!isAppProtocol && url !== "" && url !== "about:blank") {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function assertTrustedIpcSender(BrowserWindow, event, channel) {
  if (!isTrustedIpcSender(BrowserWindow, event)) {
    throw new Error(`Untrusted IPC sender rejected${channel ? ` (${channel})` : ""}.`);
  }
}

module.exports = {
  isTrustedIpcSender,
  assertTrustedIpcSender,
};