// generate-props.ts — the descriptor→props GENERATOR (ADR-0173 cl.3): projects a converted control's
// `{name}.md` `attributes[]` into the committed `{name}.props.gen.ts` sibling text — the `icons.gen.ts`
// (ADR-0066) / `generate-llms-full.mjs` vehicle reused for the props layer. Zero-dep, pure, TOTAL (never
// throws): every generation-time-unresolvable descriptor is a structured GenerationFailure, never a thrown
// exception or a silent partial artifact (cl.4's failure model). Reuses THE one parser/schema module
// (`component-descriptor.ts`'s `splitFrontmatter`/`parseDescriptor`) — this file never reads frontmatter
// itself. Determinism (cl.4a): a pure function of the descriptor's own bytes — no timestamps, no
// environment reads, source-declaration-order output.
//
// Two consumers share this ONE implementation (the llms.test.ts/generate-llms-full.mjs pairing, cl.4b):
// `scripts/generate-props.mjs` (the CLI, writes the committed file) and
// `descriptor/props-gen-driftwire.test.ts` (the gate, regenerates in-memory and diffs against committed
// bytes) — so the generator and its gate cannot drift into two implementations.

import { splitFrontmatter, parseDescriptor, type ParsedAttribute } from './component-descriptor.ts'

/** The generation-time failure classes (cl.4's Failure model) — a descriptor can be fully s9-schema-valid
 *  yet still UNGENERATABLE for props; each such gap is one of these, never a thrown exception. */
export const GENERATION_CODES = [
  'GEN_DESCRIPTOR_UNRESOLVED', // whole-descriptor issue: no tag, zero attributes, an unnamed attribute row
  'GEN_TYPE_UNRESOLVED', // a non-codec `type: json` attribute has no `tsType`, or `type` is missing/unknown
  'GEN_CONST_UNRESOLVED', // `const:` is empty, declared on a non-enum row, or reused with conflicting values
  'GEN_CODEC_UNRESOLVED', // `codec:` is declared but its `import`/`name` sub-fields did not both resolve
  'GEN_DEFAULT_UNRESOLVED', // the descriptor `default` token cannot be reparsed for the attribute's kind
] as const
export type GenerationCode = (typeof GENERATION_CODES)[number]

/** One generation defect: a stable code + the descriptor path it occurred at + a human message. */
export interface GenerationFailure {
  code: GenerationCode
  path: string
  message: string
}

export type GenerationResult =
  | { ok: true; code: string; failures: readonly [] }
  | { ok: false; code?: undefined; failures: GenerationFailure[] }

/** `ui-icon-only` → `icon-only`… no: `ui-button` → `button` (the folder/file basename every control's
 *  descriptor/props-gen pair shares). */
export function baseNameFromTag(tag: string): string {
  return tag.replace(/^ui-/, '')
}

/** Every control folder sits exactly two levels below `src/` (`controls/{name}/`), so the generated
 *  sibling's import of the shared `prop`/`PropsSchema` barrel is the SAME relative path for every control —
 *  the constant every hand-authored control source already uses. */
const DOM_IMPORT = '../../dom/index.ts'

/** A single-quoted JS string literal (the fleet's own hand-authored style, `prop.string('')`/
 *  `prop.enum(['solid', 'soft', 'ghost'] as const, 'solid')` — never `JSON.stringify`'s double quotes). */
const quote = (s: string): string => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

const overrideClauses = (attr: ParsedAttribute): string[] => {
  const out: string[] = []
  if (attr.reflect === true) out.push('reflect: true')
  if (attr.attribute === false) out.push('attribute: false')
  else if (typeof attr.attribute === 'string') out.push(`attribute: ${quote(attr.attribute)}`)
  return out
}

/** Wrap a bare `prop.*(...)` call (or a codec identifier) with `{ ...expr, reflect: true, attribute: '…' }`
 *  ONLY when the descriptor declares an override — matching the hand-authored style exactly (a prop with no
 *  override stays a bare call, never a needless spread). */
const wrapOverrides = (expr: string, attr: ParsedAttribute): string => {
  const overrides = overrideClauses(attr)
  return overrides.length > 0 ? `{ ...${expr}, ${overrides.join(', ')} }` : expr
}

