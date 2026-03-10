# Phase 7: Reducer Bug Fixes and FlowView Data-Flow - Research

**Researched:** 2026-03-10
**Domain:** React/Immer reducer correctness, React controlled component state, inline UI patterns
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Prompt cancel UX (BUG-03)**
- Replace `window.prompt` with inline text input rendered on the newly drawn arrow
- Input auto-focuses immediately — user can start typing right away
- **Escape** aborts the connection entirely — no edge is created
- **Enter with empty text** creates an unlabeled arrow (plain connection, no label)
- **Enter with text** creates a labeled arrow as before

**Back field preservation (BUG-04)**
- Back field always shows the original extraction text from the cloze card
- Switching Front between cloze/flowchart/table must NEVER alter the Back field content
- Back field remains editable by the user in all editor modes (flowchart, table, cloze)
- The Back is the original text from cloze creation — it should be treated as immutable by mode-switching logic
- Root cause needs code trace: check handleSwitchEditor, modeContentRef, useEffect sync, and card creation flows

**Node removal reconnection (BUG-01)**
- When removing a node that branches into multiple children, reconnect ALL children to the removed node's parent
- Branch structure (branchGroups) must be preserved/updated — not just edges
- Handle both linear chain removal (existing behavior) and branch-parent removal (new behavior)
- Ensure branchGroups.childIds are updated when a branch member is removed

**ADD_NODE flow change (BUG-02)**
- ADD_NODE now requires a selected parent node: user selects a node first, then clicks "Add Box"
- New node is added as a child of the selected node (edge created from selected → new)
- If no node is selected when clicking Add Box, create a standalone disconnected node (no edge)
- Remove the old "append to last leaf" logic — it fails on disconnected/cyclic graphs

### Claude's Discretion
- Inline input styling and positioning on arrow (exact CSS)
- REMOVE_NODE reconnection algorithm details (edge iteration, branchGroup updates)
- ADD_NODE toolbar button state (disabled vs enabled when no selection)
- Code trace approach for BUG-04 root cause identification

### Deferred Ideas (OUT OF SCOPE)
- **Swap/reorder nodes:** Button to swap positions of two nodes — click first node, click swap button, click second node. New capability, not a bug fix.
- **Format button UI inconsistency:** Only cloze and flowchart buttons are purple; during formatting, others show "..." while these two don't. UX polish item for a future phase.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BUG-01 | REMOVE_NODE correctly reconnects edges when removing a node with a branch parent | Code trace of REMOVE_NODE (lines 168-198) reveals single-edge reconnect only; branchGroups.filter drops entire group rather than updating childIds |
| BUG-02 | ADD_NODE leaf detection works on disconnected graphs | Code trace of ADD_NODE (lines 132-166) reveals leaf-detection via edge scan fails when multiple disconnected subgraphs exist; locked decision replaces with selectedNodeId-based approach |
| BUG-03 | Cancelling the step label prompt does not create empty-label edges | Code trace of handleConnectClick (lines 454-473) — `window.prompt` returns `null` on cancel, but `?? ""` coerces null to empty string and ADD_EDGE proceeds; locked decision replaces with inline input |
| BUG-04 | Back field displays correct content after flowchart/table generation | Code trace: `handleSwitchEditor` never touches `editBack` directly, but the `useEffect` at line 409-417 writes `ankiBackRef.current.innerHTML = editBack` on `editorMode` change — if `editBack` state has been overwritten between card selection and mode switch, the ref update reflects the wrong value |
</phase_requirements>

---

## Summary

Phase 7 is pure correctness work: four specific bugs in `FlowchartEditor.tsx` and `FlowView.tsx`. All four bugs are traceable directly to the existing source — no new features, no library research needed.

The two reducer bugs (BUG-01, BUG-02) live entirely inside `flowReducer` in `FlowchartEditor.tsx`. BUG-01's current REMOVE_NODE case handles only the linear-chain case (one inEdge → one outEdge → reconnect); it destroys branchGroup entries entirely via `.filter()` instead of updating `childIds`. BUG-02's ADD_NODE case uses a leaf-detection algorithm that silently produces no edge on disconnected graphs; the locked decision replaces this with a selectedNodeId-parent model.

