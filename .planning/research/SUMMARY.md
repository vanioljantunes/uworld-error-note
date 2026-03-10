# Project Research Summary

**Project:** GapStrike FlowchartEditor v1.1 — Editor Polish
**Domain:** Visual Anki card editor — UX polish, CSS layout, AI prompt improvement
**Researched:** 2026-03-09
**Confidence:** HIGH

## Executive Summary

GapStrike v1.1 is a focused UX polish iteration on a shipping visual Anki card editor. The v1.0 product is fully deployed and working; v1.1 exists to address four UX regressions documented in the Phase 5 production smoke-test (Issues 1–4 in VERIFICATION.md) plus three proactive improvements: preview-first default, two-mode simplification, and richer AI-generated flowchart structure. The entire scope is achievable with zero new npm dependencies — all changes are code-only modifications to existing TypeScript, CSS Modules, and a prompt string.

The recommended approach is a strict build-order: change the default preview mode first (one line), then fix CSS layout, then fix reducer bugs in edit mode, then update the AI template and parser together atomically. This sequence matters because each step exposes the next: the preview-default makes the layout issue visible, the layout fix must be verified before adding nodes via the reducer, and the richer AI template must land together with any parser extensions to avoid breaking visual editing for users who auto-upgrade templates. FlowView.tsx cleanup (hiding the redundant eye-toggle in flowchart mode) is the final cosmetic step.

The key risk is not technical complexity but integration timing. The two highest-danger changes are: (a) the richer AI prompt, which can silently produce HTML that `parseFlowHTML` cannot handle, triggering the raw-textarea fallback for all users whose templates auto-upgrade via `TEMPLATE_PREV_HASHES`; and (b) the container layout CSS, which can clip tall flowcharts if applied carelessly to the preview container. Both risks have clear mitigation strategies: atomic prompt+parser commits and `min-height` on the editor canvas (not the preview container).

---

## Key Findings

### Recommended Stack

The stack is fully locked from v1.0. No new packages are needed. All three primary v1.1 features map to targeted changes in already-installed technologies: React 19 + immer `useImmerReducer` for the mode state change, CSS Modules for container layout, and a prompt string edit in `template-defaults.ts` for richer AI output. The only non-trivial coordination requirement is the `TEMPLATE_PREV_HASHES` auto-upgrade mechanism — any content change to the `anki_flowchart` template must be accompanied by adding the old content hash to the array, triggering silent re-generation for uncustomized users.

See `.planning/research/STACK.md` for full alternatives analysis and version compatibility table.

**Core technologies:**
- `useImmerReducer` + `FlowState` (already installed): two-mode editor state — change `initialState.viewMode` from `"editor"` to `"preview"`, rename `"editor"` to `"edit"` throughout
- `CSS Modules` / `FlowchartEditor.module.css` (built-in): container layout fix — add `min-width: 120px` to `.nodeCard`, `min-height` to `.canvas` and `.editorRoot`
- `flowchart-styles.ts` / `FLOWCHART_STYLES.box` (existing): Anki-side min-width propagation — add `min-width:120px` to the inline style string so all generated cards inherit the fix
- `template-defaults.ts` (existing): AI prompt content — rewrite `anki_flowchart` template with richer card structure examples, stronger negative rules, and a new hash in `TEMPLATE_PREV_HASHES`
- `parse-flow-html.ts` + `rebuild-flow-html.ts` (existing): parser/serializer pair — must be extended atomically if the richer template introduces new HTML patterns
- `vitest` (already installed): verify `initialState.viewMode = "preview"` and REORDER_NODE swap correctness after immer fix

### Expected Features

**Must have (table stakes — P1):**
- Preview-First Default — users expect to see the card result, not edit scaffolding, when the editor opens; change `initialState.viewMode` to `"preview"`
- Two-Mode Toggle (Preview + Edit) — single "Edit" button in preview mode, "Preview" in edit mode; toolbar visible only in edit mode
- Hide FlowView eye-toggle in flowchart/table mode — eliminating the redundant dual-preview mechanism is required for two-mode simplification to be coherent
- Container layout for short content — 2–3 node flowcharts must not appear as a tiny island in a large empty container; `min-height` and centering on `.canvas`
- Back field bug fix (Issue 4) — `editBack` in `FlowView.tsx` `handleSwitchEditor` populates the Back field with generated card content instead of the original extraction; data-flow error that must be traced and corrected
- Button row overflow fix (Issue 3) — `flex-wrap: wrap` on `.ankiFormatRow` in `page.module.css` to prevent cramping on narrow panels

**Should have (competitive differentiators — P1 for v1.1):**
- Richer AI-generated flowchart structure — 5–7 node chains with labeled causal arrows (`inhibits`, `activates`, `converts`) instead of generic 3–4 node chains; cloze on mechanism steps only, not leaf outcomes
- Edit-mode bug fixes — REMOVE_NODE reconnect for branches, ADD_NODE leaf detection on disconnected graphs, replace `window.prompt` for edge step labels with inline input

