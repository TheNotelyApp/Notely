import { describe, it, expect, vi } from "vitest";

const { buildAppMenuTemplate } = require("../electron/lib/core/appMenu.cjs");

describe("Font Preference Menu in View Menu", () => {
  it("renders Font submenu with 5 developer-friendly fonts in landing screen", () => {
    const win = { isDestroyed: () => false };
    const context = {
      screen: "landing",
      fontPreference: "jetbrains-mono",
      recentWorkspacePaths: [],
      availableWorkspaces: []
    };

    const template = buildAppMenuTemplate(win, context, {});
    const viewMenu = template.find((item) => item.label === "View");
    expect(viewMenu).toBeDefined();

    const fontItem = viewMenu.submenu.find((item) => item.label === "Font");
    expect(fontItem).toBeDefined();
    expect(fontItem.submenu).toBeDefined();
    expect(fontItem.submenu.length).toBe(5);

    const labels = fontItem.submenu.map((item) => item.label);
    expect(labels).toEqual([
      "Inter (Default)",
      "JetBrains Mono",
      "Fira Code",
      "Cascadia Code",
      "Source Code Pro"
    ]);

    // Check checked state
    const jetbrainsOption = fontItem.submenu.find((item) => item.label === "JetBrains Mono");
    expect(jetbrainsOption.checked).toBe(true);

    const interOption = fontItem.submenu.find((item) => item.label === "Inter (Default)");
    expect(interOption.checked).toBe(false);
  });

  it("renders Font submenu in document screen and defaults to Inter when preference not set", () => {
    const win = { isDestroyed: () => false };
    const context = {
      screen: "document",
      recentWorkspacePaths: [],
      availableWorkspaces: []
    };

    const template = buildAppMenuTemplate(win, context, {});
    const viewMenu = template.find((item) => item.label === "View");
    expect(viewMenu).toBeDefined();

    const fontItem = viewMenu.submenu.find((item) => item.label === "Font");
    expect(fontItem).toBeDefined();

    const interOption = fontItem.submenu.find((item) => item.label === "Inter (Default)");
    expect(interOption.checked).toBe(true);
  });

  it("triggers sendMenuAction with expected font key on click", () => {
    const mockSend = vi.fn();
    const win = {
      isDestroyed: () => false,
      webContents: {
        send: mockSend
      }
    };
    const context = {
      screen: "document",
      fontPreference: "cascadia-code",
      recentWorkspacePaths: [],
      availableWorkspaces: []
    };

    const template = buildAppMenuTemplate(win, context, {});
    const viewMenu = template.find((item) => item.label === "View");
    const fontItem = viewMenu.submenu.find((item) => item.label === "Font");

    const firaOption = fontItem.submenu.find((item) => item.label === "Fira Code");
    expect(firaOption).toBeDefined();
    firaOption.click();

    expect(mockSend).toHaveBeenCalledWith("app-menu:action", "font-fira-code");
  });
});
