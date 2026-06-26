// props.ts — typed props-as-signals (plan §5).
//
// Two halves: (1) the COMPILE-TIME typing contract — `PropType`/`PropConfig`/`prop.*`/`ReactiveProps`
// — that proves the headline TS bet (an `as const` enum prop declare-merges to its literal union,
// never widened to `string`; goals.md G2 DoD1, proven in `props-typing.test.ts`); and (2) the RUNTIME
// install, `finalize()`, which turns that contract into per-instance signal-backed prototype accessors
// (goals.md G2 DoD2). `finalize` is the FIRST dom module code to touch the `../reactive` kernel —
// the one allowed direction (dom → reactive). No decorators / enum / namespace (erasableSyntaxOnly).

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
      },
    })
  }
}

/**
 * Inbound seam: cross an attribute STRING (or `null` for absence) into the typed prop signal via the
 * prop's `PropType.from` codec, and return the coerced value. This is the primitive the element slice's
 * `attributeChangedCallback` (e-attrs, later) composes on — p-install owns the per-instance store + the
 * string→typed crossing; it does NOT own the platform callback. A no-op for an unknown prop name.
 */
export function coerceAttribute(instance: object, ctor: Finalizable, name: string, attr: string | null): unknown {
  const config = ctor.props?.[name]
  if (!config) return undefined
  const value = config.type.from(attr)
  signalFor(instance, name, config).value = value
  return value
}
