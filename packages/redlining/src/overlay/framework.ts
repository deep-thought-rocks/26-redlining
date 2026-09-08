// Which styling idiom the host page uses, read from its stylesheets and class names.
// Decides how tweak values map back to classes and what the export tells the agent.
import { rules } from './cascade'

export type FrameworkKind = 'tailwind4' | 'tailwind3' | 'css-modules' | 'css'

export interface Framework {
  kind: FrameworkKind
  /** What the detection saw, for the settings popover and the export header. */
  evidence: string
}

export const FRAMEWORK_LABEL: Record<FrameworkKind, string> = {
  tailwind4: 'Tailwind 4',
  tailwind3: 'Tailwind 3',
  'css-modules': 'CSS Modules',
  css: 'Plain CSS',
}

/** Next (`file_class__hash`) and Vite (`_class_hash_n`) CSS Modules class shapes. */
const MODULE_CLASS = /(^|_)[\w-]+__[A-Za-z0-9_-]{5,}$|^_[\w-]+_[a-z0-9]{5,}_\d+$/

export function detectFramework(doc: Document): Framework {
  let spacing = false
  let textToken = false
  let twVars = false
  for (const { rule } of rules(doc)) {
    for (const name of Array.from(rule.style)) {
      if (name === '--spacing') spacing = true
      else if (name.startsWith('--text-')) textToken = true
      else if (name.startsWith('--tw-')) twVars = true
    }
  }
  if (spacing && textToken) return { kind: 'tailwind4', evidence: '--spacing and --text-* tokens' }
  if (spacing) return { kind: 'tailwind4', evidence: '--spacing token' }
  if (twVars) return { kind: 'tailwind3', evidence: '--tw-* variables in the preflight' }

  const classes: string[] = []
  for (const el of Array.from(doc.querySelectorAll('[data-rl]'))) {
    classes.push(...Array.from(el.classList))
    if (classes.length >= 200) break
  }
  const hashed = classes.filter((c) => MODULE_CLASS.test(c)).length
  if (classes.length >= 3 && hashed * 2 >= classes.length) {
    return {
      kind: 'css-modules',
      evidence: `${hashed} of ${classes.length} class names are hashed`,
    }
  }
  return { kind: 'css', evidence: 'no Tailwind tokens, no hashed class names' }
}

/** Hashed CSS Modules classes are never a useful suggestion. */
export function isModuleClass(className: string): boolean {
  return MODULE_CLASS.test(className)
}
