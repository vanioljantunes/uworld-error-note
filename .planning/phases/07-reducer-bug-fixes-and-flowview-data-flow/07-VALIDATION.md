---
phase: 7
slug: reducer-bug-fixes-and-flowview-data-flow
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | `gapstrike/vitest.config.ts` |
| **Quick run command** | `cd gapstrike && npx vitest run src/lib/flowReducer.test.ts` |
| **Full suite command** | `cd gapstrike && npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd gapstrike && npx vitest run src/lib/flowReducer.test.ts`
- **After every plan wave:** Run `cd gapstrike && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | BUG-01 | unit | `cd gapstrike && npx vitest run src/lib/flowReducer.test.ts` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | BUG-01 | unit | `cd gapstrike && npx vitest run src/lib/flowReducer.test.ts` | ❌ W0 | ⬜ pending |
| 07-01-03 | 01 | 1 | BUG-02 | unit | `cd gapstrike && npx vitest run src/lib/flowReducer.test.ts` | ❌ W0 | ⬜ pending |
| 07-01-04 | 01 | 1 | BUG-02 | unit | `cd gapstrike && npx vitest run src/lib/flowReducer.test.ts` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 1 | BUG-03 | manual | manual-only | N/A | ⬜ pending |
| 07-02-02 | 02 | 1 | BUG-04 | manual | manual-only | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `gapstrike/src/lib/flowReducer.test.ts` — stubs for BUG-01 (branch-parent removal, branch-child removal) and BUG-02 (selectedNodeId parent, null selectedNodeId standalone)

*Existing infrastructure covers framework install — Vitest already configured.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Escape on step-label input does not dispatch ADD_EDGE | BUG-03 | Requires React component rendering; no React Testing Library installed | 1. Enter Edit mode 2. Drag edge to node 3. Press Escape on step-label input 4. Verify no edge created |
| Enter with empty text dispatches ADD_EDGE with stepLabel="" | BUG-03 | Requires React component rendering | 1. Enter Edit mode 2. Drag edge to node 3. Press Enter with empty input 4. Verify edge created with empty label |
| editBack state unchanged after handleSwitchEditor to flowchart mode | BUG-04 | Async state interaction requires integration test | 1. Select a card with extraction text 2. Click "Flowchart" or "Table" 3. Verify Back field still shows original extraction text |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
