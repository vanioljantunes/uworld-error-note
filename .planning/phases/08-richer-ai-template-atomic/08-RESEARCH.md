# Phase 8: Richer AI Template (Atomic) - Research

**Researched:** 2026-03-10
**Domain:** GPT-4o prompt engineering, Anki flowchart template, HTML parser/serializer, hash-based auto-upgrade
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Flowchart depth strategy**
- Flowchart depth driven by the educational objective and wrong-answer alternatives from the extraction
- Educational objective defines the main chain (the "correct reasoning path")
- Default to correct-path-only flowcharts (no wrong-alternative contrast boxes)
- 5-7 nodes minimum, with intermediate pathophysiology steps and anatomical branching as needed
- The extraction already contains educational objective and wrong alternatives — the prompt just needs to instruct GPT-4o to use them

**Cloze targeting**
- Cloze the distinguishing step — the specific fact that separates the correct answer from the most tempting wrong alternative
- Use category hints (e.g., `{{c1::Thiamine::vitamin}}`), not wrong-alternative hints
- Triggers (first box) and leaf outcomes (last boxes) rarely get cloze — only if the trigger/outcome itself IS the distinguishing fact
- Arrow labels (step pills) are never clozed
- Merge educational-objective analysis into the existing Phase 1 thinking instructions (not a separate phase)

**Arrow label vocabulary**
- Expand from current 5 verbs to a curated reference list covering 3 domains:
  - Pharmacology: binds to, blocks, agonizes, antagonizes, upregulates, downregulates, sensitizes, potentiates, inhibits
  - Pathophysiology: damages, inflames, disrupts, occludes, compresses, infiltrates, necroses, fibroses, depletes, activates
  - Anatomy/Clinical: innervates, drains to, supplies, crosses, presents as, metastasizes to, refers to
- Keep rule: "NEVER use generic 'leads to', 'causes', 'then'"

**Template examples**
- Replace both existing examples (Wernicke + Kidney embryology)
- New Example 1: Pathophysiology mechanism (e.g., heart failure, DKA)
- New Example 2: Pharmacology mechanism (e.g., ACE inhibitor cascade, warfarin pathway)
- Both examples must demonstrate branching (most USMLE mechanisms branch)
- Examples must include educational objective reasoning — show GPT-4o how to analyze the objective and wrong alternatives before building the flowchart (as part of Phase 1 thinking comments)

### Claude's Discretion
- Specific pathophysiology and pharmacology topics for the 2 new examples
- Exact wording of expanded Phase 1 analysis instructions
- Parser/serializer changes needed (if any) for the new HTML patterns
- Which current template hash to add to TEMPLATE_PREV_HASHES

### Deferred Ideas (OUT OF SCOPE)
- Wrong-alternative toggle button: UI button to switch between including/excluding wrong-answer contrast boxes. Belongs in its own phase after Phase 8 template lands.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TMPL-07 | Flowchart template generates richer structures (5-7 nodes with labeled causal arrows), atomically updated with parser/serializer/hash | Full coverage: template rewrite strategy documented, parser compatibility verified, hash computation done, atomic commit protocol established |
</phase_requirements>

---

## Summary

Phase 8 is a focused prompt-engineering and bookkeeping task. There are no new UI surfaces, no new API routes, and no structural changes to the HTML schema that the parser and serializer consume. The entire phase consists of: (1) rewriting the `anki_flowchart` template string in `template-defaults.ts` with richer Phase 1 analysis instructions, an expanded arrow-label vocabulary, and two new example cards, (2) appending the current template's hash (`c9d31786fcdb0678`) to `TEMPLATE_PREV_HASHES["anki_flowchart"]`, and (3) adding `parseFlowHTML` tests that exercise the new 5-7 node structures.

The HTML structure produced by the new template is deliberately identical to the existing structure — same box/pill/stem/branch pattern, same inline style strings. The parser (`parse-flow-html.ts`) uses style-substring matching, not node-count assumptions, so it will parse 5-7 node outputs exactly the same as 3-4 node outputs. The serializer (`rebuild-flow-html.ts`) likewise has no node-count coupling. No changes to those files are needed unless the template author introduces a new structural element (they must not).

