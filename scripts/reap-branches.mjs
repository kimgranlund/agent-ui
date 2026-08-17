#!/usr/bin/env node
/**
 * scripts/reap-branches.mjs — gated reap of provably-merged local branches + orphaned
 * worktree-agent-<hash> markers. Mirrors gen-ui-kit's `scripts/ops/reap-branches.mjs`
 * (issue #138 realization) for this repo (GH #1050) — three sweeps of `repo-cleaner`
 * had logged propose-only branch lists with no script to execute the reap.
 *
 * A local branch is DELETED (`--execute`) only when it is "provably disposed of":
 *
 *   RULE 1 (ordinary branches) — reapable when EITHER:
 *     a. its tip equals a remote PR's `headRefOid` and that PR's state is MERGED
 *        (checked via `gh pr view --json headRefOid,state`, matched by headRefName), OR
 *     b. `git cherry origin/main <branch>` prints no `+`-prefixed line (every commit on
 *        the branch is already present upstream, or absent entirely — this is what
 *        catches a squash-merged branch a plain `merge-base --is-ancestor` check misses,
 *        since a squash produces a new SHA with no ancestry link back to the branch tip).
 *
 *   RULE 2 (`worktree-agent-<hash>` markers) — these are the Agent-tool worktree BASE
 *     markers (the branch a `.claude/worktrees/agent-<hash>` worktree is created on before
 *     the real feature branch is checked out inside it — see this repo's own
 *     `.claude/ops/plan.md` sweep-8 §4.1). They typically carry zero unique commits, so
 *     Rule 1 alone would usually already say REAP — but the worktree can still be LIVE
 *     under a *different* checked-out branch (exactly this build: this worktree now holds
 *     `1050-reap-branches`, not `worktree-agent-<hash>`, yet the lane is still open). So a
 *     `worktree-agent-<hash>` branch additionally requires: no `.claude/worktrees/agent-<hash>`
 *     path present in `git worktree list` (matched by PATH, not by which branch that
 *     worktree currently has checked out) — Rule 1 AND this presence check both hold.
 *
 *   RULE 3 (every branch) — NEVER touch a branch checked out by any live worktree,
 *     regardless of Rule 1/2's verdict (`git worktree list` is authoritative).
 *
 * Everything not provably disposed of is PROPOSED — never deleted. `main` is never a
 * candidate. Deletion tries `git branch -d` first — safe by construction, since `-d` itself
 * refuses a non-ancestor branch. Only when `-d` refuses a row THIS script's own Rule 1/2 gate
 * already classified REAP (the squash-merge case: cherry-clean/PR-merged but no ancestry link
 * back to origin/main, so `-d`'s ancestor check structurally cannot pass it) does it fall back
 * to `-D` — never a blind force, always gated on an independent verification that already ran.
 *
 * Operates on the git repo containing the current working directory. `origin/main` is used
 * as-is (no implicit fetch — a stale `origin/main` only errs toward KEEPING branches).
 *
 * Usage:
 *   npm run ops:reap-branches                       # dry-run (default): disposition table only
 *   node scripts/reap-branches.mjs                   # same, direct
 *   node scripts/reap-branches.mjs --execute          # delete every REAP row (git branch -d)
 *   node scripts/reap-branches.mjs --verify-branch B  # single-branch gate (see below)
 *   node scripts/reap-branches.mjs selftest           # prove the gate on a scratch repo
 *
 * `--verify-branch <name>` is the single-branch entry point — the same three-rule gate as
 * the sweep, scoped to one branch, so a caller that owns exactly one scratch branch (e.g.
 * `dispatch-ticket`'s own Phase 3 tear-down step) can shell out to this script as a boolean
 * gate instead of reimplementing it:
 *
 *   if node scripts/reap-branches.mjs --verify-branch "$BRANCH"; then
 *     git branch -d "$BRANCH"   # provably disposed of — -d (never -D) still refuses on divergence
 *   else
 *     echo "not provably disposed of — leaving $BRANCH in place"
 *   fi
 *
 * Never deletes anything itself in this mode — the caller still owns the actual
 * `git branch -d` call (mechanize the GATE, not the destructive verb).
 *
 * Exit codes (sweep mode — no args, --execute):
 *   0  clean (dry-run printed, or every REAP deletion succeeded; selftest passed)
 *   1  failure (a deletion failed, git plumbing errored; selftest assertion bit)
 *   2  usage error (unknown argument); selftest mode: a required tool (git) is absent
 *
 * Exit codes (--verify-branch B — single-branch gate):
 *   0  B is REAP (provably disposed of — safe to delete)
 *   1  B is KEPT or PROPOSED (not provably disposed of, or checked out — do not delete)
 *   2  usage error (no branch name given, extra args, or B does not exist locally)
 *
 * Verdict line shape: `reap-branches · <verdict> · N fail / M warn`
 * (warn = branches left as PROPOSED — surviving toil, not an error).
 *
 * Wired into: `npm run ops:reap-branches` (dry-run by default; append `-- --execute`) and
 * `npm run check:scripts`'s selftest gate.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const NAME = 'reap-branches';
const WORKTREE_MARKER_RE = /^worktree-agent-(.+)$/;

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

/** Branches checked out in any worktree → Map(branch → worktree path); plus the raw list
 *  of every registered worktree path (Rule 2's presence check runs by PATH, not branch). */
