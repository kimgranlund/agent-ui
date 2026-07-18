// site/lib/command-palette.ts — the site-wide navigate-and-search palette (TKT-0018, site-command-search.lld.md
// §5, LLD-C6…C10). Lazily imported once per page (site/pages/_page.ts's shared shell); mounts the real, shipped
// `ui-command-modal` with the merged L1 (components) + L2 (guides) + L3-stub (Changelog/Decision Records)
// options rendered from the build-time-generated sitemap, then kicks off the two heavy L3 per-record indexes
// (ADR/changelog) as background fetches that merge in — closed-instance swap, or deferred to the next `close`
// — once they resolve (SPEC-R10). No @agent-ui/router import anywhere in this module (SPEC-R9 AC1's
// grep-checkable negative control) — selection navigates via a plain `location.href` assignment.
import type { UICommandModalElement } from '@agent-ui/components/components'

interface SitemapEntry {
  readonly name: string
  readonly tag?: string
  readonly url: string
  readonly description: string
  readonly level: 'L1' | 'L2' | 'L3'
  readonly section: string
  readonly index?: string
}

interface Sitemap {
  readonly entries: SitemapEntry[]
}

const GROUP_LABELS: Record<SitemapEntry['level'], string> = { L1: 'Components', L2: 'Guides', L3: 'Records' }
const GROUP_ORDER: readonly SitemapEntry['level'][] = ['L1', 'L2', 'L3']

/**
 * One rendered `[role=option]` for a sitemap entry — the control's own shipped content model (command-modal.md
 * `contentModel`): `value` carries the navigation target, `data-keywords` folds tag+description into the
 * control's existing filter haystack (item label + data-keywords) with zero control change (LLD-C7).
 *
 * TKT-0019 — the two-line shape: line 1 is a plain text node (the title, `#labelText`-visible); line 2 is a
 * `[data-role="description"]` div (command-modal's own two-line/clamp CSS — the component-owned lane, never a
 * site-side CSS reach into control internals). The description div is EXCLUDED from `#labelText` (so `select`
 * detail.label and the filter's item-label text stay just the title) but carries no `aria-hidden` — it stays a
 * real, visible, announced line; `data-keywords` (below) is what keeps it filterable.
 *
 * The tag LEADS an L1 entry's title line (`ui-swiper-paddles (Swiper Paddles)`), not the display name — a
 * deliberate reorder off the ticket's own illustrative `Name (tag) — …` example, load-bearing for SPEC-R7 AC1's
 * anchored-regex example (`^ui-swiper` narrowing to the swiper family): the control's own haystack is
 * `#labelText(opt) + ' ' + data-keywords` (labelText ALWAYS first — verified against command-modal.ts), so an
 * anchored `^` pattern can only ever match a position-0 string, and can NEVER reach into `data-keywords` no
 * matter what leads there. Leading `data-keywords` with the raw tag alone (kept below) is therefore necessary
 * but not sufficient — the VISIBLE label itself must start with the tag, or `^ui-…` can never match anything.
 * This keeps every piece (tag, name, description) present and DOM order == visual order == accessible order (no
 * aria-hidden/visual-order mismatch on the title line), just swaps which of tag/name is primary vs parenthetical.
 */
function buildOption(entry: SitemapEntry): HTMLElement {
  const option = document.createElement('div')
  option.setAttribute('role', 'option')
  option.setAttribute('value', entry.url)
  option.append(document.createTextNode(entry.tag ? `${entry.tag} (${entry.name})` : entry.name))
  if (entry.description) {
    const description = document.createElement('div')
    description.dataset.role = 'description'
    description.textContent = entry.description
    option.append(description)
  }
  option.dataset.keywords = `${entry.tag ?? ''} ${entry.description}`
  return option
}

/** One `[role=group]` section (with its `[data-role=group-label]` heading) for a level, or null when that
 *  level has no entries — the control's own shipped group-hide model does the rest (SPEC-R8). */
function buildGroup(level: SitemapEntry['level'], entries: readonly SitemapEntry[]): HTMLElement | null {
  if (entries.length === 0) return null
  const group = document.createElement('div')
  group.setAttribute('role', 'group')
  const headingId = `cmd-group-${level.toLowerCase()}`
  group.setAttribute('aria-labelledby', headingId)
  const heading = document.createElement('div')
  heading.id = headingId
  heading.dataset.role = 'group-label'
  heading.textContent = GROUP_LABELS[level]
  group.append(heading)
  for (const entry of entries) group.append(buildOption(entry))
  return group
}

/** renderOptions — the merged option tree in level order (L1 above L2 above L3, SPEC-R8 AC1). */
function renderOptions(entries: readonly SitemapEntry[]): HTMLElement[] {
  const groups: HTMLElement[] = []
  for (const level of GROUP_ORDER) {
    const group = buildGroup(
      level,
      entries.filter((e) => e.level === level),
    )
    if (group) groups.push(group)
  }
  return groups
}

/** createPalette — one fresh `<ui-command-modal>` instance carrying the merged option set. `filter="regex"`
 *  (LLD-C8, ADR-0127) — the shipped control now carries the prop; the site never checks for it defensively,
 *  since a stale build without it would already fail the components package's own gates first. */
function createPalette(entries: readonly SitemapEntry[]): UICommandModalElement {
  const palette = document.createElement('ui-command-modal') as UICommandModalElement
  palette.setAttribute('hotkey', 'mod+k')
  palette.setAttribute('label', 'Search agent-ui')
  palette.setAttribute('placeholder', 'Search components, guides, records…')
  palette.setAttribute('filter', 'regex')
  palette.append(...renderOptions(entries))
  // SPEC-R9 AC1 — MPA navigation only; grep-checkable: no @agent-ui/router import anywhere in this file.
  palette.addEventListener('select', (e) => {
    const detail = (e as CustomEvent<{ value: string }>).detail
    location.href = detail.value
  })
  return palette
}

