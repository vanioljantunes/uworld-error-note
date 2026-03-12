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
    <form action={handleSubmit} className="flex flex-col gap-5">
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
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3">
          <p className="text-sm text-red-400 text-center">{error}</p>
        </div>
      )}
      <Button type="submit" disabled={loading} className="w-full h-11 text-sm font-semibold mt-1">
        {loading ? 'Creating account\u2026' : 'Create account'}
      </Button>

      <div className="relative my-1">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full" style={{ borderTop: '1px solid #2a2a2a' }} />
        </div>
        <div className="relative flex justify-center text-xs">
          <span style={{ background: '#111111', padding: '0 12px', color: '#444444' }}>or</span>
        </div>
      </div>

      <p className="text-sm text-center text-neutral-500">
        Already have an account?{' '}
        <Link href="/auth/login" className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
          Sign in
        </Link>
      </p>
    </form>
  )
}
