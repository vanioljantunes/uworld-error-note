# Pitfalls Research

**Domain:** Visual editor UX polish — two-mode simplification, immer reducer bug fixes, CSS container layout changes, AI prompt modifications in an existing Next.js/React visual editor
**Researched:** 2026-03-09
**Confidence:** HIGH (all findings derived from direct code audit of actual source files)

---

## Critical Pitfalls

### Pitfall 1: onChange Infinite Loop When Changing Default viewMode to "preview"

**What goes wrong:**
The v1.1 goal is to default the editor to Preview mode instead of "editor". The `FlowchartEditorInner` initializes `viewMode: "editor"` in `initialState`. If you change this to `viewMode: "preview"`, nothing breaks at initialization — but if the `useEffect` watching `state.graph` is not guarded by `hasUserEdited`, switching from preview back to editor mode and then back to preview triggers `onChange(rebuildHTML(state.graph))` on every mode toggle because the graph state technically "changed" during the LOAD that happened on mount. The loop: `value → LOAD → graph updates → onChange → value prop changes → LOAD → loop`.

**Why it happens:**
The current code already has `hasUserEdited` guard and it is implemented correctly (verified in `FlowchartEditor.tsx` lines 446–450). The risk emerges if someone removes or bypasses that guard while refactoring the mode initialization. The guard resets to `false` on every LOAD, meaning mode changes alone cannot trigger onChange — only explicit mutations can. The trap is assuming "I just changed the default mode, nothing else changed" and then inadvertently removing the guard in the same edit.

**How to avoid:**
Keep the `hasUserEdited` guard on the `onChange` useEffect. When changing `initialState.viewMode` from `"editor"` to `"preview"`, make that the only change in that block. Verify the guard is still in place after the edit. The guard lives at:
```typescript
useEffect(() => {
  if (state.hasUserEdited) {  // ← this guard must survive
    onChange(rebuildHTML(state.graph));
  }
}, [state.graph, state.hasUserEdited]);
```

**Warning signs:**
- React "Maximum update depth exceeded" in browser console
- The card FRONT field flickers or resets to its original AI-generated HTML when the user first opens the editor
- Any mutation immediately triggers a full re-parse (LOAD action dispatched in rapid succession)

**Phase to address:** v1.1 Phase 1 (mode simplification)

---

### Pitfall 2: Mode Removal Breaks the TOGGLE_VIEW Action Contract

**What goes wrong:**
The current editor has two viewMode values: `"editor"` and `"preview"`. The TOGGLE_VIEW action simply flips between them. If v1.1 simplification adds a third mode (e.g., a "raw HTML" fallback mode or a separate "connect mode" view), the `TOGGLE_VIEW` action becomes ambiguous. Callers using `dispatch({ type: "TOGGLE_VIEW" })` expect a two-state toggle — adding a third state silently breaks the UI toggle button label (`"Preview in Anki"` / `"Back to Editor"`).

The inverse risk is also real: if the "connect mode" state currently stored in component-local `useState` (lines 430–431) is moved into the immer reducer as a third viewMode, the toolbar "Connect" button's behavior changes because it would now go through TOGGLE_VIEW instead of a local state setter — but the TOGGLE_VIEW action doesn't know about connect mode cleanup (clearing `connectingFromId`).

**Why it happens:**
The current code splits state between the immer reducer (`viewMode`, `graph`, `editingNodeId`, etc.) and local `useState` (`connectMode`, `connectingFromId`). This split is intentional — connect mode is a transient UI state, not a graph mutation. The pitfall emerges when a developer tries to "clean up" by consolidating everything into the reducer.

**How to avoid:**
Keep `viewMode` in the reducer as a strict two-value type: `"editor" | "preview"`. Keep `connectMode` and `connectingFromId` as local `useState`. The type definition at line 63–71 of `FlowchartEditor.tsx` enforces this — if you add a third value to `viewMode`, TypeScript will warn on the `TOGGLE_VIEW` action's flip logic. Trust that warning.

**Warning signs:**
- TypeScript error on the `viewMode === "editor" ? "preview" : "editor"` toggle expression
- The header button text shows the wrong label (e.g., "Back to Editor" when already in editor)
- Connect mode doesn't clear when toggling to preview (connection "state" leaks across mode transitions)

**Phase to address:** v1.1 Phase 1 (mode simplification)

---

### Pitfall 3: Immer Reducer Array Swap Using Destructuring Assignment

