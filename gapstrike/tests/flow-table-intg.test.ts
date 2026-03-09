import { describe, it, expect } from "vitest";
import { parseTable, rebuildTable } from "../src/components/TableEditor";

// AI-generated table HTML with bold title, 3 columns, 2 data rows containing cloze syntax
const FIXTURE_HTML = `<b>Kidney Disease Mechanisms</b><br><br><table style="width:100%;border-collapse:collapse;font-size:12px">
<tr style="background:rgba(255,255,255,0.08)">
  <th style="padding:4px 8px;text-align:left;border:1px solid rgba(255,255,255,0.15)">Condition</th>
  <th style="padding:4px 8px;text-align:left;border:1px solid rgba(255,255,255,0.15)">Mechanism</th>
  <th style="padding:4px 8px;text-align:left;border:1px solid rgba(255,255,255,0.15)">Presentation</th>
</tr>
<tr>
  <td style="padding:4px 8px;border:1px solid rgba(255,255,255,0.1)">Nephrotic syndrome</td>
  <td style="padding:4px 8px;border:1px solid rgba(255,255,255,0.1)">{{c1::Podocyte injury}}</td>
  <td style="padding:4px 8px;border:1px solid rgba(255,255,255,0.1)">Massive proteinuria</td>
</tr>
<tr>
  <td style="padding:4px 8px;border:1px solid rgba(255,255,255,0.1)">Nephritic syndrome</td>
  <td style="padding:4px 8px;border:1px solid rgba(255,255,255,0.1)">{{c2::Glomerular inflammation::pathology}}</td>
  <td style="padding:4px 8px;border:1px solid rgba(255,255,255,0.1)">Hematuria + HTN</td>
</tr>
</table>`;

// ── TABL-01: parseTable produces valid ParsedTable ────────────────────────────

describe("TABL-01 — parseTable produces valid ParsedTable", () => {
  it("extracts a non-empty title string", () => {
    const parsed = parseTable(FIXTURE_HTML);
    expect(typeof parsed.title).toBe("string");
    expect(parsed.title.length).toBeGreaterThan(0);
    expect(parsed.title).toBe("Kidney Disease Mechanisms");
  });

  it("extracts an array of 3 header strings", () => {
    const parsed = parseTable(FIXTURE_HTML);
    expect(Array.isArray(parsed.headers)).toBe(true);
    expect(parsed.headers).toHaveLength(3);
    expect(parsed.headers[0]).toBe("Condition");
    expect(parsed.headers[1]).toBe("Mechanism");
    expect(parsed.headers[2]).toBe("Presentation");
  });

  it("extracts an array of 2 rows each with 3 cells", () => {
    const parsed = parseTable(FIXTURE_HTML);
    expect(Array.isArray(parsed.rows)).toBe(true);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toHaveLength(3);
    expect(parsed.rows[1]).toHaveLength(3);
  });

  it("preserves cloze syntax {{c1::text}} verbatim in cell value", () => {
    const parsed = parseTable(FIXTURE_HTML);
    expect(parsed.rows[0][1]).toBe("{{c1::Podocyte injury}}");
  });

  it("preserves cloze with hint {{c2::term::hint}} verbatim in cell value", () => {
    const parsed = parseTable(FIXTURE_HTML);
    expect(parsed.rows[1][1]).toBe("{{c2::Glomerular inflammation::pathology}}");
  });
});

// ── TABL-02: cell editing via ParsedTable mutation ───────────────────────────

describe("TABL-02 — cell editing via ParsedTable mutation", () => {
  it("mutated cell value appears in rebuilt HTML", () => {
    const parsed = parseTable(FIXTURE_HTML);
    const mutated = {
      ...parsed,
      rows: parsed.rows.map((r) => [...r]),
    };
    mutated.rows[0][1] = "Edited cell";

    const rebuilt = rebuildTable(mutated);
    expect(rebuilt).toContain("Edited cell");
  });

  it("re-parsing rebuilt HTML returns the mutated cell value", () => {
    const parsed = parseTable(FIXTURE_HTML);
    const mutated = {
      ...parsed,
      rows: parsed.rows.map((r) => [...r]),
    };
    mutated.rows[0][1] = "Edited cell";

    const rebuilt = rebuildTable(mutated);
    const reparsed = parseTable(rebuilt);
    expect(reparsed.rows[0][1]).toBe("Edited cell");
  });
});

// ── TABL-03: addRow ───────────────────────────────────────────────────────────

describe("TABL-03 — addRow appends new empty row", () => {
  it("new table has 3 rows after addRow", () => {
    const parsed = parseTable(FIXTURE_HTML);
    expect(parsed.rows).toHaveLength(2);

    const withRow = {
      ...parsed,
      rows: [...parsed.rows, parsed.headers.map(() => "")],
    };
    expect(withRow.rows).toHaveLength(3);
  });

  it("rebuild and re-parse yields 3 rows with empty last row cells", () => {
    const parsed = parseTable(FIXTURE_HTML);
    const withRow = {
      ...parsed,
      rows: [...parsed.rows, parsed.headers.map(() => "")],
    };

    const rebuilt = rebuildTable(withRow);
    const reparsed = parseTable(rebuilt);
    expect(reparsed.rows).toHaveLength(3);
    expect(reparsed.rows[2][0]).toBe("");
    expect(reparsed.rows[2][1]).toBe("");
    expect(reparsed.rows[2][2]).toBe("");
  });
});

