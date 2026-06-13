import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  children: ReactNode
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: [
    'bg-violet-600 text-white',
    'hover:bg-violet-500 active:bg-violet-700',
    'shadow-lg shadow-violet-900/30',
    'border border-violet-500/20',
    'disabled:bg-violet-600/40 disabled:shadow-none',
  ].join(' '),
  secondary: [
    'bg-slate-700 text-slate-100',
    'hover:bg-slate-600 active:bg-slate-800',
    'shadow-md shadow-black/20',
    'border border-slate-600/30',
    'disabled:bg-slate-700/50',
  ].join(' '),
  danger: [
    'bg-red-700 text-white',
    'hover:bg-red-600 active:bg-red-800',
    'shadow-lg shadow-red-900/30',
    'border border-red-500/20',
    'disabled:bg-red-700/40 disabled:shadow-none',
  ].join(' '),
  ghost: [
    'bg-transparent text-slate-300',
    'hover:bg-slate-700/50 hover:text-white active:bg-slate-700/70',
    'border border-transparent',
    'disabled:text-slate-600 disabled:bg-transparent',
  ].join(' '),
}

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-md gap-1.5',
  md: 'px-5 py-2.5 text-base rounded-lg gap-2',
  lg: 'px-7 py-3.5 text-lg rounded-lg gap-2.5',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    disabled = false,
    className = '',
    children,
    ...rest
  },
  ref,
) {
  const base = [
    'inline-flex items-center justify-center',
    'font-semibold tracking-wide',
    'transition-all duration-150 ease-out',
    'select-none cursor-pointer',
    'disabled:cursor-not-allowed disabled:opacity-60',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400',
  ].join(' ')

  const width = fullWidth ? 'w-full' : ''

  return (
    <button
      ref={ref}
      disabled={disabled}
      className={`${base} ${variantClasses[variant]} ${sizeClasses[size]} ${width} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  )
})

export default Button
