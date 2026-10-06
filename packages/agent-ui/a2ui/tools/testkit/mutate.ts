// mutate.ts: the kit's seeded, deterministic mutation operators for fuzzing green scenarios (T-0011). No
// dependency: a 32-bit PRNG (mulberry32) and a closed operator list. Each operator is tagged:
//   - `form`: a defect the shared healer repairs. `FORM_REPAIR` maps each to the repair name heal.ts
//     reports for it. `single-object-envelope` is not an operator: per-line heal reports that repair for
//     every one-object line, mutated or not, so a check on it could never go red.
//   - `semantic`: a defect the validator rejects. `SEMANTIC_CODE` maps each to its native code.
// Every operator carries an `applies(line)` precondition, so a mutant always carries its
// defect: `drop-root` applies only to an `updateComponents` line delivering `root` plus at least one other
// component (a single-node surface with its root dropped is an empty set, which validates outside
// `atFinalize`), and the others need a parseable message line of the right shape. Browser-safe.

export type OperatorKind = 'form' | 'semantic'

export interface MutationOperator {
  name: string
  kind: OperatorKind
  /** Whether this line can carry the defect. */
  applies(line: string): boolean
  /** The mutated line (only called when `applies`). */
  apply(line: string, rand: () => number): string
}

export interface Mutant {
  operator: string
  kind: OperatorKind
  /** Index of the mutated line in the input. */
  index: number
  lines: string[]
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function message(line: string): Record<string, unknown> | undefined {
  try {
    const v: unknown = JSON.parse(line)
    return isObject(v) && typeof v.version === 'string' ? v : undefined
  } catch {
    return undefined
  }
}

const components = (m: Record<string, unknown> | undefined): Record<string, unknown>[] | undefined => {
  const body = m?.updateComponents
  return isObject(body) && Array.isArray(body.components) ? (body.components as Record<string, unknown>[]) : undefined
}

const pick = <T>(items: readonly T[], rand: () => number): T => items[Math.floor(rand() * items.length) % items.length]!

export const OPERATORS: readonly MutationOperator[] = [
  { name: 'fence', kind: 'form', applies: (l) => message(l) !== undefined, apply: (l) => '```json\n' + l + '\n```' },
  { name: 'prose', kind: 'form', applies: (l) => message(l) !== undefined, apply: (l) => `Here is the line: ${l} That is all.` },
  { name: 'trailing-comma', kind: 'form', applies: (l) => message(l) !== undefined && l.trimEnd().endsWith('}'), apply: (l) => l.trimEnd().replace(/}$/, ',}') },
  {
    name: 'drop-version',
    kind: 'form',
    applies: (l) => message(l) !== undefined,
    apply: (l) => {
      const rest = { ...message(l)! }
      delete rest.version
      return JSON.stringify(rest)
    },
  },
  {
    name: 'drop-root',
    kind: 'semantic',
    applies: (l) => {
      const cs = components(message(l))
      return cs !== undefined && cs.length >= 2 && cs.some((c) => c.id === 'root')
    },
    apply: (l) => {
      const m = message(l)!
      const body = m.updateComponents as Record<string, unknown>
      return JSON.stringify({ ...m, updateComponents: { ...body, components: components(m)!.filter((c) => c.id !== 'root') } })
    },
  },
  {
    name: 'unknown-type',
    kind: 'semantic',
    applies: (l) => (components(message(l))?.length ?? 0) > 0,
    apply: (l, rand) => {
      const m = message(l)!
      const cs = components(m)!
      const victim = pick(cs.map((_, i) => i), rand)
      const body = m.updateComponents as Record<string, unknown>
      return JSON.stringify({ ...m, updateComponents: { ...body, components: cs.map((c, i) => (i === victim ? { ...c, component: 'KitNoSuchType' } : c)) } })
    },
  },
  { name: 'wrong-version', kind: 'semantic', applies: (l) => message(l) !== undefined, apply: (l) => JSON.stringify({ ...message(l)!, version: 'v9.9' }) },
]

/** The repair name heal.ts reports for each form operator. */
export const FORM_REPAIR: Readonly<Record<string, string>> = {
  fence: 'fence-strip',
  prose: 'fence-strip',
  'trailing-comma': 'trailing-comma',
  'drop-version': 'version-fill',
}

/** The native validator code each semantic operator must draw. */
export const SEMANTIC_CODE: Readonly<Record<string, string>> = {
  'drop-root': 'IDGRAPH',
  'unknown-type': 'CATALOG',
  'wrong-version': 'VERSION_UNSUPPORTED',
}

/** mulberry32: a deterministic 32-bit PRNG in [0, 1). */
export function prng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function operatorNamed(name: string): MutationOperator {
  const op = OPERATORS.find((o) => o.name === name)
  if (op === undefined) throw new Error(`testkit: no mutation operator ${name}`)
  return op
}

/** Apply one named operator to a seed-chosen applicable line, or `undefined` when no line applies. */
export function mutateWith(lines: readonly string[], operator: string, seed: number): Mutant | undefined {
  const op = operatorNamed(operator)
  const rand = prng(seed)
  const candidates = lines.map((l, i) => (op.applies(l) ? i : -1)).filter((i) => i >= 0)
  if (candidates.length === 0) return undefined
  const index = pick(candidates, rand)
  const out = [...lines]
  out[index] = op.apply(lines[index]!, rand)
  return { operator: op.name, kind: op.kind, index, lines: out }
}

/** Apply one seed-chosen applicable operator, or `undefined` when none applies to any line. */
export function mutate(lines: readonly string[], seed: number): Mutant | undefined {
  const rand = prng(seed)
  const applicable = OPERATORS.filter((op) => lines.some((l) => op.applies(l)))
  if (applicable.length === 0) return undefined
  return mutateWith(lines, pick(applicable, rand).name, Math.floor(rand() * 2 ** 32))
}
