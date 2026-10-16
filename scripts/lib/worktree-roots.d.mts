/** Type surface for the TS readers of worktree-roots.mjs (the foundations-rules.d.mts precedent): the vitest
 *  configs' lane worker cap (T-0288). */
export const LEGACY_ROOT_SEGMENT: string
export function laneRoots(repoRoot: string): string[]
export function underLaneRoot(path: string, repoRoot: string): boolean
export function inLaneWorktree(cwd: string): boolean
