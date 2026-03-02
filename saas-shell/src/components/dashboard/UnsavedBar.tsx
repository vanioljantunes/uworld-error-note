'use client'

import { useSettingsDirty } from './SettingsDirtyProvider'
import { useRouter } from 'next/navigation'

export function UnsavedBar() {
  const { llmDirty, integrationsDirty, llmFormRef, integrationFormRef } = useSettingsDirty()
  const router = useRouter()
  const anyDirty = llmDirty || integrationsDirty

  if (!anyDirty) return null

  const sections: string[] = []
  if (integrationsDirty) sections.push('Integrations')
  if (llmDirty) sections.push('LLM')

  function handleSaveAll() {
    if (integrationsDirty && integrationFormRef.current) {
      integrationFormRef.current.requestSubmit()
    }
    if (llmDirty && llmFormRef.current) {
      llmFormRef.current.requestSubmit()
    }
  }

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-[#111111]/95 backdrop-blur-sm border-t border-[#2a2a2a]">
      <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
        <p className="text-xs text-neutral-400 truncate">
          Unsaved changes in <span className="text-neutral-200 font-medium">{sections.join(' & ')}</span>
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => router.refresh()}
            type="button"
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#3a3a3a] bg-[#1a1a1a] text-neutral-300 hover:bg-[#212121] transition-colors cursor-pointer"
          >
            Discard
          </button>
          <button
            onClick={handleSaveAll}
            type="button"
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors cursor-pointer"
          >
            Save All
          </button>
        </div>
      </div>
    </div>
  )
}
