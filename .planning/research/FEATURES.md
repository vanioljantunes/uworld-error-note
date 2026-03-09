# Feature Research

**Domain:** AI-generated Anki flowchart/table card visual editor (embedded in GapStrike Next.js app)
**Researched:** 2026-03-09
**Confidence:** HIGH — based on existing REQUIREMENTS.md, live codebase inspection, and web research on diagram editor UX patterns

---

## Context

This is not a general-purpose diagramming app. The workflow is narrow and specific:

1. User clicks "Flowchart" or "Table" in GapStrike's Anki panel
2. GPT-4o generates a pure HTML/CSS card with `{{cN::text::hint}}` cloze syntax
3. User inspects and edits the result visually (adjust labels, add/remove boxes or cells)
4. User pushes the HTML to Anki via AnkiConnect

The AI does the hard creative work. The editor is a correction layer, not a creation tool. This shapes what is table-stakes vs. what is overkill.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these makes the editor feel broken or unfinished.

#### Flowchart Editor

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Render AI-generated HTML as visual boxes+arrows | Without this, editor is just a raw text field — defeats the purpose | MEDIUM | Parse AI output into an internal node/edge model; re-render as React components |
| Click-to-edit box label inline | Universal expectation for any diagram editor; this is where cloze corrections happen | LOW | Input replaces `<div>` text on click; blur commits |
| Display `{{cN::text::hint}}` raw in edit fields | Cloze syntax must survive editing — stripping it breaks the Anki card | LOW | Input value = raw string including `{{...}}`; no parsing/rendering of cloze in the editor |
| Add new box | User may want to insert a step the AI missed | LOW | Append a new node to the model; connect to previous tail node by default |
| Delete box | AI often generates one extra node | LOW | Remove node + all edges referencing it |
| Add connection between boxes | Needed when AI misses a causal link | LOW | Click source node, click target node, optional label entry |
| Delete connection | AI sometimes generates spurious arrows | LOW | Click edge or edge label, press delete / X button |
| Edit connection label | Arrow labels like "inhibits" or "activates" carry clinical meaning | LOW | Inline input on edge label click |
| Live HTML output preview | User must see what the Anki card actually looks like | LOW | Read-only preview pane renders the reconstructed HTML — mirrors final Anki output |
| Reconstruct valid HTML from model on every edit | The output goes directly into Anki's FRONT field — must be valid and compact | MEDIUM | `rebuildFlowchart()` mirrors what `rebuildTable()` already does in TableEditor.tsx |

#### Table Editor (already partially implemented in TableEditor.tsx)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Render AI-generated HTML table as visual grid | Existing TableEditor.tsx already does this — must remain working | LOW | Already implemented; polish needed |
| Click-to-edit cell content inline | Core interaction; already implemented | LOW | Already works; add cloze passthrough verification |
| Display `{{cN::text::hint}}` raw in cells | Same as flowchart — cloze must not be stripped | LOW | Current `parseTable()` strips HTML tags via regex — must preserve cloze syntax |
| Add/remove rows | Already implemented | LOW | Already works |
| Add/remove columns | Already implemented | LOW | Already works |
| Edit table title / question text | Title carries the card's question; already implemented | LOW | Already works |
| Live HTML output (real-time onChange) | Already implemented | LOW | Already works via `emit()` |

#### Integration (both editors)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Editor opens after AI generation completes | The whole point — AI generates, user edits | LOW | Button triggers API call → opens editor with AI output as initial value |
| Editing updates the card's FRONT field in real-time | Card state must stay in sync | LOW | `onChange` prop wires back to parent FlowView state |
| Push to Anki via AnkiConnect works with HTML content | Finalizes the workflow | LOW | AnkiConnect `addNote` accepts HTML in field strings natively |
| Fallback when AI generation fails | Error states must not leave user stranded | LOW | Show error message + allow manual entry |

---

### Differentiators (Competitive Advantage)

