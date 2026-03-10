# Milestones: FlowchartAnki

## v1.0 — AI-Generated Flowchart & Table Cards (Complete)

**Shipped:** 2026-03-10
**Phases:** 5 (Templates → Data Model → Visual Rendering → Editing Operations → Polish & Deploy)
**Plans completed:** 15/15

**What shipped:**
- AI prompt templates generating valid inline-style HTML with native cloze syntax
- FlowGraph data model with parse/serialize pipeline (parseFlowHTML, rebuildHTML)
- Visual FlowchartEditor rendering boxes, arrows, and edge pills
- Inline editing: labels, add/remove boxes, add/remove connections
- TableEditor with full cell editing, row/column add/remove
- Error Boundary + parseFailed textarea fallback
- AnkiDroid rendering verified
- Deployed to Vercel at gapstrike.vercel.app

**Requirements:** 25/25 complete (TMPL x6, FLOW x9, TABL x6, INTG x4)

**Key decisions:**
- Pure HTML/CSS over Mermaid (Anki compatibility)
- AI generates final HTML directly (no intermediate format)
- Flat FlowGraph model (nodes + edges + branchGroups)
- useImmerReducer for state management
- dangerouslySetInnerHTML for Anki-accurate preview

**Known issues at ship:**
- Edit mode is default (should be Preview)
- Too many view modes (should be just Preview + Edit)
- Generated flowchart structure too simple
- Box/connection editing has bugs
- Container layout suboptimal for short content
