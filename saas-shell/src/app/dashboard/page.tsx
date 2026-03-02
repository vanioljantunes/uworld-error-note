import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/Button'
import { IntegrationSettings } from '@/components/dashboard/IntegrationSettings'
import { LLMSettings } from '@/components/dashboard/LLMSettings'
import { getLLMSettings } from '@/actions/integrations'

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

  const llmSettings = await getLLMSettings()

  const planLabel = subscription?.plan ?? 'free'
  const rawStatus = subscription?.status ?? 'free'
  const statusLabel = rawStatus === 'free' ? 'Active' : rawStatus
  const statusColor =
    statusLabel === 'Active' || statusLabel === 'active'
      ? 'text-green-400'
      : statusLabel === 'past_due'
        ? 'text-amber-400'
        : 'text-red-400'

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#e2e2e2] mb-1">
            Welcome back{profile?.full_name ? `, ${profile.full_name}` : ''}
          </h1>
          <p className="text-sm text-neutral-500">Manage your account and integrations.</p>
        </div>
        <Link href="/app">
          <Button>Launch App</Button>
        </Link>
      </div>

      {/* Account */}
      <section>
        <p className="text-xs font-semibold text-neutral-600 uppercase tracking-widest mb-3">Account</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-[#111111] rounded-xl border border-[#2a2a2a] p-6">
            <p className="text-xs font-medium text-neutral-500 mb-1">Plan</p>
            <p className="text-xl font-bold text-[#e2e2e2] capitalize">{planLabel}</p>
          </div>
          <div className="bg-[#111111] rounded-xl border border-[#2a2a2a] p-6">
            <p className="text-xs font-medium text-neutral-500 mb-1">Status</p>
            <p className={`text-xl font-bold capitalize ${statusColor}`}>{statusLabel}</p>
          </div>
        </div>
      </section>

      {/* LLM Configuration */}
      <section>
        <p className="text-xs font-semibold text-neutral-600 uppercase tracking-widest mb-3">LLM Configuration</p>
        <LLMSettings initial={llmSettings} />
      </section>

      {/* Integrations */}
      <section>
        <p className="text-xs font-semibold text-neutral-600 uppercase tracking-widest mb-3">Integrations</p>
        <IntegrationSettings
          initialAnkiUrl={profile?.anki_connect_url ?? 'http://localhost:8765'}
          initialVaultPath={profile?.obsidian_vault_path ?? ''}
          initialGitRemote={profile?.obsidian_git_remote ?? ''}
        />
      </section>
    </div>
  )
}
