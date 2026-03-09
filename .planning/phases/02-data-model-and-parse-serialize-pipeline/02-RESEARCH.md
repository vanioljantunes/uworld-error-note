# Phase 2: Data Model and Parse/Serialize Pipeline - Research

**Researched:** 2026-03-09
**Domain:** TypeScript data modeling, browser DOM parsing, HTML serialization, cloze passthrough
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
All technical decisions are at Claude's discretion. Success criteria from the roadmap are the binding constraints.

### Claude's Discretion
- FlowGraph type design (flat vs tree, edge representation, branch group modeling)
- Round-trip fidelity strategy (byte-identical vs semantically equivalent HTML)
- Cloze syntax handling approach (raw text passthrough vs structured cloze objects)
- FLOWCHART_STYLES constants structure and organization
- Parser error handling for unexpected HTML variations
- TableEditor cloze fix implementation details

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FLOW-09 | Editing the flowchart updates the card's FRONT field HTML in real-time | FlowGraph model + rebuildHTML must produce valid Anki HTML; parseFlowHTML must ingest AI-generated HTML without loss |
| TABL-05 | Cloze syntax displayed raw in cells (not stripped) | TableEditor.parseTable() uses `m[1].replace(/<[^>]*>/g, "")` which strips `{{c1::text}}` when cells contain HTML; fix uses innerHTML or a protected extract |
</phase_requirements>

---

## Summary

Phase 2 is a pure TypeScript/lib layer: define the FlowGraph type, write `parseFlowHTML` (DOMParser-based), write `rebuildHTML` (template-driven serializer), and fix a one-line cloze-stripping bug in TableEditor. No React rendering, no new UI components. The deliverables are files in `gapstrike/src/lib/` plus a one-line fix in `gapstrike/src/components/TableEditor.tsx`.

The AI-generated flowchart HTML has a single well-specified structure (defined in `template-defaults.ts` under the `anki_flowchart` slug). The structure is: outer wrapper div, title div, then a linear sequence of: box div → stem div → step-pill div → stem div → box div, with branch points wrapped in `display:inline-flex` divs. The parser must map this DOM tree onto a flat FlowGraph (nodes + edges + branch groups + title). The serializer must reproduce the exact same inline-style pattern so the Anki card renders identically.

Cloze syntax (`{{cN::text}}` or `{{cN::text::hint}}`) appears only in box text content, never in HTML attributes. It is safe to pass through verbatim as a raw string at every stage — no structured cloze objects are needed. The only place cloze is stripped today is in `TableEditor.parseTable()` at line 47: `tds.map((m) => m[1].replace(/<[^>]*>/g, "").trim())`. The fix is to use `innerHTML` directly (the td content) without stripping tags, since cloze syntax is not an HTML tag and the regex only strips `<...>` angle-bracket content.

**Primary recommendation:** Use a flat FlowGraph model with DOMParser for parsing; pass cloze as raw strings throughout; fix TableEditor with a targeted innerHTML passthrough.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript (built-in) | 5.x | Type definitions, FlowGraph interface | Already in project |
| DOMParser (browser built-in) | N/A | Parse HTML strings into traversable DOM | Browser-native, no SSR concerns for this lib — called only client-side from FlowchartEditor |
| No additional libraries | — | — | All operations are pure string/DOM manipulation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | ^1.x | Unit-test round-trip fidelity | Add to devDependencies for Wave 0 test setup |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| DOMParser | regex-based parsing | DOMParser handles nesting correctly; regex on deeply nested divs is error-prone |
| Vitest | Jest | Vitest is faster, native ESM, idiomatic for Vite/Next.js projects; no `babel-jest` config needed |
| flat FlowGraph model | tree/recursive model | Flat model (nodes array + edges array + branchGroups array) is simpler to diff, serialize, and pass to React state |

**Installation (Wave 0):**
```bash
cd gapstrike && npm install --save-dev vitest @vitest/ui jsdom
```

---

## Architecture Patterns

