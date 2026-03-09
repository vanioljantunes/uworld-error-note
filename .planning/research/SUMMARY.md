# Project Research Summary

**Project:** GapStrike FlowchartAnki — Visual HTML Flowchart Editor
**Domain:** AI-assisted Anki card editor with parse/edit/serialize pipeline for div-based HTML flowcharts
**Researched:** 2026-03-09
**Confidence:** HIGH

## Executive Summary

GapStrike is adding a visual editor for AI-generated HTML flowchart Anki cards. The core challenge is narrow and well-defined: parse a deterministic HTML string from GPT-4o into an editable graph model, let the user make targeted corrections, then serialize back to compact inline-style HTML that Anki accepts on all platforms. This is a correction layer, not a creation tool — the AI does the heavy lifting and the editor handles the last 10%. The recommended approach is a single `FlowchartEditor.tsx` component that owns a `FlowGraph` internal model, uses `DOMParser` to parse AI HTML on mount, renders interactive `NodeCard` and `EdgePill` sub-components, and rebuilds the HTML string on every mutation via a `rebuildHTML()` function. No canvas library, no global store, no serialization middleware is needed.

The most critical architectural decision is to replace the current Mermaid-based FlowchartEditor with an HTML-aware one, built on `html-react-parser` for parse-to-React-components and `useImmerReducer` for deep graph state mutations. The existing `FlowView.tsx` host and `TableEditor.tsx` sibling already define the correct contract — `value: string` in, `onChange(html: string)` out — and the new editor must match it exactly. The rebuild proceeds in a strict 7-step dependency chain: define types, implement parser, implement serializer, build sub-components, assemble editor, replace preview, integration smoke-test.

The key risk is parser brittleness: if GPT-4o generates an unexpected HTML variant, the DOMParser walk must degrade gracefully rather than silently corrupt the card. A secondary risk is cloze syntax breakage — the `{{cN::text::hint}}` strings must flow through every stage (parse, state, render, serialize) as raw text, never HTML-parsed or stripped. Both risks are manageable with explicit fallback paths and the "raw textarea" escape hatch. PITFALLS.md was not produced (agent interrupted), but the architecture and features research surfaces the same failure modes.

---

## Key Findings

### Recommended Stack

The project already has React 19 + Next.js 15 + TypeScript 5 installed. Only three additional packages are needed: `html-react-parser` (5.2.17, React 19 compatible) for replacing parsed DOM nodes with interactive React components via a `replace()` callback, `immer` (11.1.4) for safe deep mutations of the nested graph state, and `use-immer` (0.11.0) for the `useImmerReducer` hook that combines Immer with the reducer dispatch pattern. Everything else — `DOMParser`, `crypto.randomUUID()`, `useRef`/`outerHTML` for serialization — is browser-native with zero bundle cost.

See `.planning/research/STACK.md` for full alternatives analysis and version compatibility table.

**Core technologies:**
- `html-react-parser` 5.2.17: Parse AI HTML → React components — the only library that lets you swap specific DOM nodes for interactive React components via a `replace()` callback.
- `immer` 11.1.4 + `use-immer` 0.11.0: Deep graph state mutations — graph state is 3+ levels deep; spread-cloning at each level is error-prone; Immer's `produce()` handles this cleanly.
- Browser `DOMParser` (native): Parse HTML for element identification — superior to regex for nested structures; zero bundle cost.
- `ref.current.outerHTML` (native): Serialization — captures exactly what the browser rendered from inline styles; eliminates custom serializer drift risk.

