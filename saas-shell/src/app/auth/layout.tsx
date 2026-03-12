import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg)] relative overflow-hidden flex items-center justify-center px-6 py-16">
      {/* Dot grid background from design system */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Very subtle top glow — barely visible */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[var(--accent-glow)] blur-[160px] opacity-30" />

      <div className="relative w-full max-w-[420px] flex flex-col items-center">
        {/* Logo */}
        <Link
          href="/"
          className="group flex items-center gap-3 mb-12 hover:opacity-90 transition-opacity"
        >
          <div className="h-10 w-10 rounded-xl bg-[var(--accent)] flex items-center justify-center shadow-lg shadow-[var(--accent-glow)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <span className="text-2xl font-bold text-[var(--text)] tracking-tight">
            GapStrike
          </span>
        </Link>

        {/* Card */}
        <div className="w-full bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] px-10 py-10 sm:px-12 sm:py-12">
          {children}
        </div>

        {/* Footer */}
        <p className="mt-10 text-xs text-[var(--text-subtle)] text-center tracking-wide">
          &copy; {new Date().getFullYear()} GapStrike
        </p>
      </div>
    </div>
  )
}
