# Phase 4: Editing Operations - Research

**Researched:** 2026-03-09
**Domain:** React interactive editing — inline text editing, flowchart node/edge CRUD, table cell/row/column editing, real-time HTML serialization, and AI-triggered editor integration
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FLOW-02 | User can click a box to edit its text/cloze content inline | `useImmerReducer` already in FlowchartEditor — add `EDIT_NODE` action + click-to-edit pattern |
| FLOW-03 | User can add new boxes to the flowchart | `ADD_NODE` action on FlowGraph; append node, create edge from last selected node, call `rebuildHTML` |
| FLOW-04 | User can remove boxes from the flowchart | `REMOVE_NODE` action — splice from `nodes`, delete related `edges`, remove from `branchGroups` |
| FLOW-05 | User can add connections (arrows) between boxes with optional labels | `ADD_EDGE` action — select source then target node, optional step label input |
| FLOW-06 | User can remove connections | `REMOVE_EDGE` action — identify edge by `fromId+toId`, splice from `edges` |
| FLOW-07 | User can reorder/reposition boxes | Node reordering via drag handles or up/down buttons; simpler than drag-and-drop per v2 ADV-01 |
| FLOW-09 | Editing the flowchart updates card FRONT field HTML in real-time | `rebuildHTML(graph)` already exists — call in reducer after any mutation, pass result to `onChange` |
| TABL-01 | Table editor renders the AI-generated HTML table visually | `TableEditor.tsx` already has `parseTable` + full grid render — verify rendering works end-to-end |
| TABL-02 | User can click a cell to edit its text/cloze content inline | `TableEditor` already has `updateCell` + `<input>` per cell — already implemented |
| TABL-03 | User can add/remove rows | `TableEditor` already has `addRow` / `removeRow` — already implemented |
| TABL-04 | User can add/remove columns | `TableEditor` already has `addColumn` / `removeColumn` — already implemented |
| TABL-06 | Editing the table updates card FRONT field HTML in real-time | `TableEditor.emit()` already calls `onChange(rebuilt)` — verify the `onChange` handler in `FlowView.tsx` correctly propagates |
| INTG-01 | Flowchart button in GapStrike's Anki panel triggers AI generation then opens the visual editor | `handleSwitchEditor("flowchart")` already calls `/api/format-card` with `anki_flowchart` slug — needs `FlowchartEditor` to render in the edit panel with working `onChange` |
| INTG-02 | Table button triggers AI generation then opens visual editor | `handleSwitchEditor("table")` already calls `/api/format-card` with `anki_table` slug — needs `TableEditor` to render with working `onChange` |
</phase_requirements>

---

## Summary

Phase 4 is primarily an extension of the `FlowchartEditor` component with interactive mutation capabilities. The data model (`FlowGraph`), serializer (`rebuildHTML`), and parser (`parseFlowHTML`) are all complete and tested. The `useImmerReducer` reducer is already installed in `FlowchartEditor.tsx` but only handles two read-only actions (`LOAD` and `TOGGLE_VIEW`). Phase 4 adds the full set of mutation actions: edit node label, add node, remove node, add edge, remove edge, and reorder nodes. Each mutation dispatches to the reducer, which rebuilds the HTML via `rebuildHTML(draft.graph)` and calls `props.onChange()`.

For the Table editor, the situation is different — **`TableEditor.tsx` is already fully functional**. It has complete inline cell/header editing, add/remove rows, add/remove columns, and real-time `onChange` propagation. The `TABL-01` through `TABL-06` requirements are already satisfied by the existing code. The Phase 4 work for tables is to verify this end-to-end through the `FlowView.tsx` integration, not to build new features.

For integration (INTG-01 and INTG-02), `FlowView.tsx` already has the full `handleSwitchEditor` flow for both `"flowchart"` and `"table"` modes, and it already renders `<FlowchartEditor>` and `<TableEditor>` with `onChange` handlers. The `onChange` handlers correctly set `editFront` and sync `ankiFrontRef`. The integration is already wired — Phase 4 just needs to ensure the FlowchartEditor's `onChange` is actually called when edits happen (currently `void onChange` suppresses it).

**Primary recommendation:** Focus Phase 4 effort on the `FlowchartEditor` mutation layer. Add 6 new reducer actions, a node editing UI (click-to-edit `<textarea>` that replaces the static `NodeCard`), and a toolbar for add/remove node and edge operations. Everything else (Table editor, integration wiring) is already done and needs verification only.

---

## Standard Stack

