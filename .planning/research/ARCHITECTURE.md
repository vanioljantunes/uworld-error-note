# Architecture Research

**Domain:** Visual editor for AI-generated HTML flowchart Anki cards
**Researched:** 2026-03-09
**Confidence:** HIGH (based on direct codebase inspection and first-principles analysis)

---

## Standard Architecture

### System Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                         FlowView.tsx (host)                            │
│  editorMode state | modeContentRef cache | editFront string state      │
├────────────────────┬───────────────────────────────────────────────────┤
│   FlowchartEditor  │         (parallel editors, same contract)         │
│ ┌───────────────┐  │  ┌─────────────────┐  ┌──────────────────────┐  │
│ │ parseFlowHTML │  │  │  TableEditor    │  │   QuestionEditor     │  │
│ │ (HTML→graph)  │  │  └─────────────────┘  └──────────────────────┘  │
│ ├───────────────┤  │                                                    │
│ │  FlowGraph    │  │  All editors share props:                         │
│ │  data model   │  │    value: string (raw HTML)                       │
│ │  nodes+edges  │  │    onChange: (val: string) => void                │
│ ├───────────────┤  │                                                    │
│ │ React render  │  │                                                    │
│ │ (graph→nodes) │  │                                                    │
│ ├───────────────┤  │                                                    │
│ │ rebuildHTML   │  │                                                    │
│ │ (graph→HTML)  │  │                                                    │
│ └───────────────┘  │                                                    │
├────────────────────┴───────────────────────────────────────────────────┤
│                         FlowchartPreview                               │
│  Read-only render of raw HTML via dangerouslySetInnerHTML              │
│  (strips cloze markers for display only)                               │
├────────────────────────────────────────────────────────────────────────┤
│                        Integration Layer                               │
│  /api/format-card → GPT-4o → raw HTML string                          │
│  AnkiConnect → addNote / updateNoteFields                              │
└────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `FlowView.tsx` | Host state, mode switching, AnkiConnect calls | useState/useRef, fetch() |
| `FlowchartEditor.tsx` | Bidirectional HTML↔graph editing | Pure React, no libraries |
| `parseFlowHTML()` | HTML string → FlowGraph data model | DOMParser + tree walk |
| `FlowGraph` (interface) | Normalized node/edge representation | Plain TS interface |
| `rebuildHTML()` | FlowGraph → compact inline-style HTML | Template string assembly |
| `NodeCard` (sub-component) | Single editable box (contentEditable) | Inline edit + cloze passthrough |
| `EdgePill` (sub-component) | Editable step-label pill between nodes | contentEditable |
| `FlowchartPreview` | Read-only HTML render for preview tab | dangerouslySetInnerHTML |

---

## Recommended Project Structure

```
gapstrike/src/components/
├── FlowchartEditor.tsx          # Full replacement — HTML-aware visual editor
│   ├── parseFlowHTML()          # HTML → FlowGraph (internal function)
│   ├── rebuildHTML()            # FlowGraph → HTML (internal function)
│   ├── NodeCard                 # Editable box sub-component
│   ├── EdgePill                 # Editable step-label sub-component
│   └── FlowchartPreview (export)# Read-only preview (keep export contract)
├── TableEditor.tsx              # Existing — minor polish only
└── QuestionEditor.tsx           # Existing — no changes needed
```

No new directories needed. The entire flowchart editor is a self-contained component with internal helpers. The `FlowchartPreview` named export must be preserved — FlowView.tsx imports it separately.

### Structure Rationale

- **Single file for editor:** All parsing/rendering/serialization logic stays co-located. The data model is private to the editor — FlowView only ever sees the HTML string.
- **Internal vs exported:** `FlowchartEditor` (default export) + `FlowchartPreview` (named export) match the existing import in FlowView.tsx. No import changes needed in the host.

---

## Architectural Patterns

### Pattern 1: Controlled HTML String as Editor State

**What:** The editor receives `value: string` (raw HTML) and calls `onChange(newHtml: string)` on every mutation. The host (`FlowView.tsx`) owns the canonical string in `editFront` state. The editor never stores the HTML string internally — it parses it into a `FlowGraph` on mount/value-change and serializes back on every edit.

