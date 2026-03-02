import Link from 'next/link'
import { Button } from '@/components/ui/Button'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
        <span className="text-lg font-semibold text-slate-900">GapStrike</span>
        <Link href="/auth/login">
          <Button variant="ghost">Login</Button>
        </Link>
      </header>

      <main className="flex flex-col items-center justify-center min-h-[calc(100vh-65px)] px-4 text-center">
        <h1 className="text-4xl font-bold text-slate-900 sm:text-5xl">
          Diagnose. Learn. Remember.
        </h1>
        <p className="mt-4 text-lg text-slate-600 max-w-md">
          USMLE error analysis, automated. Turn every wrong answer into a
          micro-note you&apos;ll never forget.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/auth/register">
            <Button>Get Started</Button>
          </Link>
          <Link href="/auth/login">
            <Button variant="ghost">Login</Button>
          </Link>
        </div>
      </main>
    </div>
  )
}