BUG-03 is a call-site bug in `handleConnectClick`: `window.prompt` returns `null` on cancel, and the `?? ""` nullish coalescing coerces it to empty string before dispatching ADD_EDGE. The fix replaces the prompt with inline React state. BUG-04 requires a precise code trace: `handleSwitchEditor` does not directly write `editBack`, but the `useEffect([editingFlowCard, ankiPreview, editorMode])` at line 409-417 syncs the `ankiBackRef` contentEditable from `editBack` state on every editorMode change. If something overwrites `editBack` state during the generate-then-switch flow, that stale value is written to the DOM.

**Primary recommendation:** Fix all four bugs in two task files — Task 07-01 owns the reducer (BUG-01, BUG-02), Task 07-02 owns the UI/data-flow (BUG-03, BUG-04). Each task is self-contained with no inter-task dependencies.

---

## Standard Stack

### Core (already in project)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| use-immer | 0.11.0 | `useImmerReducer` — structural sharing, safe mutations in reducer draft | Already used; `flowReducer` receives Immer `draft` |
| React | 19.x | Component state, refs, effects | `useState`, `useRef`, `useEffect` patterns in scope |
| TypeScript | 5.x | Type safety | All types defined in `flowchart-types.ts` |
| vitest | 4.x | Unit test runner | Configured at `gapstrike/vitest.config.ts`; jsdom environment |

No new libraries needed. All fixes are logic changes in existing files.

---

## Architecture Patterns

### Established: `useImmerReducer` for Graph Mutations

All graph state mutations go through typed `FlowAction` dispatches — never direct state writes. The reducer receives an Immer `draft` (mutable proxy). Mutations to `draft.graph.nodes`, `draft.graph.edges`, and `draft.graph.branchGroups` are safe to do in-place.

```typescript
// Source: FlowchartEditor.tsx lines 104-236
export function flowReducer(draft: FlowState, action: FlowAction): void {
  switch (action.type) {
    case "REMOVE_NODE": {
      // draft.graph.edges, draft.graph.nodes, draft.graph.branchGroups
      // are all mutable Immer proxies — push/filter/splice work directly
    }
  }
}
```

### Established: Two-Click Connect Flow Pattern

`connectingFromId` and `connectMode` are local component state (not in reducer). The two-click sequence: first click sets `connectingFromId`, second click triggers edge creation. The BUG-03 fix extends this pattern by adding a third state: `pendingEdge` (fromId + toId awaiting label input).

```typescript
// Source: FlowchartEditor.tsx lines 430-432 (existing local state pattern)
const [connectingFromId, setConnectingFromId] = useState<string | null>(null);
const [connectMode, setConnectMode] = useState(false);
// BUG-03 addition:
// const [pendingEdge, setPendingEdge] = useState<{fromId:string; toId:string} | null>(null);
```

### Established: `selectedNodeId` in Reducer State

`selectedNodeId` already exists in `FlowState` (line 67) and is tracked in the reducer (cleared on REMOVE_NODE at line 193). The BUG-02 ADD_NODE fix reads `draft.selectedNodeId` directly inside the reducer — no new state needed.

### Established: contentEditable Sync via `requestAnimationFrame`

The pattern for syncing contentEditable refs is at FlowView.tsx lines 409-417:

```typescript
// Source: FlowView.tsx lines 409-417
useEffect(() => {
  if (editingFlowCard !== null && !ankiPreview) {
    requestAnimationFrame(() => {
      if (ankiFrontRef.current) ankiFrontRef.current.innerHTML = editFront;
      if (ankiBackRef.current) ankiBackRef.current.innerHTML = editBack;
    });
  }
}, [editingFlowCard, ankiPreview, editorMode]);
```

This runs on `editorMode` change. The fix for BUG-04 must ensure `editBack` state is never overwritten by mode-switching logic — `handleSwitchEditor` must be verified to not touch `editBack`.

### Anti-Patterns to Avoid

