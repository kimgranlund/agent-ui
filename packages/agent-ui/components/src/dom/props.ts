// props.ts — typed props-as-signals, the compile-time half (G2 first slice; plan §5).
//
// This slice is PURE TYPES + PURE CODECS — it proves the headline TS bet (`ReactiveProps<typeof
// props>` declare-merges to correctly-typed accessors, enum → literal union, never widened to
// `string`) in isolation, before any control depends on it (goals.md G2 DoD1). It imports nothing:
// the runtime install (`finalize()` → signal-backed prototype accessors) is the NEXT slice and is
// the first to touch the `../reactive` kernel. No decorators / enum / namespace (erasableSyntaxOnly).

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
