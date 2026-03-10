---
phase: 06-mode-simplification-and-layout
plan: 01
subsystem: ui
tags: [flowchart-editor, preview-mode, toggle-pair, eye-toggle, ux]

# Dependency graph
requires: []
provides:
  - FlowchartEditor defaults to Preview mode on first load (UX-01)
  - Two-button tab pair (Preview / Edit) replaces single toggle button (UX-02)
  - Eye-toggle hidden in flowchart/table modes, visible in cloze/question (UX-02)
  - Unit tests validating Preview default viewMode
affects: [06-02]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Guard tab onClick with same-mode check to prevent toggling when clicking active tab"
    - "Reset ankiPreview to false when switching to flowchart/table to prevent stacked panels"

key-files:
  created:
    - gapstrike/tests/flowchart-editor-initial-state.test.ts
  modified:
    - gapstrike/src/components/FlowchartEditor.tsx
    - gapstrike/src/components/FlowchartEditor.module.css
    - gapstrike/src/components/FlowView.tsx

key-decisions:
  - decision: "Display label 'Edit' but internal state value stays 'editor'"
    why: "Avoid cascading renames across reducer, conditions, and tests"

# Self-Check
## Self-Check: PASSED
- [x] initialState.viewMode is "preview"
- [x] Two tab buttons (Preview / Edit) in editor header
- [x] Eye-toggle hidden for flowchart/table modes
- [x] 3 unit tests passing
- [x] All existing tests pass

# Summary
Changed FlowchartEditor to open in Preview mode by default, replaced the single toggle button with a Preview/Edit tab pair, and conditionally hid the eye-toggle in flowchart/table editor modes. Added 3 unit tests validating the Preview default.

commits:
  - hash: 47ea1b1
    message: "feat(06-01): default Preview mode, toggle pair UI, and eye-toggle hide"
  - hash: ea0f6fa
    message: "test(06-01): add unit tests for Preview default viewMode"
