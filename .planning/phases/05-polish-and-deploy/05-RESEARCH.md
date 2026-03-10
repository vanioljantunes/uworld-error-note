# Phase 5: Polish and Deploy - Research

**Researched:** 2026-03-10
**Domain:** React Error Boundaries, AnkiDroid HTML rendering, Next.js/Vercel deployment
**Confidence:** HIGH

## Summary

Phase 5 is a hardening-and-ship phase with three discrete concerns: (1) parse failure resilience in FlowchartEditor via React Error Boundary + textarea fallback, (2) AnkiDroid rendering verification for both flowchart and table cards, and (3) Vercel production deploy after all code changes land.

The codebase is in excellent shape. Phase 4 is fully complete with all editing operations verified by a human. The existing `FlowchartEditor.tsx` has a clear `errorState` div that already signals "empty flowchart" — this is the natural insertion point for the parse-failure textarea fallback. The `parseFlowHTML` function returns `{ title: '', nodes: [], edges: [], branchGroups: [] }` on failure (empty wrapper), so `nodes.length === 0` is the reliable failure signal. `rebuildHTML` already emits no newlines between tags (a critical AnkiDroid requirement, already enforced by an existing test).

The deploy path is already wired: `.vercel/` directory exists, `vercel.json` configures API function timeouts, and Vercel auto-deploys on git push. The only deploy gate is a local `next build` pass before pushing.

**Primary recommendation:** Implement textarea fallback inside `FlowchartEditor` (not as a separate wrapper component), wrap it in a class-based Error Boundary, validate AnkiDroid rendering manually, then push to Vercel.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Parse failure fallback
- Show raw HTML in an editable textarea when parseFlowHTML fails or returns an empty/invalid graph
- Textarea edits sync via onChange in real-time — consistent with visual editor behavior
- Subtle warning banner above textarea: "Could not parse flowchart — showing raw HTML" (amber/yellow)
- Wrap FlowchartEditor in a React Error Boundary to catch both parse failures AND render crashes — both fall back to textarea

#### AnkiDroid rendering
- Manual check + document: sync a test card to AnkiDroid, visually confirm, document result
- If issues found: fix template inline styles to use simpler CSS that works on both desktop and mobile
- Test both flowchart AND table cards on AnkiDroid
- Acceptance bar: boxes visible with text, arrows/labels appear, cloze reveals/hides correctly on tap (not pixel-perfect)

#### Deploy strategy
- Full flow smoke-test on production: generate flowchart card → edit → save to Anki; generate table card → edit → save; confirm no console errors
- Just push and verify — Vercel auto-deploys from git push, env vars already configured
- Deploy last — complete all code changes (fallbacks, any template fixes), then deploy once
- Run `next build` locally first to catch TypeScript/build errors before pushing

### Claude's Discretion
- Error Boundary implementation details (class component vs library)
- Warning banner styling (exact colors, positioning)
- Textarea sizing and styling in fallback mode
- Build error fix approach if any arise

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TMPL-06 | Generated HTML renders correctly in Anki's card viewer on desktop and mobile | AnkiDroid inline-style constraints, no-newline rule (already in rebuildHTML), parse-failure fallback ensures broken HTML never reaches Anki |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React (class component) | 19.0.0 (already installed) | Error Boundary — only class components can implement `componentDidCatch` + `getDerivedStateFromError` | React docs: function components cannot be Error Boundaries as of React 19 |
| Next.js | 15.1.3 (already installed) | `next build` for pre-deploy TypeScript/build validation | Project already uses this |
| Vitest + jsdom | 4.0.18 (already installed) | Unit tests for fallback logic detection | Already configured in `vitest.config.ts` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| CSS Modules | Built-in | Warning banner and textarea fallback styles | Consistent with existing pattern (FlowchartEditor.module.css) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Class-based Error Boundary | `react-error-boundary` npm package | Package is fine but adds a dependency for ~20 lines of code; class component is self-contained and requires no install |
| In-component fallback check | Separate ErrorBoundary wrapper component | Both work; in-component check handles the "empty graph" parse failure; Error Boundary wrapper handles render crashes — use BOTH for complete coverage |