### Core (all already installed)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| React 19 | `^19.0.0` | Component rendering | Installed |
| immer | `^10.x` | Immutable state in reducer | Installed (`gapstrike/package.json`) |
| use-immer | `^0.10.x` | `useImmerReducer` hook | Installed |
| Next.js 15 | `^15.1.3` | App framework | Installed |
| CSS Modules | built-in | Scoped styles | In use |
| vitest + jsdom | `^4.0.18` | Unit tests | Configured |

**No new packages need to be installed for Phase 4.**

### Supporting (unchanged from Phase 3)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| html-react-parser | `^5.x` | Installed in Phase 3 | Not needed for Phase 4 editing |

### Installation

```bash
# Nothing to install — all dependencies present
```

---

## Architecture Patterns

### What is Already Done

```
FlowchartEditor.tsx (Phase 3 state)
  ├── reducer: LOAD (parse HTML → FlowGraph) ✓
  ├── reducer: TOGGLE_VIEW (editor ↔ preview) ✓
  ├── FlowRenderer: renders FlowGraph as React nodes ✓
  ├── NodeCard: renders box with cloze highlight ✓
  ├── EdgePill: renders step label pill ✓
  └── onChange: declared in props but suppressed with `void onChange` ✗ (Phase 4 activates)

TableEditor.tsx (already complete)
  ├── parseTable: HTML → ParsedTable ✓
  ├── rebuildTable: ParsedTable → HTML ✓
  ├── updateCell, updateHeader: inline input editing ✓
  ├── addRow, removeRow, addColumn, removeColumn ✓
  └── emit: calls onChange(rebuilt) on every mutation ✓

FlowView.tsx (integration already wired)
  ├── handleSwitchEditor("flowchart"): calls /api/format-card → sets editFront ✓
  ├── handleSwitchEditor("table"): calls /api/format-card → sets editFront ✓
  ├── <FlowchartEditor value={editFront} onChange={(val) => setEditFront(val)} /> ✓
  └── <TableEditor value={editFront} onChange={(val) => setEditFront(val)} /> ✓
```

### What Phase 4 Builds

```
FlowchartEditor.tsx additions:
  ├── reducer actions: EDIT_NODE, ADD_NODE, REMOVE_NODE, ADD_EDGE, REMOVE_EDGE, REORDER_NODE
  ├── EditableNodeCard: click switches to <textarea>, blur commits
  ├── Toolbar: Add Node button, connection mode button
  ├── Node selection state: for two-click edge creation
  ├── rebuildHTML called after every mutation → onChange(newHTML)
  └── FlowchartEditor.module.css: new classes for editing states
```

### Recommended Project Structure

```
gapstrike/src/components/
├── FlowchartEditor.tsx          # Extend existing — add mutation actions
├── FlowchartEditor.module.css   # Extend existing — add editing state classes
└── TableEditor.tsx              # Already complete — no changes expected

gapstrike/tests/
├── flow-round-trip.test.ts      # Existing — must stay green
├── flowchart-editor-smoke.test.ts  # Existing — must stay green
├── table-cloze.test.ts          # Existing — must stay green
├── flow-editor-mutations.test.ts   # New — covers FLOW-02 through FLOW-07, FLOW-09
└── flow-table-intg.test.ts        # New — smoke covers INTG-01, INTG-02 integration
```

### Pattern 1: Click-to-Edit NodeCard

**What:** When user clicks a `NodeCard`, it transitions to an `EditableNodeCard` that renders a `<textarea>` pre-filled with the current label. On blur (or Enter for single-line), the EDIT_NODE action is dispatched and onChange is called.

**When to use:** For FLOW-02.

**Example:**

```tsx
// In FlowchartEditor.tsx — replace static NodeCard with EditableNodeCard
function EditableNodeCard({
  node,
  isEditing,
  onStartEdit,
  onCommit,
}: {
  node: FlowNode;
  isEditing: boolean;
  onStartEdit: () => void;
  onCommit: (label: string) => void;
}) {
  const [draft, setDraft] = useState(node.label);
  // Reset draft when node changes externally
  useEffect(() => { setDraft(node.label); }, [node.label]);

  if (isEditing) {
    return (
      <textarea
        className={styles.nodeCardTextarea}
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onCommit(draft)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onCommit(draft); } }}
        spellCheck={false}
      />
    );
  }

  return (
    <div
      className={styles.nodeCard}
      onClick={onStartEdit}
      style={{ cursor: "text" }}
      title="Click to edit"
    >
      {highlightCloze(node.label)}
    </div>
  );
}
```

**Key insight:** Track `editingNodeId: string | null` in `FlowState`. When the textarea blurs, dispatch `EDIT_NODE` which mutates `draft.graph.nodes[i].label` via immer, then sets `draft.editingNodeId = null`. After dispatch, call `onChange(rebuildHTML(newGraph))`.

