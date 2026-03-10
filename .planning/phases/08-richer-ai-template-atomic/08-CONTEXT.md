# Phase 8: Richer AI Template (Atomic) - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Upgrade the flowchart template prompt so GPT-4o generates richer 5-7 node mechanism maps with labeled causal arrows and cloze on distinguishing mechanism steps only. Atomically update template + parser + serializer + TEMPLATE_PREV_HASHES in one commit. No new UI features — template and pipeline changes only.

</domain>

<decisions>
## Implementation Decisions

### Flowchart depth strategy
- Flowchart depth should be driven by the **educational objective** and **wrong-answer alternatives** present in the extraction
- The educational objective defines the main chain (the "correct reasoning path")
- Default to correct-path-only flowcharts (no wrong-alternative contrast boxes)
- 5-7 nodes minimum, with intermediate pathophysiology steps and anatomical branching as needed
- The extraction already contains educational objective and wrong alternatives — the prompt just needs to instruct GPT-4o to use them

### Cloze targeting
- Cloze the **distinguishing step** — the specific fact that separates the correct answer from the most tempting wrong alternative
- Use **category hints** (e.g., `{{c1::Thiamine::vitamin}}`), not wrong-alternative hints
- Triggers (first box) and leaf outcomes (last boxes) **rarely** get cloze — only if the trigger/outcome itself IS the distinguishing fact
- Arrow labels (step pills) are **never** clozed
- Merge educational-objective analysis into the existing Phase 1 thinking instructions (not a separate phase)

### Arrow label vocabulary
- Expand from current 5 verbs to a curated reference list covering 3 domains:
  - **Pharmacology:** binds to, blocks, agonizes, antagonizes, upregulates, downregulates, sensitizes, potentiates, inhibits
  - **Pathophysiology:** damages, inflames, disrupts, occludes, compresses, infiltrates, necroses, fibroses, depletes, activates
  - **Anatomy/Clinical:** innervates, drains to, supplies, crosses, presents as, metastasizes to, refers to
- Keep rule: "NEVER use generic 'leads to', 'causes', 'then'"

### Template examples
- **Replace both** existing examples (Wernicke + Kidney embryology)
- New Example 1: **Pathophysiology** mechanism (e.g., heart failure, DKA)
- New Example 2: **Pharmacology** mechanism (e.g., ACE inhibitor cascade, warfarin pathway)
- **Both examples must demonstrate branching** (most USMLE mechanisms branch)
- Examples must include **educational objective reasoning** — show GPT-4o how to analyze the objective and wrong alternatives before building the flowchart (as part of Phase 1 thinking comments)

### Claude's Discretion
- Specific pathophysiology and pharmacology topics for the 2 new examples
- Exact wording of expanded Phase 1 analysis instructions
- Parser/serializer changes needed (if any) for the new HTML patterns
- Which current template hash to add to TEMPLATE_PREV_HASHES

</decisions>

<specifics>
## Specific Ideas

- "It should focus on using educational objective and alternative answers to serve as guide to decide the depth and also which to cloze"
- The educational objective = the main reasoning path; wrong alternatives show WHERE students diverge
- Cloze the facts that, if forgotten, would lead to picking the wrong alternative

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `template-defaults.ts:257-377`: Current `anki_flowchart` template — will be rewritten with richer prompt
- `parse-flow-html.ts`: Parser uses style-based element detection (box, pill, stem, branch). Should handle new template without changes if HTML structure stays the same
- `rebuild-flow-html.ts`: Serializer reconstructs HTML from FlowGraph. Should be unaffected if no structural changes
- `TEMPLATE_PREV_HASHES` (line 12): Current hashes array for `anki_flowchart` — add current hash before rewriting template

### Established Patterns
- Template sections: `<!-- section: System Prompt -->`, `<!-- section: Instructions -->`, `<!-- section: Card Structure -->`, `<!-- section: Rules -->`
- Parser detects elements by inline style patterns (not class names or structure)
- Cloze syntax preserved via `textContent` in parser, raw string interpolation in serializer

### Integration Points
- `api/templates/route.ts`: Reads TEMPLATE_PREV_HASHES to auto-upgrade uncustomized user templates
- FlowchartEditor receives parsed FlowGraph — no changes needed if parser output shape stays the same
- `api/create-card/route.ts` or equivalent: Passes extraction text to GPT-4o with the template prompt

</code_context>

<deferred>
## Deferred Ideas

- **Wrong-alternative toggle button**: User wants a UI button to switch between including/excluding wrong-answer contrast boxes in generated flowcharts. This is a new UI capability — belongs in its own phase after Phase 8 template lands.

</deferred>

---

*Phase: 08-richer-ai-template-atomic*
*Context gathered: 2026-03-10*
