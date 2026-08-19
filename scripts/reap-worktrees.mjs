#!/usr/bin/env node
/**
 * scripts/reap-worktrees.mjs — gated reap of provably-finished `.claude/worktrees/` entries.
 * Sibling of `scripts/reap-branches.mjs` (same propose-by-default / `--execute` shape, the same
 * exit contract, the same selftest discipline) — GH #1440, the load-108 incident (2026-08-19/20):
 * 14 finished lane worktrees sat parked until campaign-end, each a full tree Spotlight kept
 * re-indexing on every sibling's install. Kim ruled (2026-08-20): reap on lane-return, not
 * campaign-end. `reap-branches.mjs` deliberately never removes worktree DIRECTORIES (only the
 * branch); this script is the missing other half.
 *
 * A worktree is REAPABLE (`--execute` removes it) only when ALL THREE hold:
 *
 *   (a) `git -C <worktree> status --porcelain` is EMPTY — no dirty/untracked files. An
 *       unfinished lane is never touched, however old.
 *   (b) its checked-out branch is provably disposed of, per `reap-branches.mjs`'s own RULE 1:
 *       either a remote PR headRefOid-matches this branch's tip and that PR is MERGED, or
 *       `git cherry origin/main <branch>` prints no `+`-prefixed line (every commit already
 *       upstream, or absent entirely — this is what catches a squash-merge, since a squash
 *       produces a new SHA with no ancestry link back to the branch tip). A detached-HEAD
 *       worktree has no branch to verify disposal against, so it is always kept.
 *   (c) the worktree is NOT `locked` (a live Agent-tool process holds the lock — the
 *       lane-kill incident class this script must never repeat).
 *
 * Only entries physically under `<repo-root>/.claude/worktrees/` are ever candidates — the
 * main checkout (and any worktree registered elsewhere) is never touched, never even listed.
 *
 * Refuses to run at all (exit 2) when `.claude/worktrees/.metadata_never_index` is missing —
 * that marker keeps Spotlight/Time Machine from re-indexing every live lane tree across
 * machines, and a reap cycle silently proceeding without it would defeat its own purpose.
 *
 * On `--execute`: REAP rows get `git worktree remove <path>`, then one `git worktree prune`
 * once every removal has been attempted. Branch deletion stays `reap-branches.mjs`'s job —
 * chain them: `node scripts/reap-worktrees.mjs --execute && node scripts/reap-branches.mjs --execute`.
 *
 * Usage:
 *   npm run ops:reap-worktrees                # dry-run (default): disposition table only
 *   node scripts/reap-worktrees.mjs           # same, direct
 *   node scripts/reap-worktrees.mjs --execute  # remove every REAP row, then prune
 *   node scripts/reap-worktrees.mjs selftest   # prove the gate on a scratch repo + fixtures
 *
 * Exit codes:
 *   0  clean (dry-run printed, or every REAP removal succeeded; selftest passed)
 *   1  failure (a `git worktree remove` failed, git plumbing errored; selftest assertion bit)
 *   2  usage error (unknown argument); `.metadata_never_index` marker missing (refusal to run);
 *      selftest mode: a required tool (git) is absent
 *
 * Verdict line shape: `reap-worktrees · <verdict> · N fail / M warn`
 * (warn = worktrees left as KEEP — surviving toil, not an error).
 *
 * Wired into: `npm run ops:reap-worktrees` (dry-run by default; append `-- --execute`) and
 * `npm run check:scripts`'s selftest gate.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';

const NAME = 'reap-worktrees';

/* ── Plumbing ─────────────────────────────────────────────────── */

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trimEnd();
}

/** Boolean-shaped git call: exit 0 → true, exit 1 → false, else throw. */
function gitOk(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status === 0) return true;
  if (r.status === 1) return false;
  throw new Error(`git ${args.join(' ')} failed (${r.status}): ${r.stderr}`);
}

/** Owner/repo from the origin URL, or null when origin is not on github.com
 *  (local-path origins — e.g. the selftest scratch repo — skip the PR gate). */
