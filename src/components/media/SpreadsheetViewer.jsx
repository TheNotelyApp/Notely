import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { Search } from "lucide-react";
import { dataUrlToUint8Array } from "./mediaUtils";

export function SpreadsheetViewer({ dataUrl }) {
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  const { sheets, error } = useMemo(() => {
    if (!dataUrl) return { sheets: [], error: null };
    try {
      const bytes = dataUrlToUint8Array(dataUrl);
      if (!bytes) {
        throw new Error("Unable to decode spreadsheet data.");
      }
      const workbook = XLSX.read(bytes, { type: "array" });
      const parsedSheets = (workbook.SheetNames || []).map((name) => {
        const worksheet = workbook.Sheets[name];
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
        return {
          name,
          rows: rawRows,
        };
      });
      return { sheets: parsedSheets, error: null };
    } catch (err) {
      return { sheets: [], error: err?.message || "Failed to parse spreadsheet." };
    }
  }, [dataUrl]);

  const activeSheet = sheets[activeSheetIndex] || sheets[0];
  const allRows = useMemo(() => activeSheet?.rows || [], [activeSheet]);

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return allRows;
    const q = searchQuery.toLowerCase().trim();
    return allRows.filter((row, idx) => {
      if (idx === 0) return true; // keep header row
      return row.some((cell) => String(cell ?? "").toLowerCase().includes(q));
    });
  }, [allRows, searchQuery]);

  if (error) {
    return (
      <div className="spreadsheet-error-container">
        <p className="spreadsheet-error-title">Unable to preview spreadsheet</p>
        <p className="spreadsheet-error-msg">{error}</p>
      </div>
    );
  }

  if (!sheets.length) {
    return <div className="spreadsheet-empty-state">No spreadsheet data available.</div>;
  }

  // Calculate maximum columns in the active sheet
  const maxCols = allRows.reduce((max, row) => Math.max(max, (row || []).length), 0);

  function getColLetter(colIdx) {
    let letter = "";
    let temp = colIdx;
    while (temp >= 0) {
      letter = String.fromCharCode((temp % 26) + 65) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    return letter;
  }

  return (
    <div className="spreadsheet-viewer-wrapper">
      <div className="spreadsheet-toolbar">
        <div className="spreadsheet-search-wrap">
          <Search size={14} className="spreadsheet-search-icon" />
          <input
            type="text"
            className="spreadsheet-search-input"
            placeholder="Search active sheet..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="spreadsheet-search-clear"
              onClick={() => setSearchQuery("")}
            >
              ×
            </button>
          )}
        </div>
        <div className="spreadsheet-stats">
          <span>{filteredRows.length} rows</span>
          <span>•</span>
          <span>{maxCols} columns</span>
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <div className="spreadsheet-empty-sheet">Sheet has no data to display.</div>
      ) : (
        <div className="spreadsheet-table-container">
          <table className="spreadsheet-table">
            <thead>
              <tr>
                <th className="spreadsheet-corner-cell">#</th>
                {Array.from({ length: maxCols }).map((_, colIdx) => (
                  <th key={`col-${colIdx}`} className="spreadsheet-col-header">
                    {getColLetter(colIdx)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.slice(0, 1000).map((row, rowIdx) => (
                <tr key={`row-${rowIdx}`}>
                  <td className="spreadsheet-row-header">{rowIdx + 1}</td>
                  {Array.from({ length: maxCols }).map((_, colIdx) => {
                    const cellVal = row?.[colIdx] ?? "";
                    const isNumber = typeof cellVal === "number" || (!Number.isNaN(Number(cellVal)) && cellVal !== "");
                    return (
                      <td
                        key={`cell-${rowIdx}-${colIdx}`}
                        className={`spreadsheet-cell ${isNumber ? "cell-number" : ""}`}
                        title={String(cellVal)}
                      >
                        {String(cellVal)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRows.length > 1000 && (
            <div className="spreadsheet-overflow-notice">
              Showing first 1,000 rows of {filteredRows.length}. Open in application for full dataset.
            </div>
          )}
        </div>
      )}

      {sheets.length > 1 && (
        <div className="spreadsheet-tabs-bar" role="tablist" aria-label="Worksheet tabs">
          {sheets.map((sheet, index) => (
            <button
              key={`sheet-tab-${index}`}
              type="button"
              role="tab"
              aria-selected={activeSheetIndex === index}
              className={`spreadsheet-tab-btn ${activeSheetIndex === index ? "active" : ""}`}
              onClick={() => {
                setActiveSheetIndex(index);
                setSearchQuery("");
              }}
            >
              {sheet.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
