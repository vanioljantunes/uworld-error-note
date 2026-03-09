---
phase: 01-templates
plan: 03
subsystem: ui
tags: [anki, ankiconnect, cloze, flowchart, html, typescript]

# Dependency graph
requires:
  - phase: 01-01
    provides: anki_flowchart template generating div-based inline HTML with cloze syntax
  - phase: 01-02
    provides: anki_table template generating inline-style HTML tables
provides:
  - Dual-card save in handleMakeCard — flowchart/table HTML card + companion plain cloze card saved simultaneously
  - Human-verified Anki desktop rendering of flowchart HTML (TMPL-06 confirmed)
  - AnkiConnect addNote with inline HTML FRONT field confirmed working (INTG-03 confirmed)
  - Companion cloze card saved alongside alternate-format card (INTG-04 confirmed)
affects:
  - Phase 2 (data model and parse pipeline builds on confirmed Anki HTML format)
  - Phase 4 (editing operations depend on same dual-card save pattern)
  - Phase 5 (AnkiDroid smoke-test extends this rendering validation)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual-card save: when editorMode is flowchart or table, handleMakeCard saves the HTML card first then a companion plain cloze card using modeContentRef.current['cloze']"
    - "Non-fatal companion card: cloze companion failure is logged and suppressed — primary card already saved"
    - "Model-fallback loop reused for companion cloze card to find the correct cloze field name via modelTemplates inspection"

key-files:
  created: []
  modified:
    - gapstrike/src/components/FlowView.tsx

key-decisions:
  - "Companion cloze card is non-fatal — if it fails (missing cloze syntax, model mismatch), only a console.warn is emitted; the primary HTML card is not affected"
  - "modeContentRef.current['cloze'] is the canonical source for original cloze text when in flowchart/table mode — set by handleSwitchEditor before overwriting editFront"
  - "Status message updated to 'Cards added — flowchart + cloze (ModelName)' when both cards succeed, giving user visible confirmation of dual save"

patterns-established:
  - "Dual-card save pattern: primary HTML card saved first, companion plain cloze card saved second inside if (noteId) branch"
  - "Model-fallback loop reuse: the same modelsToTry loop is reused for the companion card to share model resolution logic"

requirements-completed: [TMPL-06, INTG-03, INTG-04]

# Metrics
duration: ~30min
completed: 2026-03-09
---

# Phase 1 Plan 03: Dual Card Save and Anki Rendering Validation Summary

**Dual-card save in FlowView.tsx handleMakeCard saves flowchart/table HTML card + plain cloze companion via modeContentRef, with human-verified Anki desktop rendering confirming TMPL-06, INTG-03, and INTG-04**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-03-09
- **Completed:** 2026-03-09
- **Tasks:** 2 (1 auto + 1 checkpoint:human-verify)
- **Files modified:** 1

## Accomplishments

- Added INTG-04 dual-card save logic inside `handleMakeCard` — when `editorMode` is `"flowchart"` or `"table"`, a companion plain cloze card is saved immediately after the primary HTML card using `modeContentRef.current["cloze"]` as the front field
- Human verification confirmed flowchart HTML renders correctly in Anki desktop with boxes and arrows visible, cloze syntax surviving AnkiConnect push verbatim (TMPL-06 + INTG-03)
- Human verification confirmed two Anki notes appear in Browse for each flowchart/table save: one HTML-front card and one plain-cloze companion card (INTG-04)

## Task Commits

Each task was committed atomically:

1. **Task 1: Save companion cloze card alongside flowchart/table card (INTG-04)** - `4670b67` (feat)
2. **Task 2: Human verification — Anki end-to-end rendering** - approved (checkpoint, no commit)

## Files Created/Modified

- `gapstrike/src/components/FlowView.tsx` - Added dual-card save block inside `if (noteId)` branch of `handleMakeCard`; reuses model-fallback loop for companion cloze card; status message updated to reflect dual save

## Decisions Made

- Companion cloze save is non-fatal — failure is caught, logged as `console.warn`, and suppressed so the primary card always lands
- `modeContentRef.current["cloze"]` is used as the authoritative source for original cloze text; a regex guard `/\{\{c\d+::/i` ensures we only attempt the companion save when real cloze syntax is present
- Status message changed to `"Cards added — flowchart + cloze (ModelName)"` when both saves succeed, giving the user visible confirmation

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. AnkiConnect must be running for card saves (pre-existing requirement, not new).

## Next Phase Readiness

- Phase 1 is fully complete: all 3 plans done, all 8 requirements confirmed (TMPL-01 through TMPL-06, INTG-03, INTG-04)
- Phase 2 can begin immediately: FlowGraph types, parseFlowHTML, rebuildHTML, and TableEditor cloze fix
- Key concern to carry into Phase 2: read `gapstrike/src/lib/template-defaults.ts` before implementing `parseFlowHTML()` to confirm exact nesting structure of boxes, stems, branch wrappers, and step pills in the anki_flowchart template

---
*Phase: 01-templates*
*Completed: 2026-03-09*
