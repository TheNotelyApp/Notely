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