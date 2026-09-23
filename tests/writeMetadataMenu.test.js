import { describe, it, expect } from "vitest";

const { buildAppMenuTemplate } = require("../electron/lib/core/appMenu.cjs");

describe("Write Note Metadata to File Menu", () => {
  it("fans out to Enabled and Disabled options with checkmark on Enabled when active", () => {
    const win = { isDestroyed: () => false };
    const context = {
      screen: "landing",
      writeMetadataToFile: true,
      recentWorkspacePaths: [],
      availableWorkspaces: []
    };

    const template = buildAppMenuTemplate(win, context, {});
    const wsMenu = template.find((item) => item.label === "Workspace");
    expect(wsMenu).toBeDefined();

    const metaItem = wsMenu.submenu.find((item) => item.label === "Write Note Metadata to File");
    expect(metaItem).toBeDefined();
    expect(metaItem.submenu).toBeDefined();
    expect(metaItem.submenu.length).toBe(2);

    const enabledOpt = metaItem.submenu.find((item) => item.label === "Enabled");
    const disabledOpt = metaItem.submenu.find((item) => item.label === "Disabled");

    expect(enabledOpt.type).toBe("checkbox");
    expect(enabledOpt.checked).toBe(true);
    expect(enabledOpt.action).toBe("set-write-metadata-to-file-enabled");

    expect(disabledOpt.type).toBe("checkbox");
    expect(disabledOpt.checked).toBe(false);
    expect(disabledOpt.action).toBe("set-write-metadata-to-file-disabled");
  });

  it("checks Disabled when writeMetadataToFile is false", () => {
    const win = { isDestroyed: () => false };
    const context = {
      screen: "document",
      writeMetadataToFile: false,
      recentWorkspacePaths: [],
      availableWorkspaces: []
    };

    const template = buildAppMenuTemplate(win, context, {});
    const wsMenu = template.find((item) => item.label === "Workspace");
    const metaItem = wsMenu.submenu.find((item) => item.label === "Write Note Metadata to File");

    const enabledOpt = metaItem.submenu.find((item) => item.label === "Enabled");
    const disabledOpt = metaItem.submenu.find((item) => item.label === "Disabled");

    expect(enabledOpt.checked).toBe(false);
    expect(disabledOpt.checked).toBe(true);
  });

  it("preserves writeMetadataToFile: false through windowLifecycle handleMenuContextUpdate", () => {
    const { createWindowLifecycle } = require("../electron/lib/core/windowLifecycle.cjs");
    const fakeWin = {
      isDestroyed: () => false,
      webContents: { send: () => {} }
    };
    const lifecycle = createWindowLifecycle({
      app: { requestSingleInstanceLock: () => true, on: () => {} },
      BrowserWindow: {
        fromWebContents: () => fakeWin,
        getAllWindows: () => [fakeWin]
      },
      Menu: { setApplicationMenu: () => {} },
      buildAppMenu: () => ({ items: [] }),
      projectRoot: process.cwd()
    });

    lifecycle.handleMenuContextUpdate({ sender: fakeWin.webContents }, {
      writeMetadataToFile: false,
      screen: "document"
    });

    expect(fakeWin.__menuContext.writeMetadataToFile).toBe(false);

    lifecycle.handleMenuContextUpdate({ sender: fakeWin.webContents }, {
      writeMetadataToFile: true,
      screen: "landing"
    });

    expect(fakeWin.__menuContext.writeMetadataToFile).toBe(true);
  });
});

