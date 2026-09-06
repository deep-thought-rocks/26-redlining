import {
  ArrowRightLeft,
  Copy,
  ListChecks,
  MousePointerClick,
  PenLine,
  Send,
  SquareDashedMousePointer,
  Trash2,
  X,
} from 'lucide-react'
import type { ReactNode } from 'react'

export type Position = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
export type Tool = 'select' | 'draw' | 'move'

export interface ToolbarProps {
  active: boolean
  tool: Tool
  count: number
  panelOpen: boolean
  position: Position
  hotkey: string
  onToggle(): void
  onTool(tool: Tool): void
  onPanel(): void
  onCopy(): void
  onSend(): void
  onClear(): void
}

export function Toolbar(p: ToolbarProps) {
  if (!p.active) {
    return (
      <div className="rl-fixed rl-toolbar" data-pos={p.position} data-testid="rl-toolbar">
        <IconButton
          label={`Redlining (${p.hotkey})`}
          className="rl-btn--toggle"
          onClick={p.onToggle}
        >
          <PenLine size={20} />
        </IconButton>
      </div>
    )
  }
  return (
    <div
      className="rl-fixed rl-toolbar"
      data-pos={p.position}
      data-panel={p.panelOpen || undefined}
      data-testid="rl-toolbar"
      role="toolbar"
      aria-label="Redlining"
    >
      <IconButton
        label="Select (S)"
        pressed={p.tool === 'select'}
        onClick={() => p.onTool('select')}
      >
        <MousePointerClick size={18} />
      </IconButton>
      <IconButton label="Draw (D)" pressed={p.tool === 'draw'} onClick={() => p.onTool('draw')}>
        <SquareDashedMousePointer size={18} />
      </IconButton>
      <IconButton label="Move (M)" pressed={p.tool === 'move'} onClick={() => p.onTool('move')}>
        <ArrowRightLeft size={18} />
      </IconButton>
      <IconButton label="Annotations (L)" pressed={p.panelOpen} onClick={p.onPanel}>
        <ListChecks size={18} />
        {p.count > 0 ? <span className="rl-count">{p.count}</span> : null}
      </IconButton>
      <span className="rl-sep" />
      <IconButton label="Copy prompt (⌘⇧C)" onClick={p.onCopy}>
        <Copy size={18} />
      </IconButton>
      <IconButton label="Save to project (⌘⏎)" className="rl-btn--primary" onClick={p.onSend}>
        <Send size={18} />
      </IconButton>
      <IconButton label="Clear session" onClick={p.onClear}>
        <Trash2 size={18} />
      </IconButton>
      <span className="rl-sep" />
      <IconButton label="Close (Esc)" onClick={p.onToggle}>
        <X size={18} />
      </IconButton>
    </div>
  )
}

function IconButton({
  label,
  pressed,
  className = '',
  onClick,
  children,
}: {
  label: string
  pressed?: boolean
  className?: string
  onClick(): void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={`rl-btn ${className}`}
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
