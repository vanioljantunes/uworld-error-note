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
      <div className="flex flex-col gap-4 text-center">
        <p className="text-sm text-neutral-300">Check your email for a password reset link.</p>
        <Link href="/auth/login" className="text-sm text-violet-400 hover:text-violet-300 transition-colors">
          Back to login
        </Link>
      </div>
    )
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
      {error && <p className="text-sm text-red-400 text-center">{error}</p>}
      <Button type="submit" disabled={loading} className="w-full mt-1">
        {loading ? 'Sending…' : 'Send reset link'}
      </Button>
      <p className="text-sm text-center text-neutral-500">
        <Link href="/auth/login" className="text-violet-400 hover:text-violet-300 transition-colors">
          Back to login
        </Link>
      </p>
    </form>
  )
}
