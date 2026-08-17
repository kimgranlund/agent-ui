// flow-chrome.ts — ADR-0198 cl.3/cl.4/cl.5 (GH #1101, the #1065 shared-seam lift): the end-of-flow
// PAGE-CHROME affordance both conversation surfaces (a2ui-live, the agent-admin test chat) consume.
//
// The ask-registry pattern, deliberately: this module owns the LIFECYCLE and LOGIC — detect `flowEnd`
// on the peeled meta-line envelope (the explicit MODEL-authored field, NEVER a heuristic — ADR-0198
// Non-goals), build the done/start-over row, wire the callbacks, dismiss-on-done — and owns NO
// page-specific markup: each page supplies its own mount point and CSS (the generic `flow-chrome*`
// class hooks below are the whole styling contract).
//
// v1 affordance set (ADR-0198 cl.4): `Done` acknowledges and dismisses the row — nothing else is
// destroyed (the conversation stays readable, the composer stays live); `Start over` routes to the
// page's EXISTING reset path via the injected callback (a2ui-live's Reset/`disposeAll`; agent-admin's
// conversation clear) — never a second reset implementation. Both are plain fleet buttons wired via
// `click`; nothing rides a new ui-* event name (the ADR-0153 seven-member vocabulary stays closed).
// Handoff is a non-goal (revisit trigger: a surface with a handoff target).

import type { A2uiMetaEnvelope } from './agent-runtime.ts'

/** `true` iff the peeled envelope declares flow completion — the explicit ADR-0198 cl.1 field, literal
 * `true` only (`readMetaLine` already dropped anything else). `undefined` (no envelope / no field) is
 * NOT completion — the safe-degrade law: an omitting model yields today's behavior, never a misfire. */
export function isFlowEnd(envelope: A2uiMetaEnvelope | undefined): boolean {
  return envelope?.a2uiMeta.flowEnd === true
}

export interface FlowChromeOptions {
  /** The page's EXISTING reset path (ADR-0198 cl.4) — a2ui-live's Reset, agent-admin's conversation
   * clear. Invoked AFTER the row dismisses itself. */
  onStartOver: () => void
  /** Optional acknowledge hook — the row already dismisses itself on Done before calling this. */
  onDone?: () => void
}

export interface FlowChrome {
  /** Present the end-of-flow row inside `mount` iff `envelope` carries `flowEnd: true`. Returns `true`
   * when the row was appended. Idempotent per flow: while a row is already up, a second call is a
   * no-op (`false`) — one completion, one row. */
  maybePresent(envelope: A2uiMetaEnvelope | undefined, mount: HTMLElement): boolean
  /** Remove the row (no callbacks fired) — the page's own reset path calls this so a cleared
   * conversation never keeps a stale affordance. Safe when no row is up. */
  dismiss(): void
  /** `true` while the row is mounted. */
  readonly active: boolean
}

/**
 * Create the shared end-of-flow chrome controller (one per conversation surface). The row it builds:
 *
 *   <div class="flow-chrome" role="group" aria-label="Flow complete">
 *     <ui-button class="flow-chrome-done">Done</ui-button>                (solid — the default action)
 *     <ui-button variant="ghost" class="flow-chrome-start-over">Start over</ui-button>
 *   </div>
 */
export function createFlowChrome(options: FlowChromeOptions): FlowChrome {
  let row: HTMLElement | undefined

  const dismiss = (): void => {
    row?.remove()
    row = undefined
  }

  return {
    maybePresent(envelope: A2uiMetaEnvelope | undefined, mount: HTMLElement): boolean {
      if (!isFlowEnd(envelope)) return false // explicit field only — never a heuristic (ADR-0198)
      if (row !== undefined) return false // one completion, one row
      row = document.createElement('div')
      row.className = 'flow-chrome'
      row.setAttribute('role', 'group')
      row.setAttribute('aria-label', 'Flow complete')

      const done = document.createElement('ui-button')
      done.className = 'flow-chrome-done'
      done.setAttribute('tabindex', '0')
      done.textContent = 'Done'
      done.addEventListener('click', () => {
        dismiss() // dismiss-on-done — the conversation stays readable, nothing destroyed (cl.4)
        options.onDone?.()
      })

      const startOver = document.createElement('ui-button')
      startOver.className = 'flow-chrome-start-over'
      startOver.setAttribute('variant', 'ghost')
      startOver.setAttribute('tabindex', '0')
      startOver.textContent = 'Start over'
      startOver.addEventListener('click', () => {
        dismiss()
        options.onStartOver() // the page's EXISTING reset path — never a second reset implementation
      })

      row.append(done, startOver)
      mount.append(row)
      return true
    },
    dismiss,
    get active(): boolean {
      return row !== undefined
    },
  }
}