- **Modifying branchGroups with `.filter()` only:** The current REMOVE_NODE case deletes any branchGroup that contains the removed node. This drops the group entirely when a branch child is removed, orphaning the remaining children. Instead, when a branch member is removed, update `childIds` in-place and only delete the group when `childIds` drops to one or zero members.
- **Reading `window.prompt` return without null-check:** `window.prompt` returns `null` on cancel/Escape. The `?? ""` coalescing maps `null` to `""`, allowing ADD_EDGE to proceed with an empty label. The inline input pattern avoids this entirely.
- **Assuming graphs are always connected:** The old ADD_NODE leaf-detection loop (`leafIds.filter(id => !fromIds.has(id))`) produces an empty array on disconnected graphs (multiple isolated subgraphs, or a graph where all nodes are both sources and targets in a cycle). The selectedNodeId approach sidesteps this entirely.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Inline label input positioning | Custom floating position logic | Simple `position: absolute` inside the arrow's stem element; the stem already has relative context in the flex column |
| Immer draft array mutations | Manual index splicing | `draft.graph.branchGroups[i].childIds = childIds.filter(id => id !== removedId)` — Immer handles structural sharing |
| Cancel detection for input | Custom key capture system | `onKeyDown` with `e.key === "Escape"` calling abort handler — same pattern as `EditableNodeCard.handleKeyDown` |

---

## Code Trace: Root Causes

### BUG-01 — REMOVE_NODE Branch-Parent Reconnect

**File:** `FlowchartEditor.tsx` lines 168-198

**Current behavior:** The code finds one `inEdge` (edge pointing TO the removed node) and one `outEdge` (edge pointing FROM the removed node). If both exist, it creates a new edge from `inEdge.fromId` to `outEdge.toId`. This works for linear chains.

**What breaks:** When the removed node is a branch parent (it appears in `branchGroups` as `parentId`), there are MULTIPLE outgoing edges (one per child). The code only captures the FIRST `outEdge` via `find()`. The other children become orphans. Additionally, `branchGroups.filter(bg => bg.parentId !== action.id && !bg.childIds.includes(action.id))` deletes the entire group when the removed node is a child in a branch — instead it should remove just that child from `childIds`.

**The two sub-cases to handle:**
1. Removed node IS a branch parent: all its children must be reconnected to the removed node's parent. If the branch parent itself had a parent (an `inEdge`), each child gets a new edge from `inEdge.fromId`. The branchGroup for `inEdge.fromId` (if it exists) gains the children. Otherwise the children become new roots.
2. Removed node IS a branch child: remove it from its `branchGroup.childIds`. If only one child remains, collapse the branchGroup (turn it back into a linear edge). If zero children remain, delete the branchGroup and the edge.

### BUG-02 — ADD_NODE Leaf Detection on Disconnected Graphs

**File:** `FlowchartEditor.tsx` lines 132-166 (the `else` branch at line 151)

**Current behavior:** When `action.afterId` is absent, the code builds a set of `fromIds` from all edges, then filters nodes to those not in `fromIds`. On a disconnected graph (e.g., two nodes with no edges between them), BOTH are "leaf nodes" — the code picks `leafIds[leafIds.length - 1]` which is arbitrary.

**Locked fix:** Remove the `else` branch entirely. ADD_NODE without `afterId` reads `draft.selectedNodeId`. If set, creates `selectedNodeId → newId` edge. If null, pushes the node with no edge (standalone). The `ADD_NODE` action type's `afterId` field becomes unused but can stay for backwards compat or be removed from the union type.

**Dispatch site change:** `FlowchartEditor.tsx` line 530 currently dispatches `{ type: "ADD_NODE", label: "New box" }`. Change to `{ type: "ADD_NODE", label: "New box", afterId: state.selectedNodeId ?? undefined }` — OR handle selectedNodeId inside the reducer using `draft.selectedNodeId` directly.

The reducer-internal approach (reading `draft.selectedNodeId`) is cleaner because it avoids leaking reducer state to the dispatch site.

### BUG-03 — Prompt Cancel Creates Empty Edge

**File:** `FlowchartEditor.tsx` lines 454-473 (`handleConnectClick`)

**Current code:**
```typescript
const stepLabel = window.prompt("Step label (optional):") ?? "";
dispatch({ type: "ADD_EDGE", fromId: connectingFromId, toId: nodeId, stepLabel });
```

