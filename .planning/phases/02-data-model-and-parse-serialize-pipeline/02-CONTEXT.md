# Phase 2: Data Model and Parse/Serialize Pipeline - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the FlowGraph data model, parseFlowHTML parser, and rebuildHTML serializer that all downstream editor components depend on. Fix the TableEditor cloze passthrough bug. No visual rendering or editing — that's Phases 3-4.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
- FlowGraph type design (flat vs tree, edge representation, branch group modeling)
- Round-trip fidelity strategy (byte-identical vs semantically equivalent HTML)
- Cloze syntax handling approach (raw text passthrough vs structured cloze objects)
- FLOWCHART_STYLES constants structure and organization
- Parser error handling for unexpected HTML variations
- TableEditor cloze fix implementation details

User chose to skip discussion — all technical decisions are at Claude's discretion. Success criteria from the roadmap are the binding constraints.

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- TableEditor.tsx: Working parse/rebuild pattern (parseTable -> ParsedTable -> rebuildTable) to use as reference
- template-defaults.ts: anki_flowchart template defines exact HTML structure (boxes, stems, step pills, inline-flex branching)

### Established Patterns
- CSS Modules with camelCase class names (page.module.css)
- Component extraction to src/components/ (PascalCase files)
- Lib files in src/lib/ (kebab-case files)
- No testing framework installed — tests will need to be added or run manually

### Integration Points
- FlowGraph types will be imported by FlowchartEditor.tsx (Phase 3)
- parseFlowHTML/rebuildHTML will be used by FlowchartEditor on mount and on edit (Phases 3-4)
- FLOWCHART_STYLES constants shared between parser and serializer — prevents style drift
- TableEditor.tsx parseTable() fix is self-contained within the component

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-data-model-and-parse-serialize-pipeline*
*Context gathered: 2026-03-09*
