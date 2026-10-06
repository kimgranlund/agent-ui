// dogfood-inventory.ts — genui-surface.spec.md SPEC-R13(b): the DERIVED fleet inventory the dogfood
// prompt segment teaches (LLD-C3) — one line per `ui-*` control, read from the SAME `{name}.md`
// descriptor frontmatter ADR-0004 already establishes as each component's public-surface contract,
// plus each compound family's sibling tags scanned from its own `.define('ui-x'` call sites (GH #346's
// ruling — `deriveDogfoodFleet`'s own note in `dogfood-descriptor.ts` carries the mechanics and the reason).
//
// LLD-C3's own text names "the ONE ADR-0004 parser (`@agent-ui/components/descriptor`)" — but that
// import is a BARE package specifier, and `gates.test.ts`'s ADR-0137 clause-8 SDK-FREE/ZERO-DEP leg
// (measured RED against this exact import while building this module) holds `src/agent/` to relative-
// or-`node:*`-only specifiers, no exception: the package-layering lawfulness LLD-C3 cites (a2ui already
// depends on components) is a DIFFERENT axis from this internal zero-dep fence, which the LLD did not
// anticipate. Rather than widen a deliberately narrow, already-ratified gate, `dogfood-descriptor.ts` carries a
// LOCAL, MINIMAL reader for exactly the two fields it needs (`tag:` + `attributes[].{name,type,values}`)
// — the SAME local-copy resolution `catalog/conformance.ts`'s `SAFE_HREF_SCHEMES` already establishes in
// this codebase for an analogous reachability constraint. It reads the REAL committed `.md` text (never
// hand-transcribed data), so SPEC-R13(b)'s drift-free derivation guarantee holds exactly as designed —
// only the PARSER is local, not the data. That claim is BACKED by a standing parity test
// (`dogfood-inventory-parity.test.ts`, `src/live-agent/` — the real `@agent-ui/components/descriptor`
// parser is a lawful import THERE, outside the `src/agent/` fence), not merely asserted: it runs both
// parsers over every real committed descriptor and asserts attribute-for-attribute agreement. A first
// cut of this reader shipped WITHOUT that test and disagreed with the real parser on 4 real attributes
// (a QUOTED empty-string enum member, `''` — ADR-0083's `landmark` edge case — unquoted by the real
// parser's `addField`, left quoted-verbatim here) — independent review caught it; the parity test now
// holds the "only the parser is local" claim to its word going forward.
//
// NEVER byte-captured: a fleet edit (a new control, a changed attribute, reworded descriptor prose)
// changes this function's OUTPUT on the next regeneration of `dogfood-fleet.gen.ts`, with no baseline to
// re-capture —
// `prompt-drift.test.ts`'s inventory leg is the drift gate that holds it honest (ADR-0071's discipline,
// extended here to a non-catalog surface: the fleet's WHOLE `controls/` barrel, not the a2ui catalog's
// subset).
//
// SECOND SOURCE, the selection clause (ADR-0232 amendment, T-0008): a row whose tag maps to a default
// catalog type (`catalogTypeForTag`) also carries that type's `default/selection.json` guidance as
// ` · use: <intents> · not for: <ui-tag> (<why>), ...`, the catalog inventory's clause with each `notFor`
// target re-spelled as the taught `ui-*` tag. So a default-sidecar edit ALSO moves this never-byte-
// captured output; `prompt-drift.test.ts` holds the clause shape and its own budget
// (`DOGFOOD_GUIDANCE_CHAR_BUDGET`). An edge to a type no taught tag names (`Option`, `MenuItem`: their
// factories are `div[role=...]`, not `ui-*`) throws `UNRESOLVED`, never drops silently. Base `agent-ui`
// guidance only: persona sidecars are written against their persona catalog, so they stay out.
//
// No filesystem at run time (ADR-0236): the descriptor walk runs at build time in
// `scripts/generate-agent-assets.mjs`, which derives the rows through `deriveDogfoodFleet`
// (`dogfood-descriptor.ts`) and embeds them as `DOGFOOD_FLEET` in `dogfood-fleet.gen.ts`. This module only
// renders those rows, so it imports no `node:*` builtin and runs unchanged in the Cloudflare Worker. A
// descriptor edit reaches the output after `node scripts/generate-agent-assets.mjs`; until then
// `agent-assets-freshness.test.ts` and `npm run check` stay red.

import { DOGFOOD_FLEET } from './dogfood-fleet.gen.ts'
import {
  renderSelectionClauseWith,
  selectionGuidanceForId,
  SelectionGuidanceError,
  SelectionGuidanceErrorCode,
} from './selection-guidance.ts'
import type { SelectionEntry } from './selection-guidance.ts'

