import { RegisterForm } from '@/components/auth/RegisterForm'

export default function RegisterPage() {
  return (
    <>
      <h1 className="text-2xl font-bold text-[var(--text)]">Create account</h1>
      <p className="text-sm text-[var(--text-muted)] mt-1.5 mb-10">Start turning mistakes into knowledge</p>
      <RegisterForm />
    </>
  )
}
