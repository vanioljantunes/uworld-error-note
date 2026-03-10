# Phase 9: Verification and Deploy - Research

**Researched:** 2026-03-10
**Domain:** Next.js/Vercel deployment, end-to-end smoke testing, AnkiConnect integration, v1.1 regression verification
**Confidence:** HIGH

## Summary

Phase 9 is the terminal verification-and-ship phase for milestone v1.1 (Editor Polish). Its scope is deliberately narrow: run the Vitest suite, pass `npm run build`, smoke-test the two critical UI paths end-to-end, then push to Vercel. No new code is written unless a regression is discovered during smoke-testing.

All v1.1 feature code from Phases 6-8 is complete and verified at the unit/automated level but has never been pushed to `origin/master` — 45 commits are ahead of remote, meaning `gapstrike.vercel.app` still runs the v1.0 code from Phase 5. The Phase 6 UAT confirmed a recurring `OneDrive + FSWatcher` issue that causes Next.js HMR to silently serve a stale bundle; the planner must ensure the smoke-test is run against a fresh server (`.next/` cleared) to avoid the same false-negative. The Phase 5 deploy research documented the Vercel auto-deploy pathway fully: git push to master triggers deploy; no manual steps required.

Phase 9 has no new REQUIREMENTS.md entries. Its success criteria are entirely cross-cutting verification of requirements already marked Complete in Phases 6-8: UX-01, UX-02, LAY-01, BUG-01, BUG-02, BUG-03, BUG-04, and TMPL-07.

**Primary recommendation:** Run tests, clear `.next/`, do a local `npm run build` build check, smoke-test flowchart and table end-to-end against the local dev server, then push to Vercel and do a final production smoke-test. Treat any regression as a blocker that must be fixed before the push.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | ^15.1.3 | Build gate (`npm run build`) and production bundler | Already installed; Vercel requires Next.js build to succeed |
| Vitest | ^4.0.18 | Automated test suite (94 tests across 9 files) | Already configured in `gapstrike/vitest.config.ts`; all 94 tests pass as of Phase 8 |
| AnkiConnect | HTTP API at localhost:8765 | Push generated cards to Anki desktop during smoke-test | Pre-existing integration tested in prior phases |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Git | system | Push 45 unpushed commits to trigger Vercel auto-deploy | One git push to master covers all v1.1 changes |
| Vercel CLI / web dashboard | N/A (not needed) | Monitor deploy status | Check deployment log after push; no Vercel CLI required |

**Installation:** No new packages needed. All dependencies are present.

---

## Architecture Patterns

### Recommended Task Structure

Phase 9 maps to 2 plans:

```
Plan 09-01: Local verification
  Wave 0: (no setup needed)
  Wave 1: Run full Vitest suite → confirm 94 pass, 0 fail
  Wave 2: Clear .next/ cache → run npm run build → confirm zero TypeScript errors
  Wave 3: Local smoke-test flowchart card end-to-end
  Wave 4: Local smoke-test TableEditor end-to-end

Plan 09-02: Production deploy + verification
  Wave 1: git push master → Vercel auto-deploys
  Wave 2: Production smoke-test flowchart card end-to-end at gapstrike.vercel.app
  Wave 3: Production smoke-test TableEditor end-to-end at gapstrike.vercel.app
  Wave 4: Confirm two-mode UI (Preview/Edit tabs) and richer flowchart output visible on production
```

### Pattern 1: The .next Cache Stale-Bundle Trap (CRITICAL)

**What:** Next.js on Windows with OneDrive paths has a known FSWatcher failure mode where HMR does not recompile after file changes. The `.next/cache/` directory serves stale webpack bundles silently — the dev server starts fine but the browser gets code from 3+ hours ago.

**How Phase 6 was burned by this:** Phase 6 UAT reported 0/4 tests passing because the running server was serving v1.0 code. Root cause confirmed: OneDrive path interferes with chokidar FSWatcher events, preventing recompilation.

