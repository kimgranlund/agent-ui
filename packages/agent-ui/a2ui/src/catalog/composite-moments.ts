// composite-moments.ts: "use composite X for moment Y" as data-driven semantic checks (T-0208).
//
// Each row of `COMPOSITE_MOMENTS` names a registered composite, one of its `selection.json` intents (the moment),
// and a narrow structural detector for a surface that hand-builds that moment without it (CA-R9 lever 3). One
// generator turns every row into a `SemanticCheck` (ADR-0238) whose finding sends the model back to make the
// surface ONE composite. A row's `notInside` also sends back a composite wrapped in a card of its own (T-0262,
// `<COMPOSITE>_WRAPPED`). The check `requires` the composite (and any type it reads), so `gateChecksOnCatalog`
// keeps a row on exactly the catalogs that can emit it: the booking rows ride `<base>--concierge`, the games rows
// ride `agent-ui` until the games types move to a domain, the ProductCard row rides `agent-ui`, and `a2ui-basic`
// gets none.
//
// The link to the sidecar is a test, not an import (`composite-moments.test.ts`: every `moment` is one of its
// composite's intents): the module imports no JSON, so plain Node (`scripts/e2e-admin/probe/trace.ts`) and both
// server hosts can import it, and `selection-guidance.ts` keeps its closed `{intents, notFor}` row shape.
//
// T-0313 (Kim 2026-10-16, P1 as revised): a row is the one matcher for its moment. Its `ask` holds the turn words that
// ask for the moment and the surface that answers it; the Concierge SURFACE_MISSING check reads them through
// `askedCompositeMoment` instead of keeping its own regexes. The facility ask stays in that check: its answer, a Card
// holding a DescriptionList, is no composite.

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
  /** Or, with none of `inputs.types` present, a read-back: a component of `types` beside a Button whose label matches `cue`. */
  readonly readBack?: { readonly types: readonly string[]; readonly cue: RegExp }
  /** Types the surface must not hold. */
  readonly noInputs?: readonly string[]
  /** An input of `types` whose label, name or bound path matches `cue`, while the surface words match `words`. */
  readonly inputCue?: { readonly types: readonly string[]; readonly cue: RegExp; readonly words: RegExp }
  /** A Grid with at least `min` explicit children, all of type `child`. */
  readonly gridOf?: { readonly child: string; readonly min: number }
  /** T-0262: types the composite must not sit inside (it draws its own card); a wrapper yields `<COMPOSITE>_WRAPPED`. */
  readonly notInside?: readonly string[]
  /** T-0279: a Table with a column whose key or label matches `cue`, while the surface words match `words`. */
  readonly tableColumn?: { readonly cue: RegExp }
  /** T-0313: the turn words that ask for this moment (`cue`), its short name (the SURFACE_MISSING path), the surface that
   *  answers it, and its precedence when one turn's words ask for two moments (lowest first). */
  readonly ask?: { readonly moment: string; readonly cue: RegExp; readonly surface: string; readonly rank: number }
}

const BOOKING_INPUTS = ['TextField', 'Calendar', 'Select', 'ComboBox', 'Slider', 'RadioGroup', 'ChoiceGroup'] as const

/** The guest confirms a booking already read back ("please confirm the booking"; T-0282: "Confirm it, the details are
 *  right.", "Yes, confirm the table for four."). */
const CONFIRM_ASK = /\bconfirm\s+it\b|\bconfirm\b[^.?!]*\b(booking|reservation|appointment|slot|table|tour)\b/i
/** The guest asks what can be booked ("What spa services can I book?"). */
const SERVICES_ASK = /\b(services|treatments|amenities|menu)\b/i
/** The guest asks to book ("Book a 60-minute massage on Thursday at 15:00"; T-0282: "I'd like a table at Vela"). */
const BOOK_ASK = /\b(book|reserve|reservation)\b|\b(i'?d|i would|we'?d|we would) like (a|an) (table|room|treatment|massage|tour|appointment)\b/i