**The bug:** `window.prompt` returns `null` when user presses Cancel or Escape. The `?? ""` maps `null` to `""`, so `ADD_EDGE` always fires.

**Fix pattern:** Replace with a `pendingEdge` state `{ fromId, toId }`. When the second click fires, set `pendingEdge` instead of calling prompt. Render an inline `<input>` positioned in the canvas (or appended after the target node in the flex column). `onKeyDown`:
- `Escape` → `setPendingEdge(null)`, abort entirely
- `Enter` → dispatch ADD_EDGE with `inputValue` (empty string is valid for unlabeled arrow), then clear

This matches the `EditableNodeCard` text-editing pattern already in the component.

**CSS note:** The inline input can be styled like `.nodeCardTextarea` — small, auto-focus, no spellcheck. Position it between the source and target node in the DOM flow or as an overlay at the bottom of the canvas.

### BUG-04 — Back Field Overwrite after Flowchart/Table Generation

**File:** `FlowView.tsx`

**Code trace:**

1. Card selection (line 1860-1862): `setEditFront(card.front)`, `setEditBack(card.back)`. `modeContentRef.current = { cloze: card.front }`. `editBack` is set correctly here.

2. `handleSwitchEditor` (lines 1153-1205): Does NOT call `setEditBack` anywhere. Only modifies `editFront`, `ankiFrontRef`, `editorMode`, `modeContentRef`.

3. `useEffect([editingFlowCard, ankiPreview, editorMode])` (lines 409-417): On `editorMode` change, writes `ankiBackRef.current.innerHTML = editBack`. This reads the current `editBack` state — if state is correct, this is fine.

