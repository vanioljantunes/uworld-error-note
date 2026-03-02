'use client'

import { useState, useTransition, useEffect } from 'react'
import { saveLLMSettings, type LLMProvider, type LLMSettings } from '@/actions/integrations'
import { useSettingsDirty } from './SettingsDirtyProvider'

const PROVIDERS: LLMProvider[] = ['openai', 'anthropic', 'google']

const PROVIDER_META: Record<LLMProvider, { label: string; placeholder: string }> = {
  openai: { label: 'OpenAI', placeholder: 'sk-proj-abc123...' },
  anthropic: { label: 'Anthropic', placeholder: 'sk-ant-api03-abc123...' },
  google: { label: 'Google', placeholder: 'AIzaSyA...' },
}

const MODEL_OPTIONS: Record<LLMProvider, { primary: string[]; economy: string[] }> = {
  openai: { primary: ['gpt-4o', 'o3-mini'], economy: ['gpt-4o-mini', 'gpt-4o'] },
  anthropic: { primary: ['claude-sonnet-4-20250514'], economy: ['claude-sonnet-4-20250514'] },
  google: { primary: ['gemini-2.0-flash'], economy: ['gemini-2.0-flash'] },
}

interface Props {
  initial: LLMSettings
}

export function LLMSettings({ initial }: Props) {
  const { llmFormRef, setLlmDirty } = useSettingsDirty()
  const [provider, setProvider] = useState<LLMProvider>(initial.provider)
  const [primaryModel, setPrimaryModel] = useState(initial.primaryModel)
  const [economyModel, setEconomyModel] = useState(initial.economyModel)
  const [openaiKey, setOpenaiKey] = useState(initial.maskedOpenaiKey ?? '')
  const [anthropicKey, setAnthropicKey] = useState(initial.maskedAnthropicKey ?? '')
  const [googleKey, setGoogleKey] = useState(initial.maskedGoogleKey ?? '')
  const [saveMessage, setSaveMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const [, startTransition] = useTransition()

  // Track dirty state
  const markDirty = () => setLlmDirty(true)

  function handleProviderChange(p: LLMProvider) {
    setProvider(p)
    setPrimaryModel(MODEL_OPTIONS[p].primary[0])
    setEconomyModel(MODEL_OPTIONS[p].economy[0])
    markDirty()
  }

  function handleSave(formData: FormData) {
    setSaveMessage(null)
    startTransition(async () => {
      const result = await saveLLMSettings(formData)
      if (result?.error) {
        setSaveMessage({ text: result.error, ok: false })
      } else {
        setSaveMessage({ text: 'Saved', ok: true })
        setLlmDirty(false)
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
    markDirty()
  }

  function maskedKeyForProvider(p: LLMProvider): string | null {
    if (p === 'openai') return initial.maskedOpenaiKey
    if (p === 'anthropic') return initial.maskedAnthropicKey
    return initial.maskedGoogleKey
  }

  // Build other-providers summary
  const otherProviders = PROVIDERS.filter(p => p !== provider)

  const inputClass =
    'w-full rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-colors'
  const selectClass =
    'w-full rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-colors appearance-none cursor-pointer'

  return (
    <form ref={llmFormRef} action={handleSave}>
      <div className="bg-[#111111] rounded-xl border border-[#2a2a2a] p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-600/10 border border-violet-600/20 flex items-center justify-center shrink-0">
              <LLMIcon />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#e2e2e2]">LLM Configuration</p>
              <p className="text-xs text-neutral-500">Provider, API key, and model selection</p>
            </div>
          </div>
          {saveMessage && (
            <span className={`text-xs font-medium ${saveMessage.ok ? 'text-green-400' : 'text-red-400'}`}>
              {saveMessage.text}
            </span>
          )}
        </div>

        {/* Provider tab bar */}
        <input type="hidden" name="llm_provider" value={provider} />
        <div className="flex rounded-lg border border-[#2a2a2a] overflow-hidden" role="tablist">
          {PROVIDERS.map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={provider === p}
              onClick={() => handleProviderChange(p)}
              className={`flex-1 px-3 py-2 text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                provider === p
                  ? 'bg-violet-600/10 text-violet-400 border-b-2 border-violet-500'
                  : 'bg-[#1a1a1a] text-neutral-400 hover:text-neutral-300 hover:bg-[#212121]'
              }`}
            >
              {PROVIDER_META[p].label}
            </button>
          ))}
        </div>

        {/* API key for active provider */}
        {PROVIDERS.map((p) => (
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

        {/* Model selection — inline */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="primary_model" className="text-xs font-medium text-neutral-500 block mb-1.5">
              Primary Model <span className="text-neutral-600 font-normal">(complex)</span>
            </label>
            <select
              id="primary_model"
              name="primary_model"
              value={primaryModel}
              onChange={(e) => { setPrimaryModel(e.target.value); markDirty() }}
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
              Economy Model <span className="text-neutral-600 font-normal">(routine)</span>
            </label>
            <select
              id="economy_model"
              name="economy_model"
              value={economyModel}
              onChange={(e) => { setEconomyModel(e.target.value); markDirty() }}
              className={selectClass}
            >
              <option value="">Select a model</option>
              {MODEL_OPTIONS[provider].economy.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Other providers summary */}
        <div className="flex items-center gap-4 pt-1">
          {otherProviders.map((p) => {
            const masked = maskedKeyForProvider(p)
            return (
              <span key={p} className="text-xs text-neutral-600">
                {PROVIDER_META[p].label}:{' '}
                <span className={masked ? 'text-neutral-400' : 'text-neutral-600'}>
                  {masked ?? 'not set'}
                </span>
              </span>
            )
          })}
          <span className="text-xs text-neutral-700 ml-auto">AES-256-GCM encrypted</span>
        </div>
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
