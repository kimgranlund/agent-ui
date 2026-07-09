// site/lib/frontmatter.ts — the doc page's thin adapter onto the CANONICAL frontmatter parser (A4, ADR-0004).
// A control's `{name}.md` is the single descriptor source: the contract trip-wire parses it INSIDE the package,
// and a /site doc page is the SECOND consumer of that SAME parser exposed at `@agent-ui/components/descriptor`.
// It does NOT re-implement a frontmatter dialect — it splits the fence and runs `parseDescriptor`, so a doc
// table cannot drift from the contract the trip-wire enforces (one parser, two consumers).
//
// Vite's `?raw` import path must be a static string literal (the bundler reads the file from disk at build
// time), so the {name}.md text cannot be loaded by a runtime-computed path. Each control therefore gets a tiny
// `load{Name}Doc()` that imports ITS OWN `{name}.md?raw` and delegates to the shared `parseDoc` — adding a
// control's doc page is one such 2-line loader, never a new frontmatter reader.
import { parseDescriptor, splitFrontmatter } from '@agent-ui/components/descriptor'
import type { ParsedDescriptor } from '@agent-ui/components/descriptor'

// The raw control descriptors, pulled at build time via Vite's `?raw` import (relative path from /site to the
// control source). `vite build` reads them from disk; each `{name}.md` is the single source of truth for both
// the in-package contract trip-wire and its /site doc page.
import buttonMd from '../../packages/agent-ui/components/src/controls/button/button.md?raw'
import textMd from '../../packages/agent-ui/components/src/controls/text/text.md?raw'
import iconMd from '../../packages/agent-ui/components/src/controls/icon/icon.md?raw'
import textFieldMd from '../../packages/agent-ui/components/src/controls/text-field/text-field.md?raw'
import rowMd from '../../packages/agent-ui/components/src/controls/row/row.md?raw'
import columnMd from '../../packages/agent-ui/components/src/controls/column/column.md?raw'
import listMd from '../../packages/agent-ui/components/src/controls/list/list.md?raw'
import gridMd from '../../packages/agent-ui/components/src/controls/grid/grid.md?raw'
import cardMd from '../../packages/agent-ui/components/src/controls/card/card.md?raw'
import tabsMd from '../../packages/agent-ui/components/src/controls/tabs/tabs.md?raw'
import modalMd from '../../packages/agent-ui/components/src/controls/modal/modal.md?raw'
import checkboxMd from '../../packages/agent-ui/components/src/controls/checkbox/checkbox.md?raw'
import switchMd from '../../packages/agent-ui/components/src/controls/switch/switch.md?raw'
import radioMd from '../../packages/agent-ui/components/src/controls/radio/radio.md?raw'
import radioGroupMd from '../../packages/agent-ui/components/src/controls/radio/radio-group.md?raw'
// ADR-0095 (supersedes ADR-0086): the standalone segmented control + its child leaf.
import segmentMd from '../../packages/agent-ui/components/src/controls/segment/segment.md?raw'
import segmentedControlMd from '../../packages/agent-ui/components/src/controls/segmented-control/segmented-control.md?raw'
import sliderMd from '../../packages/agent-ui/components/src/controls/slider/slider.md?raw'
import sliderMultiMd from '../../packages/agent-ui/components/src/controls/slider-multi/slider-multi.md?raw'
import popoverMd from '../../packages/agent-ui/components/src/controls/popover/popover.md?raw'
import tooltipMd from '../../packages/agent-ui/components/src/controls/tooltip/tooltip.md?raw'
import menuMd from '../../packages/agent-ui/components/src/controls/menu/menu.md?raw'
import selectMd from '../../packages/agent-ui/components/src/controls/select/select.md?raw'
import comboBoxMd from '../../packages/agent-ui/components/src/controls/combo-box/combo-box.md?raw'
import calendarMd from '../../packages/agent-ui/components/src/controls/calendar/calendar.md?raw'
// The G7 form-composition family (ADR-0050/0051): the label/description/error wrapper + the coordination provider.
import fieldMd from '../../packages/agent-ui/components/src/controls/field/field.md?raw'
import formProviderMd from '../../packages/agent-ui/components/src/controls/form-provider/form-provider.md?raw'
// The Wave M1 chart family (ADR-0107, chart-family.lld.md): the two Display-class axis-free charts.
import sparklineMd from '../../packages/agent-ui/components/src/controls/sparkline/sparkline.md?raw'
import barChartMd from '../../packages/agent-ui/components/src/controls/bar-chart/bar-chart.md?raw'
// The Wave M1 report family (ADR-0111, report-family.lld.md): table/stat/badge — all tier=display.
import tableMd from '../../packages/agent-ui/components/src/controls/table/table.md?raw'
import statMd from '../../packages/agent-ui/components/src/controls/stat/stat.md?raw'
import badgeMd from '../../packages/agent-ui/components/src/controls/badge/badge.md?raw'
// The Wave M1 content family (ADR-0113, content-family.lld.md): the code leaf + the disclosure fold.
import codeMd from '../../packages/agent-ui/components/src/controls/code/code.md?raw'
import disclosureMd from '../../packages/agent-ui/components/src/controls/disclosure/disclosure.md?raw'
// The Wave M1 feed family (ADR-0112, feed-family.lld.md): progress/avatar/attachment/toast/toast-region.
import progressMd from '../../packages/agent-ui/components/src/controls/progress/progress.md?raw'
import avatarMd from '../../packages/agent-ui/components/src/controls/avatar/avatar.md?raw'
import attachmentMd from '../../packages/agent-ui/components/src/controls/attachment/attachment.md?raw'
import toastMd from '../../packages/agent-ui/components/src/controls/toast/toast.md?raw'
import toastRegionMd from '../../packages/agent-ui/components/src/controls/toast/toast-region.md?raw'
// @agent-ui/router (LLD-C10b) — a DIFFERENT PACKAGE, structurally fenced off the components fleet (SPEC-R1
// AC2: nothing in components/a2ui/shared may import router). Its two elements' `{name}.md` descriptors still
// carry the same ADR-0004 frontmatter shape, so they still go through the ONE canonical parser here — but they
// are NOT part of the `ALL_DESCRIPTORS` glob below (that glob is components/src-scoped, the tier/TOC/coverage
// gates' source of truth) and router-doc.html is an ungrouped site-level page, exactly like app-shell.html.
import routerOutletMd from '../../packages/agent-ui/router/src/controls/router-outlet/router-outlet.md?raw'
import routerLinkMd from '../../packages/agent-ui/router/src/controls/router-link/router-link.md?raw'

