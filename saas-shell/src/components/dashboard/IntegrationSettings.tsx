'use client'

import { useState, useTransition } from 'react'
import { saveIntegrations } from '@/actions/integrations'
import { useSettingsDirty } from './SettingsDirtyProvider'

interface Props {
  initialAnkiUrl: string
  initialVaultPath: string
  initialGitRemote: string
}

type AnkiStatus = 'idle' | 'testing' | 'connected' | 'error'

export function IntegrationSettings({ initialAnkiUrl, initialVaultPath, initialGitRemote }: Props) {
  const { integrationFormRef, setIntegrationsDirty } = useSettingsDirty()
  const [ankiUrl, setAnkiUrl] = useState(initialAnkiUrl)
  const [vaultPath, setVaultPath] = useState(initialVaultPath)
  const [gitRemote, setGitRemote] = useState(initialGitRemote)
  const [ankiStatus, setAnkiStatus] = useState<AnkiStatus>('idle')
  const [showAnkiGuide, setShowAnkiGuide] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const [, startTransition] = useTransition()

  const markDirty = () => setIntegrationsDirty(true)

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
        setSaveMessage({ text: 'Saved', ok: true })
        setIntegrationsDirty(false)
        setTimeout(() => setSaveMessage(null), 3000)
      }
    })
  }

  const ankiBadge =
    ankiStatus === 'testing' ? (
      <span className="text-xs font-medium text-amber-400">Testing...</span>
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
    ) : (
      <span className="text-xs font-medium text-neutral-600 flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-neutral-600 inline-block" />
        Not configured
      </span>
    )

  const inputClass =
    'w-full rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-colors'

  return (
    <form ref={integrationFormRef} action={handleSave}>
      <div className="bg-[#111111] rounded-xl border border-[#2a2a2a] p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-600/10 border border-violet-600/20 flex items-center justify-center shrink-0">
              <IntegrationIcon />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#e2e2e2]">Integrations</p>
              <p className="text-xs text-neutral-500">Connect Anki and Obsidian to your workspace</p>
            </div>
          </div>
          {saveMessage && (
            <span className={`text-xs font-medium ${saveMessage.ok ? 'text-green-400' : 'text-red-400'}`}>
              {saveMessage.text}
            </span>
          )}
        </div>

        {/* === Anki section === */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Anki</p>
            {ankiBadge}
          </div>

          {/* Inline hint — visible when not connected */}
          {ankiStatus !== 'connected' && (
            <div className="rounded-lg bg-violet-600/5 border border-violet-600/10 px-3 py-2.5 space-y-2">
              <p className="text-xs text-neutral-400">
                Requires the <span className="text-neutral-200 font-medium">AnkiConnect</span> add-on.
                Install code: <span className="font-mono text-violet-400">2055492159</span>
              </p>
              <button
                type="button"
                onClick={() => setShowAnkiGuide(!showAnkiGuide)}
                className="text-xs text-violet-400/70 hover:text-violet-400 transition-colors cursor-pointer"
              >
                {showAnkiGuide ? 'Hide setup guide' : 'View full setup guide'}
              </button>
              {showAnkiGuide && (
                <div className="text-xs text-neutral-500 space-y-1.5 pt-1 border-t border-[#2a2a2a]">
                  <p><span className="text-neutral-300">1.</span> Open Anki → Tools → Add-ons → Get Add-ons → paste code <span className="font-mono text-neutral-400">2055492159</span></p>
                  <p><span className="text-neutral-300">2.</span> Restart Anki. AnkiConnect runs on <span className="font-mono text-neutral-400">http://localhost:8765</span></p>
                  <p><span className="text-neutral-300">3.</span> For remote access, add your domain to <span className="font-mono text-neutral-400">webCorsOriginList</span> in AnkiConnect config</p>
                </div>
              )}
            </div>
          )}

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
                onChange={(e) => { setAnkiUrl(e.target.value); markDirty() }}
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
                {ankiStatus === 'testing' ? 'Testing...' : 'Test'}
              </button>
            </div>
          </div>
        </div>

        {/* Divider */}
        <hr className="border-[#2a2a2a]" />

        {/* === Obsidian section === */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Obsidian Vault</p>

          {/* Inline hint — visible when vault path is empty */}
          {!vaultPath && (
            <div className="rounded-lg bg-violet-600/5 border border-violet-600/10 px-3 py-2.5">
              <p className="text-xs text-neutral-400">
                Find your vault path: Open Obsidian → <span className="text-neutral-200">Settings</span> → <span className="text-neutral-200">About</span> → copy the path shown next to &quot;Vault path&quot;
              </p>
            </div>
          )}

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
                onChange={(e) => { setVaultPath(e.target.value); markDirty() }}
                className={`${inputClass} font-mono`}
                placeholder="C:\Users\you\Documents\MyVault"
              />
            </div>
            <div>
              <label htmlFor="obsidian_git_remote" className="text-xs font-medium text-neutral-500 block mb-1.5">
                Git Remote <span className="text-neutral-600 font-normal">(optional)</span>
              </label>
              <input
                id="obsidian_git_remote"
                name="obsidian_git_remote"
                type="text"
                value={gitRemote}
                onChange={(e) => { setGitRemote(e.target.value); markDirty() }}
                className={inputClass}
                placeholder="https://github.com/you/your-vault"
              />
            </div>
          </div>
        </div>
      </div>
    </form>
  )
}

function IntegrationIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11a9 9 0 0 1 9 9" />
      <path d="M4 4a16 16 0 0 1 16 16" />
      <circle cx="5" cy="19" r="1" />
    </svg>
  )
}
