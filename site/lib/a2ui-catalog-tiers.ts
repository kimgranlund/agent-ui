// site/lib/a2ui-catalog-tiers.ts — the A2UI Catalog page's TIER taxonomy (owner-approved 2026-08-15 audit,
// GH #970): groups the browsable default-catalog component types (60 as of GH #1209's Video/AudioPlayer additions) into
// five page-level tabs — WIDGET · PRIMITIVE · PATTERN · FEATURE · INPUT — plus the type→gallery-example
// cross-link derivation the page's "see it in real use" links ride. The exact count is DERIVED
// (`browsableNames().length`, gated by a2ui-catalog-tiers.test.ts) — this comment is a rough orientation
// figure only, not a re-asserted fact a future addition must remember to bump.
//
// The taxonomy itself (which type sits in which tier) is an authored editorial judgment: no wire-level
// "tier" field exists on a catalog component to derive it from (catalog/types.ts carries no such field —
// the component descriptors' OWN `tier:` frontmatter is a different axis entirely, the geometry size-class
// partition [control/indicator/range/display/container/layout/pattern], unrelated to this page-grouping
// taxonomy). Kept as ONE hand-maintained table, gated by a completeness check (a2ui-catalog-tiers.test.ts)
// so a future catalog addition that forgets a tier home fails the gate loudly rather than silently falling
// through the page. A straddler (Calendar, Menu) gets exactly ONE row — its primary home, per the
// ticket's "one home each" acceptance bullet; an *Item/*Pane companion (MenuItem, SwiperItem, SplitPane,
// TimelineItem) rides with its owning compound's tier. (Segment, once the third straddler, moved to
// NESTED_ONLY 2026-08-19 — GH #1332, see the set's own comment above.)
//
// The gallery cross-link half (`seedsUsingType`) IS derived, never hand-listed: it walks every `allSeeds`
// (ADR-0055) message stream for the real component TYPES it renders.
import { defaultCatalog } from '@agent-ui/a2ui'
import { allSeeds } from '@agent-ui/a2ui/examples'
import type { ExampleSeed } from '@agent-ui/a2ui/examples'
import { seedAnchorId } from './a2ui-gallery.ts'

/** Sub-part types that only make sense INSIDE their owner (Select's Options, Tabs' Tab/TabPanel, Card's
 *  regions, SegmentedControl's Segments) — folded into the owner's sample content rather than
 *  browsable/tiered as standalone entries
 *  (a2ui-catalog.ts's pre-existing rule; kept here too so the tier table's completeness check reads the
 *  SAME excluded set the page filters by).
 *  Segment joined 2026-08-19 (GH #1332): a standalone ui-segment has no visual identity BY THE CONTROL'S
 *  OWN RULED ARCHITECTURE — segment.css deliberately owns no chrome ("every sized value a segment renders
 *  is the HOST segmented-control's own token chain, consumed via a descendant compound selector",
 *  ADR-0095 cl.3 / the ADR-0086 group-restyles-its-children split), so its card rendered bare text and
 *  `checked` painted nothing (B4=1, C3=2, both modes). Radio is the deliberate CONTRAST that stays
 *  browsable: radio.css owns its own ::before ring + ::after dot, so a lone Radio is legible. The
 *  membership discriminator is chrome OWNERSHIP, not family membership. */
export const NESTED_ONLY: ReadonlySet<string> = new Set(['Option', 'Tab', 'TabPanel', 'CardHeader', 'CardContent', 'CardFooter', 'Segment'])

/** The five page-level tabs (owner-approved 2026-08-15 audit) — declaration order IS tab/display order. */
export type Tier = 'WIDGET' | 'PRIMITIVE' | 'PATTERN' | 'FEATURE' | 'INPUT'
export const TIERS: readonly Tier[] = ['WIDGET', 'PRIMITIVE', 'PATTERN', 'FEATURE', 'INPUT']
export const TIER_LABEL: Readonly<Record<Tier, string>> = {
  WIDGET: 'Widget',
  PRIMITIVE: 'Primitive',
  PATTERN: 'Pattern',
  FEATURE: 'Feature',
  INPUT: 'Input',
}

/** One tier home per browsable catalog type (every `defaultCatalog.components` key outside NESTED_ONLY).
 *  Completeness (every browsable name present, no stray dead names) is gated by a2ui-catalog-tiers.test.ts,
 *  not by this table itself — a merge-time invariant, not a runtime one (see `tierOf`'s fallback below). */
