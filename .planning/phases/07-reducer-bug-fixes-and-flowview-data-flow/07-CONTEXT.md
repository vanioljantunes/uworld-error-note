# Phase 7: Reducer Bug Fixes and FlowView Data-Flow - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix 4 specific bugs in FlowchartEditor reducer and FlowView data flow: REMOVE_NODE branch-parent reconnection (BUG-01), ADD_NODE leaf detection on disconnected graphs (BUG-02), prompt cancel creating empty edges (BUG-03), and Back field overwrite after flowchart/table generation (BUG-04). No new features — pure correctness fixes.

Requirements: BUG-01, BUG-02, BUG-03, BUG-04

</domain>

<decisions>
## Implementation Decisions

### Prompt cancel UX (BUG-03)
- Replace `window.prompt` with inline text input rendered on the newly drawn arrow
- Input auto-focuses immediately — user can start typing right away
- **Escape** aborts the connection entirely — no edge is created
- **Enter with empty text** creates an unlabeled arrow (plain connection, no label)
- **Enter with text** creates a labeled arrow as before

### Back field preservation (BUG-04)
- Back field always shows the original extraction text from the cloze card
- Switching Front between cloze/flowchart/table must NEVER alter the Back field content
- Back field remains editable by the user in all editor modes (flowchart, table, cloze)
- The Back is the original text from cloze creation — it should be treated as immutable by mode-switching logic
- Root cause needs code trace: check handleSwitchEditor, modeContentRef, useEffect sync, and card creation flows

### Node removal reconnection (BUG-01)
- When removing a node that branches into multiple children, reconnect ALL children to the removed node's parent
- Branch structure (branchGroups) must be preserved/updated — not just edges
- Handle both linear chain removal (existing behavior) and branch-parent removal (new behavior)
- Ensure branchGroups.childIds are updated when a branch member is removed

### ADD_NODE flow change (BUG-02)
- ADD_NODE now requires a selected parent node: user selects a node first, then clicks "Add Box"
- New node is added as a child of the selected node (edge created from selected → new)
- If no node is selected when clicking Add Box, create a standalone disconnected node (no edge)
- Remove the old "append to last leaf" logic — it fails on disconnected/cyclic graphs

### Claude's Discretion
- Inline input styling and positioning on arrow (exact CSS)
- REMOVE_NODE reconnection algorithm details (edge iteration, branchGroup updates)
- ADD_NODE toolbar button state (disabled vs enabled when no selection)
- Code trace approach for BUG-04 root cause identification

</decisions>

<specifics>
## Specific Ideas

- ADD_NODE: "Select node first, then click Add Box" — mirrors Connect flow where user selects source, then clicks target
- Inline step label input should feel lightweight — not a modal or dialog, just a small text field on the arrow

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FlowchartEditor.tsx:132-166` — ADD_NODE reducer case (needs refactor to use selectedNodeId)
- `FlowchartEditor.tsx:168-198` — REMOVE_NODE reducer case (needs multi-child reconnection)
- `FlowchartEditor.tsx:463` — `window.prompt` call site for step label (replace with inline input)
- `FlowchartEditor.tsx:530` — "Add Box" button dispatch (needs to use selectedNodeId)
- `FlowView.tsx:166` — `editBack` state declaration
- `FlowView.tsx:1153-1205` — `handleSwitchEditor` function (does NOT touch editBack directly)
- `FlowView.tsx:409-417` — useEffect syncing contentEditable refs on editorMode change

### Established Patterns
- `useImmerReducer` for FlowchartEditor state — all graph mutations go through typed dispatch actions
- CSS Modules with camelCase class names (FlowchartEditor.module.css)
- `selectedNodeId` state already exists in reducer — used for node selection highlighting
- `connectingFromId` state exists for connection flow — similar pattern for ADD_NODE parent selection

### Integration Points
- `FlowchartEditor.tsx:621` — onRemove callback dispatches REMOVE_NODE
- `FlowView.tsx:1862` — `setEditBack(card.back)` on card selection (initial Back value)
- `FlowView.tsx:2006` — Back contentEditable onInput handler
- `FlowView.tsx:1101` — `editBack` used in save flow (must contain correct value)

</code_context>

<deferred>
## Deferred Ideas

- **Swap/reorder nodes:** Button to swap positions of two nodes — click first node, click swap button, click second node. New capability, not a bug fix.
- **Format button UI inconsistency:** Only cloze and flowchart buttons are purple; during formatting, others show "..." while these two don't. UX polish item for a future phase.

</deferred>

---

*Phase: 07-reducer-bug-fixes-and-flowview-data-flow*
*Context gathered: 2026-03-10*
