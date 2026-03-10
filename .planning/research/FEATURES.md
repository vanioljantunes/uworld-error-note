# Feature Research

**Domain:** AI-generated Anki flowchart/table card visual editor — v1.1 Editor Polish (GapStrike)
**Researched:** 2026-03-09
**Confidence:** HIGH — based on live codebase inspection, MILESTONES.md known-issues log, Phase 5 VERIFICATION report, and PROJECT.md constraints. WebSearch unavailable; all findings from primary sources.

---

## Context

v1.0 shipped all 25 requirements (TMPL, FLOW, TABL, INTG). The Phase 5 production smoke-test
identified four UX regressions that were deferred rather than fixed. v1.1 addresses those
deferred items plus structural improvements to the AI generation quality and editor layout.

**What already exists (v1.0 complete):**
- FlowchartEditor with visual box/arrow rendering, inline label editing, add/remove boxes and connections
- TableEditor with cell editing, row/column add/remove
- Error Boundary + parseFailed textarea fallback
- AnkiConnect push
- Vercel deploy at gapstrike.vercel.app

**What v1.1 targets (from MILESTONES.md known issues at ship + PROJECT.md):**
1. Default editor to Preview mode (currently defaults to "editor" mode — wrong)
2. Simplify to two modes: Preview + Edit (currently has editor/preview toggle inside the component AND FlowView's own ankiPreview toggle — redundant)
3. Richer AI-generated flowchart card structure (currently too simple — AI produces minimal 3-4 node chains)
4. Fix box/connection editing bugs (unspecified at milestone start; surface in real usage)
5. Improve container layout for short content (editor area feels empty/misaligned when flowchart has 2-3 nodes)
6. Fix Issue 3: Anki button row overflow/cramped layout (FlowView.tsx, not FlowchartEditor)
7. Fix Issue 4: Back field shows generated text instead of original extraction

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist or are universally expected for a "polished" editor. Missing
these makes the experience feel broken or unfinished.

#### Mode Switching: Preview-First Default

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Default to Preview mode on open | Users expect to see the card result immediately after AI generation — not an edit scaffold. Every modern content editor (Notion, Obsidian, GitHub) shows preview by default when content already exists. | LOW | Change `viewMode` initialState from `"editor"` to `"preview"` in `FlowchartEditorInner`. Also change `initialState.viewMode` in the `FlowState` object at line 416 of FlowchartEditor.tsx |
| Single "Edit" button that enters edit mode | A single prominent toggle is the standard pattern (Notion's pencil, Obsidian's edit icon, GitHub's pencil icon). "Preview in Anki" / "Back to Editor" labels are awkward — one of them is always the wrong label. | LOW | Rename the button to "Edit" (when in preview) and "Done" or "Preview" (when in edit). Use an icon (pencil) if space allows |
| Edit mode shows toolbar; Preview mode hides toolbar | Toolbars in preview mode are noise — users are not editing. Standard pattern: toolbar appears only when you are in the writing/editing mode. | LOW | Already partially implemented — toolbar conditionally renders when `viewMode === "editor"`. Verify the condition is tight and nothing leaks into preview |
| Preview renders exactly what Anki sees | The preview pane should use `dangerouslySetInnerHTML` with the exact output HTML — no editor chrome, no scrollbars from the editor container. FlowchartPreview named export already does this correctly. | LOW | Already implemented via `FlowchartPreview`. Verify the preview container fills the editor root cleanly without padding collisions |

#### Two-Mode Simplification

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Eliminate FlowView's redundant "Show preview" eye toggle for flowchart/table modes | FlowView.tsx has both its own `ankiPreview` toggle (the eye button) AND the FlowchartEditor's internal `TOGGLE_VIEW`. Two independent toggles for the same purpose create confusion about which preview the user is seeing. | MEDIUM | In FlowView.tsx, when `editorMode === "flowchart"` or `"table"`, hide the eye-icon preview toggle entirely — the editor component's own Preview mode supersedes it. The eye-toggle is still useful in cloze/question modes. |
| Clear visual distinction between Preview and Edit modes | Users need to know at a glance whether they are in the mode where changes are saved. Edit mode should have an active-state indicator (border, background tint, or button highlight). | LOW | In edit mode, the editor root border or header background should shift to a subtle accent tint. Already has `toolbarBtnActive` CSS class — extend the pattern to the header. |

#### Container Layout for Short Content

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Editor fills its container even with short flowcharts | When a flowchart has 2-3 nodes, the visual editor renders a tiny island in the center of a large empty area. Users expect the container to be proportional or to fill its parent. The blank space signals "something is missing." | LOW | Set `.editorRoot` to `min-height: 100%` (already has `height: 100%`) and ensure `.canvas` uses `flex: 1` to fill available space. Or center the canvas vertically with `justify-content: center` on `.editorRoot`. |
| Preview pane fills container cleanly | Same issue in preview mode: a 3-node flowchart at the top of a large blank area looks unfinished. | LOW | `.previewContainer` should use `display: flex; justify-content: center; align-items: flex-start` — centers the flowchart horizontally and anchors it at the top without leaving awkward gutters. |

#### FlowView Integration Bug Fixes (from 05-VERIFICATION.md)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Back field contains original extraction text, not generated card text (Issue 4) | Users expect the Back field to contain the source extraction — the clinical explanation they are studying. Populating it with the AI-generated front card content is a data-flow error. | MEDIUM | Trace `editBack` assignment in FlowView.tsx `handleSwitchEditor`. The bug is in how the back field is populated when switching to flowchart/table mode — likely using the wrong source (the API response front content instead of the original extraction). |
| Anki format button row does not overflow on smaller panels (Issue 3) | The format buttons (Cloze, Q&A, Table, Flowchart, eye icon, regen icon) wrap or overflow on narrow panels. Standard fix is `flex-wrap: wrap` or responsive sizing. | LOW | Add `flex-wrap: wrap` and `gap: 4px` to the `.ankiFormatRow` CSS class in page.module.css. Alternatively reduce button padding when panel is narrow via a breakpoint. |

---

### Differentiators (Competitive Advantage)

Features specific to this domain that give GapStrike an advantage over manual Anki HTML editing
or other AI card generators.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Richer AI-generated flowchart structure | Current AI output is too simple: linear chains of 3-4 generic boxes. USMLE mechanisms typically have 5-7 steps with labeled causal links (e.g., "ACE inhibitor → inhibits → ACE → cannot convert → Ang I → Ang II reduced → less vasoconstriction"). A richer prompt produces better study material out of the box, reducing the editing needed. | MEDIUM | Rewrite the flowchart prompt in `template-defaults.ts` (the `anki_flowchart` template). Instruct GPT-4o to: (a) use 5-7 boxes for mechanism chains, (b) label every arrow with the causal verb (inhibits/activates/converts/releases), (c) include the trigger/initiating event as box 1, (d) place the cloze on 2-3 mechanism steps (not the trigger), (e) end with the clinical consequence as the last box. |
| Cloze syntax visible and highlighted in edit mode | Most Anki HTML editors either hide cloze brackets or render them. Showing `{{c1::text::hint}}` in purple-tinted highlight while editing is rare and helps users understand what will be tested. | LOW | Already implemented via `highlightCloze()` and `.clozeHighlight` CSS. This is a differentiator to protect — do not remove in v1.1. |
| Regenerate button resets to fresh AI output | When the AI output is too wrong to correct box-by-box, one click should regenerate without losing the original cloze card. This is the practical undo for major mistakes. | LOW | Already implemented in FlowView.tsx via `handleRegenerate()`. Preserve and make more discoverable in v1.1. |

---

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Three or more view modes (raw HTML / editor / preview) | Some users want to edit the raw HTML directly for precision | Three modes create toggle confusion (which mode am I in?). The existing parse-failure fallback already provides a raw textarea escape hatch when HTML is unparseable. Adding a deliberate raw HTML mode conflates "emergency escape" with "normal editing mode." | Keep it two modes: Preview (default) and Edit (visual). The fallback textarea is the raw HTML path — it activates automatically when parse fails, which is when raw editing is actually needed. |
| Auto-save to Anki on every edit | Feels responsive | Each edit would trigger an AnkiConnect write, creating orphaned card versions for every keystroke. | Keep explicit "Save to Anki" button as the commit action. |
| Undo/redo in the visual editor | Standard editor expectation | `useImmerReducer` tracks the current state graph, not a history stack. Adding undo requires either a full history stack (memory cost) or a library like `use-undo`. This is significant scope for a correction tool used briefly after AI generation. | The Regenerate button is the practical undo for large mistakes. For single-field corrections, the user can simply re-click and type the corrected value. Defer undo to v2. |
| Drag-and-drop box repositioning | Feels natural for diagram editors | HTML div-based layout encodes structure as DOM order, not absolute coordinates. Mapping drag position to DOM reorder requires complex collision detection. The result would change node order, not visual x/y position — confusing. | Up/Down reorder buttons are already implemented and do the same thing cleanly. |
| Color-coded boxes by cloze number | Visual distinction between `{{c1::...}}` and `{{c2::...}}` would help during studying | Adds color picker UI and cloze-number parsing logic to the editor. Output HTML would need per-box inline color overrides. Different devices may override colors. | Single consistent box color in v1. Color-coding is v2 after layout is stable. |

---

## Feature Dependencies

```
[Preview-First Default]
    └──requires──> [FlowchartEditor viewMode initialState = "preview"]
    └──enhances──> [Two-Mode Simplification]

[Two-Mode Simplification]
    └──requires──> [Preview-First Default]
    └──requires──> [Hide FlowView eye-toggle in flowchart/table modes]
    └──conflicts──> [Three-mode raw HTML view] (explicitly deferred)

[Richer AI Flowchart Structure]
    └──requires──> [template-defaults.ts anki_flowchart prompt rewrite]
    └──requires──> [TEMPLATE_PREV_HASHES upgrade mechanism] (already exists — new hash triggers re-generation)
    └──enhances──> [Container layout for short content] (more nodes = less empty space problem)

[Container Layout Fix]
    └──requires──> [Preview-First Default] (layout issue is most visible in preview mode)
    └──independent of──> [Richer AI Flowchart Structure] (fix CSS regardless of content length)

[Back Field Bug Fix (Issue 4)]
    └──requires──> [FlowView.tsx editBack assignment trace]
    └──independent of──> [FlowchartEditor changes]

[Button Row Overflow Fix (Issue 3)]
    └──requires──> [page.module.css .ankiFormatRow flex-wrap]
    └──independent of──> [FlowchartEditor changes]
```

### Dependency Notes

- **Preview-First and Two-Mode are tightly coupled**: changing the default mode is low-effort, but the eye-toggle hiding in FlowView is a separate change that must happen together or users face two active preview mechanisms simultaneously.
- **Richer flowchart prompt and TEMPLATE_PREV_HASHES**: the template upgrade mechanism already exists. Rewriting the prompt content will trigger re-generation for existing users automatically when the hash changes — this is intentional and desirable.
- **Issue 3 and Issue 4 are independent of each other and independent of the FlowchartEditor changes**: they are bugs in FlowView.tsx and page.module.css. They should be fixed in the same milestone but can be planned as separate tasks.
- **Container layout fix enhances preview-first**: the short-content layout problem is most visible in preview mode. Fixing layout without fixing the default mode would be less impactful.

---

## MVP Definition

### v1.1 Launch With

Minimum changes needed to address all known issues from v1.0 smoke-test and achieve the
"Preview default + Edit + richer cards" milestone goal.

- [ ] **Preview-First Default** — change `viewMode` initialState in FlowchartEditor.tsx to `"preview"`. Low risk, single line. Most impactful UX change.
- [ ] **Two-Mode Toggle labels** — rename "Preview in Anki" / "Back to Editor" to "Edit" / "Done" (or "Preview"). Makes the single-toggle pattern clear.
- [ ] **Hide FlowView eye-toggle in flowchart/table mode** — when `editorMode === "flowchart"` or `"table"`, do not render the eye icon preview button. The editor's own Preview mode supersedes it.
- [ ] **Container layout fix** — CSS changes to `.canvas`, `.editorRoot`, and `.previewContainer` to eliminate the empty-space problem with short flowcharts.
- [ ] **Richer flowchart prompt** — rewrite `anki_flowchart` template in `template-defaults.ts` to produce 5-7 node chains with labeled causal arrows and correct cloze placement.
- [ ] **Back field bug fix (Issue 4)** — trace and fix `editBack` population in FlowView.tsx `handleSwitchEditor` for flowchart/table modes.
- [ ] **Button row overflow fix (Issue 3)** — add `flex-wrap: wrap` to `.ankiFormatRow` in page.module.css.

### Add After Validation (v1.x)

- [ ] **Editing bug investigation** — surface and fix specific box/connection editing bugs discovered during real USMLE content testing. Bugs are not yet enumerated; only after real usage will specific failure modes be known.
- [ ] **Cloze N auto-increment suggestion** — when user adds a box, suggest the next available cloze number. Low value until users are actively adding boxes regularly.

### Future Consideration (v2+)

- [ ] **Undo/redo** — requires history stack; regenerate covers the practical use case.
- [ ] **Drag-and-drop repositioning** — requires solving DOM-order-as-layout mapping.
- [ ] **Multiple box shapes** (diamond, oval) — requires CSS rotation that conflicts with cloze text alignment.
- [ ] **Color-coded boxes by cloze number** — visual polish, not pedagogically necessary in v1.
- [ ] **LaTeX in box text** — no USMLE need established yet.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Preview-First Default | HIGH | LOW (1 line change) | P1 |
| Two-Mode toggle label rename | HIGH | LOW | P1 |
| Hide eye-toggle in flowchart/table mode | HIGH | LOW | P1 |
| Container layout fix | MEDIUM | LOW | P1 |
| Richer flowchart prompt | HIGH | MEDIUM (prompt engineering + hash update) | P1 |
| Back field bug fix (Issue 4) | HIGH | MEDIUM (trace data flow in FlowView.tsx) | P1 |
| Button row overflow fix (Issue 3) | MEDIUM | LOW | P1 |
| Editing bug fixes | HIGH | MEDIUM–HIGH (unknown surface area) | P1 (after surfacing) |
| Cloze N auto-increment | LOW | MEDIUM | P2 |
| Undo/redo | MEDIUM | HIGH | P3 |
| Drag-and-drop | MEDIUM | HIGH | P3 |
| Multiple box shapes | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for v1.1 launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

The relevant comparison is not general-purpose diagram editors (Miro, Lucidchart) but the
narrow set of tools users might otherwise use to produce Anki flowchart cards.

| Feature | Manual HTML in Anki editor | ClozeOverlapper add-on | Image Occlusion add-on | GapStrike v1.0 | GapStrike v1.1 |
|---------|---------------------------|------------------------|------------------------|----------------|----------------|
| Preview as default view | N/A | N/A | N/A | No (editor default) | Yes |
| Clear two-mode UX | N/A | N/A | N/A | No (two toggle systems) | Yes |
| Richer mechanism chain structure | Manual | No | No | Basic (3-4 nodes) | Richer (5-7 nodes with causal labels) |
| Correct Back field content | Manual | N/A | N/A | Bug (Issue 4) | Fixed |
| Responsive button row | N/A | N/A | N/A | Overflows (Issue 3) | Fixed |
| AI generates card structure | No | No | No | Yes | Yes (improved) |
| Visual editing of boxes | No | No | Yes (image-based) | Yes (div-based) | Yes (div-based, polished) |
| No add-on required | Yes | No | No | Yes | Yes |

---

## Sources

- `C:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI/.planning/PROJECT.md` — v1.1 target features, constraints (HIGH confidence — project authority)
- `C:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI/.planning/MILESTONES.md` — v1.0 known issues at ship (HIGH confidence — recorded smoke-test findings)
- `C:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI/.planning/phases/05-polish-and-deploy/05-VERIFICATION.md` — Issue 1–4 details (HIGH confidence — structured verification report)
- `C:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI/gapstrike/src/components/FlowchartEditor.tsx` — live code, current viewMode state (HIGH confidence — codebase)
- `C:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI/gapstrike/src/components/FlowchartEditor.module.css` — current CSS, layout constraints (HIGH confidence — codebase)
- `C:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI/gapstrike/src/components/TableEditor.tsx` — live code (HIGH confidence — codebase)
- `C:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI/gapstrike/src/lib/flowchart-types.ts` — FlowGraph model (HIGH confidence — codebase)
- `C:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI/.planning/REQUIREMENTS.md` — v1 and v2 requirements, traceability (HIGH confidence — project authority)
- UX pattern references (preview-first default, single toggle): general knowledge from Notion, Obsidian, GitHub Markdown editors — standard industry pattern (MEDIUM confidence — no WebSearch available, from training knowledge)

---

*Feature research for: AI-generated Anki flowchart/table card visual editor — v1.1 Editor Polish*
*Researched: 2026-03-09*
