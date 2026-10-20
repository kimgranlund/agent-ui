// option-deck-model.ts: the pure, DOM-free hardening for ui-option-deck (T-0193, the OptionDeck fork sheet in
// .sdlc/tickets/.0193-option-deck/handoff.md). No DOM, no host, unit-testable in plain Node (the
// result-card-model.ts in-folder split). Owns:
//
//   1. `cleanOptions`: a non-array is `[]`; a non-object entry is dropped; an entry without a non-empty `value`
//      or `title` is dropped; `meta` keeps at most `MAX_META` non-empty strings; `tone` out of set is dropped
//      (the card paints neutral); the optional corner `index` is kept as a trimmed string (a finite number
//      prints as its digits). The key `"random"` is reserved for the Surprise me card, so an option that
//      claims it is dropped.
//   2. `toneOf`: the tone set, each mapped in option-deck.css to its `--md-sys-color-{tone}-container` role.
//   3. `optionsProp`: the safe JSON codec. A removed attribute or malformed JSON falls back to `[]` and never
//      throws into attributeChangedCallback. A property write bypasses the codec, so option-deck.ts re-cleans
//      every value on the render path.

import type { PropConfig, PropType } from '../../dom/props.ts'

/** The most meta chips a card renders; extra entries are dropped. */
export const MAX_META = 3

/** The key the Surprise me card commits; no authored option may claim it. */
export const RANDOM_KEY = 'random'

export const TONES = ['neutral', 'primary', 'secondary', 'accent', 'info', 'success'] as const
export type Tone = (typeof TONES)[number]

/** One option as an author or agent writes it. Every field may arrive malformed; the cleaner judges it. */
export interface OptionDeckOption {
  value?: unknown
  title?: unknown
  description?: unknown
  icon?: unknown
  image?: unknown
  imageAlt?: unknown
  meta?: unknown
  tone?: unknown
  index?: unknown
}

/** One option after hardening: display-ready strings, with the optional parts present only when real. */
export interface CleanOption {
  value: string
  title: string
  description?: string
  icon?: string
  image?: string
  imageAlt?: string
  meta: string[]
  tone: Tone
  index?: string
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** A trimmed non-empty string, a finite number as its digits, anything else `undefined`. */
function text(raw: unknown): string | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw)
  if (typeof raw !== 'string') return undefined
  const t = raw.trim()
  return t === '' ? undefined : t
}

/** The tone, with anything out of set read as `neutral`. */
export function toneOf(raw: unknown): Tone {
  return typeof raw === 'string' && (TONES as readonly string[]).includes(raw) ? (raw as Tone) : 'neutral'
}

/** Harden an arbitrary input into display-ready options, in order. */
export function cleanOptions(input: unknown): CleanOption[] {
  if (!Array.isArray(input)) return []
  const out: CleanOption[] = []
  for (const entry of input) {
    if (!isPlainObject(entry)) continue
    const value = text(entry.value)
    const title = text(entry.title)
    if (value === undefined || title === undefined || value === RANDOM_KEY) continue
    const meta = Array.isArray(entry.meta)
      ? entry.meta.map(text).filter((m): m is string => m !== undefined).slice(0, MAX_META)
      : []
    const option: CleanOption = { value, title, meta, tone: toneOf(entry.tone) }
    const description = text(entry.description)
    if (description !== undefined) option.description = description
    const icon = text(entry.icon)
    if (icon !== undefined) option.icon = icon
    const image = text(entry.image)
    if (image !== undefined) option.image = image
    const imageAlt = text(entry.imageAlt)
    if (imageAlt !== undefined) option.imageAlt = imageAlt
    const index = text(entry.index)
    if (index !== undefined) option.index = index
    out.push(option)
  }
  return out
}

const optionsType: PropType<OptionDeckOption[]> = {
  from(attr) {
    if (attr === null) return []
    try {
      return cleanOptions(JSON.parse(attr))
    } catch {
      return []
    }
  },
  to(value) {
    return JSON.stringify(value)
  },
}

export const optionsProp: PropConfig<OptionDeckOption[]> = {
  type: optionsType,
  default: [],
}
