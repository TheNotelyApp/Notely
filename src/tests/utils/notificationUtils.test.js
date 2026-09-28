import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  showToast,
  showSuccessToast,
  showErrorToast,
  showInfoToast,
  showWarningToast,
} from "../../utils/notificationUtils";

describe("notificationUtils", () => {
  let dispatchedEvents = [];
  let listener;

  beforeEach(() => {
    dispatchedEvents = [];
    listener = (e) => dispatchedEvents.push(e.detail);
    window.addEventListener("app:toast", listener);
  });

  afterEach(() => {
    window.removeEventListener("app:toast", listener);
  });

  it("dispatches showToast with default info type", () => {
    showToast("Test message");
    expect(dispatchedEvents).toHaveLength(1);
    expect(dispatchedEvents[0]).toEqual({
      message: "Test message",
      type: "info",
      action: null,
    });
  });

  it("dispatches showSuccessToast correctly", () => {
    showSuccessToast("File saved");
    expect(dispatchedEvents).toHaveLength(1);
    expect(dispatchedEvents[0]).toEqual({
      message: "File saved",
      type: "success",
      action: null,
    });
  });

  it("dispatches showErrorToast correctly", () => {
    showErrorToast("Save failed");
    expect(dispatchedEvents).toHaveLength(1);
    expect(dispatchedEvents[0]).toEqual({
      message: "Save failed",
      type: "error",
      action: null,
    });
  });

  it("dispatches showWarningToast correctly", () => {
    showWarningToast("Low memory");
    expect(dispatchedEvents).toHaveLength(1);
    expect(dispatchedEvents[0]).toEqual({
      message: "Low memory",
      type: "warning",
      action: null,
    });
  });

  it("supports action payload in showToast", () => {
    const action = { label: "Undo", onClick: () => {} };
    showToast("Deleted item", "info", action);
    expect(dispatchedEvents).toHaveLength(1);
    expect(dispatchedEvents[0].action).toBe(action);
  });
});
