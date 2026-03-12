import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-bold text-[#e2e2e2] mb-1">Reset password</h1>
      <p className="text-sm text-neutral-500 mb-8">Enter your email and we&apos;ll send you a reset link.</p>
      <ForgotPasswordForm />
    </>
  )
}
