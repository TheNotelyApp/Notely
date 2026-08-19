// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { TimeMachineScrubber } from "../../components/TimeMachineScrubber";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("TimeMachineScrubber", () => {
  let host;
  let root;

  const mockCommits = [
    { hash: "abc1234567890", shortHash: "abc1234", message: "Initial commit", author: "Dev", date: "2026-08-16T10:00:00Z" },
    { hash: "def9876543210", shortHash: "def9876", message: "Updated notes", author: "Dev", date: "2026-08-16T12:00:00Z" },
  ];

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
    if (host && host.parentNode) {
      host.parentNode.removeChild(host);
    }
    document.body.innerHTML = "";
  });

  it("renders empty state message when no commits exist", async () => {
    await act(async () => {
      root.render(
        <TimeMachineScrubber
          commits={[]}
          currentIndex={0}
          onChangeIndex={vi.fn()}
          onClose={vi.fn()}
        />
      );
    });

    expect(host.textContent).toContain("No commit history recorded");
  });

  it("renders history step indicator and commit info badge", async () => {
    await act(async () => {
      root.render(
        <TimeMachineScrubber
          commits={mockCommits}
          currentIndex={0}
          onChangeIndex={vi.fn()}
          onClose={vi.fn()}
          viewMode="preview"
        />
      );
    });

    expect(host.textContent).toContain("Time Machine");
    expect(host.textContent).toContain("Revision 2 of 2");
    expect(host.textContent).toContain("abc1234");
    expect(host.textContent).toContain("Initial commit");
  });

  it("triggers index change when clicking step buttons", async () => {
    const onChangeIndex = vi.fn();
    await act(async () => {
      root.render(
        <TimeMachineScrubber
          commits={mockCommits}
          currentIndex={0}
          onChangeIndex={onChangeIndex}
          onClose={vi.fn()}
        />
      );
    });

    const prevButton = host.querySelector('button[aria-label="Previous revision"]');
    expect(prevButton).not.toBeNull();
    await act(async () => {
      prevButton.click();
    });

    expect(onChangeIndex).toHaveBeenCalledWith(1);
  });

  it("triggers restore callback when Restore Version button is clicked", async () => {
    const onRestore = vi.fn();
    await act(async () => {
      root.render(
        <TimeMachineScrubber
          commits={mockCommits}
          currentIndex={0}
          onChangeIndex={vi.fn()}
          onRestore={onRestore}
          onClose={vi.fn()}
        />
      );
    });

    const restoreButton = host.querySelector(".time-machine-restore-btn");
    expect(restoreButton).not.toBeNull();
    await act(async () => {
      restoreButton.click();
    });

    expect(onRestore).toHaveBeenCalledWith(mockCommits[0]);
  });

  it("toggles view mode between preview and diff", async () => {
    const onToggleViewMode = vi.fn();
    await act(async () => {
      root.render(
        <TimeMachineScrubber
          commits={mockCommits}
          currentIndex={0}
          onChangeIndex={vi.fn()}
          onClose={vi.fn()}
          onToggleViewMode={onToggleViewMode}
        />
      );
    });

    const diffButton = host.querySelectorAll(".time-machine-mode-btn")[1];
    expect(diffButton).not.toBeNull();
    await act(async () => {
      diffButton.click();
    });

    expect(onToggleViewMode).toHaveBeenCalledWith("diff");
  });
});
