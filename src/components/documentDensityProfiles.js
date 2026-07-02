export const DOCUMENT_DENSITY_PROFILES = {
  comfortable: {
    tableCellPaddingY: 10,
    tableCellPaddingX: 12,
    tableCellFontSize: 13,
    cardMinHeight: 124,
    cardPadding: 14,
    cardGap: 12,
    metaFontSize: 12,
    thumbHeight: 42,
    targetRowsPerViewport: 9,
    targetCardsPerViewport: 6,
  },
  compact: {
    tableCellPaddingY: 8,
    tableCellPaddingX: 10,
    tableCellFontSize: 12,
    cardMinHeight: 104,
    cardPadding: 10,
    cardGap: 10,
    metaFontSize: 11,
    thumbHeight: 34,
    targetRowsPerViewport: 12,
    targetCardsPerViewport: 8,
  },
};

export function normalizeDocumentDensity(value) {
  return value === "compact" ? "compact" : "comfortable";
}

export function getDocumentDensityProfile(value) {
  const normalized = normalizeDocumentDensity(value);
  return DOCUMENT_DENSITY_PROFILES[normalized];
}
