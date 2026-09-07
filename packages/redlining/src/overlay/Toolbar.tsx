import {
  ArrowRightLeft,
  Camera,
  Copy,
  Images,
  ListChecks,
  MousePointerClick,
  PenLine,
  Send,
  SlidersHorizontal,
  SquareDashedMousePointer,
  Trash2,
  X,
} from 'lucide-react'
import type { ReactNode } from 'react'

export type Position = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
export type Tool = 'select' | 'draw' | 'move' | 'tweak'

export interface ToolbarProps {
  active: boolean
  tool: Tool
  count: number
  panelOpen: boolean
  screenshot: boolean
  beforeAfter: boolean
  viewport: number | null
  position: Position
  hotkey: string
  onToggle(): void
  onTool(tool: Tool): void
  onPanel(): void
  onScreenshot(): void
  onBeforeAfter(): void
  onViewport(width: number | null): void
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
      <IconButton label="Tweak (T)" pressed={p.tool === 'tweak'} onClick={() => p.onTool('tweak')}>
        <SlidersHorizontal size={18} />
      </IconButton>
      <IconButton label="Annotations (L)" pressed={p.panelOpen} onClick={p.onPanel}>
        <ListChecks size={18} />
        {p.count > 0 ? <span className="rl-count">{p.count}</span> : null}
      </IconButton>
      <span className="rl-sep" />
      <select
        className="rl-select"
        aria-label="Viewport preset"
        data-testid="rl-viewport"
        title="Viewport preset: annotate at a narrower width (approximate; not a media query)"
        value={p.viewport ?? ''}
        onChange={(e) => p.onViewport(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">Full</option>
        <option value="375">375</option>
        <option value="768">768</option>
        <option value="1280">1280</option>
      </select>
      <IconButton
        label="Include screenshot in export"
        pressed={p.screenshot}
        onClick={p.onScreenshot}
      >
        <Camera size={18} />
      </IconButton>
      {p.screenshot ? (
        <IconButton
          label="Also capture a before screenshot (previews reset)"
          pressed={p.beforeAfter}
          onClick={p.onBeforeAfter}
        >
          <Images size={18} />
        </IconButton>
      ) : null}
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
