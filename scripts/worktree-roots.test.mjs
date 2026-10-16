// worktree-roots.test.mjs (T-0288): the lane-location check behind the vitest worker cap and the reap
// scripts recognizes both worktree roots and not the primary checkout.
import { describe, it, expect } from 'vitest'
import { inLaneWorktree, laneRoots, underLaneRoot } from './lib/worktree-roots.mjs'

describe('inLaneWorktree', () => {
  it('matches a lane under the legacy .claude/worktrees root', () => {
    expect(inLaneWorktree('/Users/k/Projects/agent-ui/.claude/worktrees/agent-abc')).toBe(true)
  })
  it('matches a lane under the sibling <repo>.worktrees root', () => {
    expect(inLaneWorktree('/Users/k/Projects/agent-ui.worktrees/wave-wr')).toBe(true)
    expect(inLaneWorktree('/Users/k/Projects/agent-ui.worktrees/wave-wr/packages/x')).toBe(true)
  })
  it('does not match the primary checkout or the bare root dir', () => {
    expect(inLaneWorktree('/Users/k/Projects/agent-ui')).toBe(false)
    expect(inLaneWorktree('/Users/k/Projects/agent-ui/packages/agent-ui/components')).toBe(false)
    expect(inLaneWorktree('/Users/k/Projects/agent-ui.worktrees')).toBe(false)
  })
})

describe('laneRoots / underLaneRoot', () => {
  const root = '/Users/k/Projects/agent-ui'
  it('lists the legacy root then the sibling root', () => {
    expect(laneRoots(root)).toEqual([`${root}/.claude/worktrees`, `${root}.worktrees`])
  })
  it('accepts a path strictly under either root, never the checkout or a root itself', () => {
    expect(underLaneRoot(`${root}/.claude/worktrees/a`, root)).toBe(true)
    expect(underLaneRoot(`${root}.worktrees/a`, root)).toBe(true)
    expect(underLaneRoot(root, root)).toBe(false)
    expect(underLaneRoot(`${root}.worktrees`, root)).toBe(false)
    expect(underLaneRoot(`${root}-other.worktrees/a`, root)).toBe(false)
  })
})
