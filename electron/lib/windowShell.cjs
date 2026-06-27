function buildContentSecurityPolicy(rendererUrl) {
  const isDev = Boolean(rendererUrl);

  // In dev, Vite + React Fast Refresh require inline/eval scripts and a
  // websocket connection for HMR. Production locks scripts down to 'self'.
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self'";

  const connectSrc = isDev
    ? "connect-src 'self' https://api.languagetool.org ws: http://127.0.0.1:* http://localhost:*"
    : "connect-src 'self' https://api.languagetool.org";

  return [
    "default-src 'self'",
    scriptSrc,
    // CodeMirror, Mermaid and inline positioning styles require inline styles.
    "style-src 'self' 'unsafe-inline'",
    // Note images and media are resolved to data:/blob: URLs, plus local files
    // for PDF export rendering.
    "img-src 'self' data: blob: file:",
    "media-src 'self' data: blob: file:",
    "font-src 'self' data:",
    connectSrc,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "frame-src 'none'"
  ].join("; ");
}

function applyContentSecurityPolicy(session, rendererUrl) {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    // Strip any incoming CSP header to avoid duplicate/conflicting policies.
    for (const headerName of Object.keys(responseHeaders)) {
      if (headerName.toLowerCase() === "content-security-policy") {
        delete responseHeaders[headerName];
      }
    }
    responseHeaders["Content-Security-Policy"] = [buildContentSecurityPolicy(rendererUrl)];
    callback({ responseHeaders });
  });
}

function isAppOriginUrl(targetUrl, rendererUrl) {
  try {
    const parsed = new URL(targetUrl);
    if (rendererUrl) {
      return parsed.origin === new URL(rendererUrl).origin;
    }
    return parsed.protocol === "file:";
  } catch {
    return false;
  }
}

function hardenWebContents(webContents, { rendererUrl, shell }) {
  // Deny in-app window creation; route external http(s) links to the OS browser.
  webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url).catch(() => {});
    }
    return { action: "deny" };
  });

  // Block navigation away from the app origin (e.g. injected/clicked links).
  webContents.on("will-navigate", (event, url) => {
    if (isAppOriginUrl(url, rendererUrl)) {
      return;
    }
    event.preventDefault();
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url).catch(() => {});
    }
  });

  // Refuse attachment of <webview> elements outright.
  webContents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });
}

function createMainWindow({
  BrowserWindow,
  Menu,
  buildAppMenu,
  rendererUrl,
  projectRoot,
  path,
  fs,
  shell,
  terminalIpc,
  onClosed,
}) {
  const iconCandidates = [
    path.join(process.resourcesPath || "", "icon.ico"),
    path.join(process.resourcesPath || "", "icon.png"),
    path.join(process.cwd(), "build", "icon.ico"),
    path.join(process.cwd(), "build", "icon.png"),
    path.join(projectRoot, "build", "icon.ico"),
    path.join(projectRoot, "build", "icon.png")
  ];
  const windowIconPath = iconCandidates.find((candidate) => candidate && fs.existsSync(candidate));

  const win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 980,
    minHeight: 640,
    show: false,
    backgroundColor: "#f5f3ef",
    ...(windowIconPath ? { icon: windowIconPath } : {}),
    webPreferences: {
      preload: path.join(__dirname, "..", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false
    }
  });

  hardenWebContents(win.webContents, { rendererUrl, shell });

  let hasShown = false;

  const showWindow = () => {
    if (win.isDestroyed()) return;
    if (!hasShown) {
      hasShown = true;
      win.center();
      win.show();
    }
    win.focus();
  };

  win.once("ready-to-show", () => {
    win.center();
    showWindow();
  });

  // Fallback for packaged/runtime load timing issues where ready-to-show may not fire.
  setTimeout(() => {
    if (!hasShown) {
      showWindow();
    }
  }, 3000);

  win.webContents.on("did-fail-load", (_event, code, desc, url) => {
    console.error("Renderer failed to load:", { code, desc, url });
    showWindow();
  });

  if (rendererUrl) {
    win.loadURL(rendererUrl);
  } else {
    win.loadFile(path.join(projectRoot, "dist", "index.html"));
  }

  win.__menuContext = { screen: "landing", viewMode: "tile", dirty: false };
  Menu.setApplicationMenu(buildAppMenu(win, win.__menuContext));

  win.on("closed", () => {
    terminalIpc.disposeForWindow(win.id);
    if (typeof onClosed === "function") {
      onClosed(win);
    }
  });

  return win;
}

module.exports = {
  applyContentSecurityPolicy,
  createMainWindow,
};