/** SPEC-R13(b) — the derived-inventory budget: ≤ 16 700 chars (the SPEC-R9 pack-tier's double, since
 *  this segment teaches the WHOLE fleet, not one exemplar pack). Evidence-revisable per SPEC §8;
 *  enforced by a standing test (`prompt-drift.test.ts`), never by runtime truncation — the derived
 *  output is the fleet's whole truth or nothing, never a silently-clipped subset.
 *  REVISED 2026-08-18 (GH #1209): 16 000 → 16 500 — measured 16 336 after the ui-video/ui-audio media
 *  mint (+2 controls); the movers are the two new descriptor role lines, evidence per SPEC §8.
 *  REVISED 2026-08-19 (ADR-0219/GH #1397): 16 500 → 16 700 — measured 16 537 after the ui-pie-chart
 *  control-mint (the chart family's fourth control); the mover is the one new descriptor role line,
 *  evidence per SPEC §8. */
// 2026-08-19 merge rebase: measured 17151 on the tree carrying ui-pie-chart (ADR-0219/GH #1397),
// ui-suggestions (ADR-0213/GH #1393), ui-file-drop (ADR-0210/GH #1391), ui-rating (ADR-0216/GH #1395)
// AND ui-choice-group/ui-choice-card (ADR-0220/GH #1398) descriptors — the full 2026-08-19 nine-ADR
// campaign wave; budget 18_100 (measured 17958 + headroom; SPEC-R13(b) budget line bumped in the same
// change per genui-surface.spec.md §8 — a SPEC version bump, not silent drift).
// 2026-08-19 (ADR-0223 slice 2, GH #1426 + ADR-0224/GH #1429, merged at the desk): the seven
// action/selection controls' `inline` descriptor attribute rows (measured 18179) AND the
// ui-service-card control mint (measured 18296 pre-slice-2) both ride the inventory; budget 18_600
// (combined measured + headroom, GH #1209 format; evidence per SPEC §8 — genui-surface.spec.md v0.8
// amendment, same change — never silent drift).
// 2026-08-19 (ADR-0225/GH #1478, ui-playing-card mint): the new descriptor (rank/suit/faceDown/size,
// four attributes) rides the inventory; measured 18706, budget 19_000 (measured + headroom; evidence
// per SPEC §8 — genui-surface.spec.md v0.9 amendment, same change — never silent drift).
// 2026-08-21 (ADR-0228/ADR-0229, GH #1565, svg-charts wave 1 — ui-column-chart mint): the new
// descriptor (data/series/label/projected/highlight, five attributes) rides the inventory; measured
// 19180, budget 19_600 (measured + headroom; evidence per SPEC §8 — genui-surface.spec.md v0.10
// amendment, same change — never silent drift).
// MEASURED 2026-10-05: 27 820 chars after the selection clause rides each catalog-mapped row (T-0008, the
// mover; ADR-0232 amendment); budget 28 200 (measured rounded up to the next 100, plus 300), per the
// SPEC-R13(b) v0.11 amendment in genui-surface.spec.md.
export const DOGFOOD_INVENTORY_CHAR_BUDGET = 28_200

/** The character budget for the selection clauses the dogfood inventory carries: the sum of the clause
 *  lengths `dogfoodInventory()` appends to its rows. Held by a `prompt-drift.test.ts` leg, never by runtime
 *  truncation: an over-budget sidecar is re-authored tersely, never silently clipped.
 *  MEASURED 2026-10-05: 8 479 chars over 72 rows (144 notFor edges); budget 8 800 (Kim 2026-10-05; ADR-0232 cl.5 formula) */
export const DOGFOOD_GUIDANCE_CHAR_BUDGET = 8_800

/** Every tag the inventory TEACHES, tag-sorted — each descriptor's own `tag:` scalar PLUS the family
 *  siblings that ride its row (GH #346). The "inventory-taught tags" half of SPEC-R13 AC2's set-equality
 *  gate (LLD-C5), exposed standalone so that gate never has to re-parse the composed prose to recover
 *  the tag set. */
export function dogfoodInventoryTags(): readonly string[] {
  return DOGFOOD_FLEET
    .flatMap((c) => [c.tag, ...c.siblings])
    .sort()
}

/** A `ui-*` tag's default-catalog type id: the fleet's one rule (`catalog/default/index.test.ts`), the
 *  tag minus its `ui-` prefix with each kebab segment PascalCased, plus the single rename `ui-audio` to
 *  `AudioPlayer` (GH #1209). Pure; `dogfood-inventory-parity.test.ts` holds it equal to every
 *  `defaultFactories` entry's own `WidgetFactory.tag`. */