function githubRepo(cwd) {
  let url;
  try { url = git(cwd, 'remote', 'get-url', 'origin'); } catch { return null; }
  const m = url.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

/** GraphQL PR check: does an exactly-matching (head OID) MERGED PR exist?
 *  Mirrors reap-branches.mjs's own helper — gh absence/failure keeps the worktree. */
function mergedPr(gh, branch, tip) {
  if (!gh) return { merged: false, detail: 'no github origin — PR gate skipped' };
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
  if (nodes.length) return { merged: false, detail: `PR head OID ≠ worktree tip (${nodes.map((n) => `#${n.number} ${n.state}`).join(', ')})` };
  return { merged: false, detail: 'no matching PR' };
}

/** `git cherry origin/main <ref>` clean (no `+`-prefixed pending commit). Takes the
 *  fully-qualified `refs/heads/<branch>` ref — a same-name TAG would otherwise shadow it. */
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

/** The main checkout root, resolved from ANY worktree via the shared common git dir —
 *  `.claude/worktrees/` physically lives once, under that root, regardless of which
 *  worktree this script itself happens to be invoked from. */
function repoRoot(cwd) {
  const commonDir = git(cwd, 'rev-parse', '--git-common-dir');
  const abs = resolve(cwd, commonDir);
  return dirname(abs); // `--git-common-dir` always resolves to the shared `<root>/.git`
}

/** Parse `git worktree list --porcelain` into structured entries. */
function listWorktrees(cwd) {
  const out = git(cwd, 'worktree', 'list', '--porcelain');
  const entries = [];
  let cur = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('worktree ')) {
      cur = { path: line.slice('worktree '.length), head: null, branch: null, locked: false, prunable: false };
      entries.push(cur);
    } else if (!cur) {
      continue;
    } else if (line.startsWith('HEAD ')) {
      cur.head = line.slice('HEAD '.length);
    } else if (line.startsWith('branch refs/heads/')) {
      cur.branch = line.slice('branch refs/heads/'.length);
    } else if (line === 'locked' || line.startsWith('locked ')) {
      cur.locked = true;
    } else if (line === 'prunable' || line.startsWith('prunable ')) {
      cur.prunable = true;
    }
  }
  return entries;
}

/* ── Disposition ──────────────────────────────────────────────── */

function classify(cwd) {
  const root = repoRoot(cwd);
  const worktreesDir = join(root, '.claude', 'worktrees') + sep;
  const gh = githubRepo(cwd);
  const hasOriginMain = gitOk(cwd, 'rev-parse', '--verify', '--quiet', 'refs/remotes/origin/main');

  const all = listWorktrees(cwd);
  const rows = [];
  for (const wt of all) {
    // Never the main checkout, never anything outside `.claude/worktrees/`.
    if (!(wt.path + sep).startsWith(worktreesDir)) continue;

    if (wt.prunable) {
      rows.push({ path: wt.path, branch: wt.branch, disposition: 'PRUNABLE', reason: 'git already reports this entry as prunable — run `git worktree prune`' });
      continue;
    }

    if (wt.locked) {
      rows.push({ path: wt.path, branch: wt.branch, disposition: 'KEEP(locked)', reason: 'worktree is locked (a live process may hold it)' });
      continue;
    }

    const status = spawnSync('git', ['-C', wt.path, 'status', '--porcelain'], { encoding: 'utf8' });
    if (status.status !== 0) {
      rows.push({ path: wt.path, branch: wt.branch, disposition: 'KEEP(dirty)', reason: `git status failed: ${status.stderr.trim()}` });
      continue;
    }
    if (status.stdout.trim().length > 0) {
      rows.push({ path: wt.path, branch: wt.branch, disposition: 'KEEP(dirty)', reason: 'git status --porcelain is non-empty' });
      continue;
    }

    if (!wt.branch) {
      rows.push({ path: wt.path, branch: null, disposition: 'KEEP(live-branch)', reason: 'detached HEAD — no branch to verify disposal against' });
      continue;
    }

    const ref = `refs/heads/${wt.branch}`;
    const pr = mergedPr(gh, wt.branch, wt.head);
    const cherry = cherryClean(cwd, ref, hasOriginMain);
    const disposed = pr.merged || cherry.clean;
    const detail = pr.merged ? pr.detail : cherry.clean ? cherry.detail : `not merged: ${pr.detail}; ${cherry.detail}`;

    rows.push(disposed
      ? { path: wt.path, branch: wt.branch, disposition: 'REAP', reason: detail }
      : { path: wt.path, branch: wt.branch, disposition: 'KEEP(live-branch)', reason: detail });
  }
  return rows;
}

function printTable(rows) {
  if (!rows.length) { console.log('(no worktrees under .claude/worktrees/)'); return; }
  const w = Math.max(...rows.map((r) => r.path.length), 6);
  for (const r of rows) {
    console.log(`  ${r.path.padEnd(w)}  ${(r.branch ?? '(detached)').padEnd(24)}  ${r.disposition.padEnd(16)}  ${r.reason}`);
  }
}

/** Refuses to run (exit 2) unless `.claude/worktrees/.metadata_never_index` exists. */
function checkMarker(cwd) {
  const root = repoRoot(cwd);
  const marker = join(root, '.claude', 'worktrees', '.metadata_never_index');
  if (existsSync(marker)) return null;
  return marker;
}