function worktreeState(cwd) {
  const out = git(cwd, 'worktree', 'list', '--porcelain');
  const checkedOut = new Map();
  const paths = [];
  let path = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('worktree ')) { path = line.slice('worktree '.length); paths.push(path); }
    else if (line.startsWith('branch refs/heads/')) checkedOut.set(line.slice('branch refs/heads/'.length), path);
  }
  return { checkedOut, paths };
}

/** GraphQL PR check: does an exactly-matching (head OID) MERGED PR exist?
 *  Returns { merged, detail }. Throws nothing — gh absence/failure keeps the branch. */
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
  if (nodes.length) return { merged: false, detail: `PR head OID ≠ local tip (${nodes.map((n) => `#${n.number} ${n.state}`).join(', ')})` };
  return { merged: false, detail: 'no matching PR' };
}

/** Rule 1b: `git cherry origin/main <ref>` clean (no `+`-prefixed pending commit). Takes the
 *  fully-qualified `refs/heads/<branch>` ref, never a bare name — a same-name TAG outranks a
 *  branch in git's bare-name disambiguation order and would silently shadow it here. */
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

/* ── Disposition ──────────────────────────────────────────────── */

/** Shared per-branch context — computed once, reused by every disposition
 *  call so a --verify-branch call and a full sweep classify identically. */
function context(cwd) {
  return {
    ...worktreeState(cwd),
    gh: githubRepo(cwd),
    hasOriginMain: gitOk(cwd, 'rev-parse', '--verify', '--quiet', 'refs/remotes/origin/main'),
  };
}

/** Disposition for exactly one branch, given a shared context. Same gate
 *  logic the sweep uses — this is the piece --verify-branch calls. */
