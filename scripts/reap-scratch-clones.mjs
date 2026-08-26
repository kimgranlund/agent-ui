#!/usr/bin/env node
/**
 * scripts/reap-scratch-clones.mjs — gated reap of orphaned scratch-clone directories left by
 * `teamwork:dispatch-ticket`'s Agent-tool isolation rung (`references/isolation-ladder.md` Rung
 * 2) — a plain `git clone` cut by `dispatch_envelope.py` outside `.claude/worktrees/`, never
 * registered with `git worktree list`, so `reap-worktrees.mjs` structurally never sees it, and
 * never a local branch of THIS checkout, so `reap-branches.mjs` never sees it either (GH #1661:
 * a repo-cleaner sweep found 33 such directories, ~6.4G, 32 stale — manually verified and
 * `rm -rf`'d by the dispatching host; nothing automated that verification+removal going forward).
 *
 * Naming convention (read directly off the currently-installed `teamwork` plugin's
 * `scripts/dispatch_envelope.py`, `run()`): `<repo-name>-<ticket-id>`, optionally suffixed
 * `-<random>` (`tempfile.mkdtemp`'s own suffix shape) when the plain name was already occupied
 * by a foreign directory (ticket #784's occupancy fix) — e.g. `agent-ui-1600`,
 * `agent-ui-1600-3j6zz76s`. Two directories can legitimately share one ticket id (separate
 * aborted-and-retried dispatches); each is classified independently.
 *
 * Candidate discovery (ticket #1661's own Scope/Open item 1 — "no single hardcoded parent path
 * assumption"): `dispatch_envelope.py`'s own `resolve_dest_root` picks `--scratch-dir` (a
 * dispatcher-chosen path — seen so far as a session's own Claude Code scratchpad dir, shaped
 * `/tmp/claude-<uid>/<project-slug>/<session-id>/scratchpad`) over `$CLAUDE_SCRATCHPAD` over
 * `os.tmpdir()`. A past run's own choice can't be recovered after the fact, so this script scans
 * every root it plausibly could have been:
 *   - `os.tmpdir()` (Node's own default, matching Python's `tempfile.gettempdir()`)
 *   - `$TMPDIR` (POSIX convention — usually identical to the above, kept distinct in case a
 *     caller's shell diverges)
 *   - `$CLAUDE_SCRATCHPAD`, if set in THIS invocation's environment (best-effort only — a past
 *     session's own scratchpad path can't be recovered from a fresh shell that never set it)
 *   - every `scratchpad` directory found by a bounded, fixed-depth walk under `/tmp`: a
 *     `claude-<uid>` directory, two more wildcard levels (project slug, session id), then a
 *     literal `scratchpad` directory (the harness's own per-session scratchpad convention,
 *     literalized rather than derived — `os.tmpdir()` on macOS resolves to a per-process
 *     `$TMPDIR`, a DIFFERENT tree from this fixed `/tmp` one; unbounded recursion into `/tmp`
 *     itself is deliberately avoided — every OS process's own scratch/cache litter lives there
 *     too — hence this fixed 4-segment shape instead of an open-ended recursive scan)
 *   - any `--root <path>` given on the command line (repeatable) — the escape hatch for a
 *     convention this script doesn't already know about, rather than a future one requiring a
 *     code change here
 * Only IMMEDIATE children of a resolved root are matched against the naming pattern — never a
 * recursive scan of a root's full contents (the harness scratchpad walk above is the one
 * deliberate exception, itself fixed-depth and prefix-filtered, never unbounded).
 *
 * A candidate is only ever a real reap TARGET once it is verified to be a git working directory
 * whose `origin` remote URL exactly matches this repo's own — a same-named foreign directory is
 * never listed as reapable, only reported SKIP.
 *
 * REAPABLE (`--execute` removes it, plain `rm -rf` — these are never registered with `git
 * worktree list`, so there is no `git worktree remove`/`prune` step here) only when ALL hold:
 *
 *   (a) `git -C <clone> status --porcelain` is EMPTY — no dirty/untracked files (mirrors
 *       `reap-worktrees.mjs`'s own dirty guard: unfinished work is never touched, however old).
 *   (b) EITHER:
 *       - the clone's checked-out branch tip exactly matches a MERGED PR's `headRefOid` (the
 *         same GraphQL check `reap-worktrees.mjs`/`reap-branches.mjs` already use), OR
 *       - the branch's own ticket issue is independently confirmed CLOSED on GitHub, AND
 *         `git cherry origin/main <branch>` (freshly re-fetched — see below) shows no pending
 *         commit — the "closed, no fix warranted" path ticket #1661 itself names (4 of the 32
 *         confirmed-stale dirs carried no PR at all, only a closed-superseded/ruled issue), and
 *         it still refuses to delete a closed ticket's branch if that branch turns out to carry
 *         real unmerged work git can see (never a blind trust of "closed" alone).
 *
 * This script's own liveness signal — the worktree-lock analog ticket #1661's Scope/Open item 2
 * asks for, since a plain clone has no `git worktree lock` to check — is the ticket's OWN GitHub
 * state: an OPEN issue (assigned or not) is never proposed, matching dispatch-ticket's own
 * fail-closed posture ("never proposes removing a clone tied to a still-open, still-in-flight
 * ticket"); only a verified MERGED PR or a verified CLOSED issue clears the bar. A `gh` call that
 * errors, or a ticket id that doesn't resolve at all, KEEPS the candidate — never guessed. This
 * also transparently protects THIS script's own currently-running clone (its ticket is, by
 * construction, still OPEN and assigned) with no special-case code needed.
 *
 * The clone's own `origin/main` remote-tracking ref is deliberately RE-FETCHED (`git fetch
 * --depth 1 origin main`, read-only — no tree mutation) before the cherry-clean check, unlike
 * `reap-branches.mjs`'s explicit no-implicit-fetch policy: that policy exists because the
 * PRIMARY checkout's `origin/main` is kept reasonably fresh by ordinary use, so a stale read
 * there only ever errs toward keeping a branch. A one-off `--depth 1` scratch clone's own
 * `origin/main` is frozen at whatever it was the day `dispatch_envelope.py` cut it — often weeks
 * stale — and a cherry-clean check against a frozen ref would misjudge a since-merged branch as
 * still-pending. The fetch here is scoped to `main` only, `--depth 1`, and never touches the
 * clone's working tree or checked-out branch.
 *
 * Usage:
 *   npm run ops:reap-scratch-clones                 # dry-run (default): disposition table only
 *   node scripts/reap-scratch-clones.mjs             # same, direct
 *   node scripts/reap-scratch-clones.mjs --execute   # remove every REAP row
 *   node scripts/reap-scratch-clones.mjs --root <p>  # add an extra candidate root (repeatable)
 *   node scripts/reap-scratch-clones.mjs selftest    # prove the gate on fixtures, no network
 *
 * Exit codes:
 *   0  clean (dry-run printed, or every REAP removal succeeded; selftest passed)
 *   1  failure (a removal failed — e.g. permission denied, the exact #1583 held-item shape —
 *      git plumbing errored; selftest assertion bit)
 *   2  usage error (unknown argument, `--root` missing its value, `--dry`+`--execute` conflict);
 *      selftest mode: a required tool (git) is absent
 *
 * Verdict line shape: `reap-scratch-clones · <verdict> · N fail / M warn`
 * (warn = candidates left as KEEP — surviving toil, not an error).
 *
 * Wired into: `npm run ops:reap-scratch-clones` (dry-run by default; append `-- --execute`) and
 * `npm run check:scripts`'s selftest gate.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

const NAME = 'reap-scratch-clones';
const HARNESS_SCRATCHPAD_ROOT = '/tmp';

/* ── Plumbing (shared shape with reap-worktrees.mjs / reap-branches.mjs) ─── */

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trimEnd();
}

