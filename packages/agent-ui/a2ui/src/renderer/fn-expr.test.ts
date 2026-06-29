// fn-expr.test.ts — function-expression body parser (renderer ADR-0028, proof point 7).
//
// DoD proof points covered here (ADR-0028 §DoD / §Proof points — parser unit slice):
//   7a. No-arg call: `now()` → `{call:'now'}`.
//   7b. Single named arg: `fn(x:'val')` → `{call:'fn', args:{x:'val'}}`.
//   7c. Multi-arg: `fn(x:'a', y:'b')` → two entries in args.
//   7d. @-prefixed system name: `@index(offset:1)` → `{call:'@index', args:{offset:1}}`.
//   7e. Path arg (absolute): `fn(x:${/path})` → `{path:'/path'}`.
//   7f. Path arg (relative): `fn(x:${name})` → `{path:'name'}`.
//   7g. Boolean/number arg literals.
//   7h. Double-quote strings accepted (Fork 4).
//   7i. Nested call arg (recursive): `outer(x:${inner(y:'z')})` → nested `{call}`.
//   7j. Whitespace tolerance at every boundary.
//   7k. Positional arg → null (Fork 1).
//   7l. No '(' in body → null (not a function expression).
//   7m. Bare identifier arg value → null.
//   7n. Unbalanced parens → null.
//   7o. Trailing content after `)` → null.
//   7p. Nested positional (inner call positional arg) → null (propagates upward).
//   7q. Negative float number literal.
//   7r. Comma inside a quoted string arg is NOT a delimiter.

import { describe, it, expect } from 'vitest'
import { parseFunctionExpr } from './fn-expr.ts'

// ── 7a: no-arg call ────────────────────────────────────────────────────────────

describe('parseFunctionExpr — no-arg call (7a)', () => {
  it('now() → {call:"now"} with no args key', () => {
    expect(parseFunctionExpr('now()')).toEqual({ call: 'now' })
  })

  it('now() with surrounding whitespace → {call:"now"}', () => {
    expect(parseFunctionExpr('  now(  )  ')).toEqual({ call: 'now' })
  })
})

// ── 7b: single named arg ──────────────────────────────────────────────────────

describe('parseFunctionExpr — single named arg (7b)', () => {
  it("fn(x:'val') → {call:'fn', args:{x:'val'}}", () => {
    expect(parseFunctionExpr("fn(x:'val')")).toEqual({ call: 'fn', args: { x: 'val' } })
  })

  it('empty string arg value is preserved', () => {
    expect(parseFunctionExpr("fn(x:'')")).toEqual({ call: 'fn', args: { x: '' } })
  })
})

// ── 7c: multi-arg ─────────────────────────────────────────────────────────────

describe('parseFunctionExpr — multiple named args (7c)', () => {
  it("fn(x:'a', y:'b') → two entries in args", () => {
    expect(parseFunctionExpr("fn(x:'a', y:'b')")).toEqual({ call: 'fn', args: { x: 'a', y: 'b' } })
  })

  it('three args in order', () => {
    expect(parseFunctionExpr("f(a:'1', b:'2', c:'3')")).toEqual({
      call: 'f',
      args: { a: '1', b: '2', c: '3' },
    })
  })
})

// ── 7d: @-prefixed system name ────────────────────────────────────────────────

describe('parseFunctionExpr — @-prefixed name (7d)', () => {
  it('@index(offset:1) → {call:"@index", args:{offset:1}}', () => {
    expect(parseFunctionExpr('@index(offset:1)')).toEqual({ call: '@index', args: { offset: 1 } })
  })

  it('@index() with no args → {call:"@index"}', () => {
    expect(parseFunctionExpr('@index()')).toEqual({ call: '@index' })
  })
})

// ── 7e/7f: path args ──────────────────────────────────────────────────────────