**When to use:** Always. This matches the existing contract used by `TableEditor` and `QuestionEditor`.

**Trade-offs:** Parsing on every external `value` change adds a small overhead but keeps the host simple and all three editors interchangeable.

**Example:**
```typescript
// FlowView.tsx (host) — unchanged contract
<FlowchartEditor
  value={editFront}
  onChange={(val) => {
    setEditFront(val);
    if (ankiFrontRef.current) ankiFrontRef.current.innerHTML = val;
  }}
/>
```

```typescript
// FlowchartEditor.tsx — internal flow
function FlowchartEditor({ value, onChange }: Props) {
  const [graph, setGraph] = useState<FlowGraph>(() => parseFlowHTML(value));

  // Sync when external value changes (e.g., AI regeneration)
  useEffect(() => {
    setGraph(parseFlowHTML(value));
  }, [value]);

  const handleNodeEdit = (id: string, newLabel: string) => {
    const updated = { ...graph, nodes: graph.nodes.map(n => n.id === id ? { ...n, label: newLabel } : n) };
    setGraph(updated);
    onChange(rebuildHTML(updated));
  };
  // ...
}
```

### Pattern 2: FlowGraph as Intermediate Normalized Model

**What:** The HTML is structurally complex (nested divs, branching connectors, inline styles). Parse it once into a clean `FlowGraph` model, edit the model, then serialize back. The model is the single source of truth during editing.

**When to use:** Whenever HTML structure carries semantic meaning (boxes = nodes, step pills = edge labels, `inline-flex` wrappers = branch points). Without a model layer, editing the HTML directly risks silently corrupting structure.

**Trade-offs:** Requires a reliable parser. The HTML structure from `anki_flowchart` template is deterministic enough to parse reliably (fixed class of patterns).

**Example:**
```typescript
interface FlowNode {
  id: string;          // generated stable key (e.g., "n0", "n1")
  label: string;       // raw text including {{cN::...}} cloze syntax
  depth: number;       // tree depth (0 = root/title area)
  branchIndex?: number;// position within a sibling branch group
}

interface FlowEdge {
  fromId: string;
  toId: string;
  label: string;       // step pill text (e.g., "inhibits", "damages")
}

interface FlowGraph {
  title: string;        // bold title div text — never clozed
  nodes: FlowNode[];
  edges: FlowEdge[];
  branchGroups: string[][];  // groups of node IDs that share an inline-flex parent
}
```

### Pattern 3: DOMParser for HTML Parsing (not regex)

**What:** Use `new DOMParser().parseFromString(html, "text/html")` in the browser to parse the generated HTML into a real DOM tree, then walk it to extract nodes and edges. This is more reliable than regex for nested structures.

**When to use:** In the browser only (DOMParser is not available in SSR). The editor is `"use client"` so this is fine.

**Trade-offs:** Slightly more setup than regex, but avoids catastrophic failures on edge cases like nested quotes in inline styles. The TableEditor already avoids DOMParser by using regex — acceptable for tables (flat), but NOT for flowcharts (nested branching).

**Example:**
```typescript
function parseFlowHTML(html: string): FlowGraph {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const root = doc.body.firstElementChild; // outer <div style="text-align:center">
  if (!root) return DEFAULT_GRAPH;

  // Title: first child div with font-weight:bold
  // Nodes: divs with border:2px solid #3a3a3a
  // Branch groups: divs with display:inline-flex
  // Step pills: divs with font-style:italic
  // Walk and build FlowGraph...
}
```

---

## Data Flow

### AI Generation Flow (entry into editor)

```
User clicks "Flowchart" button
    ↓
handleSwitchEditor("flowchart") in FlowView.tsx
    ↓
POST /api/format-card { front: clozeHtml, template: anki_flowchart }
    ↓
GPT-4o generates inline HTML string
    ↓
setEditFront(htmlString)         ← modeContentRef["flowchart"] = htmlString
    ↓
FlowchartEditor receives value={htmlString}
    ↓
useEffect → parseFlowHTML(htmlString) → FlowGraph state
    ↓
React renders NodeCards + EdgePills from graph
```

### User Edit Flow (editor → host)

