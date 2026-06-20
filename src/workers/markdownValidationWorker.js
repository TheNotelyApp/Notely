import { validateMarkdownComplete } from "../utils/markdownValidationComplete";

self.onmessage = async (event) => {
  const text = event?.data?.text || "";
  const requestId = event?.data?.requestId;

  try {
    const issues = await validateMarkdownComplete(text);
    self.postMessage({ ok: true, issues, requestId });
  } catch (error) {
    self.postMessage({
      ok: false,
      issues: [],
      error: error?.message || "Validation failed.",
      requestId,
    });
  }
};
