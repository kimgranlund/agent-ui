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
 * The 36 catalog types a feed ask MAY host (ADR-0097 §3): choice controls, value inputs, one commit
 * affordance, and light structure — nothing that overlays, paginates, or dashboards. Widened by the
 * report/content/feed catalog wave (ADR-0111/0113/0112): `Badge` (light ask furniture, the `Text`/`Icon`
 * class), `Code` (verbatim inline content, no overlay/dashboard shape), `Avatar` (a non-interactive
 * identity mark, the `Icon` parity argument). Widened again by the toolbar wave (ADR-0121 F7): `Toolbar`
 * is an arrangement of the SAME action `Button`s a `Row` already hosts in a feed ask — it adds
 * `role="toolbar"` + arrow-key roving focus, but no overlay, no pagination, no dashboard/canvas-scale
 * shape — the `Row` parity argument, not the `Split`/`Grid` exclusion reasoning. NOT widened by the
 * timeline-family wave (ADR-0122 F5) — `Timeline`/`TimelineItem` land in `FEED_EXCLUDED` below instead
 * (a narrative chronology is report content, the `List`/`Table` reasoning, not an ask affordance). NOT
 * widened by the swiper-family wave either (ADR-0124 F5) — `Swiper`/`SwiperItem` land in `FEED_EXCLUDED`
 * below instead (a scroll-snap carousel deliberately hides all-but-one slide behind navigation, the
 * `Tabs` "hides half the ask" reasoning, not the `Toolbar`/`Row` parity argument). NOT widened by the
 * color-picker wave (ADR-0123 cl.6) — `ColorPicker` lands in `FEED_EXCLUDED` below instead: it is an
 * INPUT (unlike `Swatch`/`Ramp`/`Ladder`'s display-only report content), but no ask affordance admits an
 * editor to the artifact feed. Widened by the 2026-07-28 per-control catalog intake: `Textarea` is the
 * TextField parity argument — a plain multi-line value input, commit-gated (blur-with-change, ADR-0134),
 * no overlay/dashboard shape — the same class as the choice/value inputs already IN. Widened by M-F
 * (multi-select-field.lld.md, ADR-0175): `MultiSelect` is the Select/ComboBox parity argument — a choice
 * control binding an array, one commit affordance (`select`), no overlay/pagination/dashboard shape (in
 * fact LESS overlay surface than `Select`, which already carries a top-layer trigger+panel and is IN).
 */
// The 2026-08-19 nine-ADR campaign's disposition wave — six new-type dispositions, all decided against
// the SAME parity arguments this file already states (no new reasoning class):
//   `FileDrop` (ADR-0210 cl.6, INCLUDE by name) — the `Textarea` parity argument verbatim: commit-gated,
//   inline, fully visible/operable, no overlay/paging; the ask a file-attach naturally belongs to.
//   `Suggestions` (ADR-0213 cl.5, INCLUDE by name) — a choice control that IS its own single commit
//   affordance, no overlay/pagination/dashboard shape (LESS overlay surface than `Select`, which is IN).
//   `SourceList` (ADR-0214 cl.4, INCLUDE by name) — the `DescriptionList` parity argument verbatim: static,
//   non-interactive attribution content with no overlay/pagination/dashboard shape; a grounded ask cites
//   its sources the same way a receipt cites its rows.
//   `Rating` (no explicit ADR-0216 disposition — decided here on the `Slider` parity argument): a bounded
//   VALUE-MARKED scalar input, one row, no overlay/pagination/dashboard shape — structurally identical to
//   `Slider`, which is already IN. Unlike `ColorPicker` (value-marked but EXCLUDED, `FEED_EXCLUDED` below)
//   Rating's input surface is a single scalar, not a 2-axis pad+channels composite — no ask affordance is
//   denied the way a color editor is. This is a build-wave judgment call, named honestly (the ADR is
//   silent), not an inferred ADR ruling.
//   `ChoiceGroup`/`ChoiceCard` (ADR-0220 Decision, INCLUDE by name, composite closure) — "a rich-option
//   pick IS the canonical commit-gated ask" (picking one of three hotel cards); `ChoiceCard` rides in
//   under composite closure (the `RadioGroup`/`Radio` precedent).
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
  'MultiSelect',
  'TextField',
  'Textarea',
  'Calendar',
  'Slider',
  'SliderMulti',
  'Badge',
  'Code',
  'Avatar',
  'Toolbar',
  // ADR-0201 (GH #1185): `DescriptionList` is IN — the confirm-step RECEIPT is the ask-card's own idiom
  // (the proposed-outcome turn the grammar mandates before any conclusive action is a receipt + one commit
  // Button); a static, non-interactive label/value record with no overlay/pagination/dashboard shape — the
  // `Badge`/`Text` light-furniture parity argument, not the `Stat`/`Table` report-dashboard exclusion class.
  'DescriptionList',
  'SourceList',
  'Suggestions',
  'FileDrop',
  'Rating',
  'ChoiceGroup',
  'ChoiceCard',
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
 * The 40 catalog types a feed ask MAY NEVER host (ADR-0097 §3's ratified 11 + the chart-family pair —
 * the ADR-0097 Amendment / ADR-0107 Amendment 2 — + the chart family's third member, `LineChart`
 * [ADR-0205 cl.8] — + the report/content/feed catalog wave's five:
 * `Stat`/`Table` [ADR-0111], `Disclosure` [ADR-0113], `Progress`/`Attachment` [ADR-0112] — + the
 * token-surface family's three: `Swatch`/`Ramp`/`Ladder` [ADR-0118 cl.6] — + the M4 app-surfaces panes
 * wave's two: `Split`/`SplitPane` [ADR-0120 cl.5, app-surfaces-m4.spec.md SPEC-R6] — + the timeline-family
 * wave's two: `Timeline`/`TimelineItem` [ADR-0122 F5, timeline-family.spec.md] — + the swiper-family
 * wave's two: `Swiper`/`SwiperItem` [ADR-0124 F5, swiper-family.spec.md] — + the color-picker wave's one:
 * `ColorPicker` [ADR-0123 cl.6] — + the form-popover wave's one: `FormPopover` [GH #294 F4,
 * form-popover.spec.md SPEC-R9 — the same disclosure-overlay reasoning as Popover/Menu/Tooltip] —
 * + the ui-drawer wave's one: `Drawer` [ADR-0188 cl.2 — the SAME focus-stealing top-layer class as
 * Modal, edge-docked rather than centred] + the image-content wave's one: `Image` [GH #1189 — a
 * URL-sourced content image/photo, the Attachment/Swatch/Ramp/Ladder report-content class, NOT the
 * Avatar/Icon light-identity-mark class] + the GH #1353 Drill-catalog-decision pass's two: `Drill`/
 * `DrillPanel` [ADR-0195 GH #954 — an arbitrary-depth tree hiding all-but-one panel, taken further
 * than the Tabs "hides half the ask" reasoning, and no value mark to commit even if it were IN] +
 * the GH #1352 Toggle-catalog-decision pass's one: `Toggle` [ADR-0179 GH #686 Amendment S7-a — no
 * `value` mark at all (Fork T1); worse than the already-excluded `Switch`, which at least commits
 * `checked` back — a press inside an ask would flip the pill with no way for the agent to ever learn
 * the outcome, the exact dishonesty this partition exists to keep out] + the 2026-08-19 nine-ADR
 * campaign's one: `PieChart` [ADR-0219 — the chart family's fourth member, the same display-only/
 * no-value-mark reasoning as Sparkline/BarChart/LineChart]).
 * Composite-closure note: a composite's children are excluded ALONGSIDE their parent for the SAME
 * reason (Tab/TabPanel with Tabs; MenuItem with Menu) — `feed-catalog.test.ts` asserts this closure
 * holds, both here and for the IN composites (RadioGroup/Radio, SegmentedControl/Segment, Card/its
 * three sub-types, Select+ComboBox/Option, ChoiceGroup/ChoiceCard).
 */
