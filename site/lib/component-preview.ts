// site/lib/component-preview.ts — the <component-preview> docs element: a two-column live playground. LEFT is a
// details block + exactly ONE live-knob control per editable prop (routed by type — ui-segmented-control/
// ui-select for an enum, ui-switch for a boolean, ui-text-field for a number/string; batch A removed the
// redundant derived variant chip-row that used to double every enum); RIGHT is the shared A2UI artboard (lib/canvas-surface)
// carrying the live specimen. It renders EITHER a plain ui-* web component (mode="component", target = a tag
// like `ui-button`) OR an A2UI catalog item (mode="a2ui", target = a catalog NAME like `Button`).
//
// DERIVE-DON'T-DUPLICATE: the knobs carry no hand-maintained prop list. Component mode reads the canonical
// `{name}.md` descriptor (via lib/frontmatter → the ONE parser the contract trip-wire enforces); a2ui mode reads
// the shipped default catalog's component def. A new attribute/prop grows a knob for free — the same
// single-source discipline the doc pages already follow.
//
// It is a PLAIN custom element (a docs meta-component), NOT a ui-* control (light DOM, no ElementInternals/ARIA
// contract, no descriptor) — it composes controls for documentation, it is not itself part of the fleet.
import '@agent-ui/components/components' // self-defining ui-* controls (a component-mode target is defined even standalone)
import './component-preview.css'
import { createRenderer, defaultCatalog, valueSlots } from '@agent-ui/a2ui'
import type { RendererHost, ComponentDef, PropDef, JsonSchema } from '@agent-ui/a2ui'
import { loadDescriptorByTag } from './frontmatter.ts'
import type { ParsedAttribute } from '@agent-ui/components/descriptor'
import type {
  UISelectElement,
  UISwitchElement,
  UITextFieldElement,
  UISegmentedControlElement,
  UISegmentElement,
  UISwiperPaginationElement,
  UISwiperPaddlesElement,
} from '@agent-ui/components/components'
import { createCanvasSurface, applyRootStretch } from './canvas-surface.ts'

// The `value` of the enum-knob "unset" option. ui-select's selectionCommit treats value="" as "no key"
// and SKIPS it (selection-commit.ts:98/147 — never commits, never emits `select`, panel stays open), so a
// literal empty-value option would be inert. A non-empty sentinel makes "reset to the control's own default"
// a real, committable choice; the `select` handler maps it back to '' (the knob's unset state). Cannot
// collide with a real enum member (all lowercase identifiers).
const KNOB_UNSET = '__cp-unset__'

// GH #1189 — ui-image / a2ui `Image`: a self-contained inline-SVG data URI (the avatar-doc.ts `PORTRAIT_SRC`
// precedent) so both preview modes demonstrate a real photo without a network fetch (offline-safe, no flaky
// live-network dependency in a browser/jsdom test run). A simple gradient "horizon" rectangle reads legibly
// under either `fit` value and any `aspect` ratio.
const IMAGE_SAMPLE_SRC =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#6ea8d8"/><stop offset="1" stop-color="#1b3a5c"/>' +
      '</linearGradient></defs>' +
      '<rect width="320" height="180" fill="url(#g)"/>' +
      '<circle cx="256" cy="48" r="20" fill="#fff5d6"/>' +
      '<rect y="128" width="320" height="52" fill="#0e2338"/>' +
      '</svg>',
  )
const IMAGE_SAMPLE_ALT = 'A coastline at sunset'

// GH #1266 — ui-video / ui-audio (the #1209 mint): both controls build their persistent `<video|audio
// data-part="media" controls>` child ONLY once `src` goes non-empty (video.ts/audio.ts — the ui-image
// "never a dead player shell" law), so an unseeded bare specimen renders NOTHING (zero children) and the
// fleet gate's structure-survives probe rightly fails. Seeded the IMAGE_SAMPLE_SRC way: a self-contained
// data: URI, offline-safe (no network fetch, no flaky live-media dependency in a browser test run). The
// media itself is a tiny 0.3 s enveloped 440 Hz tone as an 8 kHz/8-bit mono WAV — genuinely PLAYABLE in
// both engines' native chrome (press play, hear the beep), tiny enough to inline. The <video> specimen
// reuses the SAME wav as its media source (a <video> element plays audio-only media natively — real,
// working transport controls) and carries the IMAGE_SAMPLE_SRC coastline as its `poster`, so the reserved
// aspect box shows a real frame instead of a black void (ffmpeg-free: no binary mp4 fixture to mint or
// maintain; the poster + native controls ARE the representative visual).
const MEDIA_SAMPLE_WAV_B64 =
  'UklGRoQJAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YWAJAACAgICAgICAgICAf39/f39/f39/gICAgYGBgICA' +
  'f39+fn5+fn9/gIGBgYKCgYGAf35+fX19fX5/gIGCgoOCgoGAf359fHx8fX1/gIGCg4SDg4KBf358fHt7fH1+gIGDhISEhIOB' +
  'f358e3p6e3x9f4GDhIWFhYSCgH58enl5ent9f4GDhYaGhoWDgH58enl4eXp8foGDhYeHh4aEgX58eXh3eHl7foGDhoeIiIeE' +
  'gn98eXd2d3h6fYCDhoiJiYiGg398eXd2dnd5fICDhomKiomHg4B8eXZ1dXZ4e3+DhomLi4qIhIF9eXZ0dHR3en6ChomLjIuJ' +
  'hoF9eXZzc3N2eX2ChomMjYyKh4J+eXZzcnJ0eHyBhYmMjo2LiIR/enZzcXFzdnuAhYmNjo6NiYWAenZycHBydXp/hImNj4+O' +
  'i4aBe3ZycG9xdHh+hImNkJCPjIeCfHZyb25vcnd9g4iNkJGQjYmDfXdyb21ucXZ8goiNkJKRj4qEfndybm1tcHR6gYeNkZOS' +
  'kIuGf3hybmxsbnN5gIaMkZOTkY2HgHlzbmtrbXF3foWMkZSUk46JgXp0bmtqbHB2fYSLkZSVlJCKg3t0bmtpa250e4OKkJSW' +
  'lZGMhH11b2ppaW1yeoKJkJWXlpONhn52b2poaGtxeICIj5WXl5SPiH93cGpnZ2pvdn+Hj5SYmJaRiYF4cWtnZmludX2GjpSY' +
  'mZeSi4N6cmtnZWdsc3uEjZSYmpiUjYR7c2xnZWZqcXqDjJOYm5qVj4Z9dGxnZGVpb3iBipKYm5uXkYh/dW1nZGRnbnZ/iZKY' +
  'm5yYkoqAd25nY2NmbHR+iJGYnJyalIyCeG9oY2JkanJ8ho+XnJ2blo6EenBoY2FjaHB6hI6WnJ6cmJCGfHJpY2FiZ254go2V' +
  'nJ6emZKIfnNqZGBhZWx2gIuUm5+fm5SKf3VrZGBgZGp0fomTm5+fnJaMgnZsZWBfYmlyfIiSmp+gnpeOhHhuZWBfYWdweoaQ' +
  'mZ+hn5mQhnpvZmBeYGVteISPmJ6hoJuTiHxxZ2FeX2NrdoKNl56hoZyVin5zaWFdXmJpdICLlp2iop6XjIF1amJdXWBocn2J' +
  'lJ2io5+Yj4N3bGNdXF9mb3uHk5yho6GakYV5bWReXF5kbXmFkZuhpKKck4d7b2VeW11ia3aDj5mgpKOelYp9cWZfW1xhaXSB' +
  'jZigpKSfl4x/c2hgW1tfZ3J+i5afpKShmY6CdWphW1peZXB8iZWepKWim5GEd2tiXFpcY216h5Odo6WjnZOHem1jXFlbYWt3' +
  'hJGbo6aknpWJfG9kXVlaYGl1go+aoqaloJeLfnFmXllaXmdygI2YoaamoZmOgXRoX1pZXWVwfYqWoKWmo5uQg3ZqYFpZXGNu' +
  'e4iUnqWnpJ2ShnhsYVtYW2FseIaSnaSnpZ+ViHtuY1tYWmBpdoOQm6OnpqCXi31wZFxYWV5nc4GOmqKnpqKZjX9yZl1ZWF1l' +
  'cX6MmKGmp6Obj4J0aF9ZWFtjb3yJlqCmp6SdkoR3amBaWFpibHmHlJ6lp6WelId5bGJaWFpganeFkp2kp6aglol8bmNbWFle' +
  'aHSCj5ujp6ehmIx+cWVcWFhdZnJ/jZmip6ejmo6Bc2deWFhcZHB9i5ehpqeknJGDdmlfWVhbYm16iJWfpaelnZOGeGthWlha' +
  'YWt4hpOdpaeln5WIe21iW1hZX2l2g5CcpKemoJeLfXBkXFhZXmdzgY6aoqemopmNgHJmXVlYXWVxfoyYoaano5uPgnRoX1lY' +
  'XGRvfImWn6WnpJyRhHdqYFpYW2JteYeTnqSnpJ6Th3ltYltYWmFrd4SRnKOmpZ+ViXxvZFxZWl9pdYKPmqKmpaCXi35xZl5Z' +
  'WV5ncoCNmKGlpqGZjoF0aF9aWV1lcH2Klp+lpqKbkIN2amFbWVxkbnuIlJ6kpqOckoV4bGJcWlxibHiFkpyjpaOdlIh7bmRd' +
  'WlthanaDj5qhpaSelYp9cWZeW1tgaXSBjZigpKSfl4x/c2hgW1tfZ3J+i5aeo6SgmY6CdWphXFtfZnB8iZSdoqShmpCEeGxj' +
  'XVteZG56hpKboaOhm5KGem5lXlxeY2x4hJCZoKOinJOIfHBnYFxdYmt2go2Xn6KinZWKfnNoYV1dYml0gIuWnaGinpaMgXVq' +
  'Y15eYWhyfYmUnKChnpiOg3dsZF9eYWdwe4eSmp+hn5mQhXlvZmBeYGZveYWPmJ6gn5qRh3txaGFfYGVtd4ONlp2gn5qTiX1z' +
  'aWNgYGRsdoGLlZufn5uUin91a2RgYGRrdH+Jk5qen5uVjIF3bWZhYWNqcn2HkZidnpyWjYN5b2djYWNpcXuFj5ecnpyXj4V7' +
  'cWlkYmNocHmDjZWbnZyXkId9c2tlY2NnbneBi5OZnJyYkYh/dW1nY2RnbXaAiZGYm5uYkoqAd25oZGRnbXV+h5CWmpuYk4uC' +
  'eXBqZWRnbHN8hY6VmZqYk4yEe3JrZ2Vna3J7hIyTmJqYlI2FfHRtaGZna3F5goqRlpmYlI6HfnZuaWdna3B4gImQlZiYlY+I' +
  'f3dwa2hoanB3f4eOlJeXlZCJgXlybGloam92fYWNkpaWlZCKgntzbmppa291fISLkZSWlJGLhHx1b2tqa250e4KJj5OVlJGL' +
  'hX52cWxra25zeoGIjpKUlJGMhn94cm5sbG5zeYCGjJGTk5GNh4B5dG9tbG5yeH6Fi4+SkpGNiIF7dXBubW9yd32DiY6RkpCN' +
  'iIJ8dnJvbm9yd3yCiI2QkZCNiYN9eHNwb29ydnuBh4uOkI+NiYR+eXRxcHBydnuAhYqNj4+NiYV/enZycXFydnp/hImMjo6M' +
  'iYWAe3d0cnFzdnp+g4eLjY2MiYaBfXh1c3Jzdnl9goaJjIyMiYaCfnl2dHN0dnl9gYWIi4uLiYaCfnt3dXR0dnl8gISHiYqK' +
  'iYaDf3x4dnV1dnl8gIOGiImJiIaDgHx5d3Z2d3l8f4KFh4iJiIaDgH17eHd3eHl8foGEhoeIh4aDgX57eXh4eHp8foGDhYaH' +
  'hoWDgX98enl5eXp8foCChIWGhoWDgX99e3p6ent8foCCg4SFhYSDgYB+fHt7e3t8fn+BgoOEhIODgYB+fXx8e3x9fn+AgoKD' +
  'g4OCgYB/fn19fH19fn+AgYKCgoKBgYB/fn59fX5+fn+AgIGBgYGBgIB/f39+fn5/f3+AgICAgICAgIB/f39/f39/f38='
const MEDIA_SAMPLE_SRC = 'data:audio/wav;base64,' + MEDIA_SAMPLE_WAV_B64
const VIDEO_SAMPLE_LABEL = 'Sample clip: a short chime'
const AUDIO_SAMPLE_LABEL = 'Sample clip: a short chime'

// ── BATCH A — one control per enum knob, routed by fit (no doubled PROPS knob + VARIANTS chip-row) ───────────
// A small closed enum reads best fully exposed (every option visible, one click to pick) — `ui-segmented-control`
// (ADR-0095; was `ui-radio-group[variant="segmented"]` under the retired ADR-0086) — but ONLY while it fits the
// knob column as a single HORIZONTAL row. The former vertical-stack fallback (4–5 members, or long labels) read
// as a permanently-open dropdown on the catalog page (row/list `align` — flagged on the List card review,
// 2026-08-18) and is retired: anything that cannot fit horizontally is a `ui-select` now. Kim's ruling
// (2026-08-18, superseding the ≤5 SEGMENTED_MAX boundary of the same name): button/checkbox/radio/switch/
// slider/select `size` (3×2ch) and button `variant` (3×5ch) stay segmented; row/list `align` (5),
// ui-radio-group's own `orientation` (2 members but 10-char labels), and every larger enum land on select.

// The fit rule is decided generically from the member set itself (member count × longest label), never a
// per-tag list — measured against the rendered knob panel (component-preview-segmented.browser.test.ts pins
// the whole shape, incl. that an unfit set renders ui-select).
const SEGMENTED_HORIZONTAL_MAX_MEMBERS = 3
// 5, not 6: a 3-member/5-char set (button `variant` solid/soft/ghost) fills the 21rem knob column to EXACTLY 0px
// slack (measured both engines — cells 63px, control right edge flush with the row). 5 is the empirical max
// that fits; a 6-char 3-member set would overflow, so it must stack vertical instead. Guarded by the
// button-`variant` no-overflow probe in component-preview-segmented.browser.test.ts.
const SEGMENTED_HORIZONTAL_MAX_LABEL = 5

/** A member set earns a segmented control only when it fits the knob column as one horizontal row: a short
 *  (≤3-member), short-label (≤5-char) set. Everything wider or longer-labelled renders ui-select instead
 *  (the vertical-stack fallback is retired — Kim 2026-08-18). */
function fitsSegmented(members: readonly string[]): boolean {
  if (members.length === 0 || members.length > SEGMENTED_HORIZONTAL_MAX_MEMBERS) return false
  const maxLabelLength = members.reduce((max, m) => Math.max(max, m.length), 0)
  return maxLabelLength <= SEGMENTED_HORIZONTAL_MAX_LABEL
}

// ── the unified knob model (one shape, both modes) ───────────────────────────────────────────────────────────
type KnobKind = 'enum' | 'boolean' | 'number' | 'string' | 'text' | 'skip'

/** One editable knob derived from a prop/attribute: its name, its control kind, enum members, a skip note. */
interface Knob {
  readonly name: string
  readonly kind: KnobKind
  readonly values?: readonly string[]
  readonly note?: string
}

