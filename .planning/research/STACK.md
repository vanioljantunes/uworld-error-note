# Stack Research

**Domain:** v1.1 Editor Polish — two-mode UX, CSS layout improvements, richer AI flowchart prompts for GapStrike FlowchartEditor
**Researched:** 2026-03-09
**Confidence:** HIGH (all recommendations are zero-new-dependency or internal code changes; stack is locked from v1.0)

---

## Context: What v1.0 Already Provides

Do NOT re-research or re-install:

| Technology | Version | Status |
|------------|---------|--------|
| React 19 + Next.js 15 | 19.0.0 / 15.1.3 | Installed, working |
| TypeScript 5 | ^5.0.0 | Installed |
| immer 11.1.4 | 11.1.4 | Installed, used in FlowchartEditor |
| use-immer 0.11.0 | 0.11.0 | Installed, used in FlowchartEditor |
| html-react-parser 5.2.17 | 5.2.17 | Installed |
| CSS Modules | (Next.js built-in) | Used in FlowchartEditor.module.css |
| Browser DOMParser | Web API | No install, used in parse-flow-html.ts |
| vitest 4.0.18 | 4.0.18 | Installed, used for parser tests |

**v1.1 needs ZERO new npm packages.** All three features are implemented via:
1. State shape changes + reducer actions (two-mode editor)
2. CSS Module additions (container layout)
3. Prompt string changes in `template-defaults.ts` (richer AI flowcharts)

---

## Recommended Stack

### Core Technologies

No new core technologies. The three features use exclusively what is already installed.

### Feature 1: Two-Mode Editor (Preview Default + Edit Mode)

**What needs to change:** `FlowchartEditorInner` in `FlowchartEditor.tsx`.

| Mechanism | Technology | Why This Approach |
|-----------|------------|-------------------|
| Mode state | `useImmerReducer` (already used) — add `viewMode: "preview" \| "edit"` as default `"preview"` | The FlowState already has `viewMode: "editor" \| "preview"`. Change the initial value from `"editor"` to `"preview"` and rename `"editor"` to `"edit"` for clarity. One-line change to `initialState`. |
| Preview rendering | `dangerouslySetInnerHTML={{ __html: value }}` via existing `FlowchartPreview` component | Already implemented and working. Preview default means this renders first — no new code. |
| Mode toggle button | Existing `<button className={styles.toggleBtn}>` in editorHeader | Change button label: "Edit" (in preview mode) and "Preview" (in edit mode). No new component needed. |
| Toolbar visibility | Conditional render `{state.viewMode === "edit" && <div className={styles.toolbar}>}` | Already conditional on `viewMode`. Rename the condition string from `"editor"` to `"edit"`. |
| Cloze syntax in edit boxes | `highlightCloze()` (already implemented) | No change — it highlights `{{cN::text}}` spans in the editor view. |

**Integration point:** The `TOGGLE_VIEW` action in `flowReducer` already exists. Change initial state only:

```typescript
// FlowchartEditorInner — change one line:
const initialState: FlowState = {
  // ...
  viewMode: "preview",  // was "editor" — this is the ONLY required change for default preview
  // ...
};
```

Rename `"editor"` → `"edit"` throughout the reducer and JSX for clarity (search-replace, no logic change).

**No new libraries needed.** Confidence: HIGH.

---

### Feature 2: Container Layout for Short Content

**Problem:** Boxes with short text (1-3 words) collapse to very narrow widths because the box uses `display:inline-block` with no `min-width`. This makes the flowchart look broken when mixed with longer boxes.

**What needs to change:** CSS in `FlowchartEditor.module.css` (editor view) and `FLOWCHART_STYLES` in `flowchart-styles.ts` (Anki HTML output).

