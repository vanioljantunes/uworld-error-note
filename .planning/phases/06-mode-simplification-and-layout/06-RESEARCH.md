# Phase 6: Mode Simplification and Layout - Research

**Researched:** 2026-03-09
**Domain:** React component state management, CSS flexbox layout
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Two mode labels: "Preview" and "Edit" (replacing "Preview in Anki" / "Back to Editor")
- Toggle pair UI: both buttons always visible as tabs/pills, active one highlighted (not a single flip button)
- Default mode on editor open: Preview (currently defaults to "editor")
- Hide the eye-toggle (ankiPreview button) entirely when in flowchart or table editor mode
- Restore the eye-toggle when user exits back to normal cloze editing mode (still useful for plain cloze cards)
- Add `flex-wrap: wrap` to `.ankiFormatRow` so buttons wrap to a second line on narrow screens

### Claude's Discretion
- Toggle pair placement in the editor header (left vs right of title)
- Toolbar appearance transition (instant vs animated) when switching Preview -> Edit
- FlowchartEditor Preview content format (inline render vs Front/Back split)
- Format button wrap alignment, button sizing on mobile, row gap spacing

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UX-01 | FlowchartEditor opens in Preview mode (Anki render) by default instead of Edit mode | Change `viewMode: "editor"` to `viewMode: "preview"` in `initialState` at FlowchartEditor.tsx:416-425; no other changes needed — LOAD action already resets state but does NOT reset viewMode |
| UX-02 | Editor has exactly two modes — Preview and Edit — no other view mode options anywhere | Replace single `toggleBtn` with two-button tab pair in `.editorHeader`; suppress eye-toggle button (lines 1918-1924 in FlowView.tsx) conditionally on `editorMode === "flowchart" \|\| editorMode === "table"` |
| LAY-01 | Toolbar button row does not overflow on narrow screens | Add `flex-wrap: wrap` to `.ankiFormatRow` in `gapstrike/src/app/page.module.css:3122`; optionally add `row-gap` for second line spacing |
</phase_requirements>

---

## Summary

Phase 6 is a focused UI polish pass with three tightly scoped changes. All three map to existing code with pinpoint edit sites — no new components, no new state, no API changes. The work is internal to two files: `FlowchartEditor.tsx` (mode default + toggle UI) and `FlowView.tsx` + `page.module.css` (eye-toggle hide + format row wrap).

The most nuanced change is the toggle pair UI (UX-02). The current `TOGGLE_VIEW` reducer action works with a single button. A two-button tab pair requires the same `dispatch({ type: "TOGGLE_VIEW" })` calls, just triggered by whichever tab is not currently active — or alternatively, two direct `SET_VIEW_MODE` actions (which do not exist yet and do not need to exist if both tabs simply dispatch `TOGGLE_VIEW` when the inactive tab is clicked).

The eye-toggle hide (UX-02 second part) is the simplest change: one condition wrapping the existing button JSX at FlowView.tsx:1918-1924.

**Primary recommendation:** All three changes are one-pass edits. Plan them as three discrete task steps: (1) FlowchartEditor default + toggle UI, (2) eye-toggle conditional, (3) CSS wrap.

---

## Standard Stack

### Core (already in use — no new installs required)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| use-immer | ^0.11.0 | `useImmerReducer` in FlowchartEditor | Already used; no API changes needed |
| React | ^19.0.0 | Component rendering | `useState`, `useEffect` patterns already in use |
| CSS Modules | Next.js built-in | Scoped styles in `page.module.css` and `FlowchartEditor.module.css` | No new tooling |
| Vitest | ^4.0.18 | Test framework | `vitest.config.ts` exists; jsdom environment configured |

**Installation:** None required for this phase.

---

## Architecture Patterns

### File Map — Exact Edit Sites

```
gapstrike/src/
├── components/
│   ├── FlowchartEditor.tsx         # UX-01: initialState.viewMode, UX-02: toggle pair UI
│   ├── FlowchartEditor.module.css  # UX-02: add tab pair CSS classes (toggleTab, toggleTabActive)
│   └── FlowView.tsx                # UX-02: eye-toggle conditional hide (line 1918)
└── app/
    └── page.module.css             # LAY-01: add flex-wrap to .ankiFormatRow (line 3122)
```

### Pattern 1: Default viewMode change (UX-01)

**What:** Change `initialState.viewMode` from `"editor"` to `"preview"` in `FlowchartEditorInner`.

**Critical constraint:** The `LOAD` action (fired when `value` prop changes) does NOT reset `viewMode`. This is intentional — verified in the reducer at line 93-103. Changing the initialState only affects the very first mount, which is exactly the desired behavior. Subsequent `value` prop changes (e.g., AI regeneration) will NOT flip the user back to Preview unexpectedly.

