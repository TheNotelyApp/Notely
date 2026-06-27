export function formatImageDeleteResult(result, fallbackMessage = "Image moved to removed.") {
  const referencesRemoved = Number(result?.referencesRemoved || 0);
  const remainingReferences = Number(result?.remainingReferences || 0);

  if (result?.keptFileBecauseReferencedElsewhere) {
    if (referencesRemoved > 0) {
      return `Removed ${referencesRemoved} markdown link${referencesRemoved === 1 ? "" : "s"}. Image file kept because ${remainingReferences || "other"} reference${remainingReferences === 1 ? "" : "s"} remain.`;
    }
    return "Image file kept because it is referenced elsewhere. No matching link was removed from this note.";
  }

  if (referencesRemoved > 0) {
    return `Removed ${referencesRemoved} markdown link${referencesRemoved === 1 ? "" : "s"} and moved the image to removed.`;
  }

  return fallbackMessage;
}