### Pattern 2: Reducer Mutation + Immediate onChange

**What:** Every FlowGraph mutation (node add/remove/edit, edge add/remove, reorder) must: (1) update state via immer, (2) call `rebuildHTML(newGraph)`, (3) pass result to `props.onChange`.

**When to use:** For FLOW-09 — every mutation is real-time.

**Pattern — call onChange after dispatch:**

```tsx
// Option A: Call onChange in useEffect watching state.graph
useEffect(() => {
  if (state.viewMode === "editor" && state.graph.nodes.length > 0) {
    onChange(rebuildHTML(state.graph));
  }
}, [state.graph]);

// Option B: Compute HTML inside reducer (immer draft can write it to a side channel)
// NOT recommended — side effects in reducer are an anti-pattern

// Recommendation: Option A (useEffect on graph) is clean and idiomatic React.
// Guard against triggering on the initial LOAD (which parses the value prop —
// would create an infinite loop: onChange → value changes → LOAD → graph → onChange)
```

**CRITICAL pitfall:** Do NOT call `onChange` on the `LOAD` action. The initial `parseFlowHTML(value)` produces a FlowGraph that, when serialized back via `rebuildHTML`, may differ from the original `value` string (whitespace, attribute order). Calling `onChange` on LOAD would overwrite the `value` prop with the re-serialized form before any user edits. Guard with a flag (`hasUserEdited: boolean` in FlowState, set to `true` on any mutation action).

```typescript
// FlowState extended
type FlowState = {
  graph: FlowGraph;
  viewMode: "editor" | "preview";
  editingNodeId: string | null;
  hasUserEdited: boolean;  // prevents spurious onChange on LOAD
};

// In useEffect:
useEffect(() => {
  if (state.hasUserEdited) {
    onChange(rebuildHTML(state.graph));
  }
}, [state.graph, state.hasUserEdited]);
```

### Pattern 3: Reducer Actions for Flowchart Mutations

**What:** Six new actions extend the existing reducer.

```typescript
type FlowAction =
  | { type: "LOAD"; graph: FlowGraph }
  | { type: "TOGGLE_VIEW" }
  // Phase 4 additions:
  | { type: "EDIT_NODE"; id: string; label: string }
  | { type: "ADD_NODE"; label: string; afterId?: string }    // appends after given node or at end
  | { type: "REMOVE_NODE"; id: string }
  | { type: "ADD_EDGE"; fromId: string; toId: string; stepLabel: string }
  | { type: "REMOVE_EDGE"; fromId: string; toId: string }
  | { type: "REORDER_NODE"; id: string; direction: "up" | "down" }
  | { type: "SET_EDITING_NODE"; id: string | null };
```

**Immer reducer implementations:**

```typescript
case "EDIT_NODE": {
  const node = draft.graph.nodes.find((n) => n.id === action.id);
  if (node) node.label = action.label;
  draft.editingNodeId = null;
  draft.hasUserEdited = true;
  break;
}

case "ADD_NODE": {
  const newId = "n" + (draft.graph.nodes.length);
  draft.graph.nodes.push({ id: newId, label: action.label });
  // Add linear edge from afterId (or last non-new node) to newId
  if (action.afterId) {
    // Remove existing outgoing edge from afterId, repoint through new node
    const existingEdgeIdx = draft.graph.edges.findIndex(e => e.fromId === action.afterId);
    if (existingEdgeIdx >= 0) {
      const oldToId = draft.graph.edges[existingEdgeIdx].toId;
      draft.graph.edges[existingEdgeIdx].toId = newId;
      draft.graph.edges.push({ fromId: newId, toId: oldToId, stepLabel: "" });
    } else {
      draft.graph.edges.push({ fromId: action.afterId, toId: newId, stepLabel: "" });
    }
  }
  draft.hasUserEdited = true;
  break;
}

case "REMOVE_NODE": {
  // Reconnect edges around the removed node (for linear chains)
  const inEdge = draft.graph.edges.find(e => e.toId === action.id);
  const outEdge = draft.graph.edges.find(e => e.fromId === action.id);
  draft.graph.nodes = draft.graph.nodes.filter(n => n.id !== action.id);
  draft.graph.edges = draft.graph.edges.filter(
    e => e.fromId !== action.id && e.toId !== action.id
  );
  // Reconnect linear chain
  if (inEdge && outEdge) {
    draft.graph.edges.push({ fromId: inEdge.fromId, toId: outEdge.toId, stepLabel: "" });
  }
  // Remove from branchGroups
  draft.graph.branchGroups = draft.graph.branchGroups.filter(
    bg => bg.parentId !== action.id && !bg.childIds.includes(action.id)
  );
  draft.hasUserEdited = true;
  break;
}

case "ADD_EDGE": {
  const exists = draft.graph.edges.some(
    e => e.fromId === action.fromId && e.toId === action.toId
  );
  if (!exists) {
    draft.graph.edges.push({ fromId: action.fromId, toId: action.toId, stepLabel: action.stepLabel });
  }
  draft.hasUserEdited = true;
  break;
}

case "REMOVE_EDGE": {
  draft.graph.edges = draft.graph.edges.filter(
    e => !(e.fromId === action.fromId && e.toId === action.toId)
  );
  draft.hasUserEdited = true;
  break;
}
```

