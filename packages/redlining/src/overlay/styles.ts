// Overlay styles on top of the vendored silverballmania tokens. Everything is
// scoped by the shadow root; the host page never sees these rules.
export const overlayCss = `
:host { all: initial; font-family: var(--sbm-font-body); font-size: var(--sbm-text-sm); line-height: var(--sbm-text-sm-line); color: var(--color-text-primary); }
:host *, :host *::before, :host *::after { box-sizing: border-box; }
button { font: inherit; color: inherit; }
.rl-layer { position: absolute; top: 0; left: 0; width: 0; height: 0; pointer-events: none; }
.rl-fixed { position: fixed; pointer-events: auto; z-index: 10; }

.rl-toolbar { display: flex; gap: var(--sbm-space-1); padding: var(--sbm-space-1); background: var(--color-background-elevated); border: var(--sbm-border-w) solid var(--color-border-default); border-radius: var(--sbm-radius-xl); box-shadow: var(--shadow-2); font-family: var(--sbm-font-heading); }
.rl-toolbar[data-pos="bottom-right"] { right: 16px; bottom: 16px; }
.rl-toolbar[data-pos="bottom-left"] { left: 16px; bottom: 16px; }
.rl-toolbar[data-pos="top-right"] { right: 16px; top: 16px; }
.rl-toolbar[data-pos="top-left"] { left: 16px; top: 16px; }
.rl-toolbar[data-pos$="right"][data-panel] { right: 336px; }
.rl-btn { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border: 0; border-radius: var(--sbm-radius-lg); background: transparent; color: var(--color-text-secondary); cursor: pointer; transition: background var(--sbm-duration-quick) var(--sbm-ease-standard), color var(--sbm-duration-quick) var(--sbm-ease-standard), transform var(--sbm-duration-fast) var(--sbm-ease-standard); }
.rl-btn:hover { background: var(--color-background-overlay); color: var(--color-text-accent); }
.rl-btn:active { transform: scale(var(--sbm-scale-active-icon)); }
.rl-btn:focus-visible { outline: var(--sbm-focus-ring-w) solid var(--sbm-focus-ring); outline-offset: var(--sbm-focus-ring-offset); }
.rl-btn[aria-pressed="true"] { background: var(--color-accent-soft); color: var(--color-on-accent-soft); }
.rl-btn--primary { background: var(--color-accent-fill); color: var(--color-on-accent); }
.rl-btn--primary:hover { background: var(--color-accent-fill-hover); color: var(--color-on-accent); }
.rl-btn--toggle { width: 44px; height: 44px; border-radius: var(--sbm-radius-full); background: var(--color-accent-fill); color: var(--color-on-accent); box-shadow: var(--shadow-3); }
.rl-btn--toggle:hover { background: var(--color-accent-fill-hover); color: var(--color-on-accent); }
.rl-count { position: absolute; top: -4px; right: -4px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: var(--sbm-radius-full); background: var(--color-accent-fill); color: var(--color-on-accent); font-size: 11px; font-weight: var(--sbm-weight-semibold); line-height: 18px; text-align: center; }
.rl-select { height: 28px; align-self: center; padding: 0 4px; font: 600 12px var(--sbm-font-heading); color: var(--color-text-secondary); background: var(--color-background-elevated); border: var(--sbm-border-w) solid var(--color-border-default); border-radius: var(--sbm-radius-md); }
.rl-sep { width: 1px; margin: 6px 2px; background: var(--color-border-default); }

.rl-outline { position: absolute; pointer-events: none; outline: var(--sbm-border-w-thick) solid var(--color-border-focus); outline-offset: 1px; border-radius: var(--sbm-radius-sm); }
.rl-badge { position: absolute; pointer-events: none; max-width: 60vw; padding: 3px 8px; background: var(--color-background-overlay); border: var(--sbm-border-w) solid var(--color-border-default); border-radius: var(--sbm-radius-md); box-shadow: var(--shadow-2); font-family: var(--sbm-font-heading); font-size: var(--sbm-text-xs); line-height: var(--sbm-text-xs-line); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--color-text-primary); }
.rl-badge b { color: var(--color-text-accent); font-weight: var(--sbm-weight-semibold); }
.rl-badge span { color: var(--color-text-muted); }
.rl-drawbox { position: fixed; pointer-events: none; border: var(--sbm-border-w-thick) dashed var(--color-border-focus); background: color-mix(in srgb, var(--color-accent-primary) 8%, transparent); border-radius: var(--sbm-radius-sm); }

.rl-pin { position: absolute; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: var(--sbm-radius-full); background: var(--color-accent-fill); color: var(--color-on-accent); border: 2px solid var(--color-background); box-shadow: var(--shadow-2); font-family: var(--sbm-font-heading); font-size: 11px; font-weight: var(--sbm-weight-semibold); line-height: 18px; text-align: center; pointer-events: none; }
.rl-pin--target { width: auto; padding: 0 6px; border-radius: var(--sbm-radius-md); background: var(--color-background-overlay); color: var(--color-text-accent); border-color: var(--color-border-focus); }
.rl-outline--source { outline-style: dashed; }
.rl-outline--tweak { outline-color: var(--color-warning); }
.rl-handle { position: absolute; width: 10px; height: 10px; margin: -5px 0 0 -5px; border-radius: 2px; background: var(--color-background); border: 2px solid var(--color-warning); pointer-events: auto; box-shadow: var(--shadow-1); }
.rl-handle:hover { transform: scale(1.3); }
.rl-outline--measure { outline-style: dotted; outline-color: var(--color-info); }
.rl-ruler { position: absolute; pointer-events: none; border: 0 solid var(--color-info); }
.rl-ruler--x { border-top-width: 1px; }
.rl-ruler--y { border-left-width: 1px; }
.rl-ruler span { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); padding: 1px 5px; border-radius: var(--sbm-radius-sm); background: var(--color-info); color: #fff; font: 600 10px var(--sbm-font-heading); white-space: nowrap; }
.rl-color { display: grid; grid-template-columns: 34px 1fr; gap: 6px; }
.rl-color input[type='color'] { width: 34px; height: 24px; padding: 0; border: var(--sbm-border-w) solid var(--color-border-default); border-radius: var(--sbm-radius-md); background: none; cursor: pointer; }
.rl-color select { min-width: 0; font: inherit; font-size: var(--sbm-text-xs); padding: 2px 4px; border: var(--sbm-border-w) solid var(--color-border-default); border-radius: var(--sbm-radius-md); background: var(--color-background-sunken); color: var(--color-text-primary); }
.rl-pinbox { position: absolute; pointer-events: none; border: var(--sbm-border-w) dashed var(--color-border-focus); border-radius: var(--sbm-radius-sm); }

.rl-popover { position: absolute; pointer-events: auto; width: 340px; padding: var(--sbm-space-3); background: var(--color-background-overlay); border: var(--sbm-border-w) solid var(--color-border-default); border-radius: var(--sbm-radius-xl); box-shadow: var(--shadow-3); animation: sbmSlideUp var(--sbm-duration-slow) var(--sbm-ease-out) both; }
.rl-popover header { display: flex; align-items: baseline; gap: var(--sbm-space-2); margin-bottom: var(--sbm-space-2); font-family: var(--sbm-font-heading); font-size: var(--sbm-text-xs); color: var(--color-text-muted); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.rl-popover header b { color: var(--color-text-primary); font-weight: var(--sbm-weight-semibold); }
.rl-chips { display: flex; flex-wrap: wrap; gap: var(--sbm-space-1); margin-bottom: var(--sbm-space-2); }
.rl-chip { padding: 2px 10px; border: var(--sbm-border-w) solid var(--color-border-default); border-radius: var(--sbm-radius-full); background: transparent; color: var(--color-text-secondary); font-family: var(--sbm-font-heading); font-size: var(--sbm-text-xs); font-weight: var(--sbm-weight-medium); cursor: pointer; transition: background var(--sbm-duration-quick) var(--sbm-ease-standard); }
.rl-chip:hover { background: var(--color-background-elevated); }
.rl-chip[aria-pressed="true"] { background: var(--color-accent-soft); border-color: var(--color-accent-primary); color: var(--color-on-accent-soft); }
.rl-textarea { display: block; width: 100%; min-height: 72px; padding: var(--sbm-space-2) var(--sbm-space-3); resize: vertical; font: inherit; color: var(--color-text-primary); background: var(--color-background-sunken); border: var(--sbm-border-w) solid var(--color-border-default); border-radius: var(--sbm-radius-lg); }
.rl-textarea:focus { outline: none; border-color: var(--color-border-focus); }
.rl-actions { display: flex; justify-content: flex-end; gap: var(--sbm-space-2); margin-top: var(--sbm-space-2); }
.rl-action { height: 32px; padding: 0 var(--sbm-space-3); border: var(--sbm-border-w) solid var(--color-border-default); border-radius: var(--sbm-radius-lg); background: var(--color-background-elevated); color: var(--color-text-primary); font-family: var(--sbm-font-heading); font-size: var(--sbm-text-sm); font-weight: var(--sbm-weight-semibold); cursor: pointer; }
.rl-action--primary { background: var(--color-accent-fill); border-color: transparent; color: var(--color-on-accent); }
.rl-action--primary:hover { background: var(--color-accent-fill-hover); }
.rl-kbd { color: var(--color-text-muted); font-size: var(--sbm-text-xs); align-self: center; margin-right: auto; }

.rl-panel { top: 0; right: 0; bottom: 0; width: 320px; display: flex; flex-direction: column; background: var(--color-background-elevated); border-left: var(--sbm-border-w) solid var(--color-border-default); box-shadow: var(--shadow-3); animation: sbmFadeIn var(--sbm-duration-normal) var(--sbm-ease-out) both; }
.rl-panel header { display: flex; align-items: center; justify-content: space-between; height: 48px; padding: 0 var(--sbm-space-3) 0 var(--sbm-space-4); border-bottom: var(--sbm-border-w) solid var(--color-border-default); font-family: var(--sbm-font-heading); font-weight: var(--sbm-weight-semibold); }
.rl-panel ol { flex: 1; min-height: 0; margin: 0; padding: var(--sbm-space-2); list-style: none; overflow-y: auto; }
.rl-row { display: grid; grid-template-columns: 22px 1fr auto; gap: var(--sbm-space-2); padding: var(--sbm-space-2); border-radius: var(--sbm-radius-lg); }
.rl-row:hover { background: var(--color-background-overlay); }
.rl-row .rl-pin { position: static; margin: 0; }
.rl-row-meta { font-family: var(--sbm-font-heading); font-size: var(--sbm-text-xs); color: var(--color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rl-row-meta b { color: var(--color-text-accent); text-transform: uppercase; letter-spacing: var(--sbm-tracking-wide); }
.rl-row-head { display: flex; align-items: center; gap: 4px; width: 100%; padding: 0; border: 0; background: none; color: inherit; cursor: pointer; text-align: left; min-width: 0; }
.rl-row-head:focus-visible { outline: var(--sbm-focus-ring-w) solid var(--sbm-focus-ring); outline-offset: 2px; border-radius: var(--sbm-radius-sm); }
.rl-row-head svg { flex: none; color: var(--color-text-muted); }
.rl-row-head .rl-row-meta { min-width: 0; }
.rl-row-details { margin: 4px 0 2px; display: grid; grid-template-columns: auto 1fr; gap: 2px 8px; font-size: var(--sbm-text-xs); line-height: var(--sbm-text-xs-line); color: var(--color-text-secondary); word-break: break-word; }
.rl-row-details dt { font-family: var(--sbm-font-heading); font-weight: var(--sbm-weight-semibold); color: var(--color-text-muted); }
.rl-row-details dd { margin: 0; }
.rl-row-details code { font-family: var(--sbm-font-mono); color: var(--color-text-accent); }
.rl-row-text { color: var(--color-text-muted); font-style: italic; }
.rl-row-note { margin-top: 2px; color: var(--color-text-primary); white-space: pre-wrap; word-break: break-word; cursor: text; }
.rl-row-note--clamp { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.rl-row-note:empty::before { content: 'Add a note…'; color: var(--color-text-disabled); }
.rl-empty { padding: var(--sbm-space-6) var(--sbm-space-4); color: var(--color-text-muted); text-align: center; }
.rl-icon { width: 28px; height: 28px; }

.rl-inspector { width: 360px; max-height: 70vh; overflow-y: auto; }
.rl-section { margin: 6px 0 0; padding: 6px 8px 4px; border: var(--sbm-border-w) solid var(--color-border-subtle); border-radius: var(--sbm-radius-lg); }
.rl-section legend { padding: 0 4px; font-family: var(--sbm-font-heading); font-size: var(--sbm-text-xs); font-weight: var(--sbm-weight-semibold); color: var(--color-text-muted); text-transform: uppercase; letter-spacing: var(--sbm-tracking-wide); }
.rl-field { display: grid; grid-template-columns: 96px 1fr; align-items: center; gap: 6px; margin: 2px 0; font-size: var(--sbm-text-xs); color: var(--color-text-secondary); }
.rl-field--wide { grid-template-columns: 40px 1fr; margin: 4px 0 6px; }
.rl-field[data-changed] > span { color: var(--color-text-accent); font-weight: var(--sbm-weight-semibold); }
.rl-stepper { display: grid; grid-template-columns: 24px 1fr 24px; }
.rl-stepper button { border: var(--sbm-border-w) solid var(--color-border-default); background: var(--color-background-elevated); color: var(--color-text-primary); cursor: pointer; font: 600 13px var(--sbm-font-heading); border-radius: var(--sbm-radius-md) 0 0 var(--sbm-radius-md); }
.rl-stepper button:last-child { border-radius: 0 var(--sbm-radius-md) var(--sbm-radius-md) 0; }
.rl-stepper button:hover { background: var(--color-background-overlay); }
.rl-stepper .rl-input { border-radius: 0; border-left: 0; border-right: 0; text-align: center; }
.rl-input { width: 100%; min-width: 0; padding: 3px 6px; font: inherit; font-size: var(--sbm-text-xs); color: var(--color-text-primary); background: var(--color-background-sunken); border: var(--sbm-border-w) solid var(--color-border-default); border-radius: var(--sbm-radius-md); }
.rl-input:focus { outline: none; border-color: var(--color-border-focus); }
.rl-changes { margin: 8px 0 0; padding: 0 0 0 16px; font-size: var(--sbm-text-xs); line-height: var(--sbm-text-xs-line); color: var(--color-text-secondary); }
.rl-changes li { margin: 2px 0; }
.rl-hint { margin: 8px 0 0; font-size: var(--sbm-text-xs); color: var(--color-text-muted); }
.rl-chip:disabled, .rl-action:disabled { opacity: 0.5; cursor: default; }
.rl-chip svg { vertical-align: -2px; margin-right: 3px; }
.rl-pin--tweak::after { content: ''; position: absolute; right: -3px; bottom: -3px; width: 8px; height: 8px; border-radius: 50%; background: var(--color-warning); border: 1px solid var(--color-background); }
.rl-toast { left: 50%; bottom: 24px; transform: translateX(-50%); padding: var(--sbm-space-2) var(--sbm-space-4); background: var(--color-background-elevated); border: var(--sbm-border-w) solid var(--color-border-default); border-radius: var(--sbm-radius-lg); box-shadow: var(--shadow-4); font-family: var(--sbm-font-heading); font-weight: var(--sbm-weight-medium); animation: sbmSlideUp var(--sbm-duration-slow) var(--sbm-ease-out) both; }
`
