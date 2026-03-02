import Link from 'next/link'
import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#0c0c0c] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="block text-xl font-bold text-violet-400 tracking-tight mb-8 text-center hover:text-violet-300 transition-colors">GapStrike</Link>
        <div className="bg-[#111111] rounded-xl border border-[#2a2a2a] p-8">
          <h1 className="text-xl font-bold text-[#e2e2e2] mb-6">Welcome back</h1>
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
