# Architecture Research

**Domain:** v1.1 UX polish integration for FlowchartEditor / TableEditor
**Researched:** 2026-03-09
**Confidence:** HIGH (direct codebase inspection — all referenced files read)

---

## Standard Architecture

### System Overview

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                           FlowView.tsx (host)                                 │
│  editorMode | editFront | ankiPreview | modeContentRef                        │
│                                                                               │
│  ┌── v1.1 change: remove ankiPreview bool ──────────────────────────────────┐ │
│  │  Replace dual-state with single viewMode inside FlowchartEditor itself   │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────  ┤
│  FlowchartEditor (value, onChange)     FlowchartPreview (named export)        │
│  ┌──────────────────────────────┐      ┌──────────────────────────────────┐   │
│  │  viewMode: "preview"|"edit"  │      │  dangerouslySetInnerHTML         │   │
│  │  ↑ default = "preview" (new) │      │  (unchanged — FlowView uses it   │   │
│  │                              │      │   for the old ankiPreview path)   │   │
│  │  [Preview mode]              │      └──────────────────────────────────┘   │
│  │    FlowchartPreview inline   │                                              │
│  │    (same component)          │                                              │
│  │                              │                                              │
│  │  [Edit mode]                 │                                              │
│  │    FlowRendererWithConnect   │                                              │
│  │    EditableNodeCard / EdgePill│                                             │
│  │    Toolbar (Add Box, Connect)│                                              │
│  └──────────────────────────────┘                                              │
├───────────────────────────────────────────────────────────────────────────────┤
│  TableEditor (value, onChange)  — same props contract, no interface change    │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  parseTable → ParsedTable model → rebuildTable → HTML string             │  │
│  │  All editing via controlled <input> fields                               │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
├───────────────────────────────────────────────────────────────────────────────┤
│  /api/format-card (GPT-4o)     AnkiConnect (localhost:8765)                   │
│  parseTemplateSections() ←     addNote / updateNoteFields                     │
│  anki_flowchart template ←     ← editFront passed verbatim                   │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | v1.1 Status |
|-----------|----------------|-------------|
| `FlowView.tsx` | Host: mode switching, AnkiConnect calls, editFront ownership | Modified (minor) |
| `FlowchartEditor.tsx` | Visual editor + embedded preview, two-mode UX | Modified |
| `FlowState.viewMode` | Internal "preview" or "editor" state | Changed (default preview) |
| `TOGGLE_VIEW` reducer action | Switch between the two modes | Unchanged (rename label only) |
| `FlowchartPreview` (named export) | Read-only HTML render | Reused inside editor preview mode |
| `parseFlowHTML()` | HTML → FlowGraph | Bug fixes applied here |
| `rebuildHTML()` | FlowGraph → HTML | Possibly extended for richer structures |
| `anki_flowchart` template | System + instructions + cardStructure sections | Content updated |
| `TableEditor.tsx` | Table editing UI | Minor polish only |
| `FLOWCHART_STYLES` | Style constants shared by parser and serializer | Possibly extended |

---

## Recommended Project Structure

```
gapstrike/src/
├── components/
│   ├── FlowchartEditor.tsx          # Modified — default to preview, fix bugs
│   │   ├── FlowchartEditorErrorBoundary  # Exists — keep
│   │   ├── FlowchartEditorInner          # Modified — initialState.viewMode = "preview"
│   │   ├── FlowchartPreview              # Exists — reused in preview mode
│   │   ├── FlowRendererWithConnect       # Exists — bug fixes here
│   │   └── EditableNodeCard / EdgePill   # Exists — bug fixes here
│   ├── FlowchartEditor.module.css   # Minor additions for container layout
│   └── TableEditor.tsx              # Minor polish — no structural change
├── lib/
│   ├── flowchart-types.ts           # Unchanged (FlowGraph, FlowNode, FlowEdge, BranchGroup)
│   ├── flowchart-styles.ts          # Possibly extended for richer template structure
│   ├── parse-flow-html.ts           # Bug fixes for edge cases
│   └── rebuild-flow-html.ts         # Possibly extended for richer structures
└── app/api/
    └── format-card/route.ts         # No change — template content drives AI behavior
```

### What is New vs Modified vs Unchanged

