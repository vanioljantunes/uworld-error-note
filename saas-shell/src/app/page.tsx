import Link from 'next/link'
import { Button } from '@/components/ui/Button'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0c0c0c]">
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a] bg-[#111111]">
        <span className="text-lg font-bold text-violet-400 tracking-tight">GapStrike</span>
        <Link href="/auth/login">
          <Button variant="ghost">Login</Button>
        </Link>
      </header>

      <main className="flex flex-col items-center justify-center min-h-[calc(100vh-65px)] px-4 text-center">
        <h1 className="text-4xl font-bold text-[#e2e2e2] sm:text-5xl tracking-tight">
          Diagnose. Learn. Remember.
        </h1>
        <p className="mt-4 text-lg text-neutral-500 max-w-md leading-relaxed">
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
