interface AccountPillProps {
  plan: string
  status: string
}

export function AccountPill({ plan, status }: AccountPillProps) {
  const statusColor =
    status === 'Active' || status === 'active'
      ? 'text-green-400 bg-green-400/10 border-green-400/20'
      : status === 'past_due'
        ? 'text-amber-400 bg-amber-400/10 border-amber-400/20'
        : 'text-red-400 bg-red-400/10 border-red-400/20'

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-neutral-400 bg-[#1a1a1a] border border-[#2a2a2a] rounded-full px-2.5 py-0.5 capitalize">
        {plan}
      </span>
      <span className={`text-xs font-medium rounded-full px-2.5 py-0.5 border ${statusColor} capitalize`}>
        {status}
      </span>
    </div>
  )
}
