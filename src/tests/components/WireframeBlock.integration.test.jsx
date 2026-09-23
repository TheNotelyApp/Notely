// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WireframeBlock } from "../../components/WireframeBlock";

const wireframeExistsMock = vi.fn();
const wireframeReadSourceMock = vi.fn();
const wireframeReadImageMock = vi.fn();

beforeEach(() => {
  wireframeExistsMock.mockReset();
  wireframeReadSourceMock.mockReset();
  wireframeReadImageMock.mockReset();

  globalThis.notesApi = {
    wireframeExists: (...args) => wireframeExistsMock(...args),
    wireframeReadSource: (...args) => wireframeReadSourceMock(...args),
    wireframeReadImage: (...args) => wireframeReadImageMock(...args),
  };
});

afterEach(() => {
  delete globalThis.notesApi;
  document.body.innerHTML = "";
});

function renderBlock(props) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);

  act(() => {
    root.render(<WireframeBlock {...props} />);
  });

  return {
    host,
    unmount() {
      act(() => {
        root.unmount();
      });
      host.remove();
    },
  };
}

function waitFor(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

describe("WireframeBlock", () => {
  it("renders placeholder state when wireframe diagram image does not exist", async () => {
    wireframeExistsMock.mockResolvedValue({ success: true, exists: false });
    wireframeReadImageMock.mockResolvedValue({ success: false, data: null });

    const view = renderBlock({
      diagramId: "test-wireframe-id",
    });

    await act(async () => {
      await waitFor(50);
    });

    expect(view.host.textContent).toContain("Click to create a Wireframe");
    view.unmount();
  });

  it("renders preview image and action buttons when wireframe exists", async () => {
    wireframeExistsMock.mockResolvedValue({ success: true, exists: true });
    wireframeReadImageMock.mockResolvedValue({ success: true, data: "data:image/png;base64,WIREFRAMETEST" });

    const view = renderBlock({
      diagramId: "test-wireframe-id",
    });

    await act(async () => {
      await waitFor(50);
    });

    const img = view.host.querySelector("img");
    expect(img).toBeTruthy();
    expect(img.getAttribute("src")).toBe("data:image/png;base64,WIREFRAMETEST");

    const buttons = view.host.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThan(0);
    view.unmount();
  });
});
