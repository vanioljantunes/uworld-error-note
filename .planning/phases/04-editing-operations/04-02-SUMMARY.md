---
phase: 04-editing-operations
plan: "02"
subsystem: ui
tags: [react, flowchart, editing, interactive, css-modules, usestate, useeffect]

# Dependency graph
requires:
  - phase: 04-editing-operations
    plan: "01"
    provides: flowReducer with EDIT_NODE, ADD_NODE, REMOVE_NODE, ADD_EDGE, REMOVE_EDGE, REORDER_NODE actions
provides:
  - EditableNodeCard (click-to-edit textarea with onBlur commit)
  - Toolbar with Add Box and Connect toggle buttons
  - Connect mode two-click edge creation with window.prompt for step label
  - Node hover controls (up/down arrows + delete button)
  - FlowRendererWithConnect component wiring all interactive props
affects:
  - 04-03-table-tests
  - 04-04-human-verify

# Tech tracking
tech-stack:
  added: []
  patterns:
    - connectingFromId managed as local useState (not in reducer) for two-click UI flow
    - EditableNodeCard uses local draft state synced with useEffect when not editing
    - nodeCardWrap:hover .nodeControls CSS trick for hover-reveal controls overlay
    - FlowRendererWithConnect receives onConnectClick as prop from parent for clean separation

key-files:
  created: []
  modified:
    - gapstrike/src/components/FlowchartEditor.tsx
    - gapstrike/src/components/FlowchartEditor.module.css

key-decisions:
  - "connectingFromId and connectMode managed as local useState in FlowchartEditor, not in reducer — keeps two-click UI flow outside immer to avoid complexity"
  - "EditableNodeCard draft state synced via useEffect when isEditing becomes true — ensures textarea always starts with current node label"
  - "FlowRenderer renamed to FlowRendererWithConnect and receives onConnectClick prop — clean separation of UI interaction logic from render logic"
  - "Delete button placed in node hover overlay (not toolbar) — avoids requiring a global selection state for non-connect mode"
  - "window.prompt used for step label input — v1 adequate, custom popover is v2 polish (plan decision honored)"

patterns-established:
  - "nodeCardWrap:hover .nodeControls { display: flex } — pure CSS hover reveal for action controls overlay, no JS state needed"
  - "connectingFromId as local state, not reducer state — two-click interaction state that doesn't need to persist or serialize"

requirements-completed: [FLOW-02, FLOW-03, FLOW-04, FLOW-05, FLOW-06, FLOW-07]

# Metrics
duration: 5min
completed: 2026-03-09
---

# Phase 4 Plan 2: FlowchartEditor Interactive UI Summary

**EditableNodeCard (click-to-edit textarea), toolbar (Add Box / Connect toggle), node hover controls (up/down/delete), and connect-mode two-click edge creation wired to flowReducer actions.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-09T23:45:18Z
- **Completed:** 2026-03-09T23:50:00Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Replaced static NodeCard with EditableNodeCard: clicking a node opens a textarea with autoFocus; blur or Enter commits via EDIT_NODE dispatch; Escape reverts
- Added toolbar (below header, editor mode only) with Add Box button (dispatches ADD_NODE) and Connect toggle button (activates two-click edge creation mode)
- Implemented connect mode: first click sets source node (highlighted via nodeCardSelected), second click prompts for step label and dispatches ADD_EDGE; clicking same node cancels
- Node hover controls overlay (CSS :hover trick): up arrow (hidden if isFirst), down arrow (hidden if isLast), delete button (x) — all stop event propagation
- Added 10 new CSS classes to FlowchartEditor.module.css for all editing states

## Task Commits

1. **Task 1: EditableNodeCard + toolbar + connect mode UI** - `24faca7` (feat)

## Files Created/Modified

- `gapstrike/src/components/FlowchartEditor.tsx` - Replaced NodeCard with EditableNodeCard; added FlowRendererWithConnect; added toolbar; wired connect mode and node controls
- `gapstrike/src/components/FlowchartEditor.module.css` - Added .toolbar, .toolbarBtn, .toolbarBtnActive, .nodeCardTextarea, .nodeControls, .nodeCardWrap, .nodeControlBtn, .nodeCardSelected classes

## Decisions Made

1. **connectingFromId as local useState** — connect mode source node tracking kept outside immer reducer. It's ephemeral UI state that doesn't need to serialize or persist, and keeping it local avoids adding a new reducer action just for that.

2. **FlowRenderer renamed to FlowRendererWithConnect with onConnectClick prop** — clean separation: the parent (FlowchartEditor) owns the two-click logic and passes down a handler. FlowRendererWithConnect only needs to call it when a node is clicked in connect mode.

3. **Delete on hover overlay, not toolbar** — avoids requiring a selection concept in non-connect mode. Each node's hover controls are self-contained; the toolbar is for structural operations (add, connect).

4. **window.prompt for step label** — honored the plan's explicit decision. Custom popover deferred to v2.

## Deviations from Plan

None — plan executed exactly as written. The implementation matches the plan's patterns including `window.prompt` for step label, CSS hover trick for nodeControls, and connect mode two-click flow.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- FlowchartEditor is now fully interactive: edit labels, add/remove boxes, create connections, reorder nodes
- Ready for 04-03 (table mutation tests) and 04-04 (human visual verification of the full editing workflow)

---
*Phase: 04-editing-operations*
*Completed: 2026-03-09*

## Self-Check: PASSED

- `gapstrike/src/components/FlowchartEditor.tsx` — FOUND (contains "EditableNodeCard")
- `gapstrike/src/components/FlowchartEditor.module.css` — FOUND (contains "nodeCardTextarea")
- Commit 24faca7 — verified (feat(04-02))
- 73/73 vitest tests pass
- TypeScript: 0 errors
- Next.js build: succeeded
