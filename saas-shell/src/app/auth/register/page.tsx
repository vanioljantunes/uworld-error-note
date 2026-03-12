import { RegisterForm } from '@/components/auth/RegisterForm'

export default function RegisterPage() {
  return (
    <>
      <h1 className="text-2xl font-bold text-[#e2e2e2] mb-1">Create account</h1>
      <p className="text-sm text-neutral-500 mb-8">Start turning mistakes into knowledge</p>
      <RegisterForm />
    </>
  )
}
