// Redlining on any page: React bundled, mounted by `mount()` or by a script tag
// (`<script type="module" src=".../standalone.js" data-redlining data-endpoint="off">`).
// Dev-only by contract: there is no production build of this entry.
import { createRoot } from 'react-dom/client'
import { Redlining, type RedliningProps } from './overlay/Redlining'

export type StandaloneOptions = Omit<RedliningProps, 'enabled'>

/** Mounts the overlay into `doc.body`; returns an unmount function. */
export function mount(options: StandaloneOptions = {}, doc: Document = document): () => void {
  const host = doc.createElement('div')
  host.setAttribute('data-redlining-standalone', '')
  doc.body.appendChild(host)
  const root = createRoot(host)
  root.render(<Redlining {...options} enabled />)
  return () => {
    root.unmount()
    host.remove()
  }
}

/** Options from a `<script data-redlining …>` tag's data attributes. */
export function optionsFrom(dataset: DOMStringMap): StandaloneOptions {
  const o: StandaloneOptions = {}
  if (dataset.endpoint !== undefined)
    o.endpoint = dataset.endpoint === 'off' ? false : dataset.endpoint
  if (dataset.hotkey) o.hotkey = dataset.hotkey
  if (dataset.position) o.position = dataset.position as RedliningProps['position']
  if (dataset.theme) o.theme = dataset.theme as RedliningProps['theme']
  if (dataset.framework) o.framework = dataset.framework as RedliningProps['framework']
  return o
}

if (typeof document !== 'undefined') {
  ;(window as Window & { redlining?: { mount: typeof mount } }).redlining = { mount }
  const tag = document.querySelector<HTMLScriptElement>('script[data-redlining]')
  if (tag) {
    const go = () => mount(optionsFrom(tag.dataset))
    if (document.body) go()
    else document.addEventListener('DOMContentLoaded', go, { once: true })
  }
}
