'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { encrypt, decrypt, maskKey } from '@/lib/crypto'

export async function saveIntegrations(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated.' }

  const { error } = await supabase
    .from('profiles')
    .update({
      anki_connect_url: (formData.get('anki_connect_url') as string) || null,
      obsidian_vault_path: (formData.get('obsidian_vault_path') as string) || null,
      obsidian_git_remote: (formData.get('obsidian_git_remote') as string) || null,
    })
    .eq('id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/app/integrations')
  return { error: null }
}

export type LLMProvider = 'openai' | 'anthropic' | 'google'

export interface LLMSettings {
  provider: LLMProvider
  primaryModel: string
  economyModel: string
  maskedOpenaiKey: string | null
  maskedAnthropicKey: string | null
  maskedGoogleKey: string | null
}

export async function getLLMSettings(): Promise<LLMSettings> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      provider: 'openai',
      primaryModel: '',
      economyModel: '',
      maskedOpenaiKey: null,
      maskedAnthropicKey: null,
      maskedGoogleKey: null,
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('encrypted_openai_key, encrypted_anthropic_key, encrypted_google_key, llm_provider, primary_model, economy_model')
    .eq('id', user.id)
    .single()

  function safeMask(encrypted: string | null): string | null {
    if (!encrypted) return null
    try {
      return maskKey(decrypt(encrypted))
    } catch {
      return '****err'
    }
  }

  return {
    provider: (profile?.llm_provider as LLMProvider) ?? 'openai',
    primaryModel: profile?.primary_model ?? '',
    economyModel: profile?.economy_model ?? '',
    maskedOpenaiKey: safeMask(profile?.encrypted_openai_key ?? null),
    maskedAnthropicKey: safeMask(profile?.encrypted_anthropic_key ?? null),
    maskedGoogleKey: safeMask(profile?.encrypted_google_key ?? null),
  }
}

export async function saveLLMSettings(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated.' }

  const provider = formData.get('llm_provider') as LLMProvider
  const primaryModel = (formData.get('primary_model') as string) || null
  const economyModel = (formData.get('economy_model') as string) || null

  const openaiKey = formData.get('openai_key') as string
  const anthropicKey = formData.get('anthropic_key') as string
  const googleKey = formData.get('google_key') as string

  // Fetch existing encrypted keys to preserve unchanged ones
  const { data: existing } = await supabase
    .from('profiles')
    .select('encrypted_openai_key, encrypted_anthropic_key, encrypted_google_key')
    .eq('id', user.id)
    .single()

  function resolveKey(newValue: string, existingEncrypted: string | null): string | null {
    if (!newValue || newValue.startsWith('****')) return existingEncrypted ?? null
    try {
      return encrypt(newValue)
    } catch (e) {
      throw new Error(`Encryption failed: ${e instanceof Error ? e.message : 'unknown error'}`)
    }
  }

  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        llm_provider: provider,
        primary_model: primaryModel,
        economy_model: economyModel,
        encrypted_openai_key: resolveKey(openaiKey, existing?.encrypted_openai_key ?? null),
        encrypted_anthropic_key: resolveKey(anthropicKey, existing?.encrypted_anthropic_key ?? null),
        encrypted_google_key: resolveKey(googleKey, existing?.encrypted_google_key ?? null),
      })
      .eq('id', user.id)

    if (error) return { error: error.message }

    revalidatePath('/app/integrations')
    return { error: null }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to save LLM settings.' }
  }
}
