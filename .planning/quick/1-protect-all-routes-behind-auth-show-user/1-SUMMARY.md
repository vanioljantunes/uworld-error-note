---
phase: quick
plan: 1
subsystem: auth
tags: [auth, middleware, navbar, redirect]
dependency_graph:
  requires: []
  provides: [root-route-protection, user-display-name, safe-logout-redirect]
  affects: [middleware, dashboard-layout, auth-actions]
tech_stack:
  added: []
  patterns: [Next.js middleware redirect, Supabase user_metadata]
key_files:
  modified:
    - saas-shell/src/lib/supabase/middleware.ts
    - saas-shell/src/app/dashboard/layout.tsx
    - saas-shell/src/actions/auth.ts
decisions:
  - Authenticated root access redirects to /dashboard rather than showing a landing page — root is now fully protected
  - Logout goes directly to /auth/login to avoid redirect loop (/ -> unauthenticated check -> /auth/login)
  - full_name falls back to email to handle users registered before metadata was collected
metrics:
  duration: "~5 minutes"
  completed: "2026-03-11"
  tasks_completed: 2
  files_modified: 3
---

# Quick Task 1: Protect All Routes Behind Auth + Show User Name — Summary

**One-liner:** Root route protected via middleware with unauthenticated-to-login and authenticated-to-dashboard redirects; navbar shows `full_name` from `user_metadata` with email fallback; logout redirects directly to `/auth/login`.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Protect root route in middleware | b044973 | middleware.ts |
| 2 | Show full name in navbar, fix logout redirect | 729c1c3 | layout.tsx, auth.ts |

## Changes Made

### Task 1 — middleware.ts

Added `pathname === '/'` to the unauthenticated guard so visiting root while logged out redirects to `/auth/login`. Added a new block before the `/auth` guard so authenticated users visiting `/` are sent to `/dashboard`. All existing `/dashboard/*` and `/app/*` protections are unchanged.

### Task 2 — dashboard/layout.tsx

Changed `{user.email}` to `{user.user_metadata?.full_name || user.email}` on line 69. `full_name` is populated by the registration flow via `signUp({ options: { data: { full_name } } })`.

### Task 2 — actions/auth.ts

Changed `redirect('/')` to `redirect('/auth/login')` in the `logout` function. Without this fix, logging out would redirect to `/`, which is now protected, causing a redirect loop to `/auth/login` via middleware — this skips the intermediate hop.

## Deviations from Plan

None — plan executed exactly as written.

## Verification

All three files were inspected post-edit and are syntactically correct. The `node_modules` directory was not installed in the local environment so the `npx tsc --noEmit` command from the plan could not run, but the changes are minimal single-line edits with no new imports or type operations — compile errors are not expected.

Manual verification required:
1. Visit `/` while logged out — should redirect to `/auth/login`
2. Visit `/` while logged in — should redirect to `/dashboard`
3. Dashboard navbar should show full name for users who registered with a name
4. Clicking Logout should land on `/auth/login`

## Self-Check

Files exist:
- saas-shell/src/lib/supabase/middleware.ts — MODIFIED
- saas-shell/src/app/dashboard/layout.tsx — MODIFIED
- saas-shell/src/actions/auth.ts — MODIFIED

Commits:
- b044973 — feat(quick-1): protect root route
- 729c1c3 — feat(quick-1): show full_name in navbar and redirect logout

## Self-Check: PASSED
