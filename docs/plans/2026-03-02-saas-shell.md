# SaaS Shell Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Scaffold `saas-shell/` — a standalone Next.js 15 app with Supabase Auth (email+password), protected dashboard, and Vercel deployment readiness.

**Architecture:** New top-level `saas-shell/` directory, completely isolated from `obsidian-chat/`. Three Supabase clients (browser, server, middleware) following `@supabase/ssr` pattern. Server Actions handle all auth mutations. Middleware guards `/dashboard/*` routes.

**Tech Stack:** Next.js 15 (App Router, TypeScript, Tailwind CSS), `@supabase/ssr`, `@supabase/supabase-js`, Vercel.

---

## Task 1: Scaffold Next.js project

**Files:**
- Create: `saas-shell/` (via CLI)

**Step 1: Run create-next-app**

```bash
cd "c:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI"
npx create-next-app@latest saas-shell \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-eslint \
  --no-turbopack
```

Expected: `saas-shell/` created with `src/app/`, `tailwind.config.ts`, `tsconfig.json`.

**Step 2: Verify it builds**

```bash
cd saas-shell && npm run build
```

Expected: build succeeds with default Next.js template.

**Step 3: Delete boilerplate files**

Remove the default Next.js page content — keep the files but we'll overwrite them:

```bash
# We'll overwrite these in later tasks — no deletion needed
```

**Step 4: Commit**

```bash
cd "c:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI"
git add saas-shell/
git commit -m "feat: scaffold saas-shell Next.js 15 project"
```

---

## Task 2: Install Supabase dependencies

**Files:**
- Modify: `saas-shell/package.json`

**Step 1: Install**

```bash
cd saas-shell
npm install @supabase/supabase-js @supabase/ssr
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 3: Commit**

```bash
cd "c:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI"
git add saas-shell/package.json saas-shell/package-lock.json
git commit -m "feat: add @supabase/ssr and @supabase/supabase-js"
```

---

## Task 3: Environment template + DB types

**Files:**
- Create: `saas-shell/.env.local.example`
- Create: `saas-shell/.env.local` (not committed)
- Create: `saas-shell/src/lib/types.ts`

**Step 1: Create `.env.local.example`**

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

**Step 2: Create `.env.local`**

Copy `.env.local.example` to `.env.local` and fill in values from Supabase dashboard
(Settings → API → Project URL + anon key). Leave empty for now — fill before running dev.

```bash
cp saas-shell/.env.local.example saas-shell/.env.local
```

**Step 3: Create `src/lib/types.ts`**

```typescript
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          avatar_url: string | null
          created_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
        }
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          status: 'free' | 'active' | 'past_due' | 'canceled'
          plan: 'free' | 'pro' | 'enterprise'
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          current_period_end: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          status?: 'free' | 'active' | 'past_due' | 'canceled'
          plan?: 'free' | 'pro' | 'enterprise'
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          current_period_end?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          status?: 'free' | 'active' | 'past_due' | 'canceled'
          plan?: 'free' | 'pro' | 'enterprise'
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          current_period_end?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
```

**Step 4: Verify types compile**

```bash
cd saas-shell && npx tsc --noEmit
```

Expected: no errors.

**Step 5: Commit**

```bash
cd "c:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI"
git add saas-shell/.env.local.example saas-shell/src/lib/types.ts
git commit -m "feat: add DB types and env template"
```

---

## Task 4: Supabase client files

**Files:**
- Create: `saas-shell/src/lib/supabase/client.ts`
- Create: `saas-shell/src/lib/supabase/server.ts`
- Create: `saas-shell/src/lib/supabase/middleware.ts`

**Step 1: Create `src/lib/supabase/client.ts`** (browser-safe singleton)

```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '../types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Step 2: Create `src/lib/supabase/server.ts`** (server components + actions)

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '../types'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — cookie writes ignored safely
          }
        },
      },
    }
  )
}
```

**Step 3: Create `src/lib/supabase/middleware.ts`** (middleware session refresh)

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '../types'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (!user && pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  if (user && pathname.startsWith('/auth')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}
```

**Step 4: Verify**

```bash
cd saas-shell && npx tsc --noEmit
```

Expected: no errors.

**Step 5: Commit**

```bash
cd "c:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI"
git add saas-shell/src/lib/supabase/
git commit -m "feat: add supabase client, server, and middleware helpers"
```

---

## Task 5: Root middleware

**Files:**
- Create: `saas-shell/middleware.ts`

**Step 1: Create `middleware.ts`**

