# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-09)

**Core value:** AI-generated flowchart and table cards with visual editing in GapStrike, rendered as pure HTML/CSS with native Anki cloze syntax — no add-ons, works on all platforms.
**Current focus:** Phase 1 — Templates (completing TMPL-06 + INTG-03/04 validation)

## Current Position

Phase: 1 of 5 (Templates)
Plan: 3 of 3 in current phase (01-03 not yet started)
Status: In progress — 01-01 and 01-02 complete; 01-03 pending
Last activity: 2026-03-09 — Roadmap created; TMPL-01 through TMPL-05 confirmed complete from previous session

Progress: [██░░░░░░░░] ~15%

## Performance Metrics

**Velocity:**
- Total plans completed: 2
- Average duration: unknown
- Total execution time: unknown

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Templates | 2/3 | - | - |

**Recent Trend:**
- Last 5 plans: unknown
- Trend: Stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Pre-phase]: No Mermaid — replaced with pure HTML/CSS divs; Anki can't render Mermaid output
- [Pre-phase]: Delete and rebuild FlowchartEditor.tsx from scratch — existing 731-line file parses mermaid syntax, not HTML
- [Pre-phase]: Use html-react-parser + useImmerReducer + DOMParser — browser-native, zero canvas overhead
- [Pre-phase]: Define FLOWCHART_STYLES constants shared between parseFlowHTML and rebuildHTML — prevents style drift

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 2]: Before writing parseFlowHTML(), read gapstrike/src/lib/template-defaults.ts to confirm exact nesting structure of boxes, stems, branch wrappers, and step pills in the anki_flowchart template — a wrong assumption here corrupts the node tree
- [Phase 4]: INTG-03 (AnkiConnect push with HTML content) should be smoke-tested against live AnkiConnect before Phase 4 ends — confirm addNote/updateNoteFields accepts inline-style HTML without escaping issues

## Session Continuity

Last session: 2026-03-09
Stopped at: Roadmap created; ready to plan Phase 1 plan 01-03
Resume file: None
