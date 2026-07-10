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
 * The 27 catalog types a feed ask MAY host (ADR-0097 §3): choice controls, value inputs, one commit
 * affordance, and light structure — nothing that overlays, paginates, or dashboards. Widened by the
 * report/content/feed catalog wave (ADR-0111/0113/0112): `Badge` (light ask furniture, the `Text`/`Icon`
 * class), `Code` (verbatim inline content, no overlay/dashboard shape), `Avatar` (a non-interactive
 * identity mark, the `Icon` parity argument). Widened again by the toolbar wave (ADR-0121 F7): `Toolbar`
 * is an arrangement of the SAME action `Button`s a `Row` already hosts in a feed ask — it adds
 * `role="toolbar"` + arrow-key roving focus, but no overlay, no pagination, no dashboard/canvas-scale
 * shape — the `Row` parity argument, not the `Split`/`Grid` exclusion reasoning.
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
  'Badge',
  'Code',
  'Avatar',
  'Toolbar',
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
 * The 23 catalog types a feed ask MAY NEVER host (ADR-0097 §3's ratified 11 + the chart-family pair —
 * the ADR-0097 Amendment / ADR-0107 Amendment 2 — + the report/content/feed catalog wave's five:
 * `Stat`/`Table` [ADR-0111], `Disclosure` [ADR-0113], `Progress`/`Attachment` [ADR-0112] — + the
 * token-surface family's three: `Swatch`/`Ramp`/`Ladder` [ADR-0118 cl.6] — + the M4 app-surfaces panes
 * wave's two: `Split`/`SplitPane` [ADR-0120 cl.5, app-surfaces-m4.spec.md SPEC-R6]). Composite-closure note: a
 * composite's children are excluded ALONGSIDE their parent for the SAME reason (Tab/TabPanel with Tabs;
 * MenuItem with Menu) — `feed-catalog.test.ts` asserts this closure holds, both here and for the IN
 * composites (RadioGroup/Radio, SegmentedControl/Segment, Card/its three sub-types, Select+ComboBox/Option).
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
    type: 'Sparkline',
    reason:
      'report content, not an ask affordance (ADR-0107 cl.8 + Amendment 2): display-only, no value mark — it reaches the artifact feed via full-catalog rendering; the ask subset stays interaction-shaped.',
  },
  {
    type: 'BarChart',
    reason:
      'report content, not an ask affordance (ADR-0107 cl.8 + Amendment 2): the List/Grid dashboard-content reasoning applied to the chart family — display-only, no value mark.',
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
  {
    type: 'Stat',
    reason:
      'report content with no ask affordance (ADR-0111 LLD-C13) — the atomic unit of the dashboard idiom the partition exists to keep out of ask bubbles; an ask that needs a number in prose has Text.',
  },
  {
    type: 'Table',
    reason:
      'dashboard/canvas-scale content (ADR-0111 LLD-C13) — the recorded List/Grid exclusion reasoning applies a fortiori to a data table.',
  },
  {
    type: 'Disclosure',
    reason:
      'folding hides ask content (ADR-0113 LLD-C13) — the Tabs "hides half the ask" reasoning verbatim: an ask must be fully visible and operable inline.',
  },
  {
    type: 'Progress',
    reason:
      'a live indicator inside a frozen-able ask is a lying record (ADR-0112 LLD-C13) — an ask bubble may be answered long after a progress value has moved on.',
  },
  {
    type: 'Attachment',
    reason:
      'artifact content, not an ask affordance (ADR-0112 LLD-C13) — revisit trigger: a real file-pick ask.',
  },
  {
    type: 'Swatch',
    reason:
      'report/reference content, not an ask affordance (ADR-0118 cl.6, token-surfaces.lld.md LLD-C14) — display-only, no value mark; a color identity mark reaches the artifact feed via full-catalog rendering, never a click-to-answer surface.',
  },
  {
    type: 'Ramp',
    reason:
      'report/reference content, not an ask affordance (ADR-0118 cl.6, token-surfaces.lld.md LLD-C14) — the Swatch reasoning applied to an ordered color series: display-only, no value mark.',
  },
  {
    type: 'Ladder',
    reason:
      'report/reference content, not an ask affordance (ADR-0118 cl.6, token-surfaces.lld.md LLD-C14) — the Swatch reasoning applied to labeled dimensional tiers: display-only, no value mark.',
  },
  {
    type: 'Split',
    reason:
      'app-surface/canvas-scale chrome, not a single-purpose ask affordance (ADR-0120 cl.5, app-surfaces-m4.spec.md SPEC-R6) — the Grid/List "elaborate dashboard/canvas-scale content" reasoning applied to a user-resizable multi-pane layout: a drag-resize affordance has no room inside a chat-bubble-sized ask surface.',
  },
  { type: 'SplitPane', reason: 'a Split child — excluded alongside its parent (composite closure).' },
] as const

/** `Set` view for O(1) membership checks (produce()'s FEED_SCOPE gate, the page's fail-closed drop). */
export const FEED_SURFACE_TYPE_SET: ReadonlySet<string> = new Set(FEED_SURFACE_TYPES)

/** `true` iff `type` is IN the feed sub-catalog. Never invents a third disposition — a type is either a
 * member of `FEED_SURFACE_TYPE_SET` or it is not (`FEED_EXCLUDED`, or — per the partition gate — nothing
 * else exists in the catalog at all). */
export function isFeedSurfaceType(type: string): boolean {
  return FEED_SURFACE_TYPE_SET.has(type)
}
