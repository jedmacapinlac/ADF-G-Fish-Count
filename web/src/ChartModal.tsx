import { useEffect } from 'react'

import { CloseIcon } from './icons'

type Props = {
  title: string
  onClose: () => void
  children: React.ReactNode
}

/** Full-screen home for whichever chart tile was clicked — same chart
 *  component, just mounted bigger, so its own hover/tooltip/selector
 *  behavior carries over unchanged. Closes on Escape, on the backdrop, or
 *  the corner button; a click inside the panel never bubbles to the
 *  backdrop's close handler. */
export default function ChartModal({ title, onClose, children }: Props) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="flex h-[85vh] w-full max-w-4xl flex-col rounded-xl border border-stone-300 bg-stone-50 p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-base font-semibold text-stone-900">{title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-md text-stone-500 hover:bg-stone-200 hover:text-stone-900"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 min-h-0 flex-1">{children}</div>
      </div>
    </div>
  )
}
