---
phase: 03-visual-rendering
plan: 01
subsystem: ui
tags: [react, flowchart, immer, use-immer, html-react-parser, css-modules, vitest, cloze]

# Dependency graph
requires:
  - phase: 02-data-model-and-parse-serialize-pipeline
    provides: FlowGraph data model, parseFlowHTML, rebuildHTML, FLOWCHART_STYLES constants

provides:
  - FlowchartEditor default export: renders AI-generated HTML as visual FlowGraph components
  - FlowchartPreview named export: dangerouslySetInnerHTML read-only view
  - highlightCloze named export: wraps {{cN::}} markers with accent spans
  - FlowchartEditor.module.css: dark-themed CSS Module (dot-grid background, hover effects)
  - Smoke tests verifying FLOW-01 data flow and FLOW-08 cloze preservation

affects: [04-integration, FlowView.tsx]

# Tech tracking
tech-stack:
  added: [immer, use-immer, html-react-parser]
  patterns:
    - useImmerReducer with typed FlowState and FlowAction union for predictable editor state
    - Recursive renderNode with visited Set for cycle-safe FlowGraph traversal
    - Named export highlightCloze: pure function splitting on cloze regex for testability

key-files:
  created:
    - gapstrike/src/components/FlowchartEditor.module.css
    - gapstrike/tests/flowchart-editor-smoke.test.ts
  modified:
    - gapstrike/src/components/FlowchartEditor.tsx
    - gapstrike/package.json

key-decisions:
  - "FlowchartPreview uses dangerouslySetInnerHTML — Anki card preview matches exact Anki output (no re-rendering artifacts)"
  - "highlightCloze exported as named export to enable unit testing without React render overhead"
  - "useImmerReducer typed explicitly as FlowState/FlowAction to avoid TS literal inference narrowing bug"
  - "EdgePill returns null for empty labels — avoids phantom pill elements in chains without step labels"

patterns-established:
  - "FlowRenderer: recursive renderNode with visited Set — prevents infinite loops on cyclic graph data"
  - "Branch corners: branchCornerLeft/Right/Middle CSS classes — CSS only, no JS position math"

requirements-completed: [FLOW-01, FLOW-08]

# Metrics
duration: 25min
completed: 2026-03-09
---

# Phase 03 Plan 01: FlowchartEditor Visual Component Summary

**Rewrote 730-line Mermaid-based FlowchartEditor to render AI-generated flowchart HTML as typed React components (NodeCard, EdgePill, branch arms) using the Phase 2 FlowGraph data model with useImmerReducer and dark-themed CSS Module**

## Performance

- **Duration:** 25 min
- **Started:** 2026-03-09T22:34:00Z
- **Completed:** 2026-03-09T22:58:44Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Replaced the entire Mermaid-based FlowchartEditor (730 lines) with a clean FlowGraph-based implementation
- FlowchartEditor renders visual boxes/arrows/pills from parsed HTML via recursive FlowRenderer; FlowchartPreview renders raw HTML for Anki-exact output
- highlightCloze splits cloze markers verbatim with accent highlights — FLOW-08 verified via smoke tests
- All 21 vitest tests pass (4 smoke + 13 round-trip + 4 table-cloze); Next.js production build succeeds

## Task Commits

Each task was committed atomically:

1. **Task 1: Install deps, create CSS Module** - `764a48e` (feat)
2. **Task 2: Rewrite FlowchartEditor.tsx** - `d3b1f26` (feat)
3. **Task 3: Smoke tests for FLOW-01 and FLOW-08** - `e7357eb` (test)

## Files Created/Modified
- `gapstrike/src/components/FlowchartEditor.tsx` - Complete rewrite: FlowchartEditor default, FlowchartPreview named, highlightCloze named exports
- `gapstrike/src/components/FlowchartEditor.module.css` - Dark-themed CSS Module with dot-grid background, nodeCard hover lift, branch corner classes
- `gapstrike/tests/flowchart-editor-smoke.test.ts` - 4 smoke tests verifying FLOW-01 data flow and FLOW-08 cloze preservation
- `gapstrike/package.json` - Added immer, use-immer, html-react-parser

## Decisions Made
- FlowchartPreview uses dangerouslySetInnerHTML — Anki card preview matches exact Anki output (no re-rendering artifacts)
- highlightCloze exported as named export to enable unit testing without React render overhead
- useImmerReducer typed explicitly with `FlowState` and `FlowAction` type parameters to avoid TypeScript literal inference narrowing bug (line 208 comparison error)
- EdgePill returns null for empty labels — avoids phantom pill elements in chains without step labels

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript literal type narrowing in useImmerReducer**
- **Found during:** Task 2 (FlowchartEditor.tsx TypeScript compile check)
- **Issue:** `useImmerReducer(reducer, { viewMode: "editor" as const })` caused TS2367 — comparison `state.viewMode === "preview"` appeared unintentional because immer inferred viewMode as literal `"editor"`
- **Fix:** Explicitly typed initial state as `const initialState: FlowState` and passed type parameters `useImmerReducer<FlowState, FlowAction>(reducer, initialState)`
- **Files modified:** gapstrike/src/components/FlowchartEditor.tsx
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** d3b1f26 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 TypeScript bug)
**Impact on plan:** Auto-fix required for TypeScript compilation. No scope creep.

## Issues Encountered
None beyond the TypeScript literal narrowing fix documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- FlowchartEditor component is ready for Phase 4 integration (AnkiConnect push)
- FlowView.tsx import `import FlowchartEditor, { FlowchartPreview } from "./FlowchartEditor"` remains valid
- All existing tests green; build passing

---
*Phase: 03-visual-rendering*
*Completed: 2026-03-09*
