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
