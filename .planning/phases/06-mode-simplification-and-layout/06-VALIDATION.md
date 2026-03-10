---
phase: 6
slug: mode-simplification-and-layout
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.18 |
| **Config file** | `gapstrike/vitest.config.ts` |
| **Quick run command** | `cd gapstrike && npx vitest run` |
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
| 06-01-01 | 01 | 1 | UX-01 | unit | `cd gapstrike && npx vitest run tests/flowchart-editor-initial-state.test.ts` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | UX-02 | manual | n/a — visual toggle pair rendering | n/a | ⬜ pending |
| 06-01-03 | 01 | 1 | UX-02 | manual | n/a — eye-toggle hide in flowchart/table mode | n/a | ⬜ pending |
| 06-02-01 | 02 | 1 | LAY-01 | manual | n/a — visual layout wrapping test | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `gapstrike/tests/flowchart-editor-initial-state.test.ts` — asserts `initialState.viewMode === "preview"` (UX-01)

*UX-02 and LAY-01 are visual tests — no JSDOM/RTL setup exists. Human verification is the appropriate gate.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Two mode tabs (Preview/Edit) render with active highlighting | UX-02 | Requires rendered component — no JSDOM setup | Open flowchart editor, verify both tabs visible, click each to switch |
| Eye-toggle hidden in flowchart/table mode | UX-02 | Requires rendered component | Switch to flowchart mode, verify eye-toggle not visible; switch to cloze, verify it reappears |
| Format button row wraps on narrow screen | LAY-01 | Visual layout test | Resize panel to narrow width, verify buttons wrap to second line without overflow |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
