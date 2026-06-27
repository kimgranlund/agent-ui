#!/usr/bin/env python3
"""coverage_check.py — cross-plane coverage gate for a two-plane decomposition.

Routes the deterministic half of decomposing-systems to code: given a manifest of
OUTSIDE-IN nodes, INSIDE-OUT actions, and the hosts mapping that crosses them, it
reports the defect quadrant mechanically instead of by eyeballing.

Failures (exit 1):
  UNHOSTED        an action mapped to no node — a need with nowhere to live
  DANGLING        a hosts entry referencing an unknown action or node
  DUP-ID          a node id or action id used twice
Warnings (exit 1 only under --strict):
  UNJUSTIFIED-LEAF a leaf node hosting no action and carrying no `justify`

Usage:
    python coverage_check.py <manifest.json> [--strict]
Exit 0 = coverage clean.  Exit 1 = at least one failure (or warning under --strict).
"""
import json
import sys
from pathlib import Path


def main(argv):
    args = [a for a in argv[1:] if not a.startswith("--")]
    strict = "--strict" in argv
    if len(args) != 1:
        print("usage: coverage_check.py <manifest.json> [--strict]")
        return 2
    try:
        m = json.loads(Path(args[0]).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(f"[ERROR] cannot read manifest: {e}")
        return 2

    nodes = {n["id"]: n for n in m.get("nodes", [])}
    actions = {a["id"]: a for a in m.get("actions", [])}
    hosts = m.get("hosts", [])

    failures, warnings = [], []

    # DUP-ID — ids must be unique within their plane
    if len(nodes) != len(m.get("nodes", [])):
        failures.append(("DUP-ID", "duplicate node id"))
    if len(actions) != len(m.get("actions", [])):
        failures.append(("DUP-ID", "duplicate action id"))

    # DANGLING — every hosts edge must reference real ids
    hosted_actions, hosted_nodes = set(), set()
    for h in hosts:
        a, n = h.get("action"), h.get("node")
        if a not in actions:
            failures.append(("DANGLING", f"hosts.action '{a}' is not a declared action"))
        else:
            hosted_actions.add(a)
        if n not in nodes:
            failures.append(("DANGLING", f"hosts.node '{n}' is not a declared node"))
        else:
            hosted_nodes.add(n)

    # UNHOSTED — every action needs a surface
    for aid, a in actions.items():
        if aid not in hosted_actions:
            failures.append(("UNHOSTED", f"action '{a.get('label', aid)}' ({aid}) maps to no node"))

    # UNJUSTIFIED-LEAF — a leaf that hosts nothing and declares no reason to exist
    for nid, n in nodes.items():
        if n.get("leaf") and nid not in hosted_nodes and not n.get("justify"):
            warnings.append(("UNJUSTIFIED-LEAF", f"leaf '{n.get('label', nid)}' ({nid}) hosts no action and has no justify"))

    print(f"== coverage: {len(nodes)} nodes · {len(actions)} actions · {len(hosts)} hosts ==")
    for code, detail in failures:
        print(f"[FAIL] {code} — {detail}")
    for code, detail in warnings:
        print(f"[WARN] {code} — {detail}")
    if not failures and not warnings:
        print("[OK] coverage clean — both planes cross-check")

    return 1 if failures or (strict and warnings) else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
