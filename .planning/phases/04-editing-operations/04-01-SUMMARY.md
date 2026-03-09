---
phase: 04-editing-operations
plan: "01"
subsystem: FlowchartEditor
tags: [tdd, reducer, immer, flowchart, mutations, onChange]
dependency_graph:
  requires:
    - gapstrike/src/lib/flowchart-types.ts
    - gapstrike/src/lib/rebuild-flow-html.ts
    - gapstrike/src/lib/parse-flow-html.ts
  provides:
    - flowReducer (named export for unit tests)
    - FlowchartEditor mutation pipeline (EDIT_NODE, ADD_NODE, REMOVE_NODE, ADD_EDGE, REMOVE_EDGE, REORDER_NODE)
    - onChange wiring via useEffect guarded by hasUserEdited
  affects:
    - gapstrike/src/components/FlowchartEditor.tsx
    - gapstrike/tests/flow-editor-mutations.test.ts
tech_stack:
  added: []
  patterns:
    - immer useImmerReducer with exported pure reducer for testing
    - hasUserEdited flag to prevent onChange infinite loop on LOAD
    - monotonic nodeCounter to prevent ID collision after remove+add
    - swap-labels strategy for REORDER_NODE (IDs and edges unchanged)
key_files:
  created:
    - gapstrike/tests/flow-editor-mutations.test.ts
  modified:
    - gapstrike/src/components/FlowchartEditor.tsx
decisions:
  - Export flowReducer as named export to enable pure function unit testing without React render overhead
  - hasUserEdited boolean in FlowState gates onChange call in useEffect — LOAD resets it to false, preventing LOAD->onChange->value->LOAD infinite loop
  - nodeCounter in FlowState is monotonic (only increments on ADD_NODE) — prevents ID collision after REMOVE_NODE+ADD_NODE sequences
  - REORDER_NODE swaps labels not positions — IDs and edges stay intact, visual reorder effect achieved without edge surgery
metrics:
  duration_minutes: 3
  completed_date: "2026-03-09"
  tasks_completed: 1
  files_changed: 2
---

# Phase 4 Plan 1: FlowchartEditor Reducer Mutations + onChange Wiring Summary

**One-liner:** Six FlowGraph mutation reducer actions (EDIT_NODE, ADD_NODE, REMOVE_NODE, ADD_EDGE, REMOVE_EDGE, REORDER_NODE) implemented with immer and wired to onChange via hasUserEdited-guarded useEffect.

## What Was Built

Extended `FlowchartEditor.tsx` from a read-only viewer (LOAD + TOGGLE_VIEW only) to a full mutation pipeline. The reducer now handles all 6 editing actions, a monotonic nodeCounter prevents ID collisions after remove+add cycles, and the `onChange` callback fires only on user mutations (not on LOAD) via the `hasUserEdited` guard.

A comprehensive unit test suite (`flow-editor-mutations.test.ts`, 35 tests) validates all reducer cases as pure functions — no React DOM overhead — using immer's `produce` to apply actions to fixture states.

## Tasks Completed

| Task | Type | Description | Commit | Files |
|------|------|-------------|--------|-------|
| 1 (RED) | test | Failing tests for all 6 mutation actions + LOAD reset + rebuildHTML integration | 726d5e0 | flow-editor-mutations.test.ts |
| 1 (GREEN) | feat | Full reducer implementation + export + useEffect onChange wiring | 502e6f6 | FlowchartEditor.tsx |

## Verification Results

```
Tests: 73 passed (73 total across 5 test files)
TypeScript: 0 errors
Duration: ~3 minutes
```

All existing tests (flow-round-trip, flowchart-editor-smoke, table-cloze, flow-table-intg) remain green.

## Decisions Made

1. **Export flowReducer as named export** — enables pure function unit testing without React render overhead. Tests import `flowReducer` directly and apply it via immer's `produce`.

2. **hasUserEdited flag prevents onChange infinite loop** — LOAD action resets `hasUserEdited` to `false`. The `useEffect` only calls `onChange(rebuildHTML(state.graph))` when `hasUserEdited === true`. This breaks the `value → parseFlowHTML → graph → rebuildHTML → onChange → value → LOAD` cycle.

3. **Monotonic nodeCounter** — initialized to `graph.nodes.length` on LOAD, incremented only on ADD_NODE, never decremented. Prevents `"n" + nodes.length` from colliding with existing IDs after a REMOVE_NODE+ADD_NODE sequence.

4. **REORDER_NODE swaps labels, not positions** — swapping node positions in the array would not affect rendered order (rebuildHTML walks from root via edges). Swapping labels achieves the visual reorder effect while keeping IDs and edge references intact.

## Deviations from Plan

None — plan executed exactly as written. The implementation matches the patterns from 04-RESEARCH.md exactly.

## Self-Check: PASSED

- `gapstrike/tests/flow-editor-mutations.test.ts` — FOUND
- `gapstrike/src/components/FlowchartEditor.tsx` — FOUND (contains "EDIT_NODE")
- Commit 726d5e0 (RED) — FOUND
- Commit 502e6f6 (GREEN) — FOUND
- 73/73 vitest tests pass
- TypeScript clean