/** The sentinel knob name for the component-mode default-slot text (edits `element.textContent`). */
const SLOT_TEXT = '#text'

/** A process-unique id for pairing a knob's `<label for>` with its control (accessible name; unique across previews). */
let knobUid = 0
const nextKnobId = (): string => `cp-knob-${(knobUid += 1)}`

/**
 * Write a live DOM property value into #state as its raw knob string — the canvas→knob read-back primitive. Only
 * primitives round-trip to a knob (boolean → 'true'/'false', finite number → String, string → verbatim); anything
 * else (an object/undefined property that is not a knob value) is ignored, leaving #state untouched.
 */
function liveToState(state: Map<string, string>, name: string, live: unknown): void {
  if (typeof live === 'boolean') state.set(name, live ? 'true' : 'false')
  else if (typeof live === 'number' && Number.isFinite(live)) state.set(name, String(live))
  else if (typeof live === 'string') state.set(name, live)
}

// ── knob derivation — a2ui mode (from the default catalog's component def) ───────────────────────────────────
const asRecord = (schema: JsonSchema): Record<string, unknown> => (typeof schema === 'object' ? schema : {})

/** Map one catalog `PropDef.type` JSON-Schema fragment to a knob (enum → radio-group/select · scalar → input · object → skip). */
function knobFromSchema(name: string, def: PropDef): Knob {
  const schema = asRecord(def.type)
  const members = Array.isArray(schema.enum) ? schema.enum.filter((v): v is string => typeof v === 'string') : []
  if (members.length > 0) return { name, kind: 'enum', values: members }
  const t = schema.type
  if (t === 'boolean') return { name, kind: 'boolean' }
  if (t === 'number' || t === 'integer') return { name, kind: 'number' }
  if (t === 'string') return { name, kind: 'string' }
  if (Array.isArray(t)) return { name, kind: 'string' } // e.g. Tabs.selected: ['string','number'] — editable as text
  return { name, kind: 'skip', note: `${typeof t === 'string' ? t : 'complex'} value — edit in code` } // Button.action, etc.
}

/** Every editable knob for an a2ui catalog component, in declared order. */
const a2uiKnobs = (def: ComponentDef): Knob[] =>
  Object.entries(def.properties).map(([name, pd]) => knobFromSchema(name, pd))

// ── knob derivation — component mode (from the {name}.md descriptor's attributes-as-API) ─────────────────────
/** Map one descriptor attribute (its codec `type`) to a knob; `json`/unknown types are read-only skips. */
function knobFromAttribute(attr: ParsedAttribute): Knob {
  const name = attr.name as string // callers filter nameless attrs first
  switch (attr.type) {
    case 'enum':
      return { name, kind: 'enum', values: attr.values ?? [] }
    case 'boolean':
      return { name, kind: 'boolean' }
    case 'number':
      return { name, kind: 'number' }
    case 'string':
      return { name, kind: 'string' }
    default:
      return { name, kind: 'skip', note: `${attr.type ?? 'complex'} value — edit in code` }
  }
}

/** Every editable knob for a component-mode control: one per named attribute, plus the default-slot text knob
 *  — grown ONLY for a SLOT_TEXT_OK target (below, a genuine text/label slot); a NO_SLOT_TEXT or STRUCTURAL
 *  target gets no text knob at all (nothing safe/meaningful for it to edit). */
function componentKnobs(attrs: readonly ParsedAttribute[], tag: string): Knob[] {
  const knobs = attrs.filter((a) => typeof a.name === 'string' && a.name !== '').map(knobFromAttribute)
  if (SLOT_TEXT_OK.has(tag)) knobs.push({ name: SLOT_TEXT, kind: 'text' })
  return knobs
}

// ── initial knob values ──────────────────────────────────────────────────────────────────────────────────────
// a2ui mode carries NO defaults in the catalog (props are all optional), so a bare specimen would render empty.
// These per-component seeds give each a legible starting point (a label/text so it is visible, a modal opened);
// knobs edit the ROOT's own props only. Values are raw knob strings (a boolean is 'true'/'false').
// Exported for scripts/eval-a2ui-catalog.mjs (the rubric a2ui-catalog-example.md §5 runner), which derives
// each card's expected seeds in-page — the seeds are READ from here, never guessed (same one-source rule as
// the exported sampleFor below). No other consumer.
export const A2UI_INITIAL: Record<string, Record<string, string>> = {
  Text: { text: 'Rollout notes shipped to the team — staging verified, canary at 5%.', variant: 'body' },
  Button: { label: 'Button', variant: 'solid' },
  // TextField: label is ARIA-ONLY by fleet law (labelSource → aria-label, text-field.md), so the VISIBLE
  // demonstration rides value+placeholder; 'Label'/'Sample' was the rubric A3 anchor's literal counter-example.
  TextField: { label: 'Full name', placeholder: 'e.g. Ada Lovelace', value: 'Grace Hopper' },
  Field: { label: 'Field label' },
  Checkbox: { label: 'Checkbox' },
  Switch: { label: 'Switch' },
  // Toggle (GH #1352): label is textContent (like Button/Toast), invisible without a seed; `pressed:
  // 'true'` shows the ON paint by default (a bare specimen would otherwise render the idle ghost state).
  Toggle: { label: 'Toggle', pressed: 'true' },
  Select: { placeholder: 'Choose…' },
  Option: { label: 'Option', value: 'a' },
  // Modal is deliberately NOT seeded open: an auto-opened dialog throws a top-layer overlay over the whole
  // gallery on load. It starts closed; the `open` knob reveals it on demand (its sample content is ready).
  // Drawer (ADR-0188) follows the SAME reasoning — also absent, also starts closed. Popover/Menu/FormPopover/
  // Disclosure follow suit for consistency (their SAMPLE_TREES entries below give the `open` knob real content
  // to reveal on demand, rather than forcing every overlay open on load).
  Toolbar: { label: 'Document actions' },
  FormPopover: { label: 'Filter' },
  Swiper: { pagination: 'true', paddles: 'true' },
  // GH #978 — the six remaining generic-fallback types (follow-up to #971). ComboBox's `placeholder` mirrors
  // its own rentalFilterPanelSeed idiom (catalog-coverage.ts) exactly, the SAME demonstrability gap Select's
  // own `placeholder` seed above closes. Grid's `gap`/`min` mirror the stats-grid metric-tile idiom's root
  // props (formerly statsGridDashboardSeed — dropped from the shelf 2026-08-18, the ADR-0165 drop path) (a
  // bare Grid has no default track floor to demonstrate against, the ui-grid COMPONENT_INITIAL precedent);
  // List's `gap` mirrors rentalFilterPanelSeed's own `results_list` props. Tooltip/RadioGroup/SegmentedControl
  // need no seed here — their SAMPLE_TREES content (below) is visible with no root prop at all, the
  // Popover/Menu precedent (only `open`-bearing types with a hidden default need a label seed).
  Grid: { gap: 'md', min: '12rem' },
  List: { gap: 'sm' },
  // GH #1189 — Image: the catalog carries NO per-prop defaults (this file's own comment above), and `src`/
  // `alt` are the two REQUIRED-in-spirit props (image.md) — an unseeded bare specimen would render no <img>
  // at all (the empty-src "never a broken-image box" contract, image.ts). `fit`/`aspect`/`usageHint` are
  // deliberately left unseeded: the component's OWN descriptor defaults (cover / 16/9 / inline) apply the
  // instant the factory leaves them unset, so seeding them here would only duplicate what the control
  // already does for free.
  Image: { src: IMAGE_SAMPLE_SRC, alt: IMAGE_SAMPLE_ALT },
  // The 2026-08-18 empty-specimen sweep (scripts/eval-a2ui-catalog.mjs, rubric a2ui-catalog-example.md):
  // ten cards rendered zero-height/empty roots — nothing seeded, nothing sampled. String/number/boolean
  // props are seeded HERE; array/object props (knob kind 'skip') can't ride knob state at all, so those
  // land as SAMPLE_TREES rootRef props below (the root spread carries arbitrary props, not just children).
  AudioPlayer: { src: MEDIA_SAMPLE_SRC, label: AUDIO_SAMPLE_LABEL },
  BarChart: { label: 'Revenue by region' },
  Ladder: { label: 'Corner radii' },
  Ramp: { label: 'Primary tonal range' },
  Pagination: { page: '2', pages: '8', label: 'Search results' },
  MenuItem: { label: 'Duplicate', value: 'duplicate' },
  // Segment: NO seed — NESTED_ONLY since GH #1332 (no standalone card exists to seed; a lone ui-segment
  // has no chrome by ADR-0095 cl.3's ruled split). Its demonstration lives in SegmentedControl's
  // SAMPLE_TREES fold below.
  Table: { label: 'Failing checks', selectable: 'multi' },
  // duration '0' — ≤0 means never auto-dismiss (toast.ts SPEC-R14/R16): the specimen must OUTLIVE the
  // reader's glance; the shipped default (6000ms) had the card self-dismissing into an empty canvas.
  Toast: { label: 'Draft saved — all changes synced.', duration: '0' },
  // ── round 2 (2026-08-18 review sweep, rubric a2ui-catalog-example.md §4): the tier critics' blind-identify
  // pass found 20+ cards whose R was technically non-empty but taught nothing (A3=1/B4=1) — the mechanical
  // gates can't catch a meaningless-but-nonzero box; the review layer did. Same seeding law as above; array
  // props ride SAMPLE_TREES rootRef below. Content mirrors the corpus idioms (catalog-coverage/frontier). ──
  // Avatar: NO src seed on purpose (verify round 2026-08-18): the landscape sample SVG crushed into the
  // 16px circle taught nothing and src wins over initials — the bare `name` renders initials, which is both
  // visible and the prop demonstrated. A portrait-shaped asset can upgrade this later.
  Avatar: { name: 'Ada Lovelace' },
  Badge: { label: '2 failing', intent: 'danger' },
  Code: { code: 'npm run check && npm test', language: 'bash' },
  Icon: { name: 'check', label: 'Done' },
  Progress: { value: '7', max: '10', label: 'Uploading 7 of 10' },
  Stat: { label: 'Revenue', value: '€54,200', delta: '12', caption: 'vs. last quarter' },
  Swatch: { value: 'oklch(0.55 0.15 250)', label: 'Primary 500' },
  // GH #1327 root cause: poster alone can never paint — ui-video builds NO interior <video> until `src`
  // is non-empty (video.ts's ruled "never a dead player shell" contract, the ui-image empty-src twin), so
  // the poster/label seeds were applied to a host with no media element and the card stayed a black
  // aspect box (B4=1). `src` now rides the SAME offline-safe playable data: wav the component-mode card
  // already seeds (MEDIA_SAMPLE_SRC — the Image.src data-URI precedent for A2UI seeds), which builds the
  // native player; poster then carries the visible frame + label the accessible name. aspect pinned so
  // the box reads deliberate.
  Video: { src: MEDIA_SAMPLE_SRC, poster: IMAGE_SAMPLE_SRC, label: 'Product tour — 2 min', aspect: '16/9' },
  LineChart: { label: 'Weekly signups' },
  Sparkline: { label: 'Revenue trend' },
  TimelineItem: { status: 'done', label: 'Staging verified', description: 'All 12 checks green', timestamp: 'Tue 14:02' },
  // closed-Disclosure's entire visible surface IS the summary — the Popover "trigger child carries it"
  // precedent does not transfer (Disclosure has no trigger child; its sample supplies only the revealed body).
  Disclosure: { summary: 'Rolling restart status' },
  Calendar: { mode: 'range', valueStart: '2026-08-21', valueEnd: '2026-08-24' },
  Timeline: { label: 'Rollout — payments v2.31' },
  ColorPicker: { value: '#7c5cff', name: 'accent' },
  ComboBox: { value: 'Helsinki', label: 'City', placeholder: 'Search cities…' },
  Radio: { label: 'Standard shipping', value: 'standard', checked: 'true' },
  // RadioGroup/SegmentedControl: value lands once the value-before-children control fix ships (in flight
  // 2026-08-18); the seed is correct either way and harmless before it.
  RadioGroup: { value: 'apartment' },
  SegmentedControl: { value: 'standard' },
  Slider: { value: '65', min: '0', max: '100', label: 'Volume' },
  SliderMulti: { valueLo: '200', valueHi: '750', min: '0', max: '1000', label: 'Price range (€)' },
  Textarea: { label: 'Delivery notes', value: 'Leave the package with the concierge; code 4712.', rows: '3' },
  // Attachment (a2ui-catalog-rendering-review, 2026-08-18) — the catalog carries no defaults, and an unseeded
  // ui-attachment falls back to the bare category label ("File"): a chip that demonstrates nothing. Seed the
  // three VISIBLE wire props (`name` → filename, `mimeType` → glyph + category, `sizeBytes` → the meta cell),
  // mirroring documentRowToolbarSeed's own `doc_info` idiom (catalog-coverage.ts) so the card teaches what agents
  // actually emit. `href` stays unseeded on purpose: attachment.ts renders it nowhere yet (the LLD-C6 leg is
  // deferred), so a seed would be invisible on R — the rubric's `demonstrable` set excludes it.
  Attachment: { name: 'Q3 roadmap.pdf', mimeType: 'application/pdf', sizeBytes: '428000' },
}

/** A sensible default-slot label for a component-mode control — its title-cased tag stem (`ui-button` → `Button`). */
const slotTextDefault = (tag: string): string =>
  tag.replace(/^ui-/, '').split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

// ── sample children (so a container renders WITH content; knobs still edit the root only) ────────────────────
/** A sample subtree: the `child`/`children` ref spread onto the root + the flat extra component entries it names. */
interface Sample {
  readonly rootRef: Record<string, unknown>
  readonly extras: Array<Record<string, unknown>>
}

/** Three soft buttons — the sample content for a Row/Column layout root (shows the axis + gap). */
const layoutSample = (): Sample => ({
  rootRef: { children: ['s_l1', 's_l2', 's_l3'] },
  extras: [
    { id: 's_l1', component: 'Button', variant: 'soft', label: 'One' },
    { id: 's_l2', component: 'Button', variant: 'soft', label: 'Two' },
    { id: 's_l3', component: 'Button', variant: 'soft', label: 'Three' },
  ],
})

