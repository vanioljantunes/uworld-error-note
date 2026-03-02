'use client'

import { useState, useTransition } from 'react'
import { saveLLMSettings, type LLMProvider, type LLMSettings } from '@/actions/integrations'

const PROVIDER_META: Record<LLMProvider, { label: string; placeholder: string }> = {
  openai: { label: 'OpenAI', placeholder: 'sk-...' },
  anthropic: { label: 'Anthropic', placeholder: 'sk-ant-...' },
  google: { label: 'Google', placeholder: 'AIza...' },
}

const MODEL_OPTIONS: Record<LLMProvider, { primary: string[]; economy: string[] }> = {
  openai: {
    primary: ['gpt-4o', 'o3-mini'],
    economy: ['gpt-4o-mini', 'gpt-4o'],
  },
  anthropic: {
    primary: ['claude-sonnet-4-20250514'],
    economy: ['claude-sonnet-4-20250514'],
  },
  google: {
    primary: ['gemini-2.0-flash'],
    economy: ['gemini-2.0-flash'],
  },
}

interface Props {
  initial: LLMSettings
}

export function LLMSettings({ initial }: Props) {
  const [provider, setProvider] = useState<LLMProvider>(initial.provider)
  const [primaryModel, setPrimaryModel] = useState(initial.primaryModel)
  const [economyModel, setEconomyModel] = useState(initial.economyModel)
  const [openaiKey, setOpenaiKey] = useState(initial.maskedOpenaiKey ?? '')
  const [anthropicKey, setAnthropicKey] = useState(initial.maskedAnthropicKey ?? '')
  const [googleKey, setGoogleKey] = useState(initial.maskedGoogleKey ?? '')
  const [saveMessage, setSaveMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const [isPending, startTransition] = useTransition()

  // When provider changes, auto-set default models if empty
  function handleProviderChange(p: LLMProvider) {
    setProvider(p)
    const opts = MODEL_OPTIONS[p]
    setPrimaryModel(opts.primary[0])
    setEconomyModel(opts.economy[0])
  }

  function handleSave(formData: FormData) {
    setSaveMessage(null)
    startTransition(async () => {
      const result = await saveLLMSettings(formData)
      if (result?.error) {
        setSaveMessage({ text: result.error, ok: false })
      } else {
        setSaveMessage({ text: 'LLM settings saved.', ok: true })
        setTimeout(() => setSaveMessage(null), 3000)
      }
    })
  }

  function keyForProvider(p: LLMProvider): string {
    if (p === 'openai') return openaiKey
    if (p === 'anthropic') return anthropicKey
    return googleKey
  }

  function setKeyForProvider(p: LLMProvider, v: string) {
    if (p === 'openai') setOpenaiKey(v)
    else if (p === 'anthropic') setAnthropicKey(v)
    else setGoogleKey(v)
  }

  const inputClass =
    'w-full rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-colors'

  const selectClass =
    'w-full rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-colors appearance-none cursor-pointer'

  return (
    <form action={handleSave} className="space-y-3">
      {/* Provider selector */}
      <div className="bg-[#111111] rounded-xl border border-[#2a2a2a] p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-600/10 border border-violet-600/20 flex items-center justify-center shrink-0">
            <LLMIcon />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#e2e2e2]">LLM Provider</p>
            <p className="text-xs text-neutral-500">Select your AI provider and enter your API key</p>
          </div>
        </div>

        {/* Provider radio cards */}
        <input type="hidden" name="llm_provider" value={provider} />
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(PROVIDER_META) as LLMProvider[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handleProviderChange(p)}
              className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                provider === p
                  ? 'border-violet-500/50 bg-violet-600/10 text-violet-400'
                  : 'border-[#2a2a2a] bg-[#1a1a1a] text-neutral-400 hover:border-[#3a3a3a] hover:text-neutral-300'
              }`}
            >
              {PROVIDER_META[p].label}
            </button>
          ))}
        </div>

        {/* API key for each provider */}
        {(Object.keys(PROVIDER_META) as LLMProvider[]).map((p) => (
          <div key={p} className={p === provider ? '' : 'hidden'}>
            <label htmlFor={`${p}_key`} className="text-xs font-medium text-neutral-500 block mb-1.5">
              {PROVIDER_META[p].label} API Key
              {keyForProvider(p).startsWith('****') && (
                <span className="ml-2 text-green-400/70 font-normal">Saved</span>
              )}
            </label>
            <input
              id={`${p}_key`}
              name={`${p}_key`}
              type="password"
              value={keyForProvider(p)}
              onChange={(e) => setKeyForProvider(p, e.target.value)}
              onFocus={() => {
                if (keyForProvider(p).startsWith('****')) setKeyForProvider(p, '')
              }}
              className={inputClass}
              placeholder={PROVIDER_META[p].placeholder}
              autoComplete="off"
            />
          </div>
        ))}

        <p className="text-xs text-neutral-600">
          Your key is encrypted with AES-256-GCM before storage. Only the last 4 characters are visible after saving.
        </p>
      </div>

      {/* Model selection */}
      <div className="bg-[#111111] rounded-xl border border-[#2a2a2a] p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-600/10 border border-violet-600/20 flex items-center justify-center shrink-0">
            <ModelIcon />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#e2e2e2]">Model Selection</p>
            <p className="text-xs text-neutral-500">Choose models for primary and economy tasks</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="primary_model" className="text-xs font-medium text-neutral-500 block mb-1.5">
              Primary Model
              <span className="text-neutral-600 font-normal ml-1">(complex tasks)</span>
            </label>
            <select
              id="primary_model"
              name="primary_model"
              value={primaryModel}
              onChange={(e) => setPrimaryModel(e.target.value)}
              className={selectClass}
            >
              <option value="">Select a model</option>
              {MODEL_OPTIONS[provider].primary.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="economy_model" className="text-xs font-medium text-neutral-500 block mb-1.5">
              Economy Model
              <span className="text-neutral-600 font-normal ml-1">(routine tasks)</span>
            </label>
            <select
              id="economy_model"
              name="economy_model"
              value={economyModel}
              onChange={(e) => setEconomyModel(e.target.value)}
              className={selectClass}
            >
              <option value="">Select a model</option>
              {MODEL_OPTIONS[provider].economy.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-xs text-neutral-600">
          <span className="text-neutral-400 font-medium">Primary</span> is used for note composition and synthesis.{' '}
          <span className="text-neutral-400 font-medium">Economy</span> handles extraction and question generation.
        </p>
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
          {isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}

function LLMIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  )
}

function ModelIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
