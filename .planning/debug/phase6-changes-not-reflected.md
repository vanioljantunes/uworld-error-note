---
status: resolved
trigger: "Investigate why Phase 6 code changes in FlowchartEditor.tsx are not reflected in the running app."
created: 2026-03-10T00:00:00Z
updated: 2026-03-10T00:00:00Z
---

## Current Focus

hypothesis: Dev server's HMR did not pick up the Phase 6 changes — webpack dev cache is stale (20:06) vs source files (23:50-23:51), and the process was started at 20:51 (before the source edits)
test: Compare timestamps of .next/cache/webpack/client-development/*.pack.gz vs FlowchartEditor.tsx mtime
expecting: Cache timestamps precede source file mtime = HMR missed the changes
next_action: RESOLVED — restart dev server to pick up changes

## Symptoms

expected: App shows tab pair (Preview/Edit), defaults to Preview mode on open, eye-toggle hidden in flowchart/table modes
actual: App shows old single "Preview in Anki" toggle, eye-toggle visible, opens in Edit mode
errors: none (no compile errors reported)
reproduction: Open the running app at localhost:3000 and navigate to any card with a flowchart
started: After Phase 6 source edits on Mar 9 at ~23:50

## Eliminated

- hypothesis: LOAD reducer resets viewMode to "editor"
  evidence: LOAD case (lines 106-114) does NOT touch viewMode at all; FLOW_INITIAL_STATE.viewMode is "preview" (line 93) and stays that way
  timestamp: 2026-03-10

- hypothesis: Wrong build mode (next start using stale production build)
  evidence: process command line is "next dev --port 3000" — confirmed dev server, not production; however the dev webpack cache pack files are also stale
  timestamp: 2026-03-10

- hypothesis: Multiple copies of FlowchartEditor.tsx
  evidence: Only one file exists at gapstrike/src/components/FlowchartEditor.tsx — no duplicates
  timestamp: 2026-03-10

- hypothesis: Import pointing to wrong component
  evidence: Not investigated separately; moot once root cause confirmed (stale cache)
  timestamp: 2026-03-10

## Evidence

- timestamp: 2026-03-10
  checked: FlowchartEditor.tsx mtime
  found: Last modified Mar 9 at 23:51
  implication: Phase 6 changes are present in source

- timestamp: 2026-03-10
  checked: FlowView.tsx mtime
  found: Last modified Mar 9 at 23:50
  implication: Phase 6 eye-toggle changes are present in source

- timestamp: 2026-03-10
  checked: .next/cache/webpack/client-development/ pack files
  found: All pack files last written Mar 9 at 20:03-20:06 — 3h45m before source edits
  implication: Webpack dev cache does not include Phase 6 changes

- timestamp: 2026-03-10
  checked: Node process PID 9976 (the actual Next.js server on port 3000)
  found: Started at 20:51:52 on Mar 9, running "next dev --port 3000"
  implication: Dev server was started ~3h before the source edits; should have used HMR

- timestamp: 2026-03-10
  checked: .next/BUILD_ID and static chunks
  found: All static build artifacts dated Mar 9 21:46
  implication: A full build was done at 21:46 (after server start) but still ~2h before source edits

- timestamp: 2026-03-10
  checked: FLOW_INITIAL_STATE (line 91-100) and LOAD reducer case (lines 106-114)
  found: viewMode defaults to "preview"; LOAD never writes viewMode — it is preserved
  implication: The default and LOAD behavior are correct; this is NOT the cause of the bug

- timestamp: 2026-03-10
  checked: FlowchartEditor.tsx line 509 (modeTabs rendering)
  found: Tab pair with Preview/Edit buttons using styles.modeTabs is correctly present in source
  implication: Source is correct; issue is purely a server/cache staleness problem

## Resolution

root_cause: |
  The Next.js dev server (started at 20:51 on Mar 9) failed to hot-reload the Phase 6 changes to
  FlowchartEditor.tsx and FlowView.tsx (saved at 23:50-23:51). The webpack dev cache pack files
  show the last successful compilation was at 20:03-20:06. The most likely cause is that the file
  watcher on Windows + OneDrive (the project lives in OneDrive\Área de Trabalho\) silently missed
  the file-change events. OneDrive sync operations can interfere with the inotify/FSWatcher events
  that Next.js relies on for HMR, causing the dev server to never recompile the changed modules.
  The server kept serving the stale compiled bundle from 20:06 even though the source changed 3h45m
  later. Since no browser-visible compile error appeared, the user had no indication the HMR failed.

fix: |
  Kill the running dev server (CTRL+C) and restart it. This forces a fresh compilation from source.
  The new startup will compile all files including the Phase 6 changes.

  Optional but recommended: delete the stale .next/ cache first to ensure a fully clean build:
    rm -rf gapstrike/.next && cd gapstrike && npm run dev

  To prevent recurrence: if the project must live on OneDrive, consider adding the project to
  OneDrive's "offline only" exclusion list, or moving it to a non-synced directory (e.g., C:\dev\).

verification: pending human confirmation after server restart
files_changed: []
