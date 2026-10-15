p='packages/agent-ui/a2ui/src/catalog/compose.ts'
s=open(p).read()
def rep(old,new):
    global s
    assert s.count(old)==1, old
    s=s.replace(old,new)

rep("""// `sanitizeCatalog` which base it derived from.

import { validateComponent""","""// `sanitizeCatalog` which base it derived from.
//
// Control loaders (ADR-0233). A persona package may ship `controls` records for controls outside
// `@agent-ui/components`; the derived entry's loader (`composeControlLoaders`) routes those tags to a loader
// over the persona records and every other tag to the base entry's loader. `@agent-ui/components/loader` is
// DOM-free at module top level, so this module stays importable from the Node and Workers tools that run
// the DOM-less compose step (`composePersonaCatalogDocs`, GH #516).

import { createControlLoader } from '@agent-ui/components/loader'
import type { ControlLoader, ControlRecord } from '@agent-ui/components/loader'
import { validateComponent""")

rep("""  /** Which registered base(s) this fragment composes onto — `agent-ui` and/or `a2ui-basic` (SPEC-N5, widened). */
  targetCatalogs?: readonly string[]
}

const DEFAULT_TARGET_CATALOGS""","""  /** Which registered base(s) this fragment composes onto — `agent-ui` and/or `a2ui-basic` (SPEC-N5, widened). */
  targetCatalogs?: readonly string[]
  /** ADR-0233: lazy records for the persona's own controls (outside `@agent-ui/components`). The derived
   *  entry's loader serves these tags; the host styles them (`'host'` mode). */
  controls?: readonly ControlRecord[]
}

/** `records` keyed by tag. */
function byTag(records: readonly ControlRecord[]): Record<string, ControlRecord> {
  const out: Record<string, ControlRecord> = {}
  for (const record of records) out[record.tag] = record
  return out
}

/**
 * The derived entry's control loader (ADR-0233): a tag with a persona record goes to a loader over the
 * persona records (`css: 'host'`), every other tag to `base`. `base` alone when the persona ships no
 * records; `undefined` when both are absent. With records but no base loader, a missing non-persona tag
 * rejects as unknown.
 */
export function composeControlLoaders(base: ControlLoader | undefined, records: readonly ControlRecord[] | undefined): ControlLoader | undefined {
  if (records === undefined || records.length === 0) return base
  const own = byTag(records)
  const persona = createControlLoader(own, { css: 'host' })
  const rest = base ?? createControlLoader({}, { css: 'host' })
  const split = (tags: Iterable<string>): [string[], string[]] => {
    const mine: string[] = []
    const others: string[] = []
    for (const tag of new Set(tags)) (Object.hasOwn(own, tag) ? mine : others).push(tag)
    return [mine, others]
  }
  return {
    missing(tags) {
      const [mine, others] = split(tags)
      return [...persona.missing(mine), ...rest.missing(others)]
    },
    async ensure(tags) {
      const [mine, others] = split(tags)
      await Promise.all([persona.ensure(mine), rest.ensure(others)])
    },
  }
}

const DEFAULT_TARGET_CATALOGS""")

rep("""      const functions =
        entry.functions !== undefined || persona.functions !== undefined ? { ...entry.functions, ...persona.functions } : undefined
      registry.register(derived, factories, functions)""","""      const functions =
        entry.functions !== undefined || persona.functions !== undefined ? { ...entry.functions, ...persona.functions } : undefined
      registry.register(derived, factories, functions, composeControlLoaders(entry.controls, persona.controls))""")
open(p,'w').write(s)
print('ok')
