---
status: diagnosed
phase: 06-mode-simplification-and-layout
source: [06-01-SUMMARY.md, 06-02-SUMMARY.md]
started: 2026-03-10
updated: 2026-03-10
---

## Current Test

[testing complete]

## Tests

### 1. Preview Default on Open
expected: Open a flowchart card in the editor. It should display the Anki-rendered preview immediately — no raw node/edge editing UI visible on first load.
result: issue
reported: "Editor opens in Edit mode showing + Add Box, Connect, and raw node boxes. Old 'Preview in Anki' single toggle visible instead of Preview/Edit tab pair. Eye-toggle visible in flowchart mode. Phase 6 code changes exist in source files but are not reflected in the running app."
severity: major

### 2. Preview / Edit Tab Pair
expected: The editor header shows exactly two tab buttons labeled "Preview" and "Edit" (no old single toggle button). Clicking "Edit" switches to the node/edge editor. Clicking "Preview" switches back. Clicking the already-active tab does nothing.
result: issue
reported: "Old 'Preview in Anki' / 'Back to Editor' single toggle still visible. No tab pair present. Same root cause as Test 1 — stale dev server bundle."
severity: major

### 3. Eye-Toggle Conditional Hide
expected: When editorMode is "flowchart" or "table", the eye-toggle button (ankiPreview) is NOT visible anywhere in the UI. Switch to "cloze" or "question" mode — the eye-toggle reappears.
result: issue
reported: "Eye-toggle visible in flowchart mode (visible in screenshots). Same root cause as Test 1 — stale dev server bundle."
severity: major

### 4. Format Button Row Wrapping
expected: Narrow the panel width so the format buttons (Flowchart, Table, Cloze, etc.) don't all fit on one line. They should wrap to a second line (right-aligned) rather than overflowing or getting cropped.
result: skipped
reason: Cannot verify — all format buttons fit on one line at current panel width. Blocked by stale bundle.

## Summary

total: 4
passed: 0
issues: 3
pending: 0
skipped: 1

## Gaps

- truth: "FlowchartEditor opens in Preview mode by default with Preview/Edit tab pair and eye-toggle hidden in flowchart mode"
  status: failed
  reason: "User reported: Old UI still being served — 'Preview in Anki'/'Back to Editor' toggle instead of tab pair, eye-toggle visible in flowchart mode, editor opens in Edit mode."
  severity: major
  test: 1
  root_cause: "Next.js HMR silently failed — dev server started at 20:51, Phase 6 edits at 23:50, webpack cache last compiled at 20:03. OneDrive path interferes with FSWatcher events, preventing recompilation. Browser serves 3h45m-stale bundle."
  artifacts:
    - path: "gapstrike/.next/"
      issue: "Stale webpack dev cache (client-development/ and server-development/ packs dated 20:03-20:06)"
  missing:
    - "Restart dev server: cd gapstrike && rm -rf .next && npm run dev"
    - "Optional: add CHOKIDAR_USEPOLLING=true to gapstrike/.env.local to prevent recurrence"
  debug_session: ".planning/debug/phase6-changes-not-reflected.md"

- truth: "Nodes visible in Preview mode match nodes visible in Edit mode"
  status: failed
  reason: "User reported: Preview shows 5 nodes but Edit mode only shows 3. Add Box creates nodes that flash and disappear from Edit, only visible in Preview."
  severity: major
  test: 1
  root_cause: "Pre-existing parseFlowHTML bug — parser does not extract all nodes from AI-generated HTML. Not a Phase 6 regression. Tracked for Phase 7 (BUG-01/BUG-02)."
  artifacts:
    - path: "gapstrike/src/components/FlowchartEditor.tsx"
      issue: "parseFlowHTML incomplete node extraction; ADD_NODE reducer may have leaf-detection issue"
  missing:
    - "Phase 7 plan 07-01 covers REMOVE_NODE and ADD_NODE reducer fixes"
  debug_session: ""
