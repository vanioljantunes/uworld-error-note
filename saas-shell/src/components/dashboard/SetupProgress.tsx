import { Fragment } from 'react'

interface SetupProgressProps {
  hasIntegrations: boolean
  hasLLM: boolean
}

export function SetupProgress({ hasIntegrations, hasLLM }: SetupProgressProps) {
  if (hasIntegrations && hasLLM) return null

  const steps = [
    { label: 'Connect Integrations', done: hasIntegrations },
    { label: 'Configure LLM', done: hasLLM },
    { label: 'Launch App', done: hasIntegrations && hasLLM },
  ]

  return (
    <div className="bg-[#111111] rounded-xl border border-[#2a2a2a] px-6 py-4">
      <div className="flex items-center">
        {steps.map((step, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <div className={`flex-1 h-px mx-3 ${steps[i - 1].done ? 'bg-violet-500/50' : 'bg-[#2a2a2a]'}`} />
            )}
            <div className="flex items-center gap-2 shrink-0">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step.done
                  ? 'bg-violet-600 text-white'
                  : i === 0 || steps[i - 1].done
                    ? 'border-2 border-violet-500/50 text-violet-400'
                    : 'border border-[#3a3a3a] text-neutral-600'
              }`}>
                {step.done ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span className={`text-xs font-medium hidden sm:inline ${
                step.done ? 'text-neutral-300' : i === 0 || steps[i - 1].done ? 'text-neutral-300' : 'text-neutral-600'
              }`}>
                {step.label}
              </span>
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  )
}
