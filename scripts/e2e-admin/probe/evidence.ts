// scripts/e2e-admin/probe/evidence.ts: where the probe's screenshots go (T-0256). Screenshots are for testing and
// analysis, not record keeping, so they never enter the repo: they land in a user-scope cache folder and the
// run's `report.json` names each one by absolute path. One owner for that path.
import { homedir } from 'node:os'
import path from 'node:path'

/** `$AGENT_UI_EVIDENCE_DIR`, else `~/Library/Caches/agent-ui/evidence` on macOS, else `${XDG_CACHE_HOME:-~/.cache}/agent-ui/evidence`. */
export function evidenceRoot(env: NodeJS.ProcessEnv = process.env, platform: string = process.platform, home: string = homedir()): string {
  if (env.AGENT_UI_EVIDENCE_DIR) return path.resolve(env.AGENT_UI_EVIDENCE_DIR)
  if (platform === 'darwin') return path.join(home, 'Library', 'Caches', 'agent-ui', 'evidence')
  return path.join(env.XDG_CACHE_HOME || path.join(home, '.cache'), 'agent-ui', 'evidence')
}

/** The cache folder of one probe run: `<root>/<round>/<run>` for a run under `rounds/<round>/runs/<run>`, else `<root>/probe/<out folder name>`. */
export function evidenceDir(out: string, root: string = evidenceRoot()): string {
  const m = /(?:^|[\\/])rounds[\\/]([^\\/]+)[\\/]runs[\\/]([^\\/]+)[\\/]*$/.exec(out)
  return m ? path.join(root, m[1], m[2]) : path.join(root, 'probe', path.basename(path.resolve(out)))
}