Features that are not universally expected for Anki editors but are valuable given this specific domain.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Cloze-aware input display | Most Anki HTML editors hide cloze syntax or break it; displaying raw `{{c1::text::hint}}` while editing is rare | LOW | Simply treat cloze brackets as plain text in `<input>` — the "trick" is NOT stripping them |
| Auto-layout for new boxes | AI generates a specific structure; new boxes the user adds should flow naturally without manual positioning | MEDIUM | Column-based vertical flow: new nodes append below their parent. The existing `assignPositions()` DFS in FlowchartEditor.tsx already implements this logic and should be ported |
| Compact HTML output enforced by editor | AnkiDroid adds `<br>` for every newline — the editor must output whitespace-minimal HTML automatically; users cannot be expected to know this | LOW | `rebuildFlowchart()` must produce single-line output or minimal indentation; mirrors `rebuildTable()` which already does this |
| Unicode arrow rendering (not SVG) | SVG arrows require absolute positioning that breaks on AnkiDroid; unicode `&#8595;` / `&#8594;` work everywhere | LOW | Architecture decision baked into template — editor must not switch to SVG connectors |
| Cloze number auto-increment for new boxes | When user adds a box, they expect to type `c3::...` without knowing what N is next | MEDIUM | Track `maxClozeN` by scanning all labels in model; new boxes suggest next available N |
| Preview matches Anki rendering fidelity | GapStrike preview should visually match what appears in Anki desktop + AnkiDroid | MEDIUM | Preview pane uses same inline styles as the output HTML; no GapStrike-specific CSS in preview |

---

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem valuable but would conflict with the Anki output constraints or expand scope unsafely.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Drag-and-drop box repositioning | Feels natural for diagram editors | Pure HTML/CSS output cannot encode arbitrary x/y coordinates — any position change must translate to DOM order changes; implementing this correctly requires a full canvas-based renderer, not a div-based one | Re-order boxes via up/down buttons or by editing row/column integers; defer drag-and-drop to v2 |
| SVG arrow connectors | Prettier than unicode; common in diagramming tools | SVG `<tspan>` breaks Anki cloze positioning; SVG sizing is unreliable in AnkiDroid WebView | Use unicode arrows (`&#8595;` / `&#8594;`) as text nodes between div boxes — already validated approach |
| `<style>` blocks in output HTML | Cleaner to write CSS once in a block | Anki strips `<style>` blocks from card field content on sync and export — cards arrive with no styles | Inline styles only; `rebuildFlowchart()` must write all styles inline |
| JavaScript in card content | Could enable interactive cloze reveal effects | Anki's reviewer WebView does not execute JS in field HTML | Not needed — native cloze syntax handles reveal natively |
| Undo/redo in editors | Standard editor expectation | React controlled component model makes undo non-trivial without a library (e.g., immer + history stack); adds significant complexity for a correction tool used briefly | AI re-generation is cheap — "Regenerate" button is the practical undo for large mistakes; defer per-op undo to v2 |
| Rich text formatting in boxes (bold, italic, links) | Useful for emphasis | Box content is cloze-text; bold/italic markup inside `{{c1::text}}` is syntactically fragile and untested across Anki versions | Plain text + cloze syntax only in box labels; formatting belongs on the card's BACK field or in surrounding prose |
| Bidirectional sync: edit HTML → update visual editor | Full roundtrip editing | AI output HTML is generated once; the editor is a structured correction layer, not a full HTML editor. Maintaining parse ↔ build symmetry for arbitrary HTML is brittle | One direction: parse AI HTML once on load → internal model → rebuild on edit. If user wants raw HTML edit, expose a "raw" textarea fallback |
| Multiple box shapes (diamond, oval, hexagon) | Looks more like professional flowchart tools | HTML div boxes can only be rectangles without significant CSS gymnastics; diamonds require rotation transforms that break cloze text alignment | Rectangle boxes only in v1; shapes are v2 after layout is stable |
| Color-coded boxes by cloze number | Visual distinction helps studying | Adds UI complexity (color picker, cloze-number awareness) and creates inconsistent output across devices that override colors | Defer to v2; single consistent box color in v1 |