function classifyBranch(cwd, branch, { checkedOut, paths, gh, hasOriginMain }) {
  // Fully-qualified ref for git plumbing: a same-name TAG shadows the branch
  // under a bare name in rev-parse/cherry and can misclassify an unmerged branch.
  const ref = `refs/heads/${branch}`;
  const tip = git(cwd, 'rev-parse', ref);

  // Rule 3: never touch a branch checked out by any live worktree.
  if (checkedOut.has(branch)) {
    return { branch, tip, disposition: 'KEPT', reason: `checked out in ${checkedOut.get(branch)}` };
  }

  // Rule 1: merged-tip (PR headRefOid) OR cherry-clean against origin/main.
  const pr = mergedPr(gh, branch, tip);
  const cherry = cherryClean(cwd, ref, hasOriginMain);
  const rule1Clear = pr.merged || cherry.clean;
  const rule1Detail = pr.merged ? pr.detail : cherry.clean ? cherry.detail : `not merged: ${pr.detail}; ${cherry.detail}`;

  // Rule 2: worktree-agent-<hash> markers additionally require no matching
  // `.claude/worktrees/agent-<hash>` PATH still registered (the worktree can be live
  // under a DIFFERENT checked-out branch — Rule 3 alone would miss that).
  const wtMatch = branch.match(WORKTREE_MARKER_RE);
  if (wtMatch) {
    const hash = wtMatch[1];
    const stillLive = paths.some((p) => p.endsWith(`.claude/worktrees/agent-${hash}`));
    if (stillLive) {
      return { branch, tip, disposition: 'KEPT', reason: `worktree agent-${hash} still registered in git worktree list` };
    }
    return rule1Clear
      ? { branch, tip, disposition: 'REAP', reason: `orphaned worktree marker (no agent-${hash} in git worktree list) + ${rule1Detail}` }
      : { branch, tip, disposition: 'PROPOSED', reason: `orphaned worktree marker but ${rule1Detail}` };
  }

  return rule1Clear
    ? { branch, tip, disposition: 'REAP', reason: rule1Detail }
    : { branch, tip, disposition: 'PROPOSED', reason: rule1Detail };
}

function classify(cwd) {
  const rows = [];
  const branches = git(cwd, 'for-each-ref', 'refs/heads', '--format=%(refname:short)')
    .split('\n').filter(Boolean);
  const ctx = context(cwd);

  for (const branch of branches) {
    if (branch === 'main') continue;
    rows.push(classifyBranch(cwd, branch, ctx));
  }
  return rows;
}

function printTable(rows) {
  if (!rows.length) { console.log('(no local branches beyond main)'); return; }
  const w = Math.max(...rows.map((r) => r.branch.length), 6);
  for (const r of rows) {
    console.log(`  ${r.branch.padEnd(w)}  ${r.tip.slice(0, 8)}  ${r.disposition.padEnd(8)}  ${r.reason}`);
  }
}

function run(execute) {
  const cwd = process.cwd();
  const rows = classify(cwd);
  console.log(`# ${NAME} — ${execute ? 'EXECUTE' : 'dry-run'} (repo: ${git(cwd, 'rev-parse', '--show-toplevel')})`);
  printTable(rows);

  let fail = 0;
  const reap = rows.filter((r) => r.disposition === 'REAP');
  const warn = rows.filter((r) => r.disposition === 'PROPOSED').length;

  if (execute) {
    for (const r of reap) {
      const del = spawnSync('git', ['branch', '-d', r.branch], { cwd, encoding: 'utf8' });
      if (del.status === 0) { console.log(`  deleted ${r.branch}`); continue; }
      // `-d`'s own ancestor check structurally cannot pass a squash-merged branch (Rule 1b) —
      // its tip is never reachable from origin/main by ancestry, only patch-equivalent. This
      // row already independently proved reap-safety (cherry-clean or a MERGED PR match)
      // before it was classified REAP, so a `-d` refusal here is expected, not a red flag —
      // fall back to `-D` (never a blind force; only after `-d` refuses a row THIS script's
      // own gate already verified).
      const force = spawnSync('git', ['branch', '-D', r.branch], { cwd, encoding: 'utf8' });
      if (force.status === 0) console.log(`  deleted ${r.branch} (-D fallback: ${r.reason})`);
      else { console.log(`  FAILED to delete ${r.branch}: ${force.stderr.trim()}`); fail++; }
    }
  } else if (reap.length) {
    console.log(`  (${reap.length} REAP row(s) — re-run with --execute to delete)`);
  }

  const verdict = fail ? 'fail' : 'ok';
  console.log(`${NAME} · ${verdict} · ${fail} fail / ${warn} warn`);
  return fail ? 1 : 0;
}

