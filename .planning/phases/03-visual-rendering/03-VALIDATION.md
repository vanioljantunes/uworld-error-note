---
phase: 3
slug: visual-rendering
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 3 — Validation Strategy

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
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | FLOW-01 | smoke | `cd gapstrike && npx vitest run tests/flowchart-editor-smoke.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | FLOW-01 | smoke | `cd gapstrike && npx vitest run tests/flowchart-editor-smoke.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | FLOW-08 | unit | `cd gapstrike && npx vitest run tests/flowchart-editor-smoke.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | FLOW-01 | integration | `cd gapstrike && npx vitest run` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `gapstrike/tests/flowchart-editor-smoke.test.ts` — stubs for FLOW-01 (mount without error) and FLOW-08 (cloze text preservation)

*Existing test infrastructure (vitest + jsdom) covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual box/arrow layout matches design | FLOW-01 | CSS visual rendering not testable in jsdom | Open Flowchart button in GapStrike, verify boxes connected by arrows with step labels |
| Dot-grid background visible in editor | Design | CSS background pattern | Visual inspection of editor canvas |
| Hover lift effect on boxes | Design | CSS transition | Hover over NodeCard, verify translateY + shadow |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
