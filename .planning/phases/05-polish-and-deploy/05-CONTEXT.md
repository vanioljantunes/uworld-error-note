# Phase 5: Polish and Deploy - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Error fallbacks for malformed AI HTML, UX hardening, AnkiDroid smoke-test for flowchart and table cards, and Vercel production deploy. No new features — this is about resilience and shipping.

</domain>

<decisions>
## Implementation Decisions

### Parse failure fallback
- Show raw HTML in an editable textarea when parseFlowHTML fails or returns an empty/invalid graph
- Textarea edits sync via onChange in real-time — consistent with visual editor behavior
- Subtle warning banner above textarea: "Could not parse flowchart — showing raw HTML" (amber/yellow)
- Wrap FlowchartEditor in a React Error Boundary to catch both parse failures AND render crashes — both fall back to textarea

### AnkiDroid rendering
- Manual check + document: sync a test card to AnkiDroid, visually confirm, document result
- If issues found: fix template inline styles to use simpler CSS that works on both desktop and mobile
- Test both flowchart AND table cards on AnkiDroid
- Acceptance bar: boxes visible with text, arrows/labels appear, cloze reveals/hides correctly on tap (not pixel-perfect)

### Deploy strategy
- Full flow smoke-test on production: generate flowchart card → edit → save to Anki; generate table card → edit → save; confirm no console errors
- Just push and verify — Vercel auto-deploys from git push, env vars already configured
- Deploy last — complete all code changes (fallbacks, any template fixes), then deploy once
- Run `next build` locally first to catch TypeScript/build errors before pushing

### Claude's Discretion
- Error Boundary implementation details (class component vs library)
- Warning banner styling (exact colors, positioning)
- Textarea sizing and styling in fallback mode
- Build error fix approach if any arise

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FlowchartEditor.tsx`: Already has basic "Empty flowchart" div — replace with textarea fallback
- `parseFlowHTML()` in `src/lib/parse-flow-html.ts`: Returns FlowGraph — check for empty nodes array as failure signal
- `FlowchartPreview`: Uses dangerouslySetInnerHTML — already handles raw HTML rendering (reference for fallback)
- Design system amber/warning patterns available for banner styling

### Established Patterns
- CSS Modules with camelCase class names (page.module.css, FlowchartEditor.module.css)
- Components in `src/components/` (PascalCase files)
- `useImmerReducer` for FlowchartEditor state management
- Vercel auto-deploy from git push with vercel.json function timeouts configured

### Integration Points
- FlowchartEditor receives `value: string` (HTML) and `onChange: (val: string) => void` — textarea fallback uses same props
- `next build` script in package.json — local build verification
- Vercel deployment: .vercel/ directory exists, vercel.json configured with function timeouts
- AnkiConnect at localhost:8765 — used for save verification

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-polish-and-deploy*
*Context gathered: 2026-03-09*