**Defer (v2+):**
- Undo/redo — requires history stack; Regenerate button is the practical v1 substitute
- Drag-and-drop box repositioning — complex DOM-order mapping; up/down buttons already cover reordering
- Multiple box shapes (diamond, oval)
- Color-coded boxes by cloze number
- Three-mode raw HTML view — the parse-failure fallback textarea already provides emergency raw access

### Architecture Approach

The architecture follows a self-contained two-mode editor pattern: `FlowchartEditor` controls its own `viewMode` state entirely within its immer reducer. `FlowView.tsx` (the host) passes `value` and `onChange` props but does not control mode. The existing `ankiPreview` boolean in FlowView remains relevant for table/cloze/question modes but becomes a no-op for flowchart mode — an acceptable temporary divergence. The critical integration constraint is that `parseFlowHTML` and `rebuildHTML` must form a lossless round-trip for any HTML the updated `anki_flowchart` template produces; if the richer template introduces new HTML patterns, the parser and serializer must be updated in the same atomic commit as the template.

See `.planning/research/ARCHITECTURE.md` for full data flow diagrams, anti-patterns, and the 5-step build order.

**Major components:**
1. `FlowchartEditor.tsx` — visual editor with embedded preview; owns `viewMode`, `graph`, and editing state via `useImmerReducer`; primary modification target for mode default and bug fixes
2. `FlowView.tsx` — host component; owns `editFront` canonical HTML, `editorMode`, AnkiConnect calls; minor modification (suppress eye-toggle in flowchart mode, fix Issue 3, fix Issue 4)
3. `template-defaults.ts` — `anki_flowchart` prompt content and `TEMPLATE_PREV_HASHES` auto-upgrade registry; content rewrite for richer flowchart output
4. `parse-flow-html.ts` + `rebuild-flow-html.ts` — parser/serializer pair; must maintain lossless round-trip after template change; bug fix target for edge-case crashes
5. `FlowchartEditor.module.css` + `flowchart-styles.ts` — CSS and shared style constants; `min-width` and `min-height` additions for container layout fix

### Critical Pitfalls

1. **onChange infinite loop when changing default viewMode** — the `hasUserEdited` guard in the `useEffect` watching `state.graph` prevents the loop; do not remove or bypass this guard when changing `initialState.viewMode`. Warning signs: "Maximum update depth exceeded" in console, card front field flickers on load.

2. **Richer AI template deployed without updating the parser** — any new HTML patterns produced by the updated `anki_flowchart` template must be handled by `parseFlowHTML`; otherwise all auto-upgraded users immediately hit the `parseFailed` raw-textarea fallback. Mitigation: design new HTML patterns first, verify parser handles them, commit template + parser + serializer atomically with the new hash in `TEMPLATE_PREV_HASHES`.

3. **Immer destructuring swap corruption in REORDER_NODE** — ES6 `[a, b] = [b, a]` on immer draft arrays silently corrupts or loses the mutation. The existing code uses the correct explicit `tempVar` swap; the risk is inadvertently switching to destructuring when "cleaning up" the reducer.

4. **CSS container layout breaks FlowchartPreview** — adding `min-height`, `align-items`, or `justify-content` to `.previewContainer` affects the vertical axis for all card sizes. Fix the short-content layout on the editor canvas side (`.canvas`, `.editorRoot`) not the preview container. Unsafe properties on `.previewContainer`: `min-height`, `align-items`, `justify-content`, `overflow: hidden`.

5. **AI prompt regression in cloze syntax output** — LLM distribution shifts after prompt rewrites can cause GPT-4o to change cloze format (omit hints, add `<span>` wrappers around cloze text, produce orphaned branch nodes). Mitigation: test the updated prompt against 5 diverse inputs before landing; verify all 5 produce parseable HTML without triggering `parseFailed`.

---

## Implications for Roadmap

Based on combined research, 5 phases are suggested, driven by the hard dependency chain in the architecture: mode default makes layout visible, layout must be stable before edit-mode testing, edit bugs must be fixed before the richer template exercises those code paths, and the template+parser change must be atomic.

### Phase 1: Mode Simplification and UX Defaults

**Rationale:** The single-line `initialState.viewMode = "preview"` change is zero-risk and the most impactful UX improvement. Button label rename and FlowView eye-toggle suppression are tightly coupled — both must land together to avoid two competing preview mechanisms. This phase creates the correct baseline for all subsequent visual verification.
**Delivers:** Preview-first editor, clear Edit/Preview toggle labels, no redundant eye-toggle in flowchart/table mode.
**Addresses:** Preview-First Default, Two-Mode Toggle labels, Hide FlowView eye-toggle (all P1).
**Avoids:** onChange infinite loop (Pitfall 1) — preserve `hasUserEdited` guard; TOGGLE_VIEW contract break — keep `viewMode` as strict two-value type `"preview" | "edit"`.