export const TIER_OF: Readonly<Record<string, Tier>> = {
  // PRIMITIVE (8) — the irreducible display/layout building blocks the rest compose from.
  Card: 'PRIMITIVE',
  Column: 'PRIMITIVE',
  Field: 'PRIMITIVE',
  Grid: 'PRIMITIVE',
  Icon: 'PRIMITIVE',
  List: 'PRIMITIVE',
  Row: 'PRIMITIVE',
  Text: 'PRIMITIVE',

  // INPUT (13) — form-associated / value-committing controls. Radio carries no independent A2UI `value`
  // mark of its own (its group does) but rides with its owning family here — a reader browsing "Input"
  // for "Radio" expects to find it beside RadioGroup, not filed under Widget. It stays browsable (unlike
  // Segment, NESTED_ONLY since GH #1332) because radio.css owns its own indicator chrome — a lone Radio
  // is standalone-legible.
  Checkbox: 'INPUT',
  // ChoiceGroup/ChoiceCard (ADR-0220, GH #1368): a form-associated, value-committing selection container
  // over rich option cards — the RadioGroup/Radio precedent exactly (ChoiceCard rides with its owning
  // ChoiceGroup; it stays browsable, unlike Segment, because choice-card.css owns its own border/radius/
  // padding/selected-frame chrome — a lone ChoiceCard is standalone-legible).
  ChoiceGroup: 'INPUT',
  ChoiceCard: 'INPUT',
  ColorPicker: 'INPUT',
  ComboBox: 'INPUT',
  // FileDrop (ADR-0210, GH #1391): a form-associated file-input affordance under the host-mediated
  // handle model — the TextField/Textarea value-committing precedent.
  FileDrop: 'INPUT',
  MultiSelect: 'INPUT',
  Radio: 'INPUT',
  RadioGroup: 'INPUT',
  // Rating (ADR-0216, GH #1395): a UIRangeElement-based value-committing input (the Slider precedent) —
  // display use is the SAME row with readonly:true, not a separate tier.
  Rating: 'INPUT',
  SegmentedControl: 'INPUT',
  Select: 'INPUT',
  Slider: 'INPUT',
  SliderMulti: 'INPUT',
  // Suggestions (ADR-0213, GH #1393): not form-associated, but a real value-committing choice leaf
  // (`value:{prop:'selected',event:'select'}`) — the choice-control INPUT class, not a Toggle-class
  // (no-value-mark) WIDGET.
  Suggestions: 'INPUT',
  Switch: 'INPUT',
  TextField: 'INPUT',
  Textarea: 'INPUT',

  // FEATURE (5) — the big, self-sufficient surfaces: a whole data table, a date engine, a form-coordination
  // provider, a slide-out panel, a chronology feed.
  Calendar: 'FEATURE',
  Drawer: 'FEATURE',
  FormProvider: 'FEATURE',
  Table: 'FEATURE',
  Timeline: 'FEATURE',

  // WIDGET (24, the derived true count as of this wave — the header comment's own note stands: this
  // figure is orientation only, never gated) — small, self-contained display/utility leaves.
  Attachment: 'WIDGET',
  Avatar: 'WIDGET',
  Badge: 'WIDGET',
  DescriptionList: 'WIDGET', // ADR-0201 (GH #1185) — the key–value receipt primitive, a display leaf like Stat/Badge
  BarChart: 'WIDGET',
  Button: 'WIDGET',
  Code: 'WIDGET',
  ColumnChart: 'WIDGET', // ADR-0229 cl.1/cl.2 (GH #1568) — the stacked/dense-series column mark, a display leaf riding with its BarChart/Sparkline/LineChart/PieChart chart-family kin
  Gauge: 'WIDGET', // ADR-0229 cl.4 (GH #1568) — the multi-ring radial progress mark, a display leaf riding with its chart-family kin (never part-of-whole, unlike PieChart)
  Image: 'WIDGET',
  Video: 'WIDGET',
  AudioPlayer: 'WIDGET', // GH #1189 — the URL-sourced content-image primitive, a display leaf like Avatar/Attachment (no ADR — conventional admission, host ruling)
  Ladder: 'WIDGET',
  LineChart: 'WIDGET', // ADR-0205 (GH #1207) — the fleet's first axis-bearing chart, a display leaf riding with its Sparkline/BarChart chart-family kin
  Pagination: 'WIDGET',
  PieChart: 'WIDGET', // ADR-0219 (GH #1397) — the part-of-whole mark, a display leaf riding with its Sparkline/BarChart/LineChart chart-family kin
  Progress: 'WIDGET',
  Ramp: 'WIDGET',
  SourceList: 'WIDGET', // ADR-0214 (GH #1394) — source attribution, a hardened aggregate display leaf like DescriptionList/Stat/Badge
  Sparkline: 'WIDGET',
  Stat: 'WIDGET',
  Swatch: 'WIDGET',
  Toast: 'WIDGET',
  // Toggle (GH #1352, ADR-0179 GH #686 Amendment S7-a): a pressed-state pill BUTTON, not form-associated
  // and carrying no `value` mark (Fork T1) — WIDGET, the Button precedent, not INPUT (this ticket's own
  // tentative "presumably INPUT" guess doesn't hold once the descriptor shows it's neither form-
  // associated nor value-committing; INPUT's own header comment above scopes to exactly those two).
  Toggle: 'WIDGET',

  // PATTERN (14) — composite, multi-part interactive constructs. An *Item/*Pane companion rides with its
  // owning compound: MenuItem→Menu, SwiperItem→Swiper, SplitPane→Split, TimelineItem→Timeline's per-row
  // anatomy (Timeline itself is FEATURE-class as the whole chronology surface; its row is PATTERN-class,
  // the same composite-row shape as MenuItem/SwiperItem).
  // Drill (GH #1353, ADR-0195 GH #954): the N-level drill-down panel container — a composite,
  // multi-part interactive construct (header+back+heading anatomy, per-panel resolution), the
  // Tabs/Split/Swiper class, not a display leaf.
  Drill: 'PATTERN',
  DrillPanel: 'PATTERN', // rides with Drill, the SplitPane/SwiperItem precedent
  Disclosure: 'PATTERN',
  FormPopover: 'PATTERN',
  Menu: 'PATTERN',
  MenuItem: 'PATTERN',
  Modal: 'PATTERN',
  Popover: 'PATTERN',
  // ServiceCard (ADR-0224, GH #1429): the availability-stated service/agent launch card — a composite,
  // multi-part construct (title+path+description+status dot+action+optional menu slot), the SAME
  // Drill/Tabs/Split "composite, multi-part" class this section names, not a WIDGET display leaf: it
  // carries a real interactive action affordance (Open⟷Unavailable) plus an app-composed overflow slot.
  ServiceCard: 'PATTERN',
  // Breadcrumb (GH #1515, the frozen design intake): a composite, multi-part construct (ordered crumb
  // children + an injected separator + an optional composed overflow ui-menu fold) — the same
  // Drill/Tabs/ServiceCard "composite, multi-part" class, not a WIDGET display leaf.
  Breadcrumb: 'PATTERN',
  Split: 'PATTERN',
  SplitPane: 'PATTERN',
  Swiper: 'PATTERN',
  SwiperItem: 'PATTERN',
  Tabs: 'PATTERN',
  TimelineItem: 'PATTERN',
  Toolbar: 'PATTERN',
  Tooltip: 'PATTERN',
}