```
User clicks NodeCard → contentEditable focus
    ↓
User types new label (cloze syntax preserved verbatim)
    ↓
onBlur / onInput in NodeCard
    ↓
handleNodeEdit(nodeId, newLabel) in FlowchartEditor
    ↓
setGraph(updatedGraph)
    ↓
onChange(rebuildHTML(updatedGraph))     ← calls FlowView's onChange
    ↓
setEditFront(newHtml) in FlowView
    ↓
modeContentRef["flowchart"] = newHtml  (kept in sync by useEffect)
```

### Add/Remove Node Flow

```
User clicks "Add box" button
    ↓
addNode(afterId) in FlowchartEditor
    ↓
Insert FlowNode at position, add FlowEdge from predecessor
    ↓
setGraph(updated)
    ↓
onChange(rebuildHTML(updated))
```

### Save to Anki Flow (unchanged from existing)

```
User clicks "Save"
    ↓
handleSaveAnkiCard() in FlowView.tsx
    ↓
editFront (raw HTML with cloze) → AnkiConnect updateNoteFields / addNote
    ↓
Anki stores HTML verbatim — renders natively on all platforms
```

### State Management

```
FlowView.tsx (host state)
├── editFront: string              ← canonical HTML string for current mode
├── editorMode: EditorMode         ← "flowchart" | "table" | "cloze" | "question"
└── modeContentRef: Record<EditorMode, string>  ← per-mode content cache

FlowchartEditor.tsx (local state)
├── graph: FlowGraph               ← parsed from value prop, reset on value change
├── selectedNodeId: string | null  ← which box is being edited
└── addingEdge: boolean            ← UI mode for "connect two nodes"
```

The host never needs to know about `FlowGraph`. It only ever passes an HTML string in and receives an HTML string out.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (single editor) | Single-file component with internal helpers — correct scope |
| Multiple diagram types | Extract `parseFlowHTML`/`rebuildHTML` to `lib/flowchart-utils.ts` only if a second diagram type shares the same model |
| Drag-and-drop (v2) | Add position coordinates to `FlowNode`; `rebuildHTML` emits absolute-positioned divs; requires CSS position model change |
| Undo/redo (v2) | Maintain `history: FlowGraph[]` stack in editor; `Ctrl+Z` pops previous graph and calls `onChange(rebuildHTML(prev))` |

### Scaling Priorities

1. **First pain point:** Parser brittleness — if GPT-4o generates a slightly different HTML structure than expected, the parser must degrade gracefully. Solution: robust fallback to raw contentEditable when parse fails.
2. **Second pain point:** Branch rendering complexity — the `inline-flex` branching pattern is visually correct in Anki but harder to edit. The editor should flatten branches into a grid-based representation internally and only use `inline-flex` during `rebuildHTML`.

---

## Anti-Patterns

### Anti-Pattern 1: Using contentEditable on the Full HTML String

**What people do:** Render the entire generated HTML inside a `contentEditable` div and let the user edit it directly (like the current "cloze" mode does with `ankiFrontRef`).

**Why it's wrong:** The flowchart HTML has structural divs (connectors, branch wrappers, stem lines) that must not be editerable. Users will accidentally delete connectors. The `border:2px solid #3a3a3a` boxes and the `width:2px;height:15px` stems are visually identical-ish, making it hard to know what to click. Also: paste events can break inline styles.

**Do this instead:** Render the graph model as React components. Only the `label` fields of `FlowNode` and `FlowEdge` get `contentEditable` spans. Structural elements (stems, branch wrappers) are rendered by React, not editable.

### Anti-Pattern 2: Parsing HTML with Regex

**What people do:** Match `border:2px solid #3a3a3a` with regex to find boxes, as the current `TableEditor` does for `<td>` cells.

**Why it's wrong:** Flowchart HTML is deeply nested. A box inside a branch is nested 5+ levels deep. Regex cannot reliably distinguish a box div from a branch-wrapper div or a stem div — they all match `<div style="...">`. One malformed card will produce silent corruption.

**Do this instead:** Use `DOMParser` to get a real DOM, then walk the tree structurally. Identify nodes by the `border:2px solid #3a3a3a` style property (not regex string match), branch groups by `display: inline-flex`, step pills by `font-style: italic`.

### Anti-Pattern 3: Storing Structural HTML as Intermediate Format