### Phase 2: Container Layout and CSS Fixes

**Rationale:** After Phase 1 makes Preview the default view, the short-content layout issue becomes immediately visible. CSS-only changes with no logic risk. Issue 3 (button row overflow in `page.module.css`) is a separate, independent CSS fix that belongs here by scope proximity.
**Delivers:** Proportional editor layout for 2–3 node flowcharts without clipping tall ones; non-overflowing format button row.
**Addresses:** Container layout for short content (`.nodeCard` min-width, `.canvas`/`.editorRoot` min-height), Button row overflow fix Issue 3 (all P1).
**Avoids:** CSS preview container clipping (Pitfall 4) — apply `min-height` only to `.canvas` and `.editorRoot`; do not add height-axis constraints to `.previewContainer`.

### Phase 3: Reducer Bug Fixes and FlowView Data-Flow

**Rationale:** Edit-mode bugs are only encountered when the user deliberately enters Edit mode — Phase 1 makes this an intentional opt-in, making bugs easier to isolate. Issue 4 (Back field data-flow in FlowView.tsx) is independent of FlowchartEditor. Both are medium-complexity trace-and-fix tasks that must be validated before the richer AI template exercises the same code paths with more complex graphs.
**Delivers:** Stable add/remove node and connection operations; correct Back field content from original extraction text.
**Addresses:** Edit-mode bug fixes (REMOVE_NODE branch reconnect, ADD_NODE leaf detection, `window.prompt` replacement), Back field bug fix Issue 4 (all P1).
**Avoids:** Immer destructuring swap corruption (Pitfall 3) — use explicit `tempVar` swap in REORDER_NODE; do not consolidate `connectMode` and `connectingFromId` local state into the immer reducer (they are transient UI state, not graph mutations).

### Phase 4: Richer AI Template and Parser Extension (Atomic)

**Rationale:** This is the highest-risk change and must land last among code changes. The updated `anki_flowchart` prompt must be designed alongside parser extensions. The `TEMPLATE_PREV_HASHES` mechanism auto-upgrades all uncustomized user templates on the next API call — this is irreversible in production. Phase 3 must be complete so the fixed parser handles both existing and new HTML patterns correctly.
**Delivers:** 5–7 node flowchart chains with labeled causal arrows (`inhibits`, `activates`, `converts`), correct cloze placement on mechanism steps, title naming the mechanism/pathway not the organ/condition.
**Addresses:** Richer AI-generated flowchart structure (P1 differentiator).
**Avoids:** AI prompt regression in cloze output (Pitfall 5) — test 5 cards before commit; template-without-parser deploy (Pitfall 2) — commit template + `parse-flow-html.ts` + `rebuild-flow-html.ts` + `flowchart-styles.ts` + new hash in `TEMPLATE_PREV_HASHES` as a single atomic change.

### Phase 5: Verification and Deploy

**Rationale:** Full smoke-test before Vercel production push. The previous Phase 5 encountered a stale Vercel deploy issue (gap closure plan 05-04 exists) — run `npm run build` locally first, verify TypeScript zero-error, then push.
**Delivers:** Production deploy at gapstrike.vercel.app with all v1.1 changes.
**Addresses:** Deploy verification, regression checks for TableEditor (imports from `page.module.css`), AnkiDroid newline-to-`<br>` round-trip, 2-box and 7-box card layout checks in preview.
**Avoids:** Vercel stale deploy (known recovery: `npx vercel --prod --force` or empty-commit push).

### Phase Ordering Rationale

- Phase 1 before Phase 2: preview-default must exist to make the short-content layout issue observable and testable in the correct mode.
- Phase 2 before Phase 3: CSS-only changes are zero-logic-risk; validating layout before touching reducer logic keeps change surfaces isolated.
- Phase 3 before Phase 4: REMOVE_NODE branch reconnect and ADD_NODE leaf detection bugs could be triggered by the richer graphs Phase 4's template produces; fix the code paths before the AI starts generating content that exercises them.
- Phase 4 is atomic: template content, parser, serializer, `flowchart-styles.ts`, and `TEMPLATE_PREV_HASHES` hash update must be a single commit — no partial deploys of this group.
- Phase 5 is terminal: all verification after all code changes.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Reducer Bug Fixes):** Beyond the known REMOVE_NODE and ADD_NODE issues, the MILESTONES.md notes "fix box/connection editing bugs — unspecified at milestone start — surface in real usage." Bug surface area is unknown until the code is exercised with real USMLE content. Plan for discovery work within this phase.
- **Phase 4 (AI Template):** The exact HTML patterns a richer 5–7 node prompt will produce from GPT-4o are not fully predictable until the prompt is written and tested. Parser extension scope may expand once the prompt is finalized. Reserve capacity for 1–2 rounds of prompt iteration.

