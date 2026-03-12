import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-bold text-[#e2e2e2] mb-1">Set new password</h1>
      <p className="text-sm text-neutral-500 mb-8">Enter your new password below.</p>
      <ResetPasswordForm />
    </>
  )
}