**Avoid:**
- `@xyflow/react`: Canvas-based, outputs SVG, cannot produce inline-style HTML divs.
- Mermaid.js: Already replaced; Anki strips SVG output.
- `renderToStaticMarkup`: Broken in Next.js 15 client contexts (issue #57669).
- `dangerouslySetInnerHTML` on the editor pane: Renders statically — event handlers not attached.
- `contentEditable` on the full flowchart div: Users accidentally delete structural elements.

### Expected Features

The editor is a correction layer with a narrow interaction surface. The AI generates 90% correct output; the editor handles label fixes, box additions/removals, and connection adjustments.

See `.planning/research/FEATURES.md` for full prioritization matrix and dependency graph.

**Must have (table stakes — FLOW-01 through FLOW-09, TABL-05, INTG-01 through INTG-03):**
- Render AI HTML as visual boxes + arrows (FLOW-01) — the critical path blocker; every other operation depends on this.
- Click-to-edit box label inline with raw cloze passthrough (FLOW-02 + FLOW-08) — cloze syntax must survive editing verbatim.
- Rebuild compact, valid Anki HTML from model on every edit (FLOW-09) — output goes directly to Anki's FRONT field.
- Add/delete boxes with auto-layout (FLOW-03 + FLOW-04) — AI frequently adds one extra node or misses a step.
- Add/delete connections + edit connection labels (FLOW-05, FLOW-06, FLOW-07) — arrow labels carry clinical meaning.
- Fix cloze passthrough bug in existing TableEditor's `parseTable()` (TABL-05) — current regex strips HTML tags and can destroy cloze syntax.
- AnkiConnect push works with HTML card content (INTG-03) — finalizes the workflow.

**Should have (differentiators — v1.x, after core validation):**
- Cloze number auto-increment suggestion when adding boxes — avoids users manually tracking `maxClozeN`.
- "Regenerate" button in editor — practical undo for when AI output is too wrong to correct manually.
- Preview fidelity improvements — ensure GapStrike preview matches AnkiDroid rendering.

**Defer (v2+):**
- Drag-and-drop repositioning — requires solving DOM-order-as-layout; high implementation cost.
- Multiple box shapes (diamond, oval) — CSS rotation conflicts with cloze text alignment.
- Undo/redo — regenerate covers the common case; full history stack is v2.
- Color-coded boxes by cloze number — visual polish, not pedagogically necessary.

### Architecture Approach

The architecture follows the existing `TableEditor` contract exactly: `value: string` (raw HTML) in, `onChange(html: string)` out, all internal complexity hidden inside the component. `FlowchartEditor.tsx` owns a `FlowGraph` intermediate model (nodes + edges + branch groups + title), parses AI HTML into it on mount via `DOMParser`, renders `NodeCard` and `EdgePill` sub-components from the model, and calls `rebuildHTML()` → `onChange()` on every mutation. `FlowView.tsx` is untouched. The `FlowchartPreview` named export must be preserved to avoid breaking the existing import in FlowView.

See `.planning/research/ARCHITECTURE.md` for full data flow diagrams, anti-patterns, and the 7-step build order.

**Major components:**
1. `FlowView.tsx` — host; owns canonical `editFront` HTML string and mode switching; no changes needed.
2. `FlowchartEditor.tsx` — full replacement; contains `parseFlowHTML()`, `rebuildHTML()`, `NodeCard`, `EdgePill`; only file being written.
3. `FlowchartPreview` — named export from FlowchartEditor.tsx; read-only render via `dangerouslySetInnerHTML`.
4. `TableEditor.tsx` — minor bug fix only (`parseTable()` cloze passthrough).

**Key internal data model:**
```typescript
interface FlowGraph {
  title: string;           // never clozed
  nodes: FlowNode[];       // id, label (raw cloze), depth, branchIndex
  edges: FlowEdge[];       // fromId, toId, label (step pill text)
  branchGroups: string[][]; // groups of sibling node IDs in inline-flex parents
}
```

### Critical Pitfalls

PITFALLS.md was not produced. The following are derived from the architecture and features research, which surface the same failure modes.

1. **Cloze syntax stripping** — Anytime a label passes through an HTML parser, `.innerHTML`, or regex replace, `{{c1::text::hint}}` can be destroyed silently. Prevention: always use `.textContent` (not `.innerHTML`) when reading from `contentEditable` nodes; never apply `.replace(/<[^>]*>/g, "")` to label fields. Fix `parseTable()` immediately (TABL-05).

2. **Parser brittleness on GPT-4o output variation** — The DOMParser walk assumes a specific nested div structure. If GPT-4o generates a slightly different layout, the parse returns an empty or corrupted graph. Prevention: validate parse output (minimum 1 node, non-empty title); on failure, fall back to a raw `contentEditable` textarea rather than showing a broken visual editor.

3. **Structural div corruption via contentEditable** — Applying `contentEditable` to the full flowchart container lets users delete connector stems, branch wrappers, and step pills that are structural, not textual. Prevention: only label fields inside `NodeCard` and `EdgePill` get `contentEditable` — structural wrappers are pure React render output, not editable.

4. **Inline style drift between rebuildHTML and AI template** — If `rebuildHTML()` hard-codes style strings independently of the AI template definition, future template updates will cause visual divergence in edited cards. Prevention: define `FLOWCHART_STYLES` constants shared between parser (for element identification) and serializer (for HTML output); store template version in `FlowGraph` for future migration paths.

5. **`<style>` blocks in serialized output** — Anki strips `<style>` blocks from field content on sync and export. Prevention: `rebuildHTML()` must emit all styles inline; never accumulate shared CSS into a `<style>` block even for readability.

---

## Implications for Roadmap

Based on combined research, 4 phases are suggested, driven by the strict dependency chain in the architecture:

### Phase 1: Foundation — Data Model and Parse/Serialize Pipeline

**Rationale:** `parseFlowHTML()` and `rebuildHTML()` are the zero-dependency core. Every React component, every editing operation, every test depends on these functions working correctly. Building and unit-testing these in isolation (no React rendering) gives a stable foundation before UI complexity is added. This phase also eliminates the cloze-passthrough bug in `TableEditor` since it requires only a targeted fix.

**Delivers:** TypeScript `FlowGraph` types in `flowchart-types.ts`; working `parseFlowHTML(html) → FlowGraph`; working `rebuildHTML(graph) → html`; TABL-05 bug fixed; round-trip test (parse AI fixture → rebuild → string diff).

**Addresses:** FLOW-09, TABL-05.

**Avoids:** Parser brittleness (validated against real AI fixture HTML before any UI is built); style drift (FLOWCHART_STYLES defined once here, shared with all subsequent phases).

### Phase 2: Visual Rendering — NodeCard, EdgePill, and FlowchartEditor Shell

**Rationale:** With a working data model and serializer, the React rendering layer can be built on a solid foundation. This phase produces a visually correct editor where nodes and edges appear as styled boxes and step pills, even before inline editing works. Users can see the flowchart structure. `html-react-parser` is installed and the `replace()` callback wired here.

**Delivers:** `NodeCard` sub-component (styled box, non-editable yet); `EdgePill` sub-component (step-label pill); `FlowchartEditor` main component renders graph from state; `FlowchartPreview` named export (read-only, `dangerouslySetInnerHTML`); visual smoke-test in FlowView.

**Addresses:** FLOW-01 (render AI HTML as visual boxes + arrows).

**Uses:** `html-react-parser`, `useImmerReducer`, `DOMParser`.

### Phase 3: Editing Operations — Labels, Add/Remove, Connections

**Rationale:** Inline editing is added to the already-rendering components. This phase delivers the complete MVP editing surface. Each operation (edit label, add box, delete box, add/delete connection, edit connection label) follows the same pattern: mutate `FlowGraph` via reducer, call `rebuildHTML()`, call `onChange()`. Auto-layout (`assignPositions()`) is bundled with add-box (FLOW-03) because adding boxes without it degrades layout immediately.

**Delivers:** `contentEditable` labels in NodeCard + EdgePill with cloze passthrough; add/delete node operations; add/delete/edit edge operations; auto-layout for inserted nodes; AnkiConnect push validated with HTML content (INTG-03).

**Addresses:** FLOW-02, FLOW-03, FLOW-04, FLOW-05, FLOW-06, FLOW-07, FLOW-08, INTG-01, INTG-02, INTG-03.

**Avoids:** Cloze stripping (`.textContent` not `.innerHTML` on blur); structural corruption (only label spans are `contentEditable`).

### Phase 4: Polish and Validation — Error States, Preview Fidelity, UX Hardening

**Rationale:** After the core editing loop is functional and tested with real USMLE content, add the quality-of-life features that make the editor reliable in production. Includes: graceful parse failure fallback (raw textarea), parser robustness against GPT-4o variation, preview fidelity verification against AnkiDroid, and the v1.x differentiators if validation confirms user need.

**Delivers:** Graceful fallback to raw textarea on parse failure; "Regenerate" button; cloze-N auto-increment suggestion; AnkiDroid rendering verification; template version field in `FlowGraph` for future migrations.

**Addresses:** Auto-layout polish, cloze N auto-increment (v1.x differentiators).

**Avoids:** Leaving users stranded on parse failure; silent corruption from GPT-4o HTML variation.

---

### Phase Ordering Rationale

- **Parser before UI**: `parseFlowHTML()` and `rebuildHTML()` have no React dependency. Testing them in isolation before adding rendering complexity means bugs are caught at the cheapest point. This is the build order the architecture research mandates.
- **Rendering before editing**: A visual-but-non-editable editor confirms the data model is correct and the component hierarchy works before adding the complexity of `contentEditable` management.
- **All editing operations in one phase**: The add/delete/connect operations share the same reducer pattern. Bundling them avoids shipping a half-working editor between phases; the MVP is either complete or not.
- **Polish last**: Graceful fallbacks and UX hardening are not blockers for validating the core workflow with real users. Defer until the editing loop proves out.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Parser):** The exact HTML structure of the `anki_flowchart` template needs to be confirmed against the actual template in `gapstrike/src/lib/template-defaults.ts` before writing `parseFlowHTML()`. A misread of branching div nesting will corrupt the node tree. Read the template source and write a fixture test before coding.
- **Phase 3 (AnkiConnect with HTML):** The INTG-03 requirement (push HTML to Anki) should be verified against live AnkiConnect with a flowchart card — specifically confirm that `addNote`/`updateNoteFields` accepts the inline-style HTML format without escaping issues.

