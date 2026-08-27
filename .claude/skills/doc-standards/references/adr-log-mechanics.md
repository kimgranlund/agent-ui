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

[verified] 9 worked instances, all in this repo, each fixed via its own append-only `## Amendment`
(2026-08-21 through 2026-08-26): adr-0007 (Amendment 1, 2026-08-21, commit `21bea37c` — a direct
commit, no PR), adr-0017 (PR #1626), adr-0018 (PR #1625), adr-0021 (PR #1636), adr-0025
(PR #1635), adr-0030 (PR #1679), adr-0032 (PR #1676), adr-0033 (PR #1678), adr-0035 (PR #1677).

**How to add one.** Copy `0000-template.md` → `NNNN-<title>.md` at the next free number; fill
Context · Decision · Consequences · Alternatives; set `Repairs:`; leave `Status: proposed` until
Kim ratifies. There is no index row to add — the file IS the index entry. First check §1c (in
`status-dialects.md`): whether the thing earns an ADR at all.