// Per-container sample trees (mirrors the shapes the example seeds use — Field wraps one control, Select owns its
// Options, Card composes header/content/footer regions (batch D), Tabs pairs Tab/TabPanel, a FormProvider
// coordinates a field + submit).
const SAMPLE_TREES: Record<string, () => Sample> = {
  Field: () => ({ rootRef: { child: 's_in' }, extras: [{ id: 's_in', component: 'TextField', placeholder: 'Sample input' }] }),
  FormProvider: () => ({
    rootRef: { children: ['s_field', 's_actions'] },
    extras: [
      { id: 's_field', component: 'Field', label: 'Full name', child: 's_field_in' },
      { id: 's_field_in', component: 'TextField', name: 'name', placeholder: 'Ada Lovelace' },
      { id: 's_actions', component: 'Row', gap: 'md', justify: 'end', children: ['s_submit'] },
      { id: 's_submit', component: 'Button', variant: 'solid', label: 'Submit', action: { action: 'submit', submit: true } },
    ],
  }),
  Select: () => ({
    rootRef: { children: ['s_o1', 's_o2', 's_o3'] },
    extras: [
      { id: 's_o1', component: 'Option', value: 'a', label: 'Option A' },
      { id: 's_o2', component: 'Option', value: 'b', label: 'Option B' },
      { id: 's_o3', component: 'Option', value: 'c', label: 'Option C' },
    ],
  }),
  Row: layoutSample,
  Column: layoutSample,
  // BATCH D — the region model reads: header (a real heading) · content (body) · footer (an action), mirroring
  // the card-doc.ts reference specimen (header/content/footer, a save action in the footer). Text.variant's
  // catalog wire enum is `h1…h5 | caption | body | label | kicker | overline | quote | lead` (catalog.json,
  // widened GH #808 S1 + ADR-0207) — 'title' is NOT a member (it's the ui-text
  // TRIPLE h5 fans out to internally, TEXT_VARIANT_TABLE in factories.ts — not itself a selectable wire value);
  // an invalid member silently falls back to 'body' (factories.ts's documented unrecognized-value fallback),
  // which is exactly how this shipped broken — the header rendered as body text, losing the header/content
  // distinction. 'h5' is the real wire member that resolves to that title-weight triple.
  Card: () => ({
    rootRef: { children: ['s_header', 's_content', 's_footer'] },
    extras: [
      { id: 's_header', component: 'CardHeader', children: ['s_htext'] },
      { id: 's_htext', component: 'Text', variant: 'h5', text: 'Account' },
      { id: 's_content', component: 'CardContent', children: ['s_ctext'] },
      { id: 's_ctext', component: 'Text', variant: 'body', text: 'Your plan renews on Sep 1. Payment method: Visa ending 4242.' },
      { id: 's_footer', component: 'CardFooter', children: ['s_save'] },
      { id: 's_save', component: 'Button', variant: 'solid', label: 'Save' },
    ],
  }),
  Tabs: () => ({
    rootRef: { children: ['s_tab0', 's_tab1', 's_panel0', 's_panel1'] },
    extras: [
      { id: 's_tab0', component: 'Tab', children: ['s_tl0'] },
      { id: 's_tl0', component: 'Text', variant: 'body', text: 'Tab one' },
      { id: 's_tab1', component: 'Tab', children: ['s_tl1'] },
      { id: 's_tl1', component: 'Text', variant: 'body', text: 'Tab two' },
      { id: 's_panel0', component: 'TabPanel', children: ['s_pt0'] },
      { id: 's_pt0', component: 'Text', variant: 'body', text: 'First panel content' },
      { id: 's_panel1', component: 'TabPanel', children: ['s_pt1'] },
      { id: 's_pt1', component: 'Text', variant: 'body', text: 'Second panel content' },
    ],
  }),
  // Drill(+Panel): a settings drill-down — a root menu panel + one leaf, `path` set to show the leaf
  // already active (GH #1353, ADR-0195 GH #954) — the settings-drill-in idiom (catalog-frontier.ts's
  // drillSettingsSeed). `path` here is a LITERAL specimen value (not a data-model binding — no
  // `{path}` object), matching every other static specimen in this table.
  Drill: () => ({
    rootRef: { path: ['root', 'appearance'], children: ['s_dp_root', 's_dp_appearance'] },
    extras: [
      { id: 's_dp_root', component: 'DrillPanel', key: 'root', parent: '', heading: 'Settings', children: ['s_dp_r1', 's_dp_r2'] },
      { id: 's_dp_r1', component: 'Text', variant: 'body', text: 'Appearance' },
      { id: 's_dp_r2', component: 'Text', variant: 'body', text: 'Notifications' },
      { id: 's_dp_appearance', component: 'DrillPanel', key: 'appearance', parent: 'root', heading: 'Appearance', children: ['s_dp_a1'] },
      { id: 's_dp_a1', component: 'Text', variant: 'body', text: 'Theme, density, and accent color.' },
    ],
  }),
  // DrillPanel browsed standalone (outside its owning Drill) — real body content, the SplitPane precedent.
  DrillPanel: () => ({
    rootRef: { children: ['s_dpp_body'] },
    extras: [{ id: 's_dpp_body', component: 'Text', variant: 'body', text: 'Theme, density, and accent color.' }],
  }),
  // Modal/Drawer revealed content: real-job copy, not a placeholder (GH #971 bar — the 2026-08-18 review
  // sweep flagged "Modal content" as below its overlay siblings' bar).
  Modal: () => ({
    rootRef: { children: ['s_mtitle', 's_mbody'] },
    extras: [
      { id: 's_mtitle', component: 'Text', variant: 'h5', text: 'Remove teammate?' },
      { id: 's_mbody', component: 'Text', variant: 'body', text: 'Alex loses access to 3 projects. This cannot be undone.' },
    ],
  }),
  Drawer: () => ({
    rootRef: { children: ['s_dtitle', 's_dbody'] },
    extras: [
      { id: 's_dtitle', component: 'Text', variant: 'h5', text: 'Filters' },
      { id: 's_dbody', component: 'Text', variant: 'body', text: 'Assignees, labels, and due-date filters for the review queue.' },
    ],
  }),
  // GH #971 — the eight generic "Sample content" fallbacks, each replaced with the type's real job
  // (mirrors the a2ui corpus's own catalog-coverage.ts/catalog-frontier.ts idioms, trimmed to a static
  // literal tree — no data-model bindings — matching every other entry in this table).
  //
  // Toolbar (toolbar.lld.md LLD-C11): a roving-focus action cluster — three ghost buttons, the
  // doc-actions idiom (catalog-coverage.ts), without the nested Tooltip/Popover/Menu triggers a plain
  // specimen doesn't need.
  Toolbar: () => ({
    rootRef: { children: ['s_tb1', 's_tb2', 's_tb3'] },
    extras: [
      { id: 's_tb1', component: 'Button', variant: 'ghost', label: 'Share' },
      { id: 's_tb2', component: 'Button', variant: 'ghost', label: 'Duplicate' },
      { id: 's_tb3', component: 'Button', variant: 'ghost', label: 'Delete' },
    ],
  }),
  // Disclosure: "fold the detail, never the answer" (catalog SPEC §5.2) — a real one-line summary
  // folding real body prose, the log_disclosure idiom (catalog-coverage.ts), minus its Code-block detail
  // (kept to a Text body like every other static specimen here).
  Disclosure: () => ({
    rootRef: { children: ['s_dctext'] },
    extras: [
      {
        id: 's_dctext', component: 'Text', variant: 'body',
        text: 'The rolling restart completed successfully across all 3 replicas with zero downtime.',
      },
    ],
  }),
  // Popover: FIRST child is the disclosure trigger, remaining children move into its panel
  // (factories.ts's popoverFactory note) — the pop_wrap idiom (catalog-coverage.ts).
  Popover: () => ({
    rootRef: { children: ['s_pv_trigger', 's_pv_col'] },
    extras: [
      { id: 's_pv_trigger', component: 'Button', variant: 'ghost', label: 'Share' },
      { id: 's_pv_col', component: 'Column', gap: 'xs', children: ['s_pv_title', 's_pv_body'] },
      { id: 's_pv_title', component: 'Text', variant: 'h5', text: 'Sharing tips' },
      { id: 's_pv_body', component: 'Text', variant: 'caption', text: 'Share links expire after 7 days.' },
    ],
  }),
  // FormPopover: UNLIKE Popover the trigger is control-created (form-popover.ts) — every child is panel
  // content, a Field + TextField (the filter_pop idiom, catalog-frontier.ts's reviewInviteSeed).
  FormPopover: () => ({
    rootRef: { children: ['s_fp_field'] },
    extras: [
      { id: 's_fp_field', component: 'Field', label: 'Name contains', child: 's_fp_input' },
      { id: 's_fp_input', component: 'TextField', name: 'query', placeholder: 'Ada Lovelace' },
    ],
  }),
  // Menu: FIRST child is the trigger, remaining children are MenuItem rows moved into the panel
  // (factories.ts's menuFactory note) — the menu_overflow idiom (catalog-coverage.ts).
  Menu: () => ({
    rootRef: { children: ['s_mn_trigger', 's_mi1', 's_mi2', 's_mi3'] },
    extras: [
      { id: 's_mn_trigger', component: 'Button', variant: 'ghost', label: 'More actions' },
      { id: 's_mi1', component: 'MenuItem', value: 'rename', label: 'Rename' },
      { id: 's_mi2', component: 'MenuItem', value: 'duplicate', label: 'Duplicate' },
      { id: 's_mi3', component: 'MenuItem', value: 'delete', label: 'Delete' },
    ],
  }),
  // Timeline(+Item): a status history, one TimelineItem per stage (done/active/pending) — the review-board
  // idiom (catalog-frontier.ts's reviewSplitSeed).
  Timeline: () => ({
    rootRef: { children: ['s_ti1', 's_ti2', 's_ti3', 's_ti4'] },
    extras: [
      { id: 's_ti1', component: 'TimelineItem', status: 'done', label: 'Spec approved', description: 'Sign-off from platform + risk.', timestamp: 'Mon' },
      { id: 's_ti2', component: 'TimelineItem', status: 'done', label: 'Staging verified', description: 'All 42 checks green.', timestamp: 'Tue' },
      { id: 's_ti3', component: 'TimelineItem', status: 'active', label: 'Canary at 5%', description: 'Error budget steady.', timestamp: 'now' },
      { id: 's_ti4', component: 'TimelineItem', status: 'pending', label: 'Full rollout', description: 'Gated on canary holding 24h.' },
    ],
  }),
  // Swiper(+Item): three slide cards — the onboarding-tour idiom (catalog-frontier.ts's onboardingTourSeed).
  Swiper: () => ({
    rootRef: { children: ['s_sw1', 's_sw2', 's_sw3'] },
    extras: [
      { id: 's_sw1', component: 'SwiperItem', children: ['s_sw1c'] },
      { id: 's_sw1c', component: 'Card', elevation: '1', children: ['s_sw1ct'] },
      { id: 's_sw1ct', component: 'CardContent', children: ['s_sw1t', 's_sw1b'] },
      { id: 's_sw1t', component: 'Text', variant: 'h5', text: 'Your inbox' },
      { id: 's_sw1b', component: 'Text', text: 'Everything assigned to you lands here first.' },
      { id: 's_sw2', component: 'SwiperItem', children: ['s_sw2c'] },
      { id: 's_sw2c', component: 'Card', elevation: '1', children: ['s_sw2ct'] },
      { id: 's_sw2ct', component: 'CardContent', children: ['s_sw2t', 's_sw2b'] },
      { id: 's_sw2t', component: 'Text', variant: 'h5', text: 'Boards' },
      { id: 's_sw2b', component: 'Text', text: 'Drag work between stages; the timeline updates itself.' },
      { id: 's_sw3', component: 'SwiperItem', children: ['s_sw3c'] },
      { id: 's_sw3c', component: 'Card', elevation: '1', children: ['s_sw3ct'] },
      { id: 's_sw3ct', component: 'CardContent', children: ['s_sw3t', 's_sw3b'] },
      { id: 's_sw3t', component: 'Text', variant: 'h5', text: 'Ask the agent' },
      { id: 's_sw3b', component: 'Text', text: 'Describe what you need — it builds the view for you.' },
    ],
  }),
  // Split(+Pane): a horizontal master/detail — a queue pane + a detail pane — the review-board idiom
  // (catalog-frontier.ts's reviewSplitSeed).
  Split: () => ({
    rootRef: { children: ['s_sp1', 's_sp2'] },
    extras: [
      // initial is a relative RATIO seed (split-pane.md), not a percent: 35 against pane 2's default 1
      // rendered ~97:3 and crushed pane 2 to a sliver (2026-08-18 review sweep) — seed BOTH panes.
      { id: 's_sp1', component: 'SplitPane', initial: 35, min: '12rem', children: ['s_sp1col'] },
      { id: 's_sp1col', component: 'Column', gap: 'sm', children: ['s_sp1title', 's_sp1body'] },
      { id: 's_sp1title', component: 'Text', variant: 'h5', text: 'Review queue' },
      { id: 's_sp1body', component: 'Text', variant: 'body', text: 'Payments v2 rollout' },
      { id: 's_sp2', component: 'SplitPane', initial: 65, children: ['s_sp2col'] },
      { id: 's_sp2col', component: 'Column', gap: 'sm', children: ['s_sp2title', 's_sp2body'] },
      { id: 's_sp2title', component: 'Text', variant: 'h5', text: 'Payments v2 rollout — history' },
      { id: 's_sp2body', component: 'Text', variant: 'body', text: 'Spec approved, staging verified, canary at 5%.' },
    ],
  }),
  // The "(+Item)"/"(+Pane)" halves: SwiperItem and SplitPane are ALSO independently browsable catalog
  // entries (a2ui-catalog.ts's NESTED_ONLY set does not fold them into their owner, unlike Option/Tab/
  // TabPanel/the Card regions), so each needs its own standalone specimen too, not only the composed one
  // nested inside Swiper/Split above. TimelineItem/MenuItem need none — both declare no `children`
  // (catalog.json), so sampleFor's `!def.children` branch already renders them without any fallback text.
  SwiperItem: () => ({
    rootRef: { children: ['s_swi_card'] },
    extras: [
      { id: 's_swi_card', component: 'Card', elevation: '1', children: ['s_swi_content'] },
      { id: 's_swi_content', component: 'CardContent', children: ['s_swi_title', 's_swi_body'] },
      { id: 's_swi_title', component: 'Text', variant: 'h5', text: 'Your inbox' },
      { id: 's_swi_body', component: 'Text', text: 'Everything assigned to you lands here first.' },
    ],
  }),
  SplitPane: () => ({
    rootRef: { children: ['s_spp_col'] },
    extras: [
      { id: 's_spp_col', component: 'Column', gap: 'sm', children: ['s_spp_title', 's_spp_body'] },
      { id: 's_spp_title', component: 'Text', variant: 'h5', text: 'Review queue' },
      { id: 's_spp_body', component: 'Text', variant: 'body', text: 'Payments v2 rollout' },
    ],
  }),

  // GH #978 — the six remaining generic "Sample content" fallbacks (Tooltip, RadioGroup, SegmentedControl,
  // ComboBox, List, Grid), a follow-up to #971's own eight (each replaced with the type's real job, mirroring
  // the a2ui corpus's own catalog-coverage.ts idioms exactly, trimmed to a static literal tree — no
  // data-model bindings, matching every other entry in this table).
  //
  // Tooltip: FIRST child is the anchor, remaining children move into the tooltip panel (factories.ts's
  // tooltipFactory note, the SAME accessorFactory-driven overlay contract as Popover/Menu above) — the
  // tip_wrap idiom (catalog-coverage.ts's documentRowToolbarSeed).
  Tooltip: () => ({
    rootRef: { children: ['s_tip_trigger', 's_tip_text'] },
    extras: [
      { id: 's_tip_trigger', component: 'Button', variant: 'ghost', label: 'Info' },
      { id: 's_tip_text', component: 'Text', variant: 'caption', text: 'Last edited 2 hours ago by Ada Lovelace' },
    ],
  }),
  // RadioGroup(+Radio): a real property-type picker, 3 Radio options — the rg_type idiom
  // (catalog-coverage.ts's rentalFilterPanelSeed).
  RadioGroup: () => ({
    rootRef: { children: ['s_rg1', 's_rg2', 's_rg3'] },
    extras: [
      { id: 's_rg1', component: 'Radio', value: 'apartment', label: 'Apartment' },
      { id: 's_rg2', component: 'Radio', value: 'house', label: 'House' },
      { id: 's_rg3', component: 'Radio', value: 'studio', label: 'Studio' },
    ],
  }),
  // SegmentedControl(+Segment): a real room-type picker, 3 Segment options — the room_seg idiom
  // (catalog-coverage.ts's bookingReservationSeed).
  SegmentedControl: () => ({
    rootRef: { children: ['s_sc1', 's_sc2', 's_sc3'] },
    extras: [
      { id: 's_sc1', component: 'Segment', value: 'standard', label: 'Standard' },
      { id: 's_sc2', component: 'Segment', value: 'deluxe', label: 'Deluxe' },
      { id: 's_sc3', component: 'Segment', value: 'suite', label: 'Suite' },
    ],
  }),
  // ComboBox: reuses the Option primitive (the Select precedent) — the cb_city idiom (catalog-coverage.ts's
  // rentalFilterPanelSeed); `placeholder` seeded above so the trigger reads as a real search box.
  ComboBox: () => ({
    rootRef: { children: ['s_cb1', 's_cb2', 's_cb3'] },
    extras: [
      { id: 's_cb1', component: 'Option', value: 'Helsinki', label: 'Helsinki' },
      { id: 's_cb2', component: 'Option', value: 'Stockholm', label: 'Stockholm' },
      { id: 's_cb3', component: 'Option', value: 'Berlin', label: 'Berlin' },
    ],
  }),
  // ── data-driven leaves (2026-08-18 empty-specimen sweep): these types carry their content as ARRAY
  // props, which the knob panel rightly skips ('array value — edit in code') — so the sample tree's
  // rootRef supplies them (the #a2uiPayload root spread carries arbitrary props). Content mirrors each
  // type's own corpus idiom, cited per entry — the card teaches what agents actually emit.
  // BarChart: the revenue-by-region idiom (catalog-coverage.ts's opsReportSeed /regions rows).
  BarChart: () => ({
    rootRef: {
      data: [
        { label: 'EMEA', value: 21400 },
        { label: 'APAC', value: 15800 },
        { label: 'Americas', value: 12300 },
        { label: 'Other', value: 4700 },
      ],
    },
    extras: [],
  }),
  // DescriptionList: the booking-receipt idiom (catalog-frontier.ts's /booking/rows).
  DescriptionList: () => ({
    rootRef: {
      rows: [
        { label: 'Room', value: 'Deluxe King' },
        { label: 'Check-in', value: 'Fri, Aug 21' },
        { label: 'Nights', value: 3 },
        { label: 'Guests', value: 2 },
        { label: 'Total', value: '$412.00' },
      ],
    },
    extras: [],
  }),
  // Ladder: the radii-tiers idiom (catalog-coverage.ts's /radii).
  Ladder: () => ({
    rootRef: {
      tiers: [
        { label: 'sm', value: '4px' },
        { label: 'md', value: '8px' },
        { label: 'lg', value: '16px' },
      ],
    },
    extras: [],
  }),
  // Ramp: the tonal-range idiom (catalog-coverage.ts's /tonal).
  Ramp: () => ({
    rootRef: {
      steps: [
        { label: '100', value: 'oklch(0.95 0.02 250)' },
        { label: '300', value: 'oklch(0.8 0.08 250)' },
        { label: '500', value: 'oklch(0.55 0.15 250)' },
        { label: '700', value: 'oklch(0.4 0.12 250)' },
        { label: '900', value: 'oklch(0.2 0.06 250)' },
      ],
    },
    extras: [],
  }),
  // LineChart / Sparkline: the revenue-trend idiom (catalog-coverage.ts's /trend numbers).
  LineChart: () => ({ rootRef: { values: [42000, 48000, 45000, 53000, 50000, 58000] }, extras: [] }),
  Sparkline: () => ({ rootRef: { values: [42000, 48000, 45000, 53000, 50000, 58000] }, extras: [] }),
  // MultiSelect: the invite-roles idiom (catalog-frontier.ts's in_roles options), two pre-picked.
  MultiSelect: () => ({
    rootRef: {
      options: [
        { label: 'Viewer', value: 'viewer' },
        { label: 'Editor', value: 'editor' },
        { label: 'Admin', value: 'admin' },
      ],
      value: ['viewer', 'editor'],
    },
    extras: [],
  }),
  // Table: the failing-checks idiom (catalog-coverage.ts's checks_table — columns typed, a number column
  // exercising alignment), rows as literals (the seed binds /checks; a static card needs real rows).
  Table: () => ({
    rootRef: {
      columns: [
        { key: 'name', label: 'Check', type: 'string' },
        { key: 'env', label: 'Environment', type: 'string' },
        { key: 'latency', label: 'Latency (ms)', type: 'number' },
      ],
      rows: [
        { name: 'api-gateway', env: 'prod', latency: 812 },
        { name: 'auth-service', env: 'prod', latency: 640 },
        { name: 'billing-worker', env: 'staging', latency: 187 },
      ],
    },
    extras: [],
  }),
  // List: a populated result list, 3 Card rows — the results_list idiom (catalog-coverage.ts's
  // rentalFilterPanelSeed), trimmed to a static tree (the seed's own `{path}`-templated cards, minus the
  // binding).
  List: () => ({
    rootRef: { children: ['s_li1', 's_li2', 's_li3'] },
    extras: [
      { id: 's_li1', component: 'Card', elevation: '1', children: ['s_li1c'] },
      { id: 's_li1c', component: 'CardContent', children: ['s_li1col'] },
      { id: 's_li1col', component: 'Column', gap: 'xs', children: ['s_li1t', 's_li1m'] },
      { id: 's_li1t', component: 'Text', variant: 'h5', text: 'Helsinki — Apartment' },
      { id: 's_li1m', component: 'Text', variant: 'caption', text: '€1,200/mo · 2 bed' },
      { id: 's_li2', component: 'Card', elevation: '1', children: ['s_li2c'] },
      { id: 's_li2c', component: 'CardContent', children: ['s_li2col'] },
      { id: 's_li2col', component: 'Column', gap: 'xs', children: ['s_li2t', 's_li2m'] },
      { id: 's_li2t', component: 'Text', variant: 'h5', text: 'Stockholm — House' },
      { id: 's_li2m', component: 'Text', variant: 'caption', text: '€2,100/mo · 3 bed' },
      { id: 's_li3', component: 'Card', elevation: '1', children: ['s_li3c'] },
      { id: 's_li3c', component: 'CardContent', children: ['s_li3col'] },
      { id: 's_li3col', component: 'Column', gap: 'xs', children: ['s_li3t', 's_li3m'] },
      { id: 's_li3t', component: 'Text', variant: 'h5', text: 'Berlin — Studio' },
      { id: 's_li3m', component: 'Text', variant: 'caption', text: '€850/mo · 1 bed' },
    ],
  }),
  // Grid: a metric-tile dashboard, 4 stat tiles on a track grid — the stat_tile idiom (from the
  // stats-grid-dashboard seed, dropped from the shelf 2026-08-18 per the ADR-0165 drop path; this static
  // tree outlives it — the seed's own `{path}`-templated tiles, minus the binding). `gap`/`min` seeded
  // above so the auto-fit tracks are legible.
  // GH #1189 — Image: the catalog def's `children: "ChildList"` (catalog.json) is the ui-image `caption`
  // slot (image.md) — real, OPTIONAL default-slotted content pinned over the bottom scrim, not a required
  // content model. One Text caption demonstrates the scrim compositing (image.css's flat scrim wash +
  // caption ink), the real job rather than the generic "Sample content" fallback (the GH #971/#978 idiom).
  Image: () => ({
    rootRef: { children: ['s_img_caption'] },
    extras: [{ id: 's_img_caption', component: 'Text', variant: 'caption', text: 'A coastline at sunset' }],
  }),
  Grid: () => ({
    rootRef: { children: ['s_gr1', 's_gr2', 's_gr3', 's_gr4'] },
    extras: [
      { id: 's_gr1', component: 'Card', elevation: '1', children: ['s_gr1c'] },
      { id: 's_gr1c', component: 'CardContent', children: ['s_gr1col'] },
      { id: 's_gr1col', component: 'Column', gap: 'xs', children: ['s_gr1l', 's_gr1v'] },
      { id: 's_gr1l', component: 'Text', variant: 'caption', text: 'Sessions' },
      { id: 's_gr1v', component: 'Text', variant: 'h3', text: '4,820' },
      { id: 's_gr2', component: 'Card', elevation: '1', children: ['s_gr2c'] },
      { id: 's_gr2c', component: 'CardContent', children: ['s_gr2col'] },
      { id: 's_gr2col', component: 'Column', gap: 'xs', children: ['s_gr2l', 's_gr2v'] },
      { id: 's_gr2l', component: 'Text', variant: 'caption', text: 'Conversion' },
      { id: 's_gr2v', component: 'Text', variant: 'h3', text: '3.2%' },
      { id: 's_gr3', component: 'Card', elevation: '1', children: ['s_gr3c'] },
      { id: 's_gr3c', component: 'CardContent', children: ['s_gr3col'] },
      { id: 's_gr3col', component: 'Column', gap: 'xs', children: ['s_gr3l', 's_gr3v'] },
      { id: 's_gr3l', component: 'Text', variant: 'caption', text: 'Avg. order' },
      { id: 's_gr3v', component: 'Text', variant: 'h3', text: '€54' },
      { id: 's_gr4', component: 'Card', elevation: '1', children: ['s_gr4c'] },
      { id: 's_gr4c', component: 'CardContent', children: ['s_gr4col'] },
      { id: 's_gr4col', component: 'Column', gap: 'xs', children: ['s_gr4l', 's_gr4v'] },
      { id: 's_gr4l', component: 'Text', variant: 'caption', text: 'Refunds' },
      { id: 's_gr4v', component: 'Text', variant: 'h3', text: '12' },
    ],
  }),
}