describe('parseFunctionExpr — path arg bindings (7e/7f)', () => {
  it('absolute path ${/foo} → {path:"/foo"}', () => {
    expect(parseFunctionExpr('fn(x:${/foo})')).toEqual({ call: 'fn', args: { x: { path: '/foo' } } })
  })

  it('relative path ${name} → {path:"name"}', () => {
    expect(parseFunctionExpr('fn(x:${name})')).toEqual({ call: 'fn', args: { x: { path: 'name' } } })
  })

  it('nested path inside multi-segment pointer ${/items/0/label}', () => {
    expect(parseFunctionExpr('fn(v:${/items/0/label})')).toEqual({
      call: 'fn',
      args: { v: { path: '/items/0/label' } },
    })
  })
})

// ── 7g: boolean and number literals ──────────────────────────────────────────

describe('parseFunctionExpr — boolean and number literal args (7g)', () => {
  it('boolean true arg', () => {
    expect(parseFunctionExpr('fn(x:true)')).toEqual({ call: 'fn', args: { x: true } })
  })

  it('boolean false arg', () => {
    expect(parseFunctionExpr('fn(x:false)')).toEqual({ call: 'fn', args: { x: false } })
  })

  it('integer number arg', () => {
    expect(parseFunctionExpr('fn(x:42)')).toEqual({ call: 'fn', args: { x: 42 } })
  })

  it('negative integer arg (7q)', () => {
    expect(parseFunctionExpr('fn(x:-1)')).toEqual({ call: 'fn', args: { x: -1 } })
  })

  it('float arg (7q)', () => {
    expect(parseFunctionExpr('fn(x:3.14)')).toEqual({ call: 'fn', args: { x: 3.14 } })
  })

  it('negative float arg (7q)', () => {
    expect(parseFunctionExpr('fn(x:-0.5)')).toEqual({ call: 'fn', args: { x: -0.5 } })
  })
})

// ── 7h: double-quote string (Fork 4) ─────────────────────────────────────────

describe('parseFunctionExpr — double-quoted string args (Fork 4, 7h)', () => {
  it('double-quoted string → same string value as single-quoted', () => {
    expect(parseFunctionExpr('fn(x:"yyyy-MM-dd")')).toEqual({ call: 'fn', args: { x: 'yyyy-MM-dd' } })
  })

  it('mixed quote styles across args', () => {
    expect(parseFunctionExpr("fn(a:'single', b:\"double\")")).toEqual({
      call: 'fn',
      args: { a: 'single', b: 'double' },
    })
  })
})

// ── 7i: nested call arg (recursive) ──────────────────────────────────────────

describe('parseFunctionExpr — nested call arg (7i)', () => {
  it("outer(x:${inner(y:'z')}) → nested FunctionCall in args", () => {
    expect(parseFunctionExpr("outer(x:${inner(y:'z')})")).toEqual({
      call: 'outer',
      args: { x: { call: 'inner', args: { y: 'z' } } },
    })
  })

  it('formatDate with a path arg and a quoted format string', () => {
    expect(parseFunctionExpr('formatDate(value:${/currentDate}, format:"yyyy-MM-dd")')).toEqual({
      call: 'formatDate',
      args: { value: { path: '/currentDate' }, format: 'yyyy-MM-dd' },
    })
  })
})

// ── 7j: whitespace tolerance ──────────────────────────────────────────────────

describe('parseFunctionExpr — whitespace tolerance (7j)', () => {
  it('spaces around the call name', () => {
    expect(parseFunctionExpr('  fn  (  x  :  42  )  ')).toEqual({ call: 'fn', args: { x: 42 } })
  })

  it('spaces around comma separator', () => {
    expect(parseFunctionExpr("fn( a : 'v1' , b : 'v2' )")).toEqual({
      call: 'fn',
      args: { a: 'v1', b: 'v2' },
    })
  })
})

// ── 7k: positional arg → null (Fork 1) ───────────────────────────────────────
//
// Fork 1 / task #18: a call whose arg has NO `name:` prefix is positional (unnamed). The whole
// call returns null → the interpolate.ts classifier falls back to render-literally with zero errors.
// This includes: bare identifier, path `${…}`, or a nested call `${fn(…)}` without a name.
// `${upper(${now()})}` is the canonical spec example: `upper` takes the RESULT of `${now()}` as
// an unnamed positional arg — deferred until #18 adds the positional form to the grammar.

