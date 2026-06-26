// props.ts — typed props-as-signals (plan §5).
//
// Two halves: (1) the COMPILE-TIME typing contract — `PropType`/`PropConfig`/`prop.*`/`ReactiveProps`
// — that proves the headline TS bet (an `as const` enum prop declare-merges to its literal union,
// never widened to `string`; goals.md G2 DoD1, proven in `props-typing.test.ts`); and (2) the RUNTIME
// install, `finalize()`, which turns that contract into per-instance signal-backed prototype accessors
// (goals.md G2 DoD2). `finalize` is the FIRST dom module code to touch the `../reactive` kernel —
// the one allowed direction (dom → reactive). No decorators / enum / namespace (erasableSyntaxOnly).
//
// The runtime half also owns the attribute↔value REFLECTION BOUNDARY (goals.md G2 DoD2; rubric D3).
// The string↔typed boundary lives at EXACTLY TWO functions: `coerceAttribute` (inbound, string→typed
// via `PropType.from`) and `reflectOut` (outbound, typed→string via `PropType.to`). A per-instance
// DIRECTIONAL LOCK guards each against the other so the platform's `attributeChangedCallback` echo
// cannot loop: while a value→attribute reflect is in flight the inbound echo it triggers is suppressed,
// and while an attribute→value coercion is in flight the setter does not reflect it back out.

import { signal } from '../reactive/index.ts'
import type { Signal } from '../reactive/index.ts'

// ── PropType<T> — the string↔typed codec (p-types) ───────────────────────────
//
// Every prop value crosses the attribute↔property boundary through exactly one codec: `from` parses
// an attribute string (or absence, `null`) into the typed value; `to` serializes back to an
// attribute string (or `null` to remove). `from`/`to` are written as METHODS so their parameters
// stay bivariant — that is what lets a `PropConfig<'a'|'b'>` satisfy `PropConfig<unknown>` in the
// schema constraint below without losing the literal union.

export interface PropType<T> {
  from(attr: string | null): T
  to(value: T): string | null
}

const stringType: PropType<string> = {
  from(attr) {
    return attr ?? ''
  },
  to(value) {
    return value
  },
}

const numberType: PropType<number | null> = {
  from(attr) {
    return attr === null || attr === '' ? null : Number(attr)
  },
  to(value) {
    return value === null ? null : String(value)
  },
}

const booleanType: PropType<boolean> = {
  from(attr) {
    return attr !== null // presence semantics
  },
  to(value) {
    return value ? '' : null
  },
}

/** A codec for a fixed string-literal set; `from` snaps an unknown attribute back to the first member. */
export function enumType<T extends readonly string[]>(values: T): PropType<T[number]> {
  return {
    from(attr) {
      return attr !== null && (values as readonly string[]).includes(attr) ? (attr as T[number]) : values[0]
    },
    to(value) {
      return value
    },
  }
}

/** A codec for an arbitrary JSON-serializable value of type `T` (round-trips via JSON). */
export function jsonType<T>(): PropType<T> {
  return {
    from(attr) {
      return attr === null ? (null as T) : (JSON.parse(attr) as T)
    },
    to(value) {
      return JSON.stringify(value)
    },
  }
}

/** The three fixed codecs (the parametric `enumType`/`jsonType` are factories above). */
export const Types = {
  string: stringType,
  number: numberType,
  boolean: booleanType,
}

// ── PropConfig<T> + the prop.* constructors (p-config) ───────────────────────
//
// A control's schema is a typed dict of `PropConfig<T>`; each `prop.*` constructor carries the value
// type so the dict infers it. `enum`/`json` use a `const` type parameter so literal unions and the
// `json<T>` shape are preserved rather than widened.

export interface PropConfig<T> {
  type: PropType<T>
  default: T
  attribute?: string | false
  reflect?: boolean
}

export const prop = {
  string(def = ''): PropConfig<string> {
    return { type: Types.string, default: def }
  },
  number(def: number | null = null): PropConfig<number | null> {
    return { type: Types.number, default: def }
  },
  boolean(def = false): PropConfig<boolean> {
    return { type: Types.boolean, default: def }
  },
  enum<const T extends readonly string[]>(values: T, def: T[number]): PropConfig<T[number]> {
    return { type: enumType(values), default: def }
  },
  json<T>(def: T): PropConfig<T> {
    return { type: jsonType<T>(), default: def }
  },
}

