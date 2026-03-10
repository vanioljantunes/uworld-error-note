---
phase: 07-reducer-bug-fixes-and-flowview-data-flow
verified: 2026-03-10T08:50:00Z
status: human_needed
score: 4/4 must-haves verified (automated)
human_verification:
  - test: "BUG-03: Inline step-label input — Escape aborts edge creation"
    expected: "After clicking Connect, selecting source and target nodes, pressing Escape in the inline input produces NO new edge in the flowchart"
    why_human: "React state behavior under keyboard events cannot be verified by static analysis or unit tests; requires a running browser session"
  - test: "BUG-03: Enter with text commits labeled edge"
    expected: "Typing a label and pressing Enter creates an edge with that label between the two selected nodes"
    why_human: "End-to-end render + interaction test; no Playwright/Cypress suite exists for this component"
  - test: "BUG-03: Enter with empty text creates unlabeled edge"
    expected: "Pressing Enter with an empty StepLabelInput creates an edge with stepLabel='' (unlabeled arrow)"
    why_human: "Same as above — requires browser interaction"
  - test: "BUG-04: Back field preserved after clicking Flowchart"
    expected: "After selecting a card and clicking the Flowchart format button, the Back field still shows the original extraction text — not HTML and not empty"
    why_human: "Depends on async React state batching and rAF timing; cannot be verified statically"
  - test: "BUG-04: Back field preserved after clicking Table then switching back to Cloze"
    expected: "After a full round-trip (cloze -> flowchart -> table -> cloze), the Back field is unchanged throughout"
    why_human: "Multi-step async interaction with mode cache; requires manual observation in a running app"
---

# Phase 7: Reducer Bug Fixes and FlowView Data-Flow — Verification Report

**Phase Goal:** All add/remove/reconnect operations in Edit mode complete without crashes or silent data corruption; the Back field always shows the original extraction text after flowchart generation
**Verified:** 2026-03-10T08:50:00Z
**Status:** human_needed (all automated checks pass; 5 human-only items remain)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Removing a branch-parent node reconnects all its children to the branch parent's parent | VERIFIED | `flowReducer.test.ts` lines 22-53: test "reconnects ALL children to grandparent" passes; reducer `REMOVE_NODE` case lines 165-219 in `FlowchartEditor.tsx` implements outEdge collection + grandparent redirect |
| 2 | Removing a branch-child node updates branchGroup.childIds without dropping other siblings | VERIFIED | `flowReducer.test.ts` lines 84-112: test "removes child from branchGroup.childIds; remaining siblings stay connected" passes |
| 3 | Removing a branch-child that leaves 1 remaining child collapses the branchGroup | VERIFIED | `flowReducer.test.ts` lines 114-138: test "collapses branchGroup when only 1 child remains" passes |
| 4 | ADD_NODE with selectedNodeId creates edge from selected parent to new node | VERIFIED | `flowReducer.test.ts` lines 167-190: test "creates edge from selectedNodeId to new node" passes |
| 5 | ADD_NODE with no selectedNodeId creates a standalone disconnected node | VERIFIED | `flowReducer.test.ts` lines 192-211: test "creates standalone node (no edge) when selectedNodeId is null" passes |
| 6 | After ADD_NODE the new node is auto-selected | VERIFIED | `flowReducer.test.ts` lines 189, 210: both ADD_NODE tests assert `next.selectedNodeId === newNode.id` |
| 7 | Pressing Escape during step-label input aborts the connection — no new edge created | HUMAN NEEDED | `StepLabelInput` component exists at line 448-472 with `onKeyDown` Escape handler calling `onAbort()`; pendingEdge pattern correctly defers dispatch; but Escape behavior in a running browser requires human confirmation |
| 8 | Pressing Enter with empty text creates an unlabeled arrow | HUMAN NEEDED | `onCommit(value)` called on Enter where `value` can be `""`; logic correct in code but requires browser verification |
| 9 | After clicking Flowchart or Table, the Back field still shows original extraction text | HUMAN NEEDED | `ankiBackRef.current.innerHTML = card.back` added at line 1865 in `FlowView.tsx` via `requestAnimationFrame`; `handleSwitchEditor` confirmed to have zero `setEditBack` calls; only 3 `setEditBack` call sites exist (declaration, card selection, onInput); runtime timing requires human confirmation |