/** The sample subtree for a component: an explicit tree, or a generic single Text/child fallback for any container.
 *  Exported for component-preview-catalog.test.ts's GH #978 negative control (the fallback still bites for a
 *  hypothetical children-bearing type with no SAMPLE_TREES entry) — no other consumer. */
export function sampleFor(name: string, def: ComponentDef): Sample {
  const explicit = SAMPLE_TREES[name]
  if (explicit) return explicit()
  if (!def.children) return { rootRef: {}, extras: [] }
  const text = { id: 's_child', component: 'Text', variant: 'body', text: 'Sample content' }
  return def.children === 'child'
    ? { rootRef: { child: 's_child' }, extras: [text] }
    : { rootRef: { children: ['s_child'] }, extras: [text] }
}

// ── sample children — component mode (BATCH B: representative content for structural containers) ─────────────
// The component-mode counterpart to a2ui-mode's SAMPLE_TREES/A2UI_INITIAL above: a bare `document.createElement
// (tag)` isn't enough for (a) a control whose OWN `connected()` requires real light-DOM structure to construct
// at all (ui-tooltip/ui-menu/ui-popover each throw without a trigger/anchor as their first element child,
// `#ensureParts()` in tooltip.ts / menu.ts / popover.ts), or (b) a STRUCTURAL container (below) whose default
// slot IS its real content model — a bare grid/row/list/card/radio-group/form-provider would render a single
// stub or an empty box, which the representative-specimen law treats as a defect. Component mode otherwise
// NEVER appends children (a knob only ever sets an attribute or the default-slot text) — this map is the one,
// narrow, per-TAG exception (component mode has no catalog def to key by name, unlike SAMPLE_TREES).
const sampleTrigger = (): HTMLElement => {
  // Dogfoods ui-button as the overlay trigger/anchor for the tooltip/menu/popover specimens (Kim's
  // directive). Each of those controls adopts its FIRST element child as the trigger/anchor and sets
  // data-part + the disclosure ARIA (aria-expanded/-controls/-describedby) on it — a ui-button is a valid
  // element child, is focusable, and is semantically a button, so it composes cleanly as the trigger.
  const btn = document.createElement('ui-button')
  btn.textContent = 'Trigger'
  return btn
}

/** A plain labelled block — page-authored demo content (NOT a ui-* control), the component-mode analogue of the
 *  *-doc.ts pages' own `demoBox()` (site/lib/specimens.ts) — reimplemented locally so component-preview.ts
 *  carries no dependency on the docs-page demo-content stylesheet. Fills a layout primitive's default slot so
 *  its axis/gap/track flow is actually visible (a single stub cell teaches nothing — the representative-
 *  specimen law); styled minimally by `.cp-sample-item` in component-preview.css. */
function sampleItem(label: string): HTMLElement {
  const item = document.createElement('div')
  item.className = 'cp-sample-item'
  item.textContent = label
  return item
}

/** A `[role=option]` child — the same shape #buildKnob's own ui-select enum knob uses (select.md / combo-box.md
 *  `slots`): appended BEFORE connection, the control moves it into its own listbox at first connect. */
function sampleOption(value: string, label: string): HTMLElement {
  const option = document.createElement('div')
  option.setAttribute('role', 'option')
  option.setAttribute('value', value)
  option.textContent = label
  return option
}

