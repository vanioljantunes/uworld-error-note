import { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger'
}

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50'
  const variants = {
    primary: 'bg-violet-600 text-white hover:bg-violet-700',
    ghost: 'border border-[#3a3a3a] bg-[#1a1a1a] text-neutral-300 hover:bg-[#212121] hover:border-[#4a4a4a]',
    danger: 'border border-red-900/50 bg-red-600/10 text-red-400 hover:bg-red-600/20',
  }

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}