```typescript
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

**Step 2: Verify**

```bash
cd saas-shell && npx tsc --noEmit
```

Expected: no errors.

**Step 3: Commit**

```bash
cd "c:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI"
git add saas-shell/middleware.ts
git commit -m "feat: add middleware for session refresh and route protection"
```

---

## Task 6: Server actions

**Files:**
- Create: `saas-shell/src/actions/auth.ts`

**Step 1: Create `src/actions/auth.ts`**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function register(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    options: {
      data: {
        full_name: formData.get('full_name') as string,
      },
    },
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}
```

**Step 2: Verify**

```bash
cd saas-shell && npx tsc --noEmit
```

Expected: no errors.

**Step 3: Commit**

```bash
cd "c:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI"
git add saas-shell/src/actions/auth.ts
git commit -m "feat: add login, register, logout server actions"
```

---

## Task 7: UI primitives

**Files:**
- Create: `saas-shell/src/components/ui/Button.tsx`
- Create: `saas-shell/src/components/ui/Input.tsx`

**Step 1: Create `src/components/ui/Button.tsx`**

```typescript
import { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost'
}

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed'
  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
    ghost: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
  }

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}
```

**Step 2: Create `src/components/ui/Input.tsx`**

```typescript
import { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export function Input({ label, error, id, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        className={`rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
```

**Step 3: Verify**

```bash
cd saas-shell && npx tsc --noEmit
```

Expected: no errors.

**Step 4: Commit**

```bash
cd "c:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI"
git add saas-shell/src/components/ui/
git commit -m "feat: add Button and Input UI primitives"
```

---

## Task 8: Auth form components

**Files:**
- Create: `saas-shell/src/components/auth/LoginForm.tsx`
- Create: `saas-shell/src/components/auth/RegisterForm.tsx`

**Step 1: Create `src/components/auth/LoginForm.tsx`**

```typescript
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { login } from '@/actions/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function LoginForm() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await login(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <Input
        id="email"
        name="email"
        type="email"
        label="Email"
        placeholder="you@example.com"
        required
        autoComplete="email"
      />
      <Input
        id="password"
        name="password"
        type="password"
        label="Password"
        placeholder="••••••••"
        required
        autoComplete="current-password"
      />
      {error && <p className="text-sm text-red-600 text-center">{error}</p>}
      <Button type="submit" disabled={loading} className="w-full mt-1">
        {loading ? 'Signing in…' : 'Sign in'}
      </Button>
      <p className="text-sm text-center text-slate-600">
        No account?{' '}
        <Link href="/auth/register" className="text-indigo-600 hover:underline">
          Register
        </Link>
      </p>
    </form>
  )
}
```

**Step 2: Create `src/components/auth/RegisterForm.tsx`**

```typescript
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { register } from '@/actions/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function RegisterForm() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await register(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <Input
        id="full_name"
        name="full_name"
        type="text"
        label="Full name"
        placeholder="Jane Smith"
        required
        autoComplete="name"
      />
      <Input
        id="email"
        name="email"
        type="email"
        label="Email"
        placeholder="you@example.com"
        required
        autoComplete="email"
      />
      <Input
        id="password"
        name="password"
        type="password"
        label="Password"
        placeholder="••••••••"
        required
        autoComplete="new-password"
        minLength={6}
      />
      {error && <p className="text-sm text-red-600 text-center">{error}</p>}
      <Button type="submit" disabled={loading} className="w-full mt-1">
        {loading ? 'Creating account…' : 'Create account'}
      </Button>
      <p className="text-sm text-center text-slate-600">
        Already have an account?{' '}
        <Link href="/auth/login" className="text-indigo-600 hover:underline">
          Login
        </Link>
      </p>
    </form>
  )
}
```

**Step 3: Verify**

```bash
cd saas-shell && npx tsc --noEmit
```

Expected: no errors.

**Step 4: Commit**

```bash
cd "c:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI"
git add saas-shell/src/components/auth/
git commit -m "feat: add LoginForm and RegisterForm client components"
```

---

## Task 9: Auth callback route

**Files:**
- Create: `saas-shell/src/app/auth/callback/route.ts`

**Step 1: Create `src/app/auth/callback/route.ts`**

This handles the redirect from Supabase after email confirmation.

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_error`)
}
```

**Step 2: Verify**

```bash
cd saas-shell && npx tsc --noEmit
```

Expected: no errors.

**Step 3: Commit**

```bash
cd "c:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI"
git add saas-shell/src/app/auth/callback/
git commit -m "feat: add auth callback route for email confirmation"
```

---

## Task 10: Root layout and globals

**Files:**
- Modify: `saas-shell/src/app/layout.tsx`
- Modify: `saas-shell/src/app/globals.css`

**Step 1: Replace `src/app/globals.css`**

Remove all boilerplate, keep only Tailwind directives:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 2: Replace `src/app/layout.tsx`**

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'GapStrike',
  description: 'USMLE error analysis, automated.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

**Step 3: Verify**

```bash
cd saas-shell && npx tsc --noEmit
```

Expected: no errors.

**Step 4: Commit**

```bash
cd "c:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI"
git add saas-shell/src/app/layout.tsx saas-shell/src/app/globals.css
git commit -m "feat: clean root layout and globals"
```

---

## Task 11: Landing page

**Files:**
- Modify: `saas-shell/src/app/page.tsx`

**Step 1: Replace `src/app/page.tsx`**

```typescript
import Link from 'next/link'
import { Button } from '@/components/ui/Button'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
        <span className="text-lg font-semibold text-slate-900">GapStrike</span>
        <Link href="/auth/login">
          <Button variant="ghost">Login</Button>
        </Link>
      </header>

      <main className="flex flex-col items-center justify-center min-h-[calc(100vh-65px)] px-4 text-center">
        <h1 className="text-4xl font-bold text-slate-900 sm:text-5xl">
          Diagnose. Learn. Remember.
        </h1>
        <p className="mt-4 text-lg text-slate-600 max-w-md">
          USMLE error analysis, automated. Turn every wrong answer into a
          micro-note you'll never forget.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/auth/register">
            <Button>Get Started</Button>
          </Link>
          <Link href="/auth/login">
            <Button variant="ghost">Login</Button>
          </Link>
        </div>
      </main>
    </div>
  )
}
```

**Step 2: Verify**

```bash
cd saas-shell && npx tsc --noEmit
```

Expected: no errors.

**Step 3: Commit**

```bash
cd "c:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI"
git add saas-shell/src/app/page.tsx
git commit -m "feat: add landing page"
```

---

## Task 12: Login and register pages

**Files:**
- Create: `saas-shell/src/app/auth/login/page.tsx`
- Create: `saas-shell/src/app/auth/register/page.tsx`

**Step 1: Create `src/app/auth/login/page.tsx`**

```typescript
import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-xl border border-slate-200 shadow-sm p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Welcome back</h1>
        <LoginForm />
      </div>
    </div>
  )
}
```

**Step 2: Create `src/app/auth/register/page.tsx`**

```typescript
import { RegisterForm } from '@/components/auth/RegisterForm'

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-xl border border-slate-200 shadow-sm p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Create account</h1>
        <RegisterForm />
      </div>
    </div>
  )
}
```

**Step 3: Verify**

```bash
cd saas-shell && npx tsc --noEmit
```

Expected: no errors.

**Step 4: Commit**

```bash
cd "c:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI"
git add saas-shell/src/app/auth/
git commit -m "feat: add login and register pages"
```

---

## Task 13: Dashboard layout (protected)

**Files:**
- Create: `saas-shell/src/app/dashboard/layout.tsx`

**Step 1: Create `src/app/dashboard/layout.tsx`**

Double-guards the route (middleware is first, this is the server-side safety net):

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/actions/auth'
import { Button } from '@/components/ui/Button'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
        <span className="text-lg font-semibold text-slate-900">GapStrike</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-500">{user.email}</span>
          <form action={logout}>
            <Button type="submit" variant="ghost">
              Logout
            </Button>
          </form>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-10">{children}</main>
    </div>
  )
}
```