export function catalogTypeForTag(tag: string): string {
  if (tag === 'ui-audio') return 'AudioPlayer'
  return tag
    .replace(/^ui-/, '')
    .split('-')
    .map((seg) => (seg.length === 0 ? seg : seg[0]!.toUpperCase() + seg.slice(1)))
    .join('')
}

/** Catalog type to the taught tag that names it, over `taught` (the FULL fleet's tags, family siblings
 *  included). An unmapped type throws `UNRESOLVED`. */
function tagLabeller(taught: readonly string[]): (type: string) => string {
  const tagByType = new Map(taught.map((t) => [catalogTypeForTag(t), t]))
  return (type) => {
    const tag = tagByType.get(type)
    if (tag !== undefined) return tag
    throw new SelectionGuidanceError(
      SelectionGuidanceErrorCode.UNRESOLVED,
      `SELECTION_GUIDANCE_UNRESOLVED: notFor target "${type}" has no taught ui-* tag in the dogfood inventory; fix catalogTypeForTag or the sidecar edge, not the dogfood renderer`,
    )
  }
}

/** The dogfood twin of `renderSelectionClause`: one entry's clause with each `notFor` target named by
 *  its taught `ui-*` tag, resolved over the full `dogfoodInventoryTags()` set. `''` for a missing entry;
 *  an unresolvable edge throws `UNRESOLVED`. Exported as the drift gate's planting seam. */
export function dogfoodSelectionClause(entry: SelectionEntry | undefined): string {
  if (entry === undefined) return ''
  return renderSelectionClauseWith(entry, tagLabeller(dogfoodInventoryTags()))
}

/**
 * The derived fleet inventory (SPEC-R13(b)): one `- <tag> — <summary> (attrs: ...)` line per discovered
 * control, tag-sorted (deterministic — LLD-C3 leaf 8's unit test asserts stable, repeated-call-identical
 * output). A compound family's sibling tags close the line as ` (family: ui-a, ui-b)` — attached to the
 * PARENT descriptor's entry, under its own summary and attrs, because that is the only place the fleet
 * documents them (GH #346); they are never rows of their own, having neither summary nor attributes.
 * `tags`, when given, restricts the rendered rows to that set — the shape LLD-C5's set-equality gate
 * needs to probe both directions (the full discovered set vs. `DOGFOOD_TAGS`, and `DOGFOOD_TAGS`
 * filtered back through this same function); a restricted call filters family members by the SAME set,
 * so the function can never teach a tag the caller did not ask for. The real composition call in
 * `system-prompt.ts`'s `genuiBlock` passes no argument, so a live turn always teaches every control the
 * fleet documents.
 *
 * Selection clause: a row whose `catalogTypeForTag(tag)` has an `agent-ui` sidecar entry carries
 * ` · use: <intents>` and, when the entry has edges, ` · not for: <ui-tag> (<why>), ...` between its
 * `(attrs: ...)` and the optional `(family: ...)`; any other row is unchanged. Edges resolve against the
 * FULL fleet even under `tags`, so an unresolvable edge (`Option`, `MenuItem`) always throws; a restricted
 * call then drops the edges whose target tag is outside `tags`, the same rule as family members (the
 * `use:` half stays).
 */
export function dogfoodInventory(tags?: readonly string[]): string {
  const allow = tags === undefined ? undefined : new Set(tags)
  const discovered = DOGFOOD_FLEET
  const guidance = selectionGuidanceForId('agent-ui')
  const labelFor = tagLabeller(discovered.flatMap((c) => [c.tag, ...c.siblings]))
  const controls = discovered.filter((c) => allow === undefined || allow.has(c.tag)).sort((a, b) => a.tag.localeCompare(b.tag))
  return controls
    .map((c) => {
      const family = allow === undefined ? c.siblings : c.siblings.filter((t) => allow.has(t))
      const familyClause = family.length === 0 ? '' : ` (family: ${family.join(', ')})`
      const type = catalogTypeForTag(c.tag)
      const entry = Object.hasOwn(guidance, type) ? guidance[type] : undefined
      let selectionClause = ''
      if (entry !== undefined) {
        const targets = entry.notFor.map((e) => labelFor(e.type))
        const kept = allow === undefined ? entry : { ...entry, notFor: entry.notFor.filter((_, i) => allow.has(targets[i]!)) }
        selectionClause = renderSelectionClauseWith(kept, labelFor)
      }
      return `- ${c.tag} — ${c.summary} (attrs: ${c.attrs})${selectionClause}${familyClause}`
    })
    .join('\n')
}
