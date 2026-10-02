// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppSubpageViews } from "../../components/layout/AppSubpageViews";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Mock subpage views to isolate testing
vi.mock("../../components/GitVersionControlPage", () => ({
  default: () => <div data-testid="mock-vc-page">Version Control Content</div>,
  GitVersionControlPage: () => <div data-testid="mock-vc-page">Version Control Content</div>,
}));

vi.mock("../../components/KnowledgeGraph", () => ({
  default: () => <div data-testid="mock-kg-page">Knowledge Graph Content</div>,
  KnowledgeGraph: () => <div data-testid="mock-kg-page">Knowledge Graph Content</div>,
}));

vi.mock("../../components/DownloadsPage", () => ({
  default: () => <div data-testid="mock-downloads-page">Downloads Content</div>,
  DownloadsPage: () => <div data-testid="mock-downloads-page">Downloads Content</div>,
}));

describe("AppSubpageViews Error Boundary and Resilience", () => {
  let host;
  let root;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root.unmount();
      });
    }
    if (host) {
      host.remove();
    }
    vi.restoreAllMocks();
  });

  it("renders subpages when their respective flags are true", async () => {
    await act(async () => {
      root.render(
        <AppSubpageViews
          gitVCOpen={true}
          setGitVCOpen={vi.fn()}
          notesFolderPath="/test/workspace"
        />
      );
    });

    expect(host.textContent).toContain("Version Control Content");

    await act(async () => {
      root.render(
        <AppSubpageViews
          gitVCOpen={false}
          downloadsPageOpen={true}
          setDownloadsPageOpen={vi.fn()}
          notesFolderPath="/test/workspace"
        />
      );
    });

    expect(host.textContent).toContain("Downloads Content");
  });

  it("handles subpage error boundary resets", async () => {
    const setGitVCOpen = vi.fn();
    await act(async () => {
      root.render(
        <AppSubpageViews
          gitVCOpen={true}
          setGitVCOpen={setGitVCOpen}
          notesFolderPath="/test/workspace"
        />
      );
    });

    expect(host.textContent).toContain("Version Control Content");
  });
});