**Step 2: Verify**

```bash
cd saas-shell && npx tsc --noEmit
```

Expected: no errors.

**Step 3: Commit**

```bash
cd "c:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI"
git add saas-shell/src/app/dashboard/layout.tsx
git commit -m "feat: add protected dashboard layout with navbar and logout"
```

---

## Task 14: Dashboard page

**Files:**
- Create: `saas-shell/src/app/dashboard/page.tsx`

**Step 1: Create `src/app/dashboard/page.tsx`**

Fetches profile + subscription server-side — no loading states, no client JS:

```typescript
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: profile }, { data: subscription }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user!.id).single(),
    supabase.from('subscriptions').select('*').eq('user_id', user!.id).single(),
  ])

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">
        Welcome back{profile?.full_name ? `, ${profile.full_name}` : ''}
      </h1>
      <p className="text-slate-500 mb-8">Here's your account overview.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm font-medium text-slate-500">Plan</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 capitalize">
            {subscription?.plan ?? 'Free'}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm font-medium text-slate-500">Status</p>
          <p className="mt-1 text-2xl font-bold text-indigo-600 capitalize">
            {subscription?.status ?? 'Active'}
          </p>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Verify**

```bash
cd saas-shell && npx tsc --noEmit
```

Expected: no errors.

**Step 3: Commit**

```bash
cd "c:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI"
git add saas-shell/src/app/dashboard/page.tsx
git commit -m "feat: add dashboard page with profile and subscription data"
```

---

## Task 15: Full build verification

**Step 1: Set dummy env vars and build**

The build needs env vars present (even as dummies) to avoid missing var errors:

```bash
cd saas-shell
NEXT_PUBLIC_SUPABASE_URL=https://dummy.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy-anon-key \
npm run build
```

On Windows PowerShell:
```powershell
$env:NEXT_PUBLIC_SUPABASE_URL="https://dummy.supabase.co"
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY="dummy-anon-key"
npm run build
```

Expected: Build completes with no TypeScript or compilation errors. Route list shows `/`, `/auth/login`, `/auth/register`, `/auth/callback`, `/dashboard`.

**Step 2: Fix any errors before committing**

If build fails, read error, fix the specific file, re-run build.

**Step 3: Commit**

```bash
cd "c:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI"
git add saas-shell/
git commit -m "feat: saas-shell build verified — all routes compile clean"
```

---

## Task 16: Supabase project setup (manual steps)

> These are done in the Supabase dashboard, not in code.

**Step 1: Create Supabase project**

Go to [supabase.com](https://supabase.com) → New project. Note the project URL and anon key from Settings → API.

**Step 2: Fill `.env.local`**

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

**Step 3: Run schema SQL**

In Supabase dashboard → SQL Editor → New query. Paste and run:

```sql
-- Profiles
create table profiles (
  id           uuid references auth.users(id) on delete cascade primary key,
  full_name    text,
  avatar_url   text,
  created_at   timestamptz default now()
);