### Recommended File Structure
```
gapstrike/src/lib/
├── flowchart-types.ts       # FlowGraph, FlowNode, FlowEdge, BranchGroup interfaces
├── flowchart-styles.ts      # FLOWCHART_STYLES constants (box, stem, pill, branch corner styles)
├── parse-flow-html.ts       # parseFlowHTML(html: string): FlowGraph
└── rebuild-flow-html.ts     # rebuildHTML(graph: FlowGraph): string

gapstrike/src/components/
└── TableEditor.tsx          # One-line fix in parseTable()

gapstrike/tests/
└── flow-round-trip.test.ts  # Fixture test: parse → rebuild → parse equality
```

### Pattern 1: FlowGraph Flat Model

**What:** A flat data model that captures nodes, directed edges, and branch groups separately — no recursive tree.

**When to use:** When the serializer must reconstruct the exact HTML nesting order (which is implicit from branch group membership and edge ordering), and when React state updates need simple immutable spreads.

```typescript
// Source: derived from template-defaults.ts anki_flowchart HTML structure

export interface FlowNode {
  id: string;          // synthetic: "n0", "n1", ...
  label: string;       // raw text content, cloze preserved verbatim
}

export interface FlowEdge {
  fromId: string;
  toId: string;
  stepLabel: string;   // text of the step pill between these two nodes
}

export interface BranchGroup {
  parentId: string;    // node that fans out
  childIds: string[];  // ordered left-to-right
}

export interface FlowGraph {
  title: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  branchGroups: BranchGroup[];
}
```

**Key insight:** Branch groups are the only structural novelty over a simple linked list. The branching pattern in the template is: after a parent node, a `display:inline-flex` div wraps N children. Each child is a `text-align:center` div containing a corner-border div, then a padding wrapper, then (step pill → stem → box) repeated down the branch.

### Pattern 2: DOMParser-Based Parser

**What:** Use `new DOMParser().parseFromString(html, 'text/html')` on the client to get a real DOM, then walk it.

**Why over regex:** The HTML has 4–5 levels of nesting. Regex on interleaved `<div>` tags with inline styles is fragile. DOMParser gives `querySelectorAll` and `children` traversal.

```typescript
// Source: browser built-in DOMParser API

export function parseFlowHTML(html: string): FlowGraph {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const wrapper = doc.body.firstElementChild as HTMLElement;
  // wrapper is: <div style="text-align:center">

  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  const branchGroups: BranchGroup[] = [];

  let title = '';
  let nodeCounter = 0;

  // Walk children of wrapper top-level:
  //   div[font-weight:bold] → title
  //   div[border:2px solid] → box (node)
  //   div > div[width:2px]  → stem (skip structure, no data)
  //   div[display:inline-block;padding:2px] → step pill
  //   div[display:inline-flex] → branch group

  // ... see Code Examples section for implementation sketch
}
```

### Pattern 3: FLOWCHART_STYLES Constants

**What:** A single source-of-truth object mapping logical element roles to their exact inline style strings.

**Why:** The parser identifies elements by matching style strings; the serializer uses the same constants to emit them. One file prevents drift.

```typescript
// Source: template-defaults.ts anki_flowchart rules section

export const FLOWCHART_STYLES = {
  wrapper: 'text-align:center',
  title: 'font-size:14px;font-weight:bold;margin-bottom:10px;color:#e2e2e2',
  box: 'border:2px solid #3a3a3a;padding:8px 16px;display:inline-block;background:#1a1a1a;color:#e2e2e2;border-radius:4px',
  stem: 'width:2px;height:15px;background:#3a3a3a;margin:0 auto',
  stemShort: 'width:2px;height:12px;background:#3a3a3a;margin:0 auto',  // inside branches
  pill: 'display:inline-block;padding:2px 10px;font-size:10px;color:#777;font-style:italic;border:1px solid #2a2a2a;border-radius:8px;background:#111',
  branchWrapper: 'display:inline-flex',
  branchChildOuter: 'text-align:center',
  branchChildPadding: 'padding:0 16px',
  branchCornerLeft: 'height:15px;border-top:2px solid #3a3a3a;border-left:2px solid #3a3a3a;margin-left:50%',
  branchCornerRight: 'height:15px;border-top:2px solid #3a3a3a;border-right:2px solid #3a3a3a;margin-right:50%',
} as const;
```

