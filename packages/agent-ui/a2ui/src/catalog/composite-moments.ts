// composite-moments.ts: "use composite X for moment Y" as data-driven semantic checks (T-0208).
//
// Each row of `COMPOSITE_MOMENTS` names a registered composite, one of its `selection.json` intents (the moment),
// and a narrow structural detector for a surface that hand-builds that moment without it (CA-R9 lever 3). One
// generator turns every row into a `SemanticCheck` (ADR-0238) whose finding sends the model back to make the
// surface ONE composite. The check `requires` the composite (and any type it reads), so `gateChecksOnCatalog`
// keeps a row on exactly the catalogs that can emit it: the booking rows ride `<base>--concierge`, the games rows
// ride `agent-ui` until the games types move to a domain, and `a2ui-basic` gets none.
//
// The link to the sidecar is a test, not an import (`composite-moments.test.ts`: every `moment` is one of its
// composite's intents): the module imports no JSON, so plain Node (`scripts/e2e-admin/probe/trace.ts`) and both
// server hosts can import it, and `selection-guidance.ts` keeps its closed `{intents, notFor}` row shape.

import type { A2uiComponent } from '../protocol.ts'
import type { SemanticCheck, SemanticFinding, SurfaceView } from './semantic-check.ts'

export interface CompositeMoment {
  /** The composite type; also the first `requires` entry. */
  readonly composite: string
  /** One of the composite's `selection.json` intents. */
  readonly moment: string
  /** The clause after "Make it ONE <composite>". */
  readonly repair: string
  /** Extra types the check reads. */
  readonly requires?: readonly string[]
  /** Types whose presence skips the surface (the composite always does). */
  readonly lacks: readonly string[]
  /** The surface must hold one of these types. */
  readonly has?: readonly string[]
  /** Over the surface words. */
  readonly words?: RegExp
  /** Read words only from components of these types. */
  readonly wordTypes?: readonly string[]
  /** At least `min` components of `types`. */
  readonly inputs?: { readonly types: readonly string[]; readonly min: number }
  /** Types the surface must not hold. */
  readonly noInputs?: readonly string[]
  /** An input of `types` whose label, name or bound path matches `cue`, while the surface words match `words`. */
  readonly inputCue?: { readonly types: readonly string[]; readonly cue: RegExp; readonly words: RegExp }
  /** A Grid with at least `min` explicit children, all of type `child`. */
  readonly gridOf?: { readonly child: string; readonly min: number }
}

const BOOKING_INPUTS = ['TextField', 'Calendar', 'Select', 'ComboBox', 'Slider', 'RadioGroup', 'ChoiceGroup'] as const

export const COMPOSITE_MOMENTS: readonly CompositeMoment[] = [
  {
    composite: 'BookingForm',
    moment: 'collect booking details',
    repair: 'with its fields list (date, time, choice and party size) and one submit action, and drop the hand-built inputs.',
    lacks: ['BookingConfirmation'],
    inputs: { types: BOOKING_INPUTS, min: 2 },
    words: /\b(book|booking|reserve|reservation|guest|guests|party)\b/i,
  },
  {
    composite: 'BookingConfirmation',
    moment: 'confirm a completed booking',
    repair: 'with its title and summary rows bound to the booking, and drop the hand-built rows.',
    lacks: ['BookingForm'],
    noInputs: BOOKING_INPUTS,
    words: /\b(confirmed|booked|reserved|confirmation)\b/i,
  },
  {
    composite: 'BoardGrid',
    moment: 'a board of cells to target or mark',
    repair: 'with rows, cols and cells bound to the data model and one actionName, and drop the hand-built grid or guess field.',
    lacks: ['CardTable', 'PlayingCard'],
    gridOf: { child: 'Button', min: 3 },
    inputCue: { types: ['TextField'], cue: /guess/i, words: /\b(letter|letters|word|words)\b/i },
  },
  {
    composite: 'GameHud',
    moment: 'a game score and status strip',
    repair: 'beside the BoardGrid with its title, status and stats, and drop the hand-built score text.',
    requires: ['BoardGrid'],
    lacks: [],
    has: ['BoardGrid'],
    wordTypes: ['Text', 'Badge', 'Stat'],
    words: /\b(guess|guesses|shot|shots|ship|ships|remaining|score|attempt|attempts|tries)\b/i,
  },
  {
    composite: 'ResultCard',
    moment: 'a settled game, deal or booking outcome and its next action',
    repair: 'with its outcome, title, summary and stats and the next action, and drop the hand-built result text.',
    requires: ['BoardGrid'],
    lacks: [],
    has: ['BoardGrid'],
    words: /\b(game over|you win|you won|you lose|you lost|the word was|play again)\b/i,
  },
]