| Mechanism | Technology | Why This Approach |
|-----------|------------|-------------------|
| Editor-side box min-width | Add `min-width: 120px` to `.nodeCard` in `FlowchartEditor.module.css` | Pure CSS, zero dependencies. The `.nodeCard` class currently has `max-width: 320px` but no `min-width`. Adding `min-width: 120px` fixes the collapse without affecting wide boxes. |
| Anki-side box min-width | Add `min-width:120px` to the `box` entry in `FLOWCHART_STYLES` in `flowchart-styles.ts` | The AI template and `rebuildHTML()` both use `FLOWCHART_STYLES.box` for the inline style string. Adding `min-width:120px` to that string propagates to both AI-generated cards and editor-rebuilt cards. |
| Consistent padding for short text | Existing `padding:8px 16px` already provides horizontal breathing room | No change needed — padding is already applied. The issue is min-width, not padding. |
| Anki cross-platform compatibility | `min-width` is supported in AnkiDesktop (Chromium), AnkiDroid (WebView), AnkiMobile (WKWebView) | `min-width` on block/inline-block elements is universally supported. No risk. Confidence: HIGH. |

**Exact CSS change:**

```css
/* FlowchartEditor.module.css — add min-width to .nodeCard */
.nodeCard {
  /* existing properties */
  min-width: 120px;  /* ADD: prevents collapse on short labels */
}
```

```typescript
// flowchart-styles.ts — add min-width to box style string
export const FLOWCHART_STYLES = {
  // ...
  box: 'border:2px solid #3a3a3a;padding:8px 16px;display:inline-block;background:#1a1a1a;color:#e2e2e2;border-radius:4px;min-width:120px',
  // ...
};
```

**No new libraries needed.** Confidence: HIGH.

---

### Feature 3: Richer AI-Generated Flowchart Structure

**What needs to change:** The `anki_flowchart` template in `template-defaults.ts`.

This is a prompt engineering change — no library additions, no API changes, no schema changes.

**Current prompt weaknesses (observed from template analysis):**

| Weakness | Current Behavior | Required Fix |
|----------|-----------------|--------------|
| Generic step labels | Rules say "NEVER use generic leads to, causes, then" but examples still show simple verbs | Add explicit BAD vs GOOD examples showing weak vs strong relational verbs in the Card Structure section |
| Shallow branching | Examples show at most 2 branch arms | Add a 3-arm branch example to Card Structure to encourage richer structure when content supports it |
| Under-specified cloze placement | "cloze exactly 2-3 mechanism boxes" but no guidance on which boxes NOT to cloze | Strengthen the negative rule: "NEVER cloze leaf-level clinical manifestations (e.g., Confusion, Ataxia) — these are outcomes, not the recall target" |
| No intermediate chain guidance | Prompt does not specify how to handle 5+ step linear chains | Add: "For linear chains longer than 3 steps, group intermediate steps into a single box with a multi-line label rather than adding excessive intermediate nodes" |
| Title quality | Titles can be generic ("Kidney Development") | Add: "Title should name the MECHANISM or PATHWAY, not just the organ/condition. GOOD: 'Wernicke Encephalopathy Mechanism'. BAD: 'Thiamine Deficiency'" |

**Implementation:** Edit the `content` string of the `anki_flowchart` entry in `TEMPLATE_DEFAULTS`. Update `TEMPLATE_PREV_HASHES.anki_flowchart` with the new hash after the change.

**Hash update requirement:** The `TEMPLATE_PREV_HASHES` mechanism auto-upgrades uncustomized user templates. The new hash must be computed after the content change and added to the array:

```typescript
// template-defaults.ts — after changing anki_flowchart content:
export const TEMPLATE_PREV_HASHES: Record<string, string[]> = {
  anki_flowchart: [
    "d2343b1e21aa9df1",
    "a5f7aade1b01b248",
    "195d2fc7a40117fd",
    "6c7928647efcdecb",
    "ab29f95e3c05a983",
    "607faa7057d4a280",
    // ADD the new hash here after computing it
  ],
  // ...
};
```

