import { X } from 'lucide-react'

/** Query parameter that tells the page inside the frame which width it runs at. */
export const FRAME_PARAM = 'rl_frame'

/** The frame width this document runs in, when it is the page inside a device frame. */
export function frameWidth(): number | null {
  const v = new URLSearchParams(window.location.search).get(FRAME_PARAM)
  const n = v ? Number(v) : NaN
  return Number.isFinite(n) && n > 0 && window.self !== window.top ? n : null
}

/** The current page's URL with the frame parameter set. */
export function frameUrl(width: number): string {
  const url = new URL(window.location.href)
  url.searchParams.set(FRAME_PARAM, String(width))
  return url.pathname + url.search + url.hash
}

/**
 * A real narrow viewport: the same page in an iframe of the chosen width, so
 * media queries, fixed bars and touch layouts behave as on a device. The
 * overlay inside the frame annotates; its session is shared with this one.
 */
export function DeviceFrame({ width, onClose }: { width: number; onClose(): void }) {
  const height = Math.max(480, window.innerHeight - 120)
  return (
    <div className="rl-fixed rl-frame-scrim" data-testid="rl-device-frame" data-width={width}>
      <div className="rl-frame-bar">
        <span>
          <b>{width}px</b> device frame · media queries apply · annotations sync into this session
        </span>
        <button
          type="button"
          className="rl-btn rl-icon"
          aria-label="Close device frame"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>
      <iframe
        className="rl-frame"
        title={`Page at ${width}px`}
        src={frameUrl(width)}
        style={{ width, height }}
      />
    </div>
  )
}