/** Single-branch gate — same classifyBranch() the sweep uses, scoped to one name. Never
 *  deletes; the caller still owns `git branch -d` after a 0 exit. Returns 2 on a usage
 *  error (branch absent locally, or `main`). */
function verifyBranch(branch) {
  const cwd = process.cwd();
  // `main` is trivially "provably disposed of" by some checks — a REAP verdict here
  // would hand a caller the go-ahead to delete the default branch. Exclude explicitly.
  if (branch === 'main') {
    console.error(`${NAME} · usage error · 'main' is never reapable`);
    return 2;
  }
  if (!gitOk(cwd, 'rev-parse', '--verify', '--quiet', `refs/heads/${branch}`)) {
    console.error(`${NAME} · usage error · no local branch named '${branch}'`);
    return 2;
  }
  const row = classifyBranch(cwd, branch, context(cwd));
  console.log(`  ${row.branch}  ${row.tip.slice(0, 8)}  ${row.disposition}  ${row.reason}`);
  const verdict = row.disposition === 'REAP' ? 'ok' : 'not-reapable';
  console.log(`${NAME} · ${verdict} · verify-branch`);
  return row.disposition === 'REAP' ? 0 : 1;
}

/* ── Selftest ─────────────────────────────────────────────────── */

function selftest() {
  for (const tool of ['git']) {
    if (spawnSync(tool, ['--version']).status !== 0) {
      console.log(`${NAME} · skip · ${tool} not available — install ${tool} to run the selftest`);
      return 2;
    }
  }

  const scratch = mkdtempSync(join(tmpdir(), 'reap-selftest-'));
  const bare = join(scratch, 'origin.git');
  const work = join(scratch, 'work');
  const failures = [];
  const assert = (cond, msg) => { if (!cond) failures.push(msg); console.log(`  ${cond ? 'ok ' : 'FAIL'} ${msg}`); };

  try {
    git(scratch, 'init', '--bare', '-b', 'main', bare);
    git(scratch, 'clone', bare, work);
    git(work, 'config', 'user.email', 'selftest@example.com');
    git(work, 'config', 'user.name', 'selftest');
    writeFileSync(join(work, 'a.txt'), 'base\n');
    git(work, 'add', '.'); git(work, 'commit', '-m', 'base');

    // merged-branch: ancestor of main (real merge) → must REAP (Rule 1a-adjacent: cherry-clean).
    git(work, 'checkout', '-b', 'merged-branch');
    writeFileSync(join(work, 'm.txt'), 'merged\n');
    git(work, 'add', '.'); git(work, 'commit', '-m', 'merged work');
    git(work, 'checkout', 'main');
    git(work, 'merge', '--no-ff', '-m', 'merge merged-branch', 'merged-branch');

    // squash-branch: squash-merged (no ancestry link, same tree) → must REAP via cherry (Rule 1b),
    // the exact case a bare merge-base ancestor check misses.
    git(work, 'checkout', '-b', 'squash-branch');
    writeFileSync(join(work, 'sq.txt'), 'squash\n');
    git(work, 'add', '.'); git(work, 'commit', '-m', 'squash work');
    git(work, 'checkout', 'main');
    git(work, 'merge', '--squash', 'squash-branch');
    git(work, 'commit', '-m', 'squash-merge squash-branch');

    // wt-branch: merged, but checked out in a live worktree → must survive (Rule 3).
    git(work, 'checkout', '-b', 'wt-branch');
    writeFileSync(join(work, 'w.txt'), 'wt\n');
    git(work, 'add', '.'); git(work, 'commit', '-m', 'wt work');
    git(work, 'checkout', 'main');
    git(work, 'merge', '--no-ff', '-m', 'merge wt-branch', 'wt-branch');
    git(work, 'push', 'origin', 'main');
    git(work, 'branch', '--unset-upstream', 'main');
    git(work, 'worktree', 'add', join(scratch, 'wt'), 'wt-branch');

    // unmerged-branch: NEGATIVE CONTROL — commits nowhere in main, must survive.
    git(work, 'checkout', '-b', 'unmerged-branch');
    writeFileSync(join(work, 'u.txt'), 'unmerged\n');
    git(work, 'add', '.'); git(work, 'commit', '-m', 'unmerged work');
    git(work, 'checkout', 'main');

    // worktree-agent-<hash> markers: one whose worktree dir is still registered (live lane,
    // even under a DIFFERENT checked-out branch) must survive; one whose worktree is gone,
    // with no unique commits, must REAP.
    git(work, 'branch', 'worktree-agent-live1234');
    git(work, 'worktree', 'add', join(scratch, '.claude', 'worktrees', 'agent-live1234'), '-b', 'real-lane-live1234', 'main');
    git(work, 'branch', 'worktree-agent-gone5678');

    const invoke = (...args) => spawnSync(process.execPath, [process.argv[1], ...args], { cwd: work, encoding: 'utf8' });

    // Dry-run (reverse control): correct table, deletes NOTHING.
    const dry = invoke();
    assert(dry.status === 0, `dry-run exits 0 (got ${dry.status})`);
    assert(/merged-branch\s+\S+\s+REAP/.test(dry.stdout), 'dry-run: merged-branch → REAP');
    assert(/squash-branch\s+\S+\s+REAP/.test(dry.stdout), 'dry-run: squash-branch → REAP (Rule 1b, cherry-clean)');
    assert(/unmerged-branch\s+\S+\s+PROPOSED/.test(dry.stdout), 'dry-run: unmerged-branch → PROPOSED (negative control)');
    assert(/wt-branch\s+\S+\s+KEPT/.test(dry.stdout), 'dry-run: wt-branch → KEPT (worktree-checked-out, Rule 3)');
    assert(/worktree-agent-live1234\s+\S+\s+KEPT/.test(dry.stdout), 'dry-run: worktree-agent-live1234 → KEPT (Rule 2, path still registered)');
    assert(/worktree-agent-gone5678\s+\S+\s+REAP/.test(dry.stdout), 'dry-run: worktree-agent-gone5678 → REAP (Rule 2, no matching path)');
    const afterDry = git(work, 'for-each-ref', 'refs/heads', '--format=%(refname:short)');
    assert(afterDry.includes('merged-branch'), 'dry-run deleted nothing (merged-branch still present)');

    // --execute: REAP rows deleted; both controls + live worktree marker survive.
    const applied = invoke('--execute');
    assert(applied.status === 0, `--execute exits 0 (got ${applied.status})`);
    const after = git(work, 'for-each-ref', 'refs/heads', '--format=%(refname:short)').split('\n');
    assert(!after.includes('merged-branch'), '--execute deleted merged-branch (plain -d)');
    assert(!after.includes('squash-branch'), '--execute deleted squash-branch (-D fallback, verified via cherry-clean)');
    assert(!after.includes('worktree-agent-gone5678'), '--execute deleted worktree-agent-gone5678');
    assert(after.includes('unmerged-branch'), '--execute kept unmerged-branch (NEGATIVE CONTROL bit)');
    assert(after.includes('wt-branch'), '--execute kept wt-branch (worktree guard held)');
    assert(after.includes('worktree-agent-live1234'), '--execute kept worktree-agent-live1234 (Rule 2 guard held)');

    // Usage contract.
    const usage = invoke('--bogus-flag');
    assert(usage.status === 2, `unknown flag exits 2 (got ${usage.status})`);

    // --verify-branch (single-branch gate): re-create a fresh REAP case (merged-branch is
    // gone above) plus reuse the two still-standing controls.
    git(work, 'checkout', '-b', 'verify-merged');
    writeFileSync(join(work, 'v.txt'), 'verify\n');
    git(work, 'add', '.'); git(work, 'commit', '-m', 'verify-merged work');
    git(work, 'checkout', 'main');
    git(work, 'merge', '--no-ff', '-m', 'merge verify-merged', 'verify-merged');
    git(work, 'push', 'origin', 'main');

    const vReap = invoke('--verify-branch', 'verify-merged');
    assert(vReap.status === 0, `--verify-branch: REAP branch exits 0 (got ${vReap.status})`);
    assert(/verify-merged\s+\S+\s+REAP/.test(vReap.stdout), '--verify-branch: REAP branch prints REAP');

    const vProposed = invoke('--verify-branch', 'unmerged-branch');
    assert(vProposed.status === 1, `--verify-branch: PROPOSED branch exits 1 (got ${vProposed.status}, negative control)`);
    assert(/unmerged-branch\s+\S+\s+PROPOSED/.test(vProposed.stdout), '--verify-branch: unmerged branch prints PROPOSED');

    const vKept = invoke('--verify-branch', 'wt-branch');
    assert(vKept.status === 1, `--verify-branch: KEPT (checked-out) branch exits 1 (got ${vKept.status})`);
    assert(/wt-branch\s+\S+\s+KEPT/.test(vKept.stdout), '--verify-branch: checked-out branch prints KEPT');

    const vMarkerLive = invoke('--verify-branch', 'worktree-agent-live1234');
    assert(vMarkerLive.status === 1, `--verify-branch: live worktree marker exits 1 (got ${vMarkerLive.status})`);

    const vMissing = invoke('--verify-branch', 'no-such-branch');
    assert(vMissing.status === 2, `--verify-branch: absent branch exits 2 (got ${vMissing.status})`);

    const vNoArg = invoke('--verify-branch');
    assert(vNoArg.status === 2, `--verify-branch with no name exits 2 (got ${vNoArg.status})`);

    const vMain = invoke('--verify-branch', 'main');
    assert(vMain.status === 2, `--verify-branch main exits 2 (got ${vMain.status})`);

    const vExtra = invoke('--verify-branch', 'unmerged-branch', '--execute');
    assert(vExtra.status === 2, `--verify-branch with extra args exits 2 (got ${vExtra.status})`);

    // A same-name TAG must not shadow the branch: tag an origin/main commit with the
    // unmerged branch's name — bare-name rev-parse would resolve the tag and misclassify.
    git(work, 'tag', 'unmerged-branch', 'origin/main');
    const vShadow = invoke('--verify-branch', 'unmerged-branch');
    assert(vShadow.status === 1, `same-name tag must not flip an unmerged branch to REAP (got ${vShadow.status})`);
    git(work, 'tag', '-d', 'unmerged-branch');

    // --verify-branch never deletes, win or lose.
    const afterVerify = git(work, 'for-each-ref', 'refs/heads', '--format=%(refname:short)');
    assert(afterVerify.includes('verify-merged'), '--verify-branch left verify-merged in place (REAP is report-only)');
    assert(afterVerify.includes('unmerged-branch'), '--verify-branch left unmerged-branch in place');
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

const verifyIdx = args.indexOf('--verify-branch');
if (verifyIdx !== -1) {
  const branch = args[verifyIdx + 1];
  // Verify mode takes EXACTLY [--verify-branch, <name>] — extra args (a stray --execute, a
  // typo'd flag) must not silently bypass the unknown-arg handler and verify anyway.
  if (!branch || branch.startsWith('-') || args.length !== 2 || verifyIdx !== 0) {
    console.error('Usage: node scripts/reap-branches.mjs --verify-branch <branch-name> (no other arguments)');
    process.exit(2);
  }
  process.exit(verifyBranch(branch));
}

const known = new Set(['--dry', '--execute']);
const unknown = args.filter((a) => !known.has(a));
if (unknown.length) {
  console.error(`Unknown argument(s): ${unknown.join(' ')}\n`);
  console.error('Usage: node scripts/reap-branches.mjs [--dry|--execute|--verify-branch <name>|selftest]');
  process.exit(2);
}
if (args.includes('--dry') && args.includes('--execute')) {
  console.error('--dry and --execute are mutually exclusive');
  process.exit(2);
}
process.exit(run(args.includes('--execute')));