The biggest risk is GPT-4o prompt drift — the model may ignore the 5-7 node constraint, revert to generic pill labels, or misplace cloze on triggers/leaves. The mitigation is concrete in-prompt examples with Phase 1 educational-objective analysis commentary embedded as HTML comments, plus explicit rule numbering in the Rules section that matches the new constraints.

**Primary recommendation:** Write the new template first, validate it manually with a real extraction, then write the tests against the HTML that actually came out. Add the old hash and commit everything in a single atomic commit.

---

## Standard Stack

### Core (no new dependencies)
| File | Purpose | What Changes |
|------|---------|-------------|
| `gapstrike/src/lib/template-defaults.ts` | Holds `TEMPLATE_DEFAULTS` and `TEMPLATE_PREV_HASHES` | `anki_flowchart` content rewritten; old hash appended to prev-hashes array |
| `gapstrike/src/lib/parse-flow-html.ts` | Parses AI HTML to `FlowGraph` | No changes needed — style-based detection is node-count agnostic |
| `gapstrike/src/lib/rebuild-flow-html.ts` | Serializes `FlowGraph` to HTML | No changes needed — graph traversal is node-count agnostic |
| `gapstrike/tests/flow-round-trip.test.ts` | Round-trip parse/rebuild tests | Add 3 new richer-structure fixtures (5+ node linear, 5+ node branched, DKA/pharma example) |

### Supporting (already in repo)
| Library | Version | Purpose |
|---------|---------|---------|
| vitest | ^4.0.18 | Test runner — `jsdom` environment already configured |
| jsdom | ^28.1.0 | DOMParser shim for `parseFlowHTML` in tests |
| crypto (Node built-in) | — | Hash computation for TEMPLATE_PREV_HASHES |

### No Alternatives — Everything Reuses Existing Infrastructure

The template auto-upgrade mechanism (`api/templates/route.ts`) is already fully implemented. The `contentHash()` helper already uses `sha256` truncated to 16 hex chars. No new logic is needed in that file.

---

## Architecture Patterns

### Recommended Change Locations
```
gapstrike/src/lib/
├── template-defaults.ts   # PRIMARY EDIT: template content + TEMPLATE_PREV_HASHES
└── (no other lib changes)

gapstrike/tests/
└── flow-round-trip.test.ts  # ADD: 3 richer-structure fixtures + parse assertions
```

### Pattern 1: Template Section Structure (existing, preserved)

The `anki_flowchart` template has four sections in comment markers:

```
<!-- section: System Prompt -->   ← role + color palette + layout rules
<!-- section: Instructions -->    ← Two-Phase task (Phase 1: analyze, Phase 2: generate)
<!-- section: Card Structure -->  ← Example card(s) with front/back JSON
<!-- section: Rules -->           ← Numbered hard constraints
```

All four sections must be updated in the rewrite. The section markers themselves are not parsed — they are human navigation aids only.

### Pattern 2: Phase 1 Analysis Expansion

Current Phase 1 asks GPT-4o five questions. The new version adds two questions after the existing ones:

```
6. What is the EDUCATIONAL OBJECTIVE of this question?
   Which fact must the student distinguish to get this right?
7. What are the WRONG ALTERNATIVES?
   Where do the wrong alternatives diverge from the correct path?
   The divergence point = the distinguishing step = where cloze should land.
```

These are thinking-only instructions (do NOT include in output). They stay inside the existing `### Phase 1: Analyze` block — no new phase headings.

### Pattern 3: TEMPLATE_PREV_HASHES Update Protocol

The hash is computed at runtime by `contentHash()` in `api/templates/route.ts`:

```typescript
function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}
```

The current `anki_flowchart` template content hashes to `c9d31786fcdb0678`. This hash must be appended to the array **before** the template content is changed:

```typescript
export const TEMPLATE_PREV_HASHES: Record<string, string[]> = {
  anki_flowchart: [
    "d2343b1e21aa9df1", "a5f7aade1b01b248", "195d2fc7a40117fd",
    "6c7928647efcdecb", "ab29f95e3c05a983", "607faa7057d4a280",
    "c9d31786fcdb0678"   // ← add this (current template before Phase 8 rewrite)
  ],
  anki_table: ["a3b9de9e219c4927"],
};
```

