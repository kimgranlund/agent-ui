// registry.ts — the two-tier icon registry (LLD-C2, ADR-0065 clause 2/5): packs + a pack-independent
// override map. `body()` is the ONE place resolution precedence is decided (override map first, then
// the active pack) — `resolve.ts` reads it rather than reimplementing the lookup. Deliberately
// signal-free (ADR-0065 clause 4(b)): live pack-swap reactivity is a later, separate extension so this
// package never imports the components kernel and inverts the `components -> icons` arrow.

import type { IconName, IconPack } from './types.ts'

export interface IconRegistry {
  /** Store by `pack.id`. A duplicate id is a last-wins override (`console.warn`ed); the FIRST pack ever
   *  registered into an empty registry becomes active. */
  registerPack(pack: IconPack): void
  /** Switch the active pack by id. Throws if `id` is unknown. */
  setActivePack(id: string): void
  activePack(): IconPack | null
  /** A registry-level, pack-independent override for a single name. Does NOT mutate the pack object,
   *  so it shadows whatever pack is active — including across a later `setActivePack`. */
  overrideIcon(name: IconName, body: string): void
  /** The resolution read: override map first, then the active pack's body; `null` if neither has it. */
  body(name: IconName): string | null
}

export class Registry implements IconRegistry {
  readonly #packs = new Map<string, IconPack>()
  readonly #overrides = new Map<IconName, string>()
  #activeId: string | null = null

  registerPack(pack: IconPack): void {
    if (this.#packs.has(pack.id)) {
      console.warn(`[@agent-ui/icons] pack "${pack.id}" re-registered — last registration wins`)
    } else if (this.#activeId === null) {
      this.#activeId = pack.id
    }
    this.#packs.set(pack.id, pack)
  }

  setActivePack(id: string): void {
    if (!this.#packs.has(id)) {
      throw new Error(`[@agent-ui/icons] setActivePack: unknown pack id "${id}"`)
    }
    this.#activeId = id
  }

  activePack(): IconPack | null {
    if (this.#activeId === null) return null
    return this.#packs.get(this.#activeId) ?? null
  }

  overrideIcon(name: IconName, body: string): void {
    this.#overrides.set(name, body)
  }

  body(name: IconName): string | null {
    const override = this.#overrides.get(name)
    if (override !== undefined) return override
    return this.activePack()?.icons[name] ?? null
  }
}

/** The default singleton — what `resolveIcon`/`setIcon`/`ui-icon` read by default. */
export const iconRegistry: IconRegistry = new Registry()
