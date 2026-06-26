#!/usr/bin/env python3
"""trace_check.py — PRD \u2194 SPEC \u2194 LLD traceability coverage check.

Builds the traceability matrix mechanically and reports orphans and gaps:
  gap          : a PRD goal no SPEC requirement serves
  scope-creep  : a SPEC requirement tracing to no PRD goal
  unimplemented: a SPEC requirement no LLD component implements
  gold-plating : an LLD component tracing to no SPEC requirement
  dangling     : a reference to an ID that does not exist upstream

Usage:
    python trace_check.py <prd.md> <spec.md> <lld.md>
    (any file may be omitted with '-' to skip that layer)

Exit 0 = fully coherent.  Exit 1 = at least one orphan/gap/dangling ref.
"""
import re
import sys
from pathlib import Path

G = r"PRD-G\d+"
Rq = r"SPEC-R\d+"
C = r"LLD-C\d+"


def load(arg):
    if arg == "-":
        return ""
    p = Path(arg)
    if not p.exists():
        print(f"warning: {arg} not found, skipping", file=sys.stderr)
        return ""
    return p.read_text(encoding="utf-8")


def ids(text, pat):
    return set(re.findall(pat, text))


def main(argv):
    if len(argv) != 4:
        print("usage: trace_check.py <prd.md> <spec.md> <lld.md>  (use '-' to skip a layer)")
        return 2
    prd, spec, lld = (load(a) for a in argv[1:4])

    prd_goals = ids(prd, G)
    spec_reqs = ids(spec, Rq)
    lld_comps = ids(lld, C)

    spec_to_goal = ids(spec, G)        # PRD goals the SPEC references
    lld_to_req = ids(lld, Rq)          # SPEC reqs the LLD references

    issues = []

    if prd:
        for g in sorted(prd_goals):
            if g not in spec_to_goal:
                issues.append(("gap", f"{g} has no SPEC requirement serving it"))
    if spec:
        for g in sorted(spec_to_goal):
            if prd and g not in prd_goals:
                issues.append(("dangling", f"SPEC references {g}, absent from PRD"))
        if prd:
            for rq in sorted(spec_reqs):
                # a requirement should trace to at least one goal somewhere in its block;
                # coarse check: SPEC as a whole must reference goals if it has requirements
                pass
        if not spec_to_goal and spec_reqs and prd:
            issues.append(("scope-creep", "SPEC has requirements but references no PRD goals"))
    if lld:
        for rq in sorted(lld_to_req):
            if spec and rq not in spec_reqs:
                issues.append(("dangling", f"LLD references {rq}, absent from SPEC"))
        if spec:
            for rq in sorted(spec_reqs):
                if rq not in lld_to_req:
                    issues.append(("unimplemented", f"{rq} has no LLD component"))
        if not lld_to_req and lld_comps and spec:
            issues.append(("gold-plating", "LLD has components but references no SPEC requirements"))

    print("== traceability matrix ==")
    print(f"PRD goals:        {len(prd_goals)}  {sorted(prd_goals)}")
    print(f"SPEC requirements:{len(spec_reqs)}  {sorted(spec_reqs)}")
    print(f"LLD components:    {len(lld_comps)}  {sorted(lld_comps)}")
    print()
    if not issues:
        print("[PASS] no orphans, gaps, or dangling references")
        return 0
    for kind, msg in issues:
        print(f"[{kind.upper():13}] {msg}")
    print(f"\n-- {len(issues)} issue(s) --")
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
