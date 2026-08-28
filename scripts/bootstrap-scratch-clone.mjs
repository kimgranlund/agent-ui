#!/usr/bin/env node
/**
 * scripts/bootstrap-scratch-clone.mjs — deterministic node_modules bootstrap for a
 * `dispatch_envelope.py`-cut scratch clone (GH #1695), mechanizing `seat-map`'s "Worktree trap
 * — SYMLINK, don't install" PER-ENTRY recipe (`.claude/skills/seat-map/SKILL.md`, Dispatch laws
 * section) so a dispatched build seat runs this instead of improvising by hand.
 *
 * Why per-entry, never a whole-root symlink: `ln -s <root>/node_modules node_modules` splits
 * TypeScript type identity — the root's `node_modules/@agent-ui/*` workspace links point back
 * into the ROOT checkout's own `packages/`, so workspace imports typecheck against the root's
 * sources while relative imports use the clone's, and `npm run check` goes red on a clean tree
 * (ADR-0224 S2, the phantom-TS2345 finding). This script instead symlinks every top-level
 * `node_modules` entry (files AND dotfiles — a bare `*` glob silently skips `.bin` and dies later
 * with `spawn .../vite ENOENT`, the 0223-S3 finding) from `--root`, then rebuilds ONLY the
 * `@agent-ui/*` scope to point at THIS clone's own `packages/agent-ui/*` sources, so type
 * identity stays intact while third-party deps share the root's install (zero churn, zero
 * `npm ci`).
 *
 * Two build incidents this closes: build-1686 (~hours lost to a slow full `npm ci` in a scratch
 * clone with no bootstrap step, which triggered a mistaken duplicate dispatch) and build-1692
 * (the whole-root symlink trap above, recovered only by doing this recipe by hand).
 *
 * Usage:
 *   node scripts/bootstrap-scratch-clone.mjs <clone-dir> [--root <path>]
 *   node scripts/bootstrap-scratch-clone.mjs selftest
 *
 * `--root` defaults to this script's own repo root (`import.meta.url`'s checkout) — the ordinary
 * case, where the scratch clone is bootstrapped from the primary checkout that already carries a
 * built `node_modules`. Pass `--root` explicitly to bootstrap from a different already-built tree.
 *
 * Exit codes: 0 ok, 1 bootstrap/verify failure, 2 usage error.
 */