The auto-upgrade logic in `api/templates/route.ts` (lines 112-138) compares the user's stored hash against `TEMPLATE_PREV_HASHES`. If the user's hash matches any entry, the template is silently overwritten with the new default. This means any user who never edited the flowchart template will get the richer version on their next page load.

### Pattern 4: HTML Structure Compatibility (critical — do not break)

The parser detects element roles by substring matching on `style` attributes:

| Role | Detection Logic |
|------|----------------|
| `title` | `font-weight:bold` AND `font-size:14px` |
| `branch` | `display:inline-flex` (checked before box) |
| `box` | `display:inline-block` AND `border:2px solid #3a3a3a` |
| `pill` | `display:inline-block` AND `font-size:10px` |
| `stemWrap` | single child with `width:2px` AND `background:#3a3a3a` |

The new template MUST NOT introduce any new element types or modify these style strings. The 5-7 node constraint is achieved simply by adding more boxes and pills in the same existing structure — no parser changes required.

**Verified:** The parser has no node-count assumptions anywhere in `parse-flow-html.ts`. The `walkChildren` function iterates all elements and handles boxes generically.

### Pattern 5: Example Card Design

Both examples should follow this narrative structure:

```
Phase 1 comments (educational objective analysis embedded as HTML comment in the prompt text)
→ Title (plain text, no cloze)
→ Trigger box (no cloze — unless trigger IS the distinguishing fact)
→ 2-4 intermediate mechanism boxes (cloze the distinguishing step here)
→ Branch connector (for anatomical/outcome branching)
→ Leaf outcome boxes (no cloze — unless outcome IS the distinguishing fact)
```

**Example 1 recommendation: DKA mechanism** (pathophysiology)
- Trigger: Insulin deficiency (type 1 DM or precipitant)
- Chain: depletes → activates → produces → accumulates → causes
- Branch: metabolic acidosis effects (Kussmaul breathing / fruity breath / anion gap)
- Cloze: the key enzymatic step (e.g., `{{c1::hormone-sensitive lipase::enzyme}}`) and the compensatory response
- Educational objective commentary: "DKA vs HHS — the distinguishing step is ketone production via lipolysis activation"

**Example 2 recommendation: ACE inhibitor mechanism** (pharmacology)
- Trigger: ACE inhibitor (e.g., lisinopril)
- Chain: blocks → prevents conversion of → decreases → causes
- Branch: therapeutic effects (decreased afterload / decreased aldosterone / increased bradykinin)
- Cloze: the blocked enzyme step and the bradykinin accumulation (explains cough side effect)
- Educational objective commentary: "ACE inhibitor vs ARB — the distinguishing step is bradykinin accumulation (ARBs don't block ACE)"

### Anti-Patterns to Avoid

- **Structural deviation:** Do not add any new div patterns (e.g., colored boxes, icons, sub-labels). The parser will silently classify them as `unknown` and skip them, losing data.
- **Style string variation:** Do not change `border:2px solid #3a3a3a` to `border: 2px solid #3a3a3a` (space after colon). The parser does `style.includes('border:2px solid #3a3a3a')` — whitespace matters.
- **Cloze in pill labels:** Arrow labels must never contain `{{cN::...}}`. The parser extracts pill text via `textContent`, but the serializer would emit it back into a pill `<div>`, which is not a box — Anki would render the raw cloze syntax as text in the connector.
- **Wrong-alternative contrast boxes:** Out of scope per CONTEXT.md. Do not add a second branch showing the "wrong path" — the template should only show the correct mechanism path.
- **Splitting Phase 1 into a separate phase:** Merge educational-objective analysis into the existing Phase 1 block. Do not add a Phase 0 or restructure the two-phase task format.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Hash computation | Custom hash function | Node `crypto` built-in (already in `api/templates/route.ts`) | Already implemented and tested |
| Template versioning | New version field in DB | `TEMPLATE_PREV_HASHES` array (already implemented) | Auto-upgrade logic already handles this; adding a DB column is a schema migration risk |
| Parser for richer HTML | Parser modifications | Existing `parseFlowHTML` unchanged | Parser is style-based, not structure-based; richer node count works without changes |
| New pill vocabulary enforcement | Runtime validation | Prompt rules alone (GPT-4o instruction) | Enforcement at generation time; no need to validate saved HTML |

