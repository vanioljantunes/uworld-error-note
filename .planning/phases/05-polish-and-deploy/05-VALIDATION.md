---
phase: 5
slug: polish-and-deploy
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | `gapstrike/vitest.config.ts` |
| **Quick run command** | `cd gapstrike && npx vitest run` |
| **Full suite command** | `cd gapstrike && npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd gapstrike && npx vitest run`
- **After every plan wave:** Run `cd gapstrike && npx vitest run && npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | TMPL-06 | unit | `cd gapstrike && npx vitest run tests/flow-fallback.test.ts -t "parseFailed"` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | TMPL-06 | unit | `cd gapstrike && npx vitest run tests/flow-fallback.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | TMPL-06 | manual-only | N/A — Error Boundary requires browser | N/A | ⬜ pending |
| 05-02-01 | 02 | 2 | TMPL-06 | manual-only | N/A — requires physical device | N/A | ⬜ pending |
| 05-03-01 | 03 | 2 | TMPL-06 | build gate | `cd gapstrike && npm run build` | ✅ | ⬜ pending |
| 05-03-02 | 03 | 2 | TMPL-06 | manual-only | N/A — requires production environment | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `gapstrike/tests/flow-fallback.test.ts` — stubs for TMPL-06 parse-failure detection (parseFailed flag + textarea onChange propagation via parseFlowHTML return value assertions)

*Existing infrastructure covers all other phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Error Boundary catches render errors | TMPL-06 | Error Boundaries require interactive browser; jsdom cannot simulate render throws | Trigger render error in FlowchartEditor, verify textarea fallback appears |
| AnkiDroid rendering — boxes visible, cloze works | TMPL-06 | Requires physical device / emulator | Sync test card to AnkiDroid, confirm boxes visible, cloze tap reveals content |
| Vercel production smoke test | TMPL-06 | Requires production environment | Generate flowchart card → edit → save; generate table card → edit → save; no console errors |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
