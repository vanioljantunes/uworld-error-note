'use client'

import { useState } from 'react'
import Link from 'next/link'
import { resetPassword } from '@/actions/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await resetPassword(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 text-center py-2">
        <div className="h-12 w-12 rounded-full bg-violet-600/10 border border-violet-500/20 flex items-center justify-center mb-1">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-400">
            <path d="M22 10.5V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h12.5" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
        </div>
        <p className="text-sm text-neutral-300">Check your email for a password reset link.</p>
        <Link href="/auth/login" className="text-sm text-violet-400 hover:text-violet-300 font-medium transition-colors">
          Back to sign in
        </Link>
      </div>
    )
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
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3">
          <p className="text-sm text-red-400 text-center">{error}</p>
        </div>
      )}
      <Button type="submit" disabled={loading} className="w-full h-11 text-sm font-semibold mt-1">
        {loading ? 'Sending\u2026' : 'Send reset link'}
      </Button>
      <p className="text-sm text-center text-neutral-500">
        <Link href="/auth/login" className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
          Back to sign in
        </Link>
      </p>
    </form>
  )
}
