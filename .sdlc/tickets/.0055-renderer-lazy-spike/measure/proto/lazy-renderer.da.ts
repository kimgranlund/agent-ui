// lazy-renderer.ts: PROTOTYPE of the Option D seam (T-0055). Not repo code; prototype.mjs renders this template into
// proto/lazy-renderer.<variant>.ts with the import() specifier filled in, and scratch-apply.mjs writes the same text into a scratch
// clone for the test-churn runs. Nothing here edits the repo.
//
// The facade is a `RendererHost` that exists before the renderer module does. `ui-surface-host.connected()` calls
// `createLazyRenderer()` instead of `createRenderer()`:
//   - warm (the renderer module already loaded on this page): it returns the real renderer, so first-paint streaming
//     stays synchronous exactly as ADR-0183 requires, and the facade costs one `if`.
//   - cold: it returns a `LazyRenderer` that records every call (register, mount, ingest, finalize, onClientMessage,
//     preload) and replays them in order onto the real renderer once the module lands. `pending` is true while calls are
//     held, and `settled()` resolves after the replay's own queues have drained, so the host's existing settle seam
//     (ADR-0241 Amendment 1, surface-host.ts `#derive`) composes without a line changed.
import type { RendererHost, RendererOptions, ClientMessageListener } from '@agent-ui/a2ui'

type Op = (host: RendererHost) => void
interface RendererModule {
  createRenderer(options?: RendererOptions): RendererHost
}

let loaded: RendererModule | undefined
let loading: Promise<RendererModule> | undefined

/** The renderer module, fetched once per page. A rejected fetch is forgotten so the next call retries (loader.ts precedent). */
export function loadRenderer(): Promise<RendererModule> {
  loading ??= import("@agent-ui/a2ui").then(
    (m: RendererModule) => (loaded = m),
    (error: unknown) => {
      loading = undefined
      throw error
    },
  )
  return loading
}

/** Ambient warm: renderer.ts calls this when it evaluates, so a page that already has the renderer for another reason gets the real one at once. */
export function provideRenderer(createRenderer: RendererModule['createRenderer']): void {
  loaded ??= { createRenderer }
}

/** A renderer host that is usable at once: the real one when the module is already here, else a recording facade. */
export function createLazyRenderer(options?: RendererOptions): RendererHost {
  return loaded === undefined ? new LazyRenderer(options) : loaded.createRenderer(options)
}

class LazyRenderer implements RendererHost {
  #real: RendererHost | undefined
  #ops: Op[] = []
  #waiters: Array<() => void> = []
  #closed = false // disposed, or the module failed to load: held calls are gone and later calls are no-ops

  constructor(options?: RendererOptions) {
    loadRenderer().then(
      (m) => {
        if (this.#closed) return
        const real = m.createRenderer(options)
        this.#real = real
        const held = this.#ops
        this.#ops = []
        for (const op of held) op(real)
        this.#release(real)
      },
      () => {
        // Prototype: the design reports this once through onClientMessage as a RENDERER_LOAD error (a new ErrorCode).
        this.#closed = true
        this.#ops = []
        this.#release(undefined)
      },
    )
  }

  #run(op: Op): void {
    if (this.#real !== undefined) op(this.#real)
    else if (!this.#closed) this.#ops.push(op)
  }

  /** Parked `settled()` callers wake once the replay is done and the real renderer has nothing left held back. */
  #release(real: RendererHost | undefined): void {
    for (const wake of this.#waiters.splice(0)) {
      if (real === undefined) wake()
      else void real.settled().then(wake)
    }
  }

  register(...args: Parameters<RendererHost['register']>): void {
    this.#run((h) => h.register(...args))
  }

  mount(rootEl: HTMLElement): void {
    this.#run((h) => h.mount(rootEl))
  }

  ingest(line: string): void {
    this.#run((h) => h.ingest(line))
  }

  ingestMessage(message: Parameters<RendererHost['ingestMessage']>[0]): void {
    this.#run((h) => h.ingestMessage(message))
  }

  onClientMessage(listener: ClientMessageListener): () => void {
    let cancelled = false
    let unsubscribe: (() => void) | undefined
    this.#run((h) => {
      if (!cancelled) unsubscribe = h.onClientMessage(listener)
    })
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }

  preload(catalogId: string): Promise<void> {
    if (this.#real !== undefined) return this.#real.preload(catalogId)
    return new Promise<void>((resolve, reject) => {
      if (this.#closed) return resolve()
      this.#run((h) => void h.preload(catalogId).then(resolve, reject))
    })
  }

  get pending(): boolean {
    return this.#real !== undefined ? this.#real.pending : this.#ops.length > 0
  }

  settled(): Promise<void> {
    if (this.#real !== undefined) return this.#real.settled()
    if (this.#closed || this.#ops.length === 0) return Promise.resolve()
    return new Promise<void>((resolve) => void this.#waiters.push(resolve))
  }

  finalize(surfaceId?: string): void {
    this.#run((h) => h.finalize(surfaceId))
  }

  dispose(): void {
    if (this.#closed) return
    this.#closed = true
    this.#ops = []
    this.#real?.dispose()
    this.#release(undefined)
  }
}