### Pattern 4: Two-Click Edge Creation (FLOW-05)

**What:** User selects source node (click in "connect mode"), then selects target node — an edge is created between them with an optional step label.

**When to use:** For FLOW-05 and FLOW-06.

**Pattern:**

```typescript
// In FlowState:
type FlowState = {
  ...
  connectMode: boolean;
  connectingFromId: string | null;  // first click selects source
};

// NodeCard onClick when connectMode === true:
// First click: set connectingFromId
// Second click on different node: dispatch ADD_EDGE, clear connectMode
// Clicking same node again: cancels
```

**UX pattern:** A "Connect" toolbar button toggles `connectMode`. When active, NodeCards show a visual indicator (ring outline). First click sets source (highlighted border), second click on a different node opens a small step-label input popup, then confirms `ADD_EDGE`. This is the established two-click graph connection pattern.

### Pattern 5: Node Reordering (FLOW-07)

**What:** Simple up/down arrows on each node (visible on hover or in a node controls overlay) to swap positions in the `nodes` array. **Not drag-and-drop** — that is ADV-01 (v2 scope).

**Example:**

```typescript
case "REORDER_NODE": {
  const idx = draft.graph.nodes.findIndex(n => n.id === action.id);
  if (idx < 0) break;
  const swapIdx = action.direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= draft.graph.nodes.length) break;
  // Swap
  [draft.graph.nodes[idx], draft.graph.nodes[swapIdx]] =
    [draft.graph.nodes[swapIdx], draft.graph.nodes[idx]];
  // Edges remain intact — fromId/toId references are by id, not position
  draft.hasUserEdited = true;
  break;
}
```

**Note:** Reordering nodes changes render position (which node appears first in the top-down layout). The root is always the node with no incoming edges — changing node array order does not change root detection. Edges determine structure; node array order is a rendering hint. For Phase 4, `REORDER_NODE` effectively swaps which node appears "before" the other when emitting HTML via `rebuildHTML`. Test carefully: after a swap, `rebuildHTML` walks from root via edges — position in `nodes[]` array does not affect walk order. If FLOW-07 means visual repositioning in the rendered output (not just array order), the edge structure must also be updated. Research verdict: interpret FLOW-07 as "user can move boxes up/down in the linear chain" — which requires swapping edges, not just array positions.

**Corrected REORDER_NODE for linear chain:**

```typescript
// Swapping positions in a linear chain means:
// Before: A → B → C (user moves B up → A → B becomes B → A)
// This requires: removing edge A→B, adding edge B→A-predecessor,
//                remove B→C, add A→C... complex.
//
// Simpler: just relabel — swap node labels (not IDs), preserving edge structure.
// This achieves the visual "reorder" effect without touching edges.

case "REORDER_NODE": {
  const idx = draft.graph.nodes.findIndex(n => n.id === action.id);
  const swapIdx = action.direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapIdx < 0 || swapIdx >= draft.graph.nodes.length) break;
  // Swap labels only — IDs and edges stay intact
  const tempLabel = draft.graph.nodes[idx].label;
  draft.graph.nodes[idx].label = draft.graph.nodes[swapIdx].label;
  draft.graph.nodes[swapIdx].label = tempLabel;
  draft.hasUserEdited = true;
  break;
}
```

### Pattern 6: Toolbar UI

**What:** A small action toolbar below the header bar in the FlowchartEditor that appears when in "editor" viewMode.

**Controls needed:**
- "Add Box" button — adds a new node after the currently selected node (or at the end if none selected)
- "Connect" toggle button — enters connection mode
- "Remove Box" button — removes the currently selected node
- Node controls on hover: "Remove" (×) button, up/down arrows for REORDER_NODE