| File | Change Type | What Changes |
|------|-------------|--------------|
| `FlowchartEditor.tsx` | Modified | `initialState.viewMode = "preview"`, button label "Edit" / "Preview", bug fixes in reducer/renderer |
| `FlowchartEditor.module.css` | Modified | Container layout for short content (min-height, centering) |
| `FlowView.tsx` | Modified (minor) | Remove or suppress `ankiPreview` toggle for flowchart mode — editor owns its own preview now |
| `parse-flow-html.ts` | Modified | Fix edge cases that cause crashes (see Pitfalls) |
| `rebuild-flow-html.ts` | Possibly modified | Extended if richer card structure requires new HTML patterns |
| `flowchart-styles.ts` | Possibly modified | New style constants if richer template adds element types |
| `template-defaults.ts` | Modified | New `anki_flowchart` content + new hash in `TEMPLATE_PREV_HASHES` |
| `TableEditor.tsx` | Minor polish | CSS class references only — no logic change |
| `flowchart-types.ts` | Unchanged | Data model is stable |
| `format-card/route.ts` | Unchanged | API is content-agnostic |

---

## Architectural Patterns

### Pattern 1: Self-Contained Two-Mode Editor

**What:** `FlowchartEditor` controls its own `viewMode` ("preview" | "editor") entirely. FlowView.tsx does not need to know which mode the editor is in. The `ankiPreview` boolean in FlowView.tsx was the old "preview from outside" mechanism — that is now redundant for the flowchart case because the editor renders its own preview.

**When to use:** Always, for flowchart mode. The other editors (TableEditor, QuestionEditor) remain controlled by FlowView's `ankiPreview` bool — no change needed there.

**Trade-offs:** Slight divergence between how FlowchartEditor and TableEditor handle preview. Acceptable because flowchart preview requires the same `FlowchartPreview` component (dangerouslySetInnerHTML) which already lives inside `FlowchartEditor.tsx`.

**Implementation:**
```typescript
// FlowchartEditor.tsx — change only one line
const initialState: FlowState = {
  graph: EMPTY_GRAPH,
  viewMode: "preview",   // ← was "editor", now "preview"
  editingNodeId: null,
  // ...rest unchanged
};
```

The `TOGGLE_VIEW` reducer action already works. The button label in the header needs to change from "Preview in Anki" / "Back to Editor" to "Edit" / "Preview" (or similar). No structural change.

**FlowView.tsx impact:** When `editorMode === "flowchart"`, the `ankiPreview` bool effectively becomes a no-op — the editor renders its own preview. The existing condition `if (ankiPreview) { <FlowchartPreview ...> }` in FlowView can be left in place (harmless) or removed in a follow-up cleanup.

### Pattern 2: Bug Fix in Reducer Without Interface Change

**What:** Editing bugs (crashes when adding connections, unexpected behavior on node removal) live in the `flowReducer` or in `FlowRendererWithConnect`. They can be fixed without changing the `FlowState` or `FlowAction` types — pure logic corrections.

**When to use:** All edit-mode bug fixes in v1.1.

**Known crash sites to investigate:**
```typescript
// ADD_NODE — "append to end" path uses leaf detection
// Risk: when graph has a cycle or disconnected node, leafIds can be wrong
const leafIds = nodeIds.filter((id) => !fromIds.has(id));

// REMOVE_NODE — reconnect logic only handles linear chains
// Risk: if the removed node had multiple outgoing edges (branch parent),
// the reconnect edge from inEdge.fromId → outEdge.toId is ambiguous
if (inEdge && outEdge) {
  draft.graph.edges.push({ fromId: inEdge.fromId, toId: outEdge.toId, stepLabel: "" });
}

// handleConnectClick — uses window.prompt (blocks UI thread)
// Risk: user cancels prompt → empty stepLabel edge added anyway
const stepLabel = window.prompt("Step label (optional):") ?? "";
```

**Fix approach:** Each bug fix is isolated to its reducer case or handler. No new state fields needed.

### Pattern 3: Template Content Update via TEMPLATE_PREV_HASHES

**What:** The `anki_flowchart` template content lives in Supabase per-user. When the default template changes, `TEMPLATE_PREV_HASHES` auto-upgrades users who never customized their template. This is the correct path for richer AI card structure.