Phases with standard patterns (research not required):
- **Phase 1 (Mode Default):** Single-line `initialState` change plus string renames. Well-understood React state initialization. No research needed.
- **Phase 2 (CSS Layout):** `min-height` and `min-width` properties with confirmed universal support in all Anki WebView environments (AnkiDesktop 2.1.x, AnkiDroid 2.17+, AnkiMobile). No research needed.
- **Phase 5 (Deploy):** Established Vercel deploy pattern with known recovery procedure for stale builds.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies. Every change file was directly inspected in the live codebase. Version compatibility for `min-width` in Anki WebViews confirmed via MDN. |
| Features | HIGH | Feature list derived from MILESTONES.md known-issues log, PROJECT.md, and VERIFICATION.md — all primary source documents from the same codebase. |
| Architecture | HIGH | All components directly inspected. Build order derived from actual code dependency chain, not inference. Integration boundaries confirmed in live source files. |
| Pitfalls | HIGH | Pitfalls derived from direct code audit: `hasUserEdited` guard confirmed at lines 446–450 of FlowchartEditor.tsx, REORDER_NODE implementation confirmed, `TEMPLATE_PREV_HASHES` mechanism confirmed, `connectMode`/`connectingFromId` local state split confirmed. |

**Overall confidence:** HIGH

### Gaps to Address

- **Editing bug surface area (Phase 3):** The known bugs are documented, but additional bugs may surface during Phase 3 testing with real USMLE content. Budget time for triage of one or two unexpected failures.
- **AI prompt output predictability (Phase 4):** The richer prompt guidelines are well-specified, but GPT-4o output is probabilistic. The specific HTML patterns the updated template will produce are not known until the prompt is written and tested. The parser extension scope is an open variable. Budget for up to two prompt iteration cycles.
- **Issue 4 exact root cause (Phase 3):** The back-field data-flow bug is described as "likely using the wrong source in `handleSwitchEditor`" but the exact assignment line was not confirmed in this research pass. Requires a targeted trace of `editBack` population in `FlowView.tsx` before the fix can be scoped accurately.

---

## Sources

### Primary (HIGH confidence — direct code inspection)
- `gapstrike/src/components/FlowchartEditor.tsx` — FlowState shape, `initialState`, `TOGGLE_VIEW` action, `hasUserEdited` guard, `REORDER_NODE` implementation, `parseFailed` fallback state, `connectMode`/`connectingFromId` local useState split
- `gapstrike/src/components/FlowchartEditor.module.css` — current `.nodeCard` (max-width only, no min-width confirmed), canvas and editorRoot classes
- `gapstrike/src/lib/flowchart-styles.ts` — `FLOWCHART_STYLES.box` string (no min-width confirmed)
- `gapstrike/src/lib/template-defaults.ts` — `anki_flowchart` template content and `TEMPLATE_PREV_HASHES` structure with current hashes
- `gapstrike/src/lib/rebuild-flow-html.ts` — uses `FLOWCHART_STYLES.box` directly, confirming min-width addition propagates automatically
- `gapstrike/src/lib/parse-flow-html.ts` — regex-based HTML parser implementation
- `gapstrike/src/components/FlowView.tsx` — `editorMode`, `ankiPreview`, `editFront`, `modeContentRef` state ownership
- `gapstrike/src/components/TableEditor.tsx` — import from `page.module.css` at line 6 (tech debt coupling confirmed)
- `.planning/PROJECT.md` — v1.1 target features, inline-styles-only constraint for Anki cards, Vercel deploy target
- `.planning/MILESTONES.md` — v1.0 known issues at ship
- `.planning/phases/05-polish-and-deploy/05-VERIFICATION.md` — Issue 1–4 structured details
- `.planning/phases/05-polish-and-deploy/05-04-SUMMARY.md` — Vercel stale deploy gap closure context
- `.planning/codebase/CONCERNS.md` — zero test coverage and LLM output parsing concerns confirmed

### Secondary (MEDIUM confidence)
- OpenAI documentation (inference): GPT-4o structured output — prompt quality is the bottleneck for structured HTML generation at temperature 0.5; model upgrade is not required
- UX pattern references (general knowledge): preview-first default as standard pattern in Notion, Obsidian, GitHub Markdown editors — from training knowledge, no WebSearch available
- immer documentation (knowledge): destructuring swap incompatibility with draft proxies is a documented pitfall — https://immerjs.github.io/immer/pitfalls
- MDN Web Docs: `min-width` — universal support in Chromium/WebKit environments including all Anki platforms

---
*Research completed: 2026-03-09*
*Ready for roadmap: yes*
