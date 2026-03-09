# Phase 3: Visual Rendering - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Rebuild FlowchartEditor.tsx from scratch to render AI-generated flowchart HTML as visual interactive boxes and arrows using the Phase 2 FlowGraph data model. Read-only display only — no editing. Preserve FlowchartPreview named export for FlowView.tsx compatibility.

</domain>

<decisions>
## Implementation Decisions

### Editor Appearance
- Editor-enhanced mode: same layout as Anki output but with editor-specific hints (hover effects, background grid, padding)
- Use GapStrike design system throughout (stone palette #EAEAE5, Inter font, stone borders)
- Subtle dot grid canvas background (design system's grid-dots pattern) to signal "this is an editor"
- Boxes have lift + shadow effect on hover (glass-card hover pattern from design system)

### Box Styling
- Rounded cards: 8-12px border radius, white surface, stone border
- Cloze syntax `{{cN::text::hint}}` displayed as raw text with subtle accent background highlight (#5E6AD2 tint) so cloze markers are visually distinct

### Arrow & Connection Styling
- Step label pills rendered as badge-style pills with background color — clearly visible between boxes
- Arrow/line rendering approach at Claude's discretion (CSS lines + unicode, SVG paths, or hybrid)

### Editor Chrome
- Minimal header bar showing flowchart title + "Preview in Anki" toggle
- "Preview in Anki" toggle switches between interactive box/arrow view and dangerouslySetInnerHTML raw render (what FlowchartPreview does)
- No editing controls in Phase 3 — toolbar pattern established for Phase 4 to extend
- Scroll overflow for graphs larger than container (no zoom/pan controls)

### Claude's Discretion
- Arrow rendering implementation (CSS borders + unicode vs SVG paths vs hybrid)
- Header bar metadata (node count badge or title only)
- Exact spacing, typography sizes, and shadow values
- Layout computation approach (CSS flexbox mirroring template vs absolute positioning)
- Error state when parseFlowHTML returns empty/invalid graph

</decisions>

<specifics>
## Specific Ideas

- Boxes should feel like the design system's glass-card component — rounded, clean, with lift on hover
- Step pills should be prominent badge-style (like tag chips) so labels like "inhibits" and "activates" are easy to read at a glance
- Dot grid background signals "editor mode" vs the plain Anki preview

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FlowGraph`, `FlowNode`, `FlowEdge`, `BranchGroup` types in `src/lib/flowchart-types.ts` — data model for rendering
- `parseFlowHTML()` in `src/lib/parse-flow-html.ts` — parses AI HTML into FlowGraph on mount
- `rebuildHTML()` in `src/lib/rebuild-flow-html.ts` — serializes FlowGraph back to Anki HTML (used by Preview toggle)
- `FLOWCHART_STYLES` in `src/lib/flowchart-styles.ts` — shared style constants between parser and serializer
- Design system `.grid-dots`, `.glass-card` CSS classes available in design_system/design-system.html

### Established Patterns
- CSS Modules with camelCase class names (`page.module.css`)
- Components in `src/components/` (PascalCase files)
- `FlowView.tsx` imports `FlowchartEditor, { FlowchartPreview }` — both exports must exist
- `useImmerReducer` planned for state management (html-react-parser, immer, use-immer to be installed)
- No testing framework yet (Vitest planned in Phase 2 plans but status TBD)

### Integration Points
- `FlowView.tsx:8` — `import FlowchartEditor, { FlowchartPreview } from "./FlowchartEditor"` must remain valid
- FlowchartEditor receives `value: string` (HTML) and `onChange: (val: string) => void` props
- FlowchartPreview renders HTML read-only via dangerouslySetInnerHTML
- parseFlowHTML called on mount with the `value` prop to populate FlowGraph state

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-visual-rendering*
*Context gathered: 2026-03-09*