**What goes wrong:**
The `REORDER_NODE` case in the current reducer (lines 213–223) swaps labels between adjacent nodes using direct assignment:
```typescript
const tempLabel = draft.graph.nodes[idx].label;
draft.graph.nodes[idx].label = draft.graph.nodes[swapIdx].label;
draft.graph.nodes[swapIdx].label = tempLabel;
```

This is correct for immer. The pitfall is attempting to use ES6 destructuring swap syntax inside an immer draft:
```typescript
// WRONG in immer:
[draft.graph.nodes[idx], draft.graph.nodes[swapIdx]] =
  [draft.graph.nodes[swapIdx], draft.graph.nodes[idx]];
```

This breaks silently in immer because immer proxies track property access. The destructuring on the right-hand side creates a snapshot of the proxy references, not copies of the underlying data. The swap appears to succeed but both array positions end up pointing to the same underlying object — or, in some immer versions, the swap is simply lost (no mutation recorded). The result is a `REORDER_NODE` action that appears to do nothing, or corrupts the graph state.

**Why it happens:**
Destructuring swap is idiomatic JavaScript but incompatible with immer's proxy model. Developers familiar with vanilla JS instinctively reach for it. This is documented behavior in immer's docs but easy to miss when fixing bugs.

**How to avoid:**
When fixing `REORDER_NODE` bugs, always use the explicit `tempVar` swap pattern:
```typescript
const tempLabel = draft.graph.nodes[idx].label;
draft.graph.nodes[idx].label = draft.graph.nodes[swapIdx].label;
draft.graph.nodes[swapIdx].label = tempLabel;
```
If you need to swap entire node objects (not just labels), use `produce()` on a plain copy first, then assign the result back. Never use destructuring swap on immer draft arrays.