**When to use:** Any time the `anki_flowchart` template prompt content changes (v1.1 richer structure requirement).

**Implementation:**
```typescript
// template-defaults.ts
export const TEMPLATE_PREV_HASHES: Record<string, string[]> = {
  anki_flowchart: [
    "d2343b1e21aa9df1",
    "a5f7aade1b01b248",
    "195d2fc7a40117fd",
    "6c7928647efcdecb",
    "ab29f95e3c05a983",
    "607faa7057d4a280",  // current hash — add new ones before adding new default
    "<NEW_HASH>",        // ← add the hash of the OLD content here
  ],
  // ...
};

// TEMPLATE_DEFAULTS — update the anki_flowchart entry with richer prompt
```

**Constraint:** The richer template must still produce HTML that `parseFlowHTML()` can parse. If the richer template introduces new HTML patterns (e.g., multi-level nesting, new element types), `parse-flow-html.ts` and `rebuild-flow-html.ts` must be updated in the same change, and `FLOWCHART_STYLES` extended.

### Pattern 4: Container Layout via CSS Module Changes Only

**What:** "Short content" layout issue (flowchart with few boxes looks cramped or misaligned) is purely a CSS problem. The editor renders boxes in a `styles.canvas` div with a `styles.editorRoot` wrapper. No React logic changes needed — add `min-height`, `align-items: center`, or padding to the CSS module classes.

**When to use:** Container layout fix in v1.1.

**Implementation:**
```css
/* FlowchartEditor.module.css — existing class, add min-height */
.canvas {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 200px;       /* ← prevents collapse on short flowcharts */
  padding: 16px 0;         /* ← breathing room top/bottom */
}

.editorRoot {
  /* existing styles... */
  min-height: 300px;       /* ← prevents the entire editor from collapsing */
}
```

No React component changes. No new CSS classes (unless the design system requires it).

---

## Data Flow

### v1.1 Mode Switching (Simplified)

```
User lands on flowchart editor (after AI generation)
    ↓
FlowchartEditor mounts with viewMode = "preview"  ← NEW default
    ↓
User sees FlowchartPreview (rendered Anki card)
    ↓
User clicks "Edit" button
    ↓
dispatch({ type: "TOGGLE_VIEW" })
    ↓
viewMode = "editor" → FlowRendererWithConnect shown
    ↓
User edits box text
    ↓
dispatch({ type: "EDIT_NODE", id, label })
    ↓
hasUserEdited = true → onChange(rebuildHTML(graph)) fires
    ↓
FlowView.tsx: setEditFront(newHtml) + ankiFrontRef.current.innerHTML = newHtml
    ↓
User clicks "Preview"
    ↓
dispatch({ type: "TOGGLE_VIEW" }) → viewMode = "preview"
    ↓
FlowchartPreview re-renders with updated value prop
```

### v1.1 AI Prompt → Richer Card → Parser Round-trip

```
User clicks "Flowchart"
    ↓
handleSwitchEditor("flowchart") in FlowView.tsx
    ↓
POST /api/format-card { front: clozeHtml, template: anki_flowchart }
    ↓
GPT-4o reads updated template (richer cardStructure section)
    ↓
Returns richer HTML (more nodes, nested branches, richer step labels)
    ↓
setEditFront(richHtml)
    ↓
FlowchartEditor: useEffect → parseFlowHTML(richHtml)
    ↓
If new HTML patterns: MUST be handled by updated parse-flow-html.ts
    ↓
FlowGraph with more nodes/edges → renders correctly in edit mode
    ↓
rebuildHTML(graph) must reproduce the same structure
```

**Critical constraint:** parseFlowHTML and rebuildHTML must be a lossless round-trip for any HTML the updated template produces. This means: if the richer template adds new element types, update FLOWCHART_STYLES + parse-flow-html + rebuild-flow-html in a single atomic change.

### State Ownership Map

