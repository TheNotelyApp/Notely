function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function compareStrings(left, right) {
  return String(left || "").localeCompare(String(right || ""), undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

function getUpdatedTime(entry) {
  const parsed = new Date(entry?.updatedAt || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortDocuments(documents, sortBy) {
  const items = [...documents];

  if (sortBy === "updated-asc") {
    items.sort((left, right) => getUpdatedTime(left) - getUpdatedTime(right));
    return items;
  }

  if (sortBy === "title-asc") {
    items.sort((left, right) => compareStrings(left?.title, right?.title));
    return items;
  }

  if (sortBy === "title-desc") {
    items.sort((left, right) => compareStrings(right?.title, left?.title));
    return items;
  }

  // Default: latest first.
  items.sort((left, right) => getUpdatedTime(right) - getUpdatedTime(left));
  return items;
}

function matchesTypeFilter(entry, typeFilter) {
  if (typeFilter === "notes") {
    return entry?.entryType === "file";
  }
  if (typeFilter === "folders") {
    return entry?.entryType === "folder";
  }
  return true;
}

function matchesQuery(entry, query) {
  const needle = normalizeText(query);
  if (!needle) return true;

  const haystack = normalizeText([
    entry?.title,
    entry?.entryType,
    entry?.metadata?.time,
    entry?.metadata?.location,
    entry?.filePath,
  ].filter(Boolean).join(" "));

  return haystack.includes(needle);
}

export function applyDocumentListQuery(documents, options = {}) {
  const { query = "", typeFilter = "all", sortBy = "updated-desc" } = options;

  const filtered = documents.filter((entry) => {
    return matchesTypeFilter(entry, typeFilter) && matchesQuery(entry, query);
  });

  return sortDocuments(filtered, sortBy);
}
