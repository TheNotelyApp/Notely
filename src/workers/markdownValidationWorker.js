import { validateMarkdownSyntax } from "../utils/markdownValidation";

self.onmessage = async (event) => {
  const text = event?.data?.text || "";

  try {
    const issues = await validateMarkdownSyntax(text);
    self.postMessage({ ok: true, issues });
  } catch (error) {
    self.postMessage({
      ok: false,
      issues: [],
      error: error?.message || "Validation failed.",
    });
  }
};
