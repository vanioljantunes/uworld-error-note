import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <>
      <h1 className="text-2xl font-bold text-[#e2e2e2] mb-1">Welcome back</h1>
      <p className="text-sm text-neutral-500 mb-8">Sign in to continue studying</p>
      <LoginForm />
    </>
  )
}