/** The provenance-stamped leading comment every generated field carries (ADR-0173 OF2) — the descriptor's
 *  own `description:` when present, always followed by the regenerate-from-source stamp. `base` (not the
 *  full `ui-` tag) matches the real file name on disk (`{base}.md`). */
const commentFor = (base: string, attr: ParsedAttribute): string => {
  const stamp = `generated from ${base}.md attributes.${attr.name} — edit the descriptor, not this file.`
  return attr.description !== undefined ? `  // ${attr.description} — ${stamp}` : `  // ${stamp}`
}

const sameArray = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((v, i) => v === b[i])

/**
 * Project one converted control's descriptor markdown source into its `{name}.props.gen.ts` text. TOTAL —
 * never throws; a gap is a `GenerationFailure`, collected (not fail-fast) so a caller sees every defect in
 * one pass, matching `validateComponentDescriptor`/`compareDescriptorToProps`'s own convention.
 */
export function generatePropsModule(mdSource: string): GenerationResult {
  let fence: string
  try {
    fence = splitFrontmatter(mdSource).fence
  } catch (err) {
    return { ok: false, failures: [{ code: 'GEN_DESCRIPTOR_UNRESOLVED', path: 'fence', message: `no frontmatter fence: ${(err as Error).message}` }] }
  }
  const desc = parseDescriptor(fence)

  const tag = desc.scalars.get('tag')
  if (typeof tag !== 'string' || tag === '') {
    return { ok: false, failures: [{ code: 'GEN_DESCRIPTOR_UNRESOLVED', path: 'tag', message: 'descriptor has no tag: scalar — cannot derive the generated module name' }] }
  }
  const base = baseNameFromTag(tag)

  if (desc.attributes.length === 0) {
    return { ok: false, failures: [{ code: 'GEN_DESCRIPTOR_UNRESOLVED', path: 'attributes', message: `${tag}: attributes[] is empty — nothing to generate` }] }
  }

  const failures: GenerationFailure[] = []
  const constExports = new Map<string, readonly string[]>() // const name -> its values[] (first-seen; a later conflicting row fails)
  const codecImports = new Map<string, Set<string>>() // sibling import path -> imported identifier names
  const propLines: string[] = []
  let usesPropFactory = false

  for (const attr of desc.attributes) {
    if (typeof attr.name !== 'string' || attr.name === '') {
      failures.push({ code: 'GEN_DESCRIPTOR_UNRESOLVED', path: 'attributes[].name', message: `${tag}: an attribute row has no name` })
      continue
    }
    const path = `attributes.${attr.name}`

    // ── OF1 — a codec-declared attribute: import its whole PropConfig by name, never synthesize a call. ──
    if (attr.codec !== undefined) {
      const imp = attr.codec.import
      const nm = attr.codec.name
      if (!imp || !nm) {
        failures.push({ code: 'GEN_CODEC_UNRESOLVED', path: `${path}.codec`, message: `${tag}.${attr.name}: codec: is declared but missing ${!imp ? 'import' : 'name'}` })
        continue
      }
      const names = codecImports.get(imp) ?? new Set<string>()
      names.add(nm)
      codecImports.set(imp, names)
      propLines.push(`${commentFor(base, attr)}\n  ${attr.name}: ${wrapOverrides(nm, attr)},`)
      continue
    }

    switch (attr.type) {
      case 'enum': {
        const values = attr.values
        if (!values || values.length === 0) {
          failures.push({ code: 'GEN_DESCRIPTOR_UNRESOLVED', path: `${path}.values`, message: `${tag}.${attr.name}: enum has no values[]` })
          continue
        }
        let valuesExpr: string
        if (attr.const !== undefined) {
          if (attr.const === '') {
            failures.push({ code: 'GEN_CONST_UNRESOLVED', path: `${path}.const`, message: `${tag}.${attr.name}: const: is empty` })
            continue
          }
          const existing = constExports.get(attr.const)
          if (existing !== undefined && !sameArray(existing, values)) {
            failures.push({ code: 'GEN_CONST_UNRESOLVED', path: `${path}.const`, message: `${tag}: const "${attr.const}" is declared twice with different values[]` })
            continue
          }
          constExports.set(attr.const, values)
          valuesExpr = attr.const
        } else {
          valuesExpr = `[${values.map((v) => quote(v)).join(', ')}] as const`
        }
        const def = attr.default
        if (def === undefined || !values.includes(def)) {
          failures.push({ code: 'GEN_DEFAULT_UNRESOLVED', path: `${path}.default`, message: `${tag}.${attr.name}: default "${def ?? ''}" is not one of values[]` })
          continue
        }
        usesPropFactory = true
        propLines.push(`${commentFor(base, attr)}\n  ${attr.name}: ${wrapOverrides(`prop.enum(${valuesExpr}, ${quote(def)})`, attr)},`)
        break
      }
      case 'boolean': {
        const def = attr.default
        if (def !== 'true' && def !== 'false') {
          failures.push({ code: 'GEN_DEFAULT_UNRESOLVED', path: `${path}.default`, message: `${tag}.${attr.name}: boolean default must be true|false, got "${def ?? ''}"` })
          continue
        }
        usesPropFactory = true
        propLines.push(`${commentFor(base, attr)}\n  ${attr.name}: ${wrapOverrides(`prop.boolean(${def})`, attr)},`)
        break
      }
      case 'number': {
        const def = attr.default
        let literal: string
        if (def === 'null') {
          literal = 'null'
        } else {
          const n = def === undefined ? Number.NaN : Number(def)
          if (def === undefined || def === '' || !Number.isFinite(n)) {
            failures.push({ code: 'GEN_DEFAULT_UNRESOLVED', path: `${path}.default`, message: `${tag}.${attr.name}: number default "${def ?? ''}" is not null or a finite number` })
            continue
          }
          literal = String(n)
        }
        usesPropFactory = true
        propLines.push(`${commentFor(base, attr)}\n  ${attr.name}: ${wrapOverrides(`prop.number(${literal})`, attr)},`)
        break
      }
      case 'string': {
        const def = attr.default ?? ''
        usesPropFactory = true
        propLines.push(`${commentFor(base, attr)}\n  ${attr.name}: ${wrapOverrides(`prop.string(${quote(def)})`, attr)},`)
        break
      }
      case 'json': {
        if (!attr.tsType) {
          failures.push({ code: 'GEN_TYPE_UNRESOLVED', path: `${path}.tsType`, message: `${tag}.${attr.name}: type: json with no codec: needs a tsType` })
          continue
        }
        const def = attr.default
        let literal: string
        if (def === 'undefined') {
          literal = 'undefined'
        } else if (def === 'null') {
          literal = 'null'
        } else {
          try {
            literal = JSON.stringify(JSON.parse(def ?? '')) as string
          } catch {
            failures.push({ code: 'GEN_DEFAULT_UNRESOLVED', path: `${path}.default`, message: `${tag}.${attr.name}: json default "${def ?? ''}" is not undefined, null, or valid JSON` })
            continue
          }
        }
        usesPropFactory = true
        propLines.push(`${commentFor(base, attr)}\n  ${attr.name}: ${wrapOverrides(`prop.json<${attr.tsType}>(${literal})`, attr)},`)
        break
      }
      default:
        failures.push({ code: 'GEN_TYPE_UNRESOLVED', path: `${path}.type`, message: `${tag}.${attr.name}: unresolvable attribute type "${attr.type ?? ''}"` })
    }
  }

  if (failures.length > 0) return { ok: false, failures }

  const domNames = usesPropFactory ? ['prop', 'type PropsSchema'] : ['type PropsSchema']
  const lines: string[] = [
    `// GENERATED by scripts/generate-props.mjs from ${base}.md — DO NOT EDIT BY HAND (ADR-0173).`,
    `// Re-run \`node scripts/generate-props.mjs ${base}\` to regenerate (or with no args to regenerate the whole fleet).`,
    `import { ${domNames.join(', ')} } from '${DOM_IMPORT}'`,
  ]
  for (const [source, names] of [...codecImports.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    lines.push(`import { ${[...names].sort().join(', ')} } from '${source}'`)
  }
  lines.push('')
  for (const [name, values] of constExports) {
    lines.push(`export const ${name} = [${values.map((v) => quote(v)).join(', ')}] as const`, '')
  }
  lines.push('export const props = {', ...propLines, '} satisfies PropsSchema', '')

  return { ok: true, code: lines.join('\n'), failures: [] }
}
