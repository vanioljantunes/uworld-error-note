"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import styles from "@/app/page.module.css";

interface TableEditorProps {
  value: string;
  onChange: (val: string) => void;
}

interface ParsedTable {
  title: string;
  headers: string[];
  rows: string[][];
}

export function parseTable(value: string): ParsedTable {
  let title = "";
  let headers: string[] = ["Column A", "Column B", "Column C"];
  let rows: string[][] = [["", "", ""]];

  // Extract title (text before <table>)
  const tableStart = value.indexOf("<table");
  if (tableStart > 0) {
    title = value
      .substring(0, tableStart)
      .replace(/<b>(.*?)<\/b>/gi, "$1")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]*>/g, "")
      .trim();
  } else if (!value.includes("<table")) {
    // No table found — treat entire content as title, provide default grid
    title = value.replace(/<[^>]*>/g, "").trim();
    return { title, headers, rows };
  }

  // Parse HTML table using regex (DOMParser not available in SSR)
  const thMatches = [...value.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)];
  if (thMatches.length > 0) {
    headers = thMatches.map((m) => m[1].replace(/<[^>]*>/g, "").trim());
  }

  const trMatches = [...value.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  rows = [];
  for (const tr of trMatches) {
    const tds = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    if (tds.length > 0) {
      rows.push(tds.map((m) => m[1].trim()));
    }
  }

  if (rows.length === 0) {
    rows = [headers.map(() => "")];
  }

  return { title, headers, rows };
}

export function rebuildTable(t: ParsedTable): string {
  const colCount = t.headers.length;

  const headerCells = t.headers
    .map(
      (h) =>
        `  <th style="padding:4px 8px;text-align:left;border:1px solid rgba(255,255,255,0.15)">${h}</th>`
    )
    .join("\n");

  const dataRows = t.rows
    .map((row) => {
      const cells = row
        .slice(0, colCount)
        .map(
          (cell) =>
            `  <td style="padding:4px 8px;border:1px solid rgba(255,255,255,0.1)">${cell}</td>`
        )
        .join("\n");
      return `<tr>\n${cells}\n</tr>`;
    })
    .join("\n");

  const table = `<table style="width:100%;border-collapse:collapse;font-size:12px">
<tr style="background:rgba(255,255,255,0.08)">
${headerCells}
</tr>
${dataRows}
</table>`;

  if (t.title) {
    return `<b>${t.title}</b><br><br>${table}`;
  }
  return table;
}

export default function TableEditor({ value, onChange }: TableEditorProps) {
  const [t, setT] = useState<ParsedTable>(() => parseTable(value));
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (value !== prevValueRef.current) {
      prevValueRef.current = value;
      setT(parseTable(value));
    }
  }, [value]);

  const emit = useCallback(
    (updated: ParsedTable) => {
      setT(updated);
      const rebuilt = rebuildTable(updated);
      prevValueRef.current = rebuilt;
      onChange(rebuilt);
    },
    [onChange]
  );

  const updateTitle = (v: string) => emit({ ...t, title: v });

  const updateHeader = (col: number, v: string) => {
    const headers = [...t.headers];
    headers[col] = v;
    emit({ ...t, headers });
  };

  const updateCell = (row: number, col: number, v: string) => {
    const rows = t.rows.map((r) => [...r]);
    rows[row][col] = v;
    emit({ ...t, rows });
  };

  const addRow = () => {
    emit({ ...t, rows: [...t.rows, t.headers.map(() => "")] });
  };

  const removeRow = (idx: number) => {
    if (t.rows.length <= 1) return;
    emit({ ...t, rows: t.rows.filter((_, i) => i !== idx) });
  };

  const addColumn = () => {
    emit({
      ...t,
      headers: [...t.headers, "New"],
      rows: t.rows.map((r) => [...r, ""]),
    });
  };

  const removeColumn = () => {
    if (t.headers.length <= 2) return;
    emit({
      ...t,
      headers: t.headers.slice(0, -1),
      rows: t.rows.map((r) => r.slice(0, -1)),
    });
  };

  return (
    <div className={styles.tableEditor}>
      <input
        className={styles.tableEditorTitle}
        value={t.title}
        onChange={(e) => updateTitle(e.target.value)}
        placeholder="Table title / question"
        spellCheck={false}
      />
      <div className={styles.tableEditorGrid}>
        {/* Header row */}
        <div className={`${styles.tableEditorRow} ${styles.tableEditorHeaderRow}`}>
          {t.headers.map((h, col) => (
            <input
              key={`h-${col}`}
              className={`${styles.tableEditorCell} ${styles.tableEditorHeaderCell}`}
              value={h}
              onChange={(e) => updateHeader(col, e.target.value)}
              spellCheck={false}
            />
          ))}
          <button className={styles.tableEditorColBtn} onClick={addColumn} type="button" title="Add column">
            +
          </button>
        </div>
        {/* Data rows */}
        {t.rows.map((row, rowIdx) => (
          <div key={rowIdx} className={styles.tableEditorRow}>
            {row.slice(0, t.headers.length).map((cell, col) => (
              <input
                key={`${rowIdx}-${col}`}
                className={styles.tableEditorCell}
                value={cell}
                onChange={(e) => updateCell(rowIdx, col, e.target.value)}
                spellCheck={false}
              />
            ))}
            {t.rows.length > 1 && (
              <button
                className={styles.tableEditorRowBtn}
                onClick={() => removeRow(rowIdx)}
                type="button"
                title="Remove row"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      <div className={styles.tableEditorActions}>
        <button className={styles.tableEditorAddBtn} onClick={addRow} type="button">
          + Add row
        </button>
        {t.headers.length > 2 && (
          <button className={styles.tableEditorAddBtn} onClick={removeColumn} type="button">
            − Remove column
          </button>
        )}
      </div>
    </div>
  );
}
