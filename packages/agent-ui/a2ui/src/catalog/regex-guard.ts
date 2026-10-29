// regex-guard.ts: the one bounded `regex` evaluation both catalog dialects share (`functions.ts`'s
// `{valid}` shape and `a2ui-basic/functions.ts`'s boolean shape). A `regex` check's pattern comes from
// the payload and runs against guest input on every keystroke, so its cost must stay bounded: a pattern
// over `MAX_PATTERN_LENGTH`, a value over `MAX_VALUE_LENGTH`, or a pattern that repeats a group which
// itself repeats without bound is refused before anything compiles. The structural rule is deliberately
// narrow (fixed counts such as `(\d{3}){2}` pass); the two length caps bound whatever it does not catch.

export const MAX_PATTERN_LENGTH = 256
export const MAX_VALUE_LENGTH = 1024

/** `'match'`/`'no-match'` for a pattern that ran; `'too-long'` for a value over the cap; `'refused'` for a
 *  pattern that did not compile or was refused by the rules above. Each dialect maps the last two onto its
 *  own invalid result. */
export type GuardedRegexResult = 'match' | 'no-match' | 'too-long' | 'refused'

/** True when `pattern` applies an unbounded quantifier (`*`, `+`, `{n,}`, `{n,m}` with m > 1) to a group
 *  whose body already holds one. A best-effort scan over the source: escapes and character classes are
 *  skipped, groups are tracked on a stack. */
export function hasNestedQuantifier(pattern: string): boolean {
  const stack: boolean[] = [] // per open group: does its body hold an unbounded quantifier?
  let i = 0
  const markInner = (): void => {
    if (stack.length > 0) stack[stack.length - 1] = true
  }
  while (i < pattern.length) {
    const c = pattern[i]
    if (c === '\\') {
      i += 2
      continue
    }
    if (c === '[') {
      i++
      while (i < pattern.length && pattern[i] !== ']') i += pattern[i] === '\\' ? 2 : 1
      i++
      continue
    }
    if (c === '(') {
      stack.push(false)
      i++
      continue
    }
    if (c === ')') {
      const inner = stack.pop() ?? false
      const quant = unboundedQuantifierAt(pattern, i + 1)
      if (inner && quant > 0) return true
      // A group that holds an unbounded quantifier, or is one, makes its parent hold one too.
      if (inner || quant > 0) markInner()
      i++
      continue
    }
    const quant = unboundedQuantifierAt(pattern, i)
    if (quant > 0) {
      markInner()
      i += quant
      continue
    }
    i++
  }
  return false
}

/** The length of an unbounded quantifier starting at `at`, or 0 when there is none. */
function unboundedQuantifierAt(pattern: string, at: number): number {
  const c = pattern[at]
  if (c === '*' || c === '+') return 1
  if (c !== '{') return 0
  const m = /^\{(\d+)(,(\d*))?\}/.exec(pattern.slice(at))
  if (m === null) return 0
  if (m[2] === undefined) return 0 // `{n}`: a fixed count
  if (m[3] === '' || Number(m[3]) > 1) return m[0].length
  return 0
}

/** Test `value` against `pattern` inside the caps above. */
export function guardedRegexTest(pattern: string, value: string): GuardedRegexResult {
  if (pattern.length > MAX_PATTERN_LENGTH || hasNestedQuantifier(pattern)) return 'refused'
  if (value.length > MAX_VALUE_LENGTH) return 'too-long'
  try {
    return new RegExp(pattern).test(value) ? 'match' : 'no-match'
  } catch {
    return 'refused'
  }
}
