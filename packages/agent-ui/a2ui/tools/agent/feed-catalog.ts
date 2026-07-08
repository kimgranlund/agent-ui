// feed-catalog.ts — ADR-0097 §3 / SPEC-R15 / LLD-C14: the feed sub-catalog — a gate-encoded TOTAL
// PARTITION of the default catalog's component types into what a feed-embedded ask MAY host
// (`FEED_SURFACE_TYPES`) and what it MAY NOT (`FEED_EXCLUDED`, each entry carrying a recorded reason).
//
// This is the single hand-authored source every enforcement point derives from — never a re-spelled
// copy (the ADR-0087 lesson, reapplied to a POLICY view over one catalog, not a second catalog):
//   (a) prompt-build  — `system-prompt.ts`'s ask mechanics block composes its allowed-types list FROM
//       `FEED_SURFACE_TYPES` at module-load time (drift impossible by construction);
//   (b) producer      — `produce.ts`'s FEED_SCOPE gate checks the ask-routed surface's component types
//       against `FEED_SURFACE_TYPE_SET`, AFTER the shared validator passes;
//   (c) page          — the site's ask lifecycle (`site/lib/ask-registry.ts`) fail-closed-checks an
//       ask surface's types against the SAME set before ever rendering it.
// SPEC-R9 (the full-catalog render-security allowlist) is UNTOUCHED — the feed set is a stricter POLICY
// subset over it, never a second catalog and never a widening of anything.
//
// `feed-catalog.test.ts` (LLD-C14) is the partition GATE: it asserts `FEED_SURFACE_TYPES ∪ FEED_EXCLUDED`
// equals `Object.keys(catalog.components)` EXACTLY and disjointly, so a future catalog.json addition that
// lands in NEITHER list is a silent drift ADR-0087's hand-frozen list could not see — the gate turns CI
// red until someone writes its disposition (IN, or OUT + a reason).
//
// Zero-dep, pure (SPEC-N5): no imports, not even the catalog itself (the test file is what cross-checks
// this module against `catalog.json` — keeping THIS module importable from anywhere, including the
// browser-side page, with no catalog-loading machinery riding along).

/**
 * The 23 catalog types a feed ask MAY host (ADR-0097 §3): choice controls, value inputs, one commit
 * affordance, and light structure — nothing that overlays, paginates, or dashboards.
 */
export const FEED_SURFACE_TYPES = [
  'Text',
  'Icon',
  'Row',
  'Column',
  'Card',
  'CardHeader',
  'CardContent',
  'CardFooter',
  'Field',
  'FormProvider',
  'Button',
  'Checkbox',
  'RadioGroup',
  'Radio',
  'SegmentedControl',
  'Segment',
  'Select',
  'Option',
  'ComboBox',
  'TextField',
  'Calendar',
  'Slider',
  'SliderMulti',
] as const

/** The closed union of every IN type — the runtime-checkable companion to the `as const` array above. */
export type FeedSurfaceType = (typeof FEED_SURFACE_TYPES)[number]

/** One excluded catalog type, with the recorded reason a feed ask may never host it (ADR-0097 §3) — never
 * a bare deny-list; every exclusion is a decision, not an omission. */
export interface FeedExclusion {
  readonly type: string
  readonly reason: string
}

/**
 * The 11 catalog types a feed ask MAY NEVER host (ADR-0097 §3). Composite-closure note: a composite's
 * children are excluded ALONGSIDE their parent for the SAME reason (Tab/TabPanel with Tabs; MenuItem with
 * Menu) — `feed-catalog.test.ts` asserts this closure holds, both here and for the IN composites
 * (RadioGroup/Radio, SegmentedControl/Segment, Card/its three sub-types, Select+ComboBox/Option).
 */
export const FEED_EXCLUDED: readonly FeedExclusion[] = [
  {
    type: 'Modal',
    reason: 'a focus-stealing overlay inside a chat bubble — the ask IS the interruption; nesting one defeats the point.',
  },
  {
    type: 'Tabs',
    reason: 'multi-view structure contradicts a single-purpose ask — it would hide half the ask behind an unclicked tab.',
  },
  { type: 'Tab', reason: 'a Tabs child — excluded alongside its parent (composite closure).' },
  { type: 'TabPanel', reason: 'a Tabs child — excluded alongside its parent (composite closure).' },
  {
    type: 'Menu',
    reason: 'a disclosure/hover overlay — an ask must be fully visible and operable inline, never hidden behind a trigger.',
  },
  { type: 'MenuItem', reason: 'a Menu child — excluded alongside its parent (composite closure).' },
  { type: 'Popover', reason: 'a disclosure overlay that escapes the bubble box — the same reason as Menu.' },
  { type: 'Tooltip', reason: 'a hover-disclosure overlay, not operable inline — unsuitable for a click-to-answer ask.' },
  {
    type: 'List',
    reason: 'homogeneous-collection semantics signal canvas-scale content; Column hosts stacked ask options instead.',
  },
  {
    type: 'Grid',
    reason: 'the auto-fit dashboard track model — the exact "elaborate dashboard" this policy exists to keep out of the feed.',
  },
  {
    type: 'Switch',
    reason:
      'an immediate-effect idiom; asks are commit-gated, so Checkbox is the honest boolean — a Switch implies an effect that has not happened yet.',
  },
] as const

/** `Set` view for O(1) membership checks (produce()'s FEED_SCOPE gate, the page's fail-closed drop). */
export const FEED_SURFACE_TYPE_SET: ReadonlySet<string> = new Set(FEED_SURFACE_TYPES)

/** `true` iff `type` is IN the feed sub-catalog. Never invents a third disposition — a type is either a
 * member of `FEED_SURFACE_TYPE_SET` or it is not (`FEED_EXCLUDED`, or — per the partition gate — nothing
 * else exists in the catalog at all). */
export function isFeedSurfaceType(type: string): boolean {
  return FEED_SURFACE_TYPE_SET.has(type)
}