// ── ReactiveProps<S> — the declare-merge mapped type (p-reactiveprops) ────────
//
// `PropsSchema` is the constraint for a `static props` dict; `ReactiveProps<S>` maps each
// `PropConfig<T>` to its accessor type `T`. A control then merges the instance type:
//
//   const props = { variant: prop.enum(['solid','soft','ghost'] as const, 'solid') } satisfies PropsSchema
//   interface UIButtonElement extends ReactiveProps<typeof props> {}   // → this.variant: 'solid'|'soft'|'ghost'
//
// The class + same-name interface declaration-merge gives fully-inferred accessor types that the base
// class installs at runtime (finalize(), next slice). The proof lives in `props-typing.test.ts`.

export type PropsSchema = Record<string, PropConfig<unknown>>

export type ReactiveProps<S extends PropsSchema> = {
  [K in keyof S]: S[K] extends PropConfig<infer T> ? T : never
}

// ── finalize() — the runtime install (p-install) ─────────────────────────────
//
// `finalize(Ctor)` reads the `static props` dict and installs ONE prototype accessor per prop, each
// backed by a PER-INSTANCE kernel signal. Reading `this.variant` inside an `effect` tracks it; writing
// invalidates dependents (and the kernel's `Object.is` cutoff carries straight through the accessor).
//
// The per-instance signal store is a module-private `WeakMap<instance, Map<name, Signal>>`, populated
// LAZILY on first access. This is the seam's key property: it needs NO constructor, so `finalize` is
// fully isolable from the element lifecycle (the connection scope / AbortController / attribute
// callbacks are the later element slice). The element host composes on this store unchanged — its
// constructor may pre-warm signals, but is not required to.

/** A constructor-like with a `static props` schema — what `finalize` installs accessors onto. */
export interface Finalizable {
  prototype: object
  props?: PropsSchema
}

const STORE = new WeakMap<object, Map<string, Signal<unknown>>>()
const FINALIZED = new WeakSet<Finalizable>()

function signalFor(instance: object, name: string, config: PropConfig<unknown>): Signal<unknown> {
  let signals = STORE.get(instance)
  if (!signals) {
    signals = new Map()
    STORE.set(instance, signals)
  }
  let sig = signals.get(name)
  if (!sig) {
    sig = signal(config.default) // lazy init to the declared default
    signals.set(name, sig)
  }
  return sig
}

// ── reflection + directional locks (p-reflect) ───────────────────────────────
//
// A per-instance crossing guard. `outbound` holds the prop names whose attribute is being written RIGHT
// NOW (value→attribute); `inbound` holds the names whose value is being written from an attribute RIGHT
// NOW (attribute→value). The reads (`isCrossing`) never allocate — only an actual crossing creates the
// guard. Sets (not booleans) so a re-entrant crossing of a *different* prop is never falsely suppressed.

interface CrossGuard {
  outbound: Set<string>
  inbound: Set<string>
}

const GUARD = new WeakMap<object, CrossGuard>()

function guardOf(instance: object): CrossGuard {
  let g = GUARD.get(instance)
  if (!g) {
    g = { outbound: new Set(), inbound: new Set() }
    GUARD.set(instance, g)
  }
  return g
}

function isCrossing(instance: object, dir: 'outbound' | 'inbound', name: string): boolean {
  return GUARD.get(instance)?.[dir].has(name) ?? false
}

/** Resolve a prop's attribute name: `attribute: false` ⇒ no attribute (property-only); else the override or the prop name. */
function attrNameOf(config: PropConfig<unknown>, name: string): string | null {
  return config.attribute === false ? null : (config.attribute ?? name)
}

/**
 * Outbound seam (the second of the two boundary functions): cross a TYPED value → its attribute string
 * via the prop's `PropType.to` codec, and write it to the host attribute exactly once. Holds the
 * `outbound` directional lock across the write so the synchronous `attributeChangedCallback` echo the
 * platform fires re-enters `coerceAttribute` LOCKED and is suppressed — the loop is broken at the gate,
 * not after a redundant round-trip. A `null` from `to` (boolean-false / number-null / property-only)
 * removes the attribute. Called only from the reflect setter, only when `config.reflect` is set.
 */