/** A parsed control descriptor: the structured frontmatter (its attributes-as-API drive the table) + the prose body. */
export interface ComponentDoc {
  readonly descriptor: ParsedDescriptor
  readonly body: string
}

/** Read a raw `{name}.md` through the canonical parser → the structured descriptor + the markdown body below the fence. */
export function parseDoc(raw: string): ComponentDoc {
  const { fence, body } = splitFrontmatter(raw)
  return { descriptor: parseDescriptor(fence), body }
}

// ── per-control loaders (one 2-line loader per documented control — the convention) ──────────────────────────
export const loadButtonDoc = (): ComponentDoc => parseDoc(buttonMd)
export const loadTextDoc = (): ComponentDoc => parseDoc(textMd)
export const loadIconDoc = (): ComponentDoc => parseDoc(iconMd)
export const loadTextFieldDoc = (): ComponentDoc => parseDoc(textFieldMd)
export const loadRowDoc = (): ComponentDoc => parseDoc(rowMd)
export const loadColumnDoc = (): ComponentDoc => parseDoc(columnMd)
export const loadListDoc = (): ComponentDoc => parseDoc(listMd)
export const loadGridDoc = (): ComponentDoc => parseDoc(gridMd)
export const loadCardDoc = (): ComponentDoc => parseDoc(cardMd)
export const loadTabsDoc = (): ComponentDoc => parseDoc(tabsMd)
export const loadModalDoc = (): ComponentDoc => parseDoc(modalMd)
export const loadCheckboxDoc = (): ComponentDoc => parseDoc(checkboxMd)
export const loadSwitchDoc = (): ComponentDoc => parseDoc(switchMd)
export const loadRadioDoc = (): ComponentDoc => parseDoc(radioMd)
export const loadRadioGroupDoc = (): ComponentDoc => parseDoc(radioGroupMd)
// ADR-0095 (supersedes ADR-0086): the standalone segmented control + its child leaf.
export const loadSegmentDoc = (): ComponentDoc => parseDoc(segmentMd)
export const loadSegmentedControlDoc = (): ComponentDoc => parseDoc(segmentedControlMd)
export const loadSliderDoc = (): ComponentDoc => parseDoc(sliderMd)
export const loadSliderMultiDoc = (): ComponentDoc => parseDoc(sliderMultiMd)
// The Wave 4 Overlay family (popover, tooltip, menu, select, combo-box — tier=pattern, ADR-0043).
export const loadPopoverDoc = (): ComponentDoc => parseDoc(popoverMd)
export const loadTooltipDoc = (): ComponentDoc => parseDoc(tooltipMd)
export const loadMenuDoc = (): ComponentDoc => parseDoc(menuMd)
export const loadSelectDoc = (): ComponentDoc => parseDoc(selectMd)
export const loadComboBoxDoc = (): ComponentDoc => parseDoc(comboBoxMd)
export const loadCalendarDoc  = (): ComponentDoc => parseDoc(calendarMd)
// The G7 form-composition family (ADR-0050/0051 — both tier=container ⇒ {doc, demo}).
export const loadFieldDoc        = (): ComponentDoc => parseDoc(fieldMd)
export const loadFormProviderDoc = (): ComponentDoc => parseDoc(formProviderMd)
// The Wave M1 chart family (ADR-0107 — both tier=display ⇒ {doc} only).
export const loadSparklineDoc = (): ComponentDoc => parseDoc(sparklineMd)
export const loadBarChartDoc  = (): ComponentDoc => parseDoc(barChartMd)
// The Wave M1 report family (ADR-0111 — all three tier=display ⇒ {doc} only).
export const loadTableDoc = (): ComponentDoc => parseDoc(tableMd)
export const loadStatDoc  = (): ComponentDoc => parseDoc(statMd)
export const loadBadgeDoc = (): ComponentDoc => parseDoc(badgeMd)
// The Wave M1 content family (ADR-0113 — code tier=display ⇒ {doc}; disclosure tier=pattern ⇒ {doc, demo}).
export const loadCodeDoc       = (): ComponentDoc => parseDoc(codeMd)
export const loadDisclosureDoc = (): ComponentDoc => parseDoc(disclosureMd)
// The Wave M1 feed family (ADR-0112 — progress/attachment tier=display, avatar tier=indicator,
// toast-region tier=layout, toast tier=pattern ⇒ {doc, demo}).
export const loadProgressDoc     = (): ComponentDoc => parseDoc(progressMd)
export const loadAvatarDoc       = (): ComponentDoc => parseDoc(avatarMd)
export const loadAttachmentDoc   = (): ComponentDoc => parseDoc(attachmentMd)
export const loadToastDoc        = (): ComponentDoc => parseDoc(toastMd)
export const loadToastRegionDoc  = (): ComponentDoc => parseDoc(toastRegionMd)
// @agent-ui/router (LLD-C10b) — see the import-site comment above for why these two sit outside the
// components-scoped ALL_DESCRIPTORS glob below.
export const loadRouterOutletDoc = (): ComponentDoc => parseDoc(routerOutletMd)
export const loadRouterLinkDoc   = (): ComponentDoc => parseDoc(routerLinkMd)