function gitOk(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status === 0) return true;
  if (r.status === 1) return false;
  throw new Error(`git ${args.join(' ')} failed (${r.status}): ${r.stderr}`);
}

function originUrl(cwd) {
  try { return git(cwd, 'remote', 'get-url', 'origin'); } catch { return null; }
}

function githubRepo(cwd) {
  const url = originUrl(cwd);
  if (!url) return null;
  const m = url.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

/** GraphQL PR check: does an exactly-matching (head OID) MERGED PR exist? Mirrors
 *  reap-worktrees.mjs/reap-branches.mjs's own helper verbatim. */
function mergedPr(gh, branch, tip) {
  if (!gh) return { merged: false, detail: 'no github origin — PR gate skipped' };
  if (!branch) return { merged: false, detail: 'detached HEAD — no branch to match against a PR' };
  const query = `query($owner:String!,$repo:String!,$branch:String!){
    repository(owner:$owner,name:$repo){
      pullRequests(headRefName:$branch,first:20){nodes{number state headRefOid}}
    }}`;
  const r = spawnSync('gh', ['api', 'graphql',
    '-f', `query=${query}`, '-f', `owner=${gh.owner}`, '-f', `repo=${gh.repo}`, '-f', `branch=${branch}`,
  ], { encoding: 'utf8' });
  if (r.status !== 0) return { merged: false, detail: 'gh unavailable — PR gate skipped' };
  let nodes;
  try { nodes = JSON.parse(r.stdout).data.repository.pullRequests.nodes; }
  catch { return { merged: false, detail: 'gh response unparseable — PR gate skipped' }; }
  const exact = nodes.find((n) => n.headRefOid === tip);
  if (exact && exact.state === 'MERGED') return { merged: true, detail: `PR #${exact.number} MERGED at this tip` };
  if (exact) return { merged: false, detail: `PR #${exact.number} is ${exact.state}` };
  if (nodes.length) return { merged: false, detail: `PR head OID ≠ clone tip (${nodes.map((n) => `#${n.number} ${n.state}`).join(', ')})` };
  return { merged: false, detail: 'no matching PR' };
}

/** `gh issue view <n> --json state,assignees` — null on ANY failure (no github origin, `gh`
 *  absent, network error, or the ticket id doesn't resolve to a real issue) so the caller fails
 *  closed rather than guesses. */
function issueState(gh, ticket) {
  if (!gh) return null;
  const r = spawnSync('gh', ['issue', 'view', ticket, '--repo', `${gh.owner}/${gh.repo}`,
    '--json', 'state,assignees'], { encoding: 'utf8' });
  if (r.status !== 0) return null;
  try {
    const parsed = JSON.parse(r.stdout);
    return { state: parsed.state, assignees: (parsed.assignees ?? []).map((a) => a.login) };
  } catch { return null; }
}

/** `git cherry origin/main <ref>` clean (no `+`-prefixed pending commit). Mirrors
 *  reap-worktrees.mjs/reap-branches.mjs's own helper verbatim. */
function cherryClean(cwd, ref, hasOriginMain) {
  if (!hasOriginMain) return { clean: false, detail: 'no origin/main — cherry check skipped' };
  const r = spawnSync('git', ['cherry', 'origin/main', ref], { cwd, encoding: 'utf8' });
  if (r.status !== 0) return { clean: false, detail: `git cherry failed: ${r.stderr.trim()}` };
  const lines = r.stdout.split('\n').filter(Boolean);
  const pending = lines.filter((l) => l.startsWith('+'));
  return pending.length === 0
    ? { clean: true, detail: `git cherry origin/main clean (${lines.length} commit(s) equivalent/none)` }
    : { clean: false, detail: `git cherry origin/main: ${pending.length} pending commit(s)` };
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ── Candidate discovery ──────────────────────────────────────── */

/** Immediate children of `root` matching `<repoName>-<digits>(-suffix)?`. Never recurses. */
function scanRoot(root, pattern) {
  const out = [];
  let entries;
  try { entries = readdirSync(root, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const m = e.name.match(pattern);
    if (m) out.push({ path: join(root, e.name), ticket: m[1] });
  }
  return out;
}

/** Fixed-depth (never recursive/unbounded) walk of the harness's own per-session scratchpad
 *  convention: under `/tmp`, a `claude-<uid>` dir, then two wildcard levels (project slug,
 *  session id), then a literal `scratchpad` dir. Each level is filtered by prefix/existence only
 *  — never a full-tree scan of `/tmp` itself (every OS process's own scratch/cache litter lives
 *  there too). */
function findHarnessScratchpadRoots(base) {
  const roots = [];
  let uidDirs;
  try { uidDirs = readdirSync(base, { withFileTypes: true }); } catch { return roots; }
  for (const uidDir of uidDirs) {
    if (!uidDir.isDirectory() || !uidDir.name.startsWith('claude-')) continue;
    const uidPath = join(base, uidDir.name);
    let projectDirs;
    try { projectDirs = readdirSync(uidPath, { withFileTypes: true }); } catch { continue; }
    for (const projectDir of projectDirs) {
      if (!projectDir.isDirectory()) continue;
      const projectPath = join(uidPath, projectDir.name);
      let sessionDirs;
      try { sessionDirs = readdirSync(projectPath, { withFileTypes: true }); } catch { continue; }
      for (const sessionDir of sessionDirs) {
        if (!sessionDir.isDirectory()) continue;
        const scratchpad = join(projectPath, sessionDir.name, 'scratchpad');
        if (existsSync(scratchpad)) roots.push(scratchpad);
      }
    }
  }
  return roots;
}

function discoverRoots(extraRoots, scratchpadBase) {
  const roots = new Set();
  roots.add(tmpdir());
  if (process.env.TMPDIR) roots.add(process.env.TMPDIR);
  if (process.env.CLAUDE_SCRATCHPAD) roots.add(process.env.CLAUDE_SCRATCHPAD);
  for (const r of findHarnessScratchpadRoots(scratchpadBase)) roots.add(r);
  for (const r of extraRoots) roots.add(r);
  return [...roots];
}

function findCandidates(roots, repoName) {
  const pattern = new RegExp(`^${escapeRegExp(repoName)}-(\\d+)(?:-[a-z0-9]+)?$`);
  const seen = new Set();
  const out = [];
  for (const root of roots) {
    for (const c of scanRoot(root, pattern)) {
      let real;
      try { real = realpathSync(c.path); } catch { continue; }
      if (seen.has(real)) continue;
      seen.add(real);
      out.push({ ...c, path: real });
    }
  }
  return out;
}

/* ── Disposition ──────────────────────────────────────────────── */

/** `deps` is injectable — real callers pass the impure `gh`/`git`-shelling helpers above
 *  (closed over the resolved repo context), `selftest` passes deterministic fixtures so the
 *  FULL classification matrix (dirty, merged, open-ticket, closed+clean, closed+unmerged,
 *  unknown-ticket, origin-mismatch) is provable with no network. */
function classifyCandidate(candidate, { mainOriginUrl, mergedPrFn, issueStateFn, hasOriginMainFn }) {
  const { path, ticket } = candidate;

  const candidateOrigin = originUrl(path);
  if (!candidateOrigin || candidateOrigin !== mainOriginUrl) {
    return { ...candidate, branch: null, disposition: 'SKIP', reason: 'not a clone of this repo (origin mismatch or unreadable)' };
  }

  const status = spawnSync('git', ['-C', path, 'status', '--porcelain'], { encoding: 'utf8' });
  if (status.status !== 0) {
    return { ...candidate, branch: null, disposition: 'KEEP(error)', reason: `git status failed: ${status.stderr.trim()}` };
  }
  if (status.stdout.trim().length > 0) {
    return { ...candidate, branch: null, disposition: 'KEEP(dirty)', reason: 'git status --porcelain is non-empty' };
  }

  let branch = '';
  try { branch = git(path, 'branch', '--show-current'); } catch { /* detached HEAD stays '' */ }
  let tip = null;
  try { tip = git(path, 'rev-parse', 'HEAD'); } catch { /* leave null */ }

  const pr = mergedPrFn(branch, tip);
  if (pr.merged) return { ...candidate, branch, disposition: 'REAP', reason: pr.detail };

  const issue = issueStateFn(ticket);
  if (!issue) {
    return { ...candidate, branch, disposition: 'KEEP(unknown)', reason: `ticket #${ticket} state unknown (no github origin, gh unavailable, or ticket not found) — never guessed` };
  }
  if (issue.state === 'OPEN') {
    const who = issue.assignees.length ? issue.assignees.join(',') : 'unassigned';
    return { ...candidate, branch, disposition: 'KEEP(open-ticket)', reason: `issue #${ticket} still OPEN (${who}) — not merged: ${pr.detail}` };
  }

  // CLOSED — re-fetch a fresh, shallow origin/main before trusting a cherry-clean read (see
  // header: a scratch clone's own origin/main is frozen at clone time, unlike the primary
  // checkout reap-branches.mjs/reap-worktrees.mjs read).
  spawnSync('git', ['-C', path, 'fetch', '--quiet', '--depth', '1', 'origin', 'main'], { encoding: 'utf8' });
  const hasOriginMain = hasOriginMainFn(path);
  const ref = branch ? `refs/heads/${branch}` : (tip ?? 'HEAD');
  const cherry = cherryClean(path, ref, hasOriginMain);
  if (cherry.clean) {
    return { ...candidate, branch, disposition: 'REAP', reason: `issue #${ticket} CLOSED + ${cherry.detail}` };
  }
  return { ...candidate, branch, disposition: 'KEEP(unmerged-on-closed-issue)', reason: `issue #${ticket} CLOSED but ${cherry.detail} — never delete unreviewed work` };
}

function realDeps(cwd) {
  const gh = githubRepo(cwd);
  return {
    mainOriginUrl: originUrl(cwd),
    mergedPrFn: (branch, tip) => mergedPr(gh, branch, tip),
    issueStateFn: (ticket) => issueState(gh, ticket),
    hasOriginMainFn: (candidatePath) => gitOk(candidatePath, 'rev-parse', '--verify', '--quiet', 'refs/remotes/origin/main'),
  };
}

function classify(cwd, extraRoots) {
  const gh = githubRepo(cwd);
  const repoName = gh ? gh.repo : basename(git(cwd, 'rev-parse', '--show-toplevel'));
  const roots = discoverRoots(extraRoots, HARNESS_SCRATCHPAD_ROOT);
  const candidates = findCandidates(roots, repoName);
  const deps = realDeps(cwd);
  return candidates.map((c) => classifyCandidate(c, deps));
}

function printTable(rows) {
  if (!rows.length) { console.log('(no scratch-clone directories found)'); return; }
  const w = Math.max(...rows.map((r) => r.path.length), 6);
  for (const r of rows) {
    console.log(`  ${r.path.padEnd(w)}  ${(r.branch || '(n/a)').padEnd(24)}  ${r.disposition.padEnd(26)}  ${r.reason}`);
  }
}

function run(execute, extraRoots) {
  const cwd = process.cwd();
  const rows = classify(cwd, extraRoots);
  console.log(`# ${NAME} — ${execute ? 'EXECUTE' : 'dry-run'} (repo: ${git(cwd, 'rev-parse', '--show-toplevel')})`);
  printTable(rows);

  let fail = 0;
  const reap = rows.filter((r) => r.disposition === 'REAP');
  const warn = rows.filter((r) => r.disposition.startsWith('KEEP')).length;

  if (execute) {
    for (const r of reap) {
      try {
        rmSync(r.path, { recursive: true, force: true });
        console.log(`  removed ${r.path}`);
      } catch (err) {
        console.log(`  FAILED to remove ${r.path}: ${err.message}`);
        fail++;
      }
    }
  } else if (reap.length) {
    console.log(`  (${reap.length} REAP row(s) — re-run with --execute to remove)`);
  }

  const verdict = fail ? 'fail' : 'ok';
  console.log(`${NAME} · ${verdict} · ${fail} fail / ${warn} warn`);
  return fail ? 1 : 0;
}

/* ── Selftest ─────────────────────────────────────────────────── */

function selftest() {
  for (const tool of ['git']) {
    if (spawnSync(tool, ['--version']).status !== 0) {
      console.log(`${NAME} · skip · ${tool} not available — install ${tool} to run the selftest`);
      return 2;
    }
  }

  const failures = [];
  const assert = (cond, msg) => { if (!cond) failures.push(msg); console.log(`  ${cond ? 'ok ' : 'FAIL'} ${msg}`); };

  /* ── Discovery: pure filesystem fixtures, no git involved ── */
  const discRoot = mkdtempSync(join(tmpdir(), 'reap-scratch-clones-disc-'));
  // direct-under-root matches, incl. the ticket-shared-suffix shape, plus negative controls.
  for (const name of ['fixture-repo-100', 'fixture-repo-200-3j6zz76s', 'fixture-repo-200-inpfobq0', 'fixture-repo-abc', 'fixture-repo-', 'unrelated-dir']) {
    try {
      spawnSync('mkdir', ['-p', join(discRoot, name)]);
    } catch { /* ignore */ }
  }
  spawnSync('touch', [join(discRoot, 'fixture-repo-999')]); // a FILE, not a dir — must be ignored

  const roots1 = discoverRoots([discRoot], join(discRoot, 'no-such-harness-base'));
  const found1 = findCandidates(roots1, 'fixture-repo');
  const paths1 = found1.map((c) => c.path).sort();
  assert(paths1.includes(realpathSync(join(discRoot, 'fixture-repo-100'))), 'discovery: plain <repo>-<ticket> matched');
  assert(paths1.includes(realpathSync(join(discRoot, 'fixture-repo-200-3j6zz76s'))), 'discovery: suffixed variant 1 matched');
  assert(paths1.includes(realpathSync(join(discRoot, 'fixture-repo-200-inpfobq0'))), 'discovery: suffixed variant 2 (same ticket, second clone) matched');
  assert(!paths1.some((p) => p.endsWith('fixture-repo-abc')), 'discovery: non-numeric suffix rejected');
  assert(!paths1.some((p) => p.endsWith('fixture-repo-')), 'discovery: bare prefix with no ticket rejected');
  assert(!paths1.some((p) => p.endsWith('unrelated-dir')), 'discovery: unrelated directory name rejected');
  assert(!paths1.some((p) => p.endsWith('fixture-repo-999')), 'discovery: a FILE matching the name pattern is never a candidate');
  const t200 = found1.filter((c) => c.ticket === '200');
  assert(t200.length === 2, `discovery: two directories share ticket 200, both listed independently (got ${t200.length})`);

  // dedup: the same root passed twice (once as tmpdir-equivalent via --root, once again)
  // never double-lists a candidate.
  const roots2 = discoverRoots([discRoot, discRoot], join(discRoot, 'no-such-harness-base'));
  const found2 = findCandidates(roots2, 'fixture-repo');
  assert(found2.length === found1.length, `discovery: passing the same root twice does not duplicate candidates (${found2.length} vs ${found1.length})`);

  // the bounded harness-scratchpad walk: /base/claude-501/<project>/<session>/scratchpad/<clone>
  const harnessBase = join(discRoot, 'harness-base');
  const scratchpadDir = join(harnessBase, 'claude-501', 'proj-slug', 'session-id', 'scratchpad');
  spawnSync('mkdir', ['-p', join(scratchpadDir, 'fixture-repo-300')]);
  spawnSync('mkdir', ['-p', join(harnessBase, 'not-claude-prefixed', 'x', 'y', 'scratchpad', 'fixture-repo-400')]);
  const roots3 = discoverRoots([], harnessBase);
  const found3 = findCandidates(roots3, 'fixture-repo');
  assert(found3.some((c) => c.path.endsWith('fixture-repo-300')), 'discovery: bounded harness-scratchpad walk finds a nested scratch clone');
  assert(!found3.some((c) => c.path.endsWith('fixture-repo-400')), 'discovery: a uid dir not prefixed claude- is never walked');

  rmSync(discRoot, { recursive: true, force: true });

  /* ── Classification: real local git fixtures (file:// origin, no network) ── */
  const scratch = mkdtempSync(join(tmpdir(), 'reap-scratch-clones-selftest-'));
  const bare = join(scratch, 'origin.git');
  const clonesRoot = join(scratch, 'clones');

  const makeClone = (name, { branch, dirty, extraCommitNotInMain } = {}) => {
    const dest = join(clonesRoot, name);
    git(scratch, 'clone', bare, dest);
    if (branch) git(dest, 'checkout', '-b', branch);
    if (extraCommitNotInMain) {
      writeFileSync(join(dest, `${name}.txt`), 'work\n');
      git(dest, 'add', '.');
      git(dest, 'commit', '-m', `${name} work`);
    }
    if (dirty) writeFileSync(join(dest, 'untracked.txt'), 'dirty\n');
    return dest;
  };

  try {
    git(scratch, 'init', '--bare', '-b', 'main', bare);
    const seed = join(scratch, 'seed');
    git(scratch, 'clone', bare, seed);
    git(seed, 'config', 'user.email', 'selftest@example.com');
    git(seed, 'config', 'user.name', 'selftest');
    writeFileSync(join(seed, 'a.txt'), 'base\n');
    git(seed, 'add', '.'); git(seed, 'commit', '-m', 'base');
    git(seed, 'push', 'origin', 'main');

    // Named to match the CLI's own repo-name pattern (`seed-<ticket>` — `cliCwd` below is the
    // `seed` checkout) so the end-to-end --root discovery test picks it up like a real candidate.
    const dirtyClone = makeClone('seed-9006', { branch: '9006-x', dirty: true });
    for (const c of [dirtyClone]) {
      git(c, 'config', 'user.email', 'selftest@example.com');
      git(c, 'config', 'user.name', 'selftest');
    }

    const mergedClone = makeClone('merged-clone', { branch: 'merged-branch-fixture', extraCommitNotInMain: true });
    git(mergedClone, 'config', 'user.email', 'selftest@example.com');
    git(mergedClone, 'config', 'user.name', 'selftest');

    const openClone = makeClone('open-clone', { branch: '9003-x' });
    git(openClone, 'config', 'user.email', 'selftest@example.com');
    git(openClone, 'config', 'user.name', 'selftest');

    const closedCleanClone = makeClone('closed-clean-clone', { branch: '9001-x' }); // zero unique commits
    git(closedCleanClone, 'config', 'user.email', 'selftest@example.com');
    git(closedCleanClone, 'config', 'user.name', 'selftest');

    const closedUnmergedClone = makeClone('closed-unmerged-clone', { branch: '9002-x', extraCommitNotInMain: true });
    git(closedUnmergedClone, 'config', 'user.email', 'selftest@example.com');
    git(closedUnmergedClone, 'config', 'user.name', 'selftest');

    const unknownTicketClone = makeClone('unknown-ticket-clone', { branch: '9005-x' });
    git(unknownTicketClone, 'config', 'user.email', 'selftest@example.com');
    git(unknownTicketClone, 'config', 'user.name', 'selftest');

    // origin-mismatch fixture: a real git repo, but its origin points somewhere else entirely.
    const foreignBare = join(scratch, 'foreign.git');
    git(scratch, 'init', '--bare', '-b', 'main', foreignBare);
    const foreignClone = join(clonesRoot, 'fixture-repo-500');
    git(scratch, 'clone', foreignBare, foreignClone);

    const mainOriginUrl = bare; // this scratch fixture's own "repo" is the `bare` path itself
    const issueMap = new Map([
      ['9001', { state: 'CLOSED', assignees: [] }],
      ['9002', { state: 'CLOSED', assignees: [] }],
      ['9003', { state: 'OPEN', assignees: ['kimgranlund'] }],
      // 9004 (merged) and 9005 (unknown) deliberately absent/handled below.
      ['9006', { state: 'OPEN', assignees: [] }],
    ]);
    const fakeDeps = {
      mainOriginUrl,
      mergedPrFn: (branch) => branch === 'merged-branch-fixture'
        ? { merged: true, detail: 'PR #42 MERGED at this tip (fixture)' }
        : { merged: false, detail: 'no matching PR (fixture)' },
      issueStateFn: (ticket) => issueMap.has(ticket) ? issueMap.get(ticket) : null,
      hasOriginMainFn: (p) => gitOk(p, 'rev-parse', '--verify', '--quiet', 'refs/remotes/origin/main'),
    };

    const classifyFixture = (path, ticket) => classifyCandidate({ path, ticket }, fakeDeps);

    const rDirty = classifyFixture(dirtyClone, '9006');
    assert(rDirty.disposition === 'KEEP(dirty)', `classify: dirty clone → KEEP(dirty) (got ${rDirty.disposition})`);

    const rMerged = classifyFixture(mergedClone, '9004');
    assert(rMerged.disposition === 'REAP', `classify: merged-PR branch → REAP (got ${rMerged.disposition}: ${rMerged.reason})`);

    const rOpen = classifyFixture(openClone, '9003');
    assert(rOpen.disposition === 'KEEP(open-ticket)', `classify: OPEN ticket → KEEP(open-ticket) (got ${rOpen.disposition})`);

    const rClosedClean = classifyFixture(closedCleanClone, '9001');
    assert(rClosedClean.disposition === 'REAP', `classify: CLOSED ticket + cherry-clean → REAP (got ${rClosedClean.disposition}: ${rClosedClean.reason})`);

    const rClosedUnmerged = classifyFixture(closedUnmergedClone, '9002');
    assert(rClosedUnmerged.disposition === 'KEEP(unmerged-on-closed-issue)', `classify: CLOSED ticket but real unmerged commit → KEEP(unmerged-on-closed-issue) (got ${rClosedUnmerged.disposition})`);

    const rUnknown = classifyFixture(unknownTicketClone, '9005');
    assert(rUnknown.disposition === 'KEEP(unknown)', `classify: ticket lookup fails → KEEP(unknown), never guessed (got ${rUnknown.disposition})`);

    const rForeign = classifyFixture(foreignClone, '500');
    assert(rForeign.disposition === 'SKIP', `classify: origin URL mismatch → SKIP, never a reap target (got ${rForeign.disposition})`);

    // negative control: --execute never removes a KEEP/SKIP row.
    const rowsAll = [rDirty, rMerged, rOpen, rClosedClean, rClosedUnmerged, rUnknown, rForeign];
    const reapPaths = rowsAll.filter((r) => r.disposition === 'REAP').map((r) => r.path);
    assert(reapPaths.length === 2 && reapPaths.includes(mergedClone) && reapPaths.includes(closedCleanClone),
      `classify: exactly the two provably-safe clones are REAP (got ${JSON.stringify(reapPaths)})`);

    /* ── End-to-end CLI contract (usage errors, --root plumbing) ── */
    const cliCwd = seed; // a real repo; its origin is local (non-github), so gh/network paths
                          // short-circuit to KEEP(unknown) — this only proves the CLI/discovery
                          // wiring and dirty/origin-mismatch gates, not the gh-dependent paths
                          // already proven directly above.
    const invoke = (...args) => spawnSync(process.execPath, [process.argv[1], ...args], { cwd: cliCwd, encoding: 'utf8' });

    const usage = invoke('--bogus-flag');
    assert(usage.status === 2, `CLI: unknown flag exits 2 (got ${usage.status})`);

    const conflict = invoke('--dry', '--execute');
    assert(conflict.status === 2, `CLI: --dry + --execute conflict exits 2 (got ${conflict.status})`);

    const missingRootValue = invoke('--root');
    assert(missingRootValue.status === 2, `CLI: --root with no value exits 2 (got ${missingRootValue.status})`);

    const viaRoot = invoke('--root', clonesRoot);
    assert(viaRoot.status === 0, `CLI: dry-run via --root exits 0 (got ${viaRoot.status})`);
    assert(viaRoot.stdout.includes('seed-9006'), 'CLI: --root surfaces a real candidate directory in the dry-run table');
    assert(/seed-9006\s+\S+\s+KEEP\(dirty\)/.test(viaRoot.stdout.replace(/\s+/g, ' ')), 'CLI: dry-run table shows the dirty clone as KEEP(dirty) end-to-end');
    assert(!viaRoot.stdout.includes('removed '), 'CLI: dry-run (no --execute) removes nothing');
    assert(existsSync(dirtyClone), 'CLI: dry-run left the dirty clone on disk');
  } catch (err) {
    failures.push(`selftest scaffolding threw: ${err.message}`);
    console.log(`  FAIL scaffolding: ${err.message}`);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }

  console.log(`${NAME} · ${failures.length ? 'fail' : 'ok'} · ${failures.length} fail / 0 warn`);
  return failures.length ? 1 : 0;
}

/* ── Entry ────────────────────────────────────────────────────── */

const args = process.argv.slice(2);
if (args.includes('selftest')) process.exit(selftest());

const extraRoots = [];
const rest = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--root') {
    if (i + 1 >= args.length) { console.error('--root requires a value'); process.exit(2); }
    extraRoots.push(args[++i]);
  } else {
    rest.push(args[i]);
  }
}

const known = new Set(['--dry', '--execute']);
const unknown = rest.filter((a) => !known.has(a));
if (unknown.length) {
  console.error(`Unknown argument(s): ${unknown.join(' ')}\n`);
  console.error('Usage: node scripts/reap-scratch-clones.mjs [--dry|--execute|--root <path>|selftest]');
  process.exit(2);
}
if (rest.includes('--dry') && rest.includes('--execute')) {
  console.error('--dry and --execute are mutually exclusive');
  process.exit(2);
}
process.exit(run(rest.includes('--execute'), extraRoots));
