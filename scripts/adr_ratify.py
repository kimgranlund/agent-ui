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
    booked-repairs TRACKING ISSUE filed, one per flip that owes repairs (GH #544)
    booked-repairs checklist comment posted on the ratifying PR/issue, naming that issue (GH #392)

Why an issue AND a comment (GH #544). The comment alone was the GH #392 remedy, and it did post —
but the ratification utterance lands on the ADR's own proposing PR, which is merged and CLOSED by
the time anyone ratifies (ADR-0175: PR #505 closed 16:22Z, checklist comment posted 19:46Z). A
comment on a closed PR has no state a `- [ ]` box can carry, appears in no queue, and is not a file
any gate can read, so two flips' repairs fell through in one day. The tracking issue is the artifact
whose OPEN state IS the repairs' un-doneness: it sits in `gh issue list` — the repo's one work queue
since ADR-0145 — until someone closes it. The comment stays as the record at the ratification site
and now points at that issue.

No LLM composes ratification language at any point (ADR-0149 F2). The checklist holds that line in
both surfaces: its items are the ADR's own Repairs-cell segments, sliced mechanically and quoted
verbatim under a fixed template — never paraphrased, never summarized.

Fail-closed (F3): any check failing, `gh` unavailable, URL ambiguous, zero or multiple matching ADR
files -> exit non-zero, ZERO writes. The ONLY fail-open steps are the two post-flip booked-repairs
artifacts (GH #392/#544): the flip is the primary act and has already landed, so a failure to file
the issue or post the comment warns and still exits 0 rather than leaving the ADR half-flipped.
Every pre-flip verification stays fail-closed. The adr-status-guard hook's unconditional Edit/Write
deny is untouched (F4) — this script writes via plain file I/O and is itself the verified path the
guard's threat model lacked.

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

REPAIRS_ROW_RE = re.compile(r"^> \| \*\*Repairs\*\* \| (.*) \|$", re.MULTILINE)
SEGMENT_SEP = " · "
# A bold `**On ratification…**` label opens a new booking mid-segment (ADR-0167 stacks two of them
# in one separator-free cell; ADR-0164 puts non-booked prose ahead of one).
BOOKING_LABEL_RE = re.compile(r"(?=\*\*[Oo]n [Rr]atification)")
BOOKED_RE = re.compile(r"on ratification", re.IGNORECASE)
# A booking phrase that reaches a `:` while still OUTSIDE any parenthetical is a label governing the
# list that follows, not a note about its own segment (GH #394). Every real label reaches its colon
# within 9 characters of the phrase; the bound just keeps a rambling sentence from posing as a label.
SCOPE_LABEL_RE = re.compile(r"on ratification[^:]{0,40}:", re.IGNORECASE)

# The label the tracking issue carries: the repo's existing generic-work-item label (ADR-0145's
# git-native routing — "Generic work item — chore/follow-up/debt"). No new label is minted for this.
REPAIRS_ISSUE_LABEL = "task"


def run(cmd: list[str]) -> str:
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise SystemExit(f"FAIL-CLOSED: `{' '.join(cmd)}` exited {res.returncode}: {res.stderr.strip()}")
    return res.stdout


def scan(cell: str):
    """Walk a Repairs cell outside its code spans, yielding `(index, char, paren_depth)`.

    The one place that knows how a cell's brackets read, so its two callers cannot drift apart.
    Backtick code spans are opaque atoms — nothing inside one is yielded and no `(` in one changes
    depth. ADR-0028's cell names three `(` glyphs in code spans, which would otherwise open
    parentheticals that never close and swallow the rest of the cell. A stray `)` at depth 0 clamps
    rather than going negative, so no cell shape can make this raise. Paren glyphs themselves are not
    yielded (neither caller needs them); the depth reported with a char is the depth it sits at.
    """
    depth = i = 0
    while i < len(cell):
        ch = cell[i]
        if ch == "`":
            close = cell.find("`", i + 1)
            i = len(cell) if close == -1 else close + 1
            continue
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
        else:
            yield i, ch, depth
        i += 1


def split_segments(cell: str) -> list[str]:
    """Split a Repairs cell on ` · `, but only where the separator is not nested (GH #394).

    A cell's segments are ` · `-delimited, EXCEPT that an author's parenthetical may carry its own
    ` · ` list (ADR-0164's `(new — a.ts moved verbatim · b.ts split out · …)`): splitting there
    truncates the booking mid-parenthetical. So the scan tracks paren depth and cuts only at depth 0.

    The `i >= start` guard keeps a cut separator's own trailing space from being read as the start of
    a second separator (` ·  · ` stays two pieces, not three).
    """
    pieces: list[str] = []
    start = 0
    for i, ch, depth in scan(cell):
        if i >= start and depth == 0 and ch == SEGMENT_SEP[0] and cell.startswith(SEGMENT_SEP, i):
            pieces.append(cell[start:i])
            start = i + len(SEGMENT_SEP)
    pieces.append(cell[start:])
    return pieces


def outer_text(piece: str) -> str:
    """The piece's text that sits outside every parenthetical and code span (GH #394).

    What a booking LABEL is read from. `(… gated on ratification)` is a note about its own segment,
    while `on ratification+build:` standing at depth 0 is a heading over the list that follows — the
    two are indistinguishable until the nested text is stripped away.
    """
    return "".join(ch for _, ch, depth in scan(piece) if depth == 0)


def booked_repairs(adr_text: str) -> list[str]:
    """The ADR's Repairs-cell items booked "on ratification", verbatim and in cell order.

    Pure: text in, strings out — no gh, no filesystem, no writes. The slice rule, derived from the
    corpus of real cells: the cell splits on ` · ` at paren depth 0 (`split_segments`), each segment
    splits again ahead of any bold `**On ratification…**` label, and a piece survives if EITHER

      * it mentions "on ratification" itself (every attested phrasing — `gated on ratification`,
        `applied on ratification`, `on ratification+build:`), or
      * an open booking LABEL already covers it (GH #394).

    A label is a booking phrase reaching a `:` at depth 0 (`SCOPE_LABEL_RE` over `outer_text`), and
    it covers every later piece in the cell. Authors write one booking as a heading over a ` · `
    list — `on ratification+build: A · B · C`, 52 of the 168 corpus cells (measured 2026-08-04) —
    where only A repeats the phrase, so a phrase-only rule posted A and silently dropped B and C
    (ADR-0088/0090/0137/0164). A phrase inside a parenthetical is a note on its own segment, rather
    than a label over what follows, so ADR-0065's
    `(… gated on ratification)` opens no scope. The rule is purely additive: it can only keep pieces
    the phrase test alone dropped, never drop one it kept.

    A cell with no surviving piece, a malformed row, or no Repairs row at all yields [] not a raise.
    """
    m = REPAIRS_ROW_RE.search(adr_text)
    if not m:
        return []
    items: list[str] = []
    labelled = False
    for segment in split_segments(m.group(1)):
        for piece in BOOKING_LABEL_RE.split(segment):
            piece = piece.strip()
            if not piece:
                continue
            if labelled or BOOKED_RE.search(piece):
                items.append(piece)
            if SCOPE_LABEL_RE.search(outer_text(piece)):
                labelled = True
    return items


def checklist(items: list[str]) -> str:
    """The booked repairs as unticked markdown checkboxes, verbatim and in cell order.

    Composed once and shared by both surfaces, so the tracking issue and the ratifying-PR comment
    can never quote the same cell differently.
    """
    return "\n".join(f"- [ ] {item}" for item in items)


def issue_title(adr_id: str) -> str:
    """The tracking issue's title — fixed template, the ADR id is the only variable."""
    return f"ADR-{adr_id}: execute the booked repairs"


def issue_body(adr_id: str, adr_rel: str, url: str, date: str, items: list[str]) -> str:
    """The tracking issue's body (GH #544). Pure: strings in, one string out.

    Says three things and nothing else: what flipped, that this issue's OPEN state is the repairs'
    un-doneness, and the verbatim checklist. No paraphrase of any item (ADR-0149 F2).
    """
    return (
        f"`scripts/adr_ratify.py` flipped **ADR-{adr_id}** `proposed` → `accepted` on {date} "
        f"(ADR-0149), via the owner's ratification utterance: {url}\n\n"
        f"That ADR's **Repairs** cell books the items below on ratification. **This issue is their "
        f"tracking record — it stays OPEN until they are executed, and closing it is the record "
        f"that they landed.** It is filed automatically because the checklist comment on the "
        f"ratifying PR (GH #392) lands on a PR that is already closed, where it carries no state "
        f"and sits in no queue — two flips' repairs fell through that way (GH #544).\n\n"
        f"Each item is quoted verbatim from that ADR's own **Repairs** cell:\n\n"
        f"{checklist(items)}\n\n"
        f"Source: `{adr_rel}`"
    )


def file_repairs_issue(
    api_repo: str, adr_id: str, adr_rel: str, url: str, date: str, items: list[str]
) -> str | None:
    """File the booked repairs as one OPEN tracking issue (GH #544); return its `#N` ref, or None.

    Fail-OPEN by contract: the flip is the primary act and has already landed, so any failure here
    warns on stderr and returns None — the caller still exits 0.
    """
    payload = json.dumps({
        "title": issue_title(adr_id),
        "body": issue_body(adr_id, adr_rel, url, date, items),
        "labels": [REPAIRS_ISSUE_LABEL],
    })
    res = subprocess.run(
        ["gh", "api", f"repos/{api_repo}/issues", "--input", "-"],
        input=payload, capture_output=True, text=True,
    )
    if res.returncode != 0:
        print(
            f"WARNING: the flip landed, but filing the booked-repairs tracking issue on "
            f"{api_repo} failed ({res.returncode}): {res.stderr.strip()}\n"
            f"         File it by hand — title '{issue_title(adr_id)}', label "
            f"'{REPAIRS_ISSUE_LABEL}', one unticked box per Repairs item in {adr_rel}. Until it "
            f"exists, these {len(items)} repair(s) sit in no queue.",
            file=sys.stderr,
        )
        return None
    try:
        number = json.loads(res.stdout)["number"]
    except (json.JSONDecodeError, KeyError, TypeError):
        print(
            f"WARNING: the tracking issue was created on {api_repo} but its number could not be "
            f"read back — check `gh issue list --label {REPAIRS_ISSUE_LABEL}`.",
            file=sys.stderr,
        )
        return None
    print(f"  filed:  booked-repairs tracking issue {api_repo}#{number} ({len(items)} item(s), OPEN)")
    return f"#{number}"


def post_repairs_checklist(
    api_repo: str, number: str, adr_id: str, adr_rel: str, items: list[str], issue_ref: str | None
) -> None:
    """Post the booked repairs as a checklist comment on the ratifying PR/issue (GH #392).

    The record at the ratification site. `issue_ref` points at the tracking issue that actually
    holds the state (GH #544) — or says plainly that none exists, so a reader is never left
    believing this closed-PR comment is the tracking record.

    Fail-OPEN by contract, same as `file_repairs_issue`.
    """
    tracked = (
        f"Tracked in {issue_ref} — that issue stays OPEN until these land."
        if issue_ref
        else "**No tracking issue was filed** (see the flip's stderr) — these items are in no "
             "queue until one exists."
    )
    body = (
        f"**Booked repairs — ADR-{adr_id}**, flipped `proposed` → `accepted` by "
        f"`scripts/adr_ratify.py` (ADR-0149). Each item is quoted verbatim from that ADR's own "
        f"**Repairs** cell:\n\n"
        + checklist(items)
        + f"\n\n{tracked}\n\nSource: `{adr_rel}`"
    )
    payload = json.dumps({"body": body})
    res = subprocess.run(
        ["gh", "api", f"repos/{api_repo}/issues/{number}/comments", "--input", "-"],
        input=payload, capture_output=True, text=True,
    )
    if res.returncode != 0:
        print(
            f"WARNING: the flip landed, but posting the booked-repairs checklist to "
            f"{api_repo}#{number} failed ({res.returncode}): {res.stderr.strip()}\n"
            f"         Post these {len(items)} item(s) by hand.",
            file=sys.stderr,
        )
        return
    print(f"  posted: booked-repairs checklist ({len(items)} item(s)) on {api_repo}#{number}")


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
    # ── the booked repairs this flip owes forward (GH #392) ─────────────────────────────────────
    repairs = booked_repairs(adr_text)
    utterance_number = um.group(3)
    booked = (
        "\n  booked: " + "\n          ".join(f"[ ] {item}" for item in repairs)
        + f"\n  track:  would file '{issue_title(adr_id)}' "
          f"(label '{REPAIRS_ISSUE_LABEL}', OPEN) on {origin_owner}/{origin_repo}"
        if repairs
        else "\n  booked: (no `on ratification` items in the Repairs cell — nothing to track)"
    )
    if dry_run:
        print(f"DRY-RUN — all checks pass, no writes.\n{evidence}{booked}")
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

    # The flip is done. Everything below is fail-OPEN — it must never turn a landed flip non-zero.
    # Order matters: the tracking issue is filed FIRST so the comment can name it (GH #544). If the
    # issue fails, the comment still posts and says so, rather than implying it is the tracker.
    if repairs:
        api_repo = f"{origin_owner}/{origin_repo}"
        adr_rel = str(adr_path.relative_to(root))
        issue_ref = None
        try:
            issue_ref = file_repairs_issue(api_repo, adr_id, adr_rel, url, date, repairs)
        except Exception as exc:  # noqa: BLE001 — a post-flip artifact may not fail the flip
            print(f"WARNING: booked-repairs tracking issue not filed: {exc}", file=sys.stderr)
        try:
            post_repairs_checklist(
                api_repo, utterance_number, adr_id, adr_rel, repairs, issue_ref,
            )
        except Exception as exc:  # noqa: BLE001 — a courtesy comment may not fail the flip
            print(f"WARNING: booked-repairs checklist not posted: {exc}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