**Installation:** No new packages needed. All dependencies already present.

---

## Architecture Patterns

### Recommended Project Structure

No structural changes needed. Changes are isolated to:

```
gapstrike/src/
├── components/
│   ├── FlowchartEditor.tsx        # Add: fallback detection + textarea + Error Boundary class
│   └── FlowchartEditor.module.css # Add: .fallbackBanner, .fallbackTextarea CSS classes
└── (no new files required)
```

### Pattern 1: Parse-Failure Detection Inside FlowchartEditor

**What:** After `parseFlowHTML(value)` is called in the `useEffect`, check if `graph.nodes.length === 0`. If empty, set a `parseFailed` local state flag. Render the textarea fallback path instead of `FlowRendererWithConnect`.

**When to use:** Any time the AI returns HTML that does not match the expected template structure.

**Why `nodes.length === 0` is the right signal:** `parseFlowHTML` already returns `{ nodes: [], ... }` when it cannot find a recognizable wrapper OR when the wrapper has no box elements. This is the existing contract — no code changes needed in the parser itself.

**Example:**
```typescript
// Inside FlowchartEditor component, before the main JSX return
const [parseFailed, setParseFailed] = useState(false);

useEffect(() => {
  const graph = parseFlowHTML(value);
  if (graph.nodes.length === 0) {
    setParseFailed(true);
    // Do NOT dispatch LOAD — leave editor state untouched
  } else {
    setParseFailed(false);
    dispatch({ type: "LOAD", graph });
  }
}, [value]);

// In JSX: conditional render
{parseFailed ? (
  <div className={styles.fallbackRoot}>
    <div className={styles.fallbackBanner}>
      Could not parse flowchart — showing raw HTML
    </div>
    <textarea
      className={styles.fallbackTextarea}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
    />
  </div>
) : (
  /* existing editor/preview JSX */
)}
```

**Critical:** The textarea must use `value={value}` (the prop, not internal state) and call `onChange` directly. This exactly mirrors the existing prop contract.

### Pattern 2: React Error Boundary Wrapper

**What:** A class component that catches render-time errors thrown anywhere inside FlowchartEditor (e.g., `rebuildHTML` throws, a DOM traversal throws). Falls back to the same textarea UI.

**When to use:** Wrap the entire `FlowchartEditor` export at the call site (in FlowView.tsx) OR define the Error Boundary class at the top of `FlowchartEditor.tsx` and export a wrapped default.

**Recommended approach:** Define the Error Boundary in `FlowchartEditor.tsx` and export the wrapped component as default. This keeps the resilience co-located with the editor.

**Example:**
```typescript
// Source: React docs - https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary

interface ErrorBoundaryProps {
  value: string;
  onChange: (val: string) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class FlowchartEditorErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[FlowchartEditor] Render error caught by boundary:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.fallbackRoot}>
          <div className={styles.fallbackBanner}>
            Could not render flowchart — showing raw HTML
          </div>
          <textarea
            className={styles.fallbackTextarea}
            value={this.props.value}
            onChange={(e) => this.props.onChange(e.target.value)}
            spellCheck={false}
          />
        </div>
      );
    }
    return <FlowchartEditorInner {...this.props} />;
  }
}

// Rename current export:
function FlowchartEditorInner({ value, onChange }: FlowchartEditorProps) { ... }

// New default export:
export default FlowchartEditorErrorBoundary;
```

**Note on styles:** The Error Boundary class references `styles` (CSS module object). This works because the module object is imported at the file level — class components can access module-level imports normally.

### Pattern 3: Warning Banner Styling (Claude's Discretion)

**Recommendation:** Use an amber/yellow inline-style approach that matches the design system without adding new CSS variables. The design system uses `#EAEAE5` base with stone palette — amber warning is a standard deviation.