**Warning signs:**
- `REORDER_NODE` dispatches but the rendered node order doesn't change
- Two adjacent nodes display the same label after a reorder operation
- The vitest unit test for REORDER_NODE passes (it tests the reducer function directly without immer's proxy) but the browser shows wrong behavior — this mismatch indicates proxy vs. plain-object difference

**Phase to address:** v1.1 Phase 2 (fix reducer bugs)

---

### Pitfall 4: CSS Container Layout Breaks Existing FlowchartPreview dangerouslySetInnerHTML Rendering

**What goes wrong:**
`FlowchartPreview` renders AI-generated HTML via `dangerouslySetInnerHTML` inside `.previewContainer`. The AI-generated HTML uses inline `flex-direction: column` and hardcoded pixel widths (e.g., `width: 280px`, `min-width: 160px`) on inner divs. If the outer `.previewContainer` CSS changes to use `display: grid`, `overflow: hidden`, or a fixed-height container to "improve layout for short content", the AI-generated card's internal flex layout collapses because the outer container now constrains or overrides the card's sizing assumptions.

Specific risk: the v1.1 goal is "improve container layout when content is short." If this is implemented by adding `min-height` or `align-items: center` to `.previewContainer`, it changes the vertical axis for content that isn't short — tall flowcharts (5–7 boxes) will get center-aligned midway through the container, cutting off the bottom boxes on small screens.

**Why it happens:**
The preview container wraps foreign HTML whose internal structure is unknown at CSS authoring time. Any container CSS that affects the vertical axis (height, alignment, overflow) potentially conflicts with the card's internal layout assumptions. The "short content" problem is a real UX issue, but fixing it with container-level CSS is a blunt instrument.

**How to avoid:**
Fix "short content" layout by targeting the AI prompt output (make the generated HTML itself set a `min-height` or `padding`) rather than adding CSS to the React container. If CSS changes to `.previewContainer` are necessary, use only properties that affect the container's external footprint, not its internal layout axis:
- Safe: `border-radius`, `background`, `padding` (not `min-height`)
- Unsafe: `min-height`, `align-items`, `justify-content`, `overflow: hidden`, `aspect-ratio`

**Warning signs:**
- Tall flowcharts (5+ boxes) lose their bottom boxes in preview
- The arrow connectors between boxes misalign after the CSS change
- The layout looks correct in isolation (single card) but breaks when the parent is narrower than the card's min-width assumptions

**Phase to address:** v1.1 Phase 3 (container layout polish)

---

### Pitfall 5: AI Prompt Changes Silently Regress Existing Cloze Syntax Output

**What goes wrong:**
The flowchart AI prompt currently produces HTML with `{{c1::text::hint}}` cloze syntax inside box divs. The v1.1 goal is "richer AI-generated flowchart card structure." When the prompt is modified to produce richer output (more boxes, labeled arrows, nested structures), GPT-4o may shift its output format in ways that `parseFlowHTML` cannot handle:

1. The model may start wrapping box text in `<span>` or `<strong>` tags that `parseFlowHTML`'s regex doesn't strip, leaving the label as `<strong>{{c1::ACE inhibitor}}</strong>` instead of `{{c1::ACE inhibitor}}`
2. The model may start using `{{c1::text}}` (two-part) instead of `{{c1::text::hint}}` (three-part) — both are valid Anki cloze, but if the prompt explicitly requests hints and the model omits them, existing hint-display logic breaks
3. The model may produce branching structures that generate orphaned nodes (`branchGroups` without matching edges) because `parseFlowHTML` hasn't been updated to handle the new structure

The regression is silent: no TypeScript error, no crash, but the visual editor shows garbled content or falls back to raw HTML mode.

**Why it happens:**
LLM output is probabilistic. Prompt changes that seem additive ("add more detail") cause distribution shifts. The model attempts to satisfy the new constraint and relaxes a previous one (like consistent cloze format). There is no schema validation on the AI response before it reaches `parseFlowHTML`.

**How to avoid:**
1. Run the updated prompt against 5 test inputs before landing it in the codebase — verify `parseFlowHTML` can parse every output without triggering the `parseFailed` fallback
2. Add a post-generation validation step: after calling `/api/format-card`, check that `parseFlowHTML(result).nodes.length > 0` before opening the visual editor
3. When changing the prompt, change it incrementally — one constraint at a time — so regressions can be bisected to a specific prompt line

**Warning signs:**
- Users land on the raw HTML fallback textarea immediately after generation (parseFailed = true)
- The `nodes` array in the parsed FlowGraph is empty despite the AI returning non-empty HTML
- Cloze hints disappear from rendered cards (Anki shows `[...]` instead of `[hint text]`)
- The vitest `flow-round-trip.test.ts` tests still pass (they use fixture HTML, not live AI output) — this makes the regression invisible to CI

**Phase to address:** v1.1 Phase 4 (AI prompt improvement)

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Two separate state sources for connect mode (local useState) vs graph state (immer reducer) | Avoids complex reducer action for transient UI | Makes it hard to serialize editor session state or add undo/redo later | Acceptable for v1.1 — v2 ADV-02 (undo/redo) will need to consolidate |
| `window.prompt()` for step label input during ADD_EDGE | Zero UI complexity to implement | Blocks on desktop, doesn't work well on mobile, ugly | Only acceptable until a proper inline input is built (v1.1 or v2) |
| AI-generated HTML parsed with regex in `parseFlowHTML` | No DOM parsing dependency needed in tests/SSR | Brittle against AI output variations — any new wrapper tag breaks parsing | Acceptable as long as prompt is stable; must be revisited if prompt changes significantly |
| TableEditor imports from `page.module.css` (line 6) instead of its own module | Reuses existing styles | Couples TableEditor to the monolithic page stylesheet — renames in page.module.css silently break TableEditor | Never acceptable for new styles; existing coupling is tech debt to track |
| No validation of AI response format before passing to visual editors | Simpler integration path | Parse failures hit users without diagnostic info; no way to retry with corrected prompt | Acceptable for MVP; v1.1 should add at least a `parseFailed` signal (already implemented in FlowchartEditor) |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| AnkiConnect save after editor changes | Reading `editFront` state before the latest `onChange` has committed (React state update is async) | Ensure the save button handler reads `editFront` from the ref (`ankiFrontRef.current.innerHTML`) or waits for state to settle — current FlowView.tsx already reads `editFront` state, not the ref, for the save payload |
| `FlowchartPreview` rendering AI HTML via `dangerouslySetInnerHTML` | Assuming Anki Desktop and AnkiDroid will render identically | AnkiDroid converts newlines inside field content to `<br>` on edit — always test the round-trip (save card, re-open in AnkiDroid editor, confirm no layout breakage from injected `<br>` tags) |
| Vercel auto-deploy from git push | Assuming a successful push means a successful Vercel build | Vercel builds silently fail on TypeScript errors and serve the last successful deploy — always run `npm run build` locally before pushing; check Vercel deployment logs, not just git status |
| `useImmerReducer` with exported `flowReducer` | Testing the exported `flowReducer` directly in vitest without immer wrapping | `flowReducer` mutates an immer draft — in unit tests, wrap with `produce(initialState, draft => flowReducer(draft, action))` to get the correct immutable-update semantics; direct calls to `flowReducer` with a plain object will mutate the object in place |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `rebuildHTML(state.graph)` called on every keystroke during node label editing | Each character typed in the node textarea triggers `EDIT_NODE`, which triggers the `hasUserEdited` useEffect, which calls `rebuildHTML` and `onChange` | Debounce node edits: call `onChange` only on blur or Enter, not on every character | Noticeable lag on graphs with 7+ nodes containing long labels (rebuildHTML is a string concatenation loop over all nodes and edges) |
| `parseFlowHTML` called on every `value` prop change via the `[value]` useEffect | Each external `onChange` callback triggers a full re-parse | Gate `parseFlowHTML` with a `prevValue` ref — only re-parse when `value !== prevValue` (TableEditor already does this correctly at lines 96–103) | Not a current issue but becomes one if parent re-renders with same `value` reference |
| `dangerouslySetInnerHTML` on `FlowchartPreview` with large AI-generated HTML | Preview tab re-renders every time parent component re-renders | Wrap `FlowchartPreview` in `React.memo` — the preview only needs to re-render when `value` prop changes | Not a problem for current usage (single card view); would matter if multiple previews rendered simultaneously |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| `dangerouslySetInnerHTML` with AI-generated HTML | XSS if AI produces `<script>` tags or event handlers | Anki's reviewer WebView already blocks JS execution in card fields (the constraint exists for Anki compatibility, not security) — for the GapStrike editor, the AI output is trusted as it comes from the app's own API route; no user-supplied HTML is injected directly |
| `window.prompt()` in edge creation flow | Not a security issue but collects user input in an uncontrolled way that bypasses CSP in some browsers | Low priority for v1.1; replace with an inline input element when removing `window.prompt()` |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Defaulting to Preview mode but showing an empty/unparsed card on first load | User sees a blank preview while AI HTML is still loading — no indication whether the card loaded or failed | Show a loading skeleton or "Generating..." state in preview while `value` is empty; switch to editor mode automatically if `parseFailed === true` |
| Removing the "editor" mode without a clear entry point back | Users have no way to fix a cloze typo after reviewing the preview | The two-mode design (Preview default + Edit) must keep the Edit mode accessible with one click from Preview — the current toggle button pattern is correct; do not remove the toggle button even if Preview is the default |
| `window.prompt()` for step labels on mobile | Native prompt dialog breaks the mobile UX flow — keyboard appears and disappears awkwardly | Replace with inline `<input>` rendered below the connection target node before committing the edge; v1.1 if time permits, otherwise document as known limitation |
| Parse failure fallback textarea inheriting no size constraints | The fallback textarea may render too small or too large if `.fallbackTextarea` CSS is not defined in `FlowchartEditor.module.css` | Verify `.fallbackTextarea` has explicit `height`, `min-height`, and `width: 100%` in the module CSS — the current implementation (lines 46–53 of FlowchartEditor.tsx) references `styles.fallbackTextarea` which must exist in the CSS module |
| Mode toggle button label is context-dependent but placed in the header | Users in Preview mode see "Back to Editor" — correct; users in Edit mode see "Preview in Anki" — correct; but users who land on the error fallback textarea have no toggle button and no way to attempt re-parse | Add a "Retry parse" button in the fallback state that clears `parseFailed` and re-runs `parseFlowHTML(value)` |

---

## "Looks Done But Isn't" Checklist

- [ ] **Two-mode simplification:** `initialState.viewMode` is changed to `"preview"` but the `TOGGLE_VIEW` action still correctly flips between `"editor"` and `"preview"` — verify by opening editor and clicking the toggle button twice to confirm it returns to Preview
- [ ] **Parse failure fallback:** `styles.fallbackTextarea` and `styles.fallbackBanner` CSS classes are defined in `FlowchartEditor.module.css` — verify with a TypeScript build (`npm run build`) which will fail on undefined CSS module keys in strict mode
- [ ] **Immer REORDER_NODE fix:** After fixing the swap logic, test with a 3-node graph: move node 2 up (should become node 1), then move it back down — both directions must work without corrupting labels
- [ ] **Container layout change:** Verify layout with both 2-box cards (short content case) AND 7-box cards (tall content case) — fix for short content must not clip tall content
- [ ] **AI prompt richer output:** After updating the prompt, generate 5 cards from different note inputs and confirm all 5 open in the visual editor without hitting `parseFailed === true`
- [ ] **Vercel deploy:** `npm run build` completes locally with zero TypeScript errors before pushing — do not rely on Vercel to catch type errors (it does catch them but the feedback loop is 3–5 minutes vs. 10 seconds locally)
- [ ] **No regression on TableEditor:** After any CSS changes to `page.module.css`, verify the table editor still renders correctly — TableEditor imports styles from `page.module.css` (line 6) and is exposed to renames
- [ ] **hasUserEdited guard survives mode change refactor:** After implementing Preview-default mode, open DevTools → React DevTools → inspect FlowchartEditor state, confirm `hasUserEdited` starts as `false` after loading a card and only becomes `true` after clicking a node and typing

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| onChange infinite loop introduced | LOW | Add `console.log` to the `useEffect` watching `state.graph` to confirm loop — then add/restore the `hasUserEdited` guard; loop stops immediately |
| REORDER_NODE bug introduced by destructuring swap | LOW | Revert to explicit `tempLabel` variable swap; run `npx vitest run tests/flow-editor-mutations.test.ts` to confirm |
| CSS layout breaks FlowchartPreview | MEDIUM | Revert the `.previewContainer` CSS change; instead, modify the AI prompt to include a `min-height` inline style on the root card div |
| AI prompt regression in cloze output | MEDIUM | Revert the prompt change in `/api/format-card`; re-test with the previous prompt; then reintroduce the enhancement one sentence at a time with test verification between each change |
| Vercel builds stale (serves last good deploy) | LOW | Run `npx vercel --prod --force` from the `gapstrike/` directory to force a fresh build; if CLI auth fails, make an empty commit and push |
| TableEditor broken by page.module.css rename | LOW | Check which class names changed; update the matching names in TableEditor.tsx; run `npm run build` to confirm |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| onChange infinite loop on mode default change | v1.1 Phase 1 (mode simplification) | Open editor, confirm no "Maximum update depth exceeded" in console; confirm `hasUserEdited` is false in React DevTools after card loads |
| TOGGLE_VIEW contract broken by mode addition | v1.1 Phase 1 (mode simplification) | TypeScript `tsc --noEmit` must pass; toggle button must show correct labels in both modes |
| Immer destructuring swap corruption | v1.1 Phase 2 (reducer bug fixes) | `npx vitest run tests/flow-editor-mutations.test.ts` green; manual test of reorder in both directions on 3-node graph |
| CSS container layout breaks preview | v1.1 Phase 3 (container layout polish) | Render a 2-box card and a 7-box card in preview side by side; confirm both display correctly |
| AI prompt regression in cloze format | v1.1 Phase 4 (AI prompt improvement) | Generate 5 cards from diverse inputs; confirm all open in visual editor (not fallback); confirm cloze syntax `{{c1::text::hint}}` present in all generated cards |
| Vercel stale deploy | v1.1 Phase 5 (deploy) | `npm run build` green locally before push; Vercel deployment log shows successful build from latest commit SHA |

---

## Sources

- Direct code audit: `gapstrike/src/components/FlowchartEditor.tsx` (731 lines) — confirmed `hasUserEdited` guard, `TOGGLE_VIEW` action, `REORDER_NODE` label-swap implementation, `parseFailed` fallback state, and local `connectMode`/`connectingFromId` useState split
- Direct code audit: `gapstrike/src/components/TableEditor.tsx` — confirmed import from `page.module.css` at line 6 (tech debt coupling)
- Direct code audit: `gapstrike/.planning/phases/04-editing-operations/04-RESEARCH.md` — confirmed immer destructuring swap anti-pattern documentation (Pattern 5 / Corrected REORDER_NODE section)
- Direct code audit: `.planning/codebase/CONCERNS.md` — confirmed zero test coverage concern and LLM output parsing concern (#8)
- Direct code audit: `.planning/phases/05-polish-and-deploy/05-CONTEXT.md` — confirmed Vercel stale deploy issue encountered in production (Phase 5 gap closure plan 05-04 exists to address it)
- immer docs (knowledge): destructuring swap on draft arrays is a documented incompatibility — https://immerjs.github.io/immer/pitfalls (immer pitfalls section)
- Project constraint: "AnkiDroid converts newlines to `<br>` on edit" — documented in `.planning/PROJECT.md` constraints section

---
*Pitfalls research for: FlowchartAnki v1.1 editor polish — mode simplification, immer reducer fixes, CSS container layout, AI prompt changes*
*Researched: 2026-03-09*