```typescript
// FlowchartEditor.tsx:416-425 — BEFORE
const initialState: FlowState = {
  graph: EMPTY_GRAPH,
  viewMode: "editor",   // <-- change this
  ...
};

// AFTER
const initialState: FlowState = {
  graph: EMPTY_GRAPH,
  viewMode: "preview",  // <-- default to Preview on open
  ...
};
```

**Confidence:** HIGH — verified by reading the reducer; LOAD action does not touch viewMode.

### Pattern 2: Toggle pair UI (UX-02)

**What:** Replace the single `<button className={styles.toggleBtn}>` with a two-button tab pair. The FlowState type `"editor" | "preview"` does NOT need renaming — internal state values are separate from display labels.

**Current code (FlowchartEditor.tsx:508-514):**
```tsx
<button
  className={styles.toggleBtn}
  onClick={() => dispatch({ type: "TOGGLE_VIEW" })}
  type="button"
>
  {state.viewMode === "editor" ? "Preview in Anki" : "Back to Editor"}
</button>
```

**Replacement pattern — two tab buttons:**
```tsx
<div className={styles.modeTabs}>
  <button
    className={`${styles.modeTab} ${state.viewMode === "preview" ? styles.modeTabActive : ""}`}
    onClick={() => { if (state.viewMode !== "preview") dispatch({ type: "TOGGLE_VIEW" }); }}
    type="button"
  >
    Preview
  </button>
  <button
    className={`${styles.modeTab} ${state.viewMode === "editor" ? styles.modeTabActive : ""}`}
    onClick={() => { if (state.viewMode !== "editor") dispatch({ type: "TOGGLE_VIEW" }); }}
    type="button"
  >
    Edit
  </button>
</div>
```

**CSS to add in FlowchartEditor.module.css:**
```css
.modeTabs {
  display: flex;
  gap: 2px;
  background: var(--bg);
  border-radius: 6px;
  padding: 2px;
  border: 1px solid var(--border);
}

.modeTab {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.modeTab:hover {
  color: var(--text);
}

.modeTabActive {
  background: var(--bg-elevated);
  color: var(--text);
  font-weight: 500;
}
```

