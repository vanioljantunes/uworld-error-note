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
    <form action={handleSubmit} className="flex flex-col gap-5">
      <Input
        id="email"
        name="email"
        type="email"
        label="Email"
        placeholder="you@example.com"
        required
        autoComplete="email"
      />
      <div>
        <Input
          id="password"
          name="password"
          type="password"
          label="Password"
          placeholder="••••••••"
          required
          autoComplete="current-password"
        />
        <div className="flex justify-end mt-2">
          <Link href="/auth/forgot-password" className="text-xs text-neutral-500 hover:text-violet-400 transition-colors">
            Forgot password?
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3">
          <p className="text-sm text-red-400 text-center">{error}</p>
        </div>
      )}

      <Button type="submit" disabled={loading} className="w-full h-11 text-sm font-semibold mt-1">
        {loading ? 'Signing in\u2026' : 'Sign in'}
      </Button>

      <div className="relative my-1">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[#2a2a2a]" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-[#111111] px-3 text-neutral-600">or</span>
        </div>
      </div>

      <p className="text-sm text-center text-neutral-500">
        Don&apos;t have an account?{' '}
        <Link href="/auth/register" className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
          Register
        </Link>
      </p>
    </form>
  )
}
