# Roadmap: FlowchartAnki

## Milestones

- ✅ **v1.0 AI-Generated Flowchart and Table Cards** - Phases 1-5 (shipped 2026-03-10)
- 🚧 **v1.1 Editor Polish** - Phases 6-9 (in progress)

## Phases

<details>
<summary>✅ v1.0 AI-Generated Flowchart and Table Cards (Phases 1-5) — SHIPPED 2026-03-10</summary>

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
- [x] 01-03-PLAN.md — Save dual cards (HTML + cloze) via handleMakeCard; human-verify Anki rendering (TMPL-06, INTG-03, INTG-04)

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
- [x] 02-01-PLAN.md — Install Vitest, define FlowGraph types and FLOWCHART_STYLES, implement parseFlowHTML with DOMParser
- [x] 02-02-PLAN.md — Implement rebuildHTML serializer, write round-trip fixture tests
- [x] 02-03-PLAN.md — Fix TableEditor parseTable() cloze passthrough bug

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
**Plans**: 5 plans

Plans:
- [x] 04-01-PLAN.md — TDD: Reducer mutations (EDIT_NODE, ADD_NODE, REMOVE_NODE, ADD_EDGE, REMOVE_EDGE, REORDER_NODE) + onChange wiring with hasUserEdited guard
- [x] 04-02-PLAN.md — EditableNodeCard UI, toolbar (Add Box, Connect, Delete), node hover controls (reorder, remove), connect mode
- [x] 04-03-PLAN.md — TableEditor mutation tests verifying TABL-01 through TABL-06 against existing implementation
- [x] 04-04-PLAN.md — Human-verify end-to-end integration: Flowchart + Table buttons trigger AI generation then open editors with working editing (INTG-01, INTG-02)
- [x] 04-05-PLAN.md — Gap closure: Wire REMOVE_EDGE dispatch to EdgePill UI (FLOW-06)

### Phase 5: Polish and Deploy
**Goal**: The editor handles parse failures gracefully, renders correctly on AnkiDroid, and the full feature is deployed to production on Vercel
**Depends on**: Phase 4
**Requirements**: TMPL-06
**Success Criteria** (what must be TRUE):
  1. When the AI generates malformed or unexpected HTML, the editor shows a raw textarea fallback instead of a broken visual editor
  2. A flowchart card generated and edited in GapStrike renders correctly on AnkiDroid (boxes visible, cloze syntax intact)
  3. The deployed Vercel app at gapstrike.vercel.app includes all flowchart and table editor changes with no regressions
**Plans**: 4 plans

Plans:
- [x] 05-01-PLAN.md — Parse-failure fallback: Error Boundary + textarea fallback + unit tests for detection logic
- [x] 05-02-PLAN.md — AnkiDroid smoke-test: verify flowchart and table cards render on mobile
- [x] 05-03-PLAN.md — Deploy to Vercel: local build verification, git push, production smoke-test
- [ ] 05-04-PLAN.md — Gap closure: diagnose stale production deploy (Issue 1 + 2), redeploy, human smoke-test

</details>

### 🚧 v1.1 Editor Polish (In Progress)

**Milestone Goal:** Simplify the editor to two modes (Preview default + Edit), fix editing bugs, improve AI card richness, and polish container layouts.

#### Phase 6: Mode Simplification and Layout
**Goal**: Users open the flowchart editor and see the rendered Anki card immediately — no edit scaffolding on load; exactly two mode buttons are visible; the format button row never overflows on narrow screens
**Depends on**: Phase 5
**Requirements**: UX-01, UX-02, LAY-01
**Success Criteria** (what must be TRUE):
  1. When the flowchart editor opens, it displays the Anki-rendered preview by default — no raw node/edge UI is visible until the user clicks "Edit"
  2. The editor shows exactly two mode labels — "Preview" and "Edit" — with no other view mode options present anywhere in the UI
  3. The format button row (Flowchart, Table, Cloze, etc.) wraps to a second line rather than overflowing or getting cropped on a narrow panel
**Plans**: 2 plans

Plans:
- [x] 06-01-PLAN.md — Preview default mode, toggle pair UI (Preview/Edit tabs), eye-toggle conditional hide (UX-01, UX-02) (completed 2026-03-10)
- [x] 06-02-PLAN.md — Format button row flex-wrap fix, human-verify all Phase 6 visual changes (LAY-01) (completed 2026-03-10)