const COMPONENT_SAMPLE_CHILDREN: Record<string, () => HTMLElement[]> = {
  // ── STRUCTURAL containers (below) — the default slot IS the content model, mirrors the *-doc.ts shapes ────
  'ui-grid': () => ['Cell 1', 'Cell 2', 'Cell 3', 'Cell 4', 'Cell 5', 'Cell 6'].map(sampleItem), // 6 cells (grid-doc.ts): multiple auto-fit tracks form — COMPONENT_INITIAL below seeds gap/min so they're visible
  'ui-row': () => ['Item one', 'Item two', 'Item three'].map(sampleItem),
  'ui-column': () => ['Item one', 'Item two', 'Item three'].map(sampleItem),
  'ui-list': () => ['First item', 'Second item', 'Third item'].map(sampleItem),
  'ui-card': () => {
    const header = document.createElement('ui-card-header')
    header.textContent = 'Account'
    const content = document.createElement('ui-card-content')
    content.textContent = 'Your plan renews on Sep 1. Payment method: Visa ending 4242.'
    const footer = document.createElement('ui-card-footer')
    const save = document.createElement('ui-button')
    save.setAttribute('variant', 'solid')
    save.textContent = 'Save'
    footer.append(save)
    return [header, content, footer]
  },
  'ui-split': () =>
    ['Pane 1', 'Pane 2', 'Pane 3'].map((label) => {
      const pane = document.createElement('ui-split-pane')
      pane.append(sampleItem(label))
      return pane
    }),
  'ui-split-pane': () => [sampleItem('Pane content')],
  // ui-swiper-item (ADR-0124) — the ui-split-pane precedent exactly: its default slot IS the author's own
  // arbitrary slide content, left as direct host children (swiper-item.ts's `connected()` is a documented
  // no-op — it builds nothing of its own, see that file's comment). A bare specimen with no sample content
  // would render an empty box, the same representative-specimen gap ui-split-pane closes above.
  'ui-swiper-item': () => [sampleItem('Slide content')],
  // ui-toolbar (ADR-0121) — the real job, not a one-child stub: a formatting cluster + an alignment cluster +
  // undo/redo, real ui-buttons throughout (the whole-shape/representative-specimen law, LLD §5). Mirrors the
  // ui-modal sample function's own ui-row + ui-button construction, above.
  'ui-toolbar': () => {
    const ghostButton = (label: string): HTMLElement => {
      const b = document.createElement('ui-button')
      b.setAttribute('variant', 'ghost')
      b.textContent = label
      return b
    }
    const cluster = (labels: readonly string[]): HTMLElement => {
      const row = document.createElement('ui-row')
      row.setAttribute('gap', 'xs')
      row.append(...labels.map(ghostButton))
      return row
    }
    return [cluster(['Bold', 'Italic', 'Underline']), cluster(['Left', 'Center', 'Right']), ghostButton('Undo'), ghostButton('Redo')]
  },
  'ui-radio-group': () =>
    (
      [
        ['sm', 'Small'],
        ['md', 'Medium'],
        ['lg', 'Large'],
      ] as const
    ).map(([value, label]) => {
      const radio = document.createElement('ui-radio')
      radio.setAttribute('value', value)
      radio.textContent = label
      return radio
    }),
  // ADR-0095 — the standalone segmented control's own gallery specimen (ui-segment children, not ui-radio).
  'ui-segmented-control': () =>
    (
      [
        ['sm', 'Small'],
        ['md', 'Medium'],
        ['lg', 'Large'],
      ] as const
    ).map(([value, label]) => {
      const segment = document.createElement('ui-segment')
      segment.setAttribute('value', value)
      segment.textContent = label
      return segment
    }),
  'ui-form-provider': () => {
    const field = document.createElement('ui-field')
    field.setAttribute('label', 'Full name')
    const input = document.createElement('ui-text-field')
    input.setAttribute('name', 'name')
    field.append(input)
    const submit = document.createElement('ui-button')
    submit.setAttribute('variant', 'solid')
    submit.textContent = 'Submit'
    return [field, submit]
  },
  // ADR-0117 — a real button so the gallery specimen paints a non-zero box (the provider itself has no
  // geometry of its own; the "test the whole shape" law needs REAL content under a STRUCTURAL target).
  'ui-theme-provider': () => {
    const button = document.createElement('ui-button')
    button.setAttribute('variant', 'solid')
    button.textContent = 'Themed'
    return [button]
  },

  // ── other NO_SLOT_TEXT targets — self-constructing controls that had NO representative content before ─────
  'ui-field': () => {
    const field = document.createElement('ui-text-field')
    field.setAttribute('type', 'email')
    return [field]
  },
  'ui-tabs': () => {
    const tab1 = document.createElement('ui-tab')
    tab1.setAttribute('key', 'overview')
    tab1.textContent = 'Overview'
    const tab2 = document.createElement('ui-tab')
    tab2.setAttribute('key', 'pricing')
    tab2.textContent = 'Pricing'
    const panel1 = document.createElement('ui-tab-panel')
    panel1.textContent = 'The overview panel content.'
    const panel2 = document.createElement('ui-tab-panel')
    panel2.textContent = 'The pricing panel content.'
    return [tab1, tab2, panel1, panel2]
  },
  'ui-select': () => [sampleOption('a', 'Option A'), sampleOption('b', 'Option B'), sampleOption('c', 'Option C')],
  // M-F — ui-multi-select: the SAME [role=option] shape as ui-select, direct light-DOM children (no
  // control-created panel to move into — the host itself IS the listbox).
  'ui-multi-select': () => [sampleOption('a', 'Option A'), sampleOption('b', 'Option B'), sampleOption('c', 'Option C')],
  'ui-combo-box': () => [
    sampleOption('apple', 'Apple'),
    sampleOption('banana', 'Banana'),
    sampleOption('cherry', 'Cherry'),
  ],
  'ui-menu': () => {
    const items = ['New file', 'Open file', 'Save', 'Exit'].map((label) => {
      const item = document.createElement('div')
      item.dataset['value'] = label.toLowerCase().replace(/\s+/g, '-')
      item.textContent = label
      return item
    })
    return [sampleTrigger(), ...items]
  },
  'ui-popover': () => {
    const section = document.createElement('section')
    const heading = document.createElement('h3')
    heading.textContent = 'Settings'
    const body = document.createElement('p')
    body.textContent = 'Panel content in the top layer.'
    section.append(heading, body)
    return [sampleTrigger(), section]
  },
  // ui-form-popover (GH #294 F4): UNLIKE ui-popover, the trigger is CONTROL-CREATED from the `label` prop —
  // there is no author trigger to seed (sampleTrigger() does not apply here). ALL children move into the
  // control-created panel, so the real job is real form content: a 6-item check group, a radio group, and a
  // text field (the reference specimen the design intake names — form-popover.lld.md LLD-C7). The `label` knob
  // seeds its own visible summary text via COMPONENT_INITIAL below.
  'ui-form-popover': () => {
    const checkbox = (value: string, label: string): HTMLElement => {
      const c = document.createElement('ui-checkbox')
      c.setAttribute('name', 'opt')
      c.setAttribute('value', value)
      c.textContent = label
      return c
    }
    const checkGroup = document.createElement('fieldset')
    checkGroup.setAttribute('role', 'group')
    checkGroup.setAttribute('aria-label', 'Options')
    checkGroup.append(
      ...(['a', 'b', 'c', 'd', 'e', 'f'] as const).map((v, i) => checkbox(v, `Option ${String.fromCharCode(65 + i)}`)),
    )
    // The real `ui-radio-group` (GH #302, fixed: rovingFocus's connection wiring now survives the
    // #ensureParts() child-move-then-reconnect cycle — element.ts's `beginConnecting`/`endConnecting`
    // reentrancy window, dom/element.ts).
    const radioGroup = document.createElement('ui-radio-group')
    radioGroup.setAttribute('name', 'sort')
    radioGroup.setAttribute('aria-label', 'Sort by')
    const radio = (value: string, label: string): HTMLElement => {
      const r = document.createElement('ui-radio')
      r.setAttribute('value', value)
      r.textContent = label
      return r
    }
    radioGroup.append(radio('newest', 'Newest'), radio('oldest', 'Oldest'), radio('relevant', 'Most relevant'))
    const search = document.createElement('ui-text-field')
    search.setAttribute('label', 'Search')
    return [checkGroup, radioGroup, search]
  },
  'ui-tooltip': () => {
    const text = document.createElement('span')
    text.textContent = 'Save your changes (Ctrl+S)'
    return [sampleTrigger(), text]
  },
  'ui-modal': () => {
    // do NOT auto-open (the `open` knob stays the reveal mechanism) — content is ready the moment it is.
    const heading = document.createElement('h2')
    heading.textContent = 'Example dialog'
    const body = document.createElement('p')
    body.textContent = 'A representative modal body.'
    const actions = document.createElement('ui-row')
    actions.setAttribute('gap', 'sm')
    actions.setAttribute('justify', 'end')
    const close = document.createElement('ui-button')
    close.setAttribute('variant', 'soft')
    close.textContent = 'Close'
    actions.append(close)
    return [heading, body, actions]
  },
  // ui-drawer (ADR-0188): the SAME do-NOT-auto-open reasoning as ui-modal above — the `open` knob stays the
  // reveal mechanism (an auto-opened top-layer dialog would throw a scrim over the whole gallery on load).
  'ui-drawer': () => {
    const heading = document.createElement('h2')
    heading.textContent = 'Example drawer'
    const body = document.createElement('p')
    body.textContent = 'A representative drawer body.'
    const actions = document.createElement('ui-row')
    actions.setAttribute('gap', 'sm')
    actions.setAttribute('justify', 'end')
    const close = document.createElement('ui-button')
    close.setAttribute('variant', 'soft')
    close.textContent = 'Close'
    actions.append(close)
    return [heading, body, actions]
  },
  // ui-command-modal (ADR-0125): the palette's real job — a populated, GROUPED command list (not a one-child
  // stub), the whole-shape/representative-specimen law. Also do NOT auto-open (the ui-modal precedent, above);
  // the `open` knob reveals it, so the viewer sees the trigger-to-palette flow rather than a pre-opened dialog.
  'ui-command-modal': () => {
    const commandOption = (value: string, label: string, shortcut?: string): HTMLElement => {
      const option = document.createElement('div')
      option.setAttribute('role', 'option')
      option.setAttribute('value', value)
      option.append(document.createTextNode(label))
      if (shortcut) {
        const span = document.createElement('span')
        span.setAttribute('data-role', 'shortcut')
        span.setAttribute('aria-hidden', 'true')
        span.textContent = shortcut
        option.append(span)
      }
      return option
    }
    const group = (id: string, label: string, ...options: HTMLElement[]): HTMLElement => {
      const heading = document.createElement('div')
      heading.id = id
      heading.setAttribute('data-role', 'group-label')
      heading.textContent = label
      const g = document.createElement('div')
      g.setAttribute('role', 'group')
      g.setAttribute('aria-labelledby', id)
      g.append(heading, ...options)
      return g
    }
    return [
      group('cp-cmd-nav', 'Navigation', commandOption('home', 'Go Home', '⌘H'), commandOption('settings', 'Settings', '⌘,')),
      group('cp-cmd-actions', 'Actions', commandOption('logout', 'Log out'), commandOption('share', 'Share file')),
    ]
  },
  // ui-disclosure (ADR-0113): the host's light-DOM children seed the fold's body content at connect time —
  // the "children = body" anatomy invariant (disclosure.md). NOT the STRUCTURAL bucket below: #ensureParts()
  // ADOPTS these children into a nested `<div data-part="body">` part rather than leaving them as direct
  // host children, so it lives in NO_SLOT_TEXT (see that Set's own comment).
  'ui-disclosure': () => {
    const body = document.createElement('p')
    body.textContent = 'Folded content, revealed on toggle.'
    return [body]
  },
  // ui-image (GH #1189): the caption is genuine OPTIONAL default-slotted content (image.md `slots`) left
  // EXACTLY where the author places it — connected() only ever mutates its OWN control-built <img
  // data-part="media"> (prepended, never replacing existing children) and never touches this sibling, so
  // seeding it as a plain pre-connect child is safe (unlike the NO_SLOT_TEXT/toast precedent above, nothing
  // here gets ADOPTED into a part — image.css selects it structurally, `:not([data-part='media'])`). One
  // caption span demonstrates the bottom scrim compositing (image.css's flat scrim wash + caption ink) —
  // the real job, not a bare uncaptioned box.
  'ui-image': () => {
    const caption = document.createElement('span')
    caption.textContent = IMAGE_SAMPLE_ALT
    return [caption]
  },
  // ui-toast (ADR-0112): the message text MUST be a light-DOM child present before connect — #ensureParts()
  // adopts it into the message part at that instant (SPEC-R15 AC2, the toast.md example markup precedent).
  'ui-toast': () => {
    const message = document.createElement('span')
    message.textContent = 'File uploaded.'
    return [message]
  },
  // ui-toast-region (ADR-0112, LLD-C8): a STRUCTURAL target — its real content model is `ui-toast` children,
  // stacked in append order (the toast.md example markup: one plain toast + one actionable urgent toast).
  // Present before connect so the region's own `#syncVisibility()` opens its popover on first paint.
  'ui-toast-region': () => {
    const plain = document.createElement('ui-toast')
    plain.textContent = 'File uploaded.'
    const actionable = document.createElement('ui-toast')
    actionable.setAttribute('urgent', '')
    actionable.setAttribute('duration', '0')
    actionable.setAttribute('action', 'Retry')
    actionable.textContent = 'Upload failed.'
    return [plain, actionable]
  },
  // ui-timeline-item (ADR-0122): the disclosure precedent exactly — a `[data-role="detail"]` child is
  // MOVED into a composed `ui-disclosure` at connect (#ensureAnatomy), so it lives in NO_SLOT_TEXT below.
  'ui-timeline-item': () => {
    const detail = document.createElement('span')
    detail.setAttribute('data-role', 'detail')
    detail.textContent = 'Carrier: UPS · Tracking 1Z999AA10123456784'
    return [detail]
  },
  // ui-timeline (ADR-0122): a STRUCTURAL target — its real content model is authored `ui-timeline-item`
  // children, read back in DOM order (the timeline.md example markup: a real order-tracking chronology).
  'ui-timeline': () => {
    const rows: Array<[string, string, string]> = [
      ['done', 'Order placed', 'Apr 15, 2:30 PM'],
      ['active', 'Shipped', 'Apr 17, 11:45 AM'],
      ['pending', 'Delivered', 'Expected Apr 20'],
    ]
    return rows.map(([status, label, timestamp]) => {
      const item = document.createElement('ui-timeline-item')
      item.setAttribute('status', status)
      item.setAttribute('label', label)
      item.setAttribute('timestamp', timestamp)
      return item
    })
  },
  // ui-status-stream (ADR-0122): the ui-toast-region precedent exactly — a STRUCTURAL target whose real
  // content model is `ui-timeline-item` children this host normally creates via its OWN imperative
  // appendEntry/update API, but which render identically when pre-authored (a representative bare specimen).
  'ui-status-stream': () => {
    const rows: Array<[string, string]> = [
      ['done', 'Searching the codebase…'],
      ['active', 'Generating the patch…'],
    ]
    return rows.map(([status, label]) => {
      const item = document.createElement('ui-timeline-item')
      item.setAttribute('status', status)
      item.setAttribute('label', label)
      return item
    })
  },
}