/** The browsable catalog type names — DERIVED from the shipped catalog (never hand-listed), mirroring
 *  a2ui-catalog.ts's own pre-existing filter. */
export function browsableNames(): string[] {
  return Object.keys(defaultCatalog.components)
    .filter((name) => !NESTED_ONLY.has(name))
    .sort((a, b) => a.localeCompare(b))
}

/** One catalog type's tier home. Falls back to `'PATTERN'` (the broadest, catch-all bucket) for a name the
 *  table hasn't caught up to yet — NEVER thrown at page-render time, so a drifted table degrades a live
 *  page's grouping rather than breaking it; a2ui-catalog-tiers.test.ts's completeness check is what actually
 *  enforces "every entry has exactly one tier home" before merge. */
export function tierOf(name: string): Tier {
  return TIER_OF[name] ?? 'PATTERN'
}

/** Every catalog component TYPE a seed's message stream renders — walks its `updateComponents` envelopes
 *  (never hand-listed; ADR-0055's own shelf is the only input). */
function typesInSeed(seed: ExampleSeed): Set<string> {
  const types = new Set<string>()
  for (const message of seed.messages) {
    if ('updateComponents' in message) {
      for (const component of message.updateComponents.components) types.add(component.component)
    }
  }
  return types
}

let seedsByType: ReadonlyMap<string, readonly string[]> | undefined

/** type → the gallery seed NAMES that actually render it, in shelf order — DERIVED from `allSeeds` (never
 *  hand-listed), memoized once (the shelf is static within a page load). */
export function seedsUsingType(type: string): readonly string[] {
  if (!seedsByType) {
    const index = new Map<string, string[]>()
    for (const seed of allSeeds) {
      for (const t of typesInSeed(seed)) {
        const list = index.get(t)
        if (list) list.push(seed.name)
        else index.set(t, [seed.name])
      }
    }
    seedsByType = index
  }
  return seedsByType.get(type) ?? []
}

/** The `./a2ui-gallery.html#…` cross-link href for one seed — the ONE place this URL shape is built, so a
 *  future gallery route change has one edit site. */
export function seedGalleryHref(seedName: string): string {
  return `./a2ui-gallery.html#${seedAnchorId(seedName)}`
}
