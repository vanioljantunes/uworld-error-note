import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/actions/auth'
import { Button } from '@/components/ui/Button'
import { AccountPill } from '@/components/dashboard/AccountPill'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const planLabel = subscription?.plan ?? 'free'
  const rawStatus = subscription?.status ?? 'free'
  const statusLabel = rawStatus === 'free' ? 'Active' : rawStatus

  return (
    <div className="min-h-screen bg-[#0c0c0c]">
      <header className="flex items-center gap-6 px-4 h-12 border-b border-[#2a2a2a] bg-[#111111] shrink-0">
        <a href="/" className="flex items-center gap-2 no-underline">
          <svg width="22" height="22" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="#0d0618"/>
            <defs>
              <linearGradient id="hdrBolt" x1="0.4" y1="0" x2="0.6" y2="1">
                <stop offset="0%" stopColor="#d8b4fe"/>
                <stop offset="50%" stopColor="#a855f7"/>
                <stop offset="100%" stopColor="#6d28d9"/>
              </linearGradient>
            </defs>
            <line x1="2" y1="17" x2="6" y2="17" stroke="#4c1d95" strokeWidth="2" strokeLinecap="round"/>
            <line x1="25" y1="17" x2="30" y2="17" stroke="#4c1d95" strokeWidth="2" strokeLinecap="round"/>
            <polygon points="18,2 7,17 14,17 12,30 23,17 16,17" fill="url(#hdrBolt)"/>
          </svg>
          <span className="text-[15px] font-bold tracking-tight" style={{ background: 'linear-gradient(130deg, #e2c4ff 0%, #a855f7 55%, #7c3aed 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>GapStrike</span>
        </a>
        <div className="flex gap-0.5 bg-[#1a1a1a] rounded-lg p-[3px]">
          <a href="/app" className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[13px] font-semibold text-[#888] hover:text-[#ccc] no-underline transition-all">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            Chat
          </a>
          <a href="/app" className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[13px] font-semibold text-[#888] hover:text-[#ccc] no-underline transition-all">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
            Editor
          </a>
          <a href="/app" className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[13px] font-semibold text-[#888] hover:text-[#ccc] no-underline transition-all">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
            Anki
          </a>
          <span className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[13px] font-semibold text-white bg-[#7c3aed] shadow-[0_1px_4px_rgba(0,0,0,0.3)]">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
            Dashboard
          </span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <AccountPill plan={planLabel} status={statusLabel} />
          <div className="w-px h-4 bg-[#2a2a2a]" />
          <span className="text-xs text-neutral-500 hidden sm:inline">{user.email}</span>
          <form action={logout}>
            <Button type="submit" variant="ghost">
              Logout
            </Button>
          </form>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-10 pb-24">{children}</main>
    </div>
  )
}