```css
/* FlowchartEditor.module.css additions */

.fallbackRoot {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px;
  gap: 8px;
}

.fallbackBanner {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  color: #92400e;          /* amber-800 */
  background: #fef3c7;     /* amber-100 */
  border: 1px solid #fcd34d; /* amber-300 */
  flex-shrink: 0;
}

.fallbackTextarea {
  flex: 1;
  width: 100%;
  min-height: 200px;
  font-family: monospace;
  font-size: 11px;
  line-height: 1.5;
  padding: 8px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--text);
  resize: vertical;
  outline: none;
}
```

### AnkiDroid CSS Compatibility

**What AnkiDroid supports (HIGH confidence — from rebuildHTML design and existing no-newline test):**

- Inline styles on individual elements: YES — this is exactly what the template uses
- `display:inline-block` and `display:inline-flex`: YES for modern AnkiDroid (2.17+)
- `border-radius`: YES
- No newlines between tags: CRITICAL — AnkiDroid converts `\n` to `<br>` when editing a card; `rebuildHTML` already enforces this (tested)
- `{{c1::text}}` cloze syntax: YES — Anki handles this natively; the template stores raw cloze, not rendered spans

**Potential AnkiDroid issues to watch for during manual test:**

1. Font color `#e2e2e2` on background `#1a1a1a` (dark boxes): should be fine since both are inline styles, but check if AnkiDroid's default theme overrides
2. `display:inline-flex` for branch wrappers: older AnkiDroid may not support — if branches look wrong, replace with `display:inline-block` workaround
3. `border:2px solid #3a3a3a` on boxes: fine
4. Table: `rgba(255,255,255,0.15)` border color — check visibility on AnkiDroid dark/light mode

**If CSS fixes needed:** All styles are in `FLOWCHART_STYLES` constants in `flowchart-styles.ts` and in `rebuildTable` in `TableEditor.tsx`. One edit each, templates auto-update.

### Anti-Patterns to Avoid

- **Do NOT add new state to the reducer for fallback mode.** The fallback is a rendering concern, not a graph state concern. Use local `useState` in the component.
- **Do NOT reset `parseFailed` to false immediately when `value` changes.** Wait until the new `parseFlowHTML` call succeeds (nodes.length > 0). Otherwise you get a flicker.
- **Do NOT use `try/catch` around `parseFlowHTML` as the primary fallback mechanism.** `parseFlowHTML` does not throw — it returns an empty graph. The `nodes.length === 0` check is the correct failure signal.
- **Do NOT deploy before running `next build` locally.** TypeScript errors are fatal on Vercel; a local build catches them first.
- **Do NOT push with unresolved console errors.** The smoke-test step requires zero console errors on production.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Error catching in React | Custom try/catch in render functions | React class Error Boundary (`getDerivedStateFromError`) | React's mechanism is the only way to catch errors in child render/constructor — try/catch in JSX render does not catch child throws |
| AnkiDroid CSS compatibility testing | Automated pixel-diff test | Manual smoke test with real device/emulator | AnkiDroid rendering has too many variables (theme, version, font override) for meaningful automation |

**Key insight:** The Error Boundary pattern exists precisely because React's reconciliation swallows render errors without it. Any other approach (try/catch in useEffect, manual error state) only catches async errors, not synchronous render failures.

---

## Common Pitfalls

### Pitfall 1: Error Boundary Does Not Reset on New Props

**What goes wrong:** User sees a broken card, navigates away, comes back with a new card — the Error Boundary is still in `hasError: true` state because class component state persists.

**Why it happens:** `getDerivedStateFromError` sets `hasError: true` and nothing resets it.

**How to avoid:** Implement `getDerivedStateFromError` to also check if the `value` prop changed. Alternatively, add a `key` prop to the Error Boundary based on the card ID so React remounts it on new card load.

**Warning signs:** Fallback textarea shows old HTML after switching cards.