// The component-mode counterpart to a2ui-mode's A2UI_INITIAL: a per-tag knob-value seed for a control whose
// OWN descriptor default is not demonstrable (not a design fix — icon.md's `glyph: ''` default is CORRECT, an
// unset icon legitimately renders nothing; this only supplies a DEMO value, same discipline as A2UI_INITIAL
// never touching the catalog). ui-icon is one fleet member: `glyph` defaults to '' (renders nothing, icon.ts:
// 38-41), so a bare specimen would be an invisible 0×0 box — seeded with a real, shipped Phosphor name so the
// gallery's whole-shape law (box > 0) has something to measure. ui-grid/ui-field (batch B) seed a legible
// starting prop value to go with their new sample children (grid-doc.ts's own gap/min; field.md's own default
// label is '').
// Wave M1 (ADR-0111/ADR-0113): ui-stat's `label`/`figure` and ui-badge's `label` are real string knobs (not
// a codec skip), but their descriptor default is '' (blank) — same demonstrability gap as ui-icon's `glyph`
// — so a bare specimen would render an empty tile / an unlabeled dot. ui-disclosure's `summary` is likewise
// a real string knob defaulting to '' — an unlabeled fold reads as a bare chevron with no affordance text.
// Wave M1 (ADR-0118): ui-swatch's `color`/`label` are real string knobs (not a codec skip) but default to
// '' (blank) — the same demonstrability gap as ui-icon's `glyph` — so a bare specimen would render an empty
// transparent box with no name to read.
const COMPONENT_INITIAL: Record<string, Record<string, string>> = {
  'ui-icon': { glyph: 'check' },
  'ui-grid': { gap: 'md', min: '8rem' },
  'ui-field': { label: 'Email' },
  'ui-stat': { label: 'Revenue', figure: '48200', delta: '12' },
  'ui-badge': { label: '3 failing', intent: 'danger' },
  'ui-disclosure': { summary: 'Full log' },
  // ui-form-popover (GH #294 F4): `label` is a real string knob defaulting to '' — the same demonstrability
  // gap as ui-disclosure's `summary` above (an unlabeled trigger reads as an empty button).
  'ui-form-popover': { label: 'Filters · 0 selected' },
  'ui-swatch': { color: '--md-sys-color-primary', label: 'primary' },
  // ui-timeline-item (ADR-0122): `label`/`timestamp` are real string knobs defaulting to '' — the same
  // demonstrability gap as ui-disclosure's `summary` above; a bare specimen would render an unlabeled dot.
  'ui-timeline-item': { status: 'done', label: 'Deployed', timestamp: 'Apr 15, 2:30 PM' },
  // GH #458 — ui-pagination (ADR-0163 cl.6): `page`/`pages` are REAL editable number knobs (unlike ui-table/
  // ui-sparkline's JSON-string `kind: 'skip'` attrs below), so #buildComponent()'s knob-apply loop runs for
  // both after any host-attribute seed and reads them straight from #state — a COMPONENT_SAMPLE_ATTRS seed
  // (which writes only the host attribute, never #state) would be silently undone the instant that loop ran
  // (`raw === undefined` ⇒ `el.removeAttribute`), collapsing the specimen back to the descriptor's honest-
  // empty default (`pages="0"`, SPEC-R3) and rendering nothing. Seeded here instead (mid-range, so both
  // ellipsis markers + the active stop paint) — the ui-icon/ui-stat precedent exactly, since #seedState()
  // reads COMPONENT_INITIAL straight into #state, so the knob-apply loop reflects the seed rather than erasing it.
  'ui-pagination': { page: '5', pages: '12' },
  // GH #1189 — ui-image: `src`/`alt` default to '' (image.md) — an unseeded bare specimen renders no <img>
  // at all (the empty-src "never a broken-image box" contract). `fit`/`aspect`/`usageHint` all carry
  // non-empty descriptor defaults (cover / 16/9 / inline) already auto-seeded by #seedState()'s own
  // descriptor-default loop above — no COMPONENT_INITIAL entry needed for those three.
  'ui-image': { src: IMAGE_SAMPLE_SRC, alt: IMAGE_SAMPLE_ALT },
  // GH #1266 — ui-video / ui-audio (the #1209 mint): the exact ui-image gap — `src`/`label` default to ''
  // (video.md/audio.md), and an unseeded bare specimen builds NO media child at all (the "never a dead
  // player shell" contract in video.ts/audio.ts). Seeded with the offline-safe playable wav (constants
  // block up top); ui-video also gets the coastline SVG as `poster` so the aspect box shows a real frame.
  // `preload` (both) and `aspect` (video) carry non-empty descriptor defaults already auto-seeded by
  // #seedState()'s descriptor-default loop — no entry needed (the ui-image fit/aspect note, verbatim).
  'ui-video': { src: MEDIA_SAMPLE_SRC, poster: IMAGE_SAMPLE_SRC, label: VIDEO_SAMPLE_LABEL },
  'ui-audio': { src: MEDIA_SAMPLE_SRC, label: AUDIO_SAMPLE_LABEL },
}

// A per-tag static HOST ATTRIBUTE seed (batch C) — distinct from COMPONENT_INITIAL (which seeds a KNOB's
// value): this is for an attribute the descriptor does NOT expose as an editable prop at all, so no knob could
// ever supply it. ui-slider is the one fleet member: its track is ::before/::after (no text KNOB — NO_SLOT_TEXT
// below — could ever write into it), so without an explicit seed a bare specimen carries no accessible name at
// all. (GH #1141 later gave ui-slider a real, visible-by-default value-readout PART — legitimate light-DOM
// text driven by the `value` prop, not the generic SLOT_TEXT knob mechanism this seed is about.)
//
// Wave M1 (ADR-0107): ui-sparkline/ui-bar-chart's `values`/`data` are JSON-string attributes — a codec
// `knobFromAttribute` maps to `kind: 'skip'` (no editable knob, same as any complex-typed attr), so their
// LIVE descriptor default (an empty array) would mount zero rendered children (an honest empty state per
// SPEC-R3/R7, but an uninstructive bare specimen — the same gap ui-icon's `name: ''` default closes via
// COMPONENT_INITIAL). Seeded here with the SAME JSON-string shape the descriptors' own `.md` examples use.
// Wave M1 (ADR-0111, report-family.lld.md): ui-table's `columns`/`rows` are JSON-string attributes — the
// same `kind: 'skip'` codec gap as ui-sparkline/ui-bar-chart's `values`/`data` above (no editable knob), so
// its LIVE descriptor default (an empty array) would stamp no table at all (an honest empty state per
// SPEC-R3, but an uninstructive bare specimen). Seeded with the same JSON-string shape table.md's own
// example uses.
// Wave M1 (ADR-0118, token-surfaces.lld.md LLD-C9): ui-ramp's `steps`/ui-ladder's `tiers` are JSON-string
// attributes — the same `kind: 'skip'` codec gap as ui-sparkline/ui-bar-chart's `values`/`data` above (no
// editable knob), so their LIVE descriptor default (an empty array) would render an empty strip/list (an
// honest empty state per SPEC-R7/R11, but an uninstructive bare specimen). Seeded with a real color/
// dimension series so the gallery's whole-shape law (a non-collapsed strip/list) has something to measure.
const COMPONENT_SAMPLE_ATTRS: Record<string, Record<string, string>> = {
  'ui-slider': { 'aria-label': 'Volume' },
  'ui-sparkline': { values: '[3,5,4,8,7]' },
  'ui-bar-chart': { data: '[{"label":"EMEA","value":42},{"label":"APAC","value":31}]' },
  // ADR-0205 — ui-line-chart's `values` is the same JSON-string `kind: 'skip'` codec gap as ui-sparkline's
  // above (no editable knob), so its LIVE default ([]) would mount nothing. Seeded with the same sample series.
  'ui-line-chart': { values: '[3,5,4,8,7]' },
  'ui-table': {
    columns: '[{"key":"region","label":"Region"},{"key":"revenue","label":"Revenue","type":"number"}]',
    rows: '[{"region":"EMEA","revenue":42000},{"region":"APAC","revenue":31000}]',
  },
  // ADR-0201 — ui-description-list's `rows` is the same JSON-string `kind: 'skip'` codec gap as ui-table's
  // above (no editable knob), so its LIVE default ([]) would render nothing. Seeded with a real receipt —
  // the canonical confirm-step job (GH #1174/#1185) — so the whole-shape law has rows to measure.
  'ui-description-list': {
    rows:
      '[{"label":"Room","value":"Deluxe King"},{"label":"Nights","value":3},' +
      '{"label":"Breakfast","value":"Included"},{"label":"Total","value":"$412.00"}]',
  },
  'ui-ramp': {
    steps:
      '[{"label":"100","value":"--md-sys-color-primary-100"},{"label":"300","value":"--md-sys-color-primary-300"},' +
      '{"label":"500","value":"--md-sys-color-primary-500"},{"label":"700","value":"--md-sys-color-primary-700"},' +
      '{"label":"900","value":"--md-sys-color-primary-900"}]',
  },
  'ui-ladder': {
    tiers: '[{"label":"sm","value":"24px"},{"label":"md","value":"28px"},{"label":"lg","value":"36px"}]',
  },
}

// COMPONENT_SAMPLE_INIT — a per-tag post-construction driver call, distinct from COMPONENT_SAMPLE_CHILDREN
// (light-DOM children appended BEFORE connect): ui-swiper-pagination/-paddles are pure coordinator-driven
// anchors (swiper-pagination.md/swiper-paddles.md: `slots: []` on both) — ALL their visible content is built
// imperatively by the owning `ui-swiper`'s `renderInto`/`fill` PUBLIC methods (properties: in their own .md),
// never authored as children. A bare specimen has nothing to seed as light DOM at all; calling their own
// public coordinator method directly (rather than hand-duplicating the dot/button markup it produces) gives a
// representative specimen that can never drift from the real renderInto()/fill() shape.
const COMPONENT_SAMPLE_INIT: Record<string, (el: HTMLElement) => void> = {
  'ui-swiper-pagination': (el) => (el as UISwiperPaginationElement).renderInto(3, 0, () => {}),
  'ui-swiper-paddles': (el) => (el as UISwiperPaddlesElement).fill(() => {}, () => {}, 'horizontal'),
}

// ── SLOT_TEXT gating — component mode (the fleet-wide hardening) ──────────────────────────────────────────────
// `componentKnobs()` grows a SLOT_TEXT knob ONLY for a SLOT_TEXT_OK target (below) — a plain
// `el.textContent = raw` write. That is correct for a control whose default/unnamed slot genuinely IS a
// text/label slot — but it is WRONG for two other shapes: a control that builds/owns real structural children
// in `connected()` (a self-created editor, listbox, dialog, panel, tablist strip, rail/thumbs, or
// label/description/error chrome) that `textContent =` would silently destroy (NO_SLOT_TEXT); and a STRUCTURAL
// container (batch B) whose default slot IS its real content model — children, not a string (grid/row/column/
// list/card/radio-group/form-provider). Both get real sample CHILDREN instead (COMPONENT_SAMPLE_CHILDREN
// above) and NO text knob at all.
//
// MECHANISM (per Kim's ruling): the descriptor model does NOT carry this distinction structurally today —
// `slots[]` is free-text prose (a schema change is real ADR-0004 surgery, out of this file's scope) — so this
// is an EXPLICIT PER-TAG THREE-WAY PARTITION, mirroring the COMPONENT_SAMPLE_CHILDREN / a2ui-mode A2UI_INITIAL
// precedent (three allowlists, not a runtime heuristic). A runtime check (e.g. "skip if el.children.length > 0
// at apply time") was considered and REJECTED: ui-text legitimately builds a heading STAMP element when
// `as ≠ 'none'` (ADR-0025/0078) and runs a self-healing childList observer that re-adopts its text after a
// `textContent` clobber — so a live children-count would misclassify a genuinely SAFE, self-healing control as
// unsafe. The partition below was verified per-control (component-preview-slot-text.test.ts pins it — see
// there for the fleet-wide diagnosis) — NOT by observing runtime state.
//
// NO_SLOT_TEXT — connected() builds/owns real structural children a SLOT_TEXT write would destroy, OR (ui-
// slider, batch C) has NO text slot at all (its track is ::before/::after — `textContent=` would inject stray
// text into the track, not a label). 3 of these (the COMPONENT_SAMPLE_CHILDREN keys ui-menu/ui-popover/
// ui-tooltip) additionally need a sample trigger just to CONSTRUCT; ui-icon builds a name-driven <svg>
// (setIcon(), icon.ts:38-41) whenever its `name` knob is non-empty — NOT the "builds zero children" case
// SLOT_TEXT_OK requires, and a `textContent =` write there would clobber that SVG the moment `name` is set (the
// exact defect class this partition exists to prevent); most of the rest now ALSO get real sample content
// (COMPONENT_SAMPLE_CHILDREN, batch B) so their specimen is representative, not merely non-throwing.
export const NO_SLOT_TEXT = new Set([
  'ui-badge', // connected() builds the glyph+label spans once (replaceChildren) — `label` is a PROP, not a slot at all (slots: [] — badge.md)
  'ui-bar-chart', // component-built rows (replaceChildren) — one role=listitem row per datum, never author-slotted (slots: [] — bar-chart.md)
  'ui-calendar', // #ensureShell() builds the whole nav+grid panel unconditionally
  'ui-color-picker', // #ensureShell() builds the whole pad+channels+readout tree unconditionally (ADR-0123); [slot=presets] is a named exception, not the default slot
  'ui-combo-box', // #ensureParts(): a control-created editor + listbox
  'ui-command-modal', // #ensureParts(): a control-created search/list/status + a nested ui-modal (ADR-0125)
  'ui-field', // #ensureParts(): the label/description/error chrome (3 parts)
  'ui-form-popover', // #ensureParts(): a CONTROL-CREATED trigger (label+caret) + panel — GH #294 F4, the ui-select/ui-popover precedent
  'ui-icon', // setIcon() injects a real <svg> child whenever `name` is non-empty (icon.ts:38-41) — a name-driven slot, not authored text
  'ui-image', // GH #1189: connected() PREPENDS a control-built <img data-part="media"> as a persistent, never-replaced child (image.ts) — a host-level `textContent =` write would wipe it (and any caption sibling) out entirely; the caption itself is real optional content (COMPONENT_SAMPLE_CHILDREN demonstrates it), just not a plain-string SLOT_TEXT knob's to own
  'ui-video', // GH #1209: connected() PREPENDS a control-built <video data-part="media" controls> as a persistent child (video.ts, the ui-image law) — no slotted content model at v1 (video.md slots: [])
  'ui-audio', // GH #1209: connected() PREPENDS a control-built <audio data-part="media" controls> (audio.ts) — no slotted content model at v1 (audio.md slots: [])
  'ui-menu', // #ensureParts(): trigger (COMPONENT_SAMPLE_CHILDREN) + panel
  'ui-modal', // #ensureDialog(): the control-owned <dialog> part
  'ui-drawer', // #ensureDialog(): the control-owned <dialog> part (ADR-0188, the modal precedent re-applied)
  'ui-drill', // #ensureParts(): the control-owned header/back/heading part (ADR-0195) — SLOT_TEXT would clobber it; the ui-drill-panel author children are its real sample content
  'ui-popover', // #ensureParts(): trigger (COMPONENT_SAMPLE_CHILDREN) + panel
  'ui-select', // #ensureParts(): a control-created trigger button + listbox
  'ui-slider', // ::before/::after track — no text KNOB (batch C); seeded an aria-label via COMPONENT_SAMPLE_ATTRS instead. (GH #1141's own value-readout PART legitimately carries text — see COMPONENT_SAMPLE_ATTRS comment above.)
  'ui-slider-multi', // JS-managed light-DOM rail/fill/thumb children (NOT ::before/::after, unlike ui-slider)
  'ui-sparkline', // component-built inline <svg> (createElementNS + replaceChildren) — the ui-icon precedent, a name/values-driven mark, not authored text (slots: [] — sparkline.md)
  'ui-line-chart', // ADR-0205: component-built label rows + inline <svg> (replaceChildren) — the ui-sparkline precedent, a values-driven mark, not authored text (slots: [] — line-chart.md)
  'ui-disclosure', // #ensureParts(): the details/summary/chevron chrome — host children are ADOPTED into a nested body PART, never left as direct host children (unlike a STRUCTURAL container), so a host-level SLOT_TEXT write would destroy the whole part tree
  'ui-stat', // connected() builds four spans once (replaceChildren) from label/value/delta/caption PROPS — no light-DOM content model at all (slots: [] — stat.md)
  'ui-description-list', // connected() builds row/label/value spans (replaceChildren) from the rows PROP — no light-DOM content model at all (slots: [] — description-list.md, ADR-0201)
  'ui-table', // connected() builds the scroll/table/thead/tbody skeleton — fully columns/rows-prop-driven, no light-DOM content model at all (slots: [] — table.md)
  'ui-tabs', // the control-created tablist strip PART
  'ui-text-field', // the contenteditable editor PART (×2 parts: editor + measurer)
  'ui-textarea', // ADR-0134: the SAME contenteditable editor PART pattern as ui-text-field (editor + message)
  'ui-otp-field', // code-entry-control.lld.md: the invisible editor PART + N cell PARTs, all control-created (slots: [] — otp-field.md) — a host-level SLOT_TEXT write would destroy the whole part tree
  'ui-tooltip', // #ensureParts(): anchor (COMPONENT_SAMPLE_CHILDREN) + panel
  // Feed family (ADR-0112): ui-progress/ui-avatar/ui-attachment build their own display parts once
  // (replaceChildren/append) from PROPS alone — no light-DOM content model at all (slots: [] on all three).
  // ui-toast #ensureParts() ADOPTS any host children present at connect into a nested message PART — the
  // ui-disclosure precedent exactly (a host-level SLOT_TEXT write would land in the wrong place and skip
  // the affordance cluster it also builds there).
  'ui-progress',
  'ui-avatar',
  'ui-attachment',
  'ui-toast', // COMPONENT_SAMPLE_CHILDREN below seeds its message text — must be present BEFORE connect (SPEC-R15 AC2)
  // Token-surface family (ADR-0118, token-surfaces.lld.md LLD-C9): all three build their entire visible
  // content imperatively from PROPS alone (swatch's box+value pair; ramp/ladder's replaceChildren cell/row
  // lists) — no light-DOM content model at all (slots: [] on all three, the ui-stat/ui-bar-chart precedent).
  'ui-swatch',
  'ui-ramp',
  'ui-ladder',
  // ui-timeline-item (ADR-0122): #ensureAnatomy() ADOPTS a `[data-role="detail"]` host child into a
  // composed `ui-disclosure` part (never left as a direct host child) — the ui-disclosure precedent exactly.
  'ui-timeline-item',
  // The ui-swiper family (ADR-0124): ui-swiper reparents ui-swiper-item children into a control-created
  // `[data-part=track]` PART — the ui-tabs tablist-strip precedent exactly. ui-swiper-pagination/-paddles
  // build their ENTIRE visible content imperatively (renderInto()/fill()) from the coordinator — no author
  // content model at all (slots: [] on both).
  'ui-swiper',
  'ui-swiper-pagination',
  'ui-swiper-paddles',
  // genui-surface.spec.md SPEC §3.2 (D9, B1): ui-sandbox-frame builds its ONE child (the iframe, or the
  // fallback affordance) entirely imperatively from props (html/csp) — no light-DOM content model at all
  // (slots: [] — sandbox-frame.md), the ui-stat/ui-swatch precedent exactly.
  'ui-sandbox-frame',
  // ADR-0163 cl.6 — ui-pagination builds its ENTIRE visible content imperatively (#rebuild(), replaceChildren)
  // from page/pages/label PROPS alone — no light-DOM content model at all (slots: [] — pagination.md), the
  // ui-stat/ui-swatch precedent exactly.
  'ui-pagination',
])

