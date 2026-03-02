# SaaS Shell Design — GapStrike

Date: 2026-03-02
Status: Approved

## Goal

Add a production-ready auth + subscription layer to GapStrike as a clean, isolated
`saas-shell/` project. The existing `obsidian-chat/` app is untouched; integration
happens later deliberately.

## Stack

- Next.js 15 (App Router, TypeScript, Tailwind CSS)
- Supabase (`@supabase/ssr`) — Auth + Database
- Vercel — deployment
- No UI library — Tailwind utility classes + minimal shared components

## File Structure

```
saas-shell/
├── .env.local.example
├── middleware.ts
├── next.config.ts
├── tailwind.config.ts
├── package.json
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                   # Landing (/)
│   │   ├── auth/
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── callback/route.ts      # Email confirm redirect
│   │   └── dashboard/
│   │       ├── layout.tsx             # Protected layout + navbar
│   │       └── page.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts              # Browser singleton
│   │   │   ├── server.ts              # Server client (cookies)
│   │   │   └── middleware.ts          # Middleware client
│   │   └── types.ts                   # DB types
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   └── Input.tsx
│   │   └── auth/
│   │       ├── LoginForm.tsx
│   │       └── RegisterForm.tsx
│   └── actions/
│       └── auth.ts                    # Server actions: login, register, logout
```

## Auth Flow

```
Register  → signUp(email, password, { full_name })
            → DB trigger creates profiles + subscriptions rows
            → redirect /dashboard

Login     → signInWithPassword(email, password)
            → session cookie set via @supabase/ssr
            → redirect /dashboard

Middleware → every request:
              getUser() → refresh session cookie
              /dashboard/* + no user  → /auth/login
              /auth/*    + user       → /dashboard

Logout    → server action: signOut() → redirect /
```

## Database Schema

### profiles
| column | type | notes |
|---|---|---|
| id | uuid PK | references auth.users |
| full_name | text | from signup metadata |
| avatar_url | text | nullable |
| created_at | timestamptz | default now() |

### subscriptions
| column | type | notes |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| user_id | uuid FK | references auth.users |
| status | text | free / active / past_due / canceled |
| plan | text | free / pro / enterprise |
| stripe_customer_id | text | nullable, Stripe-ready |
| stripe_subscription_id | text | nullable, Stripe-ready |
| current_period_end | timestamptz | nullable |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

RLS enabled on both tables. Trigger `on_auth_user_created` auto-inserts both rows on signup.

## UI

- Palette: slate (neutral) + indigo (accent)
- Landing: hero with CTA — "Get Started" + "Login"
- Auth pages: centered card, email + password fields, link to other auth page
- Dashboard: top navbar (logo, user email, logout), stat cards showing plan + status from DB

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Supabase Config Steps

1. Create project at supabase.com
2. Run schema SQL in SQL editor (profiles + subscriptions tables, RLS, trigger)
3. Copy URL + anon key to `.env.local`
4. Enable email auth in Auth → Providers (on by default)
5. Set Site URL + redirect URL in Auth → URL Configuration

## Vercel Deployment Checklist

- [ ] Push `saas-shell/` to GitHub
- [ ] Import project in Vercel (set root directory to `saas-shell/`)
- [ ] Add `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel env vars
- [ ] Set Supabase Auth redirect URL to production domain
- [ ] Deploy