export const FEED_EXCLUDED: readonly FeedExclusion[] = [
  {
    type: 'Toast',
    reason:
      'a self-expiring announcement that removes itself from the DOM (GH #1184) — an ask must stay fully visible and operable until answered; ephemeral outcome content belongs on the main surface, never inside an ask card.',
  },
  {
    type: 'Modal',
    reason: 'a focus-stealing overlay inside a chat bubble — the ask IS the interruption; nesting one defeats the point.',
  },
  {
    type: 'Drawer',
    reason: 'the SAME focus-stealing top-layer overlay class as Modal (ADR-0188 cl.2 — edge-docked, not centred, but equally modal) — nesting one inside a chat bubble defeats the point exactly as Modal would.',
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
    type: 'FormPopover',
    reason:
      'a disclosure overlay that escapes the bubble box — the same reason as Popover/Menu, and worse for an ask: it hides real form content behind a trigger, when an ask must be fully visible and operable inline.',
  },
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
    type: 'LineChart',
    reason:
      'report content, not an ask affordance (ADR-0205 cl.8, inheriting the ADR-0107 cl.8 + Amendment 2 reasoning): the fleet\'s first axis-bearing chart is display-only, no value mark — it reaches the artifact feed via full-catalog rendering, the same as its Sparkline/BarChart chart-family kin.',
  },
  {
    type: 'PieChart',
    reason:
      'report content, not an ask affordance (ADR-0219, inheriting the ADR-0107 cl.8 + Amendment 2 reasoning): the part-of-whole mark is display-only, no value mark — the same chart-family class as Sparkline/BarChart/LineChart, reaching the artifact feed via full-catalog rendering only.',
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
    type: 'Pagination',
    reason:
      'pagination-natured furniture is the class ADR-0111 cl.7 already names as out (ADR-0163 cl.9) — a page navigator is dashboard/canvas-scale chrome bound to a report-scale collection, not a single-purpose ask affordance; it carries a value:{prop,event} mark (the ColorPicker precedent: two-way-bindable is not itself an ask ticket) but has no standalone ask shape.',
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
  {
    type: 'Timeline',
    reason:
      'report/narrative content, not an ask affordance (ADR-0122 F5) — a durable chronology (order-tracking, audit log, reasoning recap) is homogeneous-collection report content, the List/Table "canvas-scale content" reasoning applied to an event rail: no value mark, no commit semantics — an ask is a commit-gated question, not a narrative record.',
  },
  { type: 'TimelineItem', reason: 'a Timeline child — excluded alongside its parent (composite closure).' },
  {
    type: 'Swiper',
    reason:
      'a scroll-snap carousel deliberately shows one (or a few) slide(s) at a time behind pagination/paddle navigation — the Tabs "hides half the ask" reasoning taken further (ADR-0124 F5): an ask must be fully visible and operable inline, never paged through to be seen in full.',
  },
  { type: 'SwiperItem', reason: 'a Swiper child — excluded alongside its parent (composite closure).' },
  {
    type: 'ColorPicker',
    reason:
      'an INPUT, not report/reference content (ADR-0123 cl.6) — unlike the display-only Swatch/Ramp/Ladder trio, ColorPicker DOES carry a value:{prop,event} mark, but no ask affordance admits an editor to the artifact feed; a color ask inside a chat bubble stays a TextField/ComboBox choice, not a 2-axis pad+channels composite.',
  },
  {
    type: 'Image',
    reason:
      'a URL-sourced content image/photo (GH #1189), not an ask affordance — display-only, no value mark; the Attachment/Swatch/Ramp/Ladder report/artifact-content parity argument, NOT the Avatar/Icon light-identity-mark class (an image IS the content, unlike a small non-interactive identity mark that merely furnishes an ask card) — reaches the artifact feed via full-catalog rendering (a Card-with-hero payload), never a click-to-answer ask surface.',
  },
  {
    type: 'Video',
    reason:
      'a URL-sourced media player (GH #1209) — display-only, no value mark, no ask affordance; the Image reasoning verbatim (the player IS the content), reaching the artifact feed via full-catalog rendering only.',
  },
  {
    type: 'AudioPlayer',
    reason:
      'a URL-sourced media player (GH #1209) — display-only, no value mark, no ask affordance; the Image/Video reasoning verbatim.',
  },
  {
    type: 'Drill',
    reason:
      'multi-view structure contradicts a single-purpose ask, taken FURTHER than Tabs (GH #1353, ADR-0195 GH #954) — an arbitrary-depth tree of which only ONE panel is ever visible; no value mark exists to commit either (Fork D1, the toggleFactory-class finding — neither controlled nor uncontrolled mode ever writes the resolved position back onto `path`).',
  },
  { type: 'DrillPanel', reason: 'a Drill child — excluded alongside its parent (composite closure).' },
  {
    type: 'Toggle',
    reason:
      'no value mark at all (GH #1352, ADR-0179 GH #686 Amendment S7-a, Fork T1 — the toggleFactory doc comment) — worse than the already-excluded Switch, which at least commits `checked` back on press. Pressing a Toggle inside an ask would flip its own local paint with no way for the agent to ever learn the outcome; an ask is commit-gated by definition, and this control has nothing to commit.',
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
