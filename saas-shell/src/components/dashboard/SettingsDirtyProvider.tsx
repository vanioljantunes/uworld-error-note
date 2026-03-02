'use client'

import { createContext, useContext, useState, useRef, type ReactNode, type RefObject } from 'react'

interface SettingsDirtyContextValue {
  llmDirty: boolean
  integrationsDirty: boolean
  setLlmDirty: (v: boolean) => void
  setIntegrationsDirty: (v: boolean) => void
  llmFormRef: RefObject<HTMLFormElement | null>
  integrationFormRef: RefObject<HTMLFormElement | null>
}

const SettingsDirtyContext = createContext<SettingsDirtyContextValue | null>(null)

export function useSettingsDirty() {
  const ctx = useContext(SettingsDirtyContext)
  if (!ctx) throw new Error('useSettingsDirty must be used within SettingsDirtyProvider')
  return ctx
}

export function SettingsDirtyProvider({ children }: { children: ReactNode }) {
  const [llmDirty, setLlmDirty] = useState(false)
  const [integrationsDirty, setIntegrationsDirty] = useState(false)
  const llmFormRef = useRef<HTMLFormElement | null>(null)
  const integrationFormRef = useRef<HTMLFormElement | null>(null)

  return (
    <SettingsDirtyContext.Provider value={{
      llmDirty, integrationsDirty,
      setLlmDirty, setIntegrationsDirty,
      llmFormRef, integrationFormRef,
    }}>
      {children}
    </SettingsDirtyContext.Provider>
  )
}
