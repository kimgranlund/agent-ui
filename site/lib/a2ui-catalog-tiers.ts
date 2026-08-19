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
// through the page. A straddler (Calendar, Menu, Segment) gets exactly ONE row — its primary home, per the
// ticket's "one home each" acceptance bullet; an *Item/*Pane companion (MenuItem, SwiperItem, SplitPane,
// TimelineItem) rides with its owning compound's tier.
//
// The gallery cross-link half (`seedsUsingType`) IS derived, never hand-listed: it walks every `allSeeds`
// (ADR-0055) message stream for the real component TYPES it renders.
import { defaultCatalog } from '@agent-ui/a2ui'
import { allSeeds } from '@agent-ui/a2ui/examples'
import type { ExampleSeed } from '@agent-ui/a2ui/examples'
import { seedAnchorId } from './a2ui-gallery.ts'

/** Sub-part types that only make sense INSIDE their owner (Select's Options, Tabs' Tab/TabPanel, Card's
 *  regions) — folded into the owner's sample content rather than browsable/tiered as standalone entries
 *  (a2ui-catalog.ts's pre-existing rule; kept here too so the tier table's completeness check reads the
 *  SAME excluded set the page filters by). */
export const NESTED_ONLY: ReadonlySet<string> = new Set(['Option', 'Tab', 'TabPanel', 'CardHeader', 'CardContent', 'CardFooter'])

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

  // INPUT (14) — form-associated / value-committing controls. Radio/Segment carry no independent A2UI
  // `value` mark of their own (their group does) but ride with their owning family here — a reader browsing
  // "Input" for "Radio" expects to find it beside RadioGroup, not filed under Widget.
  Checkbox: 'INPUT',
  ColorPicker: 'INPUT',
  ComboBox: 'INPUT',
  MultiSelect: 'INPUT',
  Radio: 'INPUT',
  RadioGroup: 'INPUT',
  Segment: 'INPUT',
  SegmentedControl: 'INPUT',
  Select: 'INPUT',
  Slider: 'INPUT',
  SliderMulti: 'INPUT',
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

  // WIDGET (18) — small, self-contained display/utility leaves.
  Attachment: 'WIDGET',
  Avatar: 'WIDGET',
  Badge: 'WIDGET',
  DescriptionList: 'WIDGET', // ADR-0201 (GH #1185) — the key–value receipt primitive, a display leaf like Stat/Badge
  BarChart: 'WIDGET',
  Button: 'WIDGET',
  Code: 'WIDGET',
  Image: 'WIDGET',
  Video: 'WIDGET',
  AudioPlayer: 'WIDGET', // GH #1189 — the URL-sourced content-image primitive, a display leaf like Avatar/Attachment (no ADR — conventional admission, host ruling)
  Ladder: 'WIDGET',
  LineChart: 'WIDGET', // ADR-0205 (GH #1207) — the fleet's first axis-bearing chart, a display leaf riding with its Sparkline/BarChart chart-family kin
  Pagination: 'WIDGET',
  Progress: 'WIDGET',
  Ramp: 'WIDGET',
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
  Disclosure: 'PATTERN',
  FormPopover: 'PATTERN',
  Menu: 'PATTERN',
  MenuItem: 'PATTERN',
  Modal: 'PATTERN',
  Popover: 'PATTERN',
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