---

## Feature Dependencies

```
[FLOW-01: Render HTML visually]
    └──requires──> [FLOW-09: Parse AI HTML into internal model]
                       └──requires──> [INTG-01: AI generation produces parseable HTML]

[FLOW-02: Click-to-edit box label]
    └──requires──> [FLOW-01: Render HTML visually]

[FLOW-03: Add box]
    └──requires──> [FLOW-01: Render HTML visually]
    └──enhances──> [Auto-layout: assignPositions()]

[FLOW-04: Delete box]
    └──requires──> [FLOW-01: Render HTML visually]
    └──conflicts──> [FLOW-05: Add connection] (deleting a connected node must cascade-delete edges)

[FLOW-05: Add connection]
    └──requires──> [FLOW-01: Render HTML visually]

[FLOW-08: Display cloze raw]
    └──requires──> [FLOW-02: Click-to-edit box label]
    (if FLOW-02 is implemented without cloze passthrough, cloze breaks silently)

[TABL-05: Display cloze raw in cells]
    └──requires──> [TABL-02: Click-to-edit cell]
    (current parseTable() strips HTML tags — MUST be fixed before cloze is safe)

[INTG-03: Push HTML to Anki]
    └──requires──> [FLOW-09 / rebuildFlowchart()]
    └──requires──> [TABL-06 / rebuildTable()]
```

### Dependency Notes

- **FLOW-01 is the critical path blocker**: every flowchart editing operation requires a working HTML parser that produces an internal node/edge model. This is the core rebuild needed in FlowchartEditor.tsx (current code parses Mermaid syntax, not HTML).
- **TABL-05 has a subtle pre-existing bug**: `parseTable()` strips HTML tags via `.replace(/<[^>]*>/g, "")` which destroys `{{c1::text::hint}}` if the cloze somehow contains angle brackets, and more importantly loses any HTML formatting inside cells. This needs a targeted fix before the table editor is safe for cloze cards.
- **INTG-01 blocks FLOW-01**: the editor cannot parse AI output until the AI output format is stable. Template validation (Phase 1) must complete before editor rebuild (Phase 2).
- **Auto-layout enhances add-box**: position assignment is not strictly required to add a box (could place at end), but without it the layout degrades quickly. Should be bundled with FLOW-03.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed for the feature to be usable at all.

- [ ] FLOW-01: Parse AI HTML into node/edge model and render as visual boxes+arrows
- [ ] FLOW-02: Click-to-edit box label inline (with raw cloze passthrough)
- [ ] FLOW-08: Raw cloze display — `{{cN::text::hint}}` appears as-is in inputs
- [ ] FLOW-09: `rebuildFlowchart()` produces compact, valid Anki HTML from model
- [ ] FLOW-03 + FLOW-04: Add/delete boxes with auto-layout
- [ ] FLOW-05 + FLOW-06: Add/delete connections
- [ ] FLOW-07: Connection label editing
- [ ] TABL-05: Fix cloze passthrough in parseTable() (pre-existing bug)
- [ ] INTG-01 + INTG-02: Both editors open after AI generation with the AI HTML pre-loaded
- [ ] INTG-03: AnkiConnect push works with HTML card content

### Add After Validation (v1.x)

Features to add once the core editing loop is validated with real USMLE content.

- [ ] Cloze number auto-increment suggestion when adding a new box — add when users report needing to figure out the next cloze N manually
- [ ] "Regenerate" button in editor — cheap undo for cases where AI output is too wrong to correct manually; add when users find correction too tedious
- [ ] Preview fidelity improvements — add when AnkiDroid rendering diverges visibly from GapStrike preview

### Future Consideration (v2+)

Features to defer until core loop is stable.

