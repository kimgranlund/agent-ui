// The two places an agent lane worktree can live (T-0288): the legacy in-repo `.claude/worktrees/` and
// sdlc-lite 0.24's sibling `../<repo>.worktrees/` (`wtroot.py root`). The vitest worker caps and the three
// reap scripts all key off this one module, so a third location is one edit here.
import { basename, dirname, join, sep } from 'node:path'

export const LEGACY_ROOT_SEGMENT = '/.claude/worktrees/'
const SIBLING_ROOT_SEGMENT = /\/[^/]+\.worktrees\//

/** The absolute lane roots for a main checkout: legacy first, then the sibling `<repo>.worktrees`. */
export function laneRoots(repoRoot) {
  return [join(repoRoot, '.claude', 'worktrees'), join(dirname(repoRoot), `${basename(repoRoot)}.worktrees`)]
}

/** True when `path` sits strictly under one of `laneRoots(repoRoot)`. */
export function underLaneRoot(path, repoRoot) {
  return laneRoots(repoRoot).some((root) => (path + sep).startsWith(root + sep) && path + sep !== root + sep)
}

/** True when `cwd` is inside an agent lane, by path shape alone (no repo root needed): vitest's worker cap. */
export function inLaneWorktree(cwd) {
  const p = cwd.split(sep).join('/')
  return p.includes(LEGACY_ROOT_SEGMENT) || SIBLING_ROOT_SEGMENT.test(p)
}
