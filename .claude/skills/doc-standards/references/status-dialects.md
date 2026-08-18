# Status dialects, the ADR-earns test, the intent-tier rule, and the status philosophy (doc-standards §1 / §1c / §1d / §2)

## 1 · Status dialects (per type — three dialects, deliberate)

| Type | Dialect | Vocabulary | Who flips |
|---|---|---|---|
| ADR | blockquote TABLE — `> \| **Status** \| <kw> \|`, six fixed rows (Status · Date · Proposed by · Ratified by · Repairs · Supersedes / Superseded by) | `proposed · accepted · superseded · deprecated` — ONE bare keyword, never trailing prose | **Only Kim ratifies → accepted**, via either signal (ADR-0149): the in-tree hand-edit, or a `ratify ADR-####` comment/review by Kim on GitHub, executed by `scripts/adr_ratify.py` (gh-verified owner utterance → Status + Ratified-by + derived-index regen, fail-closed — it writes NO index row; see §1b). A flip whose **Repairs** cell books items "on ratification" also files ONE OPEN tracking issue holding them verbatim (label `task`, GH #544) — **closing that issue is the record the repairs landed**; leaving it open is the only thing that makes an unexecuted booking visible. The registered PreToolUse guard still blocks any agent Edit/Write flip unconditionally — the script is the only agent-side path, and it writes the housekeeping itself |
| Ticket (HISTORICAL — through TKT-0096) | YAML frontmatter (`doc-type: ticket`) | `open · doing · done · wontfix`; `kind: bug\|feature`; `size` on features only | Agents flip freely as work progresses |
| SPEC / LLD / PRD | blockquote STATUS LINE — `> Status: <kw> · v# · <date> · Layer: …` | `proposed · accepted · superseded` | PRDs flip at Kim's ratification; SPEC/LLD — see §2 |

**Ticket, current (ADR-0145, 2026-07-18):** new work items are GitHub Issues, not files —
`.claude/docs/tickets/` is a frozen historical archive from here on, never a target for new
entries (§6's own archive rule applies retroactively to the whole tier, not just superseded
records). File via `gh issue create` or the repo's `.github/ISSUE_TEMPLATE/{feature,bug}.yml`
forms, which mirror §4's section contract field-for-field. The status/kind/size vocabulary maps
onto real GitHub primitives, not a parallel taxonomy:

| Old field | Old value | GitHub mechanism | Note |
|---|---|---|---|
| `kind` | `bug` / `feature` | the `bug` label (GitHub's default) / the dedicated `feature` label ("Feature intake record", the file-feature contract) | NOT a native Issue Type — that feature is organization-level and unavailable on this personal-account repo (ADR-0145's build-time amendment). Features minted through #844 (2026-08-13) carry the default `enhancement` label; the dedicated `feature` label is the live convention since |
| `size` | `small` / `big` | the `size:small` / `size:big` label | same taxonomy, just a label instead of frontmatter |
| `status` | `open` | Issue open, no extra label | |
| `status` | `doing` | Issue open + the `doing` label | GitHub's own state has no "in progress" value |
| `status` | `done` | Issue closed, close reason `completed` | native GitHub field, not a label |
| `status` | `wontfix` | Issue closed, close reason `not planned` | native GitHub field, not a label |
| `## Findings` | dated entries, appended | dated Issue **comments**, appended | same discipline — the SAME verb `docs:file-bug`'s own dispatch contract already names |

ADR/PRD/SPEC/LLD and living-state docs (PLAN/ROADMAP) are explicitly **never** delegated — they
stay files on this map, always; only the TICKET tier moved.

## 1c · What earns an ADR — a decision, never a tracker

**Kim's standing rule (2026-08-13), verbatim:**

> moving forward: make sure we do not use ADR as a kind of Issue tracker or plan / roadmap
> substitute. ADR or `*DR` should be for documenting certain decisions, and not whenever something
> basic is built

**The doc-weight test at every intake:** *is there a DECISION a future reader must find and cite?* —
NOT "did we build something." Shipping a component, fixing a bug, or finishing a slice earns no
`*DR` on its own. What earns one is a genuine contract fork or ruling: a choice between real
alternatives that later work is bound by.

| The thing you have | Where it goes |
|---|---|
| A work item — to do, doing, done, a bug | a **GitHub Issue** (ADR-0145, §1) — never an ADR |
| A forward plan, sequencing, "what's next" | **PLAN / ROADMAP** (the living-state docs, §1) — never an ADR |
| A status rollup, "what's still open" | generated on the fly (§1b, `adr-log-mechanics.md`) — never a committed file |
| A ratified decision a future reader must cite | an **ADR** — `proposed`, and only Kim flips it (§1) |

`component-design` §6 owns the full earn-the-doc routing for a component intake ("Default-no
on documents… **ADR only for contract-changing forks**") — cite it, don't restate it here. Both rules
point the same way: the ADR tier is narrow on purpose, and an ADR minted to record activity rather
than a decision is the defect this rule names.

## 1d · The intent tier (IDR) and PRD granularity — Kim's 2026-08-18 tier ruling

**Kim's ruling (2026-08-18), verbatim:**

> IDR should not be made for features. Intent is at the global app/project level. PRD docs should
> be created for apps (like agent-admin-app) and that PRD would document the teams feature (along
> all the other agent features).

and, same day:

> Agent UI as a platform/system should have central Intent and organized structured IDR documents.

> PRDs can exist at various levels of granularity.

**The IDR tier is platform-global only.** An IDR (intent decision record, `.claude/docs/idr/`)
states a product intent that holds across the whole platform — an identity claim, a medium claim,
a trust-boundary law, a unit-of-product claim. A feature's WHY/WHAT — however strategic — lives in
the PRD that owns its app or family, never in an IDR. The four 2026-08-17 feature-scoped IDRs
(IDR-0001…0004) predate this ruling; each carries a dated relocation note and awaits Kim's
supersession flip.

**The central Intent record** is [`product-brief.md`](../../../docs/product-brief.md) (accepted
2026-08-17 — the identity sentence + product principles); the platform IDR set under `idr/` is its
decision spine. IDRs follow the ADR dialect exactly (§1): blockquote status table,
`proposed · accepted · superseded`, **only Kim flips**, accepted bodies append-only, **no index
file** in the folder.

**The PRD tier is multi-granular, deliberately.** Platform-area PRDs (e.g. the A2UI expert
system), app PRDs (e.g. agent-admin-app), family PRDs (chart/content/report), and finer
feature-level PRDs are ALL legitimate. A finer PRD nests under its coarser parent by CITING it —
never by duplicating it (one fact, one home). The existing corpus's granularity mix is valid as-is;
nothing is force-fit to one altitude. A feature section inside an app PRD may later be promoted to
its own child PRD when it outgrows the section — that is the normal growth path, not a defect.

**The hierarchy, top to bottom:** central Intent (`product-brief.md` + platform IDRs) → PRDs at
whatever granularity fits, coarse→fine, each citing upward → ADR / SPEC / LLD exactly as before
(§1c's earn-the-doc test unchanged).

| The thing you have | Where it goes |
|---|---|
| A platform-global product intent (identity, medium, trust boundary, unit of product) | an **IDR** — `proposed`, only Kim flips |
| An app's or family's WHY/WHAT, incl. its features | the owning **PRD** (minting a new sibling PRD when no existing one owns the altitude — the content-family sibling-vs-extension precedent) |
| A feature's WHY/WHAT inside an app | a **section of the app's PRD**, promotable to a child PRD when it outgrows the section |

## 2 · The status philosophy (why shipped specs still read `proposed`)

**Deliberate convention, not rot.** The repo ratifies *decisions* (the ADR Status cell — the one
human-gated field) and *builds* (the tree + gates + `done` tickets). SPEC/LLD statuses lag by
design — "when it disagrees with the tree, the tree wins" — so a `proposed` SPEC whose build
shipped is normal; do NOT sweep-flip statuses to match ship state. A SPEC/LLD flips to `accepted`
only when someone deliberately marks the contract stable (rare — grep the corpus for the current set; a copied count here decays, GH #761).
Accepted ADRs are append-only: extensions land as `## Amendment` sections or as rows in the
current wave's OWN proposed ADR, never edits to the accepted body (REV-annotated mechanical
pointer repairs excepted).