function reflectOut(instance: object, name: string, config: PropConfig<unknown>, value: unknown): void {
  const attr = attrNameOf(config, name)
  if (attr === null) return // property-only prop: nothing to reflect to
  const host = instance as unknown as Element // a reflect prop's host is an Element; setAttribute is a DOM API, not an import
  const guard = guardOf(instance)
  guard.outbound.add(name)
  try {
    const serialized = config.type.to(value) // OUTBOUND boundary: typed → string
    if (serialized === null) host.removeAttribute(attr)
    else host.setAttribute(attr, serialized)
  } finally {
    guard.outbound.delete(name)
  }
}

/** Install signal-backed prototype accessors from `Ctor.props`. Idempotent (safe to call once per class). */
export function finalize(ctor: Finalizable): void {
  if (FINALIZED.has(ctor)) return
  FINALIZED.add(ctor)
  const props = ctor.props
  if (!props) return
  for (const name of Object.keys(props)) {
    const config = props[name]
    Object.defineProperty(ctor.prototype, name, {
      configurable: true,
      enumerable: true,
      get(this: object): unknown {
        return signalFor(this, name, config).value
      },
      set(this: object, next: unknown): void {
        signalFor(this, name, config).value = next
        // Reflect value→attribute exactly once, unless this write IS an inbound coercion (the
        // directional lock): an attribute→value crossing must not bounce straight back out.
        if (config.reflect && !isCrossing(this, 'inbound', name)) {
          reflectOut(this, name, config, next)
        }
      },
    })
  }
}

/**
 * Inbound seam (the first of the two boundary functions): cross an attribute STRING (or `null` for
 * absence) into the typed prop signal via the prop's `PropType.from` codec, and return the coerced
 * value. This is the primitive the element slice's `attributeChangedCallback` (e-attrs, later) composes
 * on — p-install owns the per-instance store + the string→typed crossing; it does NOT own the platform
 * callback. A no-op for an unknown prop name.
 *
 * Two directional-lock interactions (rubric D3): (1) if an outbound reflect for this prop is in flight,
 * this call is that reflect's own platform echo — suppress it (return `undefined`) so it cannot loop.
 * (2) Otherwise write through the installed accessor under the `inbound` lock, so the setter applies the
 * value but does NOT reflect it straight back out. The write goes through the setter (not the raw signal)
 * precisely so that symmetric guard is load-bearing: one write path, the lock decides whether it reflects.
 */
export function coerceAttribute(instance: object, ctor: Finalizable, name: string, attr: string | null): unknown {
  const config = ctor.props?.[name]
  if (!config) return undefined
  if (isCrossing(instance, 'outbound', name)) return undefined // our own reflect's echo → suppress (no loop)
  const value = config.type.from(attr) // INBOUND boundary: string → typed
  const guard = guardOf(instance)
  guard.inbound.add(name)
  try {
    ;(instance as Record<string, unknown>)[name] = value // through the accessor; the inbound lock stops a reflect-back
  } finally {
    guard.inbound.delete(name)
  }
  return value
}

// ── attribute↔prop NAME mapping (the e-attrs seam) ───────────────────────────
//
// The platform's `observedAttributes` / `attributeChangedCallback` speak ATTRIBUTE names; `coerceAttribute`
// speaks PROP names. These two functions own the attribute↔prop NAME mapping (via the same `attrNameOf`
// the reflect path uses), so the string↔typed boundary AND the name mapping stay single-sourced in
// props.ts; element.ts (e-attrs) is a thin platform-callback adapter over them. Internal seam — used by
// element.ts, NOT re-exported from the dom barrel.

/** The attribute names to observe for a finalized ctor: each prop's attribute name, minus property-only props. */
export function observedAttributesFor(ctor: Finalizable): string[] {
  const props = ctor.props
  if (!props) return []
  const names: string[] = []
  for (const name of Object.keys(props)) {
    const attr = attrNameOf(props[name], name)
    if (attr !== null) names.push(attr)
  }
  return names
}

/** Reverse the mapping: the prop name owning a given attribute name (respecting `attribute` overrides), or `undefined`. */
export function propForAttribute(ctor: Finalizable, attr: string): string | undefined {
  const props = ctor.props
  if (!props) return undefined
  for (const name of Object.keys(props)) {
    if (attrNameOf(props[name], name) === attr) return name
  }
  return undefined
}
