import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-bold text-[var(--text)]">Reset password</h1>
      <p className="text-sm text-[var(--text-muted)] mt-1.5 mb-10">Enter your email and we&apos;ll send you a reset link.</p>
      <ForgotPasswordForm />
    </>
  )
}