**CSS classes to add to FlowchartEditor.module.css:**
- `.toolbar` — flex row, gap 4px, margin-bottom 8px
- `.toolbarBtn` — small button style (matches existing `toggleBtn`)
- `.toolbarBtnActive` — when connect mode is active
- `.nodeControls` — overlay div on nodeCard hover showing up/down/delete
- `.nodeCardTextarea` — textarea for inline edit (same size as nodeCard, no resize)
- `.nodeCardSelected` — border highlight for selected source in connect mode

### Anti-Patterns to Avoid

- **Calling onChange on LOAD:** Creates an infinite update loop. Guard with `hasUserEdited` flag.
- **Deriving node IDs from array index:** Use the synthetic `"n0"`, `"n1"` IDs that already exist. Do NOT regenerate IDs based on array index after mutations — edge references become invalid.
- **Storing the rebuilt HTML in FlowState:** `rebuildHTML` is deterministic — call it at serialization time only (in the `useEffect`), not in the reducer.
- **Editing both FlowGraph AND editFront simultaneously:** `FlowchartEditor` owns its graph state. `FlowView.tsx` receives the rebuilt HTML via `onChange`. Do not let `FlowView.tsx`'s `editFront` feed back into `FlowchartEditor.value` until the card is saved.
- **Removing a node without cleaning up edges and branchGroups:** Orphaned edges cause `rebuildHTML` to silently skip nodes or produce broken HTML.
- **Adding a new node with a duplicate ID:** Always generate IDs from the current node list length + timestamp or a monotonic counter in state.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Immutable state mutations | Manual spread/clone with index tracking | immer `draft` mutations | immer handles nested array mutations safely — splice, push, array swap without mutation bugs |
| Inline editing activation | Custom click-outside detection with refs | Simple `onBlur` on `<textarea>` | `onBlur` fires before the next click processes, making commit + close reliable without extra event handlers |
| Real-time HTML serialization | Custom HTML emitter | `rebuildHTML(graph)` (already exists) | rebuildHTML is tested and handles all cases (linear, branch, empty) |
| Table editing | Custom table cell manager | `TableEditor.tsx` (already complete) | Full cell/row/col editing with cloze passthrough is already implemented and tested |

---

## Common Pitfalls

### Pitfall 1: onChange Infinite Loop on LOAD

**What goes wrong:** If a `useEffect` watching `state.graph` calls `onChange(rebuildHTML(state.graph))` unconditionally, the first `LOAD` action after `value` prop changes calls `onChange`, which updates `editFront` in FlowView, which changes the `value` prop, which triggers `LOAD` again — infinite loop.

**Why it happens:** The `value → parseFlowHTML → graph → rebuildHTML → onChange → value` cycle is circular when LOAD is included.

**How to avoid:** Use `hasUserEdited: boolean` in `FlowState` (default `false`, set to `true` by any mutation action). Only call `onChange` in `useEffect` when `hasUserEdited === true`. Reset `hasUserEdited` to `false` on `LOAD`.

**Warning signs:** React "Maximum update depth exceeded" error in console.

### Pitfall 2: Node ID Collision After Add/Remove

**What goes wrong:** After removing node `"n1"` from a 3-node graph (`n0, n1, n2`), the next `ADD_NODE` creates a new node with ID `"n" + nodes.length` = `"n2"` — colliding with the existing `"n2"`.

**Why it happens:** Generating IDs from array length is fragile after removals.

**How to avoid:** Use a monotonic counter in `FlowState` that only ever increments. Or generate IDs based on `max(existing numeric suffix) + 1`.

```typescript
// In FlowState:
type FlowState = {
  ...
  nodeCounter: number;  // starts at nodes.length after LOAD, increments only
};

// In ADD_NODE:
const newId = "n" + draft.nodeCounter;
draft.nodeCounter++;
```

**Warning signs:** Two nodes with the same ID — FlowRenderer's `visited` Set causes one to not render.

### Pitfall 3: BranchGroup Orphan After Node Removal

**What goes wrong:** User removes a branch parent node. The `BranchGroup` with `parentId === removedId` remains in `branchGroups`. When `FlowRenderer` processes the graph, it finds no node for the parentId but the branchGroup still exists — the parent logic may try to fan out from a non-existent node.

**Why it happens:** REMOVE_NODE action cleans edges but forgets to clean `branchGroups`.

**How to avoid:** In the `REMOVE_NODE` reducer case, always filter `branchGroups`:

```typescript
draft.graph.branchGroups = draft.graph.branchGroups.filter(
  bg => bg.parentId !== action.id && !bg.childIds.includes(action.id)
);
```

**Warning signs:** Missing or phantom branch arms in the rendered graph after removal.

### Pitfall 4: TableEditor onChange Not Propagating

