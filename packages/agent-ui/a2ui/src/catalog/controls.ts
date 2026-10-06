// controls.ts: the built-in catalogs' control loader (ADR-0233).
//
// Catalog factory modules import no control. The renderer registers the default catalog and both a2ui-basic
// ids with `builtinControls` (persona entries inherit it through `composeControlLoaders`), so a surface
// defines exactly the controls its messages name, on demand, before the renderer creates them.
//
// `css: 'host'` keeps the host-page contract (ADR-0003): the host links `foundation-styles.css`,
// `shared-styles.css` and the control sheets (or `all.css`); the loader never touches `document.head`, so
// a jsdom test never waits on a `<link>` that jsdom never loads.
//
// A few factory tags are sub-elements their family's entry module defines on import (`ui-card` defines
// its three regions, `ui-tabs` its tab and panel, `ui-drill` its panel). The generated registry holds one
// record per descriptor and lists such a family's sub-tags in the record's `defines` (the descriptor's
// `defines:` block, ADR-0233), so `BUILTIN_CONTROL_RECORDS` adds an alias record per declared sub-tag that
// loads the family module. `builtin-controls.test.ts` fails when a shipped factory tag has no record here.

import { CONTROLS } from '@agent-ui/components/registry'
import { createControlLoader } from '@agent-ui/components/loader'
import type { ControlLoader, ControlRecord } from '@agent-ui/components/loader'

/** `records` plus one alias record per `defines` sub-tag, each loading the family module that defines it. */
export function withSubTags(records: Readonly<Record<string, ControlRecord>>): Readonly<Record<string, ControlRecord>> {
  const out: Record<string, ControlRecord> = { ...records }
  for (const record of Object.values(records)) {
    for (const tag of record.defines ?? []) out[tag] = { tag, load: record.load }
  }
  return out
}

/** Every record the built-in loader serves: the fleet registry plus the sub-element aliases. */
export const BUILTIN_CONTROL_RECORDS: Readonly<Record<string, ControlRecord>> = withSubTags(CONTROLS)

/** The control loader the renderer registers for the built-in catalogs (host-styled). */
export const builtinControls: ControlLoader = createControlLoader(BUILTIN_CONTROL_RECORDS, { css: 'host' })
