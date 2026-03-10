---
phase: 9
slug: verification-and-deploy
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | gapstrike/vitest.config.ts |
| **Quick run command** | `cd gapstrike && npx vitest run` |
| **Full suite command** | `cd gapstrike && npx vitest run && npm run build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd gapstrike && npx vitest run`
- **After every plan wave:** Run `cd gapstrike && npx vitest run && npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | cross-cutting | unit+build | `cd gapstrike && npx vitest run && npm run build` | ✅ | ⬜ pending |
| 09-01-02 | 01 | 1 | cross-cutting | manual | human smoke-test flowchart e2e | N/A | ⬜ pending |
| 09-01-03 | 01 | 1 | cross-cutting | manual | human smoke-test table e2e | N/A | ⬜ pending |
| 09-01-04 | 01 | 1 | cross-cutting | manual | verify gapstrike.vercel.app reflects v1.1 | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. 94 vitest tests already pass.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Flowchart e2e (generate + push to Anki) | SC-2 | Requires Anki running + AnkiConnect | Generate flowchart card, verify 5-7 nodes, push to Anki, confirm in Anki |
| Table e2e (generate + edit + push) | SC-3 | Requires Anki running + AnkiConnect | Generate table card, edit cell, push to Anki, confirm in Anki |
| Production deploy reflects v1.1 | SC-4 | Visual verification | Check two-mode UI (Preview/Edit) and richer flowchart output on gapstrike.vercel.app |
| BUG-03: Escape aborts edge creation | Phase 7 deferred | UI interaction | In Edit mode, start Connect, press Escape, verify no edge created |
| BUG-04: Back field preserved | Phase 7 deferred | UI interaction | Generate flowchart, check Back field shows extraction text not HTML |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