**What goes wrong:** User edits a cell in the table editor, but the card FRONT field (shown in the raw HTML preview) doesn't update. The `FlowView.tsx` `<TableEditor onChange={(val) => { setEditFront(val); if (ankiFrontRef.current) ankiFrontRef.current.innerHTML = val; }}` handler does update `editFront`, but the `editorMode === "table"` branch bypasses the `contentEditable` front div — the ref update is unnecessary.

**Why it happens:** The `ankiFrontRef` is the contentEditable div used in "cloze" mode — in "table" mode the editor is the TableEditor component, and `ankiFrontRef` isn't rendered. Setting `ankiFrontRef.current.innerHTML` is a no-op but not harmful.

**How to avoid:** Verify that `editFront` state (the React state) is the true source of truth for what gets saved via AnkiConnect. Trace: `TableEditor.onChange` → `setEditFront(val)` → `handleSaveAnkiCard` reads `editFront` ✓. This is already wired correctly in `FlowView.tsx`.

**Warning signs:** Saved card in Anki has the pre-edit HTML, not the edited version.

### Pitfall 5: Two-Click Edge Creation Conflicts with Node Edit

**What goes wrong:** When `connectMode` is active, clicking a node to start a connection accidentally also triggers "start edit" for that node.

**Why it happens:** `onClick` on `NodeCard` handles both actions without checking `connectMode`.

**How to avoid:** In `NodeCard/EditableNodeCard`, check if `connectMode` is active before delegating to `onStartEdit`:

```tsx
onClick={() => {
  if (connectMode) {
    onConnectClick(node.id);
  } else {
    onStartEdit();
  }
}}
```

**Warning signs:** A textarea appears on the first click in connect mode.

### Pitfall 6: TableEditor Already Implemented — Don't Rebuild

**What goes wrong:** Developer reads TABL-01 through TABL-06 as "build a table editor" and writes a new implementation from scratch, duplicating the existing working `TableEditor.tsx`.

**Why it happens:** TABL-01 says "Table editor renders the AI-generated HTML table visually" — it sounds like it needs building.

**How to avoid:** Read the existing `TableEditor.tsx` first. It already:
- Renders the table as a native HTML grid with `<input>` cells (TABL-01 ✓, TABL-02 ✓)
- Has `addRow`, `removeRow`, `addColumn`, `removeColumn` (TABL-03 ✓, TABL-04 ✓)
- Calls `onChange(rebuildTable(updated))` on every mutation (TABL-06 ✓)
- Has `parseTable` that preserves cloze syntax verbatim in cells (TABL-05 ✓ — Phase 2)

Phase 4 work on tables = integration verification, not new feature development.

---

## Code Examples

Verified patterns from existing codebase:

### Current FlowState (Phase 3) → Extended FlowState (Phase 4)

```typescript
// Source: gapstrike/src/components/FlowchartEditor.tsx (current Phase 3 state)
// Phase 3:
type FlowState = { graph: FlowGraph; viewMode: "editor" | "preview" };

// Phase 4 extension:
type FlowState = {
  graph: FlowGraph;
  viewMode: "editor" | "preview";
  editingNodeId: string | null;    // FLOW-02: which node is in text-edit mode
  selectedNodeId: string | null;   // FLOW-03/05: which node is selected
  connectMode: boolean;            // FLOW-05: two-click edge creation mode
  connectingFromId: string | null; // FLOW-05: first click of edge creation
  hasUserEdited: boolean;          // FLOW-09: gate onChange to prevent LOAD loop
  nodeCounter: number;             // Prevents ID collision after removes
};
```

### rebuildHTML Integration (FLOW-09)

```typescript
// Source: gapstrike/src/lib/rebuild-flow-html.ts — rebuildHTML(graph: FlowGraph): string
// In FlowchartEditor.tsx — add this useEffect after the existing [value] effect:
useEffect(() => {
  if (state.hasUserEdited) {
    onChange(rebuildHTML(state.graph));
  }
}, [state.graph, state.hasUserEdited]);
// NOTE: onChange must be stable (wrapped in useCallback in parent) or add to deps carefully
```

### TableEditor onChange Integration (already in FlowView.tsx)

```tsx
// Source: gapstrike/src/components/FlowView.tsx lines 1973-1980
{editorMode === "table" && (
  <TableEditor
    value={editFront}
    onChange={(val) => {
      setEditFront(val);
      if (ankiFrontRef.current) ankiFrontRef.current.innerHTML = val;
    }}
  />
)}
```

### Flowchart onChange Integration (already in FlowView.tsx)

