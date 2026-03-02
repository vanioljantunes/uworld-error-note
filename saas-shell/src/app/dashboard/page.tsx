import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/Button'
import { IntegrationSettings } from '@/components/dashboard/IntegrationSettings'
import { LLMSettings } from '@/components/dashboard/LLMSettings'
import { SetupProgress } from '@/components/dashboard/SetupProgress'
import { SettingsDirtyProvider } from '@/components/dashboard/SettingsDirtyProvider'
import { UnsavedBar } from '@/components/dashboard/UnsavedBar'
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

  const llmSettings = await getLLMSettings()

  const hasIntegrations = !!(profile?.anki_connect_url || profile?.obsidian_vault_path)
  const hasLLM = !!(llmSettings.maskedOpenaiKey || llmSettings.maskedAnthropicKey || llmSettings.maskedGoogleKey)

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#e2e2e2] mb-1">
            Welcome back{profile?.full_name ? `, ${profile.full_name}` : ''}
          </h1>
          <p className="text-sm text-neutral-500">Manage your integrations and AI settings.</p>
        </div>
        <Link href="/app">
          <Button>Launch App</Button>
        </Link>
      </div>

      {/* Setup progress — first-run only */}
      <SetupProgress hasIntegrations={hasIntegrations} hasLLM={hasLLM} />

      {/* Settings with dirty tracking */}
      <SettingsDirtyProvider>
        <div className="space-y-6">
          <IntegrationSettings
            initialAnkiUrl={profile?.anki_connect_url ?? 'http://localhost:8765'}
            initialVaultPath={profile?.obsidian_vault_path ?? ''}
            initialGitRemote={profile?.obsidian_git_remote ?? ''}
          />
          <LLMSettings initial={llmSettings} />
        </div>
        <UnsavedBar />
      </SettingsDirtyProvider>
    </div>
  )
}
