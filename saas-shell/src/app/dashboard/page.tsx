import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/Button'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single()

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user!.id)
    .single()

  const status = subscription?.status === 'free' ? 'Active' : (subscription?.status ?? 'Active')

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Welcome back{profile?.full_name ? `, ${profile.full_name}` : ''}
          </h1>
          <p className="text-slate-500">Here&apos;s your account overview.</p>
        </div>
        <Link href="https://usmle-error-agent.vercel.app" target="_blank">
          <Button>Launch App</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm font-medium text-slate-500">Plan</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 capitalize">
            {subscription?.plan ?? 'Free'}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm font-medium text-slate-500">Status</p>
          <p className="mt-1 text-2xl font-bold text-indigo-600 capitalize">
            {status}
          </p>
        </div>
      </div>
    </div>
  )
}