**Key insight:** The existing infrastructure already handles everything. The only real work is prompt text and one hash string.

---

## Common Pitfalls

### Pitfall 1: Forgetting to Capture the Current Hash Before Editing
**What goes wrong:** Developer edits the template content, then tries to compute the hash of the new content. The old hash is lost. Users with the current template (hash `c9d31786fcdb0678`) will not auto-upgrade because their hash is not in `TEMPLATE_PREV_HASHES`.
**Why it happens:** The hash is derived from the content itself — once content changes, you can't recover the old hash without reverting.
**How to avoid:** Add `"c9d31786fcdb0678"` to `TEMPLATE_PREV_HASHES["anki_flowchart"]` in the same edit as (or before) changing the template content. The atomic commit requirement in the roadmap enforces this.
**Warning signs:** `TEMPLATE_PREV_HASHES` has 6 entries when Phase 8 ships; it should have 7.

### Pitfall 2: GPT-4o Ignoring the 5-7 Node Constraint
**What goes wrong:** Model generates 3-4 node chains despite instructions.
**Why it happens:** The existing system prompt has `4-7 boxes` in rules. Changing the lower bound to 5 in rules alone may not be enough without examples that demonstrate the richer depth.
**How to avoid:** The new examples (DKA, ACE inhibitor) must themselves have 5-7 nodes. Examples are the highest-weight signal for GPT-4o output format.
**Warning signs:** Generated flowchart has 3 boxes; cloze is on the trigger box.

### Pitfall 3: Style Strings Silently Diverging
**What goes wrong:** The new example HTML in the template uses slightly different style strings than `FLOWCHART_STYLES` constants (e.g., different padding values, colors slightly off). The parser works because style-detection is substring-based, but the round-trip test fails because `rebuildHTML` emits styles from `FLOWCHART_STYLES` and the re-parsed graph does not match.
**Why it happens:** Hand-writing example HTML is error-prone.
**How to avoid:** Build the example cards programmatically using `rebuildHTML` from a known `FlowGraph`, or validate new example HTML against the parser + serializer round-trip test before embedding in the template string.

### Pitfall 4: Cloze Hint Format Confusion
**What goes wrong:** Template instructs `{{c1::Thiamine::vitamin}}` (category hints) but also mentions hints "sparingly for ambiguous terms". GPT-4o may apply hints everywhere or nowhere.
**Why it happens:** Ambiguous instruction.
**How to avoid:** Rule should say: "Use category hints (e.g., `{{c1::Thiamine::vitamin}}`) on the clozed distinguishing step only. Do not use wrong-alternative text as hints."