The hash function used is an 8-byte hex digest (visible in the existing hash format). Check `templates/route.ts` for the exact hashing implementation used at runtime.

**No new libraries needed.** Confidence: HIGH.

---

### Supporting Libraries

No new supporting libraries are required for v1.1.

| Considered | Decision | Reason |
|------------|----------|--------|
| `clsx` / `classnames` | Skip | Already managing class composition with template literals. `styles.toolbarBtn + (active ? " " + styles.toolbarBtnActive : "")` pattern is used throughout — adding clsx would require refactoring all existing class strings with no functional benefit for v1.1 scope. |
| `@radix-ui/react-tabs` | Skip | The two-mode toggle is a single button that flips a boolean state. Radix Tabs adds accessible tab panels but the UX spec says "button in editorHeader" — overkill for one toggle. |
| CSS custom properties polyfill | Skip | Already using CSS custom properties (`var(--bg)`, `var(--border)`) via global styles. No new custom property needs are introduced. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vitest (already installed) | Test new initial state default | Add one test: `FlowchartEditorInner` initial viewMode should be `"preview"`. Existing reducer tests in `flowReducer.test.ts` cover TOGGLE_VIEW — verify the renamed action string passes. |
| Anki desktop review | Verify `min-width:120px` renders correctly in Anki card reviewer | After adding min-width to FLOWCHART_STYLES, generate a test card and review in Anki desktop + AnkiDroid. The key concern is whether WebView on older Android renders min-width on inline-block correctly (it does — min-width is baseline CSS). |

---

## Installation

