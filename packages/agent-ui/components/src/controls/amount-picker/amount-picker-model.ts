// amount-picker-model.ts: the pure parts of ui-amount-picker (T-0196 Design), kept out of amount-picker.ts so the
// generated props module can import the presets codec without a cycle.
//
//   1. `presetsProp`: the safe JSON codec. A removed attribute or malformed JSON falls back to `[]` and never throws
//      into attributeChangedCallback; non-finite entries are dropped, the rest sorted and deduped.
//   2. `cleanPresets`: the same cleaning plus the bounds, run on the render path, because a property write bypasses
//      the codec and the bounds can change after the presets were written.
//   3. `amountFormatter`: the one formatter the readout, aria-valuetext and the chip labels share, built only from
//      the traits/value-codec.ts helpers (T-0196 Design, Formatting codec).
//
// Layer: controls/, imports dom types and traits only.

import type { PropConfig, PropType } from '../../dom/props.ts'
import { currencyCodecOptions, currencySymbol, numberCodecOptions, unitCodecOptions, unitLabel } from '../../traits/value-codec.ts'

/** Finite numbers only, sorted ascending, each once. Anything that is not an array is `[]`. */
function finiteSorted(raw: unknown): number[] {
  if (!Array.isArray(raw)) return []
  const out = new Set<number>()
  for (const entry of raw) if (typeof entry === 'number' && Number.isFinite(entry)) out.add(entry)
  return [...out].sort((a, b) => a - b)
}

/** The presets the picker draws: finite, inside [min, max], sorted and deduped. */
export function cleanPresets(raw: unknown, min: number, max: number): number[] {
  return finiteSorted(raw).filter((n) => n >= min && n <= max)
}

const presetsType: PropType<number[]> = {
  from(attr) {
    if (attr === null) return []
    try {
      return finiteSorted(JSON.parse(attr))
    } catch {
      return []
    }
  },
  to(value) {
    return JSON.stringify(value)
  },
}

export const presetsProp: PropConfig<number[]> = {
  type: presetsType,
  default: [],
}

/** The number to display string: currency wins, then unit, then a plain grouped number (runtime locale). */
export function amountFormatter(currency: string, unit: string): (value: number) => string {
  if (currency !== '') {
    const codec = currencyCodecOptions(currency)
    const symbol = currencySymbol(currency)
    return (value) => (value < 0 ? `-${symbol}${codec.format(String(-value))}` : `${symbol}${codec.format(String(value))}`)
  }
  if (unit !== '') {
    const codec = unitCodecOptions(unit)
    const label = unitLabel(unit)
    return (value) => `${codec.format(String(value))} ${label}`
  }
  const codec = numberCodecOptions()
  return (value) => codec.format(String(value))
}