Phases with standard patterns (skip research-phase):
- **Phase 2 (Rendering):** `html-react-parser` replace callback is well-documented; the rendering approach exactly mirrors the existing `TableEditor` pattern.
- **Phase 4 (Polish):** Fallback patterns and "Regenerate" button are straightforward UX additions; no novel technical territory.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All library versions confirmed via npm registry; React 19 compat verified via GitHub issue; browser API availability is definitive. One MEDIUM flag: immer 11.1.4 version confirmed from search snippet rather than direct npm page fetch. |
| Features | HIGH | Based on direct codebase inspection (FlowView.tsx, TableEditor.tsx, FlowchartEditor.tsx), authored REQUIREMENTS.md, and official Anki docs. Feature boundaries are well-understood. |
| Architecture | HIGH | Derived from direct code inspection of the existing component contracts. The `value`/`onChange` pattern is already in production in TableEditor. No speculative architectural decisions. |
| Pitfalls | MEDIUM | PITFALLS.md was not produced (agent interrupted). Pitfalls in this summary are derived from architecture and features research — they surface the same failure modes but lack the systematic enumeration a dedicated pitfalls pass would provide. |

**Overall confidence:** HIGH — the three completed research files cover the decision space well. The missing PITFALLS.md is partially mitigated by the anti-patterns sections in ARCHITECTURE.md and the anti-features section in FEATURES.md.