```tsx
// Source: gapstrike/src/components/FlowView.tsx lines 1955-1963
{editorMode === "flowchart" && (
  <FlowchartEditor
    value={editFront}
    onChange={(val) => {
      setEditFront(val);
      if (ankiFrontRef.current) ankiFrontRef.current.innerHTML = val;
    }}
  />
)}
```

### parseTable Cloze Passthrough (verified by existing test)

```typescript
// Source: gapstrike/tests/table-cloze.test.ts — test already passing
// parseTable preserves {{c1::Mesonephric duct}} verbatim in cell values
// rebuildTable round-trips cloze syntax through HTML rebuild
// No changes needed to TableEditor for TABL-02 or TABL-05
```

---

## State of the Art

| Old Approach | Current Approach (Phase 4) | When Changed | Impact |
|--------------|---------------------------|--------------|--------|
| FlowchartEditor with only LOAD + TOGGLE_VIEW actions | FlowchartEditor with full CRUD mutation actions | Phase 4 | Users can fully edit flowcharts without re-generating |
| `void onChange` (suppressed, not wired) | `onChange(rebuildHTML(state.graph))` called on every mutation | Phase 4 | Card FRONT updates in real-time as user edits |
| TableEditor (already functional, Phase 2) | Same TableEditor — Phase 4 verifies end-to-end integration | Phase 4 | No code changes needed; just verify and test |

**Note on FLOW-07 scope:** "Reorder/reposition boxes" is v2 ADV-01 for drag-and-drop with auto-routing. Phase 4's FLOW-07 is limited to simple up/down label swapping (swap labels between adjacent nodes in the linear chain). Full drag-and-drop is out of scope.

---

## Open Questions

1. **Node ID generation strategy after removals**
   - What we know: Current IDs are `"n0"`, `"n1"`, etc. generated by `parseFlowHTML` counter.
   - What's unclear: Whether `"n" + nodes.length` is safe (it isn't after removals — see Pitfall 2).
   - Recommendation: Add `nodeCounter: number` to `FlowState`, initialized to `graph.nodes.length` after LOAD, incremented only on ADD_NODE. Never reuse IDs.

2. **Step label input UX for ADD_EDGE (FLOW-05)**
   - What we know: Edge has a `stepLabel` string. The add-edge flow needs a way to input this.
   - What's unclear: Should the step label be editable inline (in the pill element) or via a modal/popover?
   - Recommendation: Show a small inline text input below the newly created pill (similar to the textarea pattern for node labels). Keep it simple — no modal needed.

3. **FLOW-09 annotation — already listed as Phase 2 Complete in REQUIREMENTS.md**
   - What we know: REQUIREMENTS.md `## Traceability` marks `FLOW-09: Phase 2: Complete`. But `FlowchartEditor` currently has `void onChange` (line 189). The Phase 2 completion may refer to the `onChange` contract being wired in FlowView.tsx, not to actual mutations being implemented.
   - What's unclear: Whether FLOW-09 is already complete or if the traceability table is wrong.
   - Recommendation: Treat FLOW-09 as Phase 4 work. The `onChange` contract exists but is deliberately suppressed pending editing implementation. Phase 4 activates it.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 with jsdom |
