# Rubric — llms.txt

Scores an `llms.txt` (and optional `llms-full.txt`) as an agent-facing corpus map. Scoring method and severities: see `README.md`.

| # | Dimension | Type | What it checks | 1 (fail) → 3 (adequate) → 5 (excellent) |
|---|---|---|---|---|
| D1 | Format compliance | [gate] | H1 project name + blockquote summary + H2 sections of linked items | 1: free-form / no links · 3: shape present · 5: standard shape, clean sections |
| D2 | Links present & valid | [gate] | Each entry links to a markdown-accessible page that resolves | 1: concepts with no links · 3: links present · 5: all links resolve to markdown |
| D3 | Description quality | [review] | One accurate sentence per link, written for routing | 1: missing/vague · 3: present · 5: precise, tells an agent exactly what's behind each link |
| D4 | Index vs. content | [review] | `llms.txt` is a lean index; full corpus in `llms-full.txt` | 1: dumps content into llms.txt · 3: somewhat heavy · 5: lean index + separate full file |
| D5 | Curation (signal/noise) | [review] | Authoritative content only; chrome/ads/low-value excluded | 1: includes noise · 3: mostly clean · 5: only authoritative surfaces |
| D6 | Placement & discovery | [gate] | Served at `/llms.txt` (optionally `.well-known` + discovery headers) | 1: not at root · 3: at root · 5: root + discovery affordances |
| D7 | Versioning | [review] | Versioned per release where the surface changes | 1: stale across versions · 3: single current · 5: versioned or stable-by-design |

**Gate to promote:** D1, D2, D6 must each score ≥ 3. A map with no resolvable links (D2) or wrong placement (D6) cannot be navigated by an agent.

**Top failure to look for first:** a list of concepts and summaries with no links (D2 = 1) — superficial; the agent can't reach any detail.
