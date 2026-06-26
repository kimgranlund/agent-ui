import { describe, it, expect } from 'vitest'
import { prop, type PropsSchema, type ReactiveProps } from './props.ts'

// D1 — the headline TS bet (goals.md G2 DoD1, rubric element.md D1). This is a COMPILE-TIME proof:
// the evidence is that `npm run check` (tsc) passes with every `// @ts-expect-error` line load-bearing.
// If `ReactiveProps` widened an `as const` enum accessor to `string`, the "bare string assigned to an
// enum prop" directive below would suppress nothing → tsc reports an UNUSED @ts-expect-error → the gate
// fails. The runtime `expect`s exist only so vitest reports a green file; the type errors are the assertion
// (the same idiom the kernel uses for K6 read-only — graph.test.ts). No body below is ever invoked.

const props = {
  variant: prop.enum(['solid', 'soft', 'ghost'] as const, 'solid'),
  size: prop.enum(['sm', 'md', 'lg'] as const, 'md'),
  count: prop.number(0),
  label: prop.string('hi'),
  disabled: prop.boolean(false),
  data: prop.json<{ items: number[] }>({ items: [] }),
} satisfies PropsSchema

// The declaration-merge pattern, in isolation: an empty class whose instance accessor types come
// entirely from the merged interface (the base class installs them at runtime via finalize(), next slice).
interface Demo extends ReactiveProps<typeof props> {}
class Demo {}

// And it survives one level of subclassing (the merged accessor types compose through `extends`).
interface SubDemo extends ReactiveProps<typeof props> {}
class SubDemo extends Demo {}

describe('props-typing — ReactiveProps declare-merge (D1)', () => {
  it('an enum accessor is its literal union, NOT widened to string', () => {
    const fn = () => {
      const el = new Demo()
      el.variant = 'soft' // a member assigns cleanly
      el.size = 'lg'
      // @ts-expect-error — 'plain' is not a member of 'solid'|'soft'|'ghost'
      el.variant = 'plain'
      // @ts-expect-error — a bare `string` is WIDER than the union: this proves the accessor is the
      // literal union and not `string` (if it were `string`, this assignment would be legal and the
      // directive would be unused → tsc would fail).
      el.variant = 'soft' as string
    }
    expect(typeof fn).toBe('function') // never invoked; the type errors above are the assertion
  })

  it('number|null is preserved (not widened, not dropped)', () => {
    const fn = () => {
      const el = new Demo()
      el.count = 5
      el.count = null // the `| null` half survives
      // @ts-expect-error — a string is not number|null
      el.count = 'nope'
    }
    expect(typeof fn).toBe('function')
  })

  it('json<T> preserves the structural shape', () => {
    const fn = () => {
      const el = new Demo()
      el.data = { items: [1, 2, 3] }
      const n: number[] = el.data.items // read-back keeps the typed shape
      void n
      // @ts-expect-error — wrong shape: `items` must be number[]
      el.data = { items: 'no' }
      // @ts-expect-error — missing required `items`
      el.data = {}
    }
    expect(typeof fn).toBe('function')
  })

  it('string and boolean accessors type plainly', () => {
    const fn = () => {
      const el = new Demo()
      el.label = 'ok'
      el.disabled = true
      // @ts-expect-error — boolean prop is not a string
      el.disabled = 'true'
    }
    expect(typeof fn).toBe('function')
  })

  it('the merged accessor types survive subclassing', () => {
    const fn = () => {
      const el = new SubDemo()
      el.variant = 'ghost'
      // @ts-expect-error — still the union after `extends`, not `string`
      el.variant = 'plain'
    }
    expect(typeof fn).toBe('function')
  })
})