**Placement (Claude's discretion):** Right side of `.editorHeader` (existing `justify-content: space-between` handles this automatically — title on left, tabs on right).

**Confidence:** HIGH — direct JSX replacement; no state shape changes needed.

### Pattern 3: Eye-toggle conditional hide (UX-02)

**What:** Wrap the `ankiPreviewBtn` button JSX at FlowView.tsx lines 1918-1924 with a condition that hides it when `editorMode === "flowchart" || editorMode === "table"`.

**Current code (FlowView.tsx:1918-1924):**
```tsx
<button
  className={`${styles.ankiPreviewBtn} ${ankiPreview ? styles.ankiPreviewBtnActive : ""}`}
  onClick={() => setAnkiPreview((p) => !p)}
  title={ankiPreview ? "Hide preview" : "Show preview"}
>
  <svg .../>
</button>
```

**Replacement:**
```tsx
{(editorMode === "cloze" || editorMode === "question") && (
  <button
    className={`${styles.ankiPreviewBtn} ${ankiPreview ? styles.ankiPreviewBtnActive : ""}`}
    onClick={() => setAnkiPreview((p) => !p)}
    title={ankiPreview ? "Hide preview" : "Show preview"}
  >
    <svg .../>
  </button>
)}
```

**Why this condition:** Eye-toggle is "still useful for plain cloze cards" per CONTEXT.md. Q&A (`question`) mode also benefits from the preview toggle since it uses text rendering, not the FlowchartEditor. Only `flowchart` and `table` modes have their own in-editor Preview mode making the outer eye-toggle redundant.

**Side effect check:** `ankiPreview` state can remain `true` when user switches from cloze to flowchart mode — the button will just not render, but the state persists harmlessly. When user switches back to cloze, if `ankiPreview` was true it will show again. This is acceptable behavior.

**Confidence:** HIGH — single JSX conditional; `editorMode` is already in scope at that line.

### Pattern 4: Format row wrapping (LAY-01)

**What:** Add `flex-wrap: wrap` to `.ankiFormatRow` in `gapstrike/src/app/page.module.css`.

**Current CSS (page.module.css:3122-3127):**
```css
.ankiFormatRow {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}
```

**Updated CSS:**
```css
.ankiFormatRow {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;           /* LAY-01: wrap to second line on narrow screens */
  row-gap: 4px;              /* Claude's discretion: tighten second line spacing */
  margin-left: auto;
  justify-content: flex-end; /* Claude's discretion: right-align wrapped rows */
}
```

**Why `justify-content: flex-end`:** The row is right-aligned via `margin-left: auto` on a flex parent. With wrapping, subsequent rows need explicit right-alignment — otherwise wrapped items default to `flex-start`.

**Confidence:** HIGH — pure CSS change; no component changes required.

### Anti-Patterns to Avoid

- **Adding a new `SET_VIEW_MODE` action to the reducer:** Not necessary. `TOGGLE_VIEW` is sufficient since both tabs know the current `viewMode`. Avoids reducer churn.
- **Renaming `"editor"` to `"edit"` in FlowState type:** Only the display label changes. Renaming the state value would require updating the reducer, existing condition checks (`state.viewMode === "editor"`), and the exported `flowReducer` (used in tests). Keep internal value as `"editor"`.
- **Resetting `ankiPreview` to `false` on `editorMode` change:** Not locked in decisions; would add complexity. The harmless-persistence approach is simpler.
- **Animating toolbar show/hide:** Claude's discretion says instant is fine. CSS `display: none` (existing pattern) is correct — no transition needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tab/pill toggle component | Custom tab state machine | Direct `viewMode` check from existing `FlowState` | State already exists in reducer |
| Mode detection for eye-toggle | New prop threading through FlowchartEditor | Read `editorMode` directly in FlowView.tsx where button renders | Same component scope |
| CSS overflow prevention | JS-based button resizing | `flex-wrap: wrap` in CSS | One-line fix; browser handles reflow |

---

## Common Pitfalls

### Pitfall 1: LOAD action overwriting viewMode
**What goes wrong:** If someone adds `draft.viewMode = "preview"` to the `LOAD` case in the reducer, every AI regeneration would snap the user back to Preview mid-edit.
**Why it happens:** Confusion between "default on open" and "always reset on load."
**How to avoid:** ONLY change `initialState.viewMode` — do NOT touch the LOAD case.
**Warning signs:** User reports editor resetting to Preview after editing flowchart and triggering regenerate.

### Pitfall 2: Toggle pair causes extra renders via unconditional dispatch
**What goes wrong:** Clicking the already-active tab dispatches `TOGGLE_VIEW`, toggling away from the current mode.
**Why it happens:** Not guarding the click handler with a same-mode check.
**How to avoid:** Guard each tab's `onClick` with `if (state.viewMode !== targetMode)` before dispatching.
**Warning signs:** Clicking "Preview" when already in Preview switches to Edit.

### Pitfall 3: Eye-toggle state persists visibly after mode switch
**What goes wrong:** `ankiPreview` is `true` when user was in cloze mode; user switches to flowchart; the old preview panel remains visible below the FlowchartEditor.
**Root cause check needed:** Verify whether `ankiPreview === true` shows a preview panel that is SEPARATE from FlowchartEditor's render. Looking at FlowView.tsx:1937 — `{ankiPreview ? <div ref={ankiPreviewRef}...>` renders BELOW the format row and ABOVE the FlowchartEditor. These are sibling elements, not wrappers.
**Implication:** When `editorMode === "flowchart"`, the cloze `ankiPreview` panel and FlowchartEditor are BOTH visible simultaneously if `ankiPreview` is true. The eye-toggle hide alone does not close an already-open ankiPreview panel.
**How to avoid:** When `handleSwitchEditor` switches to `"flowchart"` or `"table"`, also call `setAnkiPreview(false)`. Check `handleSwitchEditor` implementation to see if this is already handled.
**Warning signs:** Stacked "front/back" preview section AND FlowchartEditor both visible when opening flowchart mode.

### Pitfall 4: flex-wrap breaks right-alignment of .ankiFormatRow
**What goes wrong:** Adding `flex-wrap: wrap` without `justify-content: flex-end` causes wrapped second-line buttons to left-align, looking misaligned.
**How to avoid:** Add `justify-content: flex-end` alongside `flex-wrap: wrap`.

---

## Code Examples

### Existing TOGGLE_VIEW reducer (verified from source)
```typescript
// FlowchartEditor.tsx:105-107
case "TOGGLE_VIEW":
  draft.viewMode = draft.viewMode === "editor" ? "preview" : "editor";
  break;
```

### Existing editorHeader structure (verified from source)
```tsx
// FlowchartEditor.tsx:503-515
<div className={styles.editorHeader}>
  <span className={styles.editorTitle}>
    {state.graph.title || "Flowchart"}
  </span>
  <button
    className={styles.toggleBtn}
    onClick={() => dispatch({ type: "TOGGLE_VIEW" })}
    type="button"
  >
    {state.viewMode === "editor" ? "Preview in Anki" : "Back to Editor"}
  </button>
</div>
```

### Existing toolbar conditional (verified from source)
```tsx
// FlowchartEditor.tsx:516-535 — toolbar only shows in editor mode
{state.viewMode === "editor" && (
  <div className={styles.toolbar}>
    <button ... >+ Add Box</button>
    <button ... >Connect</button>
  </div>
)}
```

### handleSwitchEditor — check for ankiPreview reset
```typescript
// FlowView.tsx:1157 — need to verify if setAnkiPreview(false) is called here
// Key: does switching editorMode close the ankiPreview panel?
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Single toggle button "Preview in Anki" / "Back to Editor" | Two-button tab pair "Preview" / "Edit" | Consistent with modern editor tab patterns (VS Code, CodeSandbox) |
| Editor default (raw nodes visible on open) | Preview default (rendered Anki card on open) | Better first impression; user edits less often than they review |
| Format row fixed width, overflow hidden | Format row wraps to second line | Mobile-safe; no truncation |

---

## Open Questions

1. **Does `handleSwitchEditor` already reset `ankiPreview` when switching to flowchart/table?**
   - What we know: `handleSwitchEditor` is at FlowView.tsx around line 1155-1210 (grep shows line 1155, 1157)
   - What's unclear: Whether `setAnkiPreview(false)` is called inside it
   - Recommendation: Read FlowView.tsx lines 1140-1210 before implementing the eye-toggle hide. If `ankiPreview` is NOT reset on mode switch, add `setAnkiPreview(false)` inside `handleSwitchEditor` for `"flowchart"` and `"table"` cases — this is a one-liner addition that prevents the stacked-panel pitfall.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 |
| Config file | `gapstrike/vitest.config.ts` |
| Quick run command | `cd gapstrike && npx vitest run` |
| Full suite command | `cd gapstrike && npx vitest run` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UX-01 | FlowchartEditor initialState.viewMode === "preview" | unit | `cd gapstrike && npx vitest run tests/flowchart-editor-smoke.test.ts` | ❌ Wave 0 — new test needed |
| UX-02 (toggle) | Two mode tabs render; active tab highlighted; inactive tab dispatches TOGGLE_VIEW | manual-only | n/a — requires rendered component | n/a |
| UX-02 (eye-toggle) | Eye toggle absent when editorMode is flowchart/table; present when cloze/question | manual-only | n/a — requires rendered component | n/a |
| LAY-01 | .ankiFormatRow buttons wrap on narrow width | manual-only | n/a — visual layout test | n/a |

**Note on manual tests:** UX-02 and LAY-01 are pure rendering/visual tests. The existing test suite tests logic (parse, mutate, round-trip) not rendering. No JSDOM/RTL setup exists. Human verification is the appropriate gate.

### Sampling Rate
- **Per task commit:** `cd gapstrike && npx vitest run` (full suite — only 6 files, < 5 seconds)
- **Per wave merge:** `cd gapstrike && npx vitest run`
- **Phase gate:** Full suite green + human visual verification of Preview default and tab pair before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `gapstrike/tests/flowchart-editor-initial-state.test.ts` — covers UX-01: imports `flowReducer`, asserts `initialState.viewMode === "preview"` by checking a fresh state object

*(Note: UX-02 and LAY-01 are best verified visually in the browser — not worth adding JSDOM rendering tests for this phase.)*

---

## Sources

### Primary (HIGH confidence)
- Direct source read: `gapstrike/src/components/FlowchartEditor.tsx` — full file, all patterns
- Direct source read: `gapstrike/src/components/FlowchartEditor.module.css` — all CSS classes
- Direct source read: `gapstrike/src/components/FlowView.tsx` lines 160-200, 1895-1944 — ankiPreview state, editorMode state, eye-toggle render location
- Direct source read: `gapstrike/src/app/page.module.css` lines 3122-3184 — .ankiFormatRow, .ankiFormatBtn, .ankiPreviewBtn
- Direct source read: `gapstrike/vitest.config.ts` — test framework config
- Direct source read: `gapstrike/package.json` — confirmed vitest ^4.0.18, use-immer ^0.11.0

### Secondary (MEDIUM confidence)
- CSS flexbox `flex-wrap` + `justify-content` interaction: standard CSS behavior, no library verification needed — behavior is deterministic

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all verified from package.json and source files
- Architecture: HIGH — all edit sites pinpointed from direct source reads
- Pitfalls: HIGH for Pitfall 1-2-4 (verified from source); MEDIUM for Pitfall 3 (handleSwitchEditor body not fully read — flagged as Open Question)

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable codebase, no external dependencies changing)