### Gaps to Address

- **Anki template HTML structure confirmation**: Before writing `parseFlowHTML()`, read `gapstrike/src/lib/template-defaults.ts` to confirm the exact nesting of boxes, stems, branch wrappers, and step pills. The parser logic must match the actual template, not an assumed structure.
- **AnkiDroid HTML rendering behavior**: The features research references an AnkiDroid issue (#20227) at MEDIUM confidence. The specific behavior of `display:inline-flex` and unicode arrows on AnkiDroid should be smoke-tested during Phase 4 before declaring the editor production-ready.
- **Template versioning risk**: If the `anki_flowchart` template is updated in Supabase during development, the parser may silently break. The `TEMPLATE_PREV_HASHES` mechanism mentioned in STACK.md should be understood before Phase 1 coding starts.

---

## Sources

### Primary (HIGH confidence)
- `gapstrike/src/components/FlowView.tsx` — host integration contract
- `gapstrike/src/components/TableEditor.tsx` — parse/model/rebuild pattern to follow
- `gapstrike/src/components/FlowchartEditor.tsx` — Mermaid-based file to replace
- `gapstrike/src/lib/template-defaults.ts` — AI-generated HTML structure
- `flowchartAnki/.planning/REQUIREMENTS.md` — authored feature requirements (FLOW-01 through INTG-03)
- `.planning/PROJECT.md` — project constraints (inline styles, no JS, compact HTML)
- https://www.npmjs.com/package/html-react-parser — version 5.2.17 confirmed, last published Feb 2026
- https://github.com/remarkablemark/html-react-parser/issues/1501 — React 19 compat confirmed
- https://www.npmjs.com/package/immer — version 11.1.4 confirmed
- https://www.npmjs.com/package/use-immer — version 0.11.0 confirmed
- https://docs.ankiweb.net/templates/styling.html — Anki inline-styles requirement (official)
- https://react.dev/learn/manipulating-the-dom-with-refs — ref.current.outerHTML pattern (official)
- https://github.com/vercel/next.js/issues/57669 — renderToStaticMarkup broken in Next.js 14+ client context

### Secondary (MEDIUM confidence)
- https://github.com/ankidroid/Anki-Android/issues/20227 — AnkiDroid rendering behavior (specific version, may vary)
- General WebSearch synthesis on visual diagram editor UX patterns
- WebSearch: immer 11.1.4 — confirmed from search snippet (npm page returned 403)

### Tertiary (inferred — LOW confidence)
- PITFALLS.md: not produced; pitfall analysis inferred from anti-patterns in ARCHITECTURE.md and anti-features in FEATURES.md

---

*Research completed: 2026-03-09*
*Ready for roadmap: yes*