```bash
# v1.1 requires NO new npm installs
# All changes are code-only:
# 1. FlowchartEditor.tsx — change initialState.viewMode from "editor" to "preview"
# 2. FlowchartEditor.module.css — add min-width: 120px to .nodeCard
# 3. flowchart-styles.ts — add min-width:120px to FLOWCHART_STYLES.box string
# 4. template-defaults.ts — improve anki_flowchart prompt content + update TEMPLATE_PREV_HASHES
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Default `viewMode: "preview"` via initial state | Persist last mode to localStorage | If users frequently switch modes and want their preference remembered across sessions. For v1.1 the spec says "default to Preview" — no persistence needed. |
| `min-width: 120px` on box | `width: fit-content` with a fixed minimum via `min-width` | `fit-content` is the same as `display:inline-block` default behavior. `min-width` is the correct constraint. No change to width behavior for boxes that are already wide enough. |
| Prompt-only improvements for richer flowcharts | Add a new `anki_flowchart_v2` template slug | Adding a new slug requires user migration, a new Supabase row, and UI changes to list it. Improving the existing `anki_flowchart` template with the `TEMPLATE_PREV_HASHES` auto-upgrade mechanism handles it invisibly for existing users. |
| Edit only prompt `Rules` section | Edit prompt `Card Structure` section (add 3-arm example) + `Rules` section | Both need changes. Rules clarify what NOT to do; Card Structure shows what TO do. Changing only Rules without examples produces inconsistent results from GPT-4o — concrete examples are more effective than abstract rules for structured output tasks. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| New npm packages for mode switching | A `viewMode` string in existing `FlowState` already models this perfectly. Adding a library for a boolean toggle adds bundle weight with zero benefit. | Change `initialState.viewMode` to `"preview"`. |
| `height: auto` on `.nodeCard` without `min-height` | If a box label is empty (blank string), `height: auto` with no min-height collapses the box to 0px, making it invisible. | Keep existing `padding: 8px 16px` which provides implicit minimum height via the padding model. Add `min-width` only. |
| `!important` in CSS Module overrides | FlowchartEditor.module.css does not currently use `!important`. Adding it to fix layout issues creates specificity debt that's hard to undo. | Target the exact element with a more specific selector or add the property directly to the existing rule. |
| Changing `display:inline-block` to `display:flex` on boxes | `display:flex` on the box itself changes how its text content lays out. `inline-block` is correct because it allows centering via the parent `text-align:center` wrapper. | Keep `display:inline-block`, add only `min-width:120px`. |
| GPT-4o model upgrade for richer flowcharts | The prompt is the bottleneck, not the model capability. `gpt-4o` already generates valid structured HTML. Switching to `o1` or `o3` would slow generation (reasoning tokens) and cost more with no quality gain for structured HTML output. | Improve the prompt examples and rules in `template-defaults.ts`. |

---

## Stack Patterns by Variant

**If the "two-mode" simplification also removes connect mode:**
- Remove `connectMode` and `connectingFromId` from `FlowState` if the Edit mode no longer offers connect-wire-drawing
- The `TOGGLE_VIEW` action in the reducer stays the same — just don't render the Connect toolbar button in Edit mode
- Removing connect mode means the `handleConnectClick` handler and `ADD_EDGE` dispatch in `FlowchartEditorInner` can also be removed

**If min-width needs to be different for branch-arm boxes vs main chain boxes:**
- Branch arm boxes are inside `.branchPadding` — add a descendant selector: `.branchPadding .nodeCard { min-width: 80px; }` to allow tighter layout in branches
- Main chain boxes can stay at `min-width: 120px`

**If the prompt improvements need to be tested before shipping:**
- Use the GapStrike TemplatesView to manually regenerate 3-5 test cards with different medical content
- Verify: branching structure appears when biology branches, step labels are specific verbs, clozes are on mechanism steps not leaf outcomes
- This is manual smoke testing — no new test infrastructure needed

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| FlowState `viewMode: "preview"` | All existing reducer logic | `TOGGLE_VIEW` action already handles `"editor" → "preview"` toggle; renaming to `"edit"` requires updating the two string literals in the reducer and the JSX conditional render. |
| `min-width: 120px` inline style in Anki | AnkiDesktop 2.1.x, AnkiDroid 2.17+, AnkiMobile | `min-width` on inline-block elements is supported in all Chromium/WebKit versions Anki uses. No compatibility risk. |
| Updated `anki_flowchart` template content | `TEMPLATE_PREV_HASHES` auto-upgrade mechanism | Requires adding the new content hash to `TEMPLATE_PREV_HASHES.anki_flowchart`. The API route in `templates/route.ts` reads this at runtime to detect uncustomized templates and auto-upgrade them. |

---

## Sources

- `gapstrike/src/components/FlowchartEditor.tsx` (731 lines) — Current `FlowState` shape, `initialState`, `TOGGLE_VIEW` action confirmed. viewMode starts as `"editor"`. (HIGH confidence — direct code read)
- `gapstrike/src/components/FlowchartEditor.module.css` — `.nodeCard` has `max-width: 320px`, no `min-width`. (HIGH confidence — direct code read)
- `gapstrike/src/lib/flowchart-styles.ts` — `FLOWCHART_STYLES.box` string confirmed, no min-width. (HIGH confidence — direct code read)
- `gapstrike/src/lib/template-defaults.ts` — `anki_flowchart` template `content` and `TEMPLATE_PREV_HASHES` structure confirmed. (HIGH confidence — direct code read)
- `gapstrike/src/lib/rebuild-flow-html.ts` — `rebuildHTML()` uses `FLOWCHART_STYLES.box` directly — min-width addition propagates automatically. (HIGH confidence — direct code read)
- MDN Web Docs: `min-width` — Universal support in modern browsers and all Anki WebView environments. (HIGH confidence)
- OpenAI documentation: GPT-4o structured output — Model is already used at `temperature: 0.5`; prompt quality (not model) is the bottleneck for structured HTML generation. (MEDIUM confidence — inference from existing API usage pattern)

---

*Stack research for: GapStrike FlowchartEditor v1.1 Editor Polish — two-mode UX, container layout CSS, richer AI prompts*
*Researched: 2026-03-09*
