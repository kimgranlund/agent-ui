// T-0256: the screenshot cache path has one owner; a probe run's PNGs never land in the repo.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { evidenceDir, evidenceRoot } from './evidence.ts'

describe('evidenceRoot', () => {
  it('prefers AGENT_UI_EVIDENCE_DIR', () => {
    expect(evidenceRoot({ AGENT_UI_EVIDENCE_DIR: '/tmp/ev' }, 'darwin', '/home/k')).toBe('/tmp/ev')
  })
  it('uses the macOS cache on darwin', () => {
    expect(evidenceRoot({}, 'darwin', '/Users/k')).toBe('/Users/k/Library/Caches/agent-ui/evidence')
  })
  it('uses XDG_CACHE_HOME, else ~/.cache, elsewhere', () => {
    expect(evidenceRoot({ XDG_CACHE_HOME: '/x' }, 'linux', '/home/k')).toBe('/x/agent-ui/evidence')
    expect(evidenceRoot({}, 'linux', '/home/k')).toBe('/home/k/.cache/agent-ui/evidence')
  })
})

describe('evidenceDir', () => {
  it('maps a round run to <root>/<round>/<run>', () => {
    expect(evidenceDir('/r/.sdlc/evals/rounds/2026-10-14-x/runs/croupier-deal-haiku-1', '/c')).toBe('/c/2026-10-14-x/croupier-deal-haiku-1')
    expect(evidenceDir('.sdlc/evals/rounds/2026-10-14-x/runs/a/', '/c')).toBe('/c/2026-10-14-x/a')
  })
  it('maps any other out folder to <root>/probe/<name>', () => {
    expect(evidenceDir('/r/.agent-traces/probe/deal-123', '/c')).toBe(path.join('/c', 'probe', 'deal-123'))
  })
})