describe('parseFunctionExpr — positional arg returns null (Fork 1, 7k)', () => {
  it('fn(x) — positional bare identifier → null', () => {
    expect(parseFunctionExpr('fn(x)')).toBeNull()
  })

  it('fn(${/path}) — positional path arg → null', () => {
    expect(parseFunctionExpr('fn(${/path})')).toBeNull()
  })

  it('fn(42) — positional number literal → null', () => {
    expect(parseFunctionExpr('fn(42)')).toBeNull()
  })

  it('upper(${now()}) — positional nested-call arg (the canonical spec #18 example) → null', () => {
    // `${now()}` has no `name:` → positional. The outer call `upper` takes it as an unnamed arg.
    // Deferred to #18 (positional/unnamed-arg form). The whole expression returns null.
    expect(parseFunctionExpr('upper(${now()})')).toBeNull()
  })
})

// ── 7l: not a function expression ────────────────────────────────────────────

describe('parseFunctionExpr — no "(" → null (7l)', () => {
  it('bare identifier (no parens) → null', () => {
    expect(parseFunctionExpr('notACall')).toBeNull()
  })

  it('empty string → null', () => {
    expect(parseFunctionExpr('')).toBeNull()
  })

  it('path-style body with no ( → null', () => {
    expect(parseFunctionExpr('/some/path')).toBeNull()
  })
})

// ── 7m: bare identifier arg value → null ─────────────────────────────────────

describe('parseFunctionExpr — bare identifier arg value → null (7m)', () => {
  it('fn(x:bareIdent) — unquoted identifier value → null', () => {
    expect(parseFunctionExpr('fn(x:bareIdent)')).toBeNull()
  })

  it('fn(x:someVar) — must be ${someVar}, not bare → null', () => {
    expect(parseFunctionExpr('fn(x:someVar)')).toBeNull()
  })
})

// ── 7n: unbalanced parens → null ─────────────────────────────────────────────

describe('parseFunctionExpr — unbalanced parens → null (7n)', () => {
  it('missing closing ) → null', () => {
    expect(parseFunctionExpr("fn(x:'val'")).toBeNull()
  })

  it("unclosed quote inside arg → scanner never finds ) → null", () => {
    expect(parseFunctionExpr("fn(x:'unclosed)")).toBeNull()
  })
})

// ── 7o: trailing content → null ──────────────────────────────────────────────

describe('parseFunctionExpr — trailing content after ) → null (7o)', () => {
  it('fn() + extra → null', () => {
    expect(parseFunctionExpr('fn() + extra')).toBeNull()
  })

  it("fn(x:'v') suffix → null", () => {
    expect(parseFunctionExpr("fn(x:'v') suffix")).toBeNull()
  })
})

// ── 7p: nested positional propagates null ─────────────────────────────────────

describe('parseFunctionExpr — nested positional arg propagates null (7p)', () => {
  it('outer(x:${inner(pos)}) — inner has positional → outer also null', () => {
    // inner(pos) has positional arg → parseFunctionExpr('inner(pos)') = null
    // → parseValue returns null → outer parseFunctionExpr returns null
    expect(parseFunctionExpr('outer(x:${inner(pos)})')).toBeNull()
  })
})

// ── 7r: comma inside quoted string is not a delimiter ─────────────────────────

describe('parseFunctionExpr — comma inside quoted string is not a top-level delimiter (7r)', () => {
  it("fn(x:'hello, world') — comma inside single-quoted string stays one arg", () => {
    expect(parseFunctionExpr("fn(x:'hello, world')")).toEqual({ call: 'fn', args: { x: 'hello, world' } })
  })

  it('fn(x:"a,b,c") — commas inside double-quoted string stay one arg', () => {
    expect(parseFunctionExpr('fn(x:"a,b,c")')).toEqual({ call: 'fn', args: { x: 'a,b,c' } })
  })
})
