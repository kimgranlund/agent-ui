// prompt-lint.ts — GH #419 (the regression guard GH #412's revision recipe asked for, item 3): a small,
// NON-BLOCKING check that an ENABLED prompt section does not name a modality the admin has switched OFF.
//
// WHY it exists: persona prose is supposed to state INTENT ("one persistent surface, updated in place"),
// never DIALECT ("a Card holding a rank+suit Text") — dialect belongs to the harness's own grammar block,
// which composes per modality (ADR-0138's boundary; GH #412 rewrote all fourteen shipped `surfaceStyle`
// texts to honor it). Nothing STOPS a future persona — imported, or hand-authored right here — from
// reintroducing dialect, and the failure it causes is invisible at authoring time: the composed prompt
// simply contradicts itself, and the turn degrades by model luck. This warns, in place, at the moment the
// two disagree. It never blocks: composition and turns run byte-identically whether a warning shows or not.
//
// WHY IT IS A WORD LIST, not analysis: the alternative (GH #412's option 2, composition-time rewriting)
// was REJECTED for exactly the reason that matters here — pattern-matching authored prose is fragile. So
// this errs the only safe way: a FALSE NEGATIVE (dialect that slips through) costs nothing but a missed
// hint, while a FALSE POSITIVE cries wolf on correct prose and teaches the admin to ignore the warning.
// Every term below is therefore one that essentially cannot occur in ordinary English:
//   • the modality NAMES themselves (`A2UI`, `GenUI`) — word-bounded, so "genuine"/"ingenuity" never match;
//   • the WIRE vocabulary (protocol.ts's own envelope/prop keys + the `action:{` payload shape #412's
//     Admiral case baked into prose);
//   • only the COMPOUND catalog type names (`TextField`, `BarChart`, …) — every single-word type the
//     catalog ships (Card · Row · Text · List · Select · Progress · Stat · Grid · Table · Swatch · Ramp …)
//     is also a plain English word a persona may legitimately use, so NONE of them is a term here.

import type { Entry } from '../entry-list/entry-data.ts'

/** One modality's vocabulary: the Surface Option it belongs to, the label a warning names, and the terms
 *  that betray it in authored prose. */
export interface ModalityVocabulary {
  /** The `data-surface` id of the row this vocabulary belongs to. */
  surface: 'a2ui' | 'genui'
  /** How the warning names the modality. */
  label: string
  terms: readonly string[]
}

/** The COMPOUND catalog type names — every `defaultCatalog.components` key made of two glued capitalized
 *  words (verified against `a2ui/src/catalog/default/catalog.json`, 2026-08-04). Listed literally rather
 *  than imported: this is a lint word list, deliberately frozen and reviewable, not a live mirror of the
 *  catalog — and `app` has no business pulling a2ui's catalog into a settings pane at runtime. */
const COMPOUND_CATALOG_TYPES: readonly string[] = [
  'BarChart',
  'CardContent',
  'CardFooter',
  'CardHeader',
  'ColorPicker',
  'ComboBox',
  'FormPopover',
  'FormProvider',
  'MenuItem',
  'RadioGroup',
  'SegmentedControl',
  'SliderMulti',
  'SplitPane',
  'SwiperItem',
  'TabPanel',
  'TextField',
  'TimelineItem',
]

/** The A2UI wire vocabulary — `protocol.ts`'s real envelope keys + component/action props, plus the two
 *  literal payload shapes persona prose has actually carried (`action:{…}` / `context:{…}`, GH #412's
 *  Admiral inventory). Naming any of these is naming the wire, which is the harness's job, never a
 *  persona's. */
const A2UI_WIRE_TERMS: readonly string[] = [
  'A2UI',
  'JSONL',
  'createSurface',
  'updateComponents',
  'updateDataModel',
  'deleteSurface',
  'actionResponse',
  'callFunction',
  'surfaceId',
  'catalogId',
  'action:{',
  'context:{',
]

export const MODALITY_VOCABULARY: readonly ModalityVocabulary[] = [
  { surface: 'a2ui', label: 'A2UI', terms: [...A2UI_WIRE_TERMS, ...COMPOUND_CATALOG_TYPES] },
  // GenUI's own vocabulary is just its name: the modality teaches free-form HTML, so it has no catalog
  // type names or wire keys of its own for prose to leak.
  { surface: 'genui', label: 'GenUI', terms: ['GenUI'] },
]

/** Which modalities are currently ON — the caller's own fail-closed store reads (`isEnabledFlag` /
 *  `isGenuiSurfaceEnabled`), never re-derived here. */
export interface ModalityStates {
  a2ui: boolean
  genui: boolean
}

const WORD_TERM = /^[A-Za-z0-9]+$/

/** Does `text` NAME `term`? An all-alphanumeric term matches case-insensitively but only on WORD
 *  boundaries (so `genui` never fires inside "genuine"); a term carrying punctuation (`action:{`) is a
 *  plain substring — a word boundary is meaningless around a brace. */
function names(text: string, term: string): boolean {
  if (!WORD_TERM.test(term)) return text.includes(term)
  return new RegExp(`\\b${term}\\b`, 'i').test(text)
}

/** The first term of `vocabulary` that `text` names, or `undefined` when it names none. */
function firstNamed(text: string, vocabulary: ModalityVocabulary): string | undefined {
  return vocabulary.terms.find((term) => names(text, term))
}

/**
 * The warning for ONE section's content, or `undefined` when it is clean. A section that names a modality
 * which is ON is clean by definition — the text and the toggle agree, which is the whole point.
 */
export function lintSectionContent(content: string, modalities: ModalityStates): string | undefined {
  const named = MODALITY_VOCABULARY.filter((vocabulary) => !modalities[vocabulary.surface])
    .map((vocabulary) => ({ vocabulary, term: firstNamed(content, vocabulary) }))
    .filter((hit): hit is { vocabulary: ModalityVocabulary; term: string } => hit.term !== undefined)
  if (named.length === 0) return undefined
  const parts = named.map((hit) => `“${hit.term}” (${hit.vocabulary.label} is off)`).join(' and ')
  return `This section names ${parts} — turn that surface on, or reword the section.`
}

/**
 * Lint one kind's entry list against the current modality states: `entryId → warning`, carrying an entry
 * ONLY when it is ENABLED and names a disabled modality. A DISABLED section composes nothing, so it can
 * never contradict a toggle — warning about it would be the false-positive class this lint exists to avoid.
 */
export function lintPromptSections(sections: readonly Entry[], modalities: ModalityStates): Map<string, string> {
  const warnings = new Map<string, string>()
  for (const section of sections) {
    if (!section.enabled) continue
    const warning = lintSectionContent(section.content, modalities)
    if (warning !== undefined) warnings.set(section.id, warning)
  }
  return warnings
}
