"""T-0312: writes the agent-ui contract-audit mapping that `audit.py scan` (skill context-fog-of-war) reads.
Usage: python3 .sdlc/evals/fog/contract-audit/make_mapping.py [OUTDIR]. Writes mapping.json and mapping-topics.json
to OUTDIR (default: this folder); reads nothing. Advisory only (Kim 2026-10-16, P6): no gate runs it.

From the 2026-10-16 field run (/private/tmp scratch), plus the two surfaces round 7 found missing: the producer's
repair text and the render_surface tool definition. No schemas: payload validation and the T-0159 preset prose gate
already cover schema-mismatch, so that detector abstains here."""
import json, os, sys
out = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))
os.makedirs(out, exist_ok=True)
A = 'packages/agent-ui/a2ui/src'
code_skill = [{'start': r'^\s+(description|content):', 'end': r'^\s+[a-zA-Z]+:|^\s*\}'}]
literals = {'include': '[\'"`]', 'exclude': r'^\s*(//|\*|/\*)|^\s*import '}
mapping = {
 'version': 1,
 'notes': 'agent-ui contract-audit mapping (T-0312). Load modes from rounds 3 to 7 traces: persona foundation/surfaceStyle/houseFacts, grammar prompts, catalogs, selection sidecars and the tool definition framed in full; library and preset skills index-only; mini-skills, exemplars and repair text triggered (repair only after a failed round).',
 'surfaces': [
  {'id': 'catalog', 'kind': 'catalog', 'paths': [f'{A}/catalog/default/catalog.json', f'{A}/catalog/personas/*/catalog.json'], 'load': 'full', 'authority': True},
  {'id': 'selection', 'kind': 'catalog', 'paths': [f'{A}/catalog/default/selection.json', f'{A}/catalog/personas/*/selection.json'], 'load': 'full', 'authority': True},
  {'id': 'basic-catalog', 'kind': 'catalog', 'paths': [f'{A}/catalog/a2ui-basic/catalog.json', f'{A}/catalog/a2ui-basic/selection.json'], 'load': 'full', 'authority': True, 'scope': 'a2ui-basic'},
  {'id': 'grammar', 'kind': 'prompt', 'paths': [f'{A}/agent/prompts/*.md'], 'load': 'full'},
  {'id': 'mini-skills', 'kind': 'skill', 'paths': [f'{A}/agent/prompts/mini-skills/*.md'], 'load': 'triggered'},
  {'id': 'library-skills', 'kind': 'skill', 'paths': ['site/pages/agent-admin-libraries.ts'], 'load': 'index-only', 'regions': code_skill, 'index': {'linePattern': r'^\s+description:'}},
  {'id': 'preset-skills', 'kind': 'skill', 'paths': ['site/pages/agent-admin-presets.ts'], 'load': 'index-only', 'regions': code_skill, 'index': {'linePattern': r'^\s+description:'}},
  {'id': 'persona', 'kind': 'persona', 'paths': ['site/pages/agent-admin-presets.ts'], 'load': 'full', 'modalityFree': True, 'regions': [{'start': r'^\s+(foundation|surfaceStyle|houseFacts):', 'end': r'^\s+[a-zA-Z]+:'}]},
  {'id': 'checks', 'kind': 'check', 'paths': [f'{A}/catalog/*check*.ts', f'{A}/catalog/composite-moments.ts', f'{A}/catalog/personas/*/checks.ts'], 'load': 'full', **literals},
  {'id': 'repair', 'kind': 'repair', 'paths': [f'{A}/agent/produce.ts'], 'load': 'triggered', **literals},
  {'id': 'tool', 'kind': 'tool', 'paths': [f'{A}/agent/response-type.ts'], 'load': 'full', **literals},
  {'id': 'oracles', 'kind': 'oracle', 'paths': ['scripts/e2e-admin/probe/scenarios/*.ts'], 'load': 'none', 'include': r'say\(|expect', 'exclude': r'^\s*(//|\*)'},
  {'id': 'exemplars', 'kind': 'exemplar', 'paths': ['packages/agent-ui/a2ui/corpus/exemplar/v1_0/*.jsonl'], 'load': 'triggered', 'scope': ['agent-ui', 'a2ui-basic']},
 ],
 'entities': {'fromJson': [{'path': f'{A}/catalog/*/catalog.json', 'pointer': '/components'}, {'path': f'{A}/catalog/personas/*/catalog.json', 'pointer': '/components'}],
              'referencePattern': r'\b[A-Z][a-z]+(?:[A-Z][a-z]+)*(?:Card|Form|List|Table|Confirmation|Grid|Badge|Picker|Chart|Deck|Board)\b'},
 'generated': [{'output': f'{A}/agent/assets.gen.ts', 'sources': [f'{A}/agent/prompts/*.md', f'{A}/agent/prompts/mini-skills/*.md'], 'embedded': True, 'mtime': False}],
}
# The a2ui-basic catalog reaches only agents on that catalog; everything else reaches the agent-ui agents.
for s in mapping['surfaces']: s.setdefault('scope', 'agent-ui')
with open(f'{out}/mapping.json', 'w') as f: json.dump(mapping, f, indent=1); f.write('\n')
topics = dict(mapping, topics=['book', 'price', 'hours', 'facility'], notes=mapping['notes'] + ' Topics: the situations the concierge scenarios test (booking, prices, facility hours).')
with open(f'{out}/mapping-topics.json', 'w') as f: json.dump(topics, f, indent=1); f.write('\n')