-- Subscriptions (Stripe-ready stub)
create table subscriptions (
  id                      uuid default gen_random_uuid() primary key,
  user_id                 uuid references auth.users(id) on delete cascade not null,
  status                  text default 'free'
    check (status in ('free','active','past_due','canceled')),
  plan                    text default 'free'
    check (plan in ('free','pro','enterprise')),
  stripe_customer_id      text,
  stripe_subscription_id  text,
  current_period_end      timestamptz,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

-- RLS
alter table profiles      enable row level security;
alter table subscriptions enable row level security;

create policy "own profile select" on profiles
  for select using (auth.uid() = id);
create policy "own profile update" on profiles
  for update using (auth.uid() = id);
create policy "own subscription select" on subscriptions
  for select using (auth.uid() = user_id);

-- Auto-create profile + free subscription on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name)
    values (new.id, new.raw_user_meta_data->>'full_name');
  insert into public.subscriptions (user_id)
    values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
```

**Step 4: Configure Auth URLs**

In Supabase → Authentication → URL Configuration:
- Site URL: `http://localhost:3000` (dev) or your Vercel URL (prod)
- Redirect URLs: add `http://localhost:3000/auth/callback` and `https://<your-domain>/auth/callback`

**Step 5: Test locally**

```bash
cd saas-shell && npm run dev
```

Open `http://localhost:3000`. Register → lands on dashboard. Logout → back to `/`. Login → dashboard. Visiting `/dashboard` without session → redirected to `/auth/login`.

---

## Task 17: Vercel deployment

**Step 1: Push to GitHub**

```bash
cd "c:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI"
git push origin master
```

**Step 2: Import project in Vercel**

1. Go to [vercel.com](https://vercel.com) → Add New Project
2. Import the GitHub repo
3. Set **Root Directory** to `saas-shell`
4. Framework preset: Next.js (auto-detected)

**Step 3: Add environment variables in Vercel**

In Project Settings → Environment Variables:
```
NEXT_PUBLIC_SUPABASE_URL     = https://<your-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = <your-anon-key>
```

**Step 4: Deploy**

Click Deploy. Vercel builds and gives you a `*.vercel.app` URL.

**Step 5: Update Supabase redirect URLs**

In Supabase → Authentication → URL Configuration:
- Site URL: `https://<your-app>.vercel.app`
- Add redirect URL: `https://<your-app>.vercel.app/auth/callback`

**Step 6: Smoke test production**

Visit `https://<your-app>.vercel.app`. Register a new account. Confirm the profile and subscription rows appeared in Supabase table editor.
