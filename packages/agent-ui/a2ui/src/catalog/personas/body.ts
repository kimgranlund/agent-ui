// body.ts: the shipped persona packages' lazy body (ADR-0241 cl.2, cl.8). `records.ts` reaches this module only
// through `import()`, so the persona packages and the compose step load the first time a surface names a derived
// `<base>--<persona>` id, never with the renderer. A compose collision now surfaces here, at load time;
// `records.test.ts` composes every shipped persona against the real bases, so a collision cannot ship.

import { composePersonaEntry } from '../compose.ts'
import type { CatalogEntry } from '../types.ts'
import { SHIPPED_PERSONA_CATALOGS } from './index.ts'

/** Shipped persona `personaId` composed over `base`. Throws on an unknown persona or a compose collision. */
export function shippedPersonaEntry(personaId: string, base: CatalogEntry): CatalogEntry {
  const persona = SHIPPED_PERSONA_CATALOGS.find((p) => p.personaId === personaId)
  if (persona === undefined) throw new Error(`no shipped persona "${personaId}"`)
  return composePersonaEntry(base, persona)
}
