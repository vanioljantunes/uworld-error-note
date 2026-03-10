# FlowchartAnki

## What This Is

A GapStrike feature that adds AI-generated flowchart and table Anki cards with visual editing. When a user clicks "Flowchart" or "Table" in the card editor, GPT-4o generates pure HTML/CSS cards with native `{{cN::text::hint}}` cloze syntax. Users can then visually edit boxes, connections, cells, and labels before pushing the card to Anki via AnkiConnect.

## Core Value

AI-generated flowchart and table cards with visual editing in GapStrike, rendered as pure HTML/CSS with native Anki cloze syntax — no add-ons, works on all platforms.

## Current Milestone: v1.1 Editor Polish

**Goal:** Simplify the editor to two modes (Preview default + Edit), fix editing bugs, improve AI card richness, and polish container layouts.

**Target features:**
- Default to Preview mode (Anki-rendered view)
- Two-mode simplification: Preview (full render) + Edit (cloze syntax, add/remove)
- Richer AI-generated flowchart card structure
- Fix box/connection editing bugs
- Improve container layout for short content

## Requirements

### Validated

- ✓ TMPL-01 through TMPL-06: AI template prompts generate valid inline-style HTML — v1.0
- ✓ FLOW-01 through FLOW-09: FlowchartEditor renders and edits AI HTML — v1.0
- ✓ TABL-01 through TABL-06: TableEditor renders and edits AI HTML — v1.0
- ✓ INTG-01 through INTG-04: End-to-end integration with AnkiConnect — v1.0

### Active

- [ ] Default editor to Preview mode; simplify to two modes (Preview + Edit)
- [ ] Fix box/connection editing bugs that crash the system
- [ ] Improve AI-generated flowchart card structure (richer, more detailed)
- [ ] Improve container layout when content is short

### Out of Scope

- Mermaid.js — Anki doesn't render it well, replaced with pure HTML/CSS
- Anki add-on — Inline HTML works natively on all platforms
- Custom SRS scheduling — Anki handles this natively
- Standalone web editor — This is a GapStrike feature
- Bidirectional text/canvas sync — AI generates, user edits visually
- LaTeX/formula support in boxes — v2
- Multiple box shapes (diamonds, ovals) — v2
- Drag-and-drop repositioning with auto-routing — v2
- Color-coded boxes by cloze number — v2

## Context

- GapStrike is a Next.js app deployed on Vercel at https://gapstrike.vercel.app
- Previous session already: renamed anki_mermaid → anki_flowchart, removed all mermaid code from create-card/format-card APIs and FlowView.tsx, renamed MermaidStructEditor → FlowchartEditor (but internals still mermaid-based)
- FlowchartEditor.tsx (731 lines) needs complete rebuild — current code parses mermaid syntax, not HTML
- TableEditor.tsx (218 lines) works but needs polish
- Template system uses `<!-- section: -->` markers parsed by `parseTemplateSections()`
- `TEMPLATE_PREV_HASHES` enables auto-upgrade of user templates stored in Supabase
- Detailed requirements and roadmap exist in `C:\Users\vanio\OneDrive\Área de Trabalho\python\flowchartAnki\.planning\`

## Constraints

- **Inline styles only**: Anki strips `<style>` blocks from field content — all styling must be inline
- **No JavaScript**: Anki's reviewer WebView doesn't execute JS in card fields
- **Compact HTML**: AnkiDroid converts newlines to `<br>` on edit — minimize whitespace
- **Cloze in divs only**: Cloze inside SVG `<tspan>` breaks positioning — use HTML divs
- **Unicode arrows**: `&#8595;` (down) and `&#8594;` (right) render universally
- **Max 4-7 boxes**: Keep flowcharts focused for effective spaced repetition
- **Deploy to Vercel**: All changes must be deployed to production at end

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| No Mermaid — pure HTML/CSS | Anki doesn't render Mermaid, need cross-platform | ✓ Good |
| AI generates final HTML directly | No intermediate format, LLM outputs ready-to-use HTML | ✓ Good |
| No Anki add-on needed | Inline HTML + native cloze works everywhere | ✓ Good |
| Div-based layout (not table grid) | More flexible for branching, inline-flex for siblings | — Pending |
| Delete and rebuild FlowchartEditor | Old code is mermaid-based, not worth adapting | — Pending |
| Adopt flowchartAnki requirements as-is | 25 well-defined requirements already exist | ✓ Good |

---
*Last updated: 2026-03-09 after v1.1 milestone start*