### Pattern 4: rebuildHTML Serializer

**What:** Walk FlowGraph in topological order (BFS from the first node with no incoming edge), emit HTML strings segment by segment.

**Compact output requirement:** No `\n` between tags. AnkiDroid converts newlines to `<br>` on edit, corrupting structure (explicit rule 10 in the anki_flowchart template).

```typescript
// Source: template-defaults.ts anki_flowchart example outputs

export function rebuildHTML(graph: FlowGraph): string {
  // Build child map from edges
  // BFS/DFS walk emitting box → stem → pill → stem → box per linear edge
  // When reaching a node that is a branchGroup.parentId:
  //   emit <div style="display:inline-flex">
  //     for each child: corner + padding + (pill → stem → box)*
  //   </div>
  // All output is concatenated with no newlines
}
```

### Pattern 5: TableEditor Cloze Passthrough Fix

**What:** In `parseTable()`, line 47 strips all HTML tags from `<td>` contents using `m[1].replace(/<[^>]*>/g, "")`. Since `{{c1::text}}` is plain text (not an HTML tag), it is preserved by this regex — BUT any `<b>` formatting tags in cells ARE stripped, which is acceptable. The actual bug is that if a td contains `{{c1::text}}` it should survive round-trip through `parseTable` → edit in `<input>` → `rebuildTable`.

**Diagnosis:** The regex `/replace(/<[^>]*>/g, "")/` does NOT strip `{{c1::text}}` because `{{` is not `<`. So cloze text in a plain cell already survives.

The real scenario to verify: cells that contain cloze inside HTML markup, e.g. `<td>{{c1::Mesonephric duct}}</td>` — `m[1]` is `{{c1::Mesonephric duct}}`, the replace strips nothing because no `<..>` present. This actually works already for plain cloze.

The bug manifests when `<td>` contains mixed HTML + cloze, e.g. `<b>{{c1::term}}</b>` — here `m[1]` is `<b>{{c1::term}}</b>`, after strip becomes `{{c1::term}}` which is actually CORRECT behavior (cloze preserved, bold stripped). This is fine.

**Actual bug:** TABL-05 says "cloze syntax displayed raw in cells (not stripped)". Re-reading `parseTable` line 47:
```typescript
rows.push(tds.map((m) => m[1].replace(/<[^>]*>/g, "").trim()));
```
`m[1]` from `/<td[^>]*>([\s\S]*?)<\/td>/gi` captures inner HTML including all nested tags. Cloze `{{c1::text}}` is not angle-bracket syntax so it survives the regex. **The real problem is confirmed to NOT be in cloze stripping by the HTML tag regex** — it is an interaction with the input element rendering: when `value={cell}` in `<input>`, if `cell` contains `{{c1::text}}`, it displays literally in the input field (correct behavior). This is exactly what TABL-05 requires.

**Investigation finding (HIGH confidence):** The bug in `parseTable` is on header parsing (line 39):
```typescript
headers = thMatches.map((m) => m[1].replace(/<[^>]*>/g, "").trim());
```
If a `<th>` contains `{{c1::header}}` wrapped in `<b>`, the cloze survives. For plain `<th>{{c1::text}}</th>` it also survives.

After careful analysis: the `replace(/<[^>]*>/g, "")` pattern in `parseTable` preserves cloze because cloze delimiters are `{{` not `<`. **However**, there is a real risk when `innerHTML` of a td is something like `<span>{{c1::term::hint}}</span>` — the outer `<span>` tags are stripped by the regex, but the cloze content is preserved.

**Conclusion for plan:** The fix for TABL-05 is to use `m[1]` directly (the raw innerHTML) instead of `.replace(/<[^>]*>/g, "")` for cell values. This preserves both cloze AND any inline HTML like `<b>`. Headers and title can remain strip-based since they don't contain cloze per the template rules. This is the safest fix.

