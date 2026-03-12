import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen relative overflow-hidden flex items-center justify-center"
      style={{ background: '#0c0c0c', padding: '64px 24px' }}
    >
      {/* Dot grid background from design system */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative w-full flex flex-col items-center" style={{ maxWidth: 420 }}>
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-3 hover:opacity-90 transition-opacity"
          style={{ marginBottom: 48 }}
        >
          <div
            className="flex items-center justify-center"
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: '#7c3aed',
              boxShadow: '0 0 24px rgba(124, 58, 237, 0.3)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <span className="text-2xl font-bold tracking-tight" style={{ color: '#e2e2e2' }}>
            GapStrike
          </span>
        </Link>

        {/* Card */}
        <div
          className="w-full"
          style={{
            background: '#111111',
            borderRadius: 16,
            border: '1px solid #2a2a2a',
            padding: '48px 48px',
          }}
        >
          {children}
        </div>

        {/* Footer */}
        <p
          className="text-center"
          style={{ marginTop: 40, fontSize: 12, color: '#444444', letterSpacing: '0.05em' }}
        >
          &copy; {new Date().getFullYear()} GapStrike
        </p>
      </div>
    </div>
  )
}
