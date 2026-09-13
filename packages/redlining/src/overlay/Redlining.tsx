'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { App } from './App'
import { containEvents } from './dom'
import { brandCss, overlayCss } from './styles'
import type { Position } from './Toolbar'
import { tokensCss } from './tokens.generated'

export interface RedliningProps {
  /** Where "Save to project" posts. Default `/api/redlining`; `false` downloads the files instead. */
  endpoint?: string | false
  /** Toggle hotkey. Default `Alt+R`. */
  hotkey?: string
  /** Toolbar corner. Default `bottom-right` (Next DevTools sits bottom-left). */
  position?: Position
  /** Overlay theme. Default `light`. */
  theme?: 'light' | 'dark'
  /** Defaults to `NODE_ENV === 'development'`; the overlay renders nothing otherwise. */
  enabled?: boolean
  /** Annotations per session before new ones are refused. Default 15. */
  maxAnnotations?: number
  /** Include a screenshot with burned-in pins when saving. Default true. */
  screenshot?: boolean
  /**
   * The styling idiom values map to (`pl-6`, `text-lg`) and the export speaks in.
   * Detected from the page's stylesheets by default; set it when the detection is wrong.
   */
  framework?: 'tailwind4' | 'tailwind3' | 'css-modules' | 'css'
}

const HOST_STYLE: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: 0,
  height: 0,
  zIndex: 2147483000,
}

/** Mounts the Redlining overlay in a shadow root. Renders nothing outside development. */
export function Redlining(props: RedliningProps) {
  const enabled = props.enabled ?? process.env.NODE_ENV === 'development'
  if (!enabled) return null
  return <Host {...props} />
}

interface Mount {
  host: HTMLDivElement
  root: ShadowRoot
}

function Host({
  endpoint = '/api/redlining',
  hotkey = 'Alt+R',
  position = 'bottom-right',
  theme = 'light',
  maxAnnotations = 15,
  screenshot = true,
  framework,
}: RedliningProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [mount, setMount] = useState<Mount | null>(null)
  useEffect(() => {
    const host = ref.current
    if (!host) return
    const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' })
    if (!root.querySelector('style')) {
      const style = document.createElement('style')
      style.textContent = tokensCss + brandCss + overlayCss
      root.appendChild(style)
    }
    setMount({ host, root })
    return containEvents(host)
  }, [])
  return (
    <div ref={ref} data-redlining="" data-theme={theme} style={HOST_STYLE}>
      {mount
        ? createPortal(
            <App
              host={mount.host}
              endpoint={endpoint}
              hotkey={hotkey}
              position={position}
              maxAnnotations={maxAnnotations}
              screenshot={screenshot}
              framework={framework}
            />,
            mount.root,
          )
        : null}
    </div>
  )
}