const WORD_PROPS = ['text', 'label', 'title', 'status'] as const

/** A component's literal words: its text, label, title and status strings. */
const wordsOf = (c: A2uiComponent): string =>
  WORD_PROPS.map((k) => c[k])
    .filter((v): v is string => typeof v === 'string')
    .join(' ')

const boundPath = (v: unknown): string =>
  typeof v === 'object' && v !== null && typeof (v as { path?: unknown }).path === 'string' ? (v as { path: string }).path : ''

const upperSnake = (type: string): string => type.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase()
const kebab = (type: string): string => type.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

/** The components of `view` that hand-build `m`'s moment, or `[]` when the row does not fire. */
function strays(m: CompositeMoment, view: SurfaceView): A2uiComponent[] {
  const comps = [...view.components.values()]
  const types = new Set(comps.map((c) => c.component))
  if ([m.composite, ...m.lacks].some((t) => types.has(t))) return []
  if (m.has !== undefined && !m.has.some((t) => types.has(t))) return []
  if (m.noInputs !== undefined && m.noInputs.some((t) => types.has(t))) return []
  // The composite's and the required types' own props never count as words.
  const own = new Set([m.composite, ...(m.requires ?? [])])
  const worded = comps.filter((c) => !own.has(c.component) && (m.wordTypes === undefined || m.wordTypes.includes(c.component)))
  const surfaceWords = worded.map(wordsOf).join(' ')

  if (m.gridOf !== undefined || m.inputCue !== undefined) {
    const { gridOf, inputCue } = m
    const grids = gridOf === undefined ? [] : comps.filter((c) => {
      if (c.component !== 'Grid' || !Array.isArray(c.children) || c.children.length < gridOf.min) return false
      return c.children.every((id) => view.components.get(id)?.component === gridOf.child)
    })
    const cued =
      inputCue === undefined || !inputCue.words.test(surfaceWords)
        ? []
        : comps.filter((c) => inputCue.types.includes(c.component) && [c['label'], c['name'], boundPath(c['value'])].some((v) => typeof v === 'string' && inputCue.cue.test(v)))
    return [...grids, ...cued]
  }
  if (m.words !== undefined && !m.words.test(surfaceWords)) return []
  if (m.inputs !== undefined) {
    const inputs = comps.filter((c) => m.inputs!.types.includes(c.component))
    return inputs.length >= m.inputs.min ? inputs : []
  }
  return m.words === undefined ? [] : worded.filter((c) => m.words!.test(wordsOf(c)))
}

/** The one generator: a row of `COMPOSITE_MOMENTS` as a semantic check. */
export function compositeMomentCheck(m: CompositeMoment): SemanticCheck {
  const code = `${upperSnake(m.composite)}_MISSING`
  return {
    id: `composite-moment-${kebab(m.composite)}`,
    requires: [m.composite, ...(m.requires ?? [])],
    check({ surfaces }): readonly SemanticFinding[] {
      const findings: SemanticFinding[] = []
      for (const view of surfaces) {
        const found = strays(m, view)
        if (found.length === 0) continue
        findings.push({
          code,
          path: `${view.surfaceId}:${found[0]!.id}`,
          message:
            `${view.surfaceId} hand-builds ${m.moment} with ${found.map((c) => `${c.id} (a ${c.component})`).join(', ')}. ` +
            `Make it ONE ${m.composite} ${m.repair}`,
        })
      }
      return findings
    },
  }
}

export const compositeMomentChecks: readonly SemanticCheck[] = COMPOSITE_MOMENTS.map(compositeMomentCheck)