// ── TABL-03: removeRow ────────────────────────────────────────────────────────

describe("TABL-03 — removeRow removes a row by index", () => {
  it("new table has 1 row after removing row at index 0", () => {
    const parsed = parseTable(FIXTURE_HTML);
    expect(parsed.rows).toHaveLength(2);

    const withoutRow = {
      ...parsed,
      rows: parsed.rows.filter((_, i) => i !== 0),
    };
    expect(withoutRow.rows).toHaveLength(1);
  });

  it("rebuild and re-parse yields 1 row (the originally second row)", () => {
    const parsed = parseTable(FIXTURE_HTML);
    const withoutRow = {
      ...parsed,
      rows: parsed.rows.filter((_, i) => i !== 0),
    };

    const rebuilt = rebuildTable(withoutRow);
    const reparsed = parseTable(rebuilt);
    expect(reparsed.rows).toHaveLength(1);
    expect(reparsed.rows[0][0]).toBe("Nephritic syndrome");
  });
});

// ── TABL-04: addColumn ────────────────────────────────────────────────────────

describe("TABL-04 — addColumn appends new column", () => {
  it("new table has 4 headers and each row has 4 cells after addColumn", () => {
    const parsed = parseTable(FIXTURE_HTML);
    expect(parsed.headers).toHaveLength(3);

    const withCol = {
      ...parsed,
      headers: [...parsed.headers, "New"],
      rows: parsed.rows.map((r) => [...r, ""]),
    };
    expect(withCol.headers).toHaveLength(4);
    withCol.rows.forEach((row) => expect(row).toHaveLength(4));
  });

  it("rebuild and re-parse confirms 4 headers", () => {
    const parsed = parseTable(FIXTURE_HTML);
    const withCol = {
      ...parsed,
      headers: [...parsed.headers, "New"],
      rows: parsed.rows.map((r) => [...r, ""]),
    };

    const rebuilt = rebuildTable(withCol);
    const reparsed = parseTable(rebuilt);
    expect(reparsed.headers).toHaveLength(4);
    expect(reparsed.headers[3]).toBe("New");
  });
});

// ── TABL-04: removeColumn ─────────────────────────────────────────────────────

describe("TABL-04 — removeColumn removes last column", () => {
  it("new table has 2 headers and each row has 2 cells after removeColumn", () => {
    const parsed = parseTable(FIXTURE_HTML);
    expect(parsed.headers).toHaveLength(3);

    const withoutCol = {
      ...parsed,
      headers: parsed.headers.slice(0, -1),
      rows: parsed.rows.map((r) => r.slice(0, -1)),
    };
    expect(withoutCol.headers).toHaveLength(2);
    withoutCol.rows.forEach((row) => expect(row).toHaveLength(2));
  });
});

// ── TABL-06: rebuildTable round-trip preserves edits ─────────────────────────

describe("TABL-06 — rebuildTable round-trip preserves edits", () => {
  it("edited title and cell both survive parse -> mutate -> rebuild -> re-parse", () => {
    const parsed = parseTable(FIXTURE_HTML);
    const mutated = {
      ...parsed,
      title: "Edited Title",
      rows: parsed.rows.map((r) => [...r]),
    };
    mutated.rows[1][2] = "Edited presentation";

    const rebuilt = rebuildTable(mutated);
    const reparsed = parseTable(rebuilt);

    expect(reparsed.title).toBe("Edited Title");
    expect(reparsed.rows[1][2]).toBe("Edited presentation");
  });

  it("rebuilt HTML string contains <table and edited content", () => {
    const parsed = parseTable(FIXTURE_HTML);
    const mutated = {
      ...parsed,
      rows: parsed.rows.map((r) => [...r]),
    };
    mutated.rows[0][0] = "Membranous nephropathy";

    const rebuilt = rebuildTable(mutated);
    expect(rebuilt).toContain("<table");
    expect(rebuilt).toContain("Membranous nephropathy");
  });
});

// ── Header editing ────────────────────────────────────────────────────────────

describe("Header editing via ParsedTable mutation", () => {
  it("mutated header appears in rebuilt HTML", () => {
    const parsed = parseTable(FIXTURE_HTML);
    const mutated = {
      ...parsed,
      headers: [...parsed.headers],
    };
    mutated.headers[0] = "Renamed";

    const rebuilt = rebuildTable(mutated);
    const reparsed = parseTable(rebuilt);
    expect(reparsed.headers[0]).toBe("Renamed");
  });
});
