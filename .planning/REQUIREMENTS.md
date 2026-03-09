# Requirements: FlowchartAnki

**Defined:** 2026-03-08
**Core Value:** AI-generated flowchart and table cards with visual editing in GapStrike, rendered as pure HTML/CSS with native Anki cloze syntax.

## v1 Requirements

### Template Prompts

- [x] **TMPL-01**: Flowchart template prompt generates pure HTML/CSS (no Mermaid) with `{{cN::text::hint}}` cloze syntax inside boxes
- [x] **TMPL-02**: Flowchart HTML uses simple styled divs for boxes and CSS/SVG for arrow connectors
- [x] **TMPL-03**: Flowchart supports labeled arrows (e.g., "inhibits", "activates") between boxes
- [x] **TMPL-04**: Flowchart cloze placement follows existing rules (2-3 mechanism nodes, not triggers)
- [x] **TMPL-05**: Table template prompt polished for consistent HTML output with inline styles
- [x] **TMPL-06**: Generated HTML renders correctly in Anki's card viewer on desktop and mobile

### Flowchart Editor

- [ ] **FLOW-01**: Rebuilt flowchart editor renders the AI-generated HTML visually (boxes + arrows)
- [ ] **FLOW-02**: User can click a box to edit its text/cloze content inline
- [ ] **FLOW-03**: User can add new boxes to the flowchart
- [ ] **FLOW-04**: User can remove boxes from the flowchart
- [ ] **FLOW-05**: User can add connections (arrows) between boxes with optional labels
- [ ] **FLOW-06**: User can remove connections
- [ ] **FLOW-07**: User can reorder/reposition boxes
- [ ] **FLOW-08**: Cloze syntax `{{cN::text::hint}}` is displayed raw in the editor (not stripped)
- [ ] **FLOW-09**: Editing the flowchart updates the card's FRONT field HTML in real-time

### Table Editor

- [ ] **TABL-01**: Table editor renders the AI-generated HTML table visually
- [ ] **TABL-02**: User can click a cell to edit its text/cloze content inline
- [ ] **TABL-03**: User can add/remove rows
- [ ] **TABL-04**: User can add/remove columns
- [x] **TABL-05**: Cloze syntax displayed raw in cells (not stripped)
- [ ] **TABL-06**: Editing the table updates the card's FRONT field HTML in real-time

### Integration

- [ ] **INTG-01**: Flowchart button in GapStrike's Anki panel triggers AI generation then opens the visual editor
- [ ] **INTG-02**: Table button in GapStrike's Anki panel triggers AI generation then opens the visual editor
- [x] **INTG-03**: Card is saved to Anki via AnkiConnect with the inline HTML in the FRONT field
- [x] **INTG-04**: Original simple cloze card remains saved (user can choose between formats)

## v2 Requirements

### Enhanced Visuals

- **VIS-01**: Multiple box shapes (diamond for decisions, oval for start/end)
- **VIS-02**: LaTeX/formula support in box text
- **VIS-03**: Color-coded boxes by cloze number

### Advanced Editing

- **ADV-01**: Drag-and-drop box repositioning with auto-routing arrows
- **ADV-02**: Undo/redo in visual editors
- **ADV-03**: Copy/paste flowchart structures

## Out of Scope

| Feature | Reason |
|---------|--------|
| Anki add-on for rendering | Inline HTML works natively — no add-on needed |
| Mermaid.js | Anki doesn't render it well |
| Custom SRS scheduling | Anki handles this natively |
| Standalone web editor | This is a GapStrike feature, not a separate app |
| Bidirectional text/canvas sync | AI generates, user edits visually — no DSL pane |
| Skip-cloze toggle | Not needed |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TMPL-01 | Phase 1 | Complete |
| TMPL-02 | Phase 1 | Complete |
| TMPL-03 | Phase 1 | Complete |
| TMPL-04 | Phase 1 | Complete |
| TMPL-05 | Phase 1 | Complete |
| TMPL-06 | Phase 1 | Complete |
| INTG-03 | Phase 1 | Complete |
| INTG-04 | Phase 1 | Complete |
| FLOW-09 | Phase 2 | Pending |
| TABL-05 | Phase 2 | Complete |
| FLOW-01 | Phase 3 | Pending |
| FLOW-08 | Phase 3 | Pending |
| FLOW-02 | Phase 4 | Pending |
| FLOW-03 | Phase 4 | Pending |
| FLOW-04 | Phase 4 | Pending |
| FLOW-05 | Phase 4 | Pending |
| FLOW-06 | Phase 4 | Pending |
| FLOW-07 | Phase 4 | Pending |
| TABL-01 | Phase 4 | Pending |
| TABL-02 | Phase 4 | Pending |
| TABL-03 | Phase 4 | Pending |
| TABL-04 | Phase 4 | Pending |
| TABL-06 | Phase 4 | Pending |
| INTG-01 | Phase 4 | Pending |
| INTG-02 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 25 total (TMPL x6, FLOW x9, TABL x6, INTG x4)
- Mapped to phases: 25
- Unmapped: 0

---
*Requirements defined: 2026-03-08*
*Last updated: 2026-03-09 — traceability updated after roadmap revision (5-phase structure)*
