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
      <header className="flex items-center justify-between px-6 py-3 border-b border-[#2a2a2a] bg-[#111111]">
        <span className="text-lg font-bold text-violet-400 tracking-tight">GapStrike</span>
        <div className="flex items-center gap-3">
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