#### Phase 7: Reducer Bug Fixes and FlowView Data-Flow
**Goal**: All add/remove/reconnect operations in Edit mode complete without crashes or silent data corruption; the Back field always shows the original extraction text after flowchart generation
**Depends on**: Phase 6
**Requirements**: BUG-01, BUG-02, BUG-03, BUG-04
**Success Criteria** (what must be TRUE):
  1. Removing a node that has a branch parent correctly reconnects its children to the branch — no orphaned nodes or broken arrows result
  2. Adding a new node when the graph has no existing leaf nodes (disconnected graph) succeeds without crashing or producing invalid graph state
  3. When the user cancels the step-label prompt (presses Escape or Cancel), no new edge is created — the connection attempt is fully aborted
  4. After clicking "Flowchart" or "Table", the Back field in the card editor still shows the original extraction text, not the generated HTML
**Plans**: 2 plans

Plans:
- [ ] 07-01-PLAN.md — TDD: Fix REMOVE_NODE branch-parent reconnect (BUG-01) and ADD_NODE selectedNodeId parent model (BUG-02)
- [ ] 07-02-PLAN.md — Replace window.prompt with inline StepLabelInput (BUG-03), fix Back field preservation (BUG-04), human-verify

#### Phase 8: Richer AI Template (Atomic)
**Goal**: AI-generated flowchart cards contain 5-7 nodes with labeled causal arrows and cloze on mechanism steps only; the visual editor parses and serializes the new HTML structure without falling back to raw textarea
**Depends on**: Phase 7
**Requirements**: TMPL-07
**Success Criteria** (what must be TRUE):
  1. A newly generated flowchart card contains 5-7 boxes connected by arrows labeled with causal verbs ("inhibits", "activates", "converts") — not generic 3-4 node chains
  2. Cloze syntax appears on mechanism steps only, not on trigger inputs or leaf outcome nodes
  3. `parseFlowHTML` correctly parses the new richer HTML structure without triggering the `parseFailed` textarea fallback for any of 5 test inputs
  4. Uncustomized user templates auto-upgrade to the richer structure on the next generation call (via `TEMPLATE_PREV_HASHES`)
**Plans**: 2 plans

Plans:
- [ ] 08-01-PLAN.md — Atomic rewrite of anki_flowchart template (richer prompt + expanded arrow vocab + DKA/ACE inhibitor examples), TEMPLATE_PREV_HASHES update, richer-structure parse test fixtures
- [ ] 08-02-PLAN.md — Test template against 5 diverse USMLE extractions via live GPT-4o, validate parseability, human-verify rendered output in editor

#### Phase 9: Verification and Deploy
**Goal**: All v1.1 changes are smoke-tested end-to-end and deployed to production at gapstrike.vercel.app with no regressions
**Depends on**: Phase 8
**Requirements**: (no new requirements — cross-cutting verification)
**Success Criteria** (what must be TRUE):
  1. `npm run build` completes with zero TypeScript errors and zero build warnings from v1.1 changes
  2. Generating a flowchart card and pushing it to Anki via AnkiConnect succeeds end-to-end in the deployed production app
  3. The TableEditor is unbroken — generating a table card, editing a cell, and pushing to Anki still works after all v1.1 changes
  4. The deployed app at gapstrike.vercel.app reflects all v1.1 changes (confirmed by checking the two-mode UI and richer flowchart output)
**Plans**: TBD

Plans:
- [ ] 09-01: Local build verification (`npm run build`), regression smoke-test (flowchart + table end-to-end), Vercel deploy with `npx vercel --prod --force` if needed

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Templates | v1.0 | 3/3 | Complete | 2026-03-09 |
| 2. Data Model and Parse/Serialize Pipeline | v1.0 | 3/3 | Complete | 2026-03-09 |
| 3. Visual Rendering | v1.0 | 2/2 | Complete | 2026-03-09 |
| 4. Editing Operations | v1.0 | 5/5 | Complete | 2026-03-10 |
| 5. Polish and Deploy | v1.0 | 3/4 | Gap closure | - |
| 6. Mode Simplification and Layout | v1.1 | 2/2 | Complete | 2026-03-10 |
| 7. Reducer Bug Fixes and FlowView Data-Flow | 1/2 | In Progress|  | - |
| 8. Richer AI Template (Atomic) | 1/2 | In Progress|  | - |
| 9. Verification and Deploy | v1.1 | 0/1 | Not started | - |
