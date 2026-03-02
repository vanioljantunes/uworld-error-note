'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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

  revalidatePath('/dashboard')
  return { error: null }
}