```typescript
// BEFORE (line 47):
rows.push(tds.map((m) => m[1].replace(/<[^>]*>/g, "").trim()));

// AFTER:
rows.push(tds.map((m) => m[1].trim()));
// Keep m[1] as raw innerHTML — cloze {{c1::...}} passes through verbatim
// rebuildTable already emits this directly into <td>...</td> with no escaping
```

### Anti-Patterns to Avoid

- **Regex HTML parsing for the flowchart parser:** The nested div structure in flowchart HTML cannot be reliably parsed with regex. Use DOMParser. (TableEditor uses regex because tables are flat — divs with 5 nesting levels are not.)
- **Normalizing style strings:** Do not trim or lowercase style attribute values during parsing — match them exactly against FLOWCHART_STYLES constants. A single extra space will break element identification.
- **Adding newlines in rebuildHTML output:** Explicitly forbidden by the template rules. AnkiDroid converts `\n` to `<br>` on edit. All `join()` calls must use `""` not `"\n"`.
- **Structured cloze objects:** No need. Store cloze as raw text strings. Phase 3 will display them raw in inputs. Phase 4 handles editing.
- **SSR-safe DOMParser polyfill:** `parseFlowHTML` will only ever be called client-side (inside FlowchartEditor's `useEffect`/`useState` initializer). Do not waste time on JSDOM polyfilling in production code. Use JSDOM only in Vitest tests.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML DOM traversal | custom tokenizer, regex HTML parser | DOMParser (browser built-in) | Handles encoding, nesting, malformed tags gracefully |
| Test runner | custom assertion scripts | Vitest | Already the standard for Next.js/ESM projects; zero config with `vitest.config.ts` |
| Style string matching | fuzzy substring matching | Exact match against FLOWCHART_STYLES constants | The template always emits exact strings; fuzzy matching introduces false positives |

**Key insight:** The flowchart HTML structure is fully machine-specified by the template. The parser is deterministic, not heuristic. The only real complexity is handling the recursive branch group nesting in `rebuildHTML`.

---

## Common Pitfalls

### Pitfall 1: Identifying Elements by Style Substring vs Full Match
**What goes wrong:** `element.style.display === 'inline-flex'` passes for both the branch wrapper AND any other inline-flex div that might appear in future AI variations.
**Why it happens:** AI may add an extra wrapper div or change padding; partial style checks are too permissive.
**How to avoid:** Match the full `style` attribute string against FLOWCHART_STYLES values. Accept minor whitespace normalization (trim and collapse spaces) but require all key properties to be present.
**Warning signs:** Parser produces wrong node count or puts nodes in wrong branch groups.

### Pitfall 2: Cloze Inside Nested HTML Tags in parseFlowHTML
**What goes wrong:** A box's inner HTML is `<b>{{c1::Thiamine deficiency}}</b>`. `textContent` gives `{{c1::Thiamine deficiency}}` (correct). `innerHTML` gives `<b>{{c1::Thiamine deficiency}}</b>`. For the FlowGraph `label` field, use `textContent` NOT `innerHTML` — the cloze is always in text nodes per the template rules.
**Why it happens:** The template specifies cloze inside raw box text, but the AI might wrap in `<b>` for emphasis.
**How to avoid:** Use `element.textContent` for box labels. Only use `innerHTML` if you intend to preserve inline HTML.
**Warning signs:** `rebuildHTML` output contains escaped HTML entities like `&lt;b&gt;` inside box divs.

### Pitfall 3: Branch Group Order in rebuildHTML
**What goes wrong:** Children in a `BranchGroup` are emitted right-to-left instead of left-to-right, swapping left and right corner borders.
**Why it happens:** The left child uses `margin-left:50%` + `border-left` (hooks at its right edge) and the right child uses `margin-right:50%` + `border-right` (hooks at its left edge). Swapping them produces visually correct corners but wrong content placement.
**How to avoid:** `branchGroups[i].childIds` must be stored in left-to-right display order as parsed from the DOM (first child in `inline-flex` = leftmost).
**Warning signs:** In the rendered Anki card, branch children appear swapped.

### Pitfall 4: Round-Trip Fidelity — Byte Identical vs Semantically Equivalent
**What goes wrong:** The round-trip test asserts `rebuildHTML(parseFlowHTML(html)) === html` but the AI may emit slightly different whitespace or style ordering (e.g., `background:#1a1a1a;color:#e2e2e2` vs `color:#e2e2e2;background:#1a1a1a`).
**Why it happens:** CSS property order in inline styles is not canonical.
**How to avoid:** Do NOT assert byte equality. Assert semantic equality: parse both the original and the rebuilt HTML, compare the resulting FlowGraph objects (title, node labels, edge labels, branch structure). Add a separate "renders identically" note as a manual check.
**Warning signs:** Test fails on style property order but the visual output is identical.

### Pitfall 5: DOMParser Not Available in Vitest (Node.js environment)
**What goes wrong:** `new DOMParser()` throws `ReferenceError: DOMParser is not defined` in Vitest running under Node.js.
**Why it happens:** DOMParser is a browser API, not available in Node.js natively.
**How to avoid:** Configure Vitest to use `jsdom` environment: set `environment: 'jsdom'` in `vitest.config.ts`. Install `jsdom` as a devDependency.
**Warning signs:** Test file fails immediately with `DOMParser is not defined`.

---

## Code Examples

### Identifying Element Types in the Parser

```typescript
// Source: template-defaults.ts anki_flowchart HTML structure analysis

function getElementRole(el: Element): 'title' | 'box' | 'stem' | 'pill' | 'branch' | 'stemWrap' | 'unknown' {
  const style = el.getAttribute('style') || '';
  // Normalize: collapse multiple spaces, trim
  const s = style.replace(/\s+/g, ' ').trim();

  if (s.includes('font-weight:bold') && s.includes('font-size:14px')) return 'title';
  if (s.includes('display:inline-block') && s.includes('border:2px solid #3a3a3a')) return 'box';
  if (s.includes('display:inline-flex')) return 'branch';
  if (s.includes('display:inline-block') && s.includes('font-size:10px')) return 'pill';
  // Stem wrap: <div> containing a single child with width:2px
  const child = el.children[0];
  if (el.children.length === 1 && child) {
    const cs = child.getAttribute('style') || '';
    if (cs.includes('width:2px') && cs.includes('background:#3a3a3a')) return 'stemWrap';
  }
  return 'unknown';
}
```

### Extracting Box Label (textContent, preserves cloze)

```typescript
// Source: template-defaults.ts — cloze placement rule: "Only inside box <div> text content"

function getBoxLabel(boxEl: Element): string {
  // textContent gives plain text with cloze syntax intact
  // e.g. "{{c1::Thiamine deficiency}}" from <div ...>{{c1::Thiamine deficiency}}</div>
  return (boxEl.textContent || '').trim();
}
```

### rebuildHTML Linear Segment (box → stem → pill → stem → box)

```typescript
// Source: template-defaults.ts anki_flowchart rule 5 and 6

function emitLinearSegment(pillLabel: string, boxLabel: string, stemHeight = '15px'): string {
  const stem = `<div><div style="width:2px;height:${stemHeight};background:#3a3a3a;margin:0 auto"></div></div>`;
  const pill = `<div style="display:inline-block;padding:2px 10px;font-size:10px;color:#777;font-style:italic;border:1px solid #2a2a2a;border-radius:8px;background:#111">${pillLabel}</div>`;
  const box = `<div style="border:2px solid #3a3a3a;padding:8px 16px;display:inline-block;background:#1a1a1a;color:#e2e2e2;border-radius:4px">${boxLabel}</div>`;
  return stem + pill + stem + box;
  // NOTE: no \n between elements — AnkiDroid corrupts newlines
}
```

### rebuildHTML Branch Group

```typescript
// Source: template-defaults.ts anki_flowchart rule 7 and Example 1

function emitBranchGroup(
  children: Array<{ edgeLabel: string; subchain: string }>,
  isLeft: (i: number, total: number) => boolean
): string {
  const childDivs = children.map((child, i) => {
    const total = children.length;
    const cornerStyle = isLeft(i, total)
      ? 'height:15px;border-top:2px solid #3a3a3a;border-left:2px solid #3a3a3a;margin-left:50%'
      : 'height:15px;border-top:2px solid #3a3a3a;border-right:2px solid #3a3a3a;margin-right:50%';
    return `<div style="text-align:center"><div style="${cornerStyle}"></div><div style="padding:0 16px">${child.subchain}</div></div>`;
  });
  return `<div style="display:inline-flex">${childDivs.join('')}</div>`;
  // isLeft: first child is left, last is right, middle children need both sides (3-sibling case uses border-top only with no margin)
}
```

### TableEditor parseTable() Cloze Fix

```typescript
// BEFORE — in gapstrike/src/components/TableEditor.tsx, line 47:
rows.push(tds.map((m) => m[1].replace(/<[^>]*>/g, "").trim()));

// AFTER — preserve innerHTML as-is (cloze is plain text, not HTML tags):
rows.push(tds.map((m) => m[1].trim()));

// WHY: {{c1::text::hint}} contains no angle brackets, so the original regex
// did not strip it — but this change also preserves any inline <b> formatting
// in cells, which is a bonus (more faithful round-trip for bold cells).
// rebuildTable already emits cell value directly: `<td ...>${cell}</td>`
// so raw innerHTML round-trips correctly.
```

### Vitest Config for jsdom

```typescript
// gapstrike/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
```

### Round-Trip Test Skeleton

```typescript
// gapstrike/tests/flow-round-trip.test.ts
import { describe, it, expect } from 'vitest';
import { parseFlowHTML } from '../src/lib/parse-flow-html';
import { rebuildHTML } from '../src/lib/rebuild-flow-html';

const FIXTURE_LINEAR = `<div style="text-align:center"><div style="font-size:14px;font-weight:bold;margin-bottom:10px;color:#e2e2e2">Wernicke Encephalopathy Mechanism</div><div style="border:2px solid #3a3a3a;padding:8px 16px;display:inline-block;background:#1a1a1a;color:#e2e2e2;border-radius:4px">Chronic alcohol use</div>...`;

describe('FlowGraph round-trip', () => {
  it('preserves node count and labels', () => {
    const graph = parseFlowHTML(FIXTURE_LINEAR);
    const rebuilt = rebuildHTML(graph);
    const graph2 = parseFlowHTML(rebuilt);
    expect(graph2.nodes.map(n => n.label)).toEqual(graph.nodes.map(n => n.label));
    expect(graph2.edges.map(e => e.stepLabel)).toEqual(graph.edges.map(e => e.stepLabel));
  });

  it('preserves cloze syntax verbatim', () => {
    const graph = parseFlowHTML(FIXTURE_LINEAR);
    const clozeNodes = graph.nodes.filter(n => n.label.includes('{{'));
    expect(clozeNodes.length).toBeGreaterThan(0);
    const rebuilt = rebuildHTML(graph);
    expect(rebuilt).toContain('{{c1::');
  });

  it('produces no newlines between tags', () => {
    const graph = parseFlowHTML(FIXTURE_LINEAR);
    const rebuilt = rebuildHTML(graph);
    expect(rebuilt).not.toMatch(/>\s*\n\s*</);
  });
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| FlowchartEditor parses Mermaid syntax | FlowchartEditor parses HTML with DOMParser | Phase 2 (this phase) | FlowchartEditor.tsx will be rebuilt from scratch in Phase 3; the Mermaid parser code is discarded |
| FlowGraph data in Mermaid string | FlowGraph TypeScript types in `src/lib/flowchart-types.ts` | Phase 2 | Typed, diffable, serializable model |

**Deprecated/outdated (after this phase):**
- `parseMermaid()` in FlowchartEditor.tsx: replaced by `parseFlowHTML`
- `rebuildMermaid()` in FlowchartEditor.tsx: replaced by `rebuildHTML`
- `MermaidNode`, `MermaidEdge`, `ParsedGraph` interfaces: replaced by `FlowNode`, `FlowEdge`, `FlowGraph`

---

## Open Questions

1. **3-sibling branch groups (center child corner)**
   - What we know: The template specifies left corner (`border-left`) and right corner (`border-right`). Example 1 has 2 children.
   - What's unclear: How should a 3-child branch be serialized? The template says max 3 siblings from any parent. The center child would need `border-top` only with no `margin-left/right:50%`.
   - Recommendation: Check if any generated fixture has 3 siblings. If not, implement 2-child only and add a TODO comment. The rebuildHTML planner task should explicitly address this.

2. **Nested branch groups (branch within a branch)**
   - What we know: Example 2 shows an "early branching" case where both branches from the root are siblings (2 children of root), each with their own linear chain.
   - What's unclear: Can a branch child itself be a branch group parent? The template says max 3 siblings, but nesting depth is unspecified.
   - Recommendation: Support depth-1 branches (branch inside linear chain). Flag depth-2 (branch inside a branch child) as a stretch goal; the AI rarely generates this structure.

---

## Validation Architecture

`nyquist_validation` is enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^1.x (not yet installed) |
| Config file | `gapstrike/vitest.config.ts` — Wave 0 gap |
| Quick run command | `cd gapstrike && npx vitest run tests/flow-round-trip.test.ts` |
| Full suite command | `cd gapstrike && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FLOW-09 | `parseFlowHTML(fixture)` returns valid FlowGraph with nodes, edges, branchGroups, title | unit | `npx vitest run tests/flow-round-trip.test.ts` | Wave 0 |
| FLOW-09 | `rebuildHTML(graph)` produces compact HTML (no `<style>` blocks, no newlines between tags) | unit | `npx vitest run tests/flow-round-trip.test.ts` | Wave 0 |
| FLOW-09 | Round-trip: `parseFlowHTML(rebuildHTML(parseFlowHTML(html)))` equals first parse | unit | `npx vitest run tests/flow-round-trip.test.ts` | Wave 0 |
| FLOW-09 | Cloze `{{cN::text::hint}}` survives parse and rebuild verbatim | unit | `npx vitest run tests/flow-round-trip.test.ts` | Wave 0 |
| TABL-05 | `parseTable()` returns cell value with `{{c1::text}}` intact | unit | `npx vitest run tests/table-cloze.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd gapstrike && npx vitest run tests/flow-round-trip.test.ts`
- **Per wave merge:** `cd gapstrike && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `gapstrike/vitest.config.ts` — Vitest config with `environment: 'jsdom'`
- [ ] `gapstrike/tests/flow-round-trip.test.ts` — covers FLOW-09 (all 4 success criteria)
- [ ] `gapstrike/tests/table-cloze.test.ts` — covers TABL-05
- [ ] Framework install: `cd gapstrike && npm install --save-dev vitest @vitest/ui jsdom`

---

## Sources

### Primary (HIGH confidence)
- `gapstrike/src/lib/template-defaults.ts` — exact HTML structure of anki_flowchart output (boxes, stems, step pills, branch corners, branching wrapper); directly read in full
- `gapstrike/src/components/TableEditor.tsx` — existing parse/rebuild pattern; cloze bug location confirmed at line 47
- `gapstrike/src/components/FlowchartEditor.tsx` — existing Mermaid-based implementation; pattern to replace (flat node/edge model confirmed as the right structure)

### Secondary (MEDIUM confidence)
- MDN Web Docs: DOMParser API — browser-native, available in all modern browsers; not in Node.js without polyfill
- Vitest documentation — `environment: 'jsdom'` for browser API access in tests

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed present in package.json or browser built-in
- Architecture: HIGH — HTML structure fully specified in template-defaults.ts; all patterns derived from direct code inspection
- Pitfalls: HIGH — derived from code reading and known Anki/AnkiDroid constraints documented in template rules
- Cloze passthrough fix: HIGH — TableEditor.tsx read in full; bug mechanism confirmed by reading line 47 and surrounding context

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable domain — template HTML structure is stable; only changes if anki_flowchart template is edited)