**How to avoid:** Before any smoke-test on the local dev server:
1. Kill any running dev server
2. `rm -rf gapstrike/.next`
3. `cd gapstrike && npm run dev`
4. Wait for "compiled successfully" in the terminal before opening the browser

**For `npm run build`:** The production build always recompiles from source regardless of `.next/` contents. No cache-clearing needed for the build gate.

**Warning signs:** The editor shows old toggle button ("Preview in Anki" / "Back to Editor") instead of the new Preview/Edit tab pair.

### Pattern 2: Vercel Auto-Deploy

**What:** `git push origin master` is the complete deploy action. Vercel's git integration watches `master` and starts a new build automatically.

**Deploy verification:** After pushing, check https://vercel.com dashboard (or the Vercel deployment URL from the build email) for build completion. Then smoke-test the production URL directly.

**Timing:** Vercel Next.js builds typically complete in 60-120 seconds for a project of this size.

**No Vercel CLI required.** No environment variable changes needed — all vars already configured in Vercel project settings from Phase 5.

### Pattern 3: End-to-End Smoke-Test Protocol

**What:** A specific manual walkthrough sequence that exercises the exact paths named in the success criteria. This is not exploratory testing — it follows a fixed script.

**Flowchart path:**
1. Open the app in a card with an extraction
2. Click "Flowchart" format button
3. Confirm editor opens in Preview mode (Anki render of the flowchart, NOT raw node cards)
4. Confirm flowchart has 5-7 boxes with domain-specific arrow labels (not "leads to" or "causes")
5. Click "Edit" tab — confirm raw node/edge editing UI appears
6. Click "Preview" tab — confirm returns to rendered view
7. Click "Push to Anki" (or equivalent) — confirm AnkiConnect returns success, card appears in Anki
8. Confirm no browser console errors throughout

**Table path:**
1. Open the app in a card with an extraction
2. Click "Table" format button
3. Confirm editor opens with rendered table
4. Click a cell — confirm inline editing works
5. Click "Push to Anki" — confirm AnkiConnect returns success
6. Confirm no browser console errors throughout

**Two-mode UI confirmation (success criterion 4):**
- Preview/Edit tab pair is visible in the flowchart editor header
- No eye-toggle visible when editor is in flowchart or table mode

### Anti-Patterns to Avoid

- **Do NOT smoke-test against a dev server without clearing `.next/`** — this was the Phase 6 failure mode.
- **Do NOT push to Vercel before `npm run build` passes locally** — TypeScript errors are fatal on Vercel; local build catches them first.
- **Do NOT skip the TableEditor smoke-test** — success criterion 3 explicitly requires it. Phase 6-8 changes are primarily in the flowchart path; regression in TableEditor would be easy to miss.
- **Do NOT treat a "deploy triggered" as "deploy verified"** — always confirm the Vercel deployment URL actually serves the new code by checking for the two-mode UI before marking the phase complete.
- **Do NOT fix new bugs in-phase if they are outside the v1.1 success criteria scope** — if a minor unrelated issue is found, log it and continue. The phase gate is the 4 success criteria only.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TypeScript build verification | Custom TS compiler invocation | `cd gapstrike && npm run build` | Next.js build invokes `tsc` with the project config; a standalone `tsc` call may miss Next.js-specific type augmentations |
| AnkiConnect verification | Scripted API call checker | Manual smoke-test with Anki desktop running | AnkiConnect success requires Anki to be open and a specific deck to exist; automation would require environment setup as complex as the test itself |
| Vercel deploy status polling | Custom CI webhook | Visual check of Vercel dashboard or deployment page | Vercel's deployment page gives real-time build logs; a script polling would be overkill for a one-time deploy |

---

## Common Pitfalls

### Pitfall 1: OneDrive FSWatcher Stale Bundle (Most Likely Failure)

**What goes wrong:** The local smoke-test appears to fail (old UI shown) even though Phase 6-8 code is correct.
**Why it happens:** OneDrive + Windows + chokidar = FSWatcher events not delivered to Next.js HMR. Stale `.next/cache/` serves old bundles.
**How to avoid:** Always `rm -rf gapstrike/.next && npm run dev` before smoke-testing. Wait for terminal "compiled successfully" before opening browser.
**Warning signs:** Editor header still shows "Preview in Anki" / "Back to Editor" toggle instead of Preview/Edit tab pair.