- [ ] Drag-and-drop repositioning — requires solving DOM-order-as-layout; defer until div layout limitations are hit
- [ ] Multiple box shapes (diamond, oval) — defer; requires CSS rotation that conflicts with cloze text alignment
- [ ] Color-coded boxes by cloze number — defer; visual polish not pedagogically necessary
- [ ] Undo/redo — defer; regenerate covers the most common mistake
- [ ] LaTeX in box text — defer; no USMLE need established yet

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Render AI HTML as visual flowchart (FLOW-01) | HIGH | MEDIUM | P1 |
| Click-to-edit box label with cloze passthrough (FLOW-02 + FLOW-08) | HIGH | LOW | P1 |
| Rebuild compact HTML from model (FLOW-09) | HIGH | MEDIUM | P1 |
| Add/delete boxes (FLOW-03/04) | HIGH | LOW | P1 |
| Add/delete connections (FLOW-05/06) | MEDIUM | LOW | P1 |
| Edit connection labels (FLOW-07) | MEDIUM | LOW | P1 |
| Fix cloze passthrough in TableEditor (TABL-05) | HIGH | LOW | P1 |
| AnkiConnect push with HTML (INTG-03) | HIGH | LOW | P1 |
| Auto-layout for new boxes | MEDIUM | LOW | P1 (bundle with FLOW-03) |
| Preview pane (live HTML preview) | MEDIUM | LOW | P2 |
| Cloze N auto-increment suggestion | LOW | MEDIUM | P2 |
| Regenerate button | MEDIUM | LOW | P2 |
| Drag-and-drop repositioning | MEDIUM | HIGH | P3 |
| Multiple box shapes | LOW | HIGH | P3 |
| Undo/redo | MEDIUM | HIGH | P3 |

---

## Competitor Feature Analysis

The relevant comparison is not against general diagramming tools (Miro, Lucidchart) but against the narrow set of tools users might otherwise use to create Anki flowchart cards.

| Feature | Manual HTML in Anki editor | ClozeOverlapper add-on | Image Occlusion add-on | GapStrike (this project) |
|---------|---------------------------|------------------------|------------------------|--------------------------|
| AI generates card structure | No | No | No | Yes — core value |
| Visual editing of boxes | No | No | Yes (image-based) | Yes (div-based) |
| Cloze syntax native | Yes | Yes | No | Yes |
| Works on AnkiDroid | Yes | Yes | Partial | Yes |
| No add-on required | Yes | No | No | Yes |
| Inline style only (portable) | Manual | N/A | N/A | Enforced by editor |
| Flowchart structure | Manual | No | No | Yes |

**Takeaway:** No existing tool combines AI generation + visual editing + native cloze + no add-on requirement. The differentiator is the full workflow, not any single editing feature.

---

## Sources

- Project REQUIREMENTS.md: `C:/Users/vanio/OneDrive/Área de Trabalho/python/flowchartAnki/.planning/REQUIREMENTS.md` (HIGH confidence — authored requirements)
- Project PROJECT.md: `.planning/PROJECT.md` (HIGH confidence — project constraints)
- Existing TableEditor.tsx codebase inspection (HIGH confidence — live code)
- Existing FlowchartEditor.tsx codebase inspection (HIGH confidence — live code to replace)
- [Anki Styling & HTML docs](https://docs.ankiweb.net/templates/styling.html) (HIGH confidence — official)
- [AnkiDroid rendering issues](https://github.com/ankidroid/Anki-Android/issues/20227) (MEDIUM confidence — specific version, behavior may vary)
- [React Flow library patterns](https://reactflow.dev/) (MEDIUM confidence — WebSearch verified with official site)
- [GoJS inline editing features](https://github.com/projectstorm/react-diagrams) (LOW confidence — WebSearch only, not used in this project)
- Visual diagram editor UX patterns: general WebSearch synthesis (MEDIUM confidence — consistent across multiple sources)

---

*Feature research for: AI-generated Anki flowchart/table card visual editor (GapStrike / FlowchartAnki milestone)*
*Researched: 2026-03-09*
