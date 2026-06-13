import { useState, useRef, useCallback } from 'react'
import type { ReactNode } from 'react'

interface TooltipProps {
  content: ReactNode
  children: ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
}

const positionStyles: Record<NonNullable<TooltipProps['position']>, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
}

const arrowStyles: Record<NonNullable<TooltipProps['position']>, string> = {
  top: 'top-full left-1/2 -translate-x-1/2 border-t-slate-700 border-x-transparent border-b-transparent border-4',
  bottom:
    'bottom-full left-1/2 -translate-x-1/2 border-b-slate-700 border-x-transparent border-t-transparent border-4',
  left: 'left-full top-1/2 -translate-y-1/2 border-l-slate-700 border-y-transparent border-r-transparent border-4',
  right:
    'right-full top-1/2 -translate-y-1/2 border-r-slate-700 border-y-transparent border-l-transparent border-4',
}

export default function Tooltip({
  content,
  children,
  position = 'top',
}: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback(() => {
    delayRef.current = setTimeout(() => setVisible(true), 150)
  }, [])

  const hide = useCallback(() => {
    if (delayRef.current) {
      clearTimeout(delayRef.current)
      delayRef.current = null
    }
    setVisible(false)
  }, [])

  return (
    <div className="relative inline-block">
      <span
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="inline-flex"
      >
        {children}
      </span>

      {visible && (
        <div
          role="tooltip"
          className={[
            'absolute z-50 pointer-events-none',
            'whitespace-nowrap rounded-md px-3 py-1.5',
            'bg-slate-700 text-slate-200 text-sm font-medium',
            'shadow-lg shadow-black/30',
            'border border-slate-600/40',
            positionStyles[position],
          ].join(' ')}
        >
          {content}
          <span
            className={`absolute ${arrowStyles[position]}`}
            aria-hidden="true"
          />
        </div>
      )}
    </div>
  )
}
