'use client'

import { useState } from 'react'
import { updatePassword } from '@/actions/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function ResetPasswordForm() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await updatePassword(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <Input
        id="password"
        name="password"
        type="password"
        label="New password"
        placeholder="••••••••"
        required
        minLength={6}
        autoComplete="new-password"
      />
      <Input
        id="confirmPassword"
        name="confirmPassword"
        type="password"
        label="Confirm password"
        placeholder="••••••••"
        required
        minLength={6}
        autoComplete="new-password"
      />
      {error && <p className="text-sm text-red-400 text-center">{error}</p>}
      <Button type="submit" disabled={loading} className="w-full mt-1">
        {loading ? 'Updating…' : 'Update password'}
      </Button>
    </form>
  )
}