**The gap:** `handleSwitchEditor` is `async`. Between card selection and the user clicking "Flowchart", React may re-render multiple times. If `editBack` state is stale (e.g., from a previous card that hasn't been fully reset), the `useEffect` writes stale content to the DOM. The Back `contentEditable` displays the wrong content, and the user sees old text.

**Likely root cause:** When `setEditingFlowCard(card.note_id)` fires, `setEditBack(card.back)` fires in the SAME click handler (synchronous). However, the `useEffect([editingFlowCard, ankiPreview, editorMode])` fires after the render, potentially before or after `setEditBack`'s state update is committed. If `editorMode` changes during the same render batch (auto-detect at lines 1866-1870), `editBack` from the previous card may still be in the closure.

**Verification needed during implementation:** Add a `console.log` to confirm whether `editBack` holds the new card's value at the time the useEffect fires. If it holds stale value, the fix is to ensure `editBack` is always written via ref in the useEffect using the SAME click-handler data — or initialize `ankiBackRef.current.innerHTML` directly inside the click handler synchronously, bypassing the useEffect path for Back.

**Safe fix pattern:** Inside the card selection click handler (line 1858), after setting state, also directly assign `if (ankiBackRef.current) ankiBackRef.current.innerHTML = card.back`. This is the same pattern used for `ankiFrontRef` at line 1168 in `handleSwitchEditor`. The `useEffect` then just becomes a redundant sync — which is safe.

---

## Common Pitfalls

### Pitfall 1: Immer Draft — `find()` Returns Proxy, Not Index

**What goes wrong:** In REMOVE_NODE, `inEdge` and `outEdge` are obtained via `draft.graph.edges.find()`. These return Immer draft proxy objects. Using them to construct a new edge with `{ fromId: inEdge.fromId, toId: outEdge.toId }` works — Immer proxies support property reads. But iterating `draft.graph.branchGroups` and mutating `childIds` in-place requires indexing, not just `find()`.

**How to avoid:** When you need to mutate a found item, use `findIndex()` to get the array index and mutate `draft.graph.branchGroups[idx].childIds` in-place.

### Pitfall 2: Stale `connectingFromId` After Abort

**What goes wrong:** If BUG-03 fix adds `pendingEdge` state and aborts on Escape, `connectingFromId` must also be cleared. Otherwise the connect flow is left in a half-finished state.

**How to avoid:** In the Escape handler, clear both `setPendingEdge(null)` AND `setConnectingFromId(null)` AND `setConnectMode(false)`.

### Pitfall 3: `selectedNodeId` After ADD_NODE

**What goes wrong:** After adding a new node with selectedNodeId as parent, the user's selection state is now stale (the old parent is selected, but the user may expect the new node to be selected, or no selection).

**How to avoid:** At the end of the ADD_NODE case, set `draft.selectedNodeId = newId` so the new node is auto-selected. This follows the principle of least surprise and allows immediate "Add Box" again to chain-append nodes.

### Pitfall 4: BranchGroup Collapse Edge Case

**What goes wrong:** When removing a branch child leaves only one child in a branchGroup, the group should be collapsed to a regular edge. If not collapsed, the renderer shows a branch layout for a single-child path, which renders weirdly (a branch with one arm).

**How to avoid:** After filtering a child from `branchGroup.childIds`, check `childIds.length`:
- `>= 2`: keep branchGroup as-is
- `=== 1`: delete branchGroup; the remaining single edge already exists in `draft.graph.edges` so rendering falls through to the linear case
- `=== 0`: delete branchGroup; no reconnection needed (parent becomes a leaf)

---

## Code Examples

### Pattern: In-Place BranchGroup Update (Immer)

```typescript
// Preferred over .filter() when partial removal is needed
const bgIdx = draft.graph.branchGroups.findIndex(bg => bg.childIds.includes(action.id));
if (bgIdx >= 0) {
  const bg = draft.graph.branchGroups[bgIdx];
  bg.childIds = bg.childIds.filter(id => id !== action.id);
  if (bg.childIds.length < 2) {
    // Collapse to linear — remove the branchGroup entry
    draft.graph.branchGroups.splice(bgIdx, 1);
  }
}
```

### Pattern: Inline Input on Cancel/Enter

```typescript
// Same pattern as EditableNodeCard — no new UI primitives needed
function StepLabelInput({ onCommit, onAbort }: { onCommit: (label: string) => void; onAbort: () => void }) {
  const [value, setValue] = useState("");
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); onCommit(value); }
    if (e.key === "Escape") { e.preventDefault(); onAbort(); }
  }
  return (
    <input
      className={styles.stepLabelInput}
      value={value}
      onChange={e => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => onAbort()} // blur = cancel (consistent with Escape)
      autoFocus
      spellCheck={false}
      placeholder="Label (optional)"
    />
  );
}
```

### Pattern: Synchronous Ref Init in Click Handler (BUG-04)

```typescript
// FlowView.tsx — card selection click handler (around line 1858)
// Add synchronous DOM write BEFORE async state batching resolves:
setEditingFlowCard(card.note_id);
setEditFront(card.front);
setEditBack(card.back);
// Direct ref assignment ensures Back is correct regardless of editorMode detection timing:
requestAnimationFrame(() => {
  if (ankiBackRef.current) ankiBackRef.current.innerHTML = card.back;
});
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `window.prompt` for inline label collection | Inline controlled input rendered in component tree | No browser modal; supports Escape-to-abort; consistent with existing EditableNodeCard pattern |
| Leaf-detection via edge scan | selectedNodeId-parent model for ADD_NODE | Predictable behavior on any graph topology |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `gapstrike/vitest.config.ts` (exists, jsdom environment, `@` alias configured) |
| Quick run command | `cd gapstrike && npx vitest run src/lib/flowReducer.test.ts` |
| Full suite command | `cd gapstrike && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BUG-01 | REMOVE_NODE with branch parent reconnects ALL children | unit | `cd gapstrike && npx vitest run src/lib/flowReducer.test.ts` | Wave 0 |
| BUG-01 | REMOVE_NODE of branch child updates childIds without dropping other children | unit | `cd gapstrike && npx vitest run src/lib/flowReducer.test.ts` | Wave 0 |
| BUG-02 | ADD_NODE with selectedNodeId creates edge from parent to new node | unit | `cd gapstrike && npx vitest run src/lib/flowReducer.test.ts` | Wave 0 |
| BUG-02 | ADD_NODE with no selectedNodeId creates standalone node (no edge) | unit | `cd gapstrike && npx vitest run src/lib/flowReducer.test.ts` | Wave 0 |
| BUG-03 | Escape on step-label input does not dispatch ADD_EDGE | unit (component behavior) | manual-only — requires React component rendering | manual |
| BUG-03 | Enter with empty text dispatches ADD_EDGE with stepLabel="" | unit (component behavior) | manual-only | manual |
| BUG-04 | editBack state unchanged after handleSwitchEditor to flowchart mode | unit (pure function trace) | manual-only — async state interaction requires integration | manual |

**BUG-03 and BUG-04 are manual-only** because they require React rendering, state batching, and async behavior that is impractical to test with pure unit tests in this codebase (no React Testing Library installed). The reducer tests cover BUG-01 and BUG-02 fully.

### Sampling Rate

- **Per task commit:** `cd gapstrike && npx vitest run src/lib/flowReducer.test.ts`
- **Per wave merge:** `cd gapstrike && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `gapstrike/src/lib/flowReducer.test.ts` — covers BUG-01 (branch-parent removal, branch-child removal) and BUG-02 (selectedNodeId parent, null selectedNodeId standalone). Test the exported `flowReducer` function directly using `produce` from immer or the raw FLOW_INITIAL_STATE.

No framework install needed — Vitest is already installed and configured.

---

## Open Questions

1. **BUG-04 exact race condition path**
   - What we know: `handleSwitchEditor` does not call `setEditBack`. The useEffect syncs the ref on `editorMode` change. `editBack` state is set synchronously on card click.
   - What's unclear: Whether the stale-value issue occurs on FIRST card selection (editorMode auto-detect changes editorMode in the same click batch) or only on SUBSEQUENT card selections. The auto-detect at lines 1866-1870 calls `setEditorMode(...)` in the same synchronous click handler as `setEditBack(card.back)` — React 19 batches these, so both should be fresh in the same render. The useEffect then fires after that render with correct values.
   - Recommendation: During implementation, add a test log to confirm. If the issue is NOT the state batch timing, inspect whether `editBack` is ever written anywhere else (search for `setEditBack` across FlowView.tsx).

2. **ADD_NODE action type: remove `afterId` from union or keep?**
   - What we know: The locked decision moves parent selection into the reducer via `draft.selectedNodeId`. The `afterId` field on the action type becomes unused.
   - What's unclear: Whether any other call site uses `afterId`.
   - Recommendation: Search for all `ADD_NODE` dispatch sites before removing `afterId`. If unused elsewhere, remove it from the action union type for cleanliness.

---

## Sources

### Primary (HIGH confidence)
- `gapstrike/src/components/FlowchartEditor.tsx` — full source read; reducer lines 104-236, component lines 424-700
- `gapstrike/src/components/FlowView.tsx` — targeted reads at lines 160-200 (state declarations), 390-418 (useEffect sync), 1100-1220 (handleSwitchEditor), 1840-1870 (card selection), 1990-2010 (Back contentEditable)
- `gapstrike/src/lib/flowchart-types.ts` — full source read; FlowNode, FlowEdge, BranchGroup, FlowGraph types
- `gapstrike/vitest.config.ts` — full source read; jsdom environment, `@` alias
- `gapstrike/package.json` — confirmed vitest 4.x, use-immer 0.11.0, React 19, no React Testing Library

### Secondary (MEDIUM confidence)
- `.planning/phases/07-reducer-bug-fixes-and-flowview-data-flow/07-CONTEXT.md` — locked decisions for all four bugs
- `.planning/REQUIREMENTS.md` — BUG-01 through BUG-04 definitions

---

## Metadata

**Confidence breakdown:**
- Bug root causes: HIGH — all four bugs traced directly from source code, no speculation
- Fix approach for BUG-01/02: HIGH — code path is clear, Immer mutation pattern well-established in this codebase
- Fix approach for BUG-03: HIGH — inline input pattern mirrors existing EditableNodeCard implementation
- Fix approach for BUG-04: MEDIUM — the synchronous ref-write fix is sound, but exact race condition timing requires runtime verification during implementation
- Test coverage scope: HIGH — Vitest already configured; pure reducer functions are straightforwardly testable

**Research date:** 2026-03-10
**Valid until:** Stable — no external libraries involved; valid until source files change
