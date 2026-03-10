---
phase: 05-polish-and-deploy
plan: "01"
subsystem: FlowchartEditor
tags: [resilience, error-boundary, fallback, parse-failure, typescript]
dependency_graph:
  requires: []
  provides: [parse-failure-fallback, error-boundary-wrapper]
  affects: [gapstrike/src/components/FlowchartEditor.tsx]
tech_stack:
  added: []
  patterns: [React Error Boundary class component, getDerivedStateFromProps reset pattern, parseFailed local useState]
key_files:
  created:
    - gapstrike/tests/flow-fallback.test.ts
  modified:
    - gapstrike/src/components/FlowchartEditor.tsx
    - gapstrike/src/components/FlowchartEditor.module.css
decisions:
  - "parseFailed state triggered by nodes.length === 0 AND value.trim().length > 0 — empty string is not a parse failure, avoids flicker"
  - "Error Boundary resets hasError on value prop change via getDerivedStateFromProps — avoids stale fallback when switching cards"
  - "Fallback textarea uses value prop (not internal state) and calls onChange directly — parent stays in sync on every keystroke"
  - "FlowchartEditorErrorBoundary placed before FlowchartEditorInner in file — class component can reference inner function component forward"
metrics:
  duration: 3
  completed_date: "2026-03-09"
  tasks_completed: 2
  files_changed: 3
---

# Phase 5 Plan 1: FlowchartEditor Parse-Failure Resilience Summary

**One-liner:** Parse-failure textarea fallback with amber warning banner and React Error Boundary wrapper using getDerivedStateFromProps reset pattern.

## What Was Built

Added two resilience layers to `FlowchartEditor`:

1. **parseFailed state path** — When `parseFlowHTML` returns an empty nodes array for non-empty HTML, `FlowchartEditorInner` renders a raw-HTML textarea with an amber warning banner instead of the broken visual editor. The textarea calls `onChange` directly on every keystroke, keeping parent state in sync.

2. **FlowchartEditorErrorBoundary** — Class component wrapping `FlowchartEditorInner` that catches render-time crashes via `getDerivedStateFromError`. Shows the same textarea fallback with a "Could not render flowchart" message. Resets `hasError` when the `value` prop changes via `getDerivedStateFromProps`, preventing stale fallback when users switch cards.

3. **Unit tests** — 3 tests in `flow-fallback.test.ts` validate the detection signal (`nodes.length === 0`) that drives the parseFailed path.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create parse-failure detection unit tests | b53981e | gapstrike/tests/flow-fallback.test.ts |
| 2 | Add parseFailed fallback + Error Boundary to FlowchartEditor | 3672e9e | FlowchartEditor.tsx, FlowchartEditor.module.css |

## Verification Results

- `npx vitest run` — 76 tests pass (6 test files, no regressions)
- `npm run build` — TypeScript build clean, no errors
- All named exports intact: `FlowchartPreview`, `highlightCloze`, `flowReducer`
- Default export wraps inner component in Error Boundary as required

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED
