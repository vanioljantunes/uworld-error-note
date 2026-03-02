'use client'

import { useState, useTransition } from 'react'
import { saveIntegrations } from '@/actions/integrations'

interface Props {
  initialAnkiUrl: string
  initialVaultPath: string
  initialGitRemote: string
}

type AnkiStatus = 'idle' | 'testing' | 'connected' | 'error'

export function IntegrationSettings({ initialAnkiUrl, initialVaultPath, initialGitRemote }: Props) {
  const [ankiUrl, setAnkiUrl] = useState(initialAnkiUrl)
  const [vaultPath, setVaultPath] = useState(initialVaultPath)
  const [gitRemote, setGitRemote] = useState(initialGitRemote)
  const [ankiStatus, setAnkiStatus] = useState<AnkiStatus>('idle')
  const [saveMessage, setSaveMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const [isPending, startTransition] = useTransition()

  async function testAnki() {
    setAnkiStatus('testing')
    try {
      const res = await fetch(ankiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'version', version: 6 }),
        signal: AbortSignal.timeout(4000),
      })
      const data = await res.json()
      setAnkiStatus(data.error === null ? 'connected' : 'error')
    } catch {
      setAnkiStatus('error')
    }
  }

  function handleSave(formData: FormData) {
    setSaveMessage(null)
    startTransition(async () => {
      const result = await saveIntegrations(formData)
      if (result?.error) {
        setSaveMessage({ text: result.error, ok: false })
      } else {
        setSaveMessage({ text: 'Settings saved.', ok: true })
        setTimeout(() => setSaveMessage(null), 3000)
      }
    })
  }

  const ankiBadge =
    ankiStatus === 'testing' ? (
      <span className="text-xs font-medium text-amber-400">Testing…</span>
    ) : ankiStatus === 'connected' ? (
      <span className="text-xs font-medium text-green-400 flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
        Connected
      </span>
    ) : ankiStatus === 'error' ? (
      <span className="text-xs font-medium text-red-400 flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
        Not reachable
      </span>
    ) : null

  const inputClass =
    'w-full rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-colors'

  return (
    <form action={handleSave} className="space-y-3">
      {/* Anki card */}
      <div className="bg-[#111111] rounded-xl border border-[#2a2a2a] p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-600/10 border border-violet-600/20 flex items-center justify-center shrink-0">
            <AnkiIcon />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#e2e2e2]">Anki</p>
            <p className="text-xs text-neutral-500">Connect via AnkiConnect running locally</p>
          </div>
          {ankiBadge}
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <label htmlFor="anki_connect_url" className="text-xs font-medium text-neutral-500 block mb-1.5">
              AnkiConnect URL
            </label>
            <input
              id="anki_connect_url"
              name="anki_connect_url"
              type="text"
              value={ankiUrl}
              onChange={(e) => setAnkiUrl(e.target.value)}
              className={inputClass}
              placeholder="http://localhost:8765"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={testAnki}
              disabled={ankiStatus === 'testing'}
              className="px-3 py-2 text-sm font-medium rounded-lg border border-[#3a3a3a] bg-[#1a1a1a] text-neutral-300 hover:bg-[#212121] hover:border-[#4a4a4a] transition-colors disabled:opacity-50 cursor-pointer"
            >
              {ankiStatus === 'testing' ? 'Testing…' : 'Test'}
            </button>
          </div>
        </div>

        <p className="text-xs text-neutral-600">
          Anki must be open with the{' '}
          <span className="text-neutral-400 font-medium">AnkiConnect</span> add-on (code 2055492777) installed.
          If connecting from a non-localhost origin, add your domain to AnkiConnect&apos;s{' '}
          <span className="font-mono text-neutral-400">webCorsOriginList</span>.
        </p>
      </div>

      {/* Obsidian card */}
      <div className="bg-[#111111] rounded-xl border border-[#2a2a2a] p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-600/10 border border-violet-600/20 flex items-center justify-center shrink-0">
            <ObsidianIcon />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#e2e2e2]">Obsidian Vault</p>
            <p className="text-xs text-neutral-500">Link your local vault with optional git sync</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor="obsidian_vault_path" className="text-xs font-medium text-neutral-500 block mb-1.5">
              Vault Path
            </label>
            <input
              id="obsidian_vault_path"
              name="obsidian_vault_path"
              type="text"
              value={vaultPath}
              onChange={(e) => setVaultPath(e.target.value)}
              className={`${inputClass} font-mono`}
              placeholder="C:\Users\you\Documents\MyVault"
            />
          </div>
          <div>
            <label htmlFor="obsidian_git_remote" className="text-xs font-medium text-neutral-500 block mb-1.5">
              Git Remote{' '}
              <span className="text-neutral-600 font-normal">(optional — for sync)</span>
            </label>
            <input
              id="obsidian_git_remote"
              name="obsidian_git_remote"
              type="text"
              value={gitRemote}
              onChange={(e) => setGitRemote(e.target.value)}
              className={inputClass}
              placeholder="https://github.com/you/your-vault"
            />
          </div>
        </div>
      </div>

      {/* Save row */}
      <div className="flex items-center justify-between pt-1">
        {saveMessage ? (
          <p className={`text-xs ${saveMessage.ok ? 'text-green-400' : 'text-red-400'}`}>
            {saveMessage.text}
          </p>
        ) : (
          <span />
        )}
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}

function AnkiIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M8 12h8M12 8v8" />
    </svg>
  )
}

function ObsidianIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 19 8 19 16 12 22 5 16 5 8 12 2" />
      <line x1="12" y1="2" x2="12" y2="22" />
      <line x1="5" y1="8" x2="19" y2="8" />
      <line x1="5" y1="16" x2="19" y2="16" />
    </svg>
  )
}
