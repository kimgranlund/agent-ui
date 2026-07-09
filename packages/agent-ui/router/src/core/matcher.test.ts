import { describe, it, expect } from 'vitest'
import { compile, match } from './matcher.ts'
import type { RouteRecord } from './types.ts'

const el = () => document.createElement('div')
const route = (path: string): RouteRecord => ({ path, component: el })

describe('matcher — static/:param/trailing-* grammar (SPEC-R3)', () => {
  it('AC1: declaration-order first-match-wins, both directions', () => {
    const forward = compile([route('/items/new'), route('/items/:id')])
    expect(match(forward, '/items/new')?.record.path).toBe('/items/new')
    expect(match(forward, '/items/7')?.params.id).toBe('7')

    const reversed = compile([route('/items/:id'), route('/items/new')])
    const m = match(reversed, '/items/new')
    expect(m?.record.path).toBe('/items/:id')
    expect(m?.params.id).toBe('new')
  })

  it('AC2: a trailing * captures the remainder incl. embedded /', () => {
    const compiled = compile([route('/files/*')])
    expect(match(compiled, '/files/a/b.txt')?.params['*']).toBe('a/b.txt')
  })

  it('AC2: no match against a table without * yields null', () => {
    const compiled = compile([route('/a'), route('/b')])
    expect(match(compiled, '/nope')).toBeNull()
  })

  it('AC3: query is parsed onto the match and never participates in matching', () => {
    const compiled = compile([route('/a')])
    const m = match(compiled, '/a/?x=1&y=2')
    expect(m?.record.path).toBe('/a')
    expect(m?.query).toEqual({ x: '1', y: '2' })
  })

  it('trailing-slash normalization: /a/ ≡ /a; root / is unaffected', () => {
    const compiled = compile([route('/a')])
    expect(match(compiled, '/a/')?.path).toBe('/a')
    expect(match(compiled, '/a')?.path).toBe('/a')

    const root = compile([route('/')])
    expect(match(root, '/')?.path).toBe('/')
  })

  it('a static segment does not match a differing literal', () => {
    const compiled = compile([route('/settings')])
    expect(match(compiled, '/setting')).toBeNull()
    expect(match(compiled, '/settings/extra')).toBeNull()
  })

  it('a :param never captures empty (/items//x has no match)', () => {
    const compiled = compile([route('/items/:id/x')])
    expect(match(compiled, '/items//x')).toBeNull()
  })

  it('duplicate param names in one pattern: last-wins', () => {
    const compiled = compile([route('/:a/:a')])
    expect(match(compiled, '/first/second')?.params.a).toBe('second')
  })

  it('params are decodeURIComponent-ed once; a malformed escape falls back to the raw segment', () => {
    const compiled = compile([route('/tag/:name')])
    expect(match(compiled, '/tag/a%20b')?.params.name).toBe('a b')
    expect(match(compiled, '/tag/%E0%A4%A')?.params.name).toBe('%E0%A4%A') // malformed escape — raw fallback, no throw
  })

  it("'*' not in the last position throws at compile time (developer error, loud + early)", () => {
    expect(() => compile([route('/files/*/extra')])).toThrow()
  })

  it('compile snapshots the table — later mutation of the input array is inert', () => {
    const routes = [route('/a')]
    const compiled = compile(routes)
    routes.push(route('/b'))
    expect(match(compiled, '/b')).toBeNull()
  })

  it('no records → always null', () => {
    expect(match(compile([]), '/anything')).toBeNull()
  })
})
