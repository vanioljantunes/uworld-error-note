# Phase 6: Mode Simplification and Layout - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Users open the flowchart editor and see the rendered Anki card immediately — no edit scaffolding on load. Exactly two mode buttons are visible (Preview + Edit). The format button row never overflows on narrow screens.

Requirements: UX-01, UX-02, LAY-01

</domain>

<decisions>
## Implementation Decisions

### Mode labels and switching UX
- Two mode labels: "Preview" and "Edit" (replacing "Preview in Anki" / "Back to Editor")
- Toggle pair UI: both buttons always visible as tabs/pills, active one highlighted (not a single flip button)
- Default mode on editor open: Preview (currently defaults to "editor")
- Toolbar (Add Box, Connect) and transition behavior: Claude's discretion
- Toggle pair placement (left vs right of title): Claude's discretion

### Eye-toggle behavior in flowchart/table mode
- Hide the eye-toggle (ankiPreview button) entirely when in flowchart or table editor mode — it overlaps with the new Preview default
- Restore the eye-toggle when user exits back to normal cloze editing mode (it's still useful for plain cloze cards)
- FlowchartEditor Preview mode content: Claude's discretion on whether to show just rendered HTML or Front/Back split

### Format button row wrapping
- Add `flex-wrap: wrap` to `.ankiFormatRow` so buttons wrap to a second line on narrow screens
- Wrap alignment, button sizing, and row gap: Claude's discretion

### Claude's Discretion
- Toggle pair placement in the editor header (left vs right of title)
- Toolbar appearance transition (instant vs animated) when switching Preview → Edit
- FlowchartEditor Preview content format (inline render vs Front/Back split)
- Format button wrap alignment, button sizing on mobile, row gap spacing

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FlowchartPreview` component: already renders HTML via `dangerouslySetInnerHTML` — used for Preview mode
- `FlowchartEditorInner` reducer: has `viewMode: "editor" | "preview"` and `TOGGLE_VIEW` action — needs default changed and label renamed
- `.ankiFormatRow` CSS class: exists in `page.module.css:3122` — needs `flex-wrap: wrap` added

### Established Patterns
- FlowchartEditor uses `useImmerReducer` with typed actions — mode changes go through dispatch
- `ankiPreview` state in FlowView.tsx is a separate boolean toggle at line 174 — independent from FlowchartEditor's viewMode
- Editor state is initialized in `FlowchartEditorInner` at line 416-425

### Integration Points
- `FlowView.tsx:1919-1920` — eye-toggle button render location (needs conditional hide when `editorMode === "flowchart" || editorMode === "table"`)
- `FlowchartEditor.tsx:418` — `viewMode: "editor"` initial state (change to `"preview"`)
- `FlowchartEditor.tsx:513` — toggle button label text (replace with toggle pair)
- `page.module.css:3122-3127` — `.ankiFormatRow` flex styles (add wrap)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-mode-simplification-and-layout*
*Context gathered: 2026-03-09*
