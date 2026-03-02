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
      {error && <p className="text-sm text-red-400 text-center">{error}</p>}
      <Button type="submit" disabled={loading} className="w-full mt-1">
        {loading ? 'Signing in…' : 'Sign in'}
      </Button>
      <p className="text-sm text-center text-neutral-500">
        No account?{' '}
        <Link href="/auth/register" className="text-violet-400 hover:text-violet-300 transition-colors">
          Register
        </Link>
      </p>
    </form>
  )
}
