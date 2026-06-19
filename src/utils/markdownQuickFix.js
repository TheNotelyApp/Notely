function normalizedLineList(text) {
  return (text || "").split(/\r?\n/);
}

export function getIssueFixType(issue) {
  const text = (issue?.message || "").toLowerCase();
  if (issue?.ruleId === "table-separator") return "table-separator";
  if (issue?.ruleId === "table-columns") return "table-columns";
  if (text.includes("code fenced") || text.includes("fenced code") || text.includes("code fence")) {
    return "code-fence";
  }
  return null;
}

export function applyMarkdownQuickFix(value, issue) {
  if (!issue) return { nextValue: value || "", changed: false, message: "No issue selected." };

  const fixType = getIssueFixType(issue);
  const lines = normalizedLineList(value);

  if (fixType === "code-fence") {
    return {
      nextValue: `${value || ""}\n\`\`\``,
      changed: true,
      message: "Inserted closing code fence.",
    };
  }

  if (fixType === "table-separator") {
    const headerIndex = Math.max((issue.line || 2) - 2, 0);
    const separatorIndex = Math.max((issue.line || 2) - 1, 0);
    const headerLine = lines[headerIndex] || "";
    const columns = Math.max(1, headerLine.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").length);

    lines[separatorIndex] = `| ${Array.from({ length: columns }, () => "---").join(" | ")} |`;
    return {
      nextValue: lines.join("\n"),
      changed: true,
      message: "Fixed table separator.",
    };
  }

  if (fixType === "table-columns") {
    const lineIndex = Math.max((issue.line || 1) - 1, 0);
    const row = (lines[lineIndex] || "").trim().replace(/^\|/, "").replace(/\|$/, "");
    const cells = row ? row.split("|").map((cell) => cell.trim()) : [];

    let expectedColumns = cells.length;
    for (let index = lineIndex - 1; index >= 0; index -= 1) {
      if (!lines[index].includes("|")) continue;
      const candidate = lines[index].trim().replace(/^\|/, "").replace(/\|$/, "").split("|").length;
      if (candidate > 0) {
        expectedColumns = candidate;
        break;
      }
    }

    const fixedCells = [...cells];
    while (fixedCells.length < expectedColumns) fixedCells.push(" ");
    if (fixedCells.length > expectedColumns) fixedCells.length = expectedColumns;

    lines[lineIndex] = `| ${fixedCells.join(" | ")} |`;
    return {
      nextValue: lines.join("\n"),
      changed: true,
      message: "Fixed table column count.",
    };
  }

  return {
    nextValue: value || "",
    changed: false,
    message: "No automatic quick fix available for this issue.",
  };
}
