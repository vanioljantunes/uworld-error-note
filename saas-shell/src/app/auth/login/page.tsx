import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <>
      <h1 className="text-2xl font-bold text-[var(--text)]">Welcome back</h1>
      <p className="text-sm text-[var(--text-muted)] mt-1.5 mb-10">Sign in to continue studying</p>
      <LoginForm />
    </>
  )
}
