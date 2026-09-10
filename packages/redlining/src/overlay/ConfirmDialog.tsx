import { useEffect, useRef, type KeyboardEvent } from 'react'

export interface ConfirmDialogProps {
  message: string
  /** The confirming button's label, e.g. "Archive" or "Delete". */
  action: string
  danger?: boolean
  onConfirm(): void
  onCancel(): void
}

/** The overlay's own confirmation, in place of the browser's alert box. */
export function ConfirmDialog({
  message,
  action,
  danger,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ok = useRef<HTMLButtonElement>(null)
  useEffect(() => ok.current?.focus(), [])
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    // Handled here, and stopped: the window handler would otherwise see the same key.
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onCancel()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      onConfirm()
    }
  }
  return (
    <div className="rl-fixed rl-scrim" data-testid="rl-confirm" onKeyDown={onKey}>
      <div className="rl-confirm" role="alertdialog" aria-modal="true" aria-label={message}>
        <p>{message}</p>
        <div className="rl-actions">
          <span className="rl-kbd">⏎ {action.toLowerCase()} · esc cancel</span>
          <button type="button" className="rl-action" onClick={onCancel}>
            Cancel
          </button>
          <button
            ref={ok}
            type="button"
            className={`rl-action rl-action--primary${danger ? ' rl-action--danger' : ''}`}
            onClick={onConfirm}
          >
            {action}
          </button>
        </div>
      </div>
    </div>
  )
}