**Automated Score:** 6/6 programmatically verifiable truths confirmed
**Human verification required:** 3 truths (BUG-03 runtime behavior, BUG-04 async timing)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `gapstrike/src/lib/flowReducer.test.ts` | Unit tests for REMOVE_NODE and ADD_NODE reducer cases (min 80 lines) | VERIFIED | 239 lines; 8 targeted TDD tests covering all branch-parent, branch-child, and ADD_NODE scenarios; imports `flowReducer` and `FLOW_INITIAL_STATE` from `@/components/FlowchartEditor` |
| `gapstrike/src/components/FlowchartEditor.tsx` | Fixed flowReducer with branch-aware REMOVE_NODE and selectedNodeId-based ADD_NODE; exports `flowReducer`, `FLOW_INITIAL_STATE` | VERIFIED | 758 lines; exports present at lines 91 and 104; `StepLabelInput` component present at line 448; `pendingEdge` state at line 483; `window.prompt` absent |
| `gapstrike/src/components/FlowchartEditor.module.css` | CSS for `.stepLabelInput` inline input | VERIFIED | `.stepLabelInput` class present at line 316; width 220px, accent focus ring, border-radius 4px — matches spec |
| `gapstrike/src/components/FlowView.tsx` | Synchronous ankiBackRef init in card selection handler | VERIFIED | `ankiBackRef.current.innerHTML = card.back` present at line 1865 inside `requestAnimationFrame`; `handleSwitchEditor` (lines 1153-1205) contains zero `setEditBack` calls |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `gapstrike/src/lib/flowReducer.test.ts` | `gapstrike/src/components/FlowchartEditor.tsx` | `import { flowReducer, FLOW_INITIAL_STATE }` | WIRED | Line 3 of test file: `import { flowReducer, FLOW_INITIAL_STATE } from "@/components/FlowchartEditor"` — import confirmed, all 8 tests exercise the reducer |
| `gapstrike/src/components/FlowchartEditor.tsx` | pendingEdge state | `handleConnectClick sets pendingEdge instead of window.prompt` | WIRED | Line 514: `setPendingEdge({ fromId: connectingFromId, toId: nodeId })` inside `handleConnectClick` else-branch; `window.prompt` entirely absent from file |
| `gapstrike/src/components/FlowView.tsx` | `ankiBackRef` | Direct ref assignment in card selection click handler | WIRED | Lines 1863-1866: `requestAnimationFrame(() => { if (ankiBackRef.current) ankiBackRef.current.innerHTML = card.back; })` — pattern matches spec exactly |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BUG-01 | 07-01-PLAN.md | REMOVE_NODE correctly reconnects edges when removing a node with a branch parent | SATISFIED | 5 tests in `flowReducer.test.ts` covering all branch-parent and branch-child REMOVE_NODE cases; reducer implementation verified in `FlowchartEditor.tsx` lines 165-219 |
| BUG-02 | 07-01-PLAN.md | ADD_NODE leaf detection works on disconnected graphs | SATISFIED | 3 tests in `flowReducer.test.ts` covering selectedNodeId parent model; reducer uses `draft.selectedNodeId` directly, no leaf-detection logic |
| BUG-03 | 07-02-PLAN.md | Cancelling the step label prompt does not create empty-label edges | SATISFIED (pending human) | `StepLabelInput` component with Escape handler; `pendingEdge` state defers ADD_EDGE dispatch; `window.prompt` removed entirely |
| BUG-04 | 07-02-PLAN.md | Back field displays correct content after flowchart/table generation | SATISFIED (pending human) | Synchronous rAF ref init added; `handleSwitchEditor` has zero `setEditBack` calls (confirmed at lines 1153-1205); only 3 `setEditBack` call sites |

**Note on REQUIREMENTS.md status:** `BUG-03` and `BUG-04` are marked `[x]` (Complete) in `REQUIREMENTS.md` but listed as `[ ]` (Pending) under the Bug Fixes section. This is a documentation inconsistency — the traceability table at the bottom correctly marks both as Complete for Phase 7. The code evidence supports completion pending human runtime confirmation.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No TODO/FIXME/placeholder comments, empty implementations, or stub patterns found in the phase-modified files (`FlowchartEditor.tsx`, `FlowchartEditor.module.css`, `FlowView.tsx`, `flowReducer.test.ts`, `flow-editor-mutations.test.ts`).

---

### Human Verification Required

#### 1. BUG-03: Escape aborts edge creation

**Test:** Start dev server (`cd gapstrike && npm run dev`). Open a card with a flowchart, click Edit mode. Click "Connect", click a source node, then click a target node. When the inline input appears, press Escape.
**Expected:** No new edge is created. The flowchart is unchanged.
**Why human:** React keyboard event handling and component unmounting behavior cannot be verified by static analysis.

#### 2. BUG-03: Enter with text creates labeled edge

**Test:** Same setup as above. Type a label (e.g., "activates") and press Enter.
**Expected:** A new edge with the label "activates" appears between the two selected nodes.
**Why human:** End-to-end rendering and dispatch verification requires a running browser.

#### 3. BUG-03: Enter with empty input creates unlabeled edge

**Test:** Same setup. Leave the input empty and press Enter.
**Expected:** An unlabeled edge (arrow without pill text) is created between the nodes.
**Why human:** Same as above.

#### 4. BUG-04: Back field preserved after Flowchart mode switch

**Test:** Select a cloze card that has Back field content. Click "Flowchart" to format.
**Expected:** The Back field still shows the original extraction text — not HTML, not empty.
**Why human:** Depends on React state batching + requestAnimationFrame timing across async operations; cannot be verified statically.

#### 5. BUG-04: Back field preserved through full mode round-trip

**Test:** Select a card. Switch: Cloze -> Flowchart -> Table -> Cloze.
**Expected:** Back field is unchanged at every step.
**Why human:** Multi-step async interaction with the `modeContentRef` cache; requires manual observation.

---

### Summary

All automated verification targets are confirmed. The phase delivered:

- **BUG-01 (REMOVE_NODE branch reconnect):** Fully implemented and tested. The reducer correctly collects outgoing edges before deletion, redirects the branchGroup's `parentId` to the grandparent, and collapses the group when fewer than 2 children remain.
- **BUG-02 (ADD_NODE selectedNodeId model):** Fully implemented and tested. The reducer reads `draft.selectedNodeId` directly as the parent — no leaf-detection — and auto-selects the new node.
- **BUG-03 (inline StepLabelInput):** Code is complete and correct. `window.prompt` is entirely absent. `StepLabelInput` handles Enter/Escape/blur correctly. Runtime behavior requires human confirmation.
- **BUG-04 (Back field preservation):** Code change is in place. `handleSwitchEditor` has zero `setEditBack` calls. The synchronous rAF ref init guarantees freshness. Async timing behavior under real usage requires human confirmation.

The full test suite runs clean: 87 tests pass across 8 test files with no regressions.

---

_Verified: 2026-03-10T08:50:00Z_
_Verifier: Claude (gsd-verifier)_
