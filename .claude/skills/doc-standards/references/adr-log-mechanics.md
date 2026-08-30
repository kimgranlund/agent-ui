# The ADR log's own rules — no index file, numbering, amendment vs supersession (doc-standards §1b)

## 1b · The ADR log: no index file, numbering, amendment vs supersession

**Kim's standing no-index-file rule (2026-08-13), verbatim:**

> No README.md in ADR folders.
>
> Never create or maintain a README.md (or any other index file) inside an ADR folder. The numbered
> filename already carries order + title (0187-validator-finalize-signal.md); each ADR's own
> frontmatter carries its status (proposed/accepted/superseded/supersedes). That's the whole index —
> don't build a second one.
>
> Need a rollup — a report, a status dashboard, "what's still open"? Generate it on the fly from `ls`
> + a grep across frontmatter, and don't commit the output. Never add a README "just this once, to
> make it easier" — that's exactly how the fat one got to 313 KB.
>
> If an ADR folder already has a README.md: delete it, don't trim or regenerate it. Fix anything that
> pointed to it so it greps the folder instead.

- The rule's own gate: `site/lib/adr.test.ts` asserts every `.md` in `.claude/docs/adr/` matches
  `NNNN-*.md` — a reintroduced index file reds the run.
- A rollup, when you want one: `ls .claude/docs/adr/[0-9]*.md` for order + title, and grep the
  headers for status (`grep -H '| \*\*Status\*\* |' .claude/docs/adr/[0-9]*.md`). Never committed.
- The site's derived indexes read the DIRECTORY, not a table: `scripts/generate-sitemap.mjs`'s
  `generateAdrIndex` globs `NNNN-*.md` and takes each title from that file's own H1. A new ADR is
  indexed the moment its file lands.
- **This section replaced `.claude/docs/adr/README.md` §"Status lifecycle" / §"Amendment vs
  supersession" / §"Numbering & files"** (that file, 313 KB of index + doctrine, was deleted
  2026-08-13). Accepted ADRs still cite that file (and those § names) in their own historical prose —
  those cites are append-only history, deliberately left verbatim; resolve any of them HERE.

**Numbering & files.** One file per ADR, `NNNN-short-kebab-title.md`. `NNNN` is a zero-padded
sequential integer, **never reused**; `0000-template.md` is the template — copy it. Claim the next
number against the FILE TREE, never against a lagging index. Known gaps stay gaps (the
`KNOWN_GAPS` allowlist in `site/lib/docs-grammar.test.ts` S8 is their home). The `Repairs:` cell
links the owning-doc IDs the change edits (`PRD-G#`/`SPEC-R#`/`LLD-C#`) — the ADR records *why*,
the owning doc still holds the *fact*.

**Amendment vs supersession vs extension.** The test is whether the original **Decision still
stands**. All three are append-only with respect to an accepted decision's substance:

| | the original Decision … | record as |
|---|---|---|
| **Foreseen amendment** | stands; an extension it ALREADY anticipated lands | append-only `## Amendment` section in the SAME ADR — never a new file |
| **Supersession** | is reversed / replaced / no longer applies | a NEW ADR; the old one's Status flips `superseded` + `Superseded by ADR-NNNN` links forward |
| **Extension** | stands; a *separate, new* decision builds on it | a NEW ADR, two-way `Extends` ↔ `Extended by` cross-reference |
| **Partial supersession, left unrestated** | is partly superseded — a LATER ADR already replaced or renamed one clause/mechanism, and the header cell records that supersession — but the Decision-body prose was never restated to match | append-only `## Amendment` in the SAME ADR restating the affected clause under the current mechanism/value — same mechanical form as a foreseen amendment, distinct trigger (below) |

An `## Amendment` **adds** the foreseen follow-through; it does not edit the original Context /
Decision / Consequences, so it does not breach *never edit an accepted decision's substance*. If you
want to *change* a sentence inside an accepted Decision, that is a supersession — open a new ADR.
An amendment header carrying `**proposed** — Kim ratifies` is flipped only by `adr_ratify.py`'s
amendment mode (§5), never by hand-editing.

**The 4th shape: partial supersession left unrestated (found via revalidation, not foreseen at
write time).** A later ADR can supersede one clause or mechanism of an earlier ADR without
superseding the earlier ADR as a whole — the earlier ADR's own header cell (`Supersedes`/
`Superseded by`) correctly names the later ADR, but nothing forces the Decision-BODY prose to
catch up. A reader who reads only the body clause, never the header table, is misled into thinking
the old mechanism or value is still live. This is neither a foreseen amendment (nobody planned the
restatement when the ADR was written) nor a full supersession (the ADR's OTHER clauses still
stand) — it takes its own append-only `## Amendment`, mechanically identical to a foreseen
amendment (never edits the original Context/Decision/Consequences), but triggered by a
revalidation finding rather than a planned follow-through.