**Recommended fix:**
```typescript
// In the Error Boundary, use key prop at call site in FlowView.tsx:
// <FlowchartEditor key={cardId} value={...} onChange={...} />
// OR add static getDerivedStateFromError + componentDidUpdate to reset on prop change
```

### Pitfall 2: Textarea onChange Loop with Fallback

**What goes wrong:** `onChange` fires → parent updates `value` prop → `useEffect` re-parses → `parseFailed` stays true → re-render with same value. This is actually fine and NOT a loop, but devs sometimes add unnecessary guards.

**Why it happens:** Confusion about uncontrolled vs controlled textarea semantics.

**How to avoid:** Confirm the textarea is fully controlled: `value={value}` (prop) + `onChange={(e) => onChange(e.target.value)}`. The parent owns the state; the component just pipes it through.

### Pitfall 3: AnkiDroid Newline Sensitivity

**What goes wrong:** Edited cards on AnkiDroid show extra blank lines between boxes.

**Why it happens:** AnkiDroid's card editor converts bare newlines to `<br>` when saving edits. The card is fine until manually edited on mobile.

**How to avoid:** Already handled — `rebuildHTML` emits no newlines between tags (enforced by existing test `'rebuilt HTML contains no newlines between tags'`). No action needed for generated cards. Document this as a known limitation for cards manually edited in AnkiDroid.

**Warning signs:** Extra spacing in flowchart when card is edited and re-saved within AnkiDroid mobile app.

### Pitfall 4: TypeScript Build Errors on Vercel

**What goes wrong:** `next build` on Vercel fails due to TS errors that are not caught in development (Next.js `dev` mode is more lenient).

**Why it happens:** `next build` runs full TypeScript type-checking; `next dev` may not surface all errors.

**How to avoid:** Run `next build` locally before every push. Project already has this in `package.json` scripts.

**Warning signs:** Vercel deployment shows "Type error" in build logs.

---

## Code Examples

Verified patterns from existing codebase:

### Existing `parseFlowHTML` failure return path
```typescript
// Source: gapstrike/src/lib/parse-flow-html.ts line 207-209
if (!wrapper) {
  return { title: '', nodes: [], edges: [], branchGroups: [] };
}
```
This confirms `nodes.length === 0` is the reliable failure signal — no parser changes needed.

### Existing `errorState` CSS class (already in module)
```css
/* Source: FlowchartEditor.module.css line 142-147 */
.errorState {
  padding: 24px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}
```
The `errorState` class is already defined. The new `.fallbackBanner` and `.fallbackTextarea` classes extend this pattern.

### Existing no-newline constraint (enforced by test)
```typescript
// Source: gapstrike/tests/flow-round-trip.test.ts
it('rebuilt HTML contains no newlines between tags', () => {
  const graph = parseFlowHTML(FIXTURE_LINEAR);
  const rebuilt = rebuildHTML(graph);
  expect(rebuilt).not.toMatch(/>\s*\n\s*</);
});
```
AnkiDroid newline safety is already verified. No additional work needed here.

### Vercel deploy (existing config)
```json
// Source: gapstrike/vercel.json
{
  "functions": {
    "src/app/api/extract/route.ts": { "maxDuration": 60 },
    "src/app/api/generate/route.ts": { "maxDuration": 60 },
    "src/app/api/questions/route.ts": { "maxDuration": 60 }
  }
}
```
Vercel config is fully wired. Deploy is git push only.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Empty flowchart div (line 514 in FlowchartEditor.tsx) | Parse-failure textarea fallback | Phase 5 | Users see editable raw HTML instead of a silent empty UI |
| No error catch on FlowchartEditor render | Error Boundary wrapper | Phase 5 | Render crashes are caught, user is not shown a broken white screen |

**No deprecated items.** The existing stack (React 19, Next.js 15, Vitest 4) is current as of research date.

---

## Open Questions