**What people do:** Serialize the `FlowGraph` to a custom text format (like the old mermaid approach) and parse that instead of the raw HTML.

**Why it's wrong:** The card's FRONT field IS the HTML — it goes directly to Anki. Adding an intermediate format means maintaining two serialization paths and introduces a sync bug surface. If the user switches modes or saves mid-edit, the intermediate format must be converted back to HTML, and that conversion can drift from the AI-generated template style.

**Do this instead:** The HTML string is always the source of truth. Parse it to `FlowGraph` for editing, serialize back to HTML immediately on every mutation. No intermediate format.

### Anti-Pattern 4: Tight Coupling to Specific CSS Values

**What people do:** Hard-code `"border:2px solid #3a3a3a"` as a string literal in parse/rebuild logic, assuming the template never changes.

**Why it's wrong:** The `anki_flowchart` template stores style constants in Supabase and can be upgraded via `TEMPLATE_PREV_HASHES`. A template upgrade might change padding or border width, breaking the parser.

**Do this instead:** Define style constants in one place (`FLOWCHART_STYLES`) used by both `parseFlowHTML` (for element identification) and `rebuildHTML` (for serialization). The parser identifies elements by structure (depth, sibling context) as primary signal, with style matching as secondary.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| GPT-4o via `/api/format-card` | POST from FlowView.tsx — unchanged | Editor receives result as `value` prop change |
| AnkiConnect `addNote` | Called from FlowView.tsx after user hits Save | `editFront` is passed verbatim — editor has no AnkiConnect knowledge |
| AnkiConnect `updateNoteFields` | Same as addNote — FlowView owns this | No change needed for editor rebuild |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `FlowView.tsx` ↔ `FlowchartEditor` | Props only: `value: string`, `onChange: (val: string) => void` | Same contract as TableEditor — no shared state |
| `FlowchartEditor` ↔ `parseFlowHTML` | Function call: `string → FlowGraph` | Internal to component file |
| `FlowchartEditor` ↔ `rebuildHTML` | Function call: `FlowGraph → string` | Internal to component file |
| `FlowchartEditor` ↔ `FlowchartPreview` | None — they are sibling exports, no communication | Preview reads `value` directly from FlowView |

---

## Build Order (Dependency Chain)

The component has a strict internal dependency order. Each step depends on the previous:

```
Step 1: FlowGraph data model interface
    (no deps — defines the shape everything else uses)
    ↓
Step 2: parseFlowHTML() — HTML string → FlowGraph
    (depends on: FlowGraph interface, DOMParser)
    ↓
Step 3: rebuildHTML() — FlowGraph → HTML string
    (depends on: FlowGraph interface, FLOWCHART_STYLES constants)
    ↓
Step 4: NodeCard + EdgePill sub-components
    (depends on: FlowGraph types, contentEditable edit handlers)
    ↓
Step 5: FlowchartEditor main render + add/remove/connect operations
    (depends on: all of the above)
    ↓
Step 6: FlowchartPreview replacement
    (depends on: parseFlowHTML only — or use dangerouslySetInnerHTML directly)
    ↓
Step 7: Integration smoke-test in FlowView.tsx
    (depends on: Step 5, existing handleSwitchEditor logic)
```

This order allows incremental testing: Steps 2-3 can be unit-tested with fixture HTML before any React rendering. Steps 4-5 can be tested in isolation. Step 7 is the only step that requires the full app.

---

## Sources

- Direct inspection of `gapstrike/src/components/FlowView.tsx` (current host integration)
- Direct inspection of `gapstrike/src/components/FlowchartEditor.tsx` (mermaid-based, to be replaced)
- Direct inspection of `gapstrike/src/components/TableEditor.tsx` (pattern to follow: parse → model → rebuild)
- Template content in `gapstrike/src/lib/template-defaults.ts` (exact HTML structure the AI generates)
- Project requirements in `flowchartAnki/.planning/REQUIREMENTS.md` (FLOW-01 through FLOW-09)
- Project constraints in `.planning/PROJECT.md` (inline styles, no JS, compact HTML for AnkiDroid)

---

*Architecture research for: FlowchartAnki — HTML div-based flowchart editor in GapStrike*
*Researched: 2026-03-09*
