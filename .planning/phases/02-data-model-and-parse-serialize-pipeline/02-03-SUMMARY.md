---
phase: 02-data-model-and-parse-serialize-pipeline
plan: 03
subsystem: gapstrike/table-editor
tags: [bug-fix, tdd, cloze-passthrough, table-editor]
dependency_graph:
  requires: []
  provides: [parseTable-cloze-safe, rebuildTable-exported]
  affects: [gapstrike/src/components/TableEditor.tsx]
tech_stack:
  added: [vitest, jsdom, entities]
  patterns: [TDD red-green, module-level exports for testability]
key_files:
  created:
    - gapstrike/tests/table-cloze.test.ts
    - gapstrike/vitest.config.ts
  modified:
    - gapstrike/src/components/TableEditor.tsx
    - gapstrike/package.json
decisions:
  - Export parseTable and rebuildTable at module level to enable unit testing without React render overhead
  - Remove tag-stripping regex from td cell extraction only — header stripping left in place per plan (headers don't contain cloze)
  - entities@4 installed explicitly to fix missing transitive dependency in jsdom/parse5
metrics:
  duration: ~10 minutes
  completed_date: "2026-03-09"
  tasks_completed: 1
  files_modified: 4
requirements: [TABL-05]
---

# Phase 02 Plan 03: TableEditor parseTable Cloze Passthrough Fix Summary

**One-liner:** Fixed `parseTable()` tag-stripping regex that silently destroyed cloze syntax in td cells, and added Vitest unit tests confirming cloze passthrough for both plain and hinted forms.

## What Was Built

The `parseTable()` function in `gapstrike/src/components/TableEditor.tsx` was stripping all HTML tags from `<td>` cell content using `.replace(/<[^>]*>/g, "")`. While this didn't strip the `{{c1::text}}` cloze delimiters themselves, it would strip any surrounding inline HTML (e.g., `<b>{{c1::term}}</b>` became `{{c1::term}}` — losing the `<b>` wrapper). The fix removes the stripping regex entirely, preserving raw innerHTML for cell values.

Additionally, `parseTable` and `rebuildTable` were file-scoped (no `export` keyword), making them untestable without rendering the React component. Both are now exported at module level.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 (RED) | Add failing vitest tests | 8e30aa9 | gapstrike/tests/table-cloze.test.ts, vitest.config.ts |
| 1 (GREEN) | Fix parseTable + export functions | 0adffae | gapstrike/src/components/TableEditor.tsx |

## Changes Made

### gapstrike/src/components/TableEditor.tsx

Line 16: `function parseTable` → `export function parseTable`

Line 47 (the core fix):
- BEFORE: `rows.push(tds.map((m) => m[1].replace(/<[^>]*>/g, "").trim()));`
- AFTER:  `rows.push(tds.map((m) => m[1].trim()));`

Line 58: `function rebuildTable` → `export function rebuildTable`

### gapstrike/tests/table-cloze.test.ts (new)

4 test cases using a fixture HTML table with cloze cells:
1. Plain cloze `{{c1::Mesonephric duct}}` preserved in cell value
2. Hinted cloze `<b>{{c2::Metanephric blastema::embryo}}</b>` preserved with inline HTML
3. Plain text cells unaffected (no regression)
4. Round-trip through `rebuildTable` preserves cloze syntax

## Verification

```
cd gapstrike && npx vitest run tests/table-cloze.test.ts
Test Files  1 passed (1)
Tests       4 passed (4)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing entities transitive dependency**
- **Found during:** Task 1 (RED) — first vitest run
- **Issue:** jsdom/parse5 depends on `entities` package but it was not installed in node_modules
- **Fix:** `npm install entities@4` to install the missing transitive dependency
- **Files modified:** gapstrike/package.json, gapstrike/package-lock.json
- **Commit:** 8e30aa9 (bundled with RED test commit)

**2. [Rule 3 - Blocking] Vitest infrastructure not yet set up (Plan 01 not run)**
- **Found during:** Task 1 pre-check
- **Issue:** No vitest, jsdom, or vitest.config.ts existed — Plan 01 was not a prerequisite that had run
- **Fix:** Installed vitest + jsdom; created vitest.config.ts with jsdom environment and @-alias
- **Files modified:** gapstrike/package.json, gapstrike/vitest.config.ts
- **Commit:** 8e30aa9

## Self-Check: PASSED

Files created/modified:
- gapstrike/tests/table-cloze.test.ts — FOUND
- gapstrike/vitest.config.ts — FOUND
- gapstrike/src/components/TableEditor.tsx — FOUND
- gapstrike/package.json — FOUND

Commits:
- 8e30aa9 — test(02-03): add failing tests (RED) — FOUND
- 0adffae — feat(02-03): fix parseTable + export (GREEN) — FOUND