import { existsSync, lstatSync, mkdirSync, readdirSync, readlinkSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const NAME = 'bootstrap-scratch-clone';
const THIS_REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Symlink every top-level entry of `<root>/node_modules` (incl. dotfiles) into `<clone>/node_modules`. */
function linkRootEntries(root, clone) {
  const srcModules = join(root, 'node_modules');
  if (!existsSync(srcModules)) {
    throw new Error(`--root has no node_modules to bootstrap from: ${srcModules}`);
  }
  const destModules = join(clone, 'node_modules');
  if (existsSync(destModules)) {
    throw new Error(`${destModules} already exists — refusing to bootstrap over an existing node_modules`);
  }
  mkdirSync(destModules);
  for (const entry of readdirSync(srcModules)) {
    symlinkSync(join(srcModules, entry), join(destModules, entry));
  }
  return destModules;
}

/** Rebuild the `@agent-ui/*` scope to point at THIS clone's own packages/agent-ui/* sources. */
function relinkWorkspaceScope(clone, destModules) {
  const scopeDir = join(destModules, '@agent-ui');
  rmSync(scopeDir, { recursive: true, force: true });
  mkdirSync(scopeDir);
  const packagesRoot = join(clone, 'packages', 'agent-ui');
  if (!existsSync(packagesRoot)) {
    throw new Error(`no packages/agent-ui under the clone: ${packagesRoot}`);
  }
  for (const pkg of readdirSync(packagesRoot)) {
    const pkgPath = join(packagesRoot, pkg);
    if (!lstatSync(pkgPath).isDirectory()) continue;
    symlinkSync(pkgPath, join(scopeDir, pkg));
  }
}

/** `readlink node_modules/@agent-ui/shared` MUST resolve to a path inside THIS clone. */
function verify(clone, destModules) {
  const sharedLink = join(destModules, '@agent-ui', 'shared');
  if (!existsSync(sharedLink)) {
    throw new Error(`verify failed: ${sharedLink} does not exist`);
  }
  const target = readlinkSync(sharedLink);
  const resolvedTarget = resolve(dirname(sharedLink), target);
  const resolvedClone = resolve(clone);
  if (!resolvedTarget.startsWith(resolvedClone + '/') && resolvedTarget !== resolvedClone) {
    throw new Error(
      `verify failed: node_modules/@agent-ui/shared resolves to ${resolvedTarget}, outside the clone ${resolvedClone}`,
    );
  }
  return resolvedTarget;
}

function bootstrap(clone, root) {
  const destModules = linkRootEntries(root, clone);
  relinkWorkspaceScope(clone, destModules);
  const resolved = verify(clone, destModules);
  console.log(`${NAME} · ok · node_modules/@agent-ui/shared -> ${resolved}`);
  return 0;
}

function selftest() {
  const failures = [];
  const os = { tmpdir: () => (globalThis.process?.env?.TMPDIR ?? '/tmp').replace(/\/$/, '') };
  const scratch = join(os.tmpdir(), `bootstrap-scratch-clone-selftest-${process.pid}-${Date.now()}`);
  const root = join(scratch, 'root');
  const clone = join(scratch, 'clone');
  try {
    // Fixture: a fake root with node_modules/{a-dep, .bin, @agent-ui/{shared,components}}
    // pointing at fake root-owned sources, plus a fake clone with its own packages/agent-ui/*.
    mkdirSync(join(root, 'node_modules', '.bin'), { recursive: true });
    mkdirSync(join(root, 'real-a-dep'), { recursive: true });
    symlinkSync(join(root, 'real-a-dep'), join(root, 'node_modules', 'a-dep'));
    mkdirSync(join(root, 'node_modules', '@agent-ui'), { recursive: true });
    mkdirSync(join(root, 'root-owned-shared'), { recursive: true });
    symlinkSync(join(root, 'root-owned-shared'), join(root, 'node_modules', '@agent-ui', 'shared'));

    mkdirSync(join(clone, 'packages', 'agent-ui', 'shared'), { recursive: true });
    mkdirSync(join(clone, 'packages', 'agent-ui', 'components'), { recursive: true });

    const rc = bootstrap(clone, root);
    if (rc !== 0) failures.push(`bootstrap() returned ${rc}, expected 0`);

    // Third-party dep must still point at the ROOT's copy (shared, zero churn) — resolved through
    // however many hops (the root's own node_modules entry may itself be a symlink).
    const aDepReal = realpathSync(join(clone, 'node_modules', 'a-dep'));
    if (aDepReal !== realpathSync(join(root, 'real-a-dep'))) {
      failures.push('a-dep (third-party) did not resolve into the root install');
    }

    // Dotfile entries (.bin) must have been linked too.
    if (!existsSync(join(clone, 'node_modules', '.bin'))) {
      failures.push('.bin dotfile entry was not linked (bare * glob regression)');
    }

    // @agent-ui/shared MUST resolve inside the clone, never the root.
    const sharedTarget = readlinkSync(join(clone, 'node_modules', '@agent-ui', 'shared'));
    const resolvedShared = resolve(dirname(join(clone, 'node_modules', '@agent-ui', 'shared')), sharedTarget);
    if (resolvedShared !== resolve(clone, 'packages', 'agent-ui', 'shared')) {
      failures.push(`@agent-ui/shared resolved to ${resolvedShared}, expected the clone's own packages/agent-ui/shared`);
    }

    // @agent-ui/components must also have been relinked (whole scope, not just `shared`).
    if (!existsSync(join(clone, 'node_modules', '@agent-ui', 'components'))) {
      failures.push('@agent-ui/components was not relinked into the clone scope');
    }

    // Negative control: bootstrapping again over an existing node_modules must fail (exit 1), not
    // silently clobber a real install.
    try {
      bootstrap(clone, root);
      failures.push('re-bootstrap over an existing node_modules did not throw');
    } catch {
      // expected
    }

    // Negative control: a root with no node_modules must fail loudly, never silently no-op.
    const emptyRoot = join(scratch, 'empty-root');
    const emptyClone = join(scratch, 'empty-clone');
    mkdirSync(join(emptyClone, 'packages', 'agent-ui', 'shared'), { recursive: true });
    mkdirSync(emptyRoot, { recursive: true });
    try {
      bootstrap(emptyClone, emptyRoot);
      failures.push('bootstrapping from a root with no node_modules did not throw');
    } catch {
      // expected
    }
  } catch (err) {
    failures.push(`selftest scaffolding threw: ${err.message}`);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }

  for (const f of failures) console.log(`  FAIL ${f}`);
  console.log(`${NAME} · ${failures.length ? 'fail' : 'ok'} · ${failures.length} fail / 0 warn`);
  return failures.length ? 1 : 0;
}

/* ── Entry ────────────────────────────────────────────────────── */

const args = process.argv.slice(2);
if (args.includes('selftest')) {
  process.exit(selftest());
}

const known = new Set(['--root']);
let root = THIS_REPO_ROOT;
let cloneArg = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--root') {
    if (i + 1 >= args.length) {
      console.error('--root requires a value');
      process.exit(2);
    }
    root = resolve(args[++i]);
    continue;
  }
  if (args[i].startsWith('--') && !known.has(args[i])) {
    console.error(`Unknown argument: ${args[i]}\n`);
    console.error('Usage: node scripts/bootstrap-scratch-clone.mjs <clone-dir> [--root <path>] | selftest');
    process.exit(2);
  }
  if (cloneArg === null) {
    cloneArg = args[i];
  } else {
    console.error(`Unexpected extra argument: ${args[i]}`);
    process.exit(2);
  }
}

if (!cloneArg) {
  console.error('Usage: node scripts/bootstrap-scratch-clone.mjs <clone-dir> [--root <path>] | selftest');
  process.exit(2);
}

const clone = resolve(cloneArg);
if (!existsSync(clone)) {
  console.error(`clone-dir does not exist: ${clone}`);
  process.exit(2);
}

try {
  process.exit(bootstrap(clone, root));
} catch (err) {
  console.error(`${NAME} · FAIL · ${err.message}`);
  process.exit(1);
}
