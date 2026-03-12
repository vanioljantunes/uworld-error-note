import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0c0c0c] relative overflow-hidden flex items-center justify-center px-4 py-12">
      {/* Subtle radial glow behind the card */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-violet-600/[0.04] blur-[120px]" />

      <div className="relative w-full max-w-[400px] flex flex-col items-center">
        {/* Logo */}
        <Link
          href="/"
          className="group flex items-center gap-2.5 mb-10 hover:opacity-90 transition-opacity"
        >
          <div className="h-9 w-9 rounded-lg bg-violet-600 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <span className="text-xl font-bold text-[#e2e2e2] tracking-tight">
            GapStrike
          </span>
        </Link>

        {/* Card */}
        <div className="w-full bg-[#111111] rounded-2xl border border-[#2a2a2a] p-8 sm:p-10 shadow-2xl shadow-black/40">
          {children}
        </div>

        {/* Footer */}
        <p className="mt-8 text-xs text-neutral-600 text-center">
          &copy; {new Date().getFullYear()} GapStrike. Master your mistakes.
        </p>
      </div>
    </div>
  )
}