```
FlowView.tsx owns:
├── editFront: string               ← canonical HTML, source of truth
├── editorMode: EditorMode          ← "flowchart" | "table" | "cloze" | "question"
├── modeContentRef: Record<mode, string>  ← per-mode cache
└── ankiPreview: boolean            ← used for table/cloze/question; flowchart ignores it

FlowchartEditor owns:
├── graph: FlowGraph                ← parsed from value prop
├── viewMode: "preview" | "editor" ← internal, not visible to host
├── editingNodeId: string | null    ← which box is in text-edit mode
├── connectMode: boolean            ← two-click edge creation mode
└── connectingFromId: string | null ← first node clicked in connect flow
```

---

## Integration Points

### Internal Boundaries

| Boundary | Communication | v1.1 Change |
|----------|---------------|-------------|
| `FlowView.tsx` → `FlowchartEditor` | `value: string`, `onChange: (val: string) => void` | No change — same props contract |
| `FlowchartEditor` → `FlowchartPreview` | Preview component embedded inside editor for preview mode | Unchanged — already done in v1.0 |
| `FlowchartEditor` ↔ `parseFlowHTML` | Function call, returns FlowGraph | Bug fixes in parseFlowHTML internals |
| `FlowchartEditor` ↔ `rebuildHTML` | Function call, returns HTML string | Possibly extended for richer cards |
| `FlowchartEditor` ↔ `FLOWCHART_STYLES` | Style constants for element identification | Possibly extended |
| `template-defaults.ts` → Supabase | Auto-upgrade via TEMPLATE_PREV_HASHES hash matching | New hash added for old content |
| `format-card/route.ts` → GPT-4o | POST with front + template content | Template content changes, API unchanged |

### External Services

| Service | Integration Pattern | v1.1 Notes |
|---------|---------------------|------------|
| GPT-4o via `/api/format-card` | POST from FlowView.tsx — unchanged | Template content is the only change vector |
| AnkiConnect `addNote`/`updateNoteFields` | FlowView.tsx — unchanged | editFront passed verbatim; richer HTML works as-is |
| Supabase (templates table) | TEMPLATE_PREV_HASHES auto-upgrade | Must add hash of old anki_flowchart content when updating default |

---

## Build Order (v1.1 Dependency Chain)

The v1.1 features have clear dependencies. Build in this order to allow incremental testing:

```
Step 1: Default Preview Mode
  File: FlowchartEditor.tsx
  Change: initialState.viewMode = "preview", update button labels
  Deps: None — one-line change
  Test: Load flowchart mode → should open in Preview immediately
  ↓

Step 2: Container Layout Fix
  File: FlowchartEditor.module.css
  Change: min-height on .canvas and .editorRoot, padding adjustments
  Deps: Step 1 (preview mode must be visible to see layout issue)
  Test: Short 2-3 box flowchart should not appear cramped
  ↓

Step 3: Edit-Mode Bug Fixes
  Files: FlowchartEditor.tsx (reducer + handlers), parse-flow-html.ts
  Change: Fix ADD_NODE leaf detection, REMOVE_NODE reconnect for branches,
          replace window.prompt with inline input for stepLabel
  Deps: Step 1 (bugs only visible in edit mode, default preview makes it
        easier to test edit mode deliberately)
  Test: Add/remove boxes, add/remove connections without crash
  ↓

Step 4: Richer AI Template + Parser/Serializer Extension
  Files: template-defaults.ts, parse-flow-html.ts, rebuild-flow-html.ts,
         flowchart-styles.ts (if new elements)
  Change: Updated anki_flowchart template prompt, new hash in TEMPLATE_PREV_HASHES,
          parser/serializer extended for any new HTML patterns
  Deps: Step 3 (richer HTML must not break the fixed parser)
  Test: Generate flowchart card → richer output → parse → edit → rebuild → save to Anki
  ↓

Step 5: FlowView.tsx Cleanup (optional)
  Files: FlowView.tsx
  Change: Suppress ankiPreview toggle when editorMode === "flowchart" (cosmetic)
  Deps: Steps 1-4
  Test: ankiPreview button should have no visible effect in flowchart mode
```

**Steps 1-2 are safe to implement in a single plan.** They are CSS/default-value changes with zero logic risk.

**Step 3 must be isolated.** Bug fixes in the reducer interact with parse edge cases. Test each reducer case independently before combining.

**Step 4 must be atomic.** Template content + parser + serializer must move together. A richer template that the parser cannot handle will crash the editor for any user who regenerates a card after the template auto-upgrades.

