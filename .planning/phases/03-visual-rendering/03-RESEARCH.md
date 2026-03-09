# Phase 3: Visual Rendering - Research

**Researched:** 2026-03-09
**Domain:** React component rendering of a FlowGraph data model — CSS/SVG arrow layout, CSS Modules styling, dark-theme design system
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Editor-enhanced mode: same layout as Anki output but with editor-specific hints (hover effects, background grid, padding)
- Use GapStrike design system throughout (stone palette #EAEAE5, Inter font, stone borders)
  - **CORRECTION from code audit:** GapStrike uses a DARK theme (`--bg: #0c0c0c`, `--accent: #7c3aed`), not the light stone palette. "Design system" in context refers to patterns (glass-card, grid-dots) adapted to the dark theme.
- Subtle dot grid canvas background (design system's grid-dots pattern) to signal "this is an editor"
- Boxes have lift + shadow effect on hover (glass-card hover pattern from design system)
- Rounded cards: 8-12px border radius, white surface, stone border
  - **CORRECTION:** Actual app uses `var(--bg-elevated)` (#1a1a1a) surfaces with `var(--border)` (#2a2a2a) — dark surfaces, not white
- Cloze syntax `{{cN::text::hint}}` displayed as raw text with subtle accent background highlight (#5E6AD2 tint) so cloze markers are visually distinct
- Step label pills rendered as badge-style pills with background color — clearly visible between boxes
- Arrow/line rendering approach at Claude's discretion (CSS lines + unicode, SVG paths, or hybrid)
- Minimal header bar showing flowchart title + "Preview in Anki" toggle
- "Preview in Anki" toggle switches between interactive box/arrow view and dangerouslySetInnerHTML raw render
- No editing controls in Phase 3 — toolbar pattern established for Phase 4 to extend
- Scroll overflow for graphs larger than container (no zoom/pan controls)

### Claude's Discretion
- Arrow rendering implementation (CSS borders + unicode vs SVG paths vs hybrid)
- Header bar metadata (node count badge or title only)
- Exact spacing, typography sizes, and shadow values
- Layout computation approach (CSS flexbox mirroring template vs absolute positioning)
- Error state when parseFlowHTML returns empty/invalid graph

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FLOW-01 | Rebuilt flowchart editor renders the AI-generated HTML visually (boxes + arrows) | FlowGraph data model fully built in Phase 2 — NodeCard and EdgePill components map directly to `nodes`, `edges`, `branchGroups` |
| FLOW-08 | Cloze syntax `{{cN::text::hint}}` is displayed raw in the editor (not stripped) | `parseFlowHTML` already uses `textContent` to preserve cloze verbatim in `FlowNode.label` — display only needs to render `node.label` as text, not as HTML |
</phase_requirements>

---

## Summary

Phase 3 builds a new `FlowchartEditor.tsx` from scratch that reads a `FlowGraph` (already produced by `parseFlowHTML`) and renders it as visual React components — styled boxes connected by arrows — without any editing capability. The data model is completely done: `FlowNode`, `FlowEdge`, `BranchGroup`, and `FlowGraph` are defined and tested in Phase 2. Phase 3's job is pure presentation.

The key rendering challenge is reproducing the template's visual structure (vertical linear chains, horizontal branch fan-outs) as React components using CSS Modules. The existing Anki HTML template already encodes this layout — a top-down flow of boxes connected by stems (thin vertical lines) and pills (labeled badges), with branch nodes fanning out via an `inline-flex` horizontal wrapper. The React renderer should mirror this structure using flexbox, not canvas or an external graph library.

The app is dark-themed (CSS variables: `--bg: #0c0c0c`, `--accent: #7c3aed`). The CONTEXT.md reference to "stone palette" and "glass-card" patterns means the spirit of those design patterns adapted to this dark theme — frosted surfaces, lift-on-hover — not the light `#EAEAE5` color. The dot-grid background for the editor canvas is easily implemented via CSS `radial-gradient` (identical to `.grid-dots-dark` from the design system HTML). Three packages need installation before coding starts: `html-react-parser`, `immer`, `use-immer` (none are in `package.json` or `node_modules` yet).

**Primary recommendation:** Render the FlowGraph using a recursive React component tree that mirrors the template's flexbox structure — vertical `column`-direction flex for linear chains, `row`-direction for branch groups — using CSS Modules for all styling. No external graph layout library needed.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | `^19.0.0` | Component rendering | Already installed |
| Next.js 15 | `^15.1.3` | App framework | Already installed |
| immer | latest (`^10.x`) | Immutable state updates | Planned in Phase 2 decision log |
| use-immer | latest (`^0.10.x`) | `useImmerReducer` hook for React | Planned in Phase 2 decision log |
| html-react-parser | latest (`^5.x`) | Parse HTML to React for FlowchartPreview (dangerouslySetInnerHTML alternative) | Planned in Phase 2 decision log |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| CSS Modules | built-in | Scoped styles in `.module.css` | All FlowchartEditor styling — matches project convention |
| vitest + jsdom | `^4.0.18` / `^28.1.0` | Unit tests | Already configured, used for smoke-test in Plan 03-03 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS flexbox layout | React Flow / Dagre / elk.js | Graph libs add 50-200KB, overkill for a top-down template with known structure |
| CSS flexbox layout | SVG foreignObject | Unnecessary complexity — flexbox handles the linear + branch layout natively |
| html-react-parser for Preview | dangerouslySetInnerHTML directly | dangerouslySetInnerHTML is simpler and sufficient for read-only Preview; html-react-parser is still needed per Phase 2 plan |

**Installation:**
```bash
npm install immer use-immer html-react-parser
```

---

## Architecture Patterns

### Component Structure
```
src/components/
└── FlowchartEditor.tsx      # Default export (interactive) + named FlowchartPreview export
    ├── NodeCard              # Renders one FlowNode as a styled box
    ├── EdgePill              # Renders one stepLabel as a badge pill
    └── FlowRenderer          # Recursive layout component — walks nodes/edges/branchGroups
```

### Reducer Shape (useImmerReducer)
```typescript
type FlowState = {
  graph: FlowGraph;       // parsed from value prop
  viewMode: 'editor' | 'preview';  // toggles between interactive and dangerouslySetInnerHTML
};

type FlowAction =
  | { type: 'LOAD'; graph: FlowGraph }
  | { type: 'TOGGLE_VIEW' };
```

### Pattern 1: Top-Down Linear Chain
**What:** Nodes connected sequentially are rendered as a flex-column div. Between each box: a stem line (thin div), then a pill div, then a stem line, then the next box.
**When to use:** For any sequence of edges where `fromId → toId` is one-to-one.
**Example:**
```tsx
// Source: derived from FLOWCHART_STYLES pattern in gapstrike/src/lib/flowchart-styles.ts
<div className={styles.chain}>
  <NodeCard node={nodes[0]} />
  <div className={styles.stem} />
  <EdgePill label="depletes" />
  <div className={styles.stem} />
  <NodeCard node={nodes[1]} />
</div>
```

### Pattern 2: Branch Fan-Out
**What:** When `branchGroups` has a group for the current node, render branch arms side-by-side in a `flex-row` container.
**When to use:** When `branchMap.get(nodeId)` returns a non-empty array.
**Example:**
```tsx
// Source: mirrors inline-flex branch structure from FLOWCHART_STYLES.branchWrapper
<div className={styles.branchWrapper}>  {/* flex-row */}
  {childIds.map(childId => (
    <div key={childId} className={styles.branchArm}>
      <div className={styles.branchCorner} />  {/* CSS border trick for the L-shape */}
      <div className={styles.branchPadding}>
        <EdgePill label={edgeToChild.stepLabel} />
        <div className={styles.stem} />
        <NodeCard node={childNode} />
      </div>
    </div>
  ))}
</div>
```

### Pattern 3: NodeCard — Cloze Highlight
**What:** Box content rendered as plain text. Cloze markers `{{cN::...}}` highlighted via inline span wrapping using a regex split.
**When to use:** Always — every NodeCard must display cloze markers with accent tint.
**Example:**
```tsx
// FLOW-08: display cloze verbatim but highlight the markers
function highlightCloze(label: string): React.ReactNode {
  // Split on cloze pattern, wrap matches in highlighted span
  const parts = label.split(/({{c\d+::[^}]*}})/g);
  return parts.map((part, i) =>
    /^{{c\d+::/.test(part)
      ? <span key={i} className={styles.clozeHighlight}>{part}</span>
      : part
  );
}
```

### Pattern 4: FlowchartPreview Named Export
**What:** A separate named export that renders HTML read-only via `dangerouslySetInnerHTML`.
**When to use:** FlowView.tsx imports both `FlowchartEditor` (default) and `{ FlowchartPreview }` (named).
**Example:**
```tsx
// Source: FlowView.tsx line 8 — import FlowchartEditor, { FlowchartPreview } from "./FlowchartEditor"
export function FlowchartPreview({ value }: { value: string }) {
  return (
    <div
      className={styles.previewContainer}
      dangerouslySetInnerHTML={{ __html: value }}
    />
  );
}
```

### Pattern 5: Layout Walk Algorithm
**What:** Walk `FlowGraph` from root node (node with no incoming edges), recursively emitting React nodes. Mirrors the `emitNode` recursion in `rebuildHTML`.
**When to use:** In `FlowRenderer` to build the React element tree.
**Algorithm:**
```
rootNode = nodes.find(n => no edge has n as toId)
renderNode(nodeId):
  emit <NodeCard>
  if branchMap.has(nodeId):
    emit <stem>
    emit <branchWrapper> with one arm per childId
      each arm: <corner> + <pill(edge.stepLabel)> + <stem> + renderNode(childId)
  else if outgoing edges exist:
    emit <stem> + <pill(edge.stepLabel)> + <stem> + renderNode(toId)
  // leaf: stop
```

### Recommended CSS Module Classes for New FlowchartEditor
```
.editorRoot         # full container: dot-grid background, padding, overflow-y scroll
.editorHeader       # minimal bar: title + Preview toggle button
.editorCanvas       # centered column flex, contains the graph
.chain              # flex-column, align-items: center
.nodeCard           # the box: rounded, elevated bg, border, hover lift
.clozeHighlight     # inline span: accent tint background for {{cN::...}}
.stem               # thin vertical line (2px wide, ~15px tall)
.pill               # step label badge: border-radius 8px, small font
.branchWrapper      # flex-row, justify: center
.branchArm          # text-align: center column
.branchCorner       # CSS border trick: L-shape connector
.branchPadding      # padding: 0 16px
.previewContainer   # for FlowchartPreview: no special styling needed
.errorState         # empty/invalid graph message
```

### Anti-Patterns to Avoid
- **Rendering `node.label` as innerHTML:** Cloze syntax would be interpreted as HTML tags — always use text or the `highlightCloze` helper.
- **Absolute-positioned layout:** The template structure maps naturally to flexbox. Absolute positioning requires measuring DOM nodes before layout, which adds complexity and causes a layout flash.
- **Importing graph layout libraries:** React Flow, Dagre, ELK, etc. are for freeform graphs; this template has a fixed top-down structure — not needed.
- **useEffect to re-parse on every render:** `parseFlowHTML` is called once on mount (or when `value` prop changes). Use a `useEffect` with `[value]` dependency, not on every render cycle.
- **Storing parsed graph in parent:** The FlowchartEditor owns its own `FlowState` via `useImmerReducer`. The parent only provides the raw HTML `value` string and `onChange` callback.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Immutable state updates in reducer | Manual spread/clone | `immer` draft mutations | Nested state updates without immer cause subtle bugs with object identity |
| Cloze pattern splitting | Custom regex parser | Simple `String.split(/(regex)/g)` | The capture-group split trick is standard and handles all cloze cases in one line |
| Branch corner L-shapes | SVG paths | CSS `border-top + border-left/right` trick | The Anki template already uses this CSS border trick (in `FLOWCHART_STYLES.branchCornerLeft/Right`) — reuse the same approach |

**Key insight:** The layout algorithm is already proven — `rebuildHTML` does the same walk in string form. The React renderer is the same walk producing JSX instead of strings.

---

## Common Pitfalls

### Pitfall 1: Dark Theme vs. Design System File Mismatch
**What goes wrong:** CONTEXT.md mentions "stone palette #EAEAE5" and "glass-card" — a developer reads this, applies the light design system colors, and creates boxes with white backgrounds on a near-black app background — jarring visual mismatch.
**Why it happens:** The `design_system/design-system.html` file uses a light theme; the actual GapStrike app (`globals.css`) uses a dark theme with `--bg: #0c0c0c`.
**How to avoid:** Use CSS variables (`var(--bg-elevated)`, `var(--border)`, `var(--text)`, `var(--accent)`) for all colors. Use `grid-dots-dark` pattern (`radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)`) not `grid-dots`.
**Warning signs:** Any color literal like `#EAEAE5`, `#D6D3D1`, or `stone-300` in the new CSS file.

### Pitfall 2: Breaking the FlowchartPreview Import
**What goes wrong:** The new FlowchartEditor.tsx doesn't export `FlowchartPreview` as a named export, causing `FlowView.tsx` line 8 to break at compile time.
**Why it happens:** Developer focuses on the default export component, forgets the named export.
**How to avoid:** Plan 03-03 explicitly verifies this. The named export is simple — just a wrapper around `dangerouslySetInnerHTML`.
**Warning signs:** TypeScript error: `Module '"./FlowchartEditor"' has no exported member 'FlowchartPreview'`.

### Pitfall 3: Cloze Rendered as HTML Tags
**What goes wrong:** If `node.label` (which contains `{{c1::Thiamine deficiency}}`) is set as `innerHTML` or `dangerouslySetInnerHTML`, the curly braces are harmless — but if label text was accidentally HTML-encoded or if a future refactor passes `innerHTML`, cloze content would be stripped.
**Why it happens:** Confusing `textContent` (safe) with `innerHTML` (dangerous).
**How to avoid:** The `highlightCloze` helper uses `String.split` on the label string — purely string manipulation, never touching DOM APIs. The output is React text nodes + span elements.
**Warning signs:** Missing `{{c` characters in the rendered output.

### Pitfall 4: useImmerReducer Not Needed if State is Simple
**What goes wrong:** Phase 2 planned `useImmerReducer` for future editing. Phase 3 only needs `graph` (FlowGraph) and `viewMode` (boolean). Using immer for a two-field state is overkill but harmless — worth installing it anyway since Phase 4 will need it for mutations.
**Why it happens:** Over-engineering for current phase, under-preparing for next.
**How to avoid:** Install and use `useImmerReducer` in Phase 3 as planned — it costs nothing and Phase 4 extends it.
**Warning signs:** N/A — this is a "do it right" note, not an error condition.

### Pitfall 5: Edge Lookup in Branch Rendering
**What goes wrong:** When rendering a branch arm, the pill label (the step label from parent to child) must be looked up from `graph.edges` by matching `fromId === parentId && toId === childId`. A naive implementation might use the wrong edge or render an empty pill.
**Why it happens:** `branchGroups` stores only `parentId` and `childIds[]` — not the step labels. The labels live in `graph.edges`.
**How to avoid:** Build a Map during render setup: `edgeMap = new Map<string, FlowEdge>()` keyed by `${fromId}→${toId}`. This is exactly what `rebuildHTML` does with `outgoing` and `branchMap`.
**Warning signs:** Empty pills between the branch parent and its children.

---

## Code Examples

Verified patterns from official sources and project codebase:

### useImmerReducer Setup
```tsx
// Source: use-immer package — standard pattern
import { useImmerReducer } from 'use-immer';
import { parseFlowHTML } from '@/lib/parse-flow-html';
import { rebuildHTML } from '@/lib/rebuild-flow-html';
import type { FlowGraph } from '@/lib/flowchart-types';

type FlowState = { graph: FlowGraph; viewMode: 'editor' | 'preview' };
type FlowAction = { type: 'LOAD'; graph: FlowGraph } | { type: 'TOGGLE_VIEW' };

function reducer(draft: FlowState, action: FlowAction) {
  switch (action.type) {
    case 'LOAD':
      draft.graph = action.graph;
      break;
    case 'TOGGLE_VIEW':
      draft.viewMode = draft.viewMode === 'editor' ? 'preview' : 'editor';
      break;
  }
}

const EMPTY_GRAPH: FlowGraph = { title: '', nodes: [], edges: [], branchGroups: [] };

export default function FlowchartEditor({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const [state, dispatch] = useImmerReducer(reducer, {
    graph: EMPTY_GRAPH,
    viewMode: 'editor' as const,
  });

  useEffect(() => {
    if (value) {
      dispatch({ type: 'LOAD', graph: parseFlowHTML(value) });
    }
  }, [value]);

  // ...render
}
```

### CSS Module for Editor Canvas (dark theme)
```css
/* Source: derived from globals.css CSS variables + design-system.html grid-dots-dark pattern */
.editorRoot {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-image: radial-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px);
  background-size: 24px 24px;
  background-color: var(--bg);
  overflow-y: auto;
}

.nodeCard {
  background: var(--bg-elevated);
  border: 1px solid var(--border-hover);
  border-radius: 10px;
  padding: 8px 16px;
  color: var(--text);
  display: inline-block;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.nodeCard:hover {
  border-color: var(--accent-light);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.clozeHighlight {
  background: rgba(124, 58, 237, 0.18);
  border-radius: 3px;
  padding: 0 2px;
}

.pill {
  display: inline-block;
  padding: 2px 10px;
  font-size: 10px;
  color: var(--text-muted);
  font-style: italic;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-surface);
}
```

### Recursive Node Renderer Skeleton
```tsx
// Source: mirrors emitNode() in gapstrike/src/lib/rebuild-flow-html.ts
function FlowRenderer({ graph }: { graph: FlowGraph }) {
  const toIds = new Set(graph.edges.map(e => e.toId));
  const rootNode = graph.nodes.find(n => !toIds.has(n.id));
  if (!rootNode) return <div className={styles.errorState}>No valid graph</div>;

  const nodeById = new Map(graph.nodes.map(n => [n.id, n]));
  const branchMap = new Map(graph.branchGroups.map(g => [g.parentId, g.childIds]));
  const outgoing = new Map<string, FlowEdge[]>();
  for (const edge of graph.edges) {
    if (!outgoing.has(edge.fromId)) outgoing.set(edge.fromId, []);
    outgoing.get(edge.fromId)!.push(edge);
  }

  const visited = new Set<string>();

  function renderNode(nodeId: string): React.ReactNode {
    if (visited.has(nodeId)) return null;
    visited.add(nodeId);
    const node = nodeById.get(nodeId);
    if (!node) return null;

    const childIds = branchMap.get(nodeId);
    return (
      <div key={nodeId} className={styles.chain}>
        <NodeCard node={node} />
        {childIds ? (
          <>
            <div className={styles.stem} />
            <div className={styles.branchWrapper}>
              {childIds.map((childId, i) => {
                const edge = outgoing.get(nodeId)?.find(e => e.toId === childId);
                return (
                  <div key={childId} className={styles.branchArm}>
                    <div className={i === 0 ? styles.branchCornerLeft : styles.branchCornerRight} />
                    <div className={styles.branchPadding}>
                      <EdgePill label={edge?.stepLabel ?? ''} />
                      <div className={styles.stem} />
                      {renderNode(childId)}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (() => {
          const outs = outgoing.get(nodeId);
          if (!outs || outs.length === 0) return null;
          const { toId, stepLabel } = outs[0];
          return (
            <>
              <div className={styles.stem} />
              <EdgePill label={stepLabel} />
              <div className={styles.stem} />
              {renderNode(toId)}
            </>
          );
        })()}
      </div>
    );
  }

  return (
    <div className={styles.canvas}>
      {renderNode(rootNode.id)}
    </div>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| FlowchartEditor.tsx parses Mermaid text syntax | FlowchartEditor.tsx reads FlowGraph from parseFlowHTML | Phase 2 → Phase 3 | Editor is fully independent of HTML parsing; data model is the interface |
| dangerouslySetInnerHTML for the editor view | React components (NodeCard, EdgePill) rendering FlowGraph | Phase 3 | Enables Phase 4 editing without re-parsing HTML |

**Deprecated/outdated:**
- Old `FlowchartEditor.tsx` (731-line Mermaid editor): delete entirely in Plan 03-01. No code should be salvaged — it uses a different data model and parsing approach.

---

## Open Questions

1. **Branch corner CSS: left arm uses `margin-left: 50%`, right arm uses `margin-right: 50%`**
   - What we know: This is how the Anki HTML template creates the horizontal bracket (from `FLOWCHART_STYLES.branchCornerLeft/Right`). It works because the arm container is `text-align: center`.
   - What's unclear: Whether CSS Modules inline-flex context reproduces this faithfully, or if the 50% margin needs a different calculation when container widths vary.
   - Recommendation: Implement with the same CSS technique first; test with the branching fixture HTML. If alignment is off, switch to a pseudo-element approach.

2. **`html-react-parser` necessity in Phase 3**
   - What we know: `FlowchartPreview` only needs `dangerouslySetInnerHTML`. html-react-parser was planned in Phase 2 for potential use but Phase 3 may not strictly need it.
   - What's unclear: Whether Plan 03-01 should still install it (Phase 4 will need it).
   - Recommendation: Install it in 03-01 as planned (zero cost, Phase 4 dependency). Don't use it in Phase 3 — `FlowchartPreview` stays simple with `dangerouslySetInnerHTML`.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `gapstrike/vitest.config.ts` (exists, jsdom environment configured) |
| Quick run command | `cd gapstrike && npx vitest run tests/flow-round-trip.test.ts` |
| Full suite command | `cd gapstrike && npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FLOW-01 | FlowchartEditor renders AI HTML as visual boxes+arrows | smoke | `cd gapstrike && npx vitest run tests/flowchart-editor-smoke.test.ts` | ❌ Wave 0 |
| FLOW-08 | Cloze `{{cN::text::hint}}` displayed raw/verbatim in boxes | unit | `cd gapstrike && npx vitest run tests/flowchart-editor-smoke.test.ts` | ❌ Wave 0 |

**Note:** FLOW-01 visual rendering is inherently hard to unit test (requires DOM rendering). The smoke test validates that: (1) `FlowchartEditor` mounts without throwing, (2) `NodeCard` text content contains the cloze string verbatim for FLOW-08.

### Sampling Rate
- **Per task commit:** `cd gapstrike && npx vitest run tests/flow-round-trip.test.ts` (existing tests must stay green)
- **Per wave merge:** `cd gapstrike && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `gapstrike/tests/flowchart-editor-smoke.test.ts` — covers FLOW-01 (mount without error) and FLOW-08 (cloze text preservation in NodeCard output)

---

## Sources

### Primary (HIGH confidence)
- Direct code audit: `gapstrike/src/lib/flowchart-types.ts` — FlowGraph interface confirmed
- Direct code audit: `gapstrike/src/lib/parse-flow-html.ts` — parsing logic, textContent usage for cloze
- Direct code audit: `gapstrike/src/lib/rebuild-flow-html.ts` — walk algorithm to mirror in React
- Direct code audit: `gapstrike/src/lib/flowchart-styles.ts` — exact CSS values for the Anki template
- Direct code audit: `gapstrike/src/app/globals.css` — CSS variables (dark theme confirmed)
- Direct code audit: `gapstrike/package.json` — confirmed html-react-parser, immer, use-immer NOT installed
- Direct code audit: `gapstrike/vitest.config.ts` — jsdom environment, `@` alias configured
- Direct code audit: `gapstrike/tests/flow-round-trip.test.ts` — existing test suite structure

### Secondary (MEDIUM confidence)
- `design_system/design-system.html` — `.glass-card`, `.grid-dots-dark` CSS patterns (adapted for dark theme)
- `.planning/phases/03-visual-rendering/03-CONTEXT.md` — locked decisions and discretion areas

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — packages confirmed from package.json audit; only 3 packages need installing
- Architecture: HIGH — layout algorithm directly derived from existing `rebuildHTML` source code; no speculation
- Pitfalls: HIGH — dark/light theme mismatch and named export pitfalls verified by reading actual source files

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable — Next.js 15 + React 19 + vitest 4 all stable releases)