let current: UICommandModalElement | null = null
/** The merged option set the currently-mounted instance actually carries — read (never a stale closure
 *  snapshot) by every `applyMerge` call, including a DEFERRED one firing after an earlier merge already
 *  landed, so two L3 corpora resolving while the palette is open cannot clobber one another (see applyMerge). */
let liveEntries: SitemapEntry[] = []

/** swapNow — mount `entries` as a fresh instance, replacing the current one if any (SPEC-R10: relies on the
 *  control's documented hotkey reconnect-rearm guarantee, command-modal.lld.md SPEC-R10 AC2). */
function swapNow(entries: readonly SitemapEntry[]): void {
  const fresh = createPalette(entries)
  if (current) current.replaceWith(fresh)
  else document.body.append(fresh)
  current = fresh
  liveEntries = [...entries]
}

/**
 * applyMerge — fold a resolved L3 corpus's per-record entries in for `stubIndex`, honoring SPEC-R10: while the
 * palette is CLOSED (or not yet mounted), swap immediately; while OPEN, defer to that instance's own next
 * `close` rather than tearing an open dialog out from under the user.
 *
 * Deliberately RE-INVOKES itself (not a captured one-shot swap) from the deferred branch: the merge against
 * `liveEntries` is computed FRESH at whichever moment this actually runs, never against a snapshot taken back
 * when the fetch first resolved. Two L3 corpora (ADR + changelog) can both resolve while the palette is open;
 * without this, both deferred swaps would independently merge against the SAME stale pre-resolution snapshot,
 * and whichever `close` listener ran second would silently discard the first corpus's already-merged records
 * (each swap replaces the whole element, so a stale merge doesn't just miss new data, it actively regresses
 * already-resolved data back out). Re-deriving `mergeL3(liveEntries, …)` at apply time — even when this means
 * applyMerge calls itself once more after the deferred listener fires — makes each merge apply cleanly on top
 * of whatever the other merge already landed, in either resolve order.
 */
function applyMerge(stubIndex: string, records: readonly SitemapEntry[]): void {
  if (!current || !current.open) {
    swapNow(mergeL3(liveEntries, stubIndex, records))
  } else {
    current.addEventListener('close', () => applyMerge(stubIndex, records), { once: true })
  }
}

/** mergeL3 — replace a resolved corpus's loader-stub entry with its real per-record entries (both index files
 *  are already SitemapEntry-shaped, level L3 / section Records — LLD §5 step 4). */
function mergeL3(entries: readonly SitemapEntry[], stubIndex: string, records: readonly SitemapEntry[]): SitemapEntry[] {
  return [...entries.filter((e) => e.index !== stubIndex), ...records]
}

/** mountCommandPalette — the module's one export, called once per page via a lazy `import()` from `_page.ts`'s
 *  shared shell (SPEC-R6). Fetches the bundled-small `sitemap.json` (L1+L2+L3-stubs), mounts the palette, then
 *  kicks off the two L3 per-record fetches in the background (SPEC-R10) — independent of whether the palette
 *  is ever opened.
 *
 * DEVIATION from LLD §5 step 1's literal "read the already-bundled sitemap.json" (a static/bundled JS import):
 * `sitemap.json` is fetched at runtime, the SAME mechanism as the two L3 index files, rather than statically
 * imported. A static import of a file living under `site/public/` is exactly the pattern Vite's own docs warn
 * against — publicDir contents are copied/served as-is and are NOT meant to be pulled through the module
 * graph, so a bundled JS import risks silently resolving to a URL string instead of parsed JSON depending on
 * Vite's asset-vs-module handling for that path. Fetching it is unambiguous, matches the llms.txt/llms-full.txt
 * external-fetchability convention this same file already serves, and still satisfies SPEC-R6 AC1 in practice
 * (a local same-origin static file resolves long before a user could plausibly reach for `mod+k`) and SPEC-R11
 * (its bytes ride as fetched DATA, never inlined into the measured JS bundle — if anything a STRONGER read of
 * "never inlined into a JS bundle that the size gate measures as code" than a bundled import would have been).
 */
export async function mountCommandPalette(): Promise<void> {
  if (current) return // one palette per page
  const res = await fetch('./sitemap.json')
  const sitemap = (await res.json()) as Sitemap
  swapNow(sitemap.entries)

  for (const stub of sitemap.entries.filter((e) => e.level === 'L3' && e.index)) {
    const stubIndex = stub.index!
    fetch(stubIndex)
      .then((r) => r.json() as Promise<SitemapEntry[]>)
      .then((records) => applyMerge(stubIndex, records))
      .catch(() => {
        // A lazy L3 fetch failure degrades to the stub option (still navigable to its own page) — never
        // breaks the already-mounted palette (LLD §7's edge-case posture).
      })
  }
}

/** openCommandPalette — the header's Search control's own verb: the palette is already mounted (every
 *  `/site` page calls `mountCommandPaletteOnce` at shell-build time), so this just flips `open` on the
 *  live instance — the mod+k hotkey's own affordance, made reachable by click/tap too. A no-op guard
 *  (never throws) covers the pre-mount race a very-first-paint click could theoretically hit. */
export function openCommandPalette(): void {
  if (current) current.open = true
}
