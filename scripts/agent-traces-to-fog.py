#!/usr/bin/env python3
"""agent-traces-to-fog.py (T-0239): hydrate one `.agent-traces/YYYY-MM-DD.jsonl` file into a context-fog-of-war
v2 `session.json`, so the skill's atlas shows how each live agent turn's context was routed.

Usage:
  python3 scripts/agent-traces-to-fog.py <trace.jsonl> --out <session.json> [--repo <root>] [--title <t>]
  python3 scripts/agent-traces-to-fog.py selftest

Mapping (the skill's references/hydration.md and session.schema.json, read and not changed here):
  - each trace line is one event (`message`), its evidence the raw line, in file order;
  - every part the turn's context loaded is a source with a `read` exposure and a `contextRecords` row
    `included`: the system-prompt sections (`routing.sections`, else the whole prompt from `promptChars` on a
    line older than T-0239; a section's T-0311 `digest` names its text in the prompt store), the exemplars, the mini-skills, the persona catalog and each entry framed whole
    into a user message (`load: full`);
  - an entry the persona section carries only as an index line (`load: index-only`) is a `discovered`
    exposure and a `candidates` row `available`;
  - a turn with retries, failure codes, a halt or an error gets one decision and one finding per failure code,
    each citing the exact text in its line.

Validate with the skill's own checker: `python3 ~/.claude/skills/context-fog-of-war/scripts/fog.py validate
<session.json>`. Publishing (`library.py publish`) is the conductor's. Stdlib only, Python 3.9+.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import tempfile
from typing import Any, Dict, List, Optional

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MINI_SKILL_DIR = 'packages/agent-ui/a2ui/src/agent/prompts/mini-skills'
PERSONA_DIR = 'packages/agent-ui/a2ui/src/catalog/personas'
FRAMED_HEADING = '## Referenced for this message\n'
FRAMED_KINDS = ('skill', 'workflow', 'resource')


def dumps(value: Any) -> str:
    """The JSON spelling the trace file uses (JSON.stringify: no ASCII escaping, no spaces)."""
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'))


def framed_references(text: str) -> List[Dict[str, str]]:
    """The `### label (kind)` block headings under `## Referenced for this message` (entries.ts)."""
    at = text.find(FRAMED_HEADING)
    if at == -1:
        return []
    out = []
    for line in text[at:].split('\n'):
        if not line.startswith('### ') or not line.endswith(')'):
            continue
        head, _, kind = line[4:-1].rpartition(' (')
        if head and kind in FRAMED_KINDS:
            out.append({'kind': kind, 'name': head.strip(), 'load': 'full', 'via': 'message'})
    return out


class Builder:
    def __init__(self, repo: str) -> None:
        self.repo = repo
        self.sources: List[Dict[str, Any]] = []
        self.source_ids: set = set()
        self.events: List[Dict[str, Any]] = []
        self.context: List[Dict[str, Any]] = []
        self.candidates: List[Dict[str, Any]] = []
        self.decisions: List[Dict[str, Any]] = []
        self.findings: List[Dict[str, Any]] = []
        self.warnings: List[str] = []

    def source(self, sid: str, path: str) -> str:
        if sid not in self.source_ids:
            self.source_ids.add(sid)
            self.sources.append({'id': sid, 'path': path, 'inventoried': os.path.isfile(os.path.join(self.repo, path))})
        return sid

    @staticmethod
    def excerpt(text: str, *candidates: str) -> Optional[str]:
        """The first candidate that appears verbatim in the event text (the validator's citation rule)."""
        for c in candidates:
            if c and c in text:
                return c
        return None

    def loaded(self, event: Dict[str, Any], sid: str, basis: str, *quotes: str) -> None:
        event['exposures'].append({'sourceId': sid, 'state': 'read', 'basis': basis})
        quote = self.excerpt(event['evidence']['text'], *quotes)
        if quote is not None:
            self.context.append({'sourceId': sid, 'eventId': event['id'], 'status': 'included', 'evidence': {'eventId': event['id'], 'excerpt': quote}})

    def indexed(self, event: Dict[str, Any], sid: str, basis: str, *quotes: str) -> None:
        event['exposures'].append({'sourceId': sid, 'state': 'discovered', 'basis': basis})
        quote = self.excerpt(event['evidence']['text'], *quotes)
        if quote is not None:
            self.candidates.append({'sourceId': sid, 'eventId': event['id'], 'kind': 'available', 'evidence': {'eventId': event['id'], 'excerpt': quote}})

    def turn(self, n: int, raw: str, line: Dict[str, Any]) -> None:
        eid = f'e{len(self.events)}'
        agent = line.get('agent') or 'agent'
        label = f"turn {n}: {agent} {line.get('model', '?')} {line.get('route', '?')} {line.get('outcome', '?')}"
        event = {'id': eid, 'seq': len(self.events), 'kind': 'message', 'label': label, 'actor': agent,
                 'timestamp': str(line.get('at', '')), 'evidence': {'traceLine': n, 'text': raw}, 'exposures': []}
        self.events.append(event)
        trace = line.get('trace') or {}
        routing = line.get('routing')

        # The persona catalog.
        catalog = (routing or {}).get('catalog') or {}
        persona = catalog.get('persona')
        catalog_id = catalog.get('id') or line.get('catalogId')
        if routing is None and isinstance(catalog_id, str) and '--' in catalog_id:
            tail = catalog_id.split('--', 1)[1]
            if os.path.isdir(os.path.join(self.repo, PERSONA_DIR, tail)):
                persona = tail  # an older line: a persona tail read back from the catalog id
        if persona:
            sid = self.source(f'persona:{persona}', f'{PERSONA_DIR}/{persona}/catalog.json')
            self.loaded(event, sid, 'routing.catalog.persona', dumps(persona))
        elif catalog_id:
            sid = self.source(f'catalog:{catalog_id}', f'catalog/{catalog_id}')
            self.loaded(event, sid, 'catalogId', dumps(catalog_id))
        for domain in catalog.get('domains') or []:
            sid = self.source(f'domain:{domain}', f'packages/agent-ui/a2ui/src/catalog/domains/{domain}/catalog.json')
            self.loaded(event, sid, 'routing.catalog.domains', dumps(domain))

        # The system prompt: one source per section, or the whole prompt on an older line.
        sections = (routing or {}).get('sections')
        if sections:
            for s in sections:
                sid = self.source(f"section:{s['id']}", f"system-prompt/{s['id']}")
                # T-0311: a digest names the section's text in the prompt store beside the trace file.
                stored = f", text in prompts/{s['digest']}.txt" if s.get('digest') else ''
                self.loaded(event, sid, f"routing.sections ({s['chars']} chars, {s['cache']}{stored})", dumps(s), dumps({'id': s['id'], 'chars': s['chars'], 'cache': s['cache']}), dumps(s['id']))
        elif 'promptChars' in trace:
            sid = self.source('section:system-prompt', 'system-prompt')
            self.loaded(event, sid, f"trace.promptChars ({trace['promptChars']} chars)", f'"promptChars":{trace["promptChars"]}')
        for ex in trace.get('exemplarIds') or []:
            sid = self.source(f'exemplar:{ex}', f'corpus/{ex}')
            self.loaded(event, sid, 'trace.exemplarIds', dumps(ex))
        # A selected mini-skill is loaded only when the turn composed a mini-skills section (an a2ui-off turn
        # selects but composes none).
        composed = any(s.get('id') == 'mini-skills' for s in sections or [])
        for ms in (routing or {}).get('miniSkills') or []:
            sid = self.source(f'mini-skill:{ms}', f'{MINI_SKILL_DIR}/{ms}.md')
            if composed:
                self.loaded(event, sid, 'routing.miniSkills', dumps(ms))
            else:
                self.indexed(event, sid, 'routing.miniSkills, selected with no mini-skills section composed', dumps(ms))

        # Referenced content: the routing block when present, else the framed blocks in the user text.
        if routing is not None:
            references = routing.get('references') or []
        else:
            references = framed_references(str(line.get('user', '')))
            if line.get('route') == 'produce':
                self.warnings.append(f'trace line {n}: no routing block (older than T-0239); sources come from exemplarIds, promptChars and the framed references in the user text.')
        for ref in references:
            sid = self.source(f"{ref['kind']}:{ref['name']}", f"{ref['kind']}/{ref['name']}")
            framed = dumps(f"### {ref['name']} ({ref['kind']})")[1:-1]
            if ref.get('load') == 'full':
                self.loaded(event, sid, f"{ref['kind']} framed in full ({ref.get('via', 'message')})", dumps(ref), framed, dumps(ref['name']))
            else:
                self.indexed(event, sid, f"{ref['kind']} index line only", dumps(ref), dumps(ref['name']))

        self.analyze(event, line)

    def analyze(self, event: Dict[str, Any], line: Dict[str, Any]) -> None:
        """One decision per turn that retried, carried failure codes, halted or errored; one finding per code."""
        text = event['evidence']['text']
        trace = line.get('trace') or {}
        codes: List[str] = []
        for retry in line.get('retries') or []:
            for f in retry.get('failures') or []:
                if f.get('code') and f['code'] not in codes:
                    codes.append(f['code'])
        for c in trace.get('failureCodes') or []:
            if c not in codes:
                codes.append(c)
        error = line.get('error') or {}
        outcome = line.get('outcome', 'ok')
        if not codes and outcome == 'ok':
            return
        n = event['evidence']['traceLine']
        did = f'd{len(self.decisions)}'
        quote = self.excerpt(text, f'"outcome":{dumps(outcome)}')
        evidence = [{'eventId': event['id'], 'excerpt': quote}] if quote else []
        if not evidence:
            return
        retries = len(line.get('retries') or [])
        self.decisions.append({'id': did, 'question': f'Did turn {n} ship on its first round?',
                               'answer': f'outcome {outcome} after {retries} retr{"y" if retries == 1 else "ies"}; codes {", ".join(codes) or "none"}',
                               'edgeIds': [], 'evidence': evidence})
        for code in codes:
            cite = self.excerpt(text, f'"code":{dumps(code)}', dumps(code))
            if cite is None:
                continue
            self.findings.append({
                'id': f'f{len(self.findings)}', 'decisionId': did, 'title': f'Turn {n} failed {code}',
                'category': 'guidance',
                'observation': f'The validator reported {code} on turn {n} ({outcome}, {retries} retries).',
                'hypothesis': 'The prompt routed to this turn did not carry enough guidance to produce a valid payload first time.',
                'improvement': 'Compare the turn\'s sources (sections, mini-skills, exemplars, references) with a first-try pass of the same scenario.',
                'target': 'packages/agent-ui/a2ui/src/agent/prompts/',
                'verification': 'Replay the scenario and check the turn ships in round 1.',
                'status': 'proposed', 'evidence': [{'eventId': event['id'], 'excerpt': cite}]})
        if error.get('message'):
            self.warnings.append(f"trace line {n}: {error.get('name', 'Error')}: {str(error['message'])[:160]}")


def git_head(repo: str) -> str:
    try:
        return subprocess.run(['git', '-C', repo, 'rev-parse', 'HEAD'], capture_output=True, text=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return ''


def hydrate(trace_path: str, repo: str, title: Optional[str] = None) -> Dict[str, Any]:
    with open(trace_path, 'rb') as fh:
        blob = fh.read()
    b = Builder(repo)
    malformed = 0
    for n, raw in enumerate(blob.decode('utf-8').split('\n'), start=1):
        if not raw.strip():
            continue
        try:
            line = json.loads(raw)
        except json.JSONDecodeError:
            malformed += 1
            continue
        if not isinstance(line, dict):
            malformed += 1
            continue
        b.turn(n, raw, line)
    if malformed:
        b.warnings.append(f'{malformed} malformed trace line(s) skipped.')
    if not b.events:
        raise ValueError('no usable trace lines')
    return {
        'schemaVersion': 2,
        'session': {'title': title or f'Agent traces {os.path.basename(trace_path)}', 'trace': os.path.abspath(trace_path),
                    'traceSha256': hashlib.sha256(blob).hexdigest(), 'repo': os.path.abspath(repo), 'revision': git_head(repo)},
        'coverage': {'inventory': 'Sources are the named parts of each turn\'s context (prompt sections, exemplars, mini-skills, '
                                  'catalogs, referenced entries); a source is inventoried when a repo file backs it.',
                     'warnings': b.warnings},
        'sources': b.sources,
        'events': b.events,
        'links': [],
        'decisions': b.decisions,
        'guidanceEdges': [],
        'findings': b.findings,
        'candidates': b.candidates,
        'contextRecords': b.context,
    }


def selftest() -> int:
    routed = {'v': 1, 'at': '2026-10-15T10:00:00.000Z', 'route': 'produce', 'agent': 'concierge', 'model': 'm', 'outcome': 'ok', 'user': 'hours?',
              'retries': [{'round': 2, 'failures': [{'code': 'PARSE', 'path': ''}]}],
              'trace': {'rounds': 2, 'healed': 0, 'failureCodes': ['PARSE'], 'exemplarIds': ['ex-1'], 'promptChars': 30},
              'routing': {'catalog': {'id': 'agent-ui--concierge', 'base': 'agent-ui', 'persona': 'concierge', 'domains': []},
                          'references': [{'kind': 'resource', 'name': 'property-knowledge-base', 'load': 'index-only', 'via': 'index'},
                                         {'kind': 'workflow', 'name': 'booking-flow', 'load': 'full', 'via': 'history'}],
                          'miniSkills': ['card-layout'], 'cacheBoundary': 20,
                          'sections': [{'id': 'grammar', 'chars': 20, 'cache': 'stable'}, {'id': 'mini-skills', 'chars': 5, 'cache': 'volatile'},
                                       {'id': 'persona', 'chars': 10, 'cache': 'volatile'}]}}
    older = {'v': 1, 'at': '2026-10-15T10:01:00.000Z', 'route': 'produce', 'agent': 'croupier', 'model': 'm', 'outcome': 'ok',
             'user': '## Referenced for this message\n### blackjack (resource)\nrules\n\nLet\'s play.',
             'trace': {'rounds': 1, 'healed': 0, 'failureCodes': [], 'exemplarIds': ['ex-2'], 'promptChars': 40}}
    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, 't.jsonl')
        with open(path, 'w', encoding='utf-8') as fh:
            fh.write(dumps(routed) + '\n' + dumps(older) + '\n')
        data = hydrate(path, REPO_ROOT)
    failures = []
    def check(ok: bool, what: str) -> None:
        if not ok:
            failures.append(what)
    check([e['evidence']['traceLine'] for e in data['events']] == [1, 2], 'one event per line, in order')
    states = {x['sourceId']: x['state'] for x in data['events'][0]['exposures']}
    check(states.get('resource:property-knowledge-base') == 'discovered', 'index-only entry is discovered')
    check(states.get('workflow:booking-flow') == 'read', 'full entry is read')
    check(states.get('mini-skill:card-layout') == 'read' and states.get('section:grammar') == 'read', 'mini-skill and section are read')
    included = {(c['eventId'], c['sourceId']) for c in data['contextRecords']}
    check(('e0', 'workflow:booking-flow') in included and ('e0', 'persona:concierge') in included, 'included records for loaded sources')
    check([c['sourceId'] for c in data['candidates']] == ['resource:property-knowledge-base'], 'index-only entry is an available candidate')
    off = dict(routed, routing=dict(routed['routing'], sections=[{'id': 'persona', 'chars': 10, 'cache': 'volatile'}]))
    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, 't.jsonl')
        with open(path, 'w', encoding='utf-8') as fh:
            fh.write(dumps(off) + '\n')
        off_states = {x['sourceId']: x['state'] for x in hydrate(path, REPO_ROOT)['events'][0]['exposures']}
    check(off_states.get('mini-skill:card-layout') == 'discovered', 'a selected mini-skill with no section composed is not read')
    check(('e1', 'resource:blackjack') in included, 'an older line falls back to the framed user text')
    check(len(data['findings']) == 1 and data['findings'][0]['title'] == 'Turn 1 failed PARSE', 'one finding per failure code')
    for coll in ('contextRecords', 'candidates'):
        for c in data[coll]:
            ev = data['events'][int(c['eventId'][1:])]
            check(c['evidence']['excerpt'] in ev['evidence']['text'], f'{coll} excerpt quotes its event')
    check(any('older than T-0239' in w for w in data['coverage']['warnings']), 'older line warned')
    digested = dict(routed, routing=dict(routed['routing'], sections=[{'id': 'grammar', 'chars': 20, 'cache': 'stable', 'digest': '0123456789abcdef'}]))
    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, 't.jsonl')
        with open(path, 'w', encoding='utf-8') as fh:
            fh.write(dumps(digested) + '\n')
        dg = hydrate(path, REPO_ROOT)
    grammar = [x for x in dg['events'][0]['exposures'] if x['sourceId'] == 'section:grammar']
    check(len(grammar) == 1 and 'prompts/0123456789abcdef.txt' in grammar[0]['basis'], 'a section digest names its prompt-store file (T-0311)')
    check(any(c['sourceId'] == 'section:grammar' and '"digest":"0123456789abcdef"' in c['evidence']['excerpt'] for c in dg['contextRecords']), 'the section record quotes its digest (T-0311)')
    for f in failures:
        print(f'FAIL {f}', file=sys.stderr)
    print('agent-traces-to-fog selftest: ' + ('FAIL' if failures else 'ALL PASS'), file=sys.stderr)
    return 1 if failures else 0


def main() -> int:
    if sys.argv[1:] == ['selftest']:
        return selftest()
    parser = argparse.ArgumentParser(description='Hydrate one .agent-traces JSONL into a context-fog-of-war v2 session.json.')
    parser.add_argument('trace')
    parser.add_argument('--out', required=True)
    parser.add_argument('--repo', default=REPO_ROOT)
    parser.add_argument('--title')
    args = parser.parse_args()
    try:
        data = hydrate(args.trace, args.repo, args.title)
    except (OSError, ValueError) as err:
        print(f'agent-traces-to-fog: {err}', file=sys.stderr)
        return 1
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, 'w', encoding='utf-8') as fh:
        fh.write(json.dumps(data, indent=2, ensure_ascii=False) + '\n')
    print(f'{args.out}: {len(data["events"])} events, {len(data["sources"])} sources, {len(data["findings"])} findings')
    return 0


if __name__ == '__main__':
    sys.exit(main())
