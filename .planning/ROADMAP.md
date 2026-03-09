# Roadmap: FlowchartAnki

## Overview

GapStrike gains AI-generated flowchart and table Anki cards with visual editing. The journey starts by validating the HTML templates that GPT-4o generates (Phase 1, mostly complete), then building the data model and parse/serialize pipeline that all editor components depend on (Phase 2), then rendering the flowchart visually in React (Phase 3), then adding inline editing operations for labels, boxes, and connections plus completing the table editor (Phase 4), and finally hardening the system against edge cases and deploying to Vercel (Phase 5).

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Templates** - AI prompt templates generate valid inline-style HTML with native cloze syntax
- [x] **Phase 2: Data Model and Parse/Serialize Pipeline** - FlowGraph types, parseFlowHTML, rebuildHTML, and TableEditor cloze fix (completed 2026-03-09)
- [x] **Phase 3: Visual Rendering** - FlowchartEditor renders AI HTML as interactive boxes and arrows (no editing yet) — complete (2026-03-09)
- [ ] **Phase 4: Editing Operations** - Inline label editing, add/remove boxes, add/remove connections, table editor polish
- [ ] **Phase 5: Polish and Deploy** - Error fallbacks, UX hardening, AnkiDroid smoke-test, Vercel deploy

## Phase Details

### Phase 1: Templates
**Goal**: AI-generated HTML templates produce valid, compact, inline-style Anki cards with native cloze syntax for both flowcharts and tables
**Depends on**: Nothing (first phase)
**Requirements**: TMPL-01, TMPL-02, TMPL-03, TMPL-04, TMPL-05, TMPL-06, INTG-03, INTG-04
**Success Criteria** (what must be TRUE):
  1. Clicking "Flowchart" generates a card whose FRONT field contains only div-based HTML with inline styles (no Mermaid, no `<style>` blocks, no SVG)
  2. Clicking "Table" generates a card whose FRONT field contains an HTML table with inline styles and no `<style>` blocks
  3. Generated cloze syntax `{{cN::text::hint}}` appears verbatim in the HTML and survives the AnkiConnect push to Anki
  4. The original simple cloze card is also saved alongside the flowchart/table card (user retains both formats)
  5. Generated HTML renders without visual breakage in Anki's desktop card viewer
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — Rewrite anki_flowchart template for div-based HTML output
- [x] 01-02-PLAN.md — Polish anki_table template for inline styles and compact output
- [ ] 01-03-PLAN.md — Save dual cards (HTML + cloze) via handleMakeCard; human-verify Anki rendering (TMPL-06, INTG-03, INTG-04)

### Phase 2: Data Model and Parse/Serialize Pipeline
**Goal**: A working FlowGraph data model with parseFlowHTML and rebuildHTML functions that can round-trip AI-generated HTML without corruption, plus the TableEditor cloze passthrough bug fixed
**Depends on**: Phase 1
**Requirements**: FLOW-09, TABL-05
**Success Criteria** (what must be TRUE):
  1. `parseFlowHTML(html)` returns a valid FlowGraph (nodes, edges, branchGroups, title) from a real AI-generated flowchart HTML fixture
  2. `rebuildHTML(graph)` produces compact, valid Anki HTML (inline styles only, no `<style>` blocks, no newlines between tags)
  3. A round-trip test — parse then rebuild — produces HTML that renders identically to the original in a browser
  4. Cloze syntax `{{cN::text::hint}}` survives parse and rebuild verbatim (not stripped, not HTML-encoded)
  5. TableEditor's `parseTable()` no longer strips cloze syntax when reading cell contents
**Plans**: 3 plans

Plans:
- [ ] 02-01-PLAN.md — Install Vitest, define FlowGraph types and FLOWCHART_STYLES, implement parseFlowHTML with DOMParser
- [ ] 02-02-PLAN.md — Implement rebuildHTML serializer, write round-trip fixture tests
- [ ] 02-03-PLAN.md — Fix TableEditor parseTable() cloze passthrough bug

