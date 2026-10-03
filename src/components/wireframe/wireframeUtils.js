import { Box, Layout, FileText } from "lucide-react";
import { WIREFRAME_STENCILS } from "./stencils";

export const CUSTOM_SNIPPETS_KEY = "notely_wireframe_custom_snippets";

export function getSavedSnippets() {
  try {
    const raw = localStorage.getItem(CUSTOM_SNIPPETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function persistSavedSnippets(snippets) {
  try {
    localStorage.setItem(CUSTOM_SNIPPETS_KEY, JSON.stringify(snippets));
  } catch (err) {
    console.error("Failed to persist custom snippets:", err);
  }
}

export function getComponentMeta(comp) {
  if (!comp) return { id: "unknown", name: "Element", icon: Box };
  const attrs = comp.getAttributes() || {};
  const wfType = attrs["data-wf-type"];
  const tagName = comp.get("tagName") || "div";

  if (wfType) {
    const match = WIREFRAME_STENCILS.find((s) => s.id === `wf-${wfType}` || s.id === wfType);
    if (match) return { id: match.id, name: match.name, icon: match.icon || Box };
  }

  // Fallback identification
  if (tagName === "button") return { id: "wf-button", name: "Button", icon: Box };
  if (tagName === "header") return { id: "wf-header-bar", name: "Header", icon: Layout };
  if (tagName === "aside") return { id: "wf-sidebar", name: "Sidebar", icon: Layout };
  if (tagName === "table" || comp.find("table")?.length) return { id: "wf-data-table", name: "Data Table", icon: Box };
  if (tagName === "nav") return { id: "wf-breadcrumb", name: "Navigation", icon: Box };
  if (tagName === "h1" || tagName === "h2" || tagName === "h3") return { id: "wf-heading", name: "Heading", icon: FileText };
  if (tagName === "p") return { id: "wf-text", name: "Text", icon: FileText };
  if (tagName === "input") return { id: "wf-input", name: "Input", icon: FileText };

  return { id: "wf-generic", name: tagName.toUpperCase(), icon: Box };
}
