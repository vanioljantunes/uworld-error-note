---
phase: 02-data-model-and-parse-serialize-pipeline
plan: 02
subsystem: gapstrike/flowchart-pipeline
tags: [tdd, parse, serialize, flowgraph, anki, cloze, vitest, jsdom]

dependency_graph:
  requires:
    - phase: 02-01
      provides: FlowGraph types (FlowNode, FlowEdge, BranchGroup), FLOWCHART_STYLES constants, vitest+jsdom infrastructure
  provides:
    - rebuildHTML function that serializes FlowGraph back to compact inline-style Anki HTML
    - parseFlowHTML function that parses Anki flowchart HTML into FlowGraph
    - Round-trip test suite: parse -> rebuild -> re-parse equality for both linear and branching fixtures
  affects:
    - Phase 3 FlowchartEditor (uses rebuildHTML to persist edits back to Anki)
    - Phase 4 editing operations (full bidirectional pipeline available)

tech-stack:
  added: []
  patterns:
    - "TDD red-green: test import of non-existent module first, then implement to pass"
    - "No newlines in Anki HTML: string concatenation uses empty join — AnkiDroid converts \\n to <br>"
    - "Recursive emitNode walk: root-finding via toId set, branch map for inline-flex groups"
    - "textContent not innerHTML for cloze preservation: {{c1::text}} is plain text in the DOM"

key-files:
  created:
    - gapstrike/src/lib/parse-flow-html.ts
    - gapstrike/src/lib/rebuild-flow-html.ts
    - gapstrike/tests/flow-round-trip.test.ts
  modified:
    - gapstrike/vitest.config.ts

key-decisions:
  - "rebuildHTML walks graph from root (node not appearing as any toId) using recursive emitNode"
  - "Branch detection via branchMap (parentId -> childIds[]) built from branchGroups before walk"
  - "3-child middle branch corner: border-top only, no left/right, no margin (stretch case, commented)"
  - "emitStem() wraps inner stem div in unstyled outer div — matches exact template nesting"

patterns-established:
  - "Root-finding: filter nodes by toId set absence — any node not pointed to by an edge is root"
  - "Corner styles: first child = branchCornerLeft, last child = branchCornerRight, middle = top-only"
  - "Edge lookup per branch: graph.edges.find(e => e.fromId === parentId && e.toId === childId)"

requirements-completed: [FLOW-09]

duration: 15min
completed: "2026-03-09"
---

# Phase 02 Plan 02: rebuildHTML Serializer and Round-Trip Tests Summary

**rebuildHTML serializer that converts FlowGraph back to compact inline-style Anki HTML with no newlines, plus parse-rebuild round-trip tests confirming bidirectional fidelity for linear and branching fixtures.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-09T22:13:22Z
- **Completed:** 2026-03-09T22:30:00Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 4

## Accomplishments

- Implemented `parseFlowHTML` (DOMParser-based walker extracting nodes, edges, branchGroups from Anki inline-style HTML)
- Implemented `rebuildHTML` (FlowGraph -> compact HTML serializer with recursive `emitNode` walk)
- Added 5 round-trip tests plus 8 parse-only tests — all 13 pass
- Cloze syntax `{{c1::text}}` and `{{c2::term::hint}}` survive full round-trip verbatim

## Task Commits

Each task was committed atomically (TDD had multiple commits):

1. **Task 1 RED: Add failing round-trip tests** - `6c500cd` (test)
2. **Task 1 GREEN: Implement rebuildHTML + parseFlowHTML** - `3bab25f` (feat)

## Files Created/Modified

- `gapstrike/src/lib/parse-flow-html.ts` — DOMParser-based HTML walker: identifies element roles by style substrings, walks flat sibling sequence for linear nodes/edges, handles inline-flex branch groups recursively
- `gapstrike/src/lib/rebuild-flow-html.ts` — FlowGraph serializer: finds root node via toId exclusion, walks recursively via `emitNode`, emits box/stem/pill/branch divs with no newlines
- `gapstrike/tests/flow-round-trip.test.ts` — 13 tests: 8 parse-only (linear 4-box, branching 2-child, cloze survival) + 5 round-trip (linear equality, branching equality, no newlines, no style blocks, cloze verbatim)
- `gapstrike/vitest.config.ts` — Added path alias `@` -> `./src` for clean test imports

## Decisions Made

- `rebuildHTML` finds root by building the set of all `toId` values — any node not in that set is the root. This handles both linear and branching graphs correctly.
- Branch corner styles: first child gets `FLOWCHART_STYLES.branchCornerLeft` (margin-left:50% + border-left), last gets `branchCornerRight` (margin-right:50% + border-right), middle children (3+ branch case) get `border-top:2px solid #3a3a3a` only with a comment marking it as a stretch case.
- `emitStem()` wraps inner stem in an outer unstyled div — this matches the exact nesting from the AI template (`<div><div style="width:2px..."></div></div>`), which the parser expects when detecting `stemWrap` role.
- Parser uses `textContent` (not `innerHTML`) for box label extraction — cloze syntax like `{{c1::Thiamine deficiency}}` is plain text in the DOM, not HTML markup, so textContent returns it verbatim.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] parseFlowHTML prerequisite was missing**
- **Found during:** Task 1 pre-check (Plan 01 had not been executed)
- **Issue:** `gapstrike/src/lib/parse-flow-html.ts` did not exist; `gapstrike/tests/flow-round-trip.test.ts` was absent; Plan 02 depends on Plan 01 artifacts
- **Fix:** Implemented `parseFlowHTML` as part of this plan's execution scope, using the Plan 01 spec and existing type/style files (which were present from a prior partial execution)
- **Files modified:** gapstrike/src/lib/parse-flow-html.ts (created)
- **Verification:** All 8 parse-only tests pass; DOMParser correctly extracts 4 nodes/3 edges from FIXTURE_LINEAR and 1 branchGroup from FIXTURE_BRANCHING
- **Committed in:** 3bab25f (bundled with GREEN implementation commit)

---

**Total deviations:** 1 auto-fixed (1 blocking prerequisite)
**Impact on plan:** Required scope expansion was minimal — the parser spec was fully defined in Plan 01's action block. No architectural changes.

## Issues Encountered

None — plan executed smoothly after handling the missing prerequisite. The linter auto-improved the initial parse-flow-html.ts implementation (added JSDoc, better variable scoping) without changing behavior.

## Self-Check: PASSED

Files created/modified:
- gapstrike/src/lib/rebuild-flow-html.ts — FOUND
- gapstrike/src/lib/parse-flow-html.ts — FOUND
- gapstrike/tests/flow-round-trip.test.ts — FOUND
- gapstrike/vitest.config.ts — FOUND

Commits:
- 6c500cd (test RED) — FOUND
- 3bab25f (feat GREEN) — FOUND

Test verification: `cd gapstrike && npx vitest run` — 17 passed (2 test files, 0 failures)

## Next Phase Readiness

- Bidirectional pipeline complete: `parseFlowHTML` + `rebuildHTML` work together
- Phase 3 FlowchartEditor can import both functions to read and write Anki card HTML
- Phase 4 editing operations have a stable round-trip to test against
- No blockers

---
*Phase: 02-data-model-and-parse-serialize-pipeline*
*Completed: 2026-03-09*