export const COMPOSITE_MOMENTS: readonly CompositeMoment[] = [
  {
    composite: 'BookingForm',
    moment: 'collect booking details',
    repair:
      'with its fields list (date, time, choice and party size), its value bound to the details the guest already gave so they ' +
      'arrive pre-filled, and one submit action, and drop the hand-built inputs or read-back.',
    lacks: ['BookingConfirmation'],
    inputs: { types: BOOKING_INPUTS, min: 2 },
    // T-0266: a fully specified ask read back as a DescriptionList with a confirm Button is still this moment.
    readBack: { types: ['DescriptionList'], cue: /\bconfirm\b/i },
    words: /\b(book|booking|reserve|reservation|guest|guests|party)\b/i,
    ask: { moment: 'booking', cue: BOOK_ASK, rank: 2, surface: 'a BookingForm with its value bound to the details the guest already gave, so they arrive pre-filled' },
  },
  {
    composite: 'BookingConfirmation',
    moment: 'confirm a completed booking',
    repair:
      "in place of the hand-built Card, never inside one: resend the Card's id as the BookingConfirmation (a root Card needs the " +
      'surface re-created and its data model sent again), with its title, data bound to the booking object, and rows as a literal ' +
      'array of {label, path} where each path is a key of that object (never bind rows itself); drop the hand-built rows.',
    lacks: ['BookingForm'],
    notInside: ['Card'],
    noInputs: BOOKING_INPUTS,
    words: /\b(confirmed|booked|reserved|confirmation)\b/i,
    ask: {
      moment: 'confirm',
      cue: CONFIRM_ASK,
      rank: 0,
      surface:
        "a BookingConfirmation reading back the values on the open BookingForm (the guest's confirm in chat is their submission, so nothing waits on the form button; add no reference number)",
    },
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
  {
    // T-0279 (Kim's ruling): a priced, bookable treatment or service list is one ProductCard each, never a Table.
    composite: 'ProductCard',
    moment: 'one product, room or offer to buy or book',
    repair:
      'per item, templated in a Grid over the list in the data model (title, price, the duration or unit as priceNote, and one ' +
      'action with the item id in its context), and drop the priced Table.',
    // Not `requires: ['Table']`: required types' props never count as words, and the Table's label carries them.
    lacks: ['BookingForm', 'BookingConfirmation', 'CardTable'],
    tableColumn: { cue: /\b(price|prices|cost|rate|fee)\b/i },
    words: /\b(book|bookable|treatment|treatments|service|services|spa|massage|room|rooms|offer|offers)\b/i,
    ask: { moment: 'services', cue: SERVICES_ASK, rank: 1, surface: 'one ProductCard per service the guest can book, templated in a Grid, each with its price and book action' },
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
  if (m.tableColumn !== undefined) {
    const { cue } = m.tableColumn
    return comps.filter(
      (c) =>
        c.component === 'Table' &&
        Array.isArray(c['columns']) &&
        (c['columns'] as unknown[]).some((col) => typeof col === 'object' && col !== null && ['key', 'label'].some((k) => {
          const v = (col as Record<string, unknown>)[k]
          return typeof v === 'string' && cue.test(v)
        })),
    )
  }
  if (m.inputs !== undefined) {
    const inputs = comps.filter((c) => m.inputs!.types.includes(c.component))
    if (inputs.length >= m.inputs.min) return inputs
    if (m.readBack === undefined || inputs.length > 0) return []
    const { types: rowTypes, cue } = m.readBack
    const rows = comps.filter((c) => rowTypes.includes(c.component))
    const confirms = comps.filter((c) => c.component === 'Button' && typeof c['label'] === 'string' && cue.test(c['label']))
    return rows.length > 0 && confirms.length > 0 ? [...rows, ...confirms] : []
  }
  return m.words === undefined ? [] : worded.filter((c) => m.words!.test(wordsOf(c)))
}

/** The ids a component lists as `child` or explicit `children` (a template ChildList names no fixed ids). */
const childIds = (c: A2uiComponent): string[] => [
  ...(typeof c.child === 'string' ? [c.child] : []),
  ...(Array.isArray(c.children) ? c.children.filter((id): id is string => typeof id === 'string') : []),
]

/** T-0262: the components of `view` of a `notInside` type whose subtree holds `m`'s composite, or `[]`. */
function wrappers(m: CompositeMoment, view: SurfaceView): A2uiComponent[] {
  if (m.notInside === undefined) return []
  const parent = new Map<string, A2uiComponent>()
  for (const c of view.components.values()) for (const id of childIds(c)) parent.set(id, c)
  const found = new Map<string, A2uiComponent>()
  for (const c of view.components.values()) {
    if (c.component !== m.composite) continue
    const seen = new Set<string>([c.id])
    for (let p = parent.get(c.id); p !== undefined && !seen.has(p.id); p = parent.get(p.id)) {
      seen.add(p.id)
      if (m.notInside.includes(p.component)) found.set(p.id, p)
    }
  }
  return [...found.values()]
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
        const wrapped = wrappers(m, view)
        if (wrapped.length > 0) {
          findings.push({
            code: `${upperSnake(m.composite)}_WRAPPED`,
            path: `${view.surfaceId}:${wrapped[0]!.id}`,
            message:
              `${view.surfaceId} wraps its ${m.composite} in ${wrapped.map((c) => `${c.id} (a ${c.component})`).join(', ')}, a card around a card. ` +
              `Make it ONE ${m.composite} ${m.repair}`,
          })
          continue
        }
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

/** T-0313: the rows that carry an ask cue, in precedence order. */
const ASKED = COMPOSITE_MOMENTS.filter((m) => m.ask !== undefined).sort((a, b) => a.ask!.rank - b.ask!.rank)

/** T-0313: the composite moment a turn's words ask for, with the surface that answers it, or undefined. */
export function askedCompositeMoment(intent: string): { moment: string; surface: string } | undefined {
  const ask = ASKED.find((m) => m.ask!.cue.test(intent))?.ask
  return ask === undefined ? undefined : { moment: ask.moment, surface: ask.surface }
}

/** T-0299: the row a `<COMPOSITE>_MISSING` code names, or undefined for any other code. */
export function missingCompositeMoment(code: string): CompositeMoment | undefined {
  return COMPOSITE_MOMENTS.find((m) => `${upperSnake(m.composite)}_MISSING` === code)
}

/** T-0299: whether these surfaces answer `m`'s moment: one holds the composite or a type the row stands aside for. */
export function compositeAnswered(m: CompositeMoment, views: readonly SurfaceView[]): boolean {
  return views.some((view) => [...view.components.values()].some((c) => c.component === m.composite || m.lacks.includes(c.component)))
}