// STRUCTURAL (batch B) — the default slot IS the real content model (children ARE the grid cells / flex items /
// list rows / card regions / radio options / coordinated form fields), left as direct host children, never a
// text/label string. Growing a SLOT_TEXT knob here would overwrite the representative sample children with a
// bare string (`.textContent =` clears every child). These get real sample children instead
// (COMPONENT_SAMPLE_CHILDREN above) and no text knob.
// ui-toast-region (ADR-0112, LLD-C8) joins this set too: its `slots` is a real default slot ("zero or more
// ui-toast children, stacked in append order") — parts: [] on the host, nothing adopts/moves them — the
// exact STRUCTURAL shape, not ui-toast's own adopted-into-a-part one.
// ui-theme-provider (ADR-0117) joins this set too: its default slot IS "the themed subtree" (field.md/
// form-provider.md's own coordination-primitive posture) — real content, never a text/label string.
// ui-split / ui-split-pane (ADR-0120 cl.2, app-surfaces-m4.lld.md LLD-C1) join this set too: ui-split's
// default slot IS its N panes (real ui-split-pane children the control lays out via draggable separators);
// ui-split-pane's default slot IS the author's own arbitrary content — both the exact STRUCTURAL shape.
// ui-toolbar (ADR-0121) joins this set too: host-as-flex, light-DOM children ARE the roving items — the exact
// ui-row STRUCTURAL shape, not a text/label slot.
// ui-timeline / ui-status-stream (ADR-0122) join this set too: ui-timeline's default slot IS its authored
// `ui-timeline-item` chronology; ui-status-stream's is the SAME item children, normally created via its own
// appendEntry/update API but rendering identically when pre-authored — both the exact STRUCTURAL shape,
// never a text/label string (the ui-toast-region precedent).
// ui-swiper-item (ADR-0124) joins this set too: its default slot IS the slide's own arbitrary content, left
// as direct host children (sized entirely by the owning track) — the exact STRUCTURAL shape.
export const STRUCTURAL = new Set(['ui-card', 'ui-column', 'ui-form-provider', 'ui-grid', 'ui-list', 'ui-multi-select', 'ui-radio-group', 'ui-row', 'ui-segmented-control', 'ui-split', 'ui-split-pane', 'ui-swiper-item', 'ui-theme-provider', 'ui-timeline', 'ui-status-stream', 'ui-toast-region', 'ui-toolbar'])

// SLOT_TEXT_OK — SLOT_TEXT is a real, safe, MEANINGFUL knob: a genuine text/label default slot, the accessible
// label content a viewer edits to see the control's OWN typography/sizing respond (button/checkbox/radio/
// switch/text/code — ui-code's light-DOM children ARE its verbatim text content, textContent-only, host-as-
// content, the ui-text precedent exactly — code.md). Paired with NO_SLOT_TEXT + STRUCTURAL: the three sets
// PARTITION the whole fleet — the coverage test asserts this, so a new control lands in none of them by
// default and fails loud instead of silently inheriting a guess.
// ui-swiper-label (ADR-0124) joins this set too: its default slot IS a genuine text/label content — the
// author's text becomes the owning ui-swiper's accessible name.
// ui-toggle (ADR-0179 GH #686 Amendment S7-a) joins this set too: the same ui-button shape (optional
// icon/state-icon adornment slots + a genuine text/label default slot) — a bare component-mode specimen
// carries no adornment children (no COMPONENT_SAMPLE_CHILDREN entry here), so the SLOT_TEXT knob only ever
// edits the label, exactly as it does for ui-button.
export const SLOT_TEXT_OK = new Set(['ui-button', 'ui-checkbox', 'ui-code', 'ui-radio', 'ui-segment', 'ui-swiper-label', 'ui-switch', 'ui-text', 'ui-toggle'])

// ── the element ──────────────────────────────────────────────────────────────────────────────────────────────
type Mode = 'component' | 'a2ui'

class ComponentPreview extends HTMLElement {
  #built = false
  #mode: Mode = 'a2ui'
  #target = ''
  #knobs: Knob[] = []
  #state = new Map<string, string>() // knob name → raw string value ('' / 'true' / a member / free text)
  #refreshers: Array<() => void> = [] // per-knob DOM sync closures (keep each knob control in step with #state)
  #surface: HTMLElement | undefined
  #canvasCol: HTMLElement | undefined // the right column (holds the artboard) — toggles the empty-specimen hint
  #host: RendererHost | undefined // a2ui mode: the CURRENT renderer (disposed + rebuilt each change, N3)
  #liveEl: HTMLElement | undefined // component mode: the ONE element, diff-mutated in place

