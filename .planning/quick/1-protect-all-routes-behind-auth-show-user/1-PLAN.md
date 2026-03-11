---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - saas-shell/src/lib/supabase/middleware.ts
  - saas-shell/src/app/dashboard/layout.tsx
  - saas-shell/src/actions/auth.ts
autonomous: true
requirements: [QUICK-1]
must_haves:
  truths:
    - "Unauthenticated users visiting / are redirected to /auth/login"
    - "Authenticated users visiting / are redirected to /dashboard"
    - "Navbar shows user full_name instead of email (falls back to email if no name)"
    - "Logout redirects to /auth/login, not / (which is now protected)"
  artifacts:
    - path: "saas-shell/src/lib/supabase/middleware.ts"
      provides: "Root route protection + auth redirects"
      contains: "pathname === '/'"
    - path: "saas-shell/src/app/dashboard/layout.tsx"
      provides: "User display name in navbar"
      contains: "user_metadata"
    - path: "saas-shell/src/actions/auth.ts"
      provides: "Logout redirect to login page"
      contains: "/auth/login"
  key_links:
    - from: "middleware.ts"
      to: "/auth/login"
      via: "redirect for unauthenticated root access"
      pattern: "!user && pathname === '/'"
    - from: "auth.ts logout"
      to: "/auth/login"
      via: "redirect after signOut"
      pattern: "redirect.*auth/login"
---

<objective>
Protect all routes behind authentication and improve the navbar user display.

Purpose: Currently the root `/` route is unprotected, logout redirects to the unprotected root, and the navbar shows email instead of the user's name. This plan locks down the root route, fixes the logout redirect, and shows the user's full name.
Output: Three modified files — middleware, dashboard layout, and auth actions.
</objective>

<execution_context>
@C:/Users/vanio/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/vanio/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@saas-shell/src/lib/supabase/middleware.ts
@saas-shell/src/app/dashboard/layout.tsx
@saas-shell/src/actions/auth.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Protect root route and redirect logic in middleware</name>
  <files>saas-shell/src/lib/supabase/middleware.ts</files>
  <action>
In `updateSession`, after the existing `getUser()` call and `pathname` extraction (line 33-34), update the unauthenticated redirect check on line 35:

Change:
```
if (!user && (pathname.startsWith('/dashboard') || pathname.startsWith('/app'))) {
```
To:
```
if (!user && (pathname === '/' || pathname.startsWith('/dashboard') || pathname.startsWith('/app'))) {
```

Then add a new redirect block for authenticated users hitting root, BEFORE the existing `if (user && pathname.startsWith('/auth'))` block (line 39). Insert:
```typescript
if (user && pathname === '/') {
  return NextResponse.redirect(new URL('/dashboard', request.url))
}
```

This ensures:
- Unauthenticated users on `/` get sent to `/auth/login`
- Authenticated users on `/` get sent to `/dashboard`
- Existing `/dashboard/*` and `/app/*` protection unchanged
- Existing `/auth` redirect for logged-in users unchanged
  </action>
  <verify>
    <automated>cd C:/Users/vanio/Desktop/code/GapStrike/saas-shell && npx tsc --noEmit src/lib/supabase/middleware.ts 2>&1 | head -20</automated>
  </verify>
  <done>Root route `/` redirects unauthenticated to `/auth/login` and authenticated to `/dashboard`. No other routes affected.</done>
</task>

<task type="auto">
  <name>Task 2: Show user full name in navbar and fix logout redirect</name>
  <files>saas-shell/src/app/dashboard/layout.tsx, saas-shell/src/actions/auth.ts</files>
  <action>
**In `saas-shell/src/app/dashboard/layout.tsx` line 69:**

Change:
```tsx
<span className="text-xs text-neutral-500 hidden sm:inline">{user.email}</span>
```
To:
```tsx
<span className="text-xs text-neutral-500 hidden sm:inline">{user.user_metadata?.full_name || user.email}</span>
```

This uses `full_name` from user metadata (set during registration via `signUp({ options: { data: { full_name } } })`), falling back to email if the metadata field is missing.

**In `saas-shell/src/actions/auth.ts` line 48:**

Change:
```typescript
redirect('/')
```
To:
```typescript
redirect('/auth/login')
```

This is necessary because `/` is now a protected route, so redirecting there after logout would cause a redirect loop (logout -> / -> /auth/login). Go directly to `/auth/login` instead.
  </action>
  <verify>
    <automated>cd C:/Users/vanio/Desktop/code/GapStrike/saas-shell && npx tsc --noEmit src/app/dashboard/layout.tsx src/actions/auth.ts 2>&1 | head -20</automated>
  </verify>
  <done>Navbar displays user's full name (with email fallback). Logout redirects to /auth/login directly, avoiding redirect chain through protected root.</done>
</task>

</tasks>

<verification>
1. TypeScript compiles without errors for all three modified files
2. Manual check: visit `/` while logged out — should redirect to `/auth/login`
3. Manual check: visit `/` while logged in — should redirect to `/dashboard`
4. Manual check: dashboard navbar shows full name (not email) for users who registered with a name
5. Manual check: clicking Logout lands on `/auth/login`
</verification>

<success_criteria>
- Root route is fully protected (no public access)
- Authenticated root access redirects to dashboard
- Navbar shows `full_name` with email fallback
- Logout lands on `/auth/login` without redirect loops
- All three files compile cleanly
</success_criteria>

<output>
After completion, create `.planning/quick/1-protect-all-routes-behind-auth-show-user/1-SUMMARY.md`
</output>