### Pitfall 2: AnkiConnect Not Running

**What goes wrong:** "Push to Anki" fails with network error; smoke-test can't confirm AnkiConnect path.
**Why it happens:** Anki desktop must be open AND AnkiConnect add-on must be installed for port 8765 to be available.
**How to avoid:** Open Anki desktop before starting the smoke-test. Verify with `curl http://localhost:8765` (should return 200 with `{"error":null}`).
**Warning signs:** Browser console shows `net::ERR_CONNECTION_REFUSED` on port 8765.

### Pitfall 3: v1.1 Requirements Still Listed as Pending

**What goes wrong:** REQUIREMENTS.md shows UX-01 and UX-02 as `[ ]` (Pending) even after Phase 6 code is deployed — creating confusion during the verification phase.
**Why it happens:** The traceability table in REQUIREMENTS.md was not updated during Phase 6 execution.
**How to avoid:** As part of Phase 9, update REQUIREMENTS.md to mark all v1.1 requirements Complete after successful deployment.
**Warning signs:** REQUIREMENTS.md still has `[ ]` next to UX-01, UX-02, BUG-01, BUG-02.

### Pitfall 4: TypeScript Errors Introduced by v1.1 Changes

**What goes wrong:** `npm run build` fails on Vercel with a Type error even though `npm run dev` ran fine.
**Why it happens:** `next dev` is more lenient than `next build` — some implicit `any` types, unused imports, or missing type assertions are only caught during full build.
**How to avoid:** Run `npm run build` locally as a gate before pushing. Fix any errors before pushing to Vercel.
**Warning signs:** Vercel build log shows "Type error" or "Module not found".

### Pitfall 5: Production Shows Old Code (Vercel Cache)

**What goes wrong:** Production smoke-test shows v1.0 UI even after git push and successful Vercel build.
**Why it happens:** This happened in Phase 5 (Issues 1 and 2) — Vercel's edge cache may serve old static assets. The root cause in Phase 5 was actually a stale `.next/` in the git repo (the build cache was committed).
**How to avoid:** Confirm `.next/` is in `.gitignore` (it should be for a standard Next.js project). If Vercel shows old UI, trigger a redeploy from the Vercel dashboard.
**Warning signs:** Production URL shows "Preview in Anki" toggle instead of Preview/Edit tab pair.

---

## Code Examples

### Verify Vitest suite passes
```bash
# Source: gapstrike/package.json scripts + vitest.config.ts
cd gapstrike && npx vitest run
# Expected: 94 tests pass, 0 fail, 0 skip
# Files: 9 test files
```

### Clear cache and run local build gate
```bash
# Source: Phase 5 research + Phase 6 UAT root cause analysis
rm -rf gapstrike/.next
cd gapstrike && npm run build
# Expected: "Compiled successfully" — zero TypeScript errors, zero build warnings
```

### Clear cache and start fresh dev server for smoke-test
```bash
rm -rf gapstrike/.next
cd gapstrike && npm run dev
# Wait for: "Ready - started server on 0.0.0.0:3000"
# Then: open http://localhost:3000 in browser
```

### Verify AnkiConnect is available
```bash
curl http://localhost:8765
# Expected: {"error":null,"result":null}  (AnkiConnect version endpoint returns 200)
```

