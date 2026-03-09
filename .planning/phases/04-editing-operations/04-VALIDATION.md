---
phase: 4
slug: editing-operations
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 with jsdom |
| **Config file** | `gapstrike/vitest.config.ts` |
| **Quick run command** | `cd gapstrike && npx vitest run tests/flow-editor-mutations.test.ts` |
| **Full suite command** | `cd gapstrike && npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd gapstrike && npx vitest run`
- **After every plan wave:** Run `cd gapstrike && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | FLOW-02 | unit | `cd gapstrike && npx vitest run tests/flow-editor-mutations.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | FLOW-03 | unit | `cd gapstrike && npx vitest run tests/flow-editor-mutations.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 1 | FLOW-04 | unit | `cd gapstrike && npx vitest run tests/flow-editor-mutations.test.ts` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 1 | FLOW-05 | unit | `cd gapstrike && npx vitest run tests/flow-editor-mutations.test.ts` | ❌ W0 | ⬜ pending |
| 04-03-02 | 03 | 1 | FLOW-06 | unit | `cd gapstrike && npx vitest run tests/flow-editor-mutations.test.ts` | ❌ W0 | ⬜ pending |
| 04-03-03 | 03 | 1 | FLOW-07 | unit | `cd gapstrike && npx vitest run tests/flow-editor-mutations.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | FLOW-09 | unit | `cd gapstrike && npx vitest run tests/flow-editor-mutations.test.ts` | ❌ W0 | ⬜ pending |
| 04-04-01 | 04 | 1 | TABL-01 | unit | `cd gapstrike && npx vitest run tests/table-cloze.test.ts` | ✅ | ⬜ pending |
| 04-04-02 | 04 | 1 | TABL-02 | unit | `cd gapstrike && npx vitest run tests/table-cloze.test.ts` | ✅ | ⬜ pending |
| 04-04-03 | 04 | 1 | TABL-03 | unit | `cd gapstrike && npx vitest run tests/flow-table-intg.test.ts` | ❌ W0 | ⬜ pending |
| 04-04-04 | 04 | 1 | TABL-04 | unit | `cd gapstrike && npx vitest run tests/flow-table-intg.test.ts` | ❌ W0 | ⬜ pending |
| 04-04-05 | 04 | 1 | TABL-06 | unit | `cd gapstrike && npx vitest run tests/table-cloze.test.ts` | ✅ | ⬜ pending |
| 04-05-01 | 05 | 2 | INTG-01 | smoke/manual | Manual: click Flowchart button, edit box, verify FRONT field updates | — | ⬜ pending |
| 04-05-02 | 05 | 2 | INTG-02 | smoke/manual | Manual: click Table button, edit cell, verify FRONT field updates | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `gapstrike/tests/flow-editor-mutations.test.ts` — stubs for FLOW-02, FLOW-03, FLOW-04, FLOW-05, FLOW-06, FLOW-07, FLOW-09 via reducer unit tests
- [ ] `gapstrike/tests/flow-table-intg.test.ts` — stubs for TABL-03, TABL-04 via addRow/addColumn unit tests

*Existing tests cover: TABL-01 via parseTable, TABL-02 via round-trip, TABL-06 via round-trip, FLOW-01 via smoke, FLOW-08 via smoke*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| FlowchartEditor renders in edit panel, onChange sets editFront | INTG-01 | Visual UI integration requiring browser interaction | Click Flowchart button, edit a box label, verify FRONT field updates |
| TableEditor renders in edit panel, onChange sets editFront | INTG-02 | Visual UI integration requiring browser interaction | Click Table button, edit a cell, verify FRONT field updates |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
