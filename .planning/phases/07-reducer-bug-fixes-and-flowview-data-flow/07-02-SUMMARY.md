---
phase: 07-reducer-bug-fixes-and-flowview-data-flow
plan: 02
subsystem: ui
tags: [react, flowchart, contenteditable, state-management]

# Dependency graph
requires:
  - phase: 06-mode-simplification-and-layout
    provides: stable edit-mode baseline for bug isolation
provides:
  - Inline StepLabelInput component replacing window.prompt for edge creation
  - BUG-03 fix: Escape-to-abort in step-label entry, no unwanted empty edges
  - BUG-04 fix: Back field preserved after flowchart/table mode switch
  - Test suite updated for selectedNodeId ADD_NODE model
affects: [08-ai-template, future FlowchartEditor feature work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "pendingEdge state pattern: defer ADD_EDGE dispatch until inline input resolves"
    - "Belt-and-suspenders ref init: synchronous rAF in click handler alongside useEffect sync"

key-files:
  created: []
  modified:
    - gapstrike/src/components/FlowchartEditor.tsx
    - gapstrike/src/components/FlowchartEditor.module.css
    - gapstrike/src/components/FlowView.tsx
    - gapstrike/tests/flow-editor-mutations.test.ts

key-decisions:
  - "BUG-03: Used pendingEdge state + StepLabelInput instead of window.prompt to allow Escape-to-abort"
  - "BUG-04: Added synchronous requestAnimationFrame in click handler so Back ref is never stale on mode switch"
  - "Test fix: Updated ADD_NODE tests to use selectedNodeId='leaf' to match new selectedNodeId parent model introduced by linter"

patterns-established:
  - "Inline input with onCommit/onAbort: Enter commits, Escape aborts, blur aborts"
  - "Synchronous rAF in event handler: use card.back directly (not state closure) to init contentEditable ref"

requirements-completed: [BUG-03, BUG-04]

# Metrics
duration: 12min
completed: 2026-03-10
---

# Phase 7 Plan 02: BUG-03 and BUG-04 Summary

**Inline StepLabelInput replaces window.prompt for edge creation (Escape-to-abort), and Back field preserved after flowchart/table mode switch via synchronous ref init**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-03-10T08:35:00Z
- **Completed:** 2026-03-10T08:42:00Z
- **Tasks:** 2 of 2 auto tasks complete (Task 3 is checkpoint:human-verify)
- **Files modified:** 4

## Accomplishments
- Removed `window.prompt` from FlowchartEditor; replaced with inline `StepLabelInput` component (Enter commits, Escape aborts, blur aborts)
- Added `pendingEdge` state so the second connect-click defers ADD_EDGE dispatch until label input resolves
- Added `requestAnimationFrame` in card selection handler to directly set `ankiBackRef.current.innerHTML = card.back` — ensures Back field is never stale after mode switch
- Confirmed `handleSwitchEditor` has zero `setEditBack` calls (no incorrect overwrites)
- Fixed 2 test regressions caused by linter applying BUG-01/BUG-02 reducer changes (selectedNodeId ADD_NODE model)

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace window.prompt with inline StepLabelInput (BUG-03)** - `f6ede5f` (feat)
2. **Task 2: Fix Back field preservation after mode switch (BUG-04)** - `1872f1e` (fix)
3. **Deviation auto-fix: Update tests for selectedNodeId ADD_NODE model** - `2b72912` (fix)

## Files Created/Modified
- `gapstrike/src/components/FlowchartEditor.tsx` - Added StepLabelInput component, pendingEdge state, modified handleConnectClick; also received linter-applied BUG-01/BUG-02 reducer changes
- `gapstrike/src/components/FlowchartEditor.module.css` - Added .stepLabelInput styles (220px, accent focus ring)
- `gapstrike/src/components/FlowView.tsx` - Added synchronous rAF in card selection handler to init ankiBackRef
- `gapstrike/tests/flow-editor-mutations.test.ts` - Updated 2 ADD_NODE tests to use selectedNodeId parent model

## Decisions Made
- Used `pendingEdge` state (not a ref) so React re-renders cleanly show/hide StepLabelInput
- `onBlur` on StepLabelInput calls `onAbort()` (same as Escape) — clicking away cancels the label entry
- Belt-and-suspenders: synchronous rAF in click handler captures `card.back` from the closure (not editBack state) to guarantee freshness

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated two tests that regressed due to linter-applied reducer changes**
- **Found during:** Task 2 verification (vitest run after BUG-04 fix)
- **Issue:** Linter applied BUG-01/BUG-02 reducer changes to FlowchartEditor.tsx (REMOVE_NODE branch reconnect, ADD_NODE selectedNodeId model). Two tests in `flow-editor-mutations.test.ts` expected the old leaf-detection ADD_NODE behavior and failed.
- **Fix:** Updated "appends to end" test to set `selectedNodeId: "n1"` (the leaf) before ADD_NODE; updated "produces HTML after ADD_NODE" test to set `selectedNodeId: "n2"` so the new node is connected and renderable
- **Files modified:** gapstrike/tests/flow-editor-mutations.test.ts
- **Verification:** All 87 tests pass
- **Committed in:** 2b72912

---

**Total deviations:** 1 auto-fixed (Rule 1 - test regression from linter-applied changes)
**Impact on plan:** Auto-fix was necessary for correctness. No scope creep — tests now match the intended selectedNodeId parent model.

## Issues Encountered
- Linter silently applied BUG-01/BUG-02 reducer changes from a previous plan during Task 2. The `src/lib/flowReducer.test.ts` tests (which were previously failing as TDD red) now pass, but 2 old tests in `tests/flow-editor-mutations.test.ts` regressed. Fixed inline.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- BUG-03 and BUG-04 ready for human verification (Task 3: checkpoint:human-verify)
- After approval: Phase 7 complete, ready for Phase 8 (AI template)
- Concern from STATE.md: BUG-04 root cause (editBack in handleSwitchEditor) was not confirmed before planning — confirmed during execution that handleSwitchEditor has 0 setEditBack calls (concern resolved)

---
*Phase: 07-reducer-bug-fixes-and-flowview-data-flow*
*Completed: 2026-03-10*