// ── tier enumeration (for the family overview + tier showcase — a DERIVED member list) ───────────────────────
// The whole `{name}.md` descriptor set, globbed at build time (Vite resolves `import.meta.glob` statically). The
// family overview / tier showcase derive their member list from THIS — a new control in a tier appears
// automatically, so the listing cannot drift from the shipped fleet (the T7 coverage discipline).
const ALL_DESCRIPTORS = import.meta.glob(
  '../../packages/agent-ui/components/src/controls/*/*.md',
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>

/** One enumerated member: its tag-derived name + its parsed descriptor doc. */
export interface TierMember {
  readonly name: string
  readonly tag: string
  readonly doc: ComponentDoc
}

/**
 * loadDescriptorByTag — the parsed descriptor whose `tag` scalar equals `tag` (e.g. `ui-button`), or undefined.
 * Reads the SAME build-time `ALL_DESCRIPTORS` glob + canonical parser the tier enumeration uses, so the
 * component-preview's component mode resolves a control's attributes-as-API from the ONE descriptor source
 * (never a forked reader) — a target with no `{name}.md` simply returns undefined.
 */
export function loadDescriptorByTag(tag: string): ComponentDoc | undefined {
  for (const raw of Object.values(ALL_DESCRIPTORS)) {
    const doc = parseDoc(raw)
    if (doc.descriptor.scalars.get('tag') === tag) return doc
  }
  return undefined
}

/** Every shipped control whose descriptor `tier` matches, sorted by name — the DERIVED member list for a tier page. */
export function membersOfTier(tier: string): TierMember[] {
  const members: TierMember[] = []
  for (const raw of Object.values(ALL_DESCRIPTORS)) {
    const doc = parseDoc(raw)
    const tag = doc.descriptor.scalars.get('tag')
    if (doc.descriptor.scalars.get('tier') === tier && typeof tag === 'string' && tag.startsWith('ui-')) {
      members.push({ name: tag.slice('ui-'.length), tag, doc })
    }
  }
  return members.sort((a, b) => a.name.localeCompare(b.name))
}
