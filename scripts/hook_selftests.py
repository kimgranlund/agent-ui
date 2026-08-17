#!/usr/bin/env python3
"""hook_selftests.py — runs every repo hook's `--selftest` branch and fails closed (GH #755).

Wired into `check:scripts` so a hook regression (or a hook that silently LOST its selftest branch)
goes red in the standing gate, not in a manual invocation nobody remembers. Two-part verdict per
hook, both required:

  1. exit code 0 — the selftest's own pass/fail contract;
  2. the `--selftest: ALL PASS` trailer on stderr — the branch-EXISTS proof. The 2026-08-11 audit's
     own first probe got exit 0 from three hooks that had NO selftest at all (argv ignored, empty
     stdin, quiet exit) — the trailer is what distinguishes "ran and passed" from "never ran"
     (the collect_github.py `## OK` trailer precedent).

Discovers hooks by extension under .claude/hooks/ — a new hook is covered (or fails here) the day
it lands, no per-hook registration to forget.

Zero-hooks is a valid, intentional repo state (2026-08-17: Kim removed every repo hook and the
`hooks` key from both settings files) — this script only fails closed when a hooks DIRECTORY
exists (someone left files behind) or `settings(.local).json` still registers a `.claude/hooks/*`
command with no directory backing it (a registration pointing at nothing). Absence of both is not
the "silently lost every hook" regression this gate exists to catch; presence of either is.
"""
import json
import os
import re
import subprocess
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOOKS_DIR = os.path.join(REPO_ROOT, ".claude", "hooks")
TRAILER = "--selftest: ALL PASS"
HOOK_PATH_RE = re.compile(r"\.claude/hooks/([\w.-]+)")


def registered_hook_names() -> "set[str]":
    names: "set[str]" = set()
    for settings_name in ("settings.json", "settings.local.json"):
        path = os.path.join(REPO_ROOT, ".claude", settings_name)
        if not os.path.isfile(path):
            continue
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        for entries in (data.get("hooks") or {}).values():
            for entry in entries:
                for hook in entry.get("hooks", []):
                    m = HOOK_PATH_RE.search(hook.get("command", ""))
                    if m:
                        names.add(m.group(1))
    return names


def run_one(path: str) -> "tuple[bool, str]":
    name = os.path.basename(path)
    if name.endswith(".py"):
        cmd = [sys.executable, path, "--selftest"]
    elif name.endswith(".sh"):
        cmd = ["bash", path, "--selftest"]
    else:
        return True, f"SKIP  {name} (not a .py/.sh hook)"
    try:
        result = subprocess.run(cmd, input=b"", capture_output=True, timeout=120)
    except (OSError, subprocess.TimeoutExpired) as err:
        return False, f"FAIL  {name} — selftest did not run: {err}"
    stderr = result.stderr.decode("utf-8", errors="replace")
    if result.returncode != 0:
        return False, f"FAIL  {name} — selftest exit {result.returncode}\n{stderr}"
    if TRAILER not in stderr:
        return False, f"FAIL  {name} — exit 0 but NO '{TRAILER}' trailer (no selftest branch ran — the audit's false-PASS shape)"
    return True, f"PASS  {name}"


def main() -> int:
    registered = registered_hook_names()
    if not os.path.isdir(HOOKS_DIR):
        if registered:
            print(f"hook_selftests: no hooks dir at {HOOKS_DIR} but settings register {sorted(registered)}", file=sys.stderr)
            return 1
        print("hook_selftests: zero hooks registered and no hooks dir — intentional empty state, pass", file=sys.stderr)
        return 0
    hooks = sorted(f for f in os.listdir(HOOKS_DIR) if f.endswith((".py", ".sh")))
    if not hooks:
        if registered:
            print(f"hook_selftests: empty hooks dir but settings register {sorted(registered)}", file=sys.stderr)
            return 1
        print("hook_selftests: hooks dir exists but is empty and nothing is registered — pass", file=sys.stderr)
        return 0
    failures = 0
    for name in hooks:
        ok, line = run_one(os.path.join(HOOKS_DIR, name))
        failures += 0 if ok else 1
        print(f"  {line}", file=sys.stderr)
    print(
        f"hook_selftests: {len(hooks) - failures}/{len(hooks)} hooks pass" + ("" if failures == 0 else f" — {failures} FAILED"),
        file=sys.stderr,
    )
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
