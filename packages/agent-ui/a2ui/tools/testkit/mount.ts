// mount.ts: the kit's deterministic renderer mount (T-0011). The ONE kit module that names the control
// definition seam: `src/catalog/controls.ts` (`builtinControls`), which `createRenderer()` already
// registers for the built-in catalogs (and persona entries inherit through `composeControlLoaders`). When
// GH #1814's loader work moves that seam, only this file changes. The legs never import controls.
//
// Deterministic by default: `newId` is a counter yielding `kit-action-<n>` and `now` is fixed, both through
// `RendererOptions`, so a scenario can match `actionId` and `timestamp` exactly.
//
// jsdom lacks `ElementInternals.prototype.setFormValue` and `setValidity`; while a mount is alive a no-op
// stands in for each missing one, and the original comes back when the last mount is disposed (the
// `catalog/default/index.test.ts` precedent).
//
// `settle()` resolves once all three hold for two consecutive macrotasks:
//   - every surface this mount saw created, and not deleted since, has its `[data-a2ui-surface]` root
//     attached under the mount;
//   - no DOM mutation under the mount;
//   - no `builtinControls.ensure` call is in flight (the renderer defers apply until the controls a message
//     needs are defined, ADR-0233, so a later turn's new control type on an attached surface is awaited).
// Otherwise, after `settleTimeoutMs` (default 2000, below vitest's 5000 ms default test timeout outside
// browser mode, 15000 ms in it), it rejects with an Error whose `code` is `RENDER_ERROR` and whose `detail`
// lists the unattached surface ids, so a stuck cell reports the kit's code, not a vitest timeout.
// Known limit: a persona's own control record (croupier's `ui-playing-card`) loads outside
// `builtinControls`, so only its first-mount attach is awaited, not a later-turn first use.

import { createRenderer } from '../../src/renderer/renderer.ts'
import type { A2uiClientMessage, RendererHost } from '../../src/renderer/renderer.ts'
import { builtinControls } from '../../src/catalog/controls.ts'

export const DEFAULT_SETTLE_TIMEOUT_MS = 2000
export const KIT_NOW = '2026-01-01T00:00:00.000Z'

export interface KitMount {
  host: RendererHost
  /** The element every surface root attaches under. */
  root: HTMLElement
  /** Ingest raw JSON lines, one message each (meta-lines are the caller's to drop). */
  ingest(lines: readonly string[]): void
  finalize(surfaceId?: string): void
  settle(): Promise<void>
  /** Every client message emitted since the mount was created, in order. */
  clientMessages(): A2uiClientMessage[]
  /** The surfaceIds created and not deleted since, in creation order. */
  liveSurfaces(): string[]
  /** The attached root element of one surface, if any. */
  surfaceRoot(surfaceId: string): HTMLElement | undefined
  dispose(): void
}

export interface KitMountOptions {
  newId?: () => string
  now?: () => string
  settleTimeoutMs?: number
}

export class RenderError extends Error {
  override name = 'RenderError'
  readonly code = 'RENDER_ERROR'
  readonly detail: string
  constructor(detail: string) {
    super(`RENDER_ERROR: ${detail}`)
    this.detail = detail
  }
}

// ---- shared, ref-counted environment patches ----

let liveMounts = 0
let pendingLoads = 0
let restoreEnv: (() => void) | undefined

function installEnv(): void {
  liveMounts += 1
  if (liveMounts > 1) return
  const proto = (globalThis as unknown as { ElementInternals?: { prototype: Record<string, unknown> } }).ElementInternals?.prototype
  const savedFormValue = proto?.setFormValue
  const savedValidity = proto?.setValidity
  if (proto !== undefined && typeof proto.setFormValue !== 'function') proto.setFormValue = function (): void {}
  if (proto !== undefined && typeof proto.setValidity !== 'function') proto.setValidity = function (): void {}
  const savedEnsure = builtinControls.ensure
  builtinControls.ensure = async (tags) => {
    pendingLoads += 1
    try {
      await savedEnsure.call(builtinControls, tags)
    } finally {
      pendingLoads -= 1
    }
  }
  restoreEnv = () => {
    builtinControls.ensure = savedEnsure
    if (proto !== undefined) {
      proto.setFormValue = savedFormValue
      proto.setValidity = savedValidity
    }
  }
}

function releaseEnv(): void {
  liveMounts -= 1
  if (liveMounts > 0) return
  restoreEnv?.()
  restoreEnv = undefined
}

const macrotask = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

export function createKitMount(opts: KitMountOptions = {}): KitMount {
  installEnv()
  let seq = 0
  const host = createRenderer({ newId: opts.newId ?? (() => `kit-action-${++seq}`), now: opts.now ?? (() => KIT_NOW) })
  const messages: A2uiClientMessage[] = []
  const unsubscribe = host.onClientMessage((m) => messages.push(m))
  const root = document.createElement('div')
  root.setAttribute('data-kit-mount', '')
  document.body.appendChild(root)
  host.mount(root)
  const live: string[] = []
  let mutated = false
  const observer = new MutationObserver(() => {
    mutated = true
  })
  observer.observe(root, { subtree: true, childList: true, attributes: true, characterData: true })
  const timeoutMs = opts.settleTimeoutMs ?? DEFAULT_SETTLE_TIMEOUT_MS
  let disposed = false

  const surfaceRoot = (sid: string): HTMLElement | undefined => {
    for (const child of Array.from(root.children)) if (child.getAttribute('data-a2ui-surface') === sid) return child as HTMLElement
    return undefined
  }

  return {
    host,
    root,
    ingest(lines) {
      for (const line of lines) {
        try {
          const msg: unknown = JSON.parse(line)
          if (isObject(msg)) {
            const created = isObject(msg.createSurface) ? msg.createSurface.surfaceId : undefined
            const deleted = isObject(msg.deleteSurface) ? msg.deleteSurface.surfaceId : undefined
            if (typeof created === 'string' && !live.includes(created)) live.push(created)
            if (typeof deleted === 'string' && live.includes(deleted)) live.splice(live.indexOf(deleted), 1)
          }
        } catch {
          // the renderer reports the PARSE itself
        }
        host.ingest(line)
      }
    },
    finalize(surfaceId) {
      host.finalize(surfaceId)
    },
    async settle() {
      const started = Date.now()
      let quiet = 0
      for (;;) {
        await macrotask()
        const wasMutated = mutated || observer.takeRecords().length > 0
        mutated = false
        const unattached = live.filter((sid) => surfaceRoot(sid) === undefined)
        if (unattached.length === 0 && !wasMutated && pendingLoads === 0) {
          quiet += 1
          if (quiet >= 2) return
        } else quiet = 0
        if (Date.now() - started > timeoutMs) {
          throw new RenderError(
            `not settled after ${timeoutMs} ms: unattached surfaces [${unattached.join(', ')}]` +
              (pendingLoads > 0 ? `, ${pendingLoads} control load(s) in flight` : '') +
              (wasMutated ? ', DOM still mutating' : ''),
          )
        }
      }
    },
    clientMessages: () => [...messages],
    liveSurfaces: () => [...live],
    surfaceRoot,
    dispose() {
      if (disposed) return
      disposed = true
      observer.disconnect()
      unsubscribe()
      host.dispose()
      root.remove()
      releaseEnv()
    },
  }
}