  connectedCallback(): void {
    if (this.#built) {
      // Reconnected (moved in the DOM): disconnect disposed the a2ui host, so rebuild its canvas from #state (the
      // left column + #state persist with the element; component mode keeps its live element and needs no rebuild).
      if (this.#mode === 'a2ui' && !this.#host && this.#surface) this.#buildA2ui()
      return
    }
    this.#built = true
    this.#mode = this.getAttribute('mode') === 'component' ? 'component' : 'a2ui'
    this.#target = this.getAttribute('target') ?? ''
    this.#build()
  }

  // Resolve metadata → seed knobs + state → build the two columns → first render. A missing/unknown target
  // renders a legible error row rather than a blank frame.
  #build(): void {
    const meta = this.#resolveMeta()
    if (!meta) {
      const err = document.createElement('div')
      err.className = 'preview-error'
      err.textContent = `Unknown ${this.#mode} target "${this.#target}".`
      this.append(err)
      return
    }
    this.#knobs = meta.knobs
    this.#seedState()

    const root = document.createElement('div')
    root.className = 'preview'
    const controls = document.createElement('div')
    controls.className = 'preview-controls'
    controls.append(this.#buildDetails(meta.kindLabel), this.#buildKnobs())

    const canvasCol = document.createElement('div')
    canvasCol.className = 'preview-canvas'
    canvasCol.setAttribute('role', 'figure') // a labelled region so the live artboard is a named landmark for AT
    canvasCol.setAttribute('aria-label', `${this.#target} live preview`)
    const { stage, surface } = createCanvasSurface()
    this.#surface = surface
    this.#canvasCol = canvasCol
    canvasCol.append(stage)

    root.append(controls, canvasCol)
    this.append(root)
    this.#render()
  }

  /** Resolve the target's knobs + a human kind label + (a2ui) its catalog def, or undefined when unknown. */
  #resolveMeta(): { knobs: Knob[]; kindLabel: string; def?: ComponentDef } | undefined {
    if (this.#mode === 'a2ui') {
      const def = defaultCatalog.components[this.#target]
      if (!def) return undefined
      const child = def.children ? ` · children: ${def.children}` : ''
      return { knobs: a2uiKnobs(def), kindLabel: `A2UI catalog component${child}`, def }
    }
    const doc = loadDescriptorByTag(this.#target)
    if (!doc) return undefined
    const tier = doc.descriptor.scalars.get('tier')
    return {
      knobs: componentKnobs(doc.descriptor.attributes, this.#target),
      kindLabel: `ui-* control${tier ? ` · tier: ${tier}` : ''}`,
    }
  }

  /** Seed #state with each knob's starting value: descriptor defaults (component) or the A2UI_INITIAL seed (a2ui). */
  #seedState(): void {
    if (this.#mode === 'a2ui') {
      for (const [name, value] of Object.entries(A2UI_INITIAL[this.#target] ?? {})) this.#state.set(name, value)
      return
    }
    const doc = loadDescriptorByTag(this.#target)
    for (const attr of doc?.descriptor.attributes ?? []) {
      if (typeof attr.name !== 'string') continue
      const d = attr.default
      if (typeof d === 'string' && d !== '' && d !== 'null') this.#state.set(attr.name, d)
    }
    for (const [name, value] of Object.entries(COMPONENT_INITIAL[this.#target] ?? {})) this.#state.set(name, value)
    if (SLOT_TEXT_OK.has(this.#target)) this.#state.set(SLOT_TEXT, slotTextDefault(this.#target))
  }

  // ── left column builders ───────────────────────────────────────────────────────────────────────────────────
  #buildDetails(kindLabel: string): HTMLElement {
    const details = document.createElement('div')
    details.className = 'preview-details'
    const name = document.createElement('p')
    name.className = 'preview-name'
    name.textContent = this.#target
    const kind = document.createElement('span')
    kind.className = 'preview-kind'
    kind.textContent = kindLabel
    details.append(name, kind)
    return details
  }

  #buildKnobs(): HTMLElement {
    const section = document.createElement('div')
    const label = document.createElement('p')
    label.className = 'preview-section-label'
    label.textContent = 'Props'
    const list = document.createElement('div')
    list.className = 'preview-knobs'
    // The rail's compact register comes from the CONTAINER, not per-control classes: ADR-0038's subtree
    // scale attribute re-tables the md ramp every raw knob control reads to today's sm row (GH #1407,
    // superseding the `.knob-select/.knob-input/.knob-switch` token-repoint classes).
    list.setAttribute('scale', 'ui-sm')
    for (const knob of this.#knobs) list.append(this.#buildKnob(knob))
    section.append(label, list)
    return section
  }

  /** One knob row: a labelled control whose change writes #state and re-renders (skip knobs are read-only notes). */
  #buildKnob(knob: Knob): HTMLElement {
    const row = document.createElement('div')
    row.className = 'knob'
    const id = nextKnobId()
    const label = document.createElement('label')
    label.className = 'knob-label'
    label.textContent = knob.name === SLOT_TEXT ? 'text' : knob.name
    label.htmlFor = id // pair the label with its control so the knob carries an accessible name
    row.append(label)

    if (knob.kind === 'skip') {
      const note = document.createElement('span')
      note.className = 'knob-note'
      note.textContent = knob.note ?? 'read-only'
      row.append(note)
      return row
    }

    if (knob.kind === 'enum') {
      const members = knob.values ?? []
      if (fitsSegmented(members)) {
        // Dogfoods ui-segmented-control (Kim's routing rule — small closed enum, every option visible at
        // once; ADR-0095's standalone tag, superseding the retired ui-radio-group[variant="segmented"]).
        // Real API (segmented-control.md / segment.md): a `ui-segment` child per member (`.value` + its
        // label text), the CONTROL's own `change` event is the commit signal (NOT the individual segment's
        // — that one bubbles through the control and is consumed/re-emitted; see the target filter below),
        // `.checked` is the read/write property. UNLIKE ui-select's KNOB_UNSET "—", a segmented control
        // always has a selection (its own contract has no "none" state) — pre-select the seeded/current
        // value, falling back to the FIRST member when nothing is seeded yet (a2ui mode's catalog carries
        // no per-prop defaults).
        const group = document.createElement('ui-segmented-control') as UISegmentedControlElement
        group.id = id
        group.setAttribute('aria-label', knob.name)
        // de-doubling closing step: a fitting enum knob renders as a real segmented control (the sliding
        // indicator + roving come from the control itself — nothing here reimplements it). Horizontal is
        // the control's own default; fitsSegmented() already guaranteed the row fits, so no orientation
        // attribute is ever set (the vertical stack is retired — an unfit set is a ui-select, below).
        // The fallback pre-selection must be a REAL #state seed, not merely a visual default: #rootProps() /
        // #applyKnob() read #state, not "whatever the segmented control widget happens to show" — an
        // unseeded knob would render 'sm' checked in the UI while the specimen itself carried no `size` at
        // all (and a click on the ALREADY-checked 'sm' segment is then a no-op — segments can only be
        // REPLACED, never toggled off — so the desync would never self-correct). Seeding here, once, keeps
        // the widget and the specimen in sync.
        if (!this.#state.has(knob.name)) this.#state.set(knob.name, members[0])
        const segments: UISegmentElement[] = []
        for (const member of members) {
          const segment = document.createElement('ui-segment') as UISegmentElement
          segment.value = member
          segment.textContent = member
          segments.push(segment)
          group.append(segment)
        }
        const syncChecked = (): void => {
          const current = this.#state.get(knob.name) || members[0]
          for (const segment of segments) segment.checked = segment.value === current
        }
        syncChecked()
        group.addEventListener('change', (event) => {
          // Only the control's OWN re-emitted commit event (target === group) carries the SETTLED
          // selection — the individual segment's raw bubbled `change` (target === the segment) fires on
          // this same node too (event listeners on an ancestor see the bubble phase), but at that instant
          // the control has not yet enforced exclusivity (#commit runs inside its own listener, registered
          // separately), so reading `.checked` there can still see the PREVIOUS selection. Filtering to the
          // target skips that transient read and reacts to the one authoritative event
          // segmented-control.md documents.
          if (event.target !== group) return
          const checked = segments.find((s) => s.checked)
          if (checked) this.#setKnob(knob.name, checked.value)
        })
        this.#refreshers.push(syncChecked)
        row.append(group)
        return row
      }

      // Dogfoods ui-select in place of a native <select> (Kim's directive) for a larger enum. Options are
      // [role=option] light-DOM children appended BEFORE connection — ui-select moves them into its listbox at
      // first connect (select.md `slots`). The `label` prop names the trigger (ADR-0085); the visible <label
      // for> above adds click-to-focus. The `select` event (NOT `change`) is the commit signal; `.value` is
      // the read/write property (the gallery themeSelect() precedent).
      const select = document.createElement('ui-select') as UISelectElement
      select.id = id
      // Narrow-column width floor — the per-field override the control EXPOSES (select.css), an inline
      // token repoint (GH #1407: no page-authored component-styling class). Sizing rides `.preview-knobs`'
      // scale="ui-sm".
      select.style.setProperty('--ui-select-min-inline-size', '6ch')
      select.setAttribute('label', knob.name)
      select.setAttribute('placeholder', '—') // the unset display → the control's own default
      // The unset choice — a non-empty sentinel value (an empty-value option is inert; see KNOB_UNSET).
      const unset = document.createElement('div')
      unset.setAttribute('role', 'option')
      unset.setAttribute('value', KNOB_UNSET)
      unset.textContent = '—'
      select.append(unset)
      for (const member of knob.values ?? []) {
        const option = document.createElement('div')
        option.setAttribute('role', 'option')
        option.setAttribute('value', member)
        option.textContent = member
        select.append(option)
      }
      select.value = this.#state.get(knob.name) ?? ''
      select.addEventListener('select', () => {
        const v = select.value
        this.#setKnob(knob.name, v === KNOB_UNSET ? '' : v)
      })
      this.#refreshers.push(() => {
        select.value = this.#state.get(knob.name) ?? ''
      })
      row.append(select)
      return row
    }

    if (knob.kind === 'boolean') {
      // Dogfoods ui-switch in place of a native <input type=checkbox> (Kim's directive — an instant on/off
      // toggle reads better as a switch than a checkbox for a live knob; same UIIndicatorElement API as
      // ui-checkbox, so this is a drop-in swap). `checked` + the `change` event are the wire; `aria-label`
      // names the bare box (switch.md labelSource) and the visible <label for> above adds click-to-focus.
      const toggle = document.createElement('ui-switch') as UISwitchElement
      toggle.id = id
      toggle.setAttribute('aria-label', knob.name)
      toggle.checked = this.#state.get(knob.name) === 'true'
      toggle.addEventListener('change', () => this.#setKnob(knob.name, toggle.checked ? 'true' : 'false'))
      this.#refreshers.push(() => {
        toggle.checked = this.#state.get(knob.name) === 'true'
      })
      row.append(toggle)
      return row
    }

    // Number/text knob → ui-text-field (Kim's directive): type=number for a numeric prop, type=text
    // otherwise. `value` + the `input` event are the wire; the input-time value is the RAW typed string
    // (the numeric codec only reformats on blur/change — which the knob never listens to). `label` gives the
    // editor its aria-label; the visible <label for> above adds click-to-focus.
    const field = document.createElement('ui-text-field') as UITextFieldElement
    field.id = id
    // Narrow-column typing-width floor — the per-field override the control EXPOSES (text-field.css),
    // an inline token repoint (GH #1407). Sizing rides `.preview-knobs`' scale="ui-sm".
    field.style.setProperty('--ui-text-field-min-inline-size', '8ch')
    field.setAttribute('type', knob.kind === 'number' ? 'number' : 'text')
    field.setAttribute('label', knob.name === SLOT_TEXT ? 'text' : knob.name)
    field.value = this.#state.get(knob.name) ?? ''
    field.addEventListener('input', () => this.#setKnob(knob.name, field.value))
    this.#refreshers.push(() => {
      field.value = this.#state.get(knob.name) ?? ''
    })
    row.append(field)
    return row
  }

  // ── state + render ─────────────────────────────────────────────────────────────────────────────────────────
  // The rendered specimen stays INTERACTIVE, and a knob edit never reverts what the user did in the canvas. The
  // specimen is authoritative for its OWN live state (a typed value, a toggled control, a dismissed modal); #state
  // is the seed + the knob-driven props. Component mode applies only the ONE changed prop (a diff, not a blind
  // full resync) and reads live interaction back into the knobs; a2ui mode reads the live value back into #state
  // before it rebuilds. Both skip the just-changed knob — the user's explicit edit wins over the live value.

  /** A knob edit: write #state, then re-apply — component mode diffs ONE prop; a2ui reads back live state + rebuilds. */
  #setKnob(name: string, value: string): void {
    this.#state.set(name, value)
    if (this.#mode === 'a2ui') this.#rerenderA2ui(name)
    else this.#applyKnobToLive(name)
    this.#refreshers.forEach((r) => r())
  }

  /** First paint: full build of the specimen from the seeded #state. */
  #render(): void {
    if (!this.#surface) return
    this.#refreshers.forEach((r) => r()) // reflect the seeded state in the knob controls
    if (this.#mode === 'a2ui') this.#buildA2ui()
    else this.#buildComponent()
  }

  // ── a2ui mode ──────────────────────────────────────────────────────────────────────────────────────────────
  /** A knob change: read the live value back into #state (so it survives), then dispose+rebuild from #state. */
  #rerenderA2ui(changed: string): void {
    this.#readBackA2ui(changed)
    this.#buildA2ui()
  }

  // Rebuild the surface through a FRESH renderer (teardown-safe, N3). The mount-once tree cannot patch a STATIC
  // literal prop in place (only data-model-BOUND props update reactively — tree.ts), so a knob edit to a static
  // prop like `size`/`variant` genuinely needs a rebuild; `#readBackA2ui` first preserves the live interactive state.
  #buildA2ui(): void {
    const surface = this.#surface as HTMLElement
    this.#host?.dispose()
    surface.replaceChildren()
    this.#host = createRenderer()
    this.#host.mount(surface)
    for (const line of this.#a2uiPayload()) this.#host.ingest(line)
    this.#host.finalize('preview')
    this.#armLiveDirty(surface)
    applyRootStretch(surface)
    this.#updateEmptyHint()
  }

  /**
   * The user-interaction tripwire behind #readBackA2ui (2026-08-18 sweep finding, rubric
   * a2ui-catalog-example.md C2): a value slot is preserved across rebuilds ONLY once the user has actually
   * committed a value on the CANVAS — each slot's own commit event, fired from the rendered root. Without
   * this mark, every knob edit re-read the control's DEFAULT (or min/max-clamped) live value into #state as
   * if the user had set it: editing a Slider's `min` knob resurrected a value the user never chose (the
   * clamp laundered `0` into `min`, readBack baked it into state, and the spurious `value` stuck forever),
   * and Pagination's own `page` default got baked in the same way. Listeners re-arm on every rebuild (the
   * root is recreated); the dirty marks themselves persist — they are state about the USER, not the DOM.
   */
  #liveDirty = new Set<string>()
  #armLiveDirty(surface: HTMLElement): void {
    const def = defaultCatalog.components[this.#target]
    if (!def?.value) return
    const root = surface.firstElementChild
    if (!root) return
    for (const slot of valueSlots(def.value)) {
      root.addEventListener(slot.event, () => this.#liveDirty.add(slot.prop))
    }
  }

  /**
   * Read the rendered root's live two-way-bindable value(s) — the catalog `value` mark, one-or-more slots
   * per ADR-0161 (a typed field, a toggled control, a dismissed modal's `open`, or a multi-slot commit like
   * Calendar's range pair) — back into #state, so the imminent rebuild PRESERVES them rather than reverting
   * to the seed. Two guards decide WHICH slots are read: `changed` is skipped (the knob the user just set is
   * their explicit intent and must win — and that same explicit intent CLEARS the slot's dirty mark, so a
   * knob-reverted value stays reverted), and an untouched slot is skipped entirely (#armLiveDirty above —
   * only a value the user actually committed on the canvas is the user's to keep; a control's own default or
   * clamp is not). Residual limitation (documented): a rebuild recreates the root, so caret position /
   * transient focus reset — the VALUE survives, the cursor does not; and a container root's non-knob sample
   * children reset on its own edit.
   */
  #readBackA2ui(changed: string): void {
    const def = defaultCatalog.components[this.#target]
    if (!def?.value) return
    this.#liveDirty.delete(changed) // the knob IS the user's intent for this slot from here on
    const root = (this.#surface as HTMLElement).firstElementChild as HTMLElement | null
    if (!root) return
    for (const slot of valueSlots(def.value)) {
      if (slot.prop === changed) continue
      if (!this.#liveDirty.has(slot.prop)) continue
      const mapsTo = def.properties[slot.prop]?.mapsTo ?? slot.prop
      liveToState(this.#state, slot.prop, (root as unknown as Record<string, unknown>)[mapsTo])
    }
  }

  /** The two JSONL lines: createSurface, then updateComponents with the knob-driven root + its sample children. */
  #a2uiPayload(): [string, string] {
    const def = defaultCatalog.components[this.#target]
    const sample = sampleFor(this.#target, def)
    const root: Record<string, unknown> = { id: 'root', component: this.#target, ...this.#rootProps(), ...sample.rootRef }
    const createSurface = { version: 'v1.0', createSurface: { surfaceId: 'preview', catalogId: 'agent-ui' } }
    const updateComponents = { version: 'v1.0', updateComponents: { surfaceId: 'preview', components: [root, ...sample.extras] } }
    return [JSON.stringify(createSurface), JSON.stringify(updateComponents)]
  }

  /** The root's own props from #state, typed per knob kind (boolean → real boolean, number → real number). */
  #rootProps(): Record<string, unknown> {
    const props: Record<string, unknown> = {}
    for (const knob of this.#knobs) {
      if (knob.kind === 'skip' || knob.kind === 'text') continue
      const raw = this.#state.get(knob.name)
      if (raw === undefined || raw === '') continue
      if (knob.kind === 'boolean') props[knob.name] = raw === 'true'
      else if (knob.kind === 'number') {
        const n = Number(raw)
        if (Number.isFinite(n)) props[knob.name] = n
      } else props[knob.name] = raw
    }
    return props
  }

  // ── component mode ─────────────────────────────────────────────────────────────────────────────────────────
  // Create the element ONCE and mutate it in place. First paint applies every knob; a later knob edit applies ONLY
  // that one prop (a diff), so an unrelated edit never touches a value the user changed live. Read-back listeners
  // reflect direct interaction (toggle/type/select) into the matching knob, keeping #state ≡ the live control.
  #buildComponent(): void {
    const surface = this.#surface as HTMLElement
    const el = document.createElement(this.#target)
    const sample = COMPONENT_SAMPLE_CHILDREN[this.#target]
    if (sample) el.append(...sample())
    for (const [attr, value] of Object.entries(COMPONENT_SAMPLE_ATTRS[this.#target] ?? {})) el.setAttribute(attr, value)
    this.#liveEl = el
    surface.replaceChildren(el)
    COMPONENT_SAMPLE_INIT[this.#target]?.(el)
    for (const knob of this.#knobs) this.#applyKnob(el, knob) // no SLOT_TEXT knob at all for a NO_SLOT_TEXT/STRUCTURAL target (above)
    for (const evt of ['change', 'input', 'toggle', 'select']) el.addEventListener(evt, () => this.#readBackComponent())
    applyRootStretch(surface)
    this.#updateEmptyHint()
  }

  /** Apply ONLY the one changed knob to the live element (a diff — never a blind full resync that reverts live state). */
  #applyKnobToLive(name: string): void {
    const el = this.#liveEl
    if (!el) return
    const knob = this.#knobs.find((k) => k.name === name)
    if (knob) this.#applyKnob(el, knob)
    this.#updateEmptyHint()
  }

  /** Apply one knob to the live element: slot-text → textContent · boolean → attribute presence · else → attribute value. */
  #applyKnob(el: HTMLElement, knob: Knob): void {
    const raw = this.#state.get(knob.name)
    if (knob.name === SLOT_TEXT) {
      // componentKnobs() no longer GROWS a SLOT_TEXT knob at all for a NO_SLOT_TEXT or STRUCTURAL target, so
      // this branch is unreachable for either in normal operation — kept as defense-in-depth (a stale #knobs
      // entry from a future caching bug would still no-op here rather than wipe the control's own structural
      // children / STRUCTURAL sample content).
      if (NO_SLOT_TEXT.has(this.#target) || STRUCTURAL.has(this.#target)) return
      el.textContent = raw ?? ''
      return
    }
    if (knob.kind === 'skip') return
    if (knob.kind === 'boolean') {
      if (raw === 'true') el.setAttribute(knob.name, '')
      else el.removeAttribute(knob.name)
      return
    }
    if (raw === undefined || raw === '') el.removeAttribute(knob.name)
    else el.setAttribute(knob.name, raw)
  }

  /** Canvas→knob: read every knob's live property off the specimen back into #state, then reflect it in the knobs. */
  #readBackComponent(): void {
    const el = this.#liveEl
    if (!el) return
    for (const knob of this.#knobs) {
      if (knob.kind === 'skip' || knob.name === SLOT_TEXT) continue
      liveToState(this.#state, knob.name, (el as unknown as Record<string, unknown>)[knob.name])
    }
    this.#refreshers.forEach((r) => r())
  }

  // ── empty-state affordance ─────────────────────────────────────────────────────────────────────────────────
  /**
   * Flag the canvas when the specimen renders nothing visible — a closed native-`<dialog>` Modal is `display:none`
   * and IS a surface child, so `.canvas-surface:empty` never fires and the artboard would read as blank. Measured
   * after a frame (`getClientRects().length === 0` ⇒ nothing laid out); the CSS then shows a "toggle a knob" hint.
   */
  #updateEmptyHint(): void {
    const col = this.#canvasCol
    if (!col) return
    requestAnimationFrame(() => {
      // GH catalog-page regression (found 2026-08-18 by a2ui-catalog-rendering-review's List card review):
      // on a tabbed page every non-active tier's cards build inside a hidden ui-tab-panel, so EVERYTHING
      // measured zero rects and 41/60 cards wore the "Nothing visible…" overlay on top of fully rendered
      // specimens. A hidden CANVAS is unmeasurable, not empty — leave it unflagged and re-measure once the
      // canvas actually gets laid out (the reveal observer below fires on the display:none → laid-out flip).
      if (col.getClientRects().length === 0) {
        col.classList.remove('is-empty-specimen')
        this.#observeReveal(col)
        return
      }
      const root = (this.#surface as HTMLElement | undefined)?.firstElementChild as HTMLElement | null
      // A closed overlay's ROOT is 0-height while its trigger child is absolutely positioned and fully
      // visible (FormPopover/Menu/Popover/Tooltip) — the 2026-08-18 review sweep found the hint text
      // z-fighting those triggers. "Visible" therefore means the root OR any descendant lays out.
      const visible =
        !!root && (root.getClientRects().length > 0 || [...root.querySelectorAll('*')].some((el) => el.getClientRects().length > 0))
      col.classList.toggle('is-empty-specimen', !visible)
    })
  }

  /** One-shot reveal watcher: when a hidden canvas gains a box (its tab is selected), re-run the empty hint. */
  #revealObserver: ResizeObserver | undefined
  #observeReveal(col: HTMLElement): void {
    if (this.#revealObserver || typeof ResizeObserver === 'undefined') return
    this.#revealObserver = new ResizeObserver(() => {
      if (col.getClientRects().length === 0) return
      this.#revealObserver?.disconnect()
      this.#revealObserver = undefined
      this.#updateEmptyHint()
    })
    this.#revealObserver.observe(col)
  }

  disconnectedCallback(): void {
    this.#host?.dispose()
    this.#host = undefined
    this.#revealObserver?.disconnect()
    this.#revealObserver = undefined
  }
}

if (!customElements.get('component-preview')) customElements.define('component-preview', ComponentPreview)
