// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AttachedReposPage from "../../components/AttachedReposPage";
import * as electronService from "../../services/electronService";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("AttachedReposPage Component", () => {
  let host;
  let root;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);

    vi.spyOn(electronService, "getAttachedRepos").mockResolvedValue([
      {
        id: "repo-1",
        name: "test-backend",
        path: "/workspace/backend",
        branch: "main",
        headCommit: "abcdef123456",
        remoteUrl: "https://github.com/example/backend"
      }
    ]);
    vi.spyOn(electronService, "onAttachedReposChanged").mockImplementation(() => () => {});
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

  it("renders attached repository card and breadcrumb", async () => {
    const onBack = vi.fn();

    await act(async () => {
      root.render(
        <AttachedReposPage
          notesFolderPath="/workspace"
          documents={[]}
          onBack={onBack}
        />
      );
    });

    expect(host.textContent).toContain("Attached Code Repositories");
    expect(host.textContent).toContain("test-backend");
    expect(host.textContent).toContain("main");
  });

  it("calls onBack when breadcrumb button is clicked", async () => {
    const onBack = vi.fn();

    await act(async () => {
      root.render(
        <AttachedReposPage
          notesFolderPath="/workspace"
          documents={[]}
          onBack={onBack}
        />
      );
    });

    const breadcrumbBtn = host.querySelector(".detail-breadcrumb-link");
    expect(breadcrumbBtn).not.toBeNull();

    act(() => {
      breadcrumbBtn.click();
    });

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