function run(execute) {
  const cwd = process.cwd();
  const missingMarker = checkMarker(cwd);
  if (missingMarker) {
    console.error(`${NAME} · refused · missing marker: ${missingMarker}`);
    console.error(`  fix: touch ${missingMarker}`);
    return 2;
  }

  const rows = classify(cwd);
  console.log(`# ${NAME} — ${execute ? 'EXECUTE' : 'dry-run'} (repo: ${repoRoot(cwd)})`);
  printTable(rows);

  let fail = 0;
  const reap = rows.filter((r) => r.disposition === 'REAP');
  const warn = rows.filter((r) => r.disposition.startsWith('KEEP')).length;

  if (execute) {
    for (const r of reap) {
      const del = spawnSync('git', ['worktree', 'remove', r.path], { cwd, encoding: 'utf8' });
      if (del.status === 0) { console.log(`  removed ${r.path}`); continue; }
      console.log(`  FAILED to remove ${r.path}: ${del.stderr.trim()}`);
      fail++;
    }
    const prune = spawnSync('git', ['worktree', 'prune'], { cwd, encoding: 'utf8' });
    if (prune.status !== 0) { console.log(`  FAILED to prune: ${prune.stderr.trim()}`); fail++; }
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

  const scratch = mkdtempSync(join(tmpdir(), 'reap-worktrees-selftest-'));
  const bare = join(scratch, 'origin.git');
  const work = join(scratch, 'work');
  const wtRoot = join(work, '.claude', 'worktrees');
  const failures = [];
  const assert = (cond, msg) => { if (!cond) failures.push(msg); console.log(`  ${cond ? 'ok ' : 'FAIL'} ${msg}`); };

  try {
    git(scratch, 'init', '--bare', '-b', 'main', bare);
    git(scratch, 'clone', bare, work);
    git(work, 'config', 'user.email', 'selftest@example.com');
    git(work, 'config', 'user.name', 'selftest');
    // Mirror the real repo's own .gitignore convention (`.claude/worktrees` is gitignored
    // there) so the fixture worktrees never get picked up as embedded-repo gitlinks by a
    // later `git add .` in this scratch repo.
    writeFileSync(join(work, '.gitignore'), '.claude/worktrees\n');
    writeFileSync(join(work, 'a.txt'), 'base\n');
    git(work, 'add', '.'); git(work, 'commit', '-m', 'base');
    git(work, 'push', 'origin', 'main');
    mkdirSync(wtRoot, { recursive: true });

    /* fixture: reap-clean — merged branch, worktree clean, unlocked → REAP */
    git(work, 'checkout', '-b', 'reap-clean-branch');
    writeFileSync(join(work, 'r.txt'), 'reap\n');
    git(work, 'add', '.'); git(work, 'commit', '-m', 'reap-clean work');
    git(work, 'checkout', 'main');
    git(work, 'merge', '--no-ff', '-m', 'merge reap-clean-branch', 'reap-clean-branch');
    git(work, 'push', 'origin', 'main');
    git(work, 'worktree', 'add', join(wtRoot, 'reap-clean'), 'reap-clean-branch');

    /* fixture: keep-dirty — merged branch, but an uncommitted file sits in the worktree → KEEP(dirty) */
    git(work, 'branch', 'keep-dirty-branch');
    git(work, 'worktree', 'add', join(wtRoot, 'keep-dirty'), 'keep-dirty-branch');
    writeFileSync(join(wtRoot, 'keep-dirty', 'untracked.txt'), 'dirty\n');

    /* fixture: keep-locked — merged branch, clean, but `git worktree lock` applied → KEEP(locked) */
    git(work, 'branch', 'keep-locked-branch');
    git(work, 'worktree', 'add', join(wtRoot, 'keep-locked'), 'keep-locked-branch');
    git(work, 'worktree', 'lock', join(wtRoot, 'keep-locked'), '--reason', 'live Agent-tool process (selftest)');

    /* fixture: keep-unmerged — NEGATIVE CONTROL: real, un-merged commits, clean, unlocked → KEEP(live-branch) */
    git(work, 'checkout', '-b', 'keep-unmerged-branch');
    writeFileSync(join(work, 'u.txt'), 'unmerged\n');
    git(work, 'add', '.'); git(work, 'commit', '-m', 'unmerged work');
    git(work, 'checkout', 'main');
    git(work, 'worktree', 'add', join(wtRoot, 'keep-unmerged'), 'keep-unmerged-branch');

    writeFileSync(join(wtRoot, '.metadata_never_index'), '');

    const invoke = (...args) => spawnSync(process.execPath, [process.argv[1], ...args], { cwd: work, encoding: 'utf8' });

    /* Marker-refusal negative control, run FIRST (before proving the happy path). */
    rmSync(join(wtRoot, '.metadata_never_index'));
    const noMarker = invoke();
    assert(noMarker.status === 2, `missing .metadata_never_index refuses to run, exit 2 (got ${noMarker.status})`);
    assert(/touch .*\.metadata_never_index/.test(noMarker.stderr), 'refusal names the touch one-liner');
    writeFileSync(join(wtRoot, '.metadata_never_index'), '');

    /* Dry-run (reverse control): correct table, removes NOTHING. */
    const dry = invoke();
    assert(dry.status === 0, `dry-run exits 0 (got ${dry.status})`);
    assert(/reap-clean\s+reap-clean-branch\s+REAP/.test(dry.stdout), 'dry-run: reap-clean → REAP');
    assert(/keep-dirty\s+keep-dirty-branch\s+KEEP\(dirty\)/.test(dry.stdout), 'dry-run: keep-dirty → KEEP(dirty)');
    assert(/keep-locked\s+keep-locked-branch\s+KEEP\(locked\)/.test(dry.stdout), 'dry-run: keep-locked → KEEP(locked)');
    assert(/keep-unmerged-branch\s+KEEP\(live-branch\)/.test(dry.stdout), 'dry-run: keep-unmerged → KEEP(live-branch), negative control');
    assert(!dry.stdout.includes(work + '\n') && !new RegExp(`${work.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+main`).test(dry.stdout),
      'dry-run: main checkout is never a candidate/listed');
    assert(existsSync(join(wtRoot, 'reap-clean')), 'dry-run removed nothing (reap-clean still on disk)');

    /* --execute: only the REAP row is removed; every KEEP row + main survive untouched. */
    const applied = invoke('--execute');
    assert(applied.status === 0, `--execute exits 0 (got ${applied.status})`);
    assert(!existsSync(join(wtRoot, 'reap-clean')), '--execute removed reap-clean');
    assert(existsSync(join(wtRoot, 'keep-dirty')), '--execute kept keep-dirty (dirty guard held)');
    assert(existsSync(join(wtRoot, 'keep-locked')), '--execute kept keep-locked (locked guard held)');
    assert(existsSync(join(wtRoot, 'keep-unmerged')), '--execute kept keep-unmerged (NEGATIVE CONTROL bit)');
    assert(existsSync(work), '--execute never touched the main checkout');
    const afterList = git(work, 'worktree', 'list', '--porcelain');
    assert(!afterList.includes(join(wtRoot, 'reap-clean')), '--execute: reap-clean no longer registered after prune');

    /* Usage contract. */
    const usage = invoke('--bogus-flag');
    assert(usage.status === 2, `unknown flag exits 2 (got ${usage.status})`);

    /* Re-running dry-run after execute: the three KEEP fixtures still classify identically. */
    const dry2 = invoke();
    assert(dry2.status === 0, `post-execute dry-run exits 0 (got ${dry2.status})`);
    assert(!dry2.stdout.includes('reap-clean'), 'post-execute dry-run no longer lists reap-clean');
    assert(/keep-unmerged-branch\s+KEEP\(live-branch\)/.test(dry2.stdout), 'post-execute dry-run: keep-unmerged still KEPT');
  } catch (err) {
    failures.push(`selftest scaffolding threw: ${err.message}`);
    console.log(`  FAIL scaffolding: ${err.message}`);
  } finally {
    // Unlock before removal — rmSync on a locked linked-worktree dir is fine (it's just a
    // filesystem directory to the OS), but leave git's own view consistent for tidiness.
    spawnSync('git', ['worktree', 'unlock', join(wtRoot, 'keep-locked')], { cwd: work });
    rmSync(scratch, { recursive: true, force: true });
  }

  console.log(`${NAME} · ${failures.length ? 'fail' : 'ok'} · ${failures.length} fail / 0 warn`);
  return failures.length ? 1 : 0;
}

/* ── Entry ────────────────────────────────────────────────────── */

const args = process.argv.slice(2);
if (args.includes('selftest')) process.exit(selftest());

const known = new Set(['--dry', '--execute']);
const unknown = args.filter((a) => !known.has(a));
if (unknown.length) {
  console.error(`Unknown argument(s): ${unknown.join(' ')}\n`);
  console.error('Usage: node scripts/reap-worktrees.mjs [--dry|--execute|selftest]');
  process.exit(2);
}
if (args.includes('--dry') && args.includes('--execute')) {
  console.error('--dry and --execute are mutually exclusive');
  process.exit(2);
}
process.exit(run(args.includes('--execute')));
