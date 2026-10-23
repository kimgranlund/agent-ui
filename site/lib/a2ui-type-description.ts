// site/lib/a2ui-type-description.ts: the one-line description the A2UI Catalog page shows for a catalog type
// (T-0432). Never a hand-written copy: a type of the default agent-ui catalog that binds a ui-* control reads that
// control's descriptor `description:` (the factory's `tag`, the descriptor `{name}.md` frontmatter); every other
// type, and a control whose descriptor carries no description yet, reads its `selection.json` intents through the
// browser-safe selection projection (base, persona and domain sidecars alike, ADR-0232).
import { defaultFactories, splitCatalogId } from '@agent-ui/a2ui'
import { FLEET_CATALOG_ID, selectionProjectionFor } from '@agent-ui/a2ui/registry'
import { loadDescriptorByTag } from './frontmatter.ts'

/** The descriptor description of the ui-* control an agent-ui catalog type renders, or undefined. */
function descriptorDescription(type: string): string | undefined {
  const tag = defaultFactories[type]?.tag
  if (tag === undefined) return undefined
  const text = loadDescriptorByTag(tag)?.descriptor.scalars.get('description')
  return typeof text === 'string' && text.trim() !== '' ? text.trim() : undefined
}

/** The type's selection intents as one sentence, or undefined when its catalog's sidecar does not list it. */
function intentsDescription(catalogId: string, type: string): string | undefined {
  const intents = selectionProjectionFor(catalogId)[type]?.intents ?? []
  if (intents.length === 0) return undefined
  const text = intents.join('; ')
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`
}

/** The description for `type` under `catalogId`: the descriptor's for an agent-ui control type, else the intents. */
export function typeDescription(catalogId: string, type: string): string | undefined {
  const fromDescriptor = splitCatalogId(catalogId).base === FLEET_CATALOG_ID ? descriptorDescription(type) : undefined
  return fromDescriptor ?? intentsDescription(catalogId, type)
}
