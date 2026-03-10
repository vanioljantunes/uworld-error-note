---
phase: 08-richer-ai-template-atomic
plan: 01
subsystem: gapstrike/ai-template
tags: [template, tdd, flowchart, anki, hash-upgrade]
dependency_graph:
  requires: []
  provides: [richer-anki-flowchart-template, TMPL-07-tests]
  affects: [gapstrike/src/app/api/templates/route.ts]
tech_stack:
  added: []
  patterns: [tdd-red-green, category-hint-cloze, domain-vocabulary-arrows]
key_files:
  created:
    - gapstrike/tests/template-hash.test.ts
  modified:
    - gapstrike/src/lib/template-defaults.ts
    - gapstrike/tests/flow-round-trip.test.ts
decisions:
  - "DKA + ACE inhibitor examples replace Wernicke + kidney embryology — pathophysiology/pharmacology coverage for domain vocabulary demonstration"
  - "arrow vocabulary organized into 3 named domains (pharmacology, pathophysiology, anatomy/clinical) for GPT-4o prompt clarity"
  - "TDD RED commit captures failing hash test before template change, then GREEN commit in same plan for atomicity"
metrics:
  duration: "5 minutes"
  completed_date: "2026-03-10"
  tasks_completed: 2
  files_changed: 3
---

# Phase 8 Plan 01: Richer AI Template (Atomic) Summary

**One-liner:** Rewrote anki_flowchart template with 5-7 node enforcement, 23-verb domain vocabulary, educational-objective-driven Phase 1 analysis, and DKA/ACE inhibitor branching examples; added TEMPLATE_PREV_HASHES auto-upgrade entry and richer-structure parse test fixtures.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Add richer-structure test fixtures and hash bookkeeping test | 7e324f5 | flow-round-trip.test.ts, template-hash.test.ts |
| 2 | Atomic rewrite of anki_flowchart template + TEMPLATE_PREV_HASHES update | 3e14301 | template-defaults.ts |

## What Was Built

### TEMPLATE_PREV_HASHES Update
- Added `c9d31786fcdb0678` as the 7th entry in the `anki_flowchart` array
- This ensures users who never customized the old template auto-upgrade to the new one via the route.ts hash check logic

### Template Rewrite (template-defaults.ts)
**System Prompt changes:**
- Replaced vague "specific mechanisms" instruction with explicit 23-verb domain vocabulary across 3 named domains: Pharmacology (binds to, blocks, agonizes, antagonizes, upregulates, downregulates, sensitizes, potentiates, inhibits), Pathophysiology (damages, inflames, disrupts, occludes, compresses, infiltrates, necroses, fibroses, depletes, activates, produces), Anatomy/Clinical (innervates, drains to, supplies, crosses, presents as, metastasizes to, refers to)
- Kept "NEVER use generic leads to/causes/then" rule

**Instructions section (Phase 1 analysis) changes:**
- Added question 6: EDUCATIONAL OBJECTIVE — what fact separates correct from most tempting wrong alternative (the DISTINGUISHING STEP)
- Added question 7: WRONG ALTERNATIVES — at which node do students diverge? That divergence node is the strongest cloze candidate

**Card Structure section:**
- Replaced Wernicke Encephalopathy example with DKA Mechanism (7-box pathophysiology with branching into Kussmaul breathing and Bicarbonate buffer)
- Replaced Kidney embryology example with ACE Inhibitor Mechanism (6-box pharmacology with branching into Aldosterone secretion and Bradykinin)
- Both examples include Phase 1 thinking commentary explaining educational objective and wrong alternative reasoning

**Rules section changes:**
- Rule 3: Raised minimum from "4-7" to "MUST contain 5-7 boxes"
- Rule 8 (new): Cloze the DISTINGUISHING STEP — if forgetting it would cause a student to pick the wrong alternative, it must be clozed
- Rule 9 (new): Use category hints for clozed terms (e.g., `{{c1::Thiamine::vitamin}}`). NEVER use wrong-alternative text as a hint
- Rule 14 (new): Arrow labels MUST come from the domain vocabulary. NEVER use: leads to, causes, then

### New Test Fixtures (flow-round-trip.test.ts)
- `FIXTURE_RICHER_LINEAR`: 5-box DKA chain with category-hint cloze `{{c1::Hormone-sensitive lipase::enzyme}}`
- `FIXTURE_RICHER_BRANCHING`: 6-box ACE inhibitor with 3-node linear chain then 2-arm branch, includes `{{c1::Angiotensin-converting enzyme::target}}` and `{{c2::Bradykinin::mediator}}`
- 4 new tests in `describe('parseFlowHTML — richer 5+ node structures (TMPL-07)')`:
  - 5-box linear chain: 5 nodes, 4 edges, 0 branchGroups
  - 6-box branching: >= 5 nodes, >= 1 branchGroup
  - Category-hint cloze survives parse
  - Category-hint cloze survives parse + rebuild round-trip

### New Test File (template-hash.test.ts)
- 2 tests confirming TEMPLATE_PREV_HASHES bookkeeping (TMPL-07):
  - `anki_flowchart` prev hashes include `c9d31786fcdb0678`
  - Current template content hash differs from all prev hashes (proves template actually changed)

## Verification Results

All 93 tests pass across 9 test files:
- `tests/template-hash.test.ts` — 2/2 pass (GREEN after Task 2)
- `tests/flow-round-trip.test.ts` — 17/17 pass (includes 4 new richer-structure tests)
- `tests/flow-editor-mutations.test.ts` — 35/35 pass (no regressions)
- `tests/flow-table-intg.test.ts` — 17/17 pass
- All other test files pass with 0 regressions

## Deviations from Plan

None — plan executed exactly as written. The TDD RED phase (Task 1) and GREEN phase (Task 2) proceeded as planned. The second hash test ("current hash differs from all prev hashes") passed in RED state because the current template content hash was already not in the prev hashes array, which is correct behavior — after Task 2 adds the old hash and changes template content, both tests pass in GREEN.

## Self-Check: PASSED

- `gapstrike/tests/template-hash.test.ts` exists: FOUND
- `gapstrike/tests/flow-round-trip.test.ts` has FIXTURE_RICHER_LINEAR and FIXTURE_RICHER_BRANCHING: FOUND
- `gapstrike/src/lib/template-defaults.ts` has 7 entries in anki_flowchart TEMPLATE_PREV_HASHES: CONFIRMED
- Commit 7e324f5 (RED test): FOUND
- Commit 3e14301 (template rewrite): FOUND
- All 93 vitest tests pass: CONFIRMED