1. **Does AnkiDroid support `display:inline-flex` for branch wrappers?**
   - What we know: `inline-flex` is well-supported in modern WebView (Android 5+); AnkiDroid 2.17+ uses a modern WebView
   - What's unclear: The specific AnkiDroid version on the test device
   - Recommendation: Test during the AnkiDroid manual check. If branches render broken, replace `display:inline-flex` with `display:inline-block` + `white-space:nowrap` in `FLOWCHART_STYLES.branchWrapper`

2. **Does the AnkiDroid cloze reveal work with raw `{{c1::text}}` in inline-style divs?**
   - What we know: Anki desktop handles this correctly (verified in prior phases); Anki's cloze rendering is template-level, not content-level
   - What's unclear: Exact AnkiDroid behavior when cloze syntax appears inside a custom-styled div (not a standard Anki field)
   - Recommendation: This is the most important thing to verify in the AnkiDroid smoke test. Tap a cloze to confirm it reveals/hides correctly.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `gapstrike/vitest.config.ts` |
| Quick run command | `cd gapstrike && npx vitest run` |
| Full suite command | `cd gapstrike && npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TMPL-06 | Parse-failure fallback: empty graph triggers parseFailed flag | unit | `cd gapstrike && npx vitest run tests/flow-fallback.test.ts -t "parseFailed"` | ❌ Wave 0 |
| TMPL-06 | Parse-failure fallback: textarea onChange propagates to parent | unit | `cd gapstrike && npx vitest run tests/flow-fallback.test.ts` | ❌ Wave 0 |
| TMPL-06 | Error Boundary catches render errors | manual-only | N/A — Error Boundaries require interactive browser environment; jsdom cannot simulate render throws meaningfully | N/A |
| TMPL-06 | AnkiDroid rendering — boxes visible, cloze works | manual-only | N/A — requires physical device / emulator | N/A |
| TMPL-06 | Vercel production smoke test | manual-only | N/A — requires production environment | N/A |
| TMPL-06 | Local `next build` passes before deploy | build gate | `cd gapstrike && npm run build` | ✅ (script exists) |

### Sampling Rate
- **Per task commit:** `cd gapstrike && npx vitest run`
- **Per wave merge:** `cd gapstrike && npx vitest run && npm run build`
- **Phase gate:** Full suite green + manual AnkiDroid smoke test + Vercel deploy verified before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `gapstrike/tests/flow-fallback.test.ts` — covers TMPL-06 parse-failure detection (unit tests for `parseFailed` logic; Note: component rendering tests require React testing library not present — test the detection logic via `parseFlowHTML` return value assertions instead)

*(All other test files already exist and cover prior phases.)*

---

## Sources

### Primary (HIGH confidence)
- React 19 docs — Error Boundaries: `getDerivedStateFromError`, `componentDidCatch` — class components only
- Existing codebase: `gapstrike/src/lib/parse-flow-html.ts` — confirmed failure return path (`nodes: []`)
- Existing codebase: `gapstrike/src/lib/rebuild-flow-html.ts` — confirmed no-newline output
- Existing codebase: `gapstrike/tests/flow-round-trip.test.ts` — confirmed no-newline test exists and passes
- Existing codebase: `gapstrike/vercel.json` + `.vercel/` directory — confirmed deploy infrastructure wired

### Secondary (MEDIUM confidence)
- AnkiDroid inline-style support: inferred from WebView Android compatibility and prior phase design decisions (no Mermaid, no external CSS, inline styles only)
- `display:inline-flex` AnkiDroid support: inferred from modern Android WebView support table; unverified on specific device

### Tertiary (LOW confidence)
- AnkiDroid cloze behavior in custom-styled divs: unverified, manual test required

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed, no new dependencies
- Architecture: HIGH — Error Boundary and fallback patterns are well-established React patterns; codebase structure is thoroughly understood
- Pitfalls: HIGH — derived directly from codebase analysis (no-newline constraint, prop contract, TS build strictness)
- AnkiDroid compatibility: MEDIUM — inline-style approach is sound but specific device behavior requires manual verification

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable — no fast-moving dependencies)
