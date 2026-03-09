---
phase: 2
slug: data-model-and-parse-serialize-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^1.x |
| **Config file** | `gapstrike/vitest.config.ts` (Wave 0 installs) |
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
| 02-01-01 | 01 | 1 | FLOW-09 | unit | `npx vitest run tests/flow-round-trip.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | FLOW-09 | unit | `npx vitest run tests/flow-round-trip.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | FLOW-09 | unit | `npx vitest run tests/flow-round-trip.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | FLOW-09 | unit | `npx vitest run tests/flow-round-trip.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 1 | TABL-05 | unit | `npx vitest run tests/table-cloze.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `gapstrike/vitest.config.ts` — Vitest config with `environment: 'jsdom'`
- [ ] `gapstrike/tests/flow-round-trip.test.ts` — stubs for FLOW-09 (parse, rebuild, round-trip, cloze preservation)
- [ ] `gapstrike/tests/table-cloze.test.ts` — stubs for TABL-05 (parseTable cloze passthrough)
- [ ] Framework install: `cd gapstrike && npm install --save-dev vitest @vitest/ui jsdom`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Round-trip HTML renders identically in browser | FLOW-09 SC3 | Visual rendering comparison cannot be automated without screenshot diffing | Open original and rebuilt HTML in browser side-by-side; verify layout matches |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