### Git push to trigger Vercel deploy
```bash
# Source: Phase 5 deploy research — vercel.json + .vercel/ already configured
cd /path/to/repo && git push origin master
# Vercel auto-deploys from master; no CLI needed
# Monitor: https://vercel.com/dashboard (or check deployment email)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Three view modes in FlowchartEditor (Preview, Edit, some third state) | Exactly two modes: Preview (default) and Edit | Phase 6 (UX-01, UX-02) | Success criterion 4 checks for two-mode UI |
| Eye-toggle always visible | Eye-toggle hidden when editorMode is "flowchart" or "table" | Phase 6 | Cleaner UI; part of two-mode confirmation |
| Toolbar format button row could overflow on narrow screens | flex-wrap + justify-content: flex-end on .ankiFormatRow | Phase 6 (LAY-01) | Buttons wrap to second line instead of overflowing |
| window.prompt for step label input | Inline StepLabelInput with Escape-to-abort | Phase 7 (BUG-03) | No native dialog; Escape cleanly aborts edge creation |
| Back field could show HTML after mode switch | Synchronous rAF ref init in card selection | Phase 7 (BUG-04) | Back field reliably shows original extraction text |
| 3-4 node flowchart AI output | 5-7 node flowchart AI output with domain-specific arrows | Phase 8 (TMPL-07) | Richer mechanism maps; success criterion 2 checks for this |
| REMOVE_NODE dropped edges in branch parent scenarios | REMOVE_NODE reconnects all children to grandparent | Phase 7 (BUG-01) | No silent data corruption on node removal |
| ADD_NODE leaf-detection sometimes missed disconnected nodes | ADD_NODE uses selectedNodeId directly | Phase 7 (BUG-02) | Correct parent selection in disconnected graphs |

**Deployed state at gapstrike.vercel.app as of now:** v1.0 (Phase 5 code — commit `81b7e5c` was last pushed to remote). All v1.1 changes (45 commits) are local-only.

---

## Open Questions

1. **Do BUG-01 and BUG-02 require human verification on a running browser?**
   - What we know: Phase 7 verifier marked BUG-01 and BUG-02 as SATISFIED via unit tests (6/6 automated truths verified). The reducer logic is tested and correct.
   - What's unclear: Whether the planner should include a manual smoke-test of REMOVE_NODE and ADD_NODE in the edit-mode flow, in addition to the unit-test coverage.
   - Recommendation: The success criteria for Phase 9 say "TableEditor is unbroken" and "flowchart card generated and pushed to Anki" — this implies basic edit-mode operations should work. Include one brief edit-mode check (remove a node, add a node) as part of the flowchart smoke-test. Do not make this a comprehensive BUG-01/BUG-02 retest.

2. **Are UX-01, UX-02, BUG-01, BUG-02 still listed as Pending in REQUIREMENTS.md?**
   - What we know: REQUIREMENTS.md traceability table marks BUG-03 and BUG-04 as Complete for Phase 7, but the checklist section for UX-01 and UX-02 still shows `[ ]` (not checked). BUG-01 and BUG-02 are also `[ ]` in the checklist.
   - What's unclear: Whether the Phase 9 planner should include a task to update REQUIREMENTS.md.
   - Recommendation: Yes — include a documentation update task as part of Phase 9 to mark all v1.1 requirements complete after successful deploy.

3. **Will the Phase 7 human-verification items (BUG-03 Escape behavior, BUG-04 async timing) be considered satisfied by Phase 9's smoke-test?**
   - What we know: Phase 7 verifier marked these as "SATISFIED (pending human)" — the code is correct, but runtime browser confirmation was deferred.
   - What's unclear: Whether Phase 9's smoke-test protocol should include explicit BUG-03 and BUG-04 checks.
   - Recommendation: Yes — the Phase 9 smoke-test should include: (a) pressing Escape during edge creation to verify no phantom edge, and (b) switching from cloze to flowchart and confirming the Back field shows original text. These are quick checks within the normal flowchart smoke-test flow.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `gapstrike/vitest.config.ts` |
| Quick run command | `cd gapstrike && npx vitest run` |
| Full suite command | `cd gapstrike && npx vitest run` |

### Phase Requirements to Test Map

Phase 9 has no new REQUIREMENTS.md entries — it is cross-cutting verification. The relevant requirements and their test coverage:

| Req ID | Behavior | Test Type | Automated Command | Covered? |
|--------|----------|-----------|-------------------|---------|
| UX-01 | FlowchartEditor opens in Preview mode by default | unit | `cd gapstrike && npx vitest run tests/flowchart-editor-initial-state.test.ts` | Yes (existing) |
| UX-02 | Exactly two modes — Preview and Edit | unit | `cd gapstrike && npx vitest run tests/flowchart-editor-initial-state.test.ts` | Yes (existing) |
| LAY-01 | Format button row does not overflow on narrow screens | manual-only | N/A — CSS layout requires browser resize interaction | N/A (visual) |
| BUG-01 | REMOVE_NODE reconnects edges on branch parent | unit | `cd gapstrike && npx vitest run src/lib/flowReducer.test.ts` | Yes (existing) |
| BUG-02 | ADD_NODE leaf detection on disconnected graphs | unit | `cd gapstrike && npx vitest run src/lib/flowReducer.test.ts` | Yes (existing) |
| BUG-03 | Escape aborts edge creation (no phantom edge) | manual-only | N/A — React keyboard events require browser | Manual in smoke-test |
| BUG-04 | Back field shows original text after mode switch | manual-only | N/A — async rAF timing requires browser | Manual in smoke-test |
| TMPL-07 | 5-7 node flowchart with domain-specific arrows | unit + manual | `cd gapstrike && npx vitest run tests/flow-round-trip.test.ts tests/template-hash.test.ts` + live generation | Yes (existing) + manual |
| (build gate) | `npm run build` passes with zero TS errors | build | `cd gapstrike && npm run build` | Yes |
| (deploy gate) | gapstrike.vercel.app reflects all v1.1 changes | manual-only | N/A — requires live production browser check | Manual |

### Sampling Rate
- **Pre-push gate:** `cd gapstrike && npx vitest run && npm run build`
- **Phase gate:** Full suite green + manual smoke-test (local) + Vercel deploy confirmed + production smoke-test passed before closing phase

### Wave 0 Gaps
None — existing test infrastructure covers all automated requirements. All 94 vitest tests exist and pass. No new test files needed for Phase 9.

*(Phase 9 is verification-only — no new production code is planned, therefore no new test files are needed in Wave 0.)*

---

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis — `gapstrike/vercel.json`, `gapstrike/package.json`, `gapstrike/tests/` — confirmed deploy infrastructure and test coverage
- Phase 5 RESEARCH.md — Vercel auto-deploy pattern (git push triggers deploy), `npm run build` gate discipline, AnkiConnect smoke-test protocol
- Phase 6 UAT.md — Confirmed OneDrive FSWatcher `.next/` stale-bundle root cause and fix (clear cache, restart server)
- Phase 7 VERIFICATION.md — 6/6 automated truths verified; 3 human-only items deferred to Phase 9 smoke-test
- Phase 8 VERIFICATION.md — 4/5 automated truths verified; human-approved during plan 02 execution
- `git log origin/master..HEAD` — confirmed 45 commits unpushed; remote still at v1.0

### Secondary (MEDIUM confidence)
- Phase 6 code (`feat(06-01)`, `feat(06-02)`) and Phase 7 code (`feat(07-02)`, `fix(07-02)`) committed locally — content verified through prior phase verification reports
- Vercel build timing estimate (60-120 seconds) — from Phase 5 deploy experience

### Tertiary (LOW confidence)
- "Vercel edge cache may serve old static assets" — mentioned in Phase 5 VERIFICATION.md as a suspected cause of Issues 1 and 2; root cause was later attributed to `.next/` cache in the git repo, not Vercel CDN edge cache

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; deploy infrastructure confirmed from Phase 5; test suite confirmed passing at Phase 8 end
- Architecture (task structure): HIGH — patterns derived directly from Phase 5 deploy research and Phase 6 UAT findings
- Pitfalls: HIGH — OneDrive FSWatcher bug is confirmed from Phase 6; TypeScript build strictness is confirmed from Phase 5; all other pitfalls derived from codebase evidence
- AnkiConnect smoke-test: MEDIUM — requires Anki to be running; confirmed working in Phase 5 but cannot be pre-verified programmatically

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable — no fast-moving dependencies; Vercel/Next.js deployment patterns are stable)