### Pitfall 5: Non-Atomic Partial Deploy
**What goes wrong:** `TEMPLATE_PREV_HASHES` updated in one commit, template content updated in another. Between commits, the auto-upgrade logic produces an incorrect result (old hash in prev-hashes but new content not yet deployed — no-op; or new content deployed but old hash not yet in prev-hashes — users with old template don't upgrade).
**Why it happens:** Developer forgets the atomic-commit requirement.
**How to avoid:** Both changes MUST be in a single git commit. The plan should have a single task that touches `template-defaults.ts` with both the new content and the new hash entry.

---

## Code Examples

### Hash Verification (run before committing)
```typescript
// Verify current hash matches expected before adding to TEMPLATE_PREV_HASHES
import { createHash } from 'crypto';
const hash = createHash('sha256').update(content).digest('hex').slice(0, 16);
// Must equal: "c9d31786fcdb0678"
```

### Updated TEMPLATE_PREV_HASHES (exact change)
```typescript
export const TEMPLATE_PREV_HASHES: Record<string, string[]> = {
  anki_flowchart: [
    "d2343b1e21aa9df1",
    "a5f7aade1b01b248",
    "195d2fc7a40117fd",
    "6c7928647efcdecb",
    "ab29f95e3c05a983",
    "607faa7057d4a280",
    "c9d31786fcdb0678",  // Phase 8: hash of template before richer-template rewrite
  ],
  anki_table: ["a3b9de9e219c4927"],
};
```

### New Phase 1 Analysis Block (additions to merge into existing)
```
### Phase 1: Analyze (think step by step, but do NOT include this in the output)
1. What is the core mechanism or pathway in this content?
2. What is the TRIGGER (starting point)?
3. Where does the pathway BRANCH (one cause → multiple structures/outcomes)?
4. What ANATOMICAL STRUCTURES or KEY STEPS map to which clinical findings?
5. Which 2-3 boxes should be clozed? Pick the ones that:
   - Are the clinically testable facts (anatomy, key mechanisms)
   - Would cause a wrong answer if forgotten
   - Distinguish this condition from look-alikes
6. What is the EDUCATIONAL OBJECTIVE? What specific fact separates the correct answer
   from the most tempting wrong alternative? This is the DISTINGUISHING STEP.
7. What are the WRONG ALTERNATIVES in the question? At which node in the mechanism
   do students diverge to pick the wrong answer? That divergence node is the
   strongest cloze candidate.
```

### New Rules (additions to Rules section)
```
// Add to existing numbered rules:
15. The diagram MUST contain 5-7 boxes. Three-box diagrams are too shallow
    for USMLE step-level mechanisms. Add intermediate pathophysiology or
    anatomical branching steps to reach the minimum.
16. Cloze the DISTINGUISHING STEP identified in Phase 1 analysis. If forgetting
    this step would cause a student to pick the most tempting wrong alternative,
    it must be clozed. Triggers and leaf outcomes are never clozed unless the
    trigger/outcome itself IS the distinguishing fact.
17. Use category hints for clozed terms: {{c1::Thiamine::vitamin}}.
    NEVER use wrong-alternative text as a hint.
18. Arrow labels MUST come from the domain vocabulary:
    Pharmacology: binds to | blocks | agonizes | antagonizes | upregulates |
      downregulates | sensitizes | potentiates | inhibits
    Pathophysiology: damages | inflames | disrupts | occludes | compresses |
      infiltrates | necroses | fibroses | depletes | activates
    Anatomy/Clinical: innervates | drains to | supplies | crosses | presents as |
      metastasizes to | refers to
    NEVER use: leads to | causes | then | results in | produces
```

### New Test Fixture Pattern (for flow-round-trip.test.ts additions)
```typescript
// FIXTURE_RICHER_LINEAR: 5-box linear chain (DKA-style)
// Tests that parseFlowHTML handles 5+ node chains without fallback
const FIXTURE_RICHER_LINEAR = '<div style="text-align:center">...' // 5 boxes

describe('parseFlowHTML — richer 5+ node structures (TMPL-07)', () => {
  it('parses a 5-box linear chain without losing any nodes', () => {
    const graph = parseFlowHTML(FIXTURE_RICHER_LINEAR);
    expect(graph.nodes).toHaveLength(5);
  });

  it('parses a 6-box branching chain (pharma example) without parse failure', () => {
    const graph = parseFlowHTML(FIXTURE_RICHER_BRANCHING);
    expect(graph.nodes.length).toBeGreaterThanOrEqual(5);
    expect(graph.branchGroups.length).toBeGreaterThanOrEqual(1);
  });

  it('category-hint cloze syntax {{c1::term::category}} survives parse + rebuild', () => {
    const graph = parseFlowHTML(FIXTURE_WITH_CATEGORY_HINT);
    const node = graph.nodes.find(n => n.label.includes('::vitamin}}'));
    expect(node).toBeDefined();
    const rebuilt = rebuildHTML(graph);
    expect(rebuilt).toContain('{{c1::Thiamine::vitamin}}');
  });
});
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| 5 arrow label verbs (inhibits, activates, converts, depletes, damages) | 22 domain-specific verbs across 3 categories | More precise mechanism relationships |
| 4-7 node upper bound (in practice 3-4 generated) | 5-7 node lower bound enforced by examples | Richer intermediate steps |
| Generic cloze targeting (clinically testable facts) | Educational-objective-driven cloze targeting (distinguishing step from wrong alternatives) | Cloze placement aligns with exam error pattern |
| Wernicke + embryology examples | DKA + ACE inhibitor examples (branching required) | Both examples show branching — the norm for USMLE mechanisms |

---

## Open Questions

1. **GPT-4o compliance rate with 5-7 node constraint**
   - What we know: Current prompt targets 4-7 and commonly produces 3-4 nodes
   - What's unclear: Whether example-driven instructions will reliably push output to 5+
   - Recommendation: Validate the new template with 3-5 real extractions before committing. Reserve one iteration cycle in the plan for a rule wording tweak if compliance is low.

2. **Category hint frequency**
   - What we know: Current rule says "use hints sparingly for ambiguous terms"
   - What's unclear: Whether "category hints on distinguishing step only" is clear enough for GPT-4o to follow consistently
   - Recommendation: The rule wording should include a concrete example of what a category hint looks like vs. a wrong-alternative hint (which is forbidden).

3. **Three-arm branching compatibility**
   - What we know: `rebuildHTML` has a middle-child corner style (`border-top:2px solid #3a3a3a` only, no left/right) for 3-child branches
   - What's unclear: Whether the new template's examples should show 3-arm branching or stick to 2-arm
   - Recommendation: Examples should use 2-arm branching only. Three-arm is a stretch case and the parser's middle-child handling has never been tested with real AI output.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `gapstrike/vitest.config.ts` |
| Quick run command | `cd gapstrike && npx vitest run tests/flow-round-trip.test.ts` |
| Full suite command | `cd gapstrike && npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TMPL-07 | parseFlowHTML correctly parses 5-7 node linear structure | unit | `npx vitest run tests/flow-round-trip.test.ts` | Wave 0 (new fixtures in existing file) |
| TMPL-07 | parseFlowHTML correctly parses 5-7 node branching structure | unit | `npx vitest run tests/flow-round-trip.test.ts` | Wave 0 (new fixtures in existing file) |
| TMPL-07 | Category-hint cloze `{{c1::term::category}}` survives round-trip | unit | `npx vitest run tests/flow-round-trip.test.ts` | Wave 0 (new fixture) |
| TMPL-07 | TEMPLATE_PREV_HASHES contains old hash `c9d31786fcdb0678` | unit | `npx vitest run tests/template-hash.test.ts` | Wave 0 gap |
| TMPL-07 | Generated card has 5-7 boxes (correct path flowchart) | manual | n/a — requires live GPT-4o call | manual-only |
| TMPL-07 | Cloze appears on mechanism step, not trigger or leaf | manual | n/a — requires live GPT-4o call | manual-only |

### Sampling Rate
- **Per task commit:** `cd gapstrike && npx vitest run tests/flow-round-trip.test.ts`
- **Per wave merge:** `cd gapstrike && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] New fixtures in `gapstrike/tests/flow-round-trip.test.ts` — 5-node linear, 6-node branching, category-hint cloze — covers TMPL-07 parse verification
- [ ] `gapstrike/tests/template-hash.test.ts` — verifies `TEMPLATE_PREV_HASHES["anki_flowchart"]` includes `"c9d31786fcdb0678"` and that the new template content produces a different hash — covers TMPL-07 hash bookkeeping

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `gapstrike/src/lib/template-defaults.ts` — full template content, TEMPLATE_PREV_HASHES structure verified
- Direct code inspection: `gapstrike/src/lib/parse-flow-html.ts` — style-based role detection logic verified (no node-count coupling)
- Direct code inspection: `gapstrike/src/lib/rebuild-flow-html.ts` — graph traversal logic verified (no node-count coupling)
- Direct code inspection: `gapstrike/src/app/api/templates/route.ts` — auto-upgrade mechanism (lines 112-138) verified
- Live hash computation: `node --input-type=module` against actual template-defaults.ts — current hash confirmed as `c9d31786fcdb0678`
- Direct code inspection: `gapstrike/vitest.config.ts` + `gapstrike/tests/` — test infrastructure fully operational (87 tests pass)

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions — user-locked constraints on depth strategy, cloze targeting, arrow vocab, examples
- STATE.md — concern flagged: "GPT-4o output patterns for richer prompt are not predictable until prompt is written and tested — reserve capacity for 1-2 iteration cycles"

### Tertiary (LOW confidence)
- N/A — all key findings verified against source code directly

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all files inspected directly, no external dependencies added
- Architecture: HIGH — parser and serializer logic verified by reading source; no structural changes needed
- Pitfalls: HIGH — hash trap confirmed by reading auto-upgrade logic; style-string trap confirmed by reading parser detection logic
- Test infrastructure: HIGH — vitest 4.0.18 with jsdom already configured; 87 existing tests pass

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable codebase — no third-party changes affect this)