**Detecting it.** The header table's `Supersedes`/`Superseded by` cell names a later ADR for one
specific clause or mechanism — but the Decision body's own prose for that clause still states the
old mechanism/value with no inline caveat. `harness:decision-watcher`'s revalidation mode is what
actually finds these live, by sampling accepted Decision text against shipped code: a
header-recorded-but-body-unrestated gap reads as a `falsified` verdict, not `confirmed`, because
the sampled body clause no longer matches reality even though the ADR's own paper trail (the
header cell) is technically complete.

**The stale clause need not be another ADR's supersession** — adr-0040/adr-0049 (below) drift
against a script's own comment-ladder value (`scripts/measure-size.mjs`'s repeated silent budget
re-basing) with no `Supersedes`/`Superseded by` relationship at all. The shape test is still the
same one: the ADR's own recorded fact (there, a header cell; here, the Acceptance/Decision text
itself) has moved on without the body prose catching up — the source of the drift varies, the fix
(a same-file restating `## Amendment`) doesn't (Kim's ruling, 2026-08-27).

[verified] 12 worked instances, all in this repo, each fixed via its own append-only `## Amendment`
(2026-08-21 through 2026-08-28): adr-0007 (Amendment 1, 2026-08-21, commit `21bea37c` — a direct
commit, no PR), adr-0017 (PR #1626), adr-0018 (PR #1625), adr-0021 (PR #1636), adr-0025
(PR #1635), adr-0030 (PR #1679), adr-0032 (PR #1676), adr-0033 (PR #1678), adr-0035 (PR #1677),
adr-0040 (PR #1688), adr-0049 (PR #1688, batched with adr-0040 — the script/comment-ladder-drift
variant named above), adr-0058 (PR #1691 — a third drift-source variant: a live AA-contrast
re-measurement found the `success` remedy's original pin no longer cleared, with no other ADR and
no script value involved at all).

**The 5th shape: the phantom-tool citation (an ADR "verified with" a script that was never
committed).** An ADR's Decision, Consequences, or Acceptance cites a verification tool by path
("verified with `color-verify/contrast-check.py`", "gated by `scripts/x.py`") and the file has no git
history in the repo at all (`git log --all -- <path>` is empty): the tool existed on an author's disk,
in a scratch clone, or only in intent, and the ADR's evidence trail rests on it. Different from the
4th shape: nothing superseded the claim and no value moved; the cited instrument never existed here,
so every figure it "verified" is an unverifiable pin until re-derived by a method the repo can
actually run. Against the table above the original Decision still stands (the choice was right; only
its evidence citation was false), so it is the amendment row, never a supersession: the original text
stays; a same-file `## Amendment` (a) states the
citation is phantom and how that was established, (b) canonizes the replacement procedure by name
so later amendments and revalidation firings cite one method, and (c) re-derives or explicitly
declines to re-derive each pinned figure. For contrast pins the canonized manual procedure is
OKLCH → OKLab → linear sRGB (Ottosson matrices) → relative luminance → WCAG contrast ratio, the
method GH #1690 used.

**Detecting it.** Grep every accepted ADR for tool paths in the verification vocabulary ("verified
with", "gated by", "measured by", a `scripts/`/`tools/` path) and check each against `git log --all`;
`harness:decision-watcher`'s revalidation mode surfaces the same thing as an `untestable` verdict
when the sampled claim names an instrument the sampler cannot run.

**Ramp-rework figure drift, the note that rides with it.** Once a phantom-verified pin is re-derived,
the re-derivation often finds REAL drift with no other ADR and no script involved: a later token-ramp
rework moved the underlying colours and the ADR's pinned figures never caught up, even where every
pairing still clears its floor. adr-0059's PR #1696 re-audit (GH #1694) is the instance: hover-track
ceiling 7.81 → 9.44:1, thumb-vs-fill light leg 4.79 → 4.66, thumb-vs-rail both legs off by about one
full point, most likely from the 2026-07-10 neutral-ramp rework, corrected by append-only Amendment
with no consequence (every pairing still clears SC 1.4.11's 3:1). A ramp rework is therefore a
revalidation trigger for every ADR that pins a contrast figure, not only for the ones it breaks.

[verified] 2 worked instances, both in this repo, both fixed via append-only `## Amendment`
(2026-08-28; harvested from `.claude/ops/adr-queue.json`'s adr-0058/adr-0059 rows, cleared by the PR that
landed this entry, PR #1712, 2026-08-29): adr-0058 (phantom citation found during PR #1691's re-pin, GH #1690; the
citation corrected and the procedure canonized in PR #1693, GH #1692), adr-0059 (same correction in
PR #1693; the full Decision-section re-audit under the canonized procedure in PR #1696, GH #1694).

**How to add one.** Copy `0000-template.md` → `NNNN-<title>.md` at the next free number; fill
Context · Decision · Consequences · Alternatives; set `Repairs:`; leave `Status: proposed` until
Kim ratifies. There is no index row to add — the file IS the index entry. First check §1c (in
`status-dialects.md`): whether the thing earns an ADR at all.