### Phase 3: Visual Rendering
**Goal**: FlowchartEditor.tsx is rebuilt from scratch and renders AI-generated flowchart HTML as visual interactive boxes and arrows using the Phase 2 data model — no editing yet, just correct visual output
**Depends on**: Phase 2
**Requirements**: FLOW-01, FLOW-08
**Success Criteria** (what must be TRUE):
  1. The Flowchart button in GapStrike's Anki panel opens the visual editor with the AI-generated flowchart displayed as styled boxes and connecting arrows
  2. Each box displays its raw text content including cloze syntax `{{cN::text::hint}}` verbatim (not stripped or rendered)
  3. Edge step labels appear as pills between boxes, displaying their raw label text
  4. FlowchartPreview named export renders the same HTML read-only via dangerouslySetInnerHTML and the existing FlowView.tsx import is unbroken
**Plans**: 2 plans

Plans:
- [x] 03-01-PLAN.md — Install deps, delete old FlowchartEditor, build new component with NodeCard/EdgePill/FlowRenderer + CSS Module + smoke tests
- [x] 03-02-PLAN.md — Human-verify visual rendering with real AI-generated flowchart HTML

### Phase 4: Editing Operations
**Goal**: Users can inline-edit box labels, add/remove boxes, add/remove/edit connections, and the table editor supports full cell editing — all changes update the card's FRONT field HTML in real-time
**Depends on**: Phase 3
**Requirements**: FLOW-02, FLOW-03, FLOW-04, FLOW-05, FLOW-06, FLOW-07, FLOW-09, TABL-01, TABL-02, TABL-03, TABL-04, TABL-06, INTG-01, INTG-02
**Success Criteria** (what must be TRUE):
  1. User can click a flowchart box and type a new label (including cloze syntax) — the card FRONT field updates immediately with the new text
  2. User can add a new box to the flowchart — a new node appears in the visual editor and the card FRONT field reflects the addition
  3. User can remove a box — it disappears from the visual editor and the serialized HTML no longer contains it
  4. User can add or remove an arrow between two boxes, with an optional step label — the card FRONT field reflects the change
  5. User can click a table cell and edit its content including cloze syntax — the card FRONT field updates immediately
  6. User can add and remove rows and columns in the table editor
**Plans**: 4 plans

Plans:
- [ ] 04-01-PLAN.md — TDD: Reducer mutations (EDIT_NODE, ADD_NODE, REMOVE_NODE, ADD_EDGE, REMOVE_EDGE, REORDER_NODE) + onChange wiring with hasUserEdited guard
- [ ] 04-02-PLAN.md — EditableNodeCard UI, toolbar (Add Box, Connect, Delete), node hover controls (reorder, remove), connect mode
- [ ] 04-03-PLAN.md — TableEditor mutation tests verifying TABL-01 through TABL-06 against existing implementation
- [ ] 04-04-PLAN.md — Human-verify end-to-end integration: Flowchart + Table buttons trigger AI generation then open editors with working editing (INTG-01, INTG-02)

### Phase 5: Polish and Deploy
**Goal**: The editor handles parse failures gracefully, renders correctly on AnkiDroid, and the full feature is deployed to production on Vercel
**Depends on**: Phase 4
**Requirements**: TMPL-06
**Success Criteria** (what must be TRUE):
  1. When the AI generates malformed or unexpected HTML, the editor shows a raw textarea fallback instead of a broken visual editor
  2. A flowchart card generated and edited in GapStrike renders correctly on AnkiDroid (boxes visible, cloze syntax intact)
  3. The deployed Vercel app at gapstrike.vercel.app includes all flowchart and table editor changes with no regressions
**Plans**: TBD

Plans:
- [ ] 05-01: Add parse-failure detection to FlowchartEditor; show raw contentEditable textarea fallback on empty/invalid FlowGraph
- [ ] 05-02: AnkiDroid smoke-test — verify inline-flex and unicode arrows render; note any rendering issues
- [ ] 05-03: Deploy to Vercel; verify production build passes; confirm live app works end-to-end

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Templates | 2/3 | In progress | - |
| 2. Data Model and Parse/Serialize Pipeline | 3/3 | Complete   | 2026-03-09 |
| 3. Visual Rendering | 2/2 | Complete    | 2026-03-09 |
| 4. Editing Operations | 0/4 | Not started | - |
| 5. Polish and Deploy | 0/3 | Not started | - |