| Config file | `gapstrike/vitest.config.ts` (exists, jsdom configured) |
| Quick run command | `cd gapstrike && npx vitest run tests/flow-editor-mutations.test.ts` |
| Full suite command | `cd gapstrike && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FLOW-02 | Dispatch EDIT_NODE mutates node label in FlowGraph | unit | `cd gapstrike && npx vitest run tests/flow-editor-mutations.test.ts` | ❌ Wave 0 |
| FLOW-03 | Dispatch ADD_NODE appends node + edge, graph is valid | unit | `cd gapstrike && npx vitest run tests/flow-editor-mutations.test.ts` | ❌ Wave 0 |
| FLOW-04 | Dispatch REMOVE_NODE removes node, edges, branchGroups clean | unit | `cd gapstrike && npx vitest run tests/flow-editor-mutations.test.ts` | ❌ Wave 0 |
| FLOW-05 | Dispatch ADD_EDGE adds edge between two valid nodes | unit | `cd gapstrike && npx vitest run tests/flow-editor-mutations.test.ts` | ❌ Wave 0 |
| FLOW-06 | Dispatch REMOVE_EDGE removes edge by fromId+toId | unit | `cd gapstrike && npx vitest run tests/flow-editor-mutations.test.ts` | ❌ Wave 0 |
| FLOW-07 | REORDER_NODE swaps labels between adjacent nodes | unit | `cd gapstrike && npx vitest run tests/flow-editor-mutations.test.ts` | ❌ Wave 0 |
| FLOW-09 | rebuildHTML(graph) after mutation produces valid HTML string containing new label | unit | `cd gapstrike && npx vitest run tests/flow-editor-mutations.test.ts` | ❌ Wave 0 |
| TABL-01 | parseTable produces a ParsedTable from AI HTML | unit | `cd gapstrike && npx vitest run tests/table-cloze.test.ts` | ✅ |
| TABL-02 | updateCell mutates row/col in ParsedTable | unit | `cd gapstrike && npx vitest run tests/table-cloze.test.ts` | ✅ (implicit in round-trip) |
| TABL-03 | addRow appends row to ParsedTable | unit | `cd gapstrike && npx vitest run tests/flow-table-intg.test.ts` | ❌ Wave 0 |
| TABL-04 | addColumn appends column to ParsedTable | unit | `cd gapstrike && npx vitest run tests/flow-table-intg.test.ts` | ❌ Wave 0 |
| TABL-06 | rebuildTable after mutation produces HTML with change | unit | `cd gapstrike && npx vitest run tests/table-cloze.test.ts` | ✅ (round-trip) |
| INTG-01 | FlowchartEditor rendered in edit panel, onChange sets editFront | smoke/manual | Manual: click Flowchart button, edit box, verify FRONT field updates | — |
| INTG-02 | TableEditor rendered in edit panel, onChange sets editFront | smoke/manual | Manual: click Table button, edit cell, verify FRONT field updates | — |

### Sampling Rate

- **Per task commit:** `cd gapstrike && npx vitest run` (full suite — fast, ~5s)
- **Per wave merge:** `cd gapstrike && npx vitest run`
- **Phase gate:** Full suite green + manual INTG-01 / INTG-02 visual verification

### Wave 0 Gaps

- [ ] `gapstrike/tests/flow-editor-mutations.test.ts` — covers FLOW-02, FLOW-03, FLOW-04, FLOW-05, FLOW-06, FLOW-07, FLOW-09 via reducer unit tests (no DOM, pure function tests on reducer + rebuildHTML)
- [ ] `gapstrike/tests/flow-table-intg.test.ts` — covers TABL-03, TABL-04 via `addRow`, `addColumn`, `removeRow`, `removeColumn` unit tests on `TableEditor` exported functions

*(Existing tests cover: TABL-01 via `parseTable`, TABL-02 via round-trip, TABL-06 via round-trip, FLOW-01 via smoke, FLOW-08 via smoke)*

---

## Sources

### Primary (HIGH confidence)

- Direct code audit: `gapstrike/src/components/FlowchartEditor.tsx` — confirmed reducer has only LOAD + TOGGLE_VIEW; `void onChange` on line 189 confirms onChange is not yet wired
- Direct code audit: `gapstrike/src/components/TableEditor.tsx` — confirmed TABL-01 through TABL-06 are already fully implemented; `emit()` calls `onChange` on every mutation
- Direct code audit: `gapstrike/src/components/FlowView.tsx` (lines 1955-1980) — confirmed FlowchartEditor and TableEditor are already rendered with `onChange` handlers that set `editFront`
- Direct code audit: `gapstrike/src/lib/rebuild-flow-html.ts` — `rebuildHTML(graph: FlowGraph): string` available for serialization
- Direct code audit: `gapstrike/src/lib/flowchart-types.ts` — `FlowGraph`, `FlowNode`, `FlowEdge`, `BranchGroup` interfaces confirmed
- Direct code audit: `gapstrike/tests/table-cloze.test.ts` — TABL-01, TABL-02, TABL-06 already covered
- Direct code audit: `gapstrike/tests/flowchart-editor-smoke.test.ts` — FLOW-01, FLOW-08 already covered
- Direct code audit: `gapstrike/vitest.config.ts` — jsdom environment confirmed

### Secondary (MEDIUM confidence)

- `.planning/REQUIREMENTS.md` — Phase 4 requirements list and traceability table (note: FLOW-09 marked Phase 2 Complete in traceability but code shows it is not yet wired)
- `.planning/STATE.md` accumulated decisions — confirms immer/use-immer decision and `hasUserEdited` not yet implemented

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages confirmed present from package.json; no new installs needed
- Architecture: HIGH — all patterns derived directly from reading existing source files; no speculation
- Pitfalls: HIGH — `void onChange` pattern and ID collision risk verified by reading actual source code
- TableEditor status: HIGH — all TABL requirements confirmed complete by reading TableEditor.tsx
- Integration status: HIGH — FlowView.tsx wiring confirmed complete by reading actual lines 1955-1980

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable stack — no breaking changes expected in React 19, immer 10, Next.js 15)
