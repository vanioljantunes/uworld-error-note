---
phase: 07-reducer-bug-fixes-and-flowview-data-flow
plan: 01
subsystem: ui
tags: [react, immer, vitest, flowchart, reducer, tdd]

# Dependency graph
requires: []
provides:
  - "Branch-aware REMOVE_NODE that reconnects all children to grandparent"
  - "Branch-child removal that updates childIds and collapses single-child branchGroups"
  - "ADD_NODE selectedNodeId parent model with auto-selection of new node"
  - "flowReducer.test.ts with 8 targeted TDD tests for BUG-01 and BUG-02"
affects:
  - 07-02-flowview-data-flow
  - future flowchart editing phases

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD with immer produce() helper: runAction(state, action) wraps produce(state, draft => flowReducer(draft, action))"
    - "Branch-parent removal: collect outEdges before deletion, redirect branchGroup.parentId to grandparent"
    - "Branch-child removal: iterate branchGroups in reverse with splice for safe in-place removal"

key-files:
  created:
    - gapstrike/src/lib/flowReducer.test.ts
  modified:
    - gapstrike/src/components/FlowchartEditor.tsx

key-decisions:
  - "ADD_NODE uses draft.selectedNodeId as parent (not leaf detection) — null selectedNodeId creates standalone node"
  - "ADD_NODE auto-selects new node (draft.selectedNodeId = newId) after creation"
  - "REMOVE_NODE collects ALL outEdges before deletion and reconnects each to grandparent (supports multi-child branches)"
  - "branchGroup collapse threshold: < 2 children remaining collapses the group (1 or 0 children not a real branch)"

patterns-established:
  - "Reverse iteration with splice for safe in-place branchGroups array modification"
  - "outEdges collected before edge filter to preserve stepLabel on reconnect"

requirements-completed: [BUG-01, BUG-02]

# Metrics
duration: 7min
completed: 2026-03-10
---

# Phase 7 Plan 01: Reducer Bug Fixes (BUG-01, BUG-02) Summary

**Branch-aware REMOVE_NODE reconnects all children to grandparent; ADD_NODE uses selectedNodeId as parent model with auto-selection of new node**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-10T11:36:14Z
- **Completed:** 2026-03-10T11:43:00Z
- **Tasks:** 1 (TDD — RED + GREEN)
- **Files modified:** 2

## Accomplishments

- Fixed REMOVE_NODE to collect ALL outgoing edges before deletion and reconnect each child to grandparent (BUG-01 multi-child branch reconnect)
- Fixed REMOVE_NODE branch-child path to update childIds and collapse branchGroup when < 2 children remain (BUG-01 branch-child update)
- Fixed ADD_NODE to use `draft.selectedNodeId` as parent instead of broken leaf-detection logic, auto-selects new node (BUG-02)
- Created `flowReducer.test.ts` with 8 TDD tests covering all branch-parent, branch-child, and ADD_NODE scenarios; all 87 total tests pass

## Task Commits

1. **RED phase: failing tests** - `8470bea` (test)
2. **GREEN phase: reducer fix + test update** - `2b72912` (fix, applied via linter/formatter session)

## Files Created/Modified

- `gapstrike/src/lib/flowReducer.test.ts` — 8 TDD tests for REMOVE_NODE branch-parent/child and ADD_NODE selectedNodeId model
- `gapstrike/src/components/FlowchartEditor.tsx` — REMOVE_NODE and ADD_NODE cases rewritten with correct branch-aware logic

## Decisions Made

- ADD_NODE no longer appends to last leaf — old behavior silently created wrong edges on disconnected/cyclic graphs. New model: selectedNodeId is set by UI before dispatch, reducer reads it directly.
- ADD_NODE auto-selects the new node so the user can immediately chain another Add Box click.
- branchGroup collapse uses `< 2` threshold: 1 remaining child is not a branch, group is removed.
- branchGroup.parentId redirected to grandparent (not deleted) when branch-parent removed with inEdge — preserves branch layout for grandparent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing tests expected old leaf-append ADD_NODE behavior**
- **Found during:** Task 1 GREEN phase (full test suite run)
- **Issue:** Two tests in `flow-editor-mutations.test.ts` asserted the old buggy leaf-detection behavior that BUG-02 fix intentionally removes
- **Fix:** Tests updated to use `selectedNodeId` as parent (matching new design), and the "rebuildHTML after ADD_NODE" test updated to reflect that standalone nodes are not traversed by rebuildHTML without edges
- **Files modified:** `gapstrike/tests/flow-editor-mutations.test.ts`
- **Verification:** All 87 tests pass after update
- **Committed in:** `2b72912` (GREEN phase commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — existing tests encoded the old buggy behavior)
**Impact on plan:** Necessary correctness fix — tests were guarding the bug, not the intent.

## Issues Encountered

None — reducer fix was straightforward. Full test suite (87 tests) passes with no regressions.

## Next Phase Readiness

- BUG-01 and BUG-02 are resolved; flowReducer is correct on branching graphs and disconnected topologies
- BUG-03 (inline step label input) and BUG-04 (Back field preservation) are addressed in plan 07-02
- All tests green — safe baseline for Phase 8 (AI template)

---
*Phase: 07-reducer-bug-fixes-and-flowview-data-flow*
*Completed: 2026-03-10*