---

## Anti-Patterns

### Anti-Pattern 1: Moving viewMode to FlowView.tsx

**What people do:** Lift the preview/edit toggle up to the host so FlowView can control the mode externally (e.g., auto-switch to preview after save).

**Why it's wrong:** FlowView already has `ankiPreview` boolean for this purpose, and it controls the global preview for all editor types. Adding a second flowchart-specific mode prop to FlowchartEditor creates a confusing two-way interaction: the host can override the editor's internal mode, causing unpredictable behavior when the user toggled the editor independently.

**Do this instead:** Keep `viewMode` inside `FlowchartEditor`'s reducer state. If FlowView needs to reset the editor to preview after a specific action (e.g., after save), pass the `value` prop change — the existing `useEffect([value])` that calls `dispatch({ type: "LOAD" })` already resets `editingNodeId` and `connectMode`. Add `viewMode: "preview"` to the LOAD action's reset if needed.

### Anti-Pattern 2: Updating the Template Without Updating the Parser

**What people do:** Write a richer `anki_flowchart` prompt that causes GPT-4o to generate new HTML patterns (e.g., multi-level branches, new div roles), then deploy without updating `parseFlowHTML`.

**Why it's wrong:** Any user whose template auto-upgrades via `TEMPLATE_PREV_HASHES` will immediately get the richer HTML from the AI. If the parser doesn't recognize the new patterns, `parseFlowHTML` returns an empty/partial graph, triggering `parseFailed = true` and falling back to the raw textarea. The visual editor becomes inaccessible.

**Do this instead:** Design the richer template's HTML patterns first. Verify `parseFlowHTML` handles them. Extend `FLOWCHART_STYLES` and `parse-flow-html.ts` / `rebuild-flow-html.ts` in the same commit as the template content change.

### Anti-Pattern 3: Using window.prompt for stepLabel Input

**What people do:** The current implementation calls `window.prompt("Step label (optional):")` when creating a connection. This blocks the browser's main thread and cannot be styled.

**Why it's wrong:** On some browsers/environments `window.prompt` returns `null` on cancel, and the current code uses `?? ""` which adds an edge with an empty label (silent create). It also cannot be integrated into the design system.

**Do this instead:** Replace the two-click connect flow with an inline input that appears between the two connected nodes after the second click. Dispatch `ADD_EDGE` only when the user confirms (Enter key or blur). This is an in-place fix in `handleConnectClick` + a new inline-input render path in the editor.

### Anti-Pattern 4: Fixing Layout with Hardcoded Heights

**What people do:** Add `height: 400px` to `.editorRoot` to prevent collapse on short flowcharts.

**Why it's wrong:** A 5-node flowchart will have unnecessary empty space. A long flowchart will overflow or scroll awkwardly.

**Do this instead:** Use `min-height` not `height`, and let the content grow naturally. The `.canvas` div should be flex-column with `align-items: center` — this centers short flowcharts vertically without constraining long ones.

---

## Sources

- Direct inspection: `gapstrike/src/components/FlowchartEditor.tsx` (691 lines, current v1.0)
- Direct inspection: `gapstrike/src/components/FlowView.tsx` (ankiPreview, editorMode, modeContentRef state management)
- Direct inspection: `gapstrike/src/components/TableEditor.tsx` (parseTable/rebuildTable pattern reference)
- Direct inspection: `gapstrike/src/lib/parse-flow-html.ts` + `rebuild-flow-html.ts` + `flowchart-types.ts` + `flowchart-styles.ts`
- Direct inspection: `gapstrike/src/app/api/format-card/route.ts` (parseTemplateSections, section-based prompt building)
- Direct inspection: `gapstrike/src/lib/template-defaults.ts` (TEMPLATE_PREV_HASHES auto-upgrade mechanism)
- v1.0 phase 5 outcomes: `.planning/phases/05-polish-and-deploy/05-04-SUMMARY.md` (UX-01 through UX-04 follow-up items)
- Project constraints: `.planning/PROJECT.md` (inline styles, no JS in Anki cards, compact HTML, Vercel deploy)

---

*Architecture research for: FlowchartAnki v1.1 — Editor Polish integration analysis*
*Researched: 2026-03-09*
