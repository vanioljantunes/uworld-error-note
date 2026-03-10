---
phase: 8
slug: richer-ai-template-atomic
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | `gapstrike/vitest.config.ts` |
| **Quick run command** | `cd gapstrike && npx vitest run tests/flow-round-trip.test.ts` |
| **Full suite command** | `cd gapstrike && npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd gapstrike && npx vitest run tests/flow-round-trip.test.ts`
- **After every plan wave:** Run `cd gapstrike && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | TMPL-07 | unit | `npx vitest run tests/flow-round-trip.test.ts` | Wave 0 (new fixtures) | ⬜ pending |
| 08-01-02 | 01 | 1 | TMPL-07 | unit | `npx vitest run tests/flow-round-trip.test.ts` | Wave 0 (new fixtures) | ⬜ pending |
| 08-01-03 | 01 | 1 | TMPL-07 | unit | `npx vitest run tests/template-hash.test.ts` | Wave 0 gap | ⬜ pending |
| 08-02-01 | 02 | 2 | TMPL-07 | manual | n/a — requires live GPT-4o call | manual-only | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] New fixtures in `gapstrike/tests/flow-round-trip.test.ts` — 5-node linear, 6-node branching, category-hint cloze — covers TMPL-07 parse verification
- [ ] `gapstrike/tests/template-hash.test.ts` — verifies `TEMPLATE_PREV_HASHES["anki_flowchart"]` includes `"c9d31786fcdb0678"` and new template produces a different hash — covers TMPL-07 hash bookkeeping

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Generated card has 5-7 boxes with causal arrows | TMPL-07 | Requires live GPT-4o call | Generate flowchart from 5 diverse USMLE extractions; verify node count and arrow labels |
| Cloze on mechanism step only, not trigger/leaf | TMPL-07 | Requires live GPT-4o output inspection | Check cloze placement in generated HTML for each of 5 test inputs |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
