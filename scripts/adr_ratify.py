#!/usr/bin/env python3
"""adr_ratify.py — the ADR-0149 deterministic verify-then-flip executor.

The ONLY sanctioned agent-side path for flipping an ADR `proposed -> accepted`. The ratification
SIGNAL is an explicit `ratify ADR-####` comment or PR review authored by the repository owner on
GitHub (ADR-0149 F1 — merge/approval alone ratifies nothing); this script verifies that utterance
live against GitHub and, only if every check passes, performs the whole flip mechanically:

    Status cell `proposed -> accepted`
    Ratified-by cell <- owner login + utterance date + URL
    README index row status column `proposed -> accepted`
    derived indexes regenerated (node scripts/generate-sitemap.mjs)

No LLM composes ratification language at any point (ADR-0149 F2). Fail-closed (F3): any check
failing, `gh` unavailable, URL ambiguous, zero or multiple matching ADR files -> exit non-zero,
ZERO writes. The adr-status-guard hook's unconditional Edit/Write deny is untouched (F4) — this
script writes via plain file I/O and is itself the verified path the guard's threat model lacked.

Usage:
    python3 scripts/adr_ratify.py ADR-0149 https://github.com/OWNER/REPO/pull/38#issuecomment-NNN
    python3 scripts/adr_ratify.py 0149 <url> --dry-run     # verify + report, write nothing

Known limitation (named in ADR-0149): a `gh`-CLI-posted comment authenticates as the token's owner,
so the artifact proves the ACCOUNT, not the hand on the keyboard. That is still strictly stronger
evidence than an in-conversation claim (the forgery class the guard exists for), and the utterance
is a durable, timestamped, owner-attributed record either way.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

RATIFY_TOKEN_RE = re.compile(r"ratify\s+ADR-(\d{4})", re.IGNORECASE)
STATUS_ROW = "> | **Status** | proposed |"
STATUS_ROW_ACCEPTED = "> | **Status** | accepted |"
RATIFIED_BY_ROW_RE = re.compile(r"^> \| \*\*Ratified by\*\* \| .* \|$", re.MULTILINE)
ISSUECOMMENT_RE = re.compile(r"^https://github\.com/([^/]+)/([^/]+)/(?:pull|issues)/(\d+)#issuecomment-(\d+)$")
REVIEW_RE = re.compile(r"^https://github\.com/([^/]+)/([^/]+)/pull/(\d+)#pullrequestreview-(\d+)$")


def run(cmd: list[str]) -> str:
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise SystemExit(f"FAIL-CLOSED: `{' '.join(cmd)}` exited {res.returncode}: {res.stderr.strip()}")
    return res.stdout


def main() -> int:
    args = [a for a in sys.argv[1:] if a != "--dry-run"]
    dry_run = "--dry-run" in sys.argv[1:]
    if len(args) != 2:
        print(__doc__, file=sys.stderr)
        return 2
    adr_id = args[0].upper().removeprefix("ADR-")
    if not re.fullmatch(r"\d{4}", adr_id):
        raise SystemExit(f"FAIL-CLOSED: '{args[0]}' is not an ADR-#### id")
    url = args[1]

    # ── resolve the repo root + the origin's owner/repo ─────────────────────────────────────────
    root = Path(run(["git", "rev-parse", "--show-toplevel"]).strip())
    origin = run(["git", "remote", "get-url", "origin"]).strip()
    m = re.search(r"github\.com[:/]([^/]+)/([^/\s]+?)(?:\.git)?$", origin)
    if not m:
        raise SystemExit(f"FAIL-CLOSED: origin '{origin}' is not a github.com remote")
    origin_owner, origin_repo = m.group(1), m.group(2)

    # ── (a) the URL must be an utterance on THIS repository ─────────────────────────────────────
    kind = api_path = None
    um = ISSUECOMMENT_RE.match(url)
    if um:
        kind, api_path = "comment", f"repos/{um.group(1)}/{um.group(2)}/issues/comments/{um.group(4)}"
    else:
        um = REVIEW_RE.match(url)
        if um:
            kind = "review"
            api_path = f"repos/{um.group(1)}/{um.group(2)}/pulls/{um.group(3)}/reviews/{um.group(4)}"
    if not um:
        raise SystemExit("FAIL-CLOSED: URL is neither an #issuecomment- nor a #pullrequestreview- github.com URL")
    if (um.group(1), um.group(2)) != (origin_owner, origin_repo):
        raise SystemExit(f"FAIL-CLOSED: URL repo {um.group(1)}/{um.group(2)} != origin {origin_owner}/{origin_repo}")

    # ── (b) fetch the utterance + the live repo owner ────────────────────────────────────────────
    utterance = json.loads(run(["gh", "api", api_path]))
    owner_login = json.loads(run(["gh", "repo", "view", f"{origin_owner}/{origin_repo}", "--json", "owner"]))["owner"]["login"]
    author = (utterance.get("user") or {}).get("login", "")
    if not author or author != owner_login:
        raise SystemExit(f"FAIL-CLOSED: utterance author '{author}' is not the repository owner '{owner_login}'")

    # ── (c) the body must name exactly this ADR with the literal token ──────────────────────────
    body = utterance.get("body") or ""
    named = {g for g in RATIFY_TOKEN_RE.findall(body)}
    if adr_id not in named:
        raise SystemExit(f"FAIL-CLOSED: utterance names {sorted(named) or 'no ADR'}, not ADR-{adr_id}")
    date = (utterance.get("created_at") or utterance.get("submitted_at") or "")[:10]
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
        raise SystemExit("FAIL-CLOSED: utterance carries no parseable timestamp")

    # ── (d) exactly one target ADR file, currently `proposed` ───────────────────────────────────
    adr_dir = root / ".claude" / "docs" / "adr"
    matches = sorted(adr_dir.glob(f"{adr_id}-*.md"))
    if len(matches) != 1:
        raise SystemExit(f"FAIL-CLOSED: {len(matches)} files match {adr_id}-*.md under {adr_dir}")
    adr_path = matches[0]
    adr_text = adr_path.read_text(encoding="utf-8")
    if adr_text.count(STATUS_ROW) != 1:
        raise SystemExit(f"FAIL-CLOSED: {adr_path.name} does not carry exactly one `proposed` Status row")
    if not RATIFIED_BY_ROW_RE.search(adr_text):
        raise SystemExit(f"FAIL-CLOSED: {adr_path.name} carries no Ratified-by row to fill")

    # ── README index row: locate exactly one row for this id with a `proposed` status cell ──────
    readme_path = adr_dir / "README.md"
    readme_lines = readme_path.read_text(encoding="utf-8").splitlines(keepends=True)
    row_idx = [i for i, l in enumerate(readme_lines) if l.startswith(f"| [{adr_id}](./{adr_path.name})")]
    if len(row_idx) != 1:
        raise SystemExit(f"FAIL-CLOSED: {len(row_idx)} README index rows for {adr_id} (need exactly 1)")
    cells = readme_lines[row_idx[0]].split("|")
    if len(cells) < 5 or cells[-3].strip() != "proposed":
        raise SystemExit("FAIL-CLOSED: README index row's status cell is not `proposed`")

    evidence = (
        f"verified: {kind} by @{author} (repo owner) on {date}\n"
        f"  url:    {url}\n"
        f"  token:  ratify ADR-{adr_id} (of {sorted(named)})\n"
        f"  target: {adr_path.relative_to(root)} (Status: proposed)"
    )
    if dry_run:
        print(f"DRY-RUN — all checks pass, no writes.\n{evidence}")
        return 0

    # ── writes: all-or-nothing from here (verifications complete) ───────────────────────────────
    ratified_by_row = (
        f"> | **Ratified by** | {author} (repo owner), {date}, via the [`ratify ADR-{adr_id}` utterance]({url}) "
        f"— verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |"
    )
    adr_text = adr_text.replace(STATUS_ROW, STATUS_ROW_ACCEPTED, 1)
    adr_text = RATIFIED_BY_ROW_RE.sub(ratified_by_row, adr_text, count=1)
    adr_path.write_text(adr_text, encoding="utf-8")

    cells[-3] = " accepted "
    readme_lines[row_idx[0]] = "|".join(cells)
    readme_path.write_text("".join(readme_lines), encoding="utf-8")

    run(["node", str(root / "scripts" / "generate-sitemap.mjs")])
    print(f"RATIFIED ADR-{adr_id}\n{evidence}\n  wrote:  Status cell · Ratified-by cell · README row · derived indexes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
