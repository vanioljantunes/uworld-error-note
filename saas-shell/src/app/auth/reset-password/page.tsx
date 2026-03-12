import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-bold text-[var(--text)]">Set new password</h1>
      <p className="text-sm text-[var(--text-muted)] mt-1.5 mb-10">Enter your new password below.</p>
      <ResetPasswordForm />
    </>
  )
}